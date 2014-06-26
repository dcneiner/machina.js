var Async = Functional.extend({

    handle: function(id) {
        var args = slice.call(arguments, 1);
        var self = this;
        self.getClient(id, function(client) {
            Functional.prototype.handle.apply(self, [self].concat(args));
        });
    },

    transition: function(id) {
        var args = slice.call(arguments, 1);
        var self = this;
        self.getClient(id, function(client) {
            Functional.prototype.transition.apply(self, [self].concat(args));
        });
    },

    // TODO: need to emit registration as event?
    register: function(id) {
        var self = this;
        self.getClient(id, function(client) {
            Functional.prototype.register.call(self, self);
        });
    },

    deferUntilTransition: function() {
        throw new Error("Async/Remote FSMs do not support deferred input(s). Sorry.");
    },

    deferUntilNextHandler: function() {
        throw new Error("Async/Remote FSMs do not support deferred input(s). Sorry.");
    },

    processQueue: function() {
        // no-op
    },

    clearQueue: function() {
        // no-op
    }
});