/*jslint node: true, vars: true*/
var path = require('path');
var fs = require('fs');
var libmod = require('../libmod');
var jslint = require('jslint');

function lint(argv) {
    'use strict';
    var config = argv;
    var isLintPassed = true;

    config.srcDir = path.resolve(config['src-dir']);
    config.module = typeof config.module === 'string' ? [config.module] : config.module;
    config.ignores = typeof config['lint-ignore'] === 'string' ? [config['lint-ignore']] : config['lint-ignore'] || [];
    config.ignores = config.ignores.map(function (str) {
        return new RegExp(str, 'i');
    });

    config.module.forEach(function (mod) {
        var totalErrorCount = 0;
        var fileName  = mod.indexOf('.js') === -1 ? mod + '.js' : mod;
        fileName = path.resolve(config.srcDir, fileName);
        if (!path.existsSync(fileName)) {
            return;
        }
        process.stdout.write('Linting module ' + mod + ' ...');
        libmod.moduleWalk(mod, config, function (name, ast) {
            var ignore = config.ignores.length !== 0;

            if (ignore) {
                ignore = config.ignores.some(function (re) {
                    return re.test(name);
                });
            }

            if (ignore) {
                return;
            }

            var modFileName = name.indexOf('.js') === -1 ? name + '.js' : name;
            modFileName = path.resolve(config.srcDir, modFileName);

            var content = fs.readFileSync(modFileName, 'utf-8');
            var isPassed = jslint(content);

            if (!isPassed) {
                if (totalErrorCount === 0) {
                    process.stdout.write('\n');
                }

                process.stdout.write(modFileName.replace(config.srcDir, '').substr(1) + '\n');
                var data = jslint.data();
                isLintPassed = false;
                var errCount = 0;
                totalErrorCount += data.errors.length;
                data.errors.forEach(function (error) {
                    errCount += 1;
                    console.log(' #%d %s', errCount, error.reason);
                    console.log(error.evidence + ' // Line %d, Pos %d',
                        error.line, error.character);
                });
            }
        });

        if (totalErrorCount === 0) {
            process.stdout.write(' done\n');
        } else {
            console.log('%d error(s) found', totalErrorCount);
        }
    });

    return isLintPassed;
}

exports.lint = lint;
