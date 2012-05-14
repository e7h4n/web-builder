path = require "path"
jslint = require "jslint"
_ = require "underscore"
fs= require "fs"
module = require "./lib/module"

lint = (config) ->
    _.defaults config, {
        srcDir: "./src"
        module: []
        ignores: []
    }

    config.srcDir = path.resolve config.srcDir

    totalErrorCount = 0

    config.module.forEach (modName) ->
        filename = path.resolve config.srcDir, module.fixFilename modName
        if not path.existsSync filename
            return

        module.moduleWalk modName, config.srcDir, (name, ast) ->
            if config.ignores.length isnt 0
                ignore = config.ignores.some (re) ->
                    re.test name

            if ignore
                return

            filename = path.resolve config.srcDir, module.fixFilename name

            isPassed = jslint fs.readFileSync filename, 'utf-8'

            if not isPassed
                process.stderr.write "#{(filename.replace config.srcDir, '').substr 1} \n"

                lintData = jslint.data()
                totalErrorCount += lintData.errors.length
                lintData.errors.forEach (error, index) ->
                    if not error
                        return

                    process.stderr.write """
                    ##{index + 1} #{error.reason}
                    #{error.evidence} // Line #{error.line}, Position #{error.character}\n
                    """

    if totalErrorCount isnt 0
        process.stderr.write "#{totalErrorCount} error(s) found\n"

    return totalErrorCount is 0

exports.lint = lint
