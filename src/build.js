#!/usr/bin/env node

var optimist = require('optimist')
    .usage('Youdao JS Builder ' + require('./version').version + '\nUsage: $0 [Options] [module ..]')
    .options('compress', {
        alias: 'c',
        describe: 'Compress js code'
    })
    .options('help', {
        alias: 'h',
        describe: 'this help'
    })
    .options('build-dir', {
        describe: 'generated code output dir',
        default: './_build'
    })
    .options('src-dir', {
        describe: 'source code root dir',
        default: './'
    })
    .options('loader', {
        describe: 'CommonJS Module Loader file',
        default: './loader.js'
    })
    .options('module', {
        describe: 'Module name which to be generated',
        demand: true
    })
;

var argv = optimist.argv;
if (argv.help || argv.h) {
    optimist.showHelp();
} else {
    require('./action/build').build(argv);
}
