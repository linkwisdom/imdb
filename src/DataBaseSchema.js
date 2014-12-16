/**
 * @file 设计数据库schema
 *
 * @author Liandong Liu (liuliandong01@baidu.com)
 */

define(function (require, exports) {
    var Schema = require('./Schema');
    var idb = require('./imdb');

    function DataBaseSchema(option) {
        this.storeName = option.storeName;
        this.dbName = option.dbName;
        Schema.call(this, option);

        // 改写createStore 方法实现自定义创建数据库
        idb.createStore = this.createStore;
    }

    /**
     * 为数据库批量创建库
     * - 建议业务中自己实现createStore
     */
    exports.createStore = function (context) {
        var stores = context.stores || Object.create(dbConf.stores);

        stores.forEach(function (store) {
            var indecies = store.indecies || [];
            
            if (context.db.objectStoreNames.contains(store.name)) {
                return; // 已经存在的库
            }

            var objectStore = context.db.createObjectStore(store.name, {
                keyPath: store.key,
                autoIncrement: store.autoIncrement || false
            });

            // 创建索引
            indecies.forEach(function (indexer) {
                if (typeof indexer == 'string') {
                    if (!objectStore.indexNames.contains(indexer)) {
                        objectStore.createIndex(indexer, indexer, { unique: false });
                    }
                } else if (typeof indexer == 'object') {
                    // 支持组合约束条件
                    objectStore.createIndex(
                        indexer.name, indexer.keys,
                        { unique: indexer.unique || false }
                    );
                }
            });
        });
    };

    DataBaseSchema.prototype = Object.create(Schema.prototype);

    DataBaseSchema.prototype.create = function (schema) {
        this.schema = schema;
        this.updateVersion();
    };

    DataBaseSchema.prototype.updateVersion = function () {

    };
});
