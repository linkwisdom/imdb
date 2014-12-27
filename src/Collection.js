/**
 * @file 数据集合对象
 *
 * @author Liandong Liu (liuliandong01@baidu.com)
 */

define(function (require, exports, module) {
    var idb = require('./imdb');

    function getConnection(level, option) {
        var userid = option.userid || exports.userid;

        var dbName = userid + '_db' ;
        var chain = idb.open({
            name: dbName,
            version: option.version || exports.version
        });

        return chain.then(
            function (db) {
                return {
                    db: db,
                    storeName: level
                };
            }
        );
    }
    
    function getFinder(level, userid) {
        return function (selector, params) {
            selector = selector || {};

            params = params || {};

            var promise = idb.pipe();
            var chain = getConnection(
                params.level || level, 
                {
                    userid: params.userid || userid
                }
            );

            chain.then(function (context) {
                for (var k in params) {
                    context[k] = params[k];
                }

                var state;
                if (typeof selector == 'string'
                    || typeof selector == 'number'
                    || Array.isArray(selector) ) {
                    // id 查找
                    state = idb.getItem(selector, context);
                } else {

                    // 如果查询条件没有指定__tag条件；默认只显示未删除的数据
//                     if (selector.__tag == undefined) {
//                         // __tag = null; __tag = undefined
//                         selector.__tag = { $gte: 0 };
//                     }

                    // 索引查找
                    state = idb.find(selector, context)
                }
                
                // 只有请求数据回来后才算完成
                state.then(function (data) {
                    promise.resolve(data);
                    return data;
                });

                return state;
            });

            return promise;
        };
    }

    function getRemover(level, userid) {
        return function (selector, params) {
            params = params || {};
            var promise = idb.pipe(chain);
            var chain = getConnection(
                params.level || level, 
                {
                    userid: params.userid || userid
                }
            );

            chain.then(function (context) {
                for (var k in params) {
                    context[k] = params[k];
                }

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
                state.then(function (data) {
                    // 通过id删除不返回任何数据
                    data = data || selector;
                    promise.resolve(data);

                    // remove 存在批量；所以必须异步后关闭数据库
                    context.db.close();
                    return data;
                });

                return state;
            });

            log('remove', promise, selector);

            return promise;
        };
    }

    function getUpdater(level, userid) {
        return function (selector, params) {
            var promise = idb.pipe(chain);
            var chain = getConnection(level, { userid: userid })
            chain.then(function (context) {
                for (var k in params) {
                    context[k] = params[k];
                }

                return idb.update(selector, context)
                    .then(function (data) {
                        promise.resolve(data);
                        return data;
                    });
            });

            return promise;
        };
    }

    function getInserter(level, userid) {

        return function (data, params) {
            var chain = getConnection(level, { userid: userid });
            var promise = idb.pipe(chain);

            chain.then(function (context) {
                for (var k in params) {
                    context[k] = params[k];
                }

                return idb.insert(data, context).then(
                    function (data) {
                        promise.resolve(data);
                    }
                );
            });
            return promise;
        };
    }

    function getIniter(level, userid) {
        return function (selector, data) {
            data = data || selector;
            var chain = getConnection(level, { userid: userid });
            chain.then(function (context) {
                // 如果data是数组则任务是插入操作
                if (Array.isArray(data)) {
                    return idb.insert(context, data);
                } else {
                    return idb.update(context, selector, data);
                }
            });
            return chain;
        };
    }

    function getCounter(level, userid) {
        return function (selector, params) {
            var chain = getConnection(level, { userid: userid });
            var deferred = idb.pipe(chain);
            chain.then(function (context) {
                for (var k in params) {
                    context[k] = params[k];
                }

                // mix 表示混合两种搜索条件; 或者查找条件有多个
                if (params && params.mix 
                    || (selector && Object.keys(selector).length > 1 ) )  {
                    return idb.find(selector, context).then(
                        function (data) {
                            deferred.resolve(data.length);
                            return data.count;
                        }
                    );
                }

                // 如果指定了selector, 且部署mix方式；则只基于索引条件查找
                if (selector) {
                    return idb.conditionCount(selector, context)
                        .then(
                            function (data) {
                                deferred.resolve(data.count);
                                return data.count;
                            }
                        ); 
                }

                // 全库统计数量
                return idb.count(context).then(
                    function (data) {
                        deferred.resolve(data.count);
                        return data.count;
                    }
                );
            });
            return deferred;
        };
    }

    function Collectoin (level, userid) {
        this.level = level;
        this.userid = userid;
    };
    
    Collectoin.prototype.__defineGetter__('find', function () {
        return getFinder(this.level, this.userid);
    });

    Collectoin.prototype.__defineGetter__('insert', function () {
        return getInserter(this.level, this.userid);
    });

    Collectoin.prototype.__defineGetter__('remove', function () {
        return getRemover(this.level, this.userid);
    });

    Collectoin.prototype.__defineGetter__('update', function () {
        return getUpdater(this.level, this.userid);
    });

    Collectoin.prototype.__defineGetter__('count', function () {
        return getCounter(this.level, this.userid);
    });

    Collectoin.prototype.__defineGetter__('init', function () {
        return getIniter(this.level, this.userid);
    });

    module.exports = Collectoin;
});