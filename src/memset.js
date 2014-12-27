/**
 * @file Memset 内存集合数据查询、更新管理器
 *
 * @author Liandong Liu (liuliandong01@baidu.com)
 */
 
define( function (require, exports) {

    /**
     * Memset 构造函数
     * @constructor
     * @param {Array} set
     */
    function Memset(set) {
        var me = this;

        if (this.constructor !== Memset) {
            me = new Memset(set);
        }
        me.set = set;
        return me;
    }

    /**
     * 按条件查找元素
     * @param  {Object} selector  查询条件
     * @param  {Object} condition 查询配置项
     * @return {Array} 符合条件的集合
     */
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

    /**
     * 对象扩展
     * @param  {Object} target 被扩展对象
     * @param  {Object} source 扩展对象
     * @return {Object} target
     */
    Memset.mix = function (target, source) {
        for (var key in source) {
            if (source.hasOwnProperty(key)) {
                target[key] = source[key];
            }
        }
        return target;
    };

    /**
     * 集合属性合并
     * @param  {Array} set1 目标集合
     * @param  {Array} set2 扩展集合
     * @param  {string=} key 联合字段
     * @return {Array} 合并结果
     */
    Memset.join = function (set1, set2, key) {
        var map = set2;
        // 基于指定索引字段的合并
        if (Array.isArray(set2) && key) {
            map = {};
            set2.forEach(function (item, idx) {
                var k = item[key] || 0;
                map[k] = idx;
            });

            set1.forEach(function (item, idx) {
                var k = item[key];
                var ex = set2[map[k]];
                Memset.mix(item, ex);
                console.log(item, key);
            });
        } else if (Array.isArray(set1) && Array.isArray(set2) ) {
            // 如果两个都是数组，直接基于索引合并
            set1.forEach(function (item, idx) {
                var ex = set2[idx];
                Memset.mix(item, ex);
            });
        } else if (typeof set2 === 'object') {
            var ex = set2;
            // 如果第二个参数是一个map对象
            set1.forEach(function (item, idx) {
                Memset.mix(item, ex);
            });
        }
        return set1;
    };
    
    /**
     * 转化查询结果
     * @param  {Array} query 查询条件
     * @return {Array} 查询条件数组
     */
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

    /**
     * 是否符合匹配规则
     * @param  {string}  opt 比较符
     * @param  {*}  val1 值1
     * @param  {*}  val2 值2
     * @return {Boolean}
     */
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

    /**
     * 剪切字段
     * @param  {Object} item 源对象
     * @param  {Array.<string>} fields 目标字段数组
     * @return {Object} 目标对象
     */
    Memset.cut = function (item, fields) {
        var newObj = {};
        fields.forEach(function (field) {
            newObj[field] = item[field];
        });
        return newObj;
    };

    /**
     * 判断是否完全匹配
     * @param  {Object}  item  源对象
     * @param  {Object}  conds 匹配条件
     * @return {Boolean}
     */
    Memset.isMatch = function (item, conds) {
        return (conds || []).every(function (cond) {
            var key = cond.field;
            return Memset.isMatchRule(cond.operand, item[key], cond.value);
        });
    };

    /**
     * 是否匹配特定查询条件
     * @param  {Object}  item  源对象
     * @param  {Object}  conds 匹配条件
     * @return {Boolean}
     */
    Memset.isMatchSelector = function (item, selector) {
        var conds = Memset.parseQuery(selector);
        return Memset.isMatch(item, conds);
    };

    return Memset;
});