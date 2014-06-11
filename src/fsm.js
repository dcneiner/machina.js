var Fsm = BehavioralFsm.extend({
    constructor: function(name, title, salary, shouldExpectFbiRaid) {
        Fsm.prototype.constructor.__super.apply(this, arguments);

        var id = this.namespace;

        // We pass the FSM in as the clientMeta object
        // so that the normal FSM-related state and
        // action metadata will be present on the instance
        this.register(id, function() {
            return this;
        }, {
            clientMeta: this,
            doNotStart: true
        });

        // need to curry id into prototype method calls
        // as instance level methods since this is a 
        // one-client FSM like pre v0.4 machina
        _.each([
            "handle",
            "transition",
            "processQueue",
            "clearQueue",
            "deferUntilTransition",
            "deferUntilNextHandler"
        ], function(method) {
            this[method] = this[method].bind(this, id);
        }, this);

        if (this.initialState) {
            this.transition(this.initialState);
        }

    }
}, {}, {
    deep: true
});