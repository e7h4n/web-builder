path = require "path"
fs = require "fs"
wrench = require "wrench"
_ = require "underscore"

makedir = (dst) ->
    if not path.existsSync path
        wrench.mkdirSyncRecursive dst, 0o755

textFileExts = [
    ".txt"
    ".php"
    ".js"
    ".coffee"
    ".html"
    ".css"
    ".less"
    ".htm"
    ".config"
]

getInterpolate = (fileName) ->
    extName = (fileName.substr (fileName.lastIndexOf ".")).toLowerCase()

    switch extName
        when ".html", ".htm", ".mustache"
            setting =
                escape: /<!-{1,2}<%-([\s\S]+?)%>-{1,2}>/g
                evaluate: /<!-{1,2}<%([\s\S]+?)%>-{1,2}>/g
                interpolate: /<!-{1,2}<%=([\s\S]+?)%>-{1,2}>/g
        when ".js", ".css", ".less"
            setting =
                escape: /\/[\*-]<%-([\s\S]+?)%>[\*-]\//g
                evaluate: /\/[\*-]<%([\s\S]+?)%>[\*-]\//g
                interpolate: /\/[\*-]<%=([\s\S]+?)%>[\*-]\//g
        else
            setting =
                escape: /<%-([\s\S]+?)%>/g
                evaluate: /<%([\s\S]+?)%>/g
                interpolate: /<%=([\s\S]+?)%>/g

    return setting

filterCopy = (src, dst, exts = textFileExts, templateData = {}) ->
    src = path.resolve src
    dst = path.resolve dst

    makedir dst
    (wrench.readdirSyncRecursive src).forEach (inputFile) ->
        inputFile = path.resolve src, inputFile
        outputFile = inputFile.replace src, dst

        stat = fs.statSync path.resolve src, inputFile
        if stat.isDirectory()
            makedir outputFile
            return

        makedir path.dirname outputFile

        if (exts.indexOf path.extname outputFile) is -1
            content = fs.readFileSync inputFile
            fs.writeFileSync outputFile, content
            return

        content = fs.readFileSync inputFile, "utf-8"

        _.templateSettings = getInterpolate inputFile
        template = _.template content

        fs.writeFileSync outputFile, (template templateData), "utf-8"

exports.copy = filterCopy

if not module.parent
    optimist = require "optimist"

    optimist = optimist.options "src", {
        describe: "Source directory"
        demand: true
    }

    optimist = optimist.options "dst", {
        describe: "Destination directory"
        demand: true
    }

    optimist = optimist.options "help", {
        alias: "h"
        describe: "Show this help"
    }

    argv = optimist.argv

    if argv.h or argv.help
        optimist.showHelp()
        process.exit 0

    filterCopy argv.src, argv.dst
