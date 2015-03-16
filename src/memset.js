/**
 * @file Memset 内存集合数据查询、更新管理器
 *
 * @author Liandong Liu (liuliandong01@baidu.com)
 */

define(function (require, exports) {
    /**
     * Memset 构造函数
     * @constructor
     * @param {Array} set 初始集合
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
     * 解析特定字段更新
     * Memset.resolveValue(
     *     {winfoid: 112, bid: 10},
     *     {id: '@winfoid', bid: {$inc: 12}},
     *     'bid'
     * );
     * => {winfoid: 112, bid: 22}
     * - $opt 参考 `Memset.assignValue`
     * @param  {Object} target 更新条件
     * @param  {Object} source 被更新对象
     * @param  {string} key    更新字段
     * @return {*} 更新后的值
     */
    Memset.resolveValue = function (target, source, key) {
        var value = source[key];
        var tp = typeof value;
        if (value && 'object' === typeof value) {
            var keys = Object.keys(value);
            var ov = value;
            var flag = false;
            keys.forEach(function (opt) {
                if (opt.charAt(0) === '$') {
                    flag = true;
                    target[key] = Memset.assignValue(opt, target[key], ov[opt]);
                }
            });
            value = flag ? target[key] : value;
        }
        else if (tp === 'string' && value.charAt(0) === '@') {
            var tkey = value.substr(1);
            var tvalue = target[tkey];
            if (tkey === '') {
                tvalue = Memset.mix({}, target);
            }
            // 如果未定义相关字段或值，不改变赋值情况
            if (tvalue === undefined) {
                tvalue = source[key];
            }
            value = target[key] = tvalue;
            
        }
        return value;
    };

    /**
     * 按条件更新对象
     * Memset.update(
     *     {id: '@winfoid', bid: {$inc: 12}},
     *     {winfoid: 112, bid: 10}
     * );
     * => {winfoid: 112, bid: 22, id: 112}
     * @param  {Object} target 目标对象
     * @param  {Object} source 更新条件
     * @return {Object} 更新结果
     */
    Memset.update = function (target, source) {
        for (var key in source) {
            if (source.hasOwnProperty(key)) {
                target[key] = Memset.resolveValue(target, source, key);
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
                ex ? Memset.mix(item, ex) : item;
            });
        }
        else if (Array.isArray(set1) && Array.isArray(set2)) {
            // 如果两个都是数组，直接基于索引合并
            set1.forEach(function (item, idx) {
                var ex = set2[idx];
                Memset.mix(item, ex);
            });
        }
        else if (typeof set2 === 'object') {
            var ex = set2;
            // 如果第二个参数是一个map对象
            set1.forEach(function (item, idx) {
                Memset.mix(item, ex);
            });
        }
        return set1;
    };

    /**
     * 解析过滤条件
     * Memset.parseFilter(
     *     [
     *         {planid: {$gte: 0}},
     *         {planname: {$like: '鲜花'}},
     *     ]
     * );
     * => 返回符合或条件的集合
     * @param  {Array} selector 查询条件集合
     * @return {Function} 过滤条件
     */
    Memset.parseFilter = function (selector) {
        var selectors = [].concat(selector);
        return function (item) {
            return selectors.some(function (filter) {
                return Memset.isMatchSelector(item, filter);
            }) && item;
        };
    };

    /**
     * 转化查询结果
     * @param  {Array} query 查询条件
     * @return {Array} 查询条件数组
     */
    Memset.parseQuery = function (query) {
        var res = [];
        if (!Array.isArray(query)) {
            query = [].concat(query);
        }

        query.forEach(function (cond) {
            // Set key
            var keys = Object.keys(cond);
            keys.forEach(function (key) {
                if (typeof cond[key] === 'object') {
                    var condition = Object.keys(cond[key] || {});
                    condition.forEach(function (cd) {
                        res.push({
                            field: key,
                            operand: cd,
                            value: cond[key][cd]
                        });
                    });
                }
                else {
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
     * @return {boolean}
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
            case '$e': // 逻辑等价
                return val1 == val2;
            case '$ne': // 非逻辑等价
                return !(val1 == val2);
            case '$eq':
                return val1 === val2;
            case '$neq': // 完全等价
                return !(val1 === val2);
            case '$with': // 用于字串匹配即可
                return val1.indexOf(val2) > -1;
            case '$between':
                return val1 > val2[0] && val1 < val2[1];
            case '$in': // 属于集合
                return val2.indexOf(val1) > -1;
            case '$out': // 不属于集合
                return val2.indexOf(val1) == -1;    
            case '$null':
                return (val1 === null) === val2;
            case '$like':
                return new RegExp(val2, 'i').test(val1);
            default:
                return val1 == val2;
        }
    };

    /**
     * 设定更新值
     * @param  {string}  opt 比较符
     * @param  {*}  val1 值1
     * @param  {*}  val2 值2
     * @return {boolean}
     */
    Memset.assignValue = function (opt, val1, val2) {
        switch (opt) {
            case '$rand':
                return Math.ceil(Math.random() * val2);
            case '$replace':
                if (Array.isArray(val2)) {
                    return val1.replace(val2[0], val2[1]);
                }
                else {
                    return val2;
                }
            case '$range':
                if (Array.isArray(val2)) {
                    return Math.max(val2[0], Math.min(val2[1], val1));
                }
                return Math.min(val1, val2);
            case '$trim':
                return val1.trim();
            case '$prepend':
                return val2 + val1;
            case '$append':
                return val1 + val2;
            case '$inc':
                return val1 + val2;
            case '$multiply':
                return val1 * val2;
            case '$minus':
                return val1 - val2;
            default:
                return val2;
        }
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
    Memset.parseSubQuery = function (key, subs) {
        return subs.map(function (sub) {
            var obj = {};
            obj[key] = sub;
            return obj;
        });
    }
    /**
     * 判断是否完全匹配
     * db.plan.find({planname: {$or: [{$with: 'aa'}, {$width: 'plan'} ]}})
     *
     * db.plan.find({wbudget: {$gt: 20}, planname: {$or: [{$with: 'aa'}, {$width: 'plan'} ]}})
     * 
     * @param  {Object|*}  item  源对象
     * @param  {Array}  conds 匹配条件
     * @return {boolean}
     */
    Memset.isMatch = function (item, conds) {
        return (conds || []).every(function (cond) {
            var key = cond.field;
            var raw = item[key];
            if (cond.operand === '$or' && Array.isArray(cond.value)) {
                var subs = Memset.parseSubQuery(key, cond.value);
                subs = Memset.parseQuery(subs);
                return subs.some(function (sub) {
                    return Memset.isMatchRule(sub.operand, raw, sub.value);
                });
            }
            else if (cond.operand === '$and' && Array.isArray(cond.value)) {
                var subs = Memset.parseSubQuery(key, cond.value);
                subs = Memset.parseQuery(subs);
                return subs.every(function (sub) {
                    return Memset.isMatchRule(sub.operand, raw, sub.value);
                });
            }
            return Memset.isMatchRule(cond.operand, raw, cond.value);
        });
    };

    /**
     * 是否匹配特定查询条件
     * @param  {Object}  item  源对象
     * @param  {Object}  selector 匹配条件
     * @return {boolean}
     */
    Memset.isMatchSelector = function (item, selector) {
        var conds = Memset.parseQuery(selector);
        return Memset.isMatch(item, conds);
    };

    return Memset;
});
