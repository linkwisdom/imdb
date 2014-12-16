/**
 * @file 初始化IndexedDb
 * @author Liandong Liu (liuliandong01@baidu.com)
 */

define(function (require, exports, module) {
    var imdb = require('./imdb');
    var webSql = require('./webSql');
    var StoreSchema = require('./StoreSchema');
    module.exports = imdb;
});
