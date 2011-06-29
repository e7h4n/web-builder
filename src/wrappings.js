/**
 * 实现 CommonJS 的 wrappings 规范
 *
 * @module wbJS
 * @author zhangyc
 *
 * 定义模块
 * math.js
 * define(function(require, exports, module) {
 *     exports.add = function(a, b){
 *          return a+b;
 *     }
 * });
 *
 * 调用模块
 * init.js
 * define(function(require, exports, module) {
 *     console.log(require('math').add(1,2,));
 * });
 */

(function(window, undefined) {
    if (window.define) {
        return;
    }

    function isFunction(obj) {
        return Object.prototype.toString.call(obj) === '[object Function]';
    }

    var MM = {};
    var initModuleName = null;
    var scripts = document.getElementsByTagName('script');

    for (var i=0, l=scripts.length; i<l && !initModuleName; i++) {
        initModuleName = scripts[i].getAttribute('data-main');
    }

    if (!initModuleName) {
        throw new Error('No data-main attribute in script tag.');
    }

    function require(name) {
        if (!MM[name]) {
            throw new Error('Module '+name+' is not defined.');
        }

        var module = MM[name];

        if (module.inited === false) {
            runModule(name);
        }

        return module.ret;
    }

    function runModule(name) {
        var exports = {};
        var module = MM[name];

        if (isFunction(MM[name].factory)) {
            var ret = MM[name].factory.apply(undefined, [require, exports, undefined]); // Argument 'module' hasn't been implemented yet.
            module.ret = ret === undefined ? exports : ret;
        } else {
            module.ret = MM[name].factory;
        }
        module.inited = true;
    }

    function define(name, deps, factory) {
        if (MM[name]) {
            throw new Error('Module '+name+' has been defined already.');
        }

        if (isFunction(deps)) {
            factory = deps;
        }

        MM[name] = {
            factory: factory,
            inited: false
        };

        if (name === initModuleName) {
            runModule(name);
        }
    }

    window.define = define;
})(window);
