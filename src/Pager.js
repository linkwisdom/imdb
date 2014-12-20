define(function (require, exports) {
    function Pager(option) {
        this.pageIndex = 0;
        this.pageSize = 100;
        this.startIndex = 0;
        this.datasource = [];
        this.set(option);
    }

    Pager.prototype.get = function (option) {
        this.set(option);
        var list = this.datasource;

        var rst = list.slice(
            this.startIndex,
            this.startIndex + this.pageSize
        );

        return rst;
    };

    Pager.prototype.set = function (option) {
        option =  option || {};
        for (var key in option) {
            if (option.hasOwnProperty(key)) {
                this[key] = option[key] || this[key];
            }
        }

        this.startIndex = this.pageIndex * this.pageSize;
        this.total = this.datasource.length;
        this.pageCount = Math.ceil(this.total / this.pageSize);
    };

    Pager.prototype.hasNext = function (option) {
        this.set(option);
        return this.pageCount - this.pageIndex - 1;
    };

    return Pager;
});
