/**
 * @file 初始化IndexedDb
 * @author Liandong Liu (liuliandong01@baidu.com)
 */

define(function (require, exports, module) {
    require('./chain-extension');
    require('./StoreSchema');
    var imdb = require('./imdb');
    window.webSql = require('./webSql');
    module.exports = imdb;
});
