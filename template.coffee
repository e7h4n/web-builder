uglify = require "uglify-js"
fs = require "fs"
fs = require "fs"
wrench = require "wrench"
path = require "path"
module = require "./lib/module"
_ = require "Underscore"

template = (config) ->
    _.defaults config, {
        jsDir: "./src/js/template"
        tmplDir: "./src/template"
        tmplClass: "../util/Template"
        buildDir: "./_tmplBuild"
    }

    config.jsDir = path.resolve config.jsDir
    config.tmplDir = path.resolve config.tmplDir
    config.buildDir = path.resolve config.buildDir

    (fs.readFileSync config.jsDir).forEach (file) ->
        if (file.indexOf ".js") is -1
            return

        jsContent = fs.readFileSync (path.resolve config.jsDir, file), "utf-8"

        tmplName = getTmplName uglify.parser.parse jsContent

        if tmplName is null
            process.stderr.write "WARNING: Can't find template in #{file}\n"
            return

        tmplContent = fs.readFileSync (path.resolve config.tmplDir, tmplName), "utf-8"

        tmplScript = generateCode tmplContent, config.tmplClass

        outputFilePath = path.resolve config.buildDir, file

        wrench.mkdirSyncRecursive (path.dirname outputFilePath), 0755

        fs.writeFile outputFilePath, tmplScript

generateCode = (content, tmplClass) ->
    return """
        define(function (require) {
            var Template = require("#{tmplClass}");
            return new Template("#{content.replace(/\\/g, "\\\\")
                .replace(/"/g, '\\"')
                .replace(/\n/g, "\\\n")}");
        });
    """

PLACE_HOLDER = "PLACE_HOLDER"

getTmplName = (ast) ->
    tmplName = null

    templateAst = [ "call",
        [ "dot", [ "name", "Template" ], "preload" ]
        [ [ "string", PLACE_HOLDER] ] ]

    module.astWalk ast, (statement, next) ->
        if module.compareAst templateAst, statement, PLACE_HOLDER
            tmplName = statement[2][0][1]
        else
            next()

    return tmplName

exports.convert = template

if not module.parent
    optimist = require "optimist"

    optimist = optimist.options "js-dir", {
        demand: true
    }

    optimist = optimist.options "tmpl-dir", {
        demand: true
    }

    optimist = optimist.options "build-dir", {
        default: "./_tmplBuild"
    }

    optimist = optimist.options "tmpl-class", {
        default: "../util/Template"
    }

    optimist = optimist.options "help", {
        alias: "h"
    }

    argv = optimist.argv

    if argv.help or argv.h
        optimist.showHelp()
        process.exit 0

    template {
        jsDir: argv['js-dir']
        tmplDir: argv['tmpl-dir']
        buildDir: argv['build-dir']
        tmplClass: argv['tmpl-class']
    }
