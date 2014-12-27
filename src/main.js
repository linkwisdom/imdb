/**
 * @file 初始化IndexedDb
 * @author Liandong Liu (liuliandong01@baidu.com)
 */

define(function (require, exports, module) {
    var imdb = require('./imdb');
    window.webSql = require('./webSql');
    require('./chain-extension');
    var StoreSchema = require('./StoreSchema');
    module.exports = imdb;
});
