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
        FORCE_REMOVE: -1,
        SILENT: 0,
        UPDATE: 1,
        ADD: 2,
        REMOVE: 3
    };

    exports.TAG_STATE = TAG_STATE;

    /**
     * 复制对象(浅复制)
     * @param {Object} source 要复制的对象
     * @param {number} maxDeep 深度数量
     * @return {Object} 复制完的对象
     */
    function objectClone(source, maxDeep) {
        var result = {};
        for (var key in source) {
            if (source.hasOwnProperty(key)) {
                var item = source[key];
                if (Array.isArray(item)) {
                    // 数组内元素不再深度
                    result[key] = [].concat(item);
                }
                else if (maxDeep && (typeof item === 'object')) {
                    result[key] = objectClone(item, maxDeep - 1);
                }
                else {
                    result[key] = item;
                }
            }
        }
        return result;
    }

    function updateTag(item, op) {
        // 已经删除的物料，就别再操作了
        if (item._tag === TAG_STATE.REMOVE) {
            return TAG_STATE.SILENT;
        }

        // 如果是新增操作，尽快新增
        if (op === TAG_STATE.ADD) {
            item._tag = TAG_STATE.ADD;
            return TAG_STATE.ADD;
        }

        // 如果是新增物料
        if (item._tag === TAG_STATE.ADD) {
            // 如果要删除新增物料
            if (op === TAG_STATE.REMOVE) {
                // 强制删除
                return item._tag = TAG_STATE.FORCE_REMOVE;
            }
            // 尽快更新
            return op;
        }

        // 如果是删除操作；默认软删除
        if (op === TAG_STATE.REMOVE) {
            item._tag = TAG_STATE.REMOVE;
            return TAG_STATE.REMOVE;
        }

        // 如果是更新操作
        if (op === TAG_STATE.UPDATE) {
            // 如果value第一次更新；则保留历史数据
            if (!item._tag && !item._oldValue) {
                item._oldValue = JSON.stringify(item);
            }
            item._tag = TAG_STATE.UPDATE;
            return TAG_STATE.UPDATE;
        }
        return item._tag;
    }

    /**
     * 获取索引查找条件
     * @param {Object} condition 查询条件
     * @return {IDBKeyRange} range条件
     */
    function getRange(condition) {
        var tp = typeof condition;
        // 直接基于这个键索引或排序即可
        if (tp === 'undefined') {
            // 目前业务上采用的是第一个值为{}来标识排序字段.没有使用@的方式.
            // || condition === '@index' || condition === '@sort') {
            return null;
        }
        if (tp !== 'object' || Array.isArray(condition)) {
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
        return null;
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
            }, 10);
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

    /**
     * 简单获取链接实例
     * - todo 删除或者直接pipe
     */
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
        var databases = localStorage.getItem('idb-databases') || '';
        databases = databases.replace(dbName, '').replace(';;', ';');
        localStorage.setItem('idb-databases', databases);
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
        var updator = context.$set || context.value;
        var inc = context.$inc;
        var assign = context.$let;
        var validate = context.$validate; // 校验函数
        // upsert 表示如果数据不存在则插入数据（data）
        if (option && option.upsert) {
            context.upsert = true;
        }
        // 需要有目标数据
        var upsert = updator && context.upsert || false;
        // 打开find的write模式
        context.writeMode = true;

        if (typeof selector === 'object' && !Array.isArray(selector)) {
             // 如果是Object类型，先查询后删除
            exports.find(
                selector, context).then(
                function (result) {
                    var putValues = function () {
                        var putDeferred = new Chain();
                        var transaction = context.db.transaction([context.storeName], TransactionModes.READ_WRITE);
                        var store = transaction.objectStore(context.storeName);
                        var putCount = 0;
                        var okCount = 0;
                        var modValue = function (value) {
                            if (updator) {
                                value = memset.update(value, updator);
                            }
                            if (inc) {
                                for (var k in inc) {
                                    if (inc.hasOwnProperty(k)) {
                                        // 对cursor的修改会触发重建游标；
                                        value[k] += inc[k];
                                    }
                                }
                            }
                            if (assign) {
                                var assigned = assign(value);
                                // 如果有返回值，则需要重写
                                // 建议函数内对象直接修改
                                if (assigned) {
                                    value = assigned;
                                }
                            }
                            // 校验函数
                            if (validate && value) {
                                value._oldError = value._error;
                                // todo[haihan] 避免全字段验证
                                value._error = validate(value);
                            }
                            return value;
                        };
                        var putFinished = function (e) {
                            if (++okCount === putCount) {
                                putDeferred.resolve();
                            }
                        };
                        var putValue = function (value) {
                            // todo[haihan] 这里需要讨论updateTag是否要判断_tag, 而不是业务方
                            // 事实上,业务方全部更新的时候,确实已经设置了_tag
                            // 如果更新条件不符合 (除非使用了强制更新的方式)
                            if (
                                context.force !== true &&
                                updateTag(value, TAG_STATE.UPDATE) !== TAG_STATE.UPDATE) {
                                return;
                            }
                            var newValue = modValue(value);
                            putCount++;
                            var put = store.put(newValue);
                            put.onsuccess = putFinished;
                            put.onerror = putFinished;
                        };
                        result.forEach(putValue);
                        if (putCount === 0) {
                            return Promise.resolve();
                        }
                        return putDeferred;
                    };
                    putValues().then(function () {
                        // todo (liandong) 这部分还有bug
                        if (upsert && result.length === 0 && context.patch) {
                            // 自动填充一些字段
                            var newItem = context.patch;
                            // for (var kay in data) {
                            //     if (data.hasOwnProperty(kay)) {
                            //         newItem[kay] = data[kay];
                            //     }
                            // }
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
                    });
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
            exports.find(selector, context).then(function (list) {
                
                var okCount = 0;
                // 过滤无效数据
                var data = list.filter(function (item) {
                    return !!item;
                });
                var removeCount = data.length;

                if (removeCount === 0) {
                    deferred.resolve(list);
                }

                var transaction = context.db.transaction([context.storeName], TransactionModes.READ_WRITE);
                var store = transaction.objectStore(context.storeName);

                var removeFinished = function () {
                    if (++okCount === removeCount) {
                        deferred.resolve(list);
                    }
                };

                var removeValue = function (value) {
                    var remove = null;
                    // 【注意】指定软删除、或者是本地新增加物料都是软删
                    // 对本地新增加的物料，无条件硬删除
                    if (context.force !== true && value._tag !== TAG_STATE.ADD) {
                        value._tag = TAG_STATE.REMOVE;
                        remove = store.put(value);
                    }
                    else {
                        // 删除返回列表要求知道删除是软删除或硬删除
                        value._tag = TAG_STATE.FORCE_REMOVE;
                        try {
                            // 硬删除: 业务层无法保证主键存在
                            remove = store.delete(value[store.keyPath]);
                        }
                        catch (ex) {
                            removeFinished();
                        }
                    }
                    if (remove) {
                        remove.onsuccess = removeFinished;
                        remove.onerror = removeFinished;
                    }
                };
                data.forEach(removeValue);
            });

            return deferred;
        }
        // 如果是数字、数组、字符串；采用id删除策略
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
                // 只有超过多片才会保留sourceList
                deferred.resolve(context.sourceList || sets);
            }
        };
        // 更大量数据操作的时候可能block-ui, 所以要分片插入方式
        if (sets.length > SPLICE_SIZE) {
            if (!context.sourceList) {
                context.sourceList = [].concat(sets);
            }

            // 剩余数据到下次执行
            restList = sets.splice(SPLICE_SIZE);
        }
        var putting = {};
        for (var i = 0, len = sets.length; i < len; i++) {
             // 缄默模式插入：数据库同步中开启
             // 逻辑修改为主键如果为负数，则需要表示表示本地新增加
             // 业务端也可以强制添加tag
            if (sets[i] && sets[i][store.keyPath] < 0) {
                sets[i]._tag = TAG_STATE.ADD;
            }
            // 挂载校验器
            if (context.$validate) {
                sets[i]._error = context.$validate(sets[i]);
            }
            // 如果定义了数据库模式，通过模式检查或fix相关数据
            if (context.fixItem && context.fixItem(sets[i], i)) {
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
     * 清除sotore数据
     * @param {Object} context 上下文
     * @return {Chain}
     */
    exports.clear = function (context) {
        var stores = [].concat(context.stores || context.storeName);
        if (context.stores === '*') {
            stores = Array.prototype.slice.call(context.db.objectStoreNames);
        }
        // var storeName = context.storeName;
        var transaction = context.db.transaction(
            stores, TransactionModes.READ_WRITE);
        var request = null;
        stores.forEach(function (storeName) {
            var store = transaction.objectStore(storeName);
            request = store.clear();
        });
        return exports.request(request, context);
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

    exports.contains = function (selectors, context, callback) {
        selectors = [].concat(selectors);
        var chain = new Chain();
        var storeName = context.storeName;
        var transactionMode = TransactionModes.READ_ONLY;
        var transaction = context.db.transaction(
            [storeName], transactionMode);
        var store = transaction.objectStore(storeName);
        var conditions = [];

        selectors.forEach(function (selector, index) {
            var key = Object.keys(selector)[0];
            if (store.keyPath === key) {
                conditions.push({
                    key: key,
                    value: selector[key]
                });
            }
            else if (store.indexNames.contains(key)) {
                conditions.push({
                    key: key,
                    selector: selector,
                    filter: getRange(selector[key])
                });
            }
        });
        var result = {};
        var flags = conditions.length;
        conditions.forEach(function (cond) {
            var request = {};
            if (cond.value) {
                request = store.get(cond.value);
            }
            else {
                var index = store.index(cond.key);
                request = index.openCursor(cond.filter);
            }

            request.onsuccess = function (e) {
                var cursor = e.target.result;
                if (cursor && cursor.value) {
                    if (memset.isMatchSelector(cursor.value, cond.selector)) {
                        flags--;
                        result[cond.key] = cursor.value[store.keyPath];
                    }
                    else {
                        cursor.continue();
                    }
                }
                else if (!cursor) {
                    // 没有符合条件的情况了
                    flags--;
                }

                if (flags === 0) {
                    chain.resolve(result);
                }
            };
        });
        return chain;
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
        // 后面对selector的delete等操作，有一点问题，所以这里clone下
        selector = objectClone(selector, 3);
        var chain = new Chain();
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

        // 筛选条件：如果第一个建是索引键
        // 现在如果第一个键是ne, 不需要业务端设置第一个字段为主键了.
        if (keys.length > 0 && store.indexNames.contains(keys[0])) {
            var key = keys[0];
            var condition = selector[key];
            // 除了排序,还进行了条件判断
            filter = getRange(condition);
            // 特殊处理. 不能对_tag或者_error等使用空filter(例如ne)的index, 因为这种字段可能为null
            // 会导致结果中不包含有null值的行. 以后需要完善默认值机制,来避免此特殊逻辑
            if (filter || key.charAt(0) !== '_') {
                index = store.index(key);
                // 请求数据. filter可能是NULL,这是为了排序
                request = index.openCursor(filter, context.direction || 'next');
                // 如果filter已经处理了,或者仅仅是为了排序.就不需要游标后在内存中再处理了. 直接清除掉
                var isOnlySort = (condition == null)
                    || (typeof condition === 'object' && Object.keys(condition).length === 0);
                if (filter || isOnlySort) {
                    delete selector[key];
                    keys.unshift();
                }
            }
        }

        var mainKey = selector[store.keyPath];

        // 采用主键查找
        if (!filter && typeof mainKey === 'number') {
            // 如果没有指定查询条件，默认按主键查询
            // index = store.index(store.keyPath);
            request = store.get(selector[store.keyPath]);
        }
        else if (!filter && (selector.$in || (mainKey && mainKey.$in))) {
            var idSet = selector.$in || (mainKey && mainKey.$in);
            if (selector.$in) {
                delete selector.$in;
            }
            else {
                delete mainKey.$in;
            }
            // 如果是基于主键集合查找
            request = new IteRequest(idSet, store);

        }
        else if (!request) {
            // 如果没有指定查找条件，按主键遍历游标
            request = store.openCursor(null, context.direction || 'next');
        }

        // 自定义游标处理, 且如果是只读取模式
        if (callback && !context.writeMode) {
            request.onsuccess = callback;
            return request;
        }
        // 重定义配置参数
        context.result = [];
        context.count = context.count || Number.MAX_VALUE;
        context.needFilter = keys.length > 0;
        context.startIndex = context.startIndex || context.skip || 0;
        context.endIndex = context.startIndex; // 初始化为开始位置
        context.conds = memset.parseQuery(selector);
        context.callback = callback;
        context.chain = chain;
        context.advance = context.advance || true;
        // 请求枚举函数
        request.onsuccess = exports.findSuccess.bind(context);
        
        if (request.continue) {
            request.continue();
        }
        return chain;
    };

    /**
     * Id遍历选择器
     *
     * @param {Array<number>} array id列表
     * @param {Object} store 所遍历的表对象
     */
    function IteRequest(array, store) {
        var cur = 0;
        var me = this;
        var cursor = {
            'update': store.put.bind(store),
            'delete': store.delete.bind(store)
        };

        this.get = function (id) {
            if (id === undefined) {
                me.onsuccess({target: store});
                return;
            }
            var req = store.get(id);
            req.onsuccess = function (e) {
                cursor.value = e.target.result;
                if (cursor.value) {
                    cursor.id = cursor.value[store.keyPath];
                }
                e.target.data = cursor;
                me.onsuccess(e);
            };
        };

        this.onsuccess = function (e) {
            var value = e.target.result;
        };

        this.continue = function () {
            var id = array[cur++];
            this.get(id);
        };
        cursor.continue = this.continue.bind(this);
    }


    exports.findSuccess = function (e) {
        var context = this; // 通过this传递闭包参数
        var conds = this.conds;
        var callback = this.callback;
        var result = this.result;
        var chain = this.chain;
        var needFilter = this.needFilter;
        var startIndex = context.startIndex;

        var cursor = e.target.data || e.target.result;
        // 如果指定了跳跃数，从跳跃数重新开始查询
        if (context.advance && cursor) {
            context.advance = false;
            if (context.startIndex > 0) {
                cursor.advance(context.startIndex);
                return;
            }
        }
        if (cursor && result.length < context.count) {
            context.endIndex++; // 记录本次查找条件下的结束位置
            var value = cursor.value || cursor;
            var isMatch = true;
            if (needFilter) {
                isMatch = memset.isMatch(value, conds);
            }
            // 只有符合了表达式的判断,才有必要进行下一步验证
            if (isMatch && context.filter) {
                isMatch = !!context.filter(value);
            }
            // 如果匹配才存库
            if (isMatch) {
                callback && callback(cursor);
                result.push(value);
            }
            // cursor.fail 是callback中修改的
            if (cursor.continue) {
                cursor.continue();
            }
            else {
                context.chain.resolve(result);
            }
        }
        else {
            callback && callback(cursor);
            var info = {
                startIndex: startIndex,
                endIndex: context.endIndex
            };
            // 注意默认强制注入改信息；为了方便之后继续查询
            result.info = info;
            chain.resolve(result);
        }
    };
});
