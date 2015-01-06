/**
 * @file 设计数据库schema
 *
 * @author Liandong Liu (liuliandong01@baidu.com)
 */

define(function (require, exports) {
    var Schema = require('./Schema');
    var idb = require('./imdb');

    function DataBaseSchema(dbConf, option) {
        Schema.call(this, dbConf);
        for (var key in dbConf) {
            if (dbConf.hasOwnProperty(key)) {
                this[key] = dbConf[key];
            }
        }

        // 改写createStore 方法实现自定义创建数据库
        idb.createStore = this.createStore.bind(this);
        // 不提前创建
        if (option && option.delay) {
            return;
        }
        // 直接访问，检查版本是否更新
        this.init();
    }

    DataBaseSchema.prototype = Object.create(Schema.prototype);

    DataBaseSchema.prototype.init = function (option) {
        var database = this;
        if (this.state) {
            return this.state;
        }

        if (option && option.clear && this.clear) {
            return this.init().then(function () {
                return database.clear();
            });
        }

        this.state = idb.open({
            name: this.dbName,
            version: this.version
        });
        return this.state;
    };

    /**
     * 为数据库批量创建库
     * - 建议业务中自己实现createStore
     * @param {Object} context 上下文对象
     */
    DataBaseSchema.prototype.createStore = function (context) {
        var schema = this.schema;
        var stores = Object.keys(schema);
        stores.forEach(function (storeName) {
            var store = schema[storeName];
            var indecies = Object.keys(store.indecies || {});
            var objectStore = {};

            if (!context.db.objectStoreNames.contains(storeName)) {
                var primaryKey = store.primaryKey;
                objectStore = context.db.createObjectStore(storeName, {
                    keyPath: primaryKey.name,
                    autoIncrement: primaryKey.autoIncrement || false
                });
            }
            else {
                objectStore = context.transaction.objectStore(storeName);
            }

            // 创建索引
            indecies.forEach(function (index) {
                var indexer = store.indecies[index];
                if (typeof indexer === 'string') {
                    if (!objectStore.indexNames.contains(indexer)) {
                        objectStore.createIndex(indexer, indexer, {unique: false});
                    }
                }
                else if (
                    typeof indexer === 'object'
                    && !objectStore.indexNames.contains(indexer.name)
                ) {
                    // 支持组合约束条件
                    objectStore.createIndex(
                        indexer.name, indexer.keys || indexer.name,
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
