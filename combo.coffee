path = require "path"
fs = require "fs"
uglifyjs = require "uglify-js"
wrench = require "wrench"
module = require "./lib/module"
_ = require "Underscore"

build = (config) ->
    _.defaults config, {
        compress: false
        buildDir: "./build"
        srcDir: "./src"
        loader: "./resource/loader.js"
        preload: []
        module: []
        "without-loader": false
    }

    config.srcDir = path.resolve config.srcDir
    config.buildDir = path.resolve config.buildDir

    modules = {}
    finalCode = ""

    if not config["without-loader"] and config.loader
        ast = uglifyjs.parser.parse module.getModContent config.loader
        finalCode += module.generateCode ast, "loader", config.compress

    config.preload.forEach (modName) ->
        filename = module.fixFilename modName
        code = module.getModContent (module.fixFilename modName), config.srcDir
        ast = uglifyjs.parser.parse code

        if config.compress
            ast = uglifyjs.uglify.ast_mangle ast
            ast = uglifyjs.uglify.ast_squeeze ast

        finalCode += (uglifyjs.uglify.gen_code ast, {
            beautify: !config.compress,
            indent_level: 2
        }) + ';'

    config.module.forEach (modName) ->
        if path.existsSync path.resolve config.srcDir, (module.fixFilename modName)
            depsQueue = []

            module.moduleWalk modName, config.srcDir, (modName, code) ->
                if modules[modName] is undefined
                    modules[modName] = module.generateCode code, modName, config.compress
            , depsQueue

            depsQueue.push modName
            depsQueue.forEach (modName) ->
                finalCode += modules[modName]

        outputfile = path.resolve config.buildDir, (module.fixFilename modName)

        dir = path.resolve outputfile, ".."
        wrench.mkdirSyncRecursive dir, 0755

        fs.writeFile outputfile, finalCode, "utf-8"

exports.build = build
