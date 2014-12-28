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
                var work = fullfill(data);
                if (work.then) {
                    return work.then(function (rst) {
                        chain.resolve(rst);
                    });
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

    Chain.prototype.grep = function (fields) {
        return this.map(function (item) {
            return memset.cut(item, fields);
        });
    }

    /**
     * 更新数据
     * @param {Object} modify 替换值
     * @return {Chain}
     */
    Chain.prototype.update = function (modify) {
        return this.map(function (item) {
            return memset.mix(item, modify);
        });
    };

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

        return data.map(mapFunc);
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
