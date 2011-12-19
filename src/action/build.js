/*jslint node: true, vars: true*/
var path = require('path');
var fs = require('fs');
var uglifyjs = require('uglify-js');
var libmod = require('../libmod');

function getFileName(file) {
    'use strict';
    if (file.indexOf('.css') !== -1 || file.indexOf('.js') !== -1) {
        return file;
    } else {
        return file + '.js';
    }
}

function build(argv) {
    'use strict';
    var config = argv;
    var stdout = function (str, isContinueLine) {
        if (config['dry-run'] && !isContinueLine) {
            process.stdout.write('[DRY RUN] ');
        }
        process.stdout.write(str);
    };

    config.srcDir = path.resolve(config['src-dir']);
    config.buildDir = path.resolve(config['build-dir']);
    config.module = typeof config.module === 'string' ? [config.module] : config.module;
    config.preload = typeof config.preload === 'string' ? [config.preload] : (config.preload || []);

    var modules = {};

    var loaderCode = '';
    if (!config['without-loader']) {
        loaderCode = fs.readFileSync(path.resolve(path.dirname(process.argv[1]), 'loader.js'), 'utf-8');

        var ast = uglifyjs.parser.parse(loaderCode);
        loaderCode = libmod.generateCode(ast, 'loader', config.compress);
    }

    if (config.preload.length > 0) {
        stdout('Preload modules ...');
        config.preload.forEach(function (file) {
            stdout('.', true);
            file = getFileName(file);
            var code = fs.readFileSync(path.resolve(config.srcDir, file), 'utf-8');
            var ast = uglifyjs.parser.parse(code);
            var pro = uglifyjs.uglify;

            if (config.compress) {
                ast = pro.ast_mangle(ast);
                ast = pro.ast_squeeze(ast);
            }

            loaderCode += pro.gen_code(ast, {
                beautify: !config.compress,
                indent_level: 2
            }) + ";\n";
        });
        stdout(' done\n', true);
    }

    config.module.forEach(function (mod) {
        stdout('Generate module ' + mod + ' ...');
        var comboFile = loaderCode;
        var fileName = getFileName(mod);
        if (path.existsSync(path.resolve(config.srcDir, fileName))) {
            var depsQueue = [];
            libmod.moduleWalk(mod, config, function (name, ast) {
                if (modules[name] === undefined) {
                    stdout('.', true);
                    modules[name] = libmod.generateCode(ast, name, config.compress);
                }
            }, depsQueue);

            depsQueue.push(mod);
            depsQueue.forEach(function (dep) {
                comboFile += modules[dep];
            });
        }

        if (!config['dry-run']) {
            var outputfile = path.resolve(config.buildDir, getFileName(mod));
            var dir = path.resolve(outputfile, '..');
            libmod.mkdirSilent(dir);

            fs.writeFile(outputfile, comboFile, 'utf-8', function () {
                stdout(' done\n', true);
            });
        } else {
            stdout(' done\n', true);
        }
    });
}

exports.build = build;
