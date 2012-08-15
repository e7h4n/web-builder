path = require "path"
fs = require "fs"
uglifyjs = require "uglify-js"
wrench = require "wrench"
module = require "./lib/module"
_ = require "underscore"
crypto = require "crypto"
CACHE = "./.front-build-cache"

wrench.mkdirSyncRecursive CACHE, 0o755

cacheFile = (code, compress, generator) ->
    if typeof code != 'string'
        code = JSON.stringify code

    fileHash = (((crypto.createHash "sha1").update code).digest "hex")
    if compress
        fileHash += "_compress"

    cache = path.resolve CACHE, fileHash
    if path.existsSync cache
        code = fs.readFileSync cache, "utf-8"
    else
        code = generator()
        fs.writeFileSync cache, code, "utf-8"

    return code

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
        finalCode += cacheFile code, config.compress, () ->
            ast = uglifyjs.parser.parse code

            if config.compress
                ast = uglifyjs.uglify.ast_mangle ast
                ast = uglifyjs.uglify.ast_squeeze ast

            (uglifyjs.uglify.gen_code ast, {
                beautify: !config.compress,
                indent_level: 2
            }) + ';'

    config.module.forEach (modName) ->
        if path.existsSync path.resolve config.srcDir, (module.fixFilename modName)
            depsQueue = []

            module.moduleWalk modName, config.srcDir, (modName, code) ->
                if modules[modName] is undefined
                    modules[modName] = cacheFile code, config.compress, () ->
                        module.generateCode code, modName, config.compress
            , depsQueue

            depsQueue.push modName
            depsQueue.forEach (modName) ->
                finalCode += modules[modName]

        outputfile = path.resolve config.buildDir, (module.fixFilename modName)

        dir = path.resolve outputfile, ".."
        wrench.mkdirSyncRecursive dir, 0o755

        fs.writeFile outputfile, finalCode, "utf-8"

exports.build = build
