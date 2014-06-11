var app = (function() {
    var x = new machina.BehavioralFsm({
        states: {
            "uninitialized": {
                _onEnter: function(state, client) {
                    console.log("'uninitialized' entry action fired for " + client.id + ".");
                    state.unInitEntryActionHandler = true;
                },

                "initialize": function(payload, state, client) {
                    console.log("handled an 'initialize' event for " + client.id + ".");
                    state.initInputHandler = true;
                },

                "started": "ready",

                "deferredThingy": function(a, b, state, client) {
                    console.log("deferring for " + client.id + ".");
                    client.deferUntilTransition();
                },

                _onExit: function(state, client) {
                    console.log("Uninitialized exit action fired for " + client.id + ".");
                    state.unInitExitActionHandler = true;
                }
            },

            "ready": {
                _onEnter: function(state, client) {
                    console.log("'ready' entry action fired for " + client.id + ".");
                    state.readyEntryActionHandler = true;
                },
                "*": function(payload, state, client) {
                    state.payloads = state.payloads || [];
                    state.payloads.push(payload);
                },
                "deferredThingy": function(a, b, state, client) {
                    console.log("Replaying deferred event. Args are: " + a + " and " + b + " (for " + client.id + ".)");
                }
            }
        }
    });

    var stateA = {};
    var stateB = {};

    x.register("123", function() {
        return stateA;
    });

    x.register("ABC", function() {
        return stateB;
    });

    x.on("#", function(d, e) {
        $("#" + d.clientId).append("<div><pre>" + JSON.stringify(e, null, 2) + "</pre></div>");
    });

    return {
        fsm: x,
        clientState: {
            a: stateA,
            b: stateB
        },
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