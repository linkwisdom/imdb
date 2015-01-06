/**
 * @file 设计数据库schema
 *
 * @author Liandong Liu (liuliandong01@baidu.com)
 */

define(function (require, exports) {
    function Schema() {

    }

    // 验证单条数据
    Schema.prototype.validate = function () {
        return true;
    };

    return Schema;
});
