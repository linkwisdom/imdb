define(function (require, exports) {
    var Chain = require('./Chain');
    var Pager = require('./Pager');

    function Loader(option) {
        this.startIndex = 0;
        this.pageSize = 100;
        this.preLoadPages = 5;
        this.pager = new Pager(
            {
                datasource: option.datasource,
                pageSize: option.pageSize || 100,
                pageIndex: option.pageIndex || 0
            }
        );

        this.set(option);
    }

    Loader.prototype.getPage = function (option) {
        var loader = this;
        var pager = this.pager;
        pager.set(option);
        var chain = new Chain();
        if (pager.hasNext() < 1) {
            loader.load({pageCount: 2}).then(function () {
                chain.resolve(pager.get(option));
            });
        }
        else {
            chain.resolve(pager.get(option));
        }
        return chain;
    };

    Loader.prototype.load = function (option) {
        this.set(option);
        var loader = this;
        var chain = this.store.find(this.condition, {
            skip: this.startIndex,
            count: this.pageSize
        });
        chain.then(function (data) {
            // 不修改引用下插入批量数据
            Array.prototype.push.apply(loader.datasource, data);
            loader.set({
                startIndex: data.info.endIndex
            }); // 逐渐加载内容
            return data;
        });
        return chain;
    };

    Loader.prototype.get = function (option) {
        this.set(option);
        var list = this.datasource;

        var rst = list.slice(
            this.startIndex,
            this.startIndex + this.pageSize
        );

        return rst;
    };

    Loader.prototype.set = function (option) {
        for (var key in option) {
            if (option.hasOwnProperty(key)) {
                this[key] = option[key] || this[key] || 0;
            }
        }
        this.total = this.datasource.length;
    };
    return Loader;
});
