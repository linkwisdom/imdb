define(function (require, exports) {
    var Chain = require('./Chain');
    var Pager = require('./Pager');
    var Loader = require('./Loader');
    
    function View(option) {
        var view = this;
        var key = JSON.stringify(option.condition);
        var views = option.store.views = option.store.views || {};
        view.set(option);

        // 如果查询条件一样，则缓存条件视图
        if (views.hasOwnProperty(key)) {
            view =  views[key];
            return view;
        } else {
            views[key] = view;
        }

        this.loader = new Loader({
            store: this.store,
            datasource: [],
            condition: this.condition,
            startIndex: 0,
            pageSize: this.pageSize,
            endIndex: 0
        });
    }

    proto = {
        recordId: 0, // 上次查询记录skip-id
        datasource: [], // 查询结果
        condition: {}, // 查询条件
        params: {},
        state: 'pending',
        set: function (option) {
            for (var key in option) {
                if (option.hasOwnProperty(key)) {
                    this[key] = option[key] || this[key];
                }
            }
        },
        load: function (option) {
            this.set(option);
            var view = this;
            var store = this.store;

            if (this.recordId < this.datasource.length) {
                return Promise.resolve(this.datasource);
            }

            // todo解决增量下一批物料id, 所以要获取find游标数量；可以通过改写params方式
            var chain = store.find(this.condition, this.params);
            chain.then(function (data) {
                console.dir(chain);
                // 不修改引用下插入批量数据
                Array.prototype.push.apply(view.datasource, data);
               // view.loader.set(data.info); // 逐渐加载内容
                return view.datasource;
            });
            return chain;
        },
        getPage: function (option) {
            return this.loader.getPage(option);
//             var view = this;
//             var chain = new Chain();
//             this.loader.load().then(function () {
//                 var data = view.pager.get(option);
//                 chain.resolve(data);
//             });
//             return chain;
        },
        _getPager: function (option) {
            option = option || {};
            return new Pager({
                datasource: this.datasource,
                pageSize: option.pageSize || 100,
                pageIndex: option.pageIndex || 0
            });
        }
    };

    View.prototype = proto;
    return View;
});