var path = require('path');
var fs = require('fs');
var libmod = require('../libmod');
var JSHINT = require('jshint').JSHINT;

function lint(argv) {
    var config = argv;

    config.srcDir = path.resolve(config['src-dir']);
    config.module = typeof config.module === 'string' ? [config.module] : config.module;
    config.ignores = typeof config['lint-ignore'] === 'string' ? [config['lint-ignore']] : config['lint-ignore'] || [];

    var errors = [];
    console.log('Starting jslint check...');
    config.module.forEach(function(mod) {
        libmod.moduleWalk(mod, config, function(name, ast) {
            if (config.ignores.indexOf(name) !== -1) {
                return;
            }

            var fileName  = name.indexOf('.js') === -1 ? name + '.js' : name;
            fileName = path.resolve(config.srcDir, fileName);
            var content = fs.readFileSync(fileName, 'utf-8');
            var result = JSHINT(content);

            if (!result) {
                JSHINT.errors.map(function(err) {
                    err.fileName = name;
                });
                errors = errors.concat(JSHINT.errors);
            }

            console.log("[%s] %s", result ? '\033[1;32mSUCC\033[0m' : '\033[1;31mFAIL\033[0m', name);
        });
    });

    errors.forEach(function(error) {
        if (error && error.id) {
            console.log(
                "jslint %s: %s(%s:%s): %s", 
                error.id.replace('(', '').replace(')', ''), 
                error.fileName,
                error.line,
                error.character,
                error.raw
            );
            console.log('%s', error.evidence);
        }
    });
}

exports.lint = lint;
