var fs = require('fs');
var path = require('path');
var uglifyjs = require('./uglify/uglify-js');
var sys = require('sys');

var config = null;

var arg = process.argv[2];

if (typeof arg !== 'string') {
    console.log("Usage:");
    console.log("  build config.js");
    console.log("  build clear");
    process.exit();
}

var config = JSON.parse(fs.readFileSync(arg));

config.baseDir = path.resolve(path.dirname(arg), config.baseDir);
config.buildDir = path.resolve(path.dirname(arg), config.baseDir, config.buildDir);

console.log('baseDir:', config.baseDir);
console.log('buildDir:', config.buildDir);

var modules = {};

var loaderCode = fs.readFileSync(path.resolve(path.dirname(process.argv[1]), 'wrappings.js'), 'utf-8');
var ast = uglifyjs.parser.parse(loaderCode);
loaderCode = generateCode(ast, 'wrappings', config.compress);

config.modules.forEach(function(mod) {
    var depsQueue = [];
    console.log('\r==============================================================================');
    console.log('Module:', mod.name);
    console.log('==============================================================================\r');
    processModule(mod.name, depsQueue);

    var comboFile = loaderCode;
    depsQueue.push(mod.name);
    depsQueue.forEach(function(dep) {
        comboFile += modules[dep];
        var outputfile = path.resolve(config.buildDir, dep.indexOf('.js') === -1 ? dep+'.js' : dep);
        var dir = path.resolve(outputfile, '..');
        mkdirSilent(dir);

        fs.writeFileSync(outputfile, dep !== mod.name ? modules[dep] : comboFile);
    });
});

function mkdirSilent(dir) {
    if (dir !== '/' && !path.existsSync(path.dirname(dir))) {
        mkdirSilent(path.dirname(dir));
    }
    if (!path.existsSync(dir)) {
        fs.mkdirSync(dir, '0755');
    }
}

function processModule(moduleName, depsQueue) {
    console.log('process module:', moduleName);
    var fileName = moduleName;
    var deps = [];
    var i = 0;
    var l = 0;

    if (fileName.indexOf('.js') === -1) {
        fileName = fileName + '.js';
    }

    var code = fs.readFileSync(path.resolve(config.baseDir, fileName), 'utf-8');
    var ast = uglifyjs.parser.parse(code);

    deps = getDependencies(ast);

    if (modules[moduleName] === undefined) {
        var processedCode = generateCode(ast, moduleName, config.compress);
        modules[moduleName] = processedCode;
    }

    deps.map(function(dep) {
        if (depsQueue.indexOf(dep) === -1) {
            depsQueue.push(dep);
            processModule(dep, depsQueue);
        }
    });
}

function getDependencies(ast) {
    return getStaticDependencies(ast) || getDynamicDependencies(ast);
}

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
    }) + ";";
}
