/**
 * @file 异步链扩展
 *
 * @author Liandong Liu (liuliandong01@baidu.com)
 */

define(function (require, exports) {
    var logger = window.logger || window.console;
    var Chain = require('./Chain');
    var memset = require('./memset');

    /**
     * 打印数据，方便调试接口
     * @param {Object} option 配置参数
     * @return {Chain}
     */
    Chain.prototype.display = function (option) {
        option = option || {};
        this.then(
            function (data) {
                exports.display(data, option);
                return data;
            },
            function (error) {
                logger.error(error);
            }
        );

        // 链式方法不影响数据
        return this;
    };

    /**
     * pipe可以接受一个任务返回继续是promise结果
     * @param  {Function} fullfill 成功处理
     * @param  {Function=} fail 失败处理
     * @return {Chain}
     */
    Chain.prototype.pipe = function (fullfill, fail) {
        var chain = new Chain();
        this.then(
            function (data) {
                var work = fullfill;
                if (typeof fullfill === 'function') {
                    work = fullfill(data);
                }
                if (work && work.then) {
                    return work.then(
                        function (rst) {
                            chain.resolve(rst);
                        },
                        fail
                    );
                }
                chain.resolve(work);
            },
            fail
        );
        return chain;
    };

    /**
     * map 获取回调数据后执行数据的map
     * @param  {Function} mapFunc 转化处理函数
     * @return {Chain}
     */
    Chain.prototype.map = function (mapFunc) {
        return this.pipe(function (data) {
            return [].concat(data).map(mapFunc);
        });
    };

    /**
     * reduce 是根据前后累积方式计算汇总结果
     * @param  {Function} reduceFunc 转化处理函数
     * @return {Chain}
     */
    Chain.prototype.reduce = function (reduceFunc) {
        return this.pipe(function (data) {
            return [].concat(data).reduce(reduceFunc);
        });
    };

    Chain.prototype.filter = function (filterFunc) {
        return this.pipe(function (data) {
            return (data || []).filter(filterFunc);
        });
    };

    /**
     * sum 是根据前后累积方式计算汇总结果
     * @param  {Array} fields 相关处理域
     * @return {Array} 结果
     */
    Chain.prototype.sum = function (fields) {
        return this.pipe(function (data) {
            if (!data.length) {
                return data;
            }
            fields = fields || Object.keys(data[0]);
            var summary = {};
            fields.forEach(function (field) {
                summary[field] = 0;
            });

            var list = [summary].concat(data);

            list.reduce(function (rst, cur, idx) {
                fields.forEach(function (field) {
                    rst[field] += +cur[field] ? +cur[field] : 0;
                });
                return rst;
            });
            return list;
        });
    };

    Chain.prototype.appendTo = function (target) {
        return this.pipe(function (data) {
            Array.prototype.push.apply(target, data);
            return target;
        });
    };

    /**
     * 支持字段切面
     * - grep('planname', 'planid')
     * - grep(['planname'])
     * @param  {Array.<string>|string} fields [description]
     * @return {Array}
     */
    Chain.prototype.grep = function (fields) {
        if (arguments.length > 1) {
            fields = Array.prototype.slice.call(arguments);
        }
        else {
            fields = [].concat(fields);
        }
        return this.map(function (item) {
            return memset.cut(item, fields);
        });
    };

    /**
     * 更新数据
     * @param {Object} modify 替换值
     * @return {Chain}
     */
    Chain.prototype.update = function (modify) {
        return this.map(function (item) {
            return memset.update(item, modify);
        });
    };

    /**
     * 合并列表
     * @param {Array|Object} toJoin 合并对象
     * @param {string=} key 合并key
     * @return {Chain}
     */
    Chain.prototype.join = function (toJoin, key) {
        return this.pipe(function (list) {
            if (toJoin.then) {
                return toJoin.then(function (data) {
                    return memset.join(list, data, key);
                });
            }
            return memset.join(list, toJoin, key);
        });
    };

    /**
     * 请求计时
     * @return {Chain}
     */
    Chain.prototype.time = function () {
        var st = new Date();
        this.then(function (data) {
            var __time = new Date() - st;
            logger.info(__time);
            return __time;
        });
        return this;
    };

    exports.map = function (data, mapFunc) {
        if (!Array.isArray(data)) {
            return data;
        }
        return Chain.resolve(data.map(mapFunc));
    };

    exports.cut = function (data, option) {
        option = option || {};
        if (option.fields) {
            data = memset(data).find({}, option);
        }
        return data;
    };

    exports.display = function (data, option) {
        data = exports.cut(data, option);
        if (typeof data === 'object') {
            if (Array.isArray(data)) {
                logger.table(data);
            }
            else {
                logger.table([].concat(data));
            }
        }
        else {
            logger.info(data);
        }

        return data;
    };
});
