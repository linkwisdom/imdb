/**
 * @file 设计数据库schema
 *
 * @author Liandong Liu (liuliandong01@baidu.com)
 */

define(function (require, exports) {
    var Schema = require('./Schema');
    var idb = require('./imdb');

    function DataBaseSchema(option) {
        Schema.call(this, option);
        for (var key in option) {
            if (option.hasOwnProperty(key)) {
                this[key] = option[key];
            }
        }

        // 改写createStore 方法实现自定义创建数据库
        idb.createStore = this.createStore.bind(this);

        this.state = idb.open({
            name: this.dbName,
            version: this.version
        });
    }

    DataBaseSchema.prototype = Object.create(Schema.prototype);

    /**
     * 为数据库批量创建库
     * - 建议业务中自己实现createStore
     * @param {Object} context 上下文对象
     */
    DataBaseSchema.prototype.createStore = function (context) {
        var stores = context.stores || Object.create(this.stores);
        stores.forEach(function (store) {
            var indecies = store.indecies || [];
            var objectStore = {};

            if (!context.db.objectStoreNames.contains(store.name)) {
                objectStore = context.db.createObjectStore(store.name, {
                    keyPath: store.key,
                    autoIncrement: store.autoIncrement || false
                });
            }
            else {
                objectStore = context.transaction.objectStore(store.name);
            }

            // 创建索引
            indecies.forEach(function (indexer) {
                if (typeof indexer === 'string') {
                    if (!objectStore.indexNames.contains(indexer)) {
                        objectStore.createIndex(indexer, indexer, {unique: false});
                    }
                }
                else if (typeof indexer === 'object') {
                    // 支持组合约束条件
                    objectStore.createIndex(
                        indexer.name, indexer.keys,
                        {unique: indexer.unique || false}
                    );
                }
            });
        });
    };

    DataBaseSchema.prototype.create = function (schema) {
        this.schema = schema;
        this.updateVersion();
    };

    return DataBaseSchema;
});
