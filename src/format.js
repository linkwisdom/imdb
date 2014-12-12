/**
 * @file 格式转化实现
 *
 * @author Liandong Liu (liuliandong01@baidu.com)
 */

define(function (require, exports) {

    exports.json2csv = function (obj, keys) {
        var arr = keys.map(function (key) {
            var data = obj[key];

            if (Array.isArray(data)) {
                data = data.join(',');
            } else if ('object' == typeof data) {
                data = typeof data;
            }

            return data != undefined ? data : '';
        });
        
        return arr.join('\t');
    };

    exports.array2csv = function (list, keys) {
        if (!list.length) {
            return '';
        }

        keys = keys || Object.keys(list[0]);

        keys = keys.filter(function (key) {
            return key.substr(0, 2) != '__';
        });

        var result = list.map(function (item) {
            return exports.json2csv(item, keys);
        });

        result.unshift(keys.join('\t'));

        return result.join('\n');
    };
});