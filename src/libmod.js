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

function moduleWalk(moduleName, config, process, trace) {
    var fileName = moduleName.indexOf('.js') === -1 ? moduleName + '.js' : moduleName;
    var deps = [];

    trace = trace ? trace : [];

    var code = fs.readFileSync(path.resolve(config.srcDir, fileName), 'utf-8');
    var ast = normlizePath(
        uglifyjs.parser.parse(code), 
        path.dirname(path.resolve(config.srcDir, fileName)), 
        config
    );

    deps = getDependencies(ast);

    process(moduleName, ast);

    deps.map(function(dep) {
        if (trace.indexOf(dep) === -1) {
            trace.push(dep);
            moduleWalk(dep, config, process, trace);
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
            if (args[1] && (args[1][0] == "array")) {

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

    if (compress) {
        ast = pro.ast_mangle(ast);
        ast = pro.ast_squeeze(ast);
    }

    return pro.gen_code(ast, {
        beautify: !compress,
        indent_level: 2
    }) + ";\n";
}

/**
 * 统一所有 require 中的模块名路径
 *
 * @method normlizePath
 * @param {Array}ast AST
 * @param {String}relativePath
 * @param {Object}config
 * @return {Array} AST
 */
function normlizePath(ast, relativePath, config) {
    for (var i = 0, l = ast.length; i < l; i++) {
        var obj = ast[i];

        if (!obj) {
            continue;
        }

        // [ 'call',
        //   [ 'name', 'require' ],
        //   [ [ 'string', 'modName' ] ] ]
        if (
                obj[0] === 'call' &&
                        obj[1] &&
                        obj[1][0] === 'name' &&
                        obj[1][1] === 'require'
                ) {
            var modName = obj[2][0][1];

            if (modName.indexOf('.') === 0) {
                modName = path.resolve(relativePath, modName).replace(config.srcDir, '').substr(1);
                obj[2][0][1] = modName;
            }
        } else {
            if (obj.constructor === Array) {
                normlizePath(obj, relativePath, config);
            }
        }
    }

    return ast;
}

exports.generateCode = generateCode;
exports.moduleWalk = moduleWalk;
exports.mkdirSilent = mkdirSilent;
