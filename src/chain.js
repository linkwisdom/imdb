/**
 * @file Promise 扩展支持then与done
 * 支持异步resolve, 支持链式扩展
 *
 * @author Liandong Liu (liuliandong01@baidu.com)
 */

define(function (require, exports) {
    var Promise = window.Promise;

    function Chain() {
        var chain = this;
        var promise = new Promise(function (resolve, reject) {
            chain.resolve = resolve.bind(chain);
            chain.reject = reject.bind(chain);
        });
        // 如果业务层有自定义的异常处理函数
        if (typeof chain.handleError === 'function') {
            promise.catch(function (ex) {
                chain.handleError(ex);
            });
        }
        this.promise = promise;
    }

    Chain.prototype.then = function (fullfill, fail) {
        return this.promise.then(fullfill, fail);
    };

    Chain.prototype.done = function (fullfill, fail) {
        return this.promise.then(fullfill, fail);
    };

    Chain.prototype.ensure = function (fullfill) {
        return this.promise.then(fullfill, fullfill);
    };

    Chain.prototype.catch = function (callback) {
        return this.promise.catch(callback);
    };

    Chain.resolve = function (data) {
        var chain = new Chain();
        chain.resolve(data);
        return chain;
    };

    Chain.reject = function (data) {
        return Promise.reject(data);
    };

    return Chain;
});
