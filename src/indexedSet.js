/**
 * @file ajax请求接口测试
 * @author Liandong Liu (liuliandong01@baidu.com)
 */
/* global mixItem*/

define(function (require, exports) {
    var memset = require('./memset');

    var getItem = function (key) {
        var idx = this._indecies[key];
        if (idx >= 0) {
            return this[idx];
        }
    };

    var grepFields = function (value, fields) {
        var rst = {};
        fields.forEach(function (field) {
            rst[field] = value[field] || '';
        });
        return rst;
    };

    var setItem = function (key, value) {
        var idx = this._indecies[key];
        if (idx >= 0) {
            this[idx] = mixItem(this[idx], value);
            return value;
        }
        if (!value.hasOwnProperty(this.keyPath)) {
            value[this.keyPath] = key;
        }
        var id = value[this.keyPath];
        idx = this.length;
        this[idx] = grepFields(value, this.fields);
        this._indecies[id] = idx;
        return this[idx];
    };

    var mixItem = function (item, change) {
        for (var key in item) {
            if (item.hasOwnProperty(key)
                && change.hasOwnProperty(key)) {
                item[key] = change[key];
            }
        }
        return item;
    };

    var putItem = function (item) {
        var key = item[this.keyPath];
        return this.setItem(key, item);
    };

    var findItem = function (selector) {
        return this.filter(function (item) {
            return item && memset.isMatchSelector(item, selector);
        });
    };

    var updateItem = function (selector, option) {
        return this.find(selector).map(function (item) {
            return mixItem(item, option.$set || option);
        });
    };

    // 慎用，会导致索引重构
    var removeItem = function (key) {
        var map = this._indecies;
        var idx = map[key];
        if (idx === undefined) {
            return;
        }
        for (var idkey in map) {
            if (map.hasOwnProperty(idkey)) {
                var index = map[idkey];
                if (index > idx) {
                    map[idkey] = index - 1;
                }
            }
        }
        var item = this[idx];
        // 删除改索引
        delete map[key];
        // 删除该元素
        this.splice(idx, 1);
        return item;
    };

    exports.build = function (list, keyPath, fields) {
        list = list || [];
        var map = {};

        list.keyPath = keyPath;
        list.fields = fields;
        list.forEach(function (item, index) {
            map[item[keyPath]] = index;
        });

        list._indecies = map;
        list.getItem = getItem.bind(list);
        list.setItem = setItem.bind(list);
        list.removeItem = removeItem.bind(list);
        list.putItem = putItem.bind(list);
        list.find = findItem.bind(list);
        list.update = updateItem.bind(list);
        return list;
    };

    return exports;
});
