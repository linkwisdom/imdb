define(function (require, exports) {
    var Deferred = window.Deferred || require('er/Deferred');
    var format = require('./format');
    var memset = require('./memset');

    /**
     * 打印数据，方便调试接口
     * @param {Object} option
     */
    Deferred.prototype.display = function (option) {
        option = option || {};
        var promise = this.then(function (data) {
            exports.display(data, option);

            return data;
        });

        // 链式方法不影响数据
        return this;
    };

    /**
     * 计算请求延迟时间
     */
    Deferred.prototype.time = function (defer) {
        var st = new Date();
        var promise = this.then(function (data) {
            var __time = new Date() - st;
            console.log(__time);

            // 为了兼容
            if (typeof data == 'number') {
                data = new Number(data);
            }

            data.__time = __time;
            return data;
        });

        // 为了方便调用.time返回的是响应
        
        return defer ? this : promise;
    };

    /**
     * 测试环境使用
     * - 线上应该删除
     */
    Deferred.prototype.save = function (fileName) {
        var promise = this.then(function (data) {
            if (!fileName && data.length) {
                fileName = (data[0].planid || 'material') + '.txt';
            }

            var content = format.array2csv(data);
            fs.writeFile(fileName, content);
            console.log('view file: [ filesystem:http://%s/temporary/%s ]', location.host, fileName);
            return data;
        });

        return this;
    };

    function bind(fun, def) {
        var promise = def;

        return function (option) {
            def.promise = (def.promise || def).then(
                function (data) {
                    return exports[fun].call(promise, data, option);
                }
            );
            return def;
        };
    }

    // 创建一个可链式操作的数据链
    Deferred.prototype.chain = function () {
        var def = this;

        for (var fun in exports) {
            def[fun] = bind(fun, def);
        }

        // todo 在这里扩展chain的功能
        return def;
    };

    exports.count = function (data) {
        return Array.isArray(data) ? data.length : 1;
    };

    exports.map = function (data, mapFunc) {
        if (!Array.isArray(data)) {
            return data;
        }

        return data.map(mapFunc);
    };
    
    exports.cut = function (data, option) {
        option = option || {};
        if (option.fields) {
            // 不建议切字段
            data = memset(data).find({}, option);
        }
        return data;
    };

    exports.display = function (data, option) {
        data = exports.cut(data, option);

        if (!console.table) {
            // firefox 版本可能不支持
            console.log(data);
            return;
        }

        if ( typeof data == 'object' ) {
            if (Array.isArray(data)) {
                console.table(data);
            } else {
                console.table([].concat(data));
            }
        } else {
            console.info(data);
        }

        return data;
    };

});