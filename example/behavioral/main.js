var app = (function() {
    var store = {
        "123": {},
        ABC: {}
    };

    var x = new machina.BehavioralFsm({

        getClient: function(id) {
            return store[id];
        },

        states: {
            "uninitialized": {
                _onEnter: function(state) {
                    console.log("'uninitialized' entry action fired for " + state.__machina.id + ".");
                    state.unInitEntryActionHandler = true;
                },

                "initialize": function(payload, state) {
                    console.log("handled an 'initialize' event for " + state.__machina.id + ".");
                    state.initInputHandler = true;
                },

                "started": "ready",

                "deferredThingy": function(a, b, state) {
                    console.log("deferring for " + state.__machina.id + ".");
                    this.deferUntilTransition();
                },

                _onExit: function(state) {
                    console.log("Uninitialized exit action fired for " + state.__machina.id + ".");
                    state.unInitExitActionHandler = true;
                }
            },

            "ready": {
                _onEnter: function(state) {
                    console.log("'ready' entry action fired for " + state.__machina.id + ".");
                    state.readyEntryActionHandler = true;
                },
                "*": function(payload, state) {
                    state.payloads = state.payloads || [];
                    state.payloads.push(payload);
                },
                "deferredThingy": function(a, b, state) {
                    console.log("Replaying deferred event. Args are: " + a + " and " + b + " (for " + state.__machina.id + ".)");
                }
            }
        }
    });

    x.on("#", function(d, e) {
        $("#" + d.clientId).append("<div><pre>" + JSON.stringify(e, null, 2) + "</pre></div>");
    });

    return {
        fsm: x,
        store: store,
        doThis: function() {
            x.handle("123", "initialize", "blah");
            x.handle("ABC", "deferredThingy", "bacon", "eggs");
            x.handle("ABC", "deferredThingy", "milk", "toast");
            x.handle("ABC", "deferredThingy", "dumb", "dumber");
            x.handle("123", "started");
            x.handle("ABC", "started");
        }
    };
}());

app.doThis();