var handleExitActions = function(fsm, client) {
    var meta = fsm.getClientMeta(client);
    var curState = meta.state;
    if (fsm.states[curState] && fsm.states[curState]._onExit) {
        fsm.inExitHandler = true;
        fsm.states[curState]._onExit.call(fsm, client, meta);
        fsm.inExitHandler = false;
    }
};

var updateClientStateInfo = function(fsm, client, newState) {
    var meta = fsm.getClientMeta(client);
    meta.targetReplayState = newState;
    meta.priorState = meta.state;
    meta.state = newState;
    fsm.emit(TRANSITION, {
        clientId: meta.id,
        fromState: meta.priorState,
        action: meta.currentAction,
        toState: newState
    });
};

var handleEntryActions = function(fsm, client, newState) {
    var meta = fsm.getClientMeta(client);
    if (fsm.states[newState]._onEnter) {
        fsm.states[newState]._onEnter.call(fsm, client, meta);
    }
    if (meta.targetReplayState === newState) {
        fsm.processQueue(client, NEXT_TRANSITION);
    }
};

var notifyNoHandler = function(fsm, clientId, inputType, state) {
    var info = {
        state: state,
        clientId: clientId,
        inputType: inputType,
        type: NO_HANDLER
    };
    fsm.emit(NO_HANDLER, info);
};

var getHandlerMeta = function(fsm, inputType, client) {
    var meta = fsm.getClientMeta(client);
    var states = fsm.states;
    var current = meta.state;
    var handlerName = states[current][inputType] ? inputType : "*";
    var handlerMeta;
    if (states[current][inputType] || states[current]["*"] || fsm["*"]) {
        handlerMeta = {
            inputType: inputType,
            name: handlerName,
            catchAll: handlerName === "*",
            handler: states[current][handlerName] || fsm["*"],
            action: states[current][handlerName] ? handlerName : "*"
        };
    } else {
        notifyNoHandler(fsm, meta.id, inputType, current);
    }
    return handlerMeta;
};

var invokeHandler = function(fsm, client, args, handlerMeta) {
    var states = fsm.states;
    var state;
    var nextState = typeof handlerMeta.handler === "string" ? handlerMeta.handler : undefined;
    var meta = fsm.getClientMeta(client);
    meta.currentAction = handlerMeta.action;
    fsm.emit(HANDLING, {
        clientId: meta.id,
        inputType: handlerMeta.inputType
    });
    if (typeof handlerMeta.handler === "function") {
        var handlerArgs = fsm.getHandlerArgs(args);
        handlerArgs = (handlerMeta.catchAll ? handlerArgs.slice(1) : handlerArgs.slice(2)).concat([client, meta]);
        meta.currentActionArgs = args;
        nextState = handlerMeta.handler.apply(fsm, handlerArgs);
        meta.currentActionArgs = undefined;
    }

    if (nextState) {
        fsm.transition(client, nextState);
    }
};

var postHandlerActions = function(fsm, client, evnt) {
    var meta = fsm.getClientMeta(client);
    fsm.emit(HANDLED, evnt);
    meta.priorAction = meta.currentAction;
    meta.currentAction = "";
    fsm.processQueue(client, NEXT_HANDLER);
};

var Functional = function(options) {
    options = options || {};
    // events legacy compatibility.
    // Might be removing this soon.
    var listeners = options.eventListeners || {};
    _.each(listeners, function(listener, topic) {
        this.on(topic, listener).withContext(this);
    }, this);
    // Drawing the line on backwards compat, though.
    // Monologue is the emitter now. I'm not
    // extending this prop over the instance any more.
    delete options.eventListeners;
    _.merge(this, options);
    _.defaults(this, utils.getDefaultOptions());
    this.initialize.apply(this, arguments);
    machina.emit(NEW_FSM, this);
};

_.extend(Functional.prototype, {
    initialize: function() {},

    getClientMeta: function(client) {
        return client.__machina ? client.__machina : (client.__machina = {});
    },

    getClientId: function(client) {
        return client.namespace;
    },

    getHandlerArgs: function(args) {
        // by default handlers take the client
        // as the first arg, followed by
        // any remaining arguments, so we will
        // remove the inputType arg from what
        // gets passed to the input handler
        return [args[0]].concat(slice.call(args, 2));
    },

    register: function(client) {
        var meta = this.getClientMeta(client);
        meta = _.defaults(
            this.getClientMeta(client),
            utils.getDefaultClientMeta(), {
                id: this.getClientId(client)
            }
        );
        this.emit(REGISTERED, meta);
        if (!meta.state && this.initialState) {
            this.transition(this.initialState, client);
        }
    },

    transition: function(client, newState) {
        var meta = this.getClientMeta(client);
        if (!meta.registered) {
            this.register(client);
        }
        var curState = meta.state;
        if (!meta.inExitHandler && newState !== meta.state) {
            if (this.states[newState]) {
                handleExitActions(this, client);
                updateClientStateInfo(this, client, newState);
                handleEntryActions(this, client, newState);
            } else {
                info = {
                    clientId: meta.id,
                    state: meta.state,
                    attemptedState: newState
                };
                this.emit(INVALID_STATE, info);
            }
        }
    },

    handle: function(client, inputType) {
        var args = slice.call(arguments, 0);
        var meta = this.getClientMeta(client);
        var handlerMeta;
        if (!meta.registered) {
            this.register(client);
        }
        if (!meta.inExitHandler && (handlerMeta = getHandlerMeta(this, inputType, client))) {
            invokeHandler(this, client, args, handlerMeta);
            postHandlerActions(this, client, {
                clientId: meta.id,
                inputType: inputType
            });
        }
    },

    deferUntilTransition: function(client, stateName) {
        var meta = this.getClientMeta(client);
        var queued = {
            type: NEXT_TRANSITION,
            untilState: stateName,
            args: meta.currentActionArgs
        };
        meta.inputQueue.push(queued);
        this.emit(DEFERRED, {
            clientId: meta.id,
            state: meta.state,
            inputType: meta.currentAction
        });
    },

    deferUntilNextHandler: function(client) {
        var meta = this.getClientMeta(client);
        if (meta.currentActionArgs) {
            var queued = {
                type: NEXT_HANDLER,
                args: meta.currentActionArgs
            };
            meta.inputQueue.push(queued);
            this.emit(DEFERRED, {
                clientId: meta.id,
                state: meta.state,
                inputType: meta.currentAction
            });
        }
    },

    processQueue: function(client, type) {
        var meta = this.getClientMeta(client);
        var filterFn = type === NEXT_TRANSITION ? function(item) {
                return item.type === NEXT_TRANSITION && ((!item.untilState) || (item.untilState === meta.state));
            } : function(item) {
                return item.type === NEXT_HANDLER;
            };
        var toProcess = _.filter(meta.inputQueue, filterFn);
        meta.inputQueue = _.difference(meta.inputQueue, toProcess);
        _.each(toProcess, function(item) {
            console.log("Processing Item: " + item.args[1]);
            this.handle.apply(this, item.args);
        }, this);
    },

    clearQueue: function(client, type, name) {
        var meta = this.getClientMeta(client);
        if (!type) {
            meta.inputQueue = [];
        } else {
            var filter;
            if (type === NEXT_TRANSITION) {
                filter = function(evnt) {
                    return (evnt.type === NEXT_TRANSITION && (name ? evnt.untilState === name : true));
                };
            } else if (type === NEXT_HANDLER) {
                filter = function(evnt) {
                    return evnt.type === NEXT_HANDLER;
                };
            }
            meta.inputQueue = _.filter(meta.inputQueue, filter);
        }
    }
});

riveter(Functional);

Functional.inherits(Monologue);