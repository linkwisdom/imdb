/**
 * @file 设计数据库schema
 *
 * @author Liandong Liu (liuliandong01@baidu.com)
 */

define(function (require, exports) {
    var Schema = require('./Schema');
    var idb = require('./imdb');
    var View = require('./View');
    
    function StoreSchema(option) {
        for (var key in option) {
            if (key == 'config' && this.config) {
                var cf = this.config;
                for (var i in cf) {
                    option.config[i] = option.config[i] || cf[i];
                }
                this.config = option.config;
            } else if (option.hasOwnProperty(key)) {
                this[key] = option[key];
            }
        }

        Schema.call(this, option);
    }

    StoreSchema.prototype = Object.create(Schema.prototype);

    function getConnection(storeName, option) {
        var dbName = option.dbName;
        var chain = idb.open({
            name: dbName,
            version: option.version || exports.version
        });

        return chain.then(
            function (db) {
                return {
                    db: db,
                    storeName: storeName
                };
            }
        );
    }

    StoreSchema.prototype.page = function (selector, params) {
        params = params || {};
        var pageSize = params.pageSize = params.pageSize || params.count || 100;
        var view = new View({
            store: this,
            condition: selector,
            pageSize: pageSize,
            params: params
        });
        return view;
    };
    
    StoreSchema.prototype.query = function (selector, params, callback) {
        selector = selector || {};
        params = params || {};

        // 建立连接
        var promise = idb.pipe();
        var chain = getConnection(
            this.storeName, 
            {
                dbName: this.dbName
            }
        );

        // 查询处理
        var handler = function (context) {
            for (var k in params) {
                if (params.hasOwnProperty(k)) {
                    context[k] = params[k];
                }
            }

            // 如果传入数据是promse，需要多一次请求后再请求
            if ('function'  == typeof selector.then) {
                return selector.then(function (selector) {
                    var state = callback(selector, context);
                    return state.then(function (data) {
                        promise.resolve(data);
                        return data;
                    });
                });
            }

            var state = callback(selector, context);

            // 只有请求数据回来后才算完成
            return state.then(function (data) {
                promise.resolve(data);
                return data;
            });
        };

        // 连接后进行查询
        chain.then(handler);
        return promise;     
    };

    StoreSchema.prototype.find = function (selector, params) {
        return this.query(selector, params, function (selector, context) {
            var state;
            if (typeof selector == 'string'
                || typeof selector == 'number'
                || Array.isArray(selector)) {
                // id 查找
                state = idb.getItem(selector, context);
            } else {
                // 索引查找
                state = idb.find(selector, context)
            }
            return state;
        });
    };

    StoreSchema.prototype.remove = function (selector, params) {
        var handler = function (selector, context) {
            var state;

            if (typeof selector !== 'object') {
                // id 查找
                state = idb.removeItem(selector, context);
            } else if (Array.isArray(selector)) {
                // 如果是id数组；则批量处理id
                selector.forEach(function (item) {
                    state = idb.removeItem(item, context);
                });
            } else {
                // 索引查找
                state = idb.remove(selector, context)
            }

            // 只有请求数据回来后才算完成
            return state.then(function (data) {
                // 通过id删除不返回任何数据
                data = data || selector;
                // remove 存在批量；所以必须异步后关闭数据库
                context.db.close();
                return data;
            });
        };

        return this.query(selector, params, handler);
    };

    StoreSchema.prototype.update = function (selector, params) {
        var handler = function (selector, context) {
            return idb.update(selector, context);
        };
        return this.query(selector, params, handler);
    };

    StoreSchema.prototype.insert = function (data, params) {
        params = params || {};
        
        // fixItem 用于检查每个物料项目的模式是否完成有效
        if (this.fixItem) {
            params.fixItem = this.fixItem.bind(this);
        }

        var handler = function (data, context) {
            return idb.insert(data, context);
        };

        return this.query(data, params, handler);
    };
    
    StoreSchema.prototype.count = function (selector, params) {
        var handler = function (selector, context) {
            var keySize = Object.keys(selector).length;

            // mix 表示混合两种搜索条件; 或者查找条件有多个
            if (params && params.mix 
                || (selector && keySize > 1 ) )  {
                return idb.find(selector, context).then(
                    function (data) {
                        return data.count;
                    }
                );
            }

            // 如果指定了selector, 且部署mix方式；则只基于索引条件查找
            if (keySize > 0) {
                return idb.conditionCount(selector, context)
                    .then(
                        function (data) {
                            return data.count;
                        }
                    ); 
            }

            // 全库统计数量
            return idb.count(context).then(
                function (data) {
                    return data.count;
                }
            );
        };
        return this.query(selector, params, handler);
    };

    return StoreSchema;
});