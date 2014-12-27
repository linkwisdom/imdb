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
        this.promise = promise;
    }

    Chain.prototype.then = function (fullfill, fail) {
        return this.promise.then(fullfill, fail);
    };

    Chain.prototype.done = function (fullfill, fail) {
        return this.promise.then(fullfill, fail);
    };

    return Chain;
});
