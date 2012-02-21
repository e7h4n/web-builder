fs = require "fs"
path = require "path"

###
递归地创建一个目录

@method mkdirSilent
@param {String}dir
###

mkdirSilent = (dir) ->
    if dir isnt "/" and not path.existsSync path.dirname dir
        mkdirSilent path.dirname dir

    if not path.existsSync dir
        fs.mkdirSync dir, "0755"

exports.mkdirSilent = mkdirSilent
