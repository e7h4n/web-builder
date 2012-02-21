path = require "path"
_ = require "underscore"
uglifyjs = require "uglify-js"
cssmin = require "cssmin"
fs = require "fs"

getFileType = (filename) ->
    if (filename.indexOf ".js") isnt -1
        "js"
    else if (filename.indexOf ".css") isnt -1
        "css"
    else if (filename.indexOf ".coffee") isnt -1
        "coffee"
    else
        null

fixFilename = (filename) ->
    if (getFileType filename) is null
        "#{filename}.js"
    else
        filename

getModContent = (modName, srcDir) ->
    fs.readFileSync (path.resolve srcDir, (fixFilename modName)), "utf-8"

compareAst = (template, array, PLACE_HOLDER) ->
    if (_.isArray template) and (_.isArray array)
        if template.length isnt array.length
            return false

        for statement, index in template
            isEqual = compareAst statement, array[index], PLACE_HOLDER

            if not isEqual
                return false

        return true

    if template is PLACE_HOLDER and array isnt undefined
        return true

    if template is array
        return true

    return false

astWalk = (ast, callback) ->
    if not _.isArray ast
        return

    for statement in ast
        callback statement, () ->
            astWalk statement, callback

moduleWalk = (modName, rootPath, process, trace = []) ->
    deps = []

    filename = fixFilename modName
    fileType = getFileType filename

    content = fs.readFileSync (path.resolve rootPath, filename), "utf-8"

    if fileType is "js"
        ast = uglifyjs.parser.parse content
        ast = normlizePath ast, (path.resolve rootPath, filename, ".."), rootPath
        deps = getJSDependencies ast
    else if fileType is "css"
        deps = getCSSDependencies content, modName

    process modName, ast

    deps.map (modName) ->
        if (trace.indexOf modName) is -1
            trace.push (modName)
            moduleWalk modName, rootPath, process, trace

getCSSDependencies = (code, modName) ->
    deps = []
    regexp = /@import\s+url\(["'](.+?\.css)["']\)/ig

    while match = regexp.exec code
        deps.push path.join (path.dirname modName), match[1]

    return deps

PLACE_HOLDER = "PLACE_HOLDER"

getJSDependencies = (ast) ->
    deps = []

    templateAst = [ 'call', [ 'name', 'require' ], [ [ 'string', PLACE_HOLDER ] ] ]

    astWalk ast, (statement, next) ->
        if compareAst templateAst, statement, PLACE_HOLDER
            deps.push statement[2][0][1]

        next()

    return deps

generateCode = (code, name, compress) ->
    if (getFileType name) is ".css"
        generateCSSCode code, name, compress
    else
        generateJSCode code, name, compress

generateCSSCode = (code, name, compress) ->
    regexp = /@import\s+url\(["'](.+?\.css)["']\);?/ig
    code = code.replace regexp, ''

    if compress
        code = cssmin.cssmin code

    return code

generateJSCode = (ast, modName, compress) ->
    if modName
        templateAst = ["stat", ["call", ["name", "define"], PLACE_HOLDER]]

        astWalk ast, (statement, next) ->
            if compareAst templateAst, statement, PLACE_HOLDER
                statement[1][2].unshift ["string", modName]
            else
                next()

    if compress
        ast = uglifyjs.uglify.ast_mangle ast
        ast = uglifyjs.uglify.ast_squeeze ast

    return (uglifyjs.uglify.gen_code ast, {
        beautify: !compress
        indent_level: 4
    }) + ';'

normlizePath = (ast, relativePath, rootPath) ->
    templateAst = ["call",
        ["name", "require"],
        [["string", PLACE_HOLDER]]]

    astWalk ast, (statement, next) ->
        if compareAst templateAst, statement, PLACE_HOLDER
            modName = statement[2][0][1]

            if (modName.indexOf ".") is 0
                modName = ((path.resolve relativePath, modName).replace rootPath, "").substr 1
                statement[2][0][1] = modName

        next()


    return ast

exports.generateCode = generateCode;
exports.moduleWalk = moduleWalk;
exports.getFileType = getFileType
exports.fixFilename = fixFilename
exports.getModContent = getModContent
exports.astWalk = astWalk
exports.compareAst = compareAst
