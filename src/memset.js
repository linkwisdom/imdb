/**
 * @file Memset 内存集合数据查询、更新管理器
 *
 * @author Liandong Liu (liuliandong01@baidu.com)
 */
 
define( function (require, exports) {

    function Memset(set) {
        var me = this;

        if (this.constructor !== Memset) {
            me = new Memset(set);
        }

        me.set = set;

        return me;
    }

    Memset.prototype.find = function (selector, condition) {
        var me = this;
        var conds = Memset.parseQuery(selector);
        var fields = condition.fields;
        
        if (fields) {
            var list = [];
            this.set.forEach(function (item) {
                list.push(Memset.cut(item, fields));
            });
            return list;
        }

        return this.set.filter(function (item) {
            return Memset.isMatch(item, conds);
        });
    };

    Memset.parseQuery = function (query) {
        var res = [];
        if (!Array.isArray(query)) {
            query = [query];
        }

        query.forEach(function (cond) {
            // Set key
            var keys = Object.keys(cond);
            keys.forEach(function (key) {
                if (typeof cond[key] === 'object') {
                    var condition = Object.keys(cond[key]);
                    condition.forEach(function (cd) {
                        res.push({
                            field: key,
                            operand: cd,
                            value: cond[key][cd]
                        });
                    });
                } else {
                    // Direct (==) matching
                    res.push({
                        field: key,
                        operand: '$eq',
                        value: cond[key]
                    });
                }
            });
        });
        return res;
    };

    Memset.isMatchRule = function (opt, val1, val2) {
        switch (opt) {
            case '$gt':
                return val1 > val2;
            case '$lt':
                return val1 < val2;
            case '$gte':
                return val1 >= val2;
            case '$lte':
                return val1 <= val2;
            case '$ne':
                return val1 != val2;
            case '$eq':
                return val1 == val2;
            case '$neq':
                return val1 != val2;
            case '$between':
                return val1 > val2[0] && val1 < val2[1];
            case '$in':
                return val2.indexOf(val1) > -1;
            case '$null':
                return (val1 == null) == val2; 
            case '$like':
                return new RegExp(val2, 'i').test(val1);
        };
    };

    Memset.cut = function (item, fields) {
        var newObj = {};
        fields.forEach(function (field) {
            newObj[field] = item[field];
        });
        return newObj;
    };

    Memset.isMatch = function (item, conds) {
        return (conds || []).every(function (cond) {
            var key = cond.field;
            return Memset.isMatchRule(cond.operand, item[key], cond.value);
        });
    };

    Memset.isMatchSelector = function (item, selector) {
        var conds = Memset.parseQuery(selector);
        return Memset.isMatch(item, conds);
    };

    window.Memset = Memset;

    return Memset;
});