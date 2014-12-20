define(function (require, exports) {
    var Chain = require('./Chain');
    var memset = require('./memset');

    function mix(target, modify) {
        for (var key in modify) {
            if (modify.hasOwnProperty(key)) {
                target[key] = modify[key];
            }
        }
    }

    /**
     * 打印数据，方便调试接口
     */
    Chain.prototype.display = function (option) {
        option = option || {};
        var promise = this.then(
            function (data) {
                console.log(data.info);
                exports.display(data, option);
                return data;
            },
            function (error) {
                console.error(error);
            }
        );

        // 链式方法不影响数据
        return this;
    };

    Chain.prototype.map = function (mapFunc) {
        var chain = new Chain();

        this.then(
            function (data) {
                chain.resolve(data.map(mapFunc));
            },
            function (error) {
                console.error(error);
            }
        );

        // 链式方法不影响数据
        return chain;
    };

    // todo 更新复杂的更新查找
    Chain.prototype.update = function (modify) {
        modify = modify || {};
        var promise = this.then(function (data) {
            var rst = [].concat(data);
            rst.forEach(function (item) {
                mix(item, modify);
            });
            return data;
        });
        return this;
    };

    /**
     * 计算请求延迟时间
     */
    Chain.prototype.time = function (defer) {
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