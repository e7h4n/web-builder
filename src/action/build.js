var path = require('path');
var fs = require('fs');
var uglifyjs = require('uglify-js');
var libmod = require('../libmod');

function build(argv) {
    var config = argv;

    config.srcDir = path.resolve(config['src-dir']);
    config.buildDir = path.resolve(config['build-dir']);
    config.module = typeof config.module === 'string' ? [config.module] : config.module;

    var modules = {};

    var loaderCode = fs.readFileSync(path.resolve(path.dirname(process.argv[1]), 'loader.js'), 'utf-8');

    var ast = uglifyjs.parser.parse(loaderCode);
    loaderCode = libmod.generateCode(ast, 'loader', config.compress);

    config.module.forEach(function(mod) {
        var depsQueue = [];
        console.log('Generate module:', mod);
        libmod.moduleWalk(mod, config, function(name, ast) {
            if (modules[name] === undefined) {
                console.log('...progress ' + name);
                modules[name] = libmod.generateCode(ast, name, config.compress);
            }
        }, depsQueue);

        var comboFile = loaderCode;
        depsQueue.push(mod);
        depsQueue.forEach(function(dep) {
            comboFile += modules[dep];
        });

        if (!config['dry-run']) {
            var outputfile = path.resolve(config.buildDir, mod.indexOf('.js') === -1 ? mod + '.js' : mod);
            var dir = path.resolve(outputfile, '..');
            libmod.mkdirSilent(dir);

            fs.writeFile(outputfile, comboFile, 'utf-8', function() {
                console.log('Successfully generated module ' + mod + '.');
            });
        } else {
            console.log('[Dry-run]Successfully generated module ' + mod + '.');
        }
    });
}

exports.build = build;
