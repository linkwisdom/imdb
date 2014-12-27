/**
 * @file webSql构建接口
 * 
 * @author Liandong Liu (liuliandong01@baidu.com)
 */
 
define(function (require, exports, module) {
    var Promise = require('./Promise');

    var DEFAULT_DB_NAME = 'default_db';

    var DEFAULT_OPTION = {
        version: '',
        description: 'no description',
        queryQuato: 10 * 1024 * 1024
    };

    // 新建一个database
    exports.create = function (dbName, option) {
        var db = Object.create(exports);
        exports.db = db;
        db.dbName = dbName;
        db.option = option;
        return db;
    };

    // 打开数据库
    exports.open = function() {
        if (!this.dbName) {
            this.db = exports.create(DEFAULT_DB_NAME, DEFAULT_OPTION);
        }
        var db = this.db;
        var dbName = db.dbName;
        var option = db.option || DEFAULT_OPTION;

        var db = openDatabase(
            dbName, // 数据库名称
            option.version, // 数据库版本
            option.description, // 数据库描述
            option.queryQuato || DEFAULT_OPTION.queryQuato, // 请求配额
            function (db) {
                db.changeVersion(
                    DEFAULT_OPTION.version,
                    DEFAULT_OPTION.newVersion || DEFAULT_OPTION.version,
                    function (t) {
                        t.executeSql('CREATE TABLE docids (id, name)');
                    },
                    function (error) {
                        console.error(error);
                    }
                );
            }
        );

        return db;
    };

    // 获取请求连接
    exports.getQuery = function(sql, patches, promise) {
        return function (tx) {
            tx.executeSql(
                sql, patches,
                function (tx, data) {
                    promise.resolve(data);
                },
                function (tx, error) {
                    promise.reject(error);
                }
            );
        };
    };

    // 执行命令
    exports.executeSql = function(sql, patches, readOnly) {
        if (!this.db) {
            this.db = this.open();
        };

        var promise = new Promise();

        if (readOnly) {
            this.db.readTransaction(exports.getQuery(sql, patches || [], promise));
        } else {
            this.db.transaction(exports.getQuery(sql, patches || [], promise));
        }
        
        promise.done(function (data) {
            var result = [];
            if (data.rows.length) {
                for (var i = 0, len = data.rows.length; i < len; i++) {
                    result.push(data.rows.item(i));
                }
                console.table(result);
            } else {
                console.log(data.rowsAffected);
            }
        });

        return promise;
    };
});