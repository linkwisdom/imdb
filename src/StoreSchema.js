/**
 * @file 设计数据库schema
 *
 * @author Liandong Liu (liuliandong01@baidu.com)
 */

define(function (require, exports) {
    var Chain = require('./Chain');
    var Schema = require('./Schema');
    var idb = require('./imdb');
    var View = require('./View');
    var memset = require('./memset');

    /**
     * 数据库模型定义
     * @constructor
     * @param {Object} option 配置参数
     */
    function StoreSchema(option) {
        for (var key in option) {
            if (key === 'config' && this.config) {
                var cf = this.config;
                for (var i in cf) {
                    if (cf.hasOwnProperty(i)) {
                        option.config[i] = option.config[i] || cf[i];
                    }
                }
                this.config = option.config;
            }
            else if (option.hasOwnProperty(key)) {
                this[key] = option[key];
            }
        }

        Schema.call(this, option);
    }

    /**
     * 继承模式原型
     * @type {Object}
     */
    StoreSchema.prototype = Object.create(Schema.prototype);

    /**
     * 获取数据库连接
     * @param  {string} storeName 默认连接的数据表名称
     * @param  {Object=} option 可选参数
     * @return {Promise}
     */
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

    /**
     * 数据集缓存翻页
     * @param  {Object} selector 查询条件
     * @param  {Object=} params 可选参数
     * @return {Promise}
     */
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

    /**
     * 获取数据库请求链接
     * @param  {Object} selector 查询条件
     * @param  {Object=} params 可选参数
     * @param  {Function=} callback 请求回调函数
     * @return {Promise}
     */
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

            // 如果传入数据是promise，需要多一次请求后再请求
            if ('function'  === typeof selector.then) {
                return selector.then(function (selector) {
                    var state = callback(selector, context);
                    return state.then(function (data) {
                        // 哪里开的db连接,哪里负责关.以防止 update调用find的时候,find结束就关闭连接的问题.
                        context.db.close();
                        promise.resolve(data);
                        return data;
                    });
                });
            }

            try {
                 var state = callback(selector, context);
            } catch (ex) {
                return Chain.reject({
                    error: ex,
                    data: selector
                });
            }
            // 只有请求数据回来后才算完成
            return state.then(function (data) {
                // 哪里开的db连接,哪里负责关.以防止 update调用find的时候,find结束就关闭连接的问题.
                context.db.close();
                promise.resolve(data);
                return data;
            });
        };

        // 连接后进行查询
        chain.then(handler);
        return promise;
    };

    /**
     * 查找符合条件的数据集
     * @param  {Object} selector 查询条件
     * @param  {Object=} params 可选参数
     * @return {Promise}
     */
    StoreSchema.prototype.find = function (selector, params) {
        return this.query(selector, params, function (selector, context) {
            var state;
            var tp = typeof selector;
            if (tp === 'string'
                || tp === 'number'
                || Array.isArray(selector)) {
                // id 查找
                state = idb.getItem(selector, context);
            }
            else {
                // 索引查找
                state = idb.find(selector, context);
            }
            if (context.filter && typeof context.filter === 'object') {
                context.filter = memset.parseFilter(context.filter);
            }
            return state;
        });
    };

    /**
     * 查看是否包含特定条件的数据
     * @param  {Object} selector 查询条件
     * @param  {Object=} params 可选参数
     * @return {Promise}
     */
    StoreSchema.prototype.contains = function (selector, params) {
        return this.query(selector, params, function (selector, context) {
            return idb.contains(selector, context);
        });
    };

    /**
     * 清除数据库
     * @param {Array} stores 待删除表
     * @return {Promise}
     */
    StoreSchema.prototype.clear = function (stores) {
        return this.query({}, {stores: stores}, function (option, context) {
            return idb.clear(context);
        });
    };

    /**
     * 删除数据集
     * @param  {Object} selector 查询条件
     * @param  {Object=} params 可选参数
     * @return {Promise}
     */
    StoreSchema.prototype.remove = function (selector, params) {
        var handler = function (selector, context) {
            var state;

            if (typeof selector !== 'object') {
                // id 查找
                state = idb.removeItem(selector, context);
            }
            else if (Array.isArray(selector)) {
                // 如果是id数组；则批量处理id
                selector.forEach(function (item) {
                    state = idb.removeItem(item, context);
                });
            }
            else {
                // 索引查找
                state = idb.remove(selector, context);
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

    /**
     * 更新数据集
     * @param  {Object} selector 查询条件
     * @param  {Object=} params 可选参数
     * @param  {boolean=} wild 是否params为更新条件
     * @return {Promise}
     */
    StoreSchema.prototype.update = function (selector, params, option) {
        if (option && params) {
            option.$set = params;
            params = option;
        }
        var handler = function (selector, context) {
            return idb.update(selector, context);
        };
        return this.query(selector, params, handler);
    };

    /**
     * 插入数据集
     * @param  {Object} data 查询条件
     * @param  {Object=} params 可选参数
     * @return {Promise}
     */
    StoreSchema.prototype.insert = function (data, params) {
        params = params || {};

        // 插入前校验数据是否合法
        if (this.validate) {
            var info = this.validate(data);
            if (info !== true) {
                return Chain.reject(info);
            }
        }

        // fixItem 用于检查每个物料项目的模式是否完成有效
        if (this.fixItem && !params.upsert) {
            params.fixItem = this.fixItem.bind(this);
        }

        var handler = function (data, context) {
            return idb.insert(data, context);
        };

        return this.query(data, params, handler);
    };

    /**
     * 查看数据集数量
     * @param  {Object} selector 查询条件
     * @param  {Object=} params 可选参数
     * @return {Promise}
     */
    StoreSchema.prototype.count = function (selector, params) {
        var handler = function (selector, context) {
            var keySize = Object.keys(selector).length;

            // mix 表示混合两种搜索条件; 或者查找条件有多个
            if (params && params.mix
                || (selector && keySize > 1))  {
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
