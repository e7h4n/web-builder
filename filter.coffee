path = require "path"
fs = require "fs"
wrench = require "wrench"

makedir = (dst) ->
    if not path.existsSync path
        wrench.mkdirSyncRecursive dst, 0o755

DELETE_START = "@DELETE_START@"
DELETE_END = "@DELETE_END@"
DELETE_LINE = "@DELETE_LINE@"

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

filterCopy = (src, dst, exts = textFileExts) ->
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
        fp = fs.openSync outputFile, "w+"

        ignoreFlag = false

        (content.split "\n").forEach (line) ->
            ignoreLine = false

            if (line.indexOf DELETE_START) isnt -1
                ignoreFlag = true
                ignoreLine = true
            else if (line.indexOf DELETE_END) isnt -1
                ignoreFlag = false
                ignoreLine = true
            else if (line.indexOf DELETE_LINE) isnt -1
                ignoreLine = true

            if not ignoreFlag and not ignoreLine
                fs.writeSync fp, line + "\n"

        fs.closeSync fp

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
