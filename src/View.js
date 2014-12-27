define(function (require, exports) {
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
        }

        views[key] = view;
        this.loader = new Loader({
            store: this.store,
            datasource: [],
            condition: this.condition,
            startIndex: 0,
            pageSize: this.pageSize,
            endIndex: 0
        });
    }

    var proto = {
        recordId: 0, // 上次查询记录skip-id
        datasource: [], // 查询结果
        condition: {}, // 查询条件
        params: {},
        set: function (option) {
            for (var key in option) {
                if (option.hasOwnProperty(key)) {
                    this[key] = option[key] || this[key];
                }
            }
        },
        getPage: function (option) {
            return this.loader.getPage(option);
        }
    };

    View.prototype = proto;
    return View;
});
