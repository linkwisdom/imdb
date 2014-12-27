/**
 * @file 初始化IndexedDb
 *
 * @author Liandong Liu (liuliandong01@baidu.com)
 */

define(function (require, exports, module) {
    var IDBKeyRange = window.IDBKeyRange;
    var logger = window.logger || window.console;
    var Chain = require('./Chain');
    var memset = require('./memset');
    /**
     * 事务模型
     */
    var TransactionModes = {
        READ_ONLY: 'readonly',
        READ_WRITE: 'readwrite',
        VERSION_CHANGE: 'versionchange'
    };
    /**
     * 修改状态
     */
    var TAG_STATE = {
        REMOVE: -1,
        SILENT: 0,
        UPDATE: 1,
        ADD: 2
    };
    /**
     * 获取索引查找条件
     * @param {Object} condition 查询条件
     * @return {IDBKeyRange} range条件
     */
    function getRange(condition) {
        var tp = typeof condition;
        if (tp !== 'object' || Array.isArray(condition)) {
            if (condition === '$index') {
                // 基于改字段索引查找, 暂定定义为0
                return IDBKeyRange.lowerBound(0);
            }
            return IDBKeyRange.only(condition);
        }
        if (condition.$gt !== undefined) {
            return IDBKeyRange.lowerBound(condition.$gt, true);
        }
        else if (condition.$gte !== undefined) {
            return IDBKeyRange.lowerBound(condition.$gte);
        }
        else if (condition.$lt !== undefined) {
            return IDBKeyRange.upperBound(condition.$lt, true);
        }
        else if (condition.$lte !== undefined) {
            return IDBKeyRange.upperBound(condition.$lte);
        }
        else if (condition.$eq !== undefined) {
            return IDBKeyRange.only(condition.$eq);
        }
        else if (condition.$between !== undefined) {
            var range = condition.$between;
            return IDBKeyRange.bound(range[0], range[1]);
        }
        return false;
    }
    /**
     * 包装请求对象为Deferred对象
     *
     * @param {IDBRequest} request idb请求对象
     * @param {Object=} context 请求上下文
     * @param {Function=} callback 请求回调处理
     * @return {Chain}
     */
    exports.request = function (request, context, callback) {
        context = context || {};
        var deferred = new Chain();
        // 如果请求对象创建失败
        if (!request) {
            setTimeout(function () {
                deferred.reject({message: 'request fail'});
            }, 30);
            return deferred;
        }
        request.onsuccess = function (e) {
            var data = e.target.result;
            if ('function' === typeof callback) {
                data = callback(data);
            }
            deferred.resolve(data);
        };
        request.onerror = function (e) {
            deferred.reject(e.target);
        };
        request.onupgradeneeded = function (e) {
            var db = e.target.result;
            var dbName = db.name;
            var databases = (
                localStorage.getItem('idb-databases') || '').split(';');
            if (databases.indexOf(dbName) === -1) {
                databases.push(dbName);
                if (databases[0] === '') {
                    databases.shift();
                }
                localStorage.setItem('idb-databases', databases.join(';'));
            }
            exports.createStore({db: db, transaction: e.target.transaction});
            deferred.resolve(db);
        };
        return deferred;
    };
    exports.pipe = function (chain) {
        return new Chain();
    };

    /**
     * 打开数据库
     * @param  {Object} context 上下文
     * @return {Chain}
     */
    exports.open = function (context) {
        var request = null;
        // 如果dbConf有变更，则时数据结构的变化
        if (context.version) {
            request = window.indexedDB.open(
                context.name,
                context.version
            );
        }
        else {
            request = window.indexedDB.open(
                context.name
            );
        }
        return exports.request(request);
    };
    /**
     * 请求查询所有数据库列表
     * - 只有chrome支持查看数据库列表
     * - firefox 通过localstorage存储
     * @param {Object} context 上下文
     * @return {Chain}
     */
    exports.showDatabases = function (context) {
        if (indexedDB.webkitGetDatabaseNames) {
            var request = indexedDB.webkitGetDatabaseNames();
            return exports.request(request, context, function (data) {
                return Array.prototype.slice.call(data, 0);
            });
        }
        return new Chain(function (resolve, reject) {
            var databases = localStorage.getItem('idb-databases') || '';
            databases = databases.split(';');
            resolve(databases);
        });
    };
    exports.deleteDatabase = function (dbName, context) {
        var request = indexedDB.deleteDatabase(dbName);
        return exports.request(request, context);
    };
    /**
     * 为数据库批量创建库
     * - 建议业务中自己实现createStore
     * @param {Object} context 上下文
     */
    exports.createStore = function (context) {
        var stores = context.stores;
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
    /**
     * 通过主键id获取元素
     * - 支持主键索引获取所有物料
     * @param {Array.<number>} primaryIds ids
     * @param {Object} context 上下文
     * @return {Chain}
     */
    exports.getItem = function (primaryIds, context) {
        var chain = new Chain();
        var storeName = context.storeName;
        var db = context.db;
        var result = [];
        var ids = [].concat(primaryIds);
        var pushResult = function (e) {
            result.push(e.target.result);
            if (result.length === ids.length) {
                chain.resolve(result);
            }
        };
        if (db.objectStoreNames.contains(storeName)) {
            var transaction = db.transaction(storeName, TransactionModes.READ_ONLY);
            var store = transaction.objectStore(storeName);
            ids.forEach(function (id) {
                store.get(id).onsuccess = pushResult;
            });
        }
        return chain;
    };

    /**
     * 更新记录
     * - 通过查询条件更新元素
     *
     * context.value 表示要更新的值
     * @param {Object} selector 查询条件
     * @param {Object} context 更新信息
     * @param {Object} option 配置项
     * @return {Chain}
     */
    exports.update = function (selector, context, option) {
        var deferred = new Chain();
        // 支持mongodb $set, $inc指令已经自定义的复制函数$let
        var data = context.$set || context.value;
        var inc = context.$inc;
        var assign = context.$let;
        // upsert 表示如果数据不存在则插入数据（data）
        if (option && option.upsert) {
            context.upsert = true;
        }
        // 需要有目标数据
        var upsert = data && context.upsert || false;
        var count = 0;
        // 打开find的write模式
        context.writeMode = true;
        if (typeof selector === 'object' && !Array.isArray(selector)) {
             // 如果是Object类型，先查询后删除
            var result = [];
            exports.find(
                selector, context,
                function (cursor) {
                    // 查询条件改为find代理
                    if (cursor && cursor.value) {
                        var value = cursor.value;
                        var oldValue = Object.create(value);
                        if (data) {
                            for (var key in data) {
                                if (data.hasOwnProperty(key)) {
                                    cursor.value[key] = data[key];
                                }
                            }
                        }
                        if (inc) {
                            for (var k in inc) {
                                if (inc.hasOwnProperty(k)) {
                                    cursor.value[k] += inc[k];
                                }
                            }
                        }
                        if (assign) {
                            var assigned = assign(cursor.value);
                            // 如果有返回值，则需要重写
                            // 建议函数内对象直接修改
                            if (value) {
                                cursor.value = assigned;
                            }
                        }
                        // 只存储最原始的数值
                        if (!value.__oldValue) {
                            value.__oldValue = oldValue;
                        }
                        result.push(value);
                        cursor.update(cursor.value);
                        count++;
                        if (context.count === undefined
                            || count < context.count) {
                            // 代理查找不需要再迭代了
                            // cursor.continue();
                            return;
                        }
                    }
                    if (upsert && result.length === 0) {
                        // 自动填充一些字段
                        var newItem = context.patch;
                        for (var kay in data) {
                            if (data.hasOwnProperty(kay)) {
                                newItem[kay] = data[kay];
                            }
                        }
                        // 插入新数据
                        exports.insert(newItem, context).then(
                            function () {
                                deferred.resolve([newItem]);
                            }
                        );
                    }
                    else {
                        deferred.resolve(result);
                    }
                }
            );
            return deferred;
        }
    };
    /**
     * 删除记录
     * - 通过查询条件删除元素
     * - 不建议本地记录删除；删除策略改为标识移除
     * @param  {Object}   selector 选择条件
     * @param  {Object}   context 上下文
     * @return {Chain}
     */
    exports.remove = function (selector, context) {
        var deferred = new Chain();
        // context 必须是可写状态
        context.writeMode = true;
        // 如果是单值类型；转为数组处理方法
        if (typeof selector === 'number' || typeof selector === 'string') {
            selector = [selector];
        }
        else if (!Array.isArray(selector)) {
             // 如果是Object类型，先查询后删除
            var result = [];
            exports.find(
                selector, context,
                function (cursor) {
                    if (cursor && cursor.value) {
                        result.push(cursor.value);
                        // 软删除
                        if (context.force === false) {
                            cursor.value.__tag = TAG_STATE.REMOVE;
                            cursor.update(cursor.value);
                        }
                        else {
                        // 硬删除
                            cursor.delete();
                        }
                    }
                    else {
                        deferred.resolve(result);
                    }
                }
            );
            return deferred;
        }
        return exports.removeItem(selector, context);
    };

    /**
     * 通过主键删除记录
     * - 通过主键id删除元素
     * @param {Array.<number>} primaryIds ids
     * @param {Object} context 上下文
     * @return {Chain}
     */
    exports.removeItem = function (primaryIds, context) {
        var list = [].concat(primaryIds);
        var request = null;

        /**
         * selector 如果是数组；数组内容可以是keyPath数组；
         * 只能是基于keyPath的删除
         */
        var storeName = context.storeName;
        var db = context.db;
        if (db.objectStoreNames.contains(storeName)) {
            var transaction = db.transaction(storeName, TransactionModes.READ_WRITE);
            var store = transaction.objectStore(storeName);
            list.forEach(function (item) {
                var primaryId = item;
                if (typeof item === 'object' && item[store.keyPath]) {
                    primaryId = item[store.keyPath];
                }
                request = store.delete(primaryId);
            });
        }
        // 只用最后一次请求
        return exports.request(request, context);
    };

    /**
     * 插入数据
     * - 回调的数据只剩最后一次切片的数据
     * - 如果插入数据需要再次使用，需要指定isCopy
     * - 支持单条或多条数据插入
     * @param {Array} sets 插入集合
     * @param {Object} context 上下文
     * @return {Chain}
     */
    exports.insert = function (sets, context) {
        // 支持迭代promise
        var deferred = context.deferred || new Chain();
        var storeName = context.storeName;
        var transaction = context.db.transaction(
            storeName, TransactionModes.READ_WRITE);
        var store = transaction.objectStore(storeName);
        if (!context.loopCount) {
            logger.time('insert');
            context.loopCount = 0;
            // 支持单条数据，同时也时为了数据拷贝，不影响源数据
            sets = [].concat(sets);
        }
        var SPLICE_SIZE = 10000;
        var restList = [];
        transaction.onabort  = function (e) {
             // 如果插入失败；打印错误信息
            if (e.type === 'abort') {
                deferred.reject({
                    data: this,
                    error: e.target.error
                });
                // logger.dir(e.target.error);
            }
        }.bind(sets);
        transaction.oncomplete = function (e) {
            if (restList.length > 0) {
                context.deferred = deferred;
                context.loopCount++;
                // 为了避免UI_block
                setTimeout(function () {
                    exports.insert(restList, context);
                }, 30);
            }
            else {
                logger.timeEnd('insert');
                logger.log('loopCount %s', context.loopCount);
                // 实时关闭数据库
                context.db.close();
                deferred.resolve(sets);
            }
        };
        // 更大量数据操作的时候可能block-ui, 所以要分片插入方式
        if (sets.length > SPLICE_SIZE) {
            // 剩余数据到下次执行
            restList = sets.splice(SPLICE_SIZE);
        }
        var putting = {};
        for (var i = 0, len = sets.length; i < len; i++) {
             // 缄默模式插入：数据库同步中开启
            if (context.silent) {
                sets[i].__tag = TAG_STATE.ADD;
            }
            // 如果定义了数据库模式，通过模式检查或fix相关数据
            if (context.fixItem && context.fixItem(sets[i])) {
                putting = store.put(sets[i]); // put means upsert
            }
            else if (context.upsert) {
                // 添加或置换
                putting = store.put(sets[i]);
            }
            else {
                // 默认直接添加操作
                putting = store.add(sets[i]);
            }
            putting.onerror = context.errorHandler || putFail.bind(sets[i]);
            // putting.onabort = context.onabort || putAbort.bind(sets[i]);
        }
        return deferred;
    };
    function putFail(error) {
        this.error = error.target.error;
        logger.error(this);
    }
    /**
     * 计算数据库内记录数量
     *
     * @param {Object} context 上下文
     * @return {Chain}
     */
    exports.count = function (context) {
        var storeName = context.storeName;
        var transaction = context.db.transaction(
            [storeName], TransactionModes.READ_ONLY);
        var store = transaction.objectStore(storeName);
        var request = store.count();
        return exports.request(request, context, function (count) {
            return {count: count, name: storeName};
        });
    };
    /**
     * 查询满足条件的记录数量
     * - 只有索引条件能够满足
     * @param  {Object}   selector 选择条件
     * @param  {Object}   context 上下文
     * @return {Chain}
     */
    exports.conditionCount = function (selector, context) {
        var deferred = new Chain();
        var storeName = context.storeName;
        var transaction = context.db.transaction(
            [storeName], TransactionModes.READ_WRITE);
        var store = transaction.objectStore(storeName);
        var keys = Object.keys(selector);
        if (keys.length === 0
            || !store.indexNames.contains(keys[0])) {
            throw new Error('请使用正确的索引条件查找');
        }
        else if (keys.length > 1) {
            logger.warm('只有第一个索引条件用于检索');
        }
        var key = keys[0];
        var filter = getRange(selector[key]);
        // 删除第一个条件
        if (filter) {
            var index = store.index(key);
            // 请求数据
            var request = index.count(filter);
            request.onsuccess = function (e) {
                var count = e.target.result;
                deferred.resolve({count: count});
            };
        }
        else {
            throw new Error('请使用正确的索引条件查找');
        }
        return deferred;
    };
    /**
     * 查询元素
     * - 结合索引查找和内存查找机制
     * - 第一个记录用索引查找（后续改为智能匹配索引）
     * @param  {Object}   selector 选择条件
     * @param  {Object}   context 上下文
     * @param  {Function} callback 回调函数
     * @return {Chain}
     */
    exports.find = function (selector, context, callback) {
        var deferred = new Chain();
        var storeName = context.storeName;
        // 更新和删除等操作需要打开读写模式
        var transactionMode = context.writeMode
            ? TransactionModes.READ_WRITE
            : TransactionModes.READ_ONLY;
        var transaction = context.db.transaction(
            [storeName], transactionMode);
        var store = transaction.objectStore(storeName);
        var keys = Object.keys(selector);
        var request = null;
        var filter = null;
        var index = null;
        if (keys.length > 0 && store.indexNames.contains(keys[0])) {
            var key = keys[0];
            filter = getRange(selector[key]);
            // 删除第一个条件
            if (filter) {
                index = store.index(key);
                // 请求数据
                request = index.openCursor(filter, context.direction || 'next');
                delete selector[keys[0]];
                keys.unshift();
            }
        }
        if (!filter && store.indexNames.contains[store.keyPath]) {
            // 如果没有指定查询条件，默认按主键查询
            index = store.index(store.keyPath);
            request = index.openCursor(null, context.direction || 'next');
        }
        else if (!request) {
            request = store.openCursor(null, context.direction || 'next');
        }
        // 自定义游标处理, 且如果是只读取模式
        if (callback && !context.writeMode) {
            request.onsuccess = callback;
            return request;
        }
        var result = [];
        var count = context.count || Number.MAX_VALUE;
        var needFilter = keys.length > 0;
        var startIndex = context.startIndex || context.skip || 0;
        var advance = true;
        context.endIndex = startIndex; // 初始化为开始位置
        // 游标触发下次请求
        request.onsuccess = function (e) {
            var cursor = e.target.result;
            context.endIndex++; // 记录本次查找条件下的结束位置
            if (advance && cursor) {
                advance = false;
                if (startIndex > 0) {
                    cursor.advance(startIndex);
                    return;
                }
            }
            if (cursor && cursor.value && result.length < count) {
                var value = cursor.value;
                if (needFilter) {
                    if (memset.isMatchSelector(value, selector)) {
                        if (context.fields) {
                            value = memset.cut(value, context.fields);
                        }
                        callback && callback(cursor);
                        result.push(value);
                    }
                }
                else {
                    callback && callback(cursor);
                    result.push(value);
                }
                if (value) {
                    cursor.continue();
                }
            }
            else {
                callback && callback(cursor);
                var info = {
                    startIndex: startIndex,
                    endIndex: context.endIndex
                };
                result.info = info;
                deferred.resolve(result);
                 // 释放连接
                context.db.close();
            }
        };
        return deferred;
    };
});
