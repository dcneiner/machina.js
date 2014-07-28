var Fsm = Functional.extend({
    constructor: function() {
        Fsm.prototype.constructor.__super.apply(this, arguments);
        this.register();
    },

    getHandlerArgs: function(args) {
        // The 'classic' machina.Fsm does NOT
        // pass the `client` argument to input
        // handlers.
        return slice.call(args, 2);
    },

    handle: function() {
        var args = slice.call(arguments, 0);
        return Functional.prototype.handle.apply(
            this, (args[0] === this) ? args : [this].concat(args)
        );
    },

    transition: function(newState) {
        var args = slice.call(arguments, 0);
        return Functional.prototype.transition.apply(
            this, (args[0] === this) ? args : [this].concat(args)
        );
    },

    register: function() {
        return Functional.prototype.register.call(this, this);
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