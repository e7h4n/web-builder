var path = require('path');
var fs = require('fs');
var libmod = require('../libmod');
var JSHINT = require('jshint').JSHINT;

function lint(argv) {
    var config = argv;

    config.srcDir = path.resolve(config['src-dir']);
    config.module = typeof config.module === 'string' ? [config.module] : config.module;
    config.ignores = typeof config['lint-ignore'] === 'string' ? [config['lint-ignore']] : config['lint-ignore'] || [];

    config.module.forEach(function(mod) {
        libmod.moduleWalk(mod, config, function(name, ast) {
            if (config.ignores.indexOf(name) !== -1) {
                console.log("Lint %s ... \033[1;34mignore\033[0m", name);
                return;
            }

            var fileName  = name.indexOf('.js') === -1 ? name + '.js' : name;
            fileName = path.resolve(config.srcDir, fileName);
            var content = fs.readFileSync(fileName, 'utf-8');
            var result = JSHINT(content);

            console.log("Lint %s ... %s", name, result ? '\033[1;32mpass\033[0m' : '\033[1;31mfail\033[0m');

            if (!result) {
                JSHINT.errors.forEach(function(error) {
                    if (error && error.id) {
                        console.log(
                            "jslint %s: %s(%s:%s): %s", 
                            error.id.replace('(', '').replace(')', ''), 
                            error.name,
                            error.line,
                            error.character,
                            error.reason
                        );
                        console.log('%s', error.evidence);
                    }
                });
            }
        });
    });
}

exports.lint = lint;
