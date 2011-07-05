var fs = require('fs');
var path = require('path');
var uglifyjs = require('uglify-js');
var sys = require('sys');

/**
 * 递归地创建一个目录
 *
 * @method mkdirSilent
 * @param {String}dir
 */
function mkdirSilent(dir) {
    if (dir !== '/' && !path.existsSync(path.dirname(dir))) {
        mkdirSilent(path.dirname(dir));
    }
    if (!path.existsSync(dir)) {
        fs.mkdirSync(dir, '0755');
    }
}

/**
 * 压缩并处理模块
 * 传入一个模块名，会递归的处理这个模块以及其依赖的所有模块
 *
 * @method processModule
 * @param {String}moduleName 模块名
 * @param {Array}depsQueue 依赖数组
 * @param {Object}config 路径等设置
 *  config.srcDir 模块位于的路径
 *  config.compress 是否压缩代码
 * @modules 压缩后的代码会放到这个对象里
 */
function processModule(moduleName, depsQueue, config, modules) {
    console.log('process module:', moduleName);
    var fileName = moduleName;
    var deps = [];
    var i = 0;
    var l = 0;

    if (fileName.indexOf('.js') === -1) {
        fileName = fileName + '.js';
    }

    var code = fs.readFileSync(path.resolve(config.srcDir, fileName), 'utf-8');
    var ast = uglifyjs.parser.parse(code);

    deps = getDependencies(ast);

    if (modules[moduleName] === undefined) {
        var processedCode = generateCode(ast, moduleName, config.compress);
        modules[moduleName] = processedCode;
    }

    deps.map(function(dep) {
        if (depsQueue.indexOf(dep) === -1) {
            depsQueue.push(dep);
            processModule(dep, depsQueue, config, modules);
        }
    });
}

/**
 * 获取一个模块的依赖关系
 * 
 * @method getDependencies
 * @param {Array}ast AST
 * @return {Array} 依赖数组
 */
function getDependencies(ast) {
    return getStaticDependencies(ast) || getDynamicDependencies(ast);
}

/**
 * 获取形如 define(name, factory) 中 factory 里面通过 require 定义的依赖关系
 *
 * @method getDynamicDependencies
 * @param {Array}ast AST
 * @return {Array} 依赖数组
 */
function getDynamicDependencies(ast) {
    var deps = [];

    // get dependencies
    // require('a') ==> call,name,require,string,a
    var pattern = /,call,name,require,string,([^,?]+)(?:\?|,|$)/g;
    var text = ast.toString();
    var match;
    while ((match = pattern.exec(text))) {
        if (deps.indexOf(match[1]) == -1) {
            deps.push(match[1]);
        }
    }

    return deps;
}

/**
 * 获取形如 define(name, deps, factory) 中的 deps 依赖关系
 *
 * @method getStaticDependencies
 * @param {Array}ast AST
 * @return {Array} 依赖数组
 */
function getStaticDependencies(ast) {
    var deps = null;

    // ast: [ 'toplevel', [ [ 'stat', [Object] ], [ 'stat', [Object], ... ] ] ]
    var stats = ast[1];

    for (var i = 0; i < stats.length; i++) {
        // [ 'stat', [ 'call', [ 'name', 'define' ], [ [Object] ] ] ]
        var stat = stats[i];

        if (stat.toString()
        .indexOf("stat,call,name,define,") == 0) {

            // stat:
            // [ 'stat',
            //   [ 'call',
            //     [ 'name', 'define' ],
            //     [ [Object], [Object], [Object] ] ] ]
            var args = stat[1][2];

            // args:
            //    [ [ 'string', 'program' ],
            //      [ 'array', [ [Object], [Object] ] ],
            //      [ 'function', null, [ 'require' ], [] ] ]
            if(args[1] && (args[1][0] == "array")) {

                // args[1]:
                //   [ 'array', [ [ 'string', 'a' ], [ 'string', 'b' ] ] ]
                deps = (deps || []).concat(args[1][1].map(function(item) {
                    return item[1];
                }));

            }

            break;
        }
    }

    return deps;
}

/**
 * 从 AST 生成代码
 *
 * @method generateCode
 * @param {Array}ast AST
 * @param {String}name 模块名
 * @param {Boolean}compress 是否压缩代码
 * @return {String} 生成的代码
 */
function generateCode(ast, name, compress) {
    // ast: [ 'toplevel', [ [ 'stat', [Object] ], [ 'stat', [Object], ... ] ] ]
    var stats = ast[1];

    for (var i = 0; i < stats.length; i++) {
        // [ 'stat', [ 'call', [ 'name', 'define' ], [ [Object] ] ] ]
        var stat = stats[i];

        if (stat.toString().indexOf('stat,call,name,define,function,,') === 0) {

            // stat[1]:
            //     [ 'call',
            //       [ 'name', 'define' ],
            //       [ [ 'function', null, [Object], [Object] ] ] ]
            var args = stat[1][2];

            args.unshift(['string', name]);

            // only process first "define"
            break;
        }
    }

    var pro = uglifyjs.uglify;

    if(compress) {
        ast = pro.ast_mangle(ast);
        ast = pro.ast_squeeze(ast);
    }

    return pro.gen_code(ast, {
        beautify: !compress,
        indent_level: 2
    }) + ";\n";
}

function build(argv) {
    var config = argv;

    config.srcDir = path.resolve(config['src-dir']);
    config.buildDir = path.resolve(config['build-dir']);
    config.module = typeof config.module === 'string' ? [config.module] : config.module;

    var modules = {};

    var loaderCode = fs.readFileSync(path.resolve(path.dirname(process.argv[1]), 'loader.js'), 'utf-8');

    var ast = uglifyjs.parser.parse(loaderCode);
    loaderCode = generateCode(ast, 'loader', config.compress);

    config.module.forEach(function(mod) {
        var depsQueue = [];
        console.log('\r==============================================================================');
        console.log('Module:', mod);
        console.log('==============================================================================\r');
        processModule(mod, depsQueue, config, modules);

        var comboFile = loaderCode;
        depsQueue.push(mod);
        depsQueue.forEach(function(dep) {
            comboFile += modules[dep];
            var outputfile = path.resolve(config.buildDir, dep.indexOf('.js') === -1 ? dep+'.js' : dep);
            var dir = path.resolve(outputfile, '..');
            mkdirSilent(dir);

            fs.writeFileSync(outputfile, dep !== mod ? modules[dep] : comboFile);
        });
    });
}

exports.build = build;
