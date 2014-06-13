var Fsm = BehavioralFsm.extend({
    constructor: function(name, title, salary, shouldExpectFbiRaid) {
        Fsm.prototype.constructor.__super.apply(this, arguments);

        var id = this.namespace;

        // need to curry id into prototype method calls
        // as instance level methods since this is a 
        // one-client FSM like pre v0.4 machina
        _.each([
            "handle",
            "transition",
            "processQueue",
            "clearQueue",
            "deferUntilTransition",
            "deferUntilNextHandler",
        ], function(method) {
            this[method] = this[method].bind(this, id);
        }, this);

        BehavioralFsm.prototype.register.call(this, id, this);

    },

    getClient: function(id) {
        return this;
    },

    getClientMeta: function() {
        return this;
    }
}, {}, {
    deep: true
});