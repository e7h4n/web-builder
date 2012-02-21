#!/usr/bin/env coffee

_ = require "underscore"
path = require "path"
wrench = require "wrench"

build = (config) ->
    _.defaults config, {
        compress: false
        buildDir: "./build"
        srcDir: "./src"
        loader: "./resource/loader.js"
        preload: []
        module: []
        ignores: []
        "without-loader": false
        "lint-only": false
        "force-pass-lint": false
    }

    config.srcDir = path.resolve config.srcDir
    config.buildDir = path.resolve config.buildDir

    lintResult = (require "./lint").lint config

    if config["force-pass-lint"] and not lintResult
        process.stderr.write "exit 1: Lint check failed\n"
        process.exit 1

    if not config["lint-only"]
        (require "./combo").build config

exports.build = build
exports.version = 2.0

if not module.parent
    path = require "path"

    isString = (str) ->
        typeof str is "string"

    options =
        "compress":
            alias: "c",
            describe: "Compress js code"

        "help":
            alias: "h",
            describe: "this help"

        "build-dir":
            describe: "generated code output dir",
            default: "./_build"

        "src-dir":
            describe: "source code root dir",
            default: "./"

        "loader":
            describe: "CommonJS Module Loader file",
            default: "./resource/loader.js"

        "preload":
            describe: "JS files to be preload"

        "module":
            describe: "Module name which to be generated",
            demand: true

        "without-loader":
            describe: "Don't invoke commonjs loader",
            default: false

        "lint-only":
            describe: "Don't build module, only run jslint to check error",
            default: false

        "lint-ignore":
            describe: "Don't run lint for this file"

        "force-pass-lint":
            describe: "Compile javascript even though jslint failed ",
            default: false

    opt = require "optimist"

    opt = opt.usage "Youdao JS Builder #{exports.version} \n Usage $0 [Options] [module ..]"

    for optionName, optionValue of options
        opt = opt.options optionName, optionValue

    argv = opt.argv

    if argv.help or argv.h
        opt.showHelp()
        process.exit 0

    argv.srcDir = path.resolve argv["src-dir"]
    argv.buildDir = path.resolve argv["build-dir"]

    argv.module = (isString argv.module) and [argv.module] or argv.module

    argv.ignores = (isString argv["lint-ignore"]) and [argv["lint-ignore"]] or argv["lint-ignore"] || []
    argv.ignores = argv.ignores.map (str) ->
        new RegExp str, 'i'

    argv.preload = (isString argv.preload) and [argv.preload] or argv.preload

    build argv
