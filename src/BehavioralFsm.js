var postHandlerActions = function(fsm, client, evnt) {
    var clientMeta = fsm.getClientMeta(client);
    fsm.emit(HANDLED, evnt);
    clientMeta.priorAction = clientMeta.currentAction;
    clientMeta.currentAction = "";
    BehavioralFsm.prototype.processQueue.call(fsm, clientMeta.id, NEXT_HANDLER);
};

var handleExitActions = function(fsm, client) {
    var clientMeta = fsm.getClientMeta(client);
    var curState = clientMeta.state;
    if (fsm.states[curState] && fsm.states[curState]._onExit) {
        fsm.inExitHandler = true;
        fsm.states[curState]._onExit.call(fsm, client, clientMeta);
        fsm.inExitHandler = false;
    }
};

var handleEntryActions = function(fsm, client, newState) {
    var clientMeta = fsm.getClientMeta(client);
    if (fsm.states[newState]._onEnter) {
        fsm.states[newState]._onEnter.call(fsm, client, clientMeta);
    }

    if (clientMeta.targetReplayState === newState) {
        // should processQueue take either id OR client instance?
        BehavioralFsm.prototype.processQueue.call(fsm, clientMeta.id, NEXT_TRANSITION);
    }
};

var updateClientStateInfo = function(fsm, client, newState) {
    var clientMeta = fsm.getClientMeta(client);
    clientMeta.targetReplayState = newState;
    clientMeta.priorState = clientMeta.state;
    clientMeta.state = newState;
    fsm.emit(TRANSITION, {
        clientId: clientMeta.id,
        fromState: clientMeta.priorState,
        action: clientMeta.currentAction,
        toState: newState
    });
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
    var clientMeta = fsm.getClientMeta(client);
    var states = fsm.states;
    var current = clientMeta.state;
    var handlerName = states[current][inputType] ? inputType : "*";
    var meta;
    if (states[current][inputType] || states[current]["*"] || fsm["*"]) {
        meta = {
            inputType: inputType,
            name: handlerName,
            catchAll: handlerName === "*",
            handler: states[current][handlerName] || fsm["*"],
            action: states[current][handlerName] ? handlerName : "*"
        };
    } else {
        notifyNoHandler(fsm, clientMeta.id, inputType, current);
    }
    return meta;
};

var invokeHandler = function(fsm, client, args, meta) {
    var states = fsm.states;
    var state;
    var nextState = typeof meta.handler === "string" ? meta.handler : undefined;
    var clientMeta = fsm.getClientMeta(client);
    clientMeta.currentAction = meta.action;
    fsm.emit(HANDLING, {
        clientId: clientMeta.id,
        inputType: meta.inputType,
        args: args.slice(1)
    });
    if (typeof meta.handler === "function") {
        var handlerArgs = (meta.catchAll ? args.slice(1) : args.slice(2)).concat([client, clientMeta]);
        clientMeta.currentActionArgs = args;
        var oldDfrTrans = fsm.deferUntilTransition;
        var oldDfrHndlr = fsm.deferUntilNextHandler;
        fsm.deferUntilTransition = clientMeta.deferUntilTransition;
        fsm.deferUntilNextHandler = clientMeta.deferUntilNextHandler;
        nextState = meta.handler.apply(fsm, handlerArgs);
        fsm.deferUntilTransition = oldDfrTrans;
        fsm.deferUntilNextHandler = oldDfrHndlr;
        clientMeta.currentActionArgs = undefined;
    }

    if (nextState) {
        BehavioralFsm.prototype.transition.call(fsm, clientMeta.id, nextState);
    }
};

BehavioralFsm = function(options) {
    _.merge(this, options);
    _.defaults(this, utils.getDefaultOptions());
    this.initialize.apply(this, arguments);
    machina.emit(NEW_FSM, this);
};

_.extend(BehavioralFsm.prototype, {

    initialize: function() {},

    getClient: function(id) {
        throw new Error("You need to tell this FSM how to get a client instance by providing a getClient implementation.");
    },

    getClientMeta: function(client) {
        return client.__machina ? client.__machina : (client.__machina = {});
    },

    register: function(id, client) {
        var meta = this.getClientMeta(client);
        meta = _.defaults(
            this.getClientMeta(client), {
                deferUntilTransition: this.deferUntilTransition.bind(this, id),
                deferUntilNextHandler: this.deferUntilNextHandler.bind(this, id),
                id: id
            },
            utils.getDefaultClientMeta()
        );
        if (this.initialState && !meta.state) {
            BehavioralFsm.prototype.transition.call(this, id, this.initialState);
        }
    },

    start: function(id) {
        this.register(id, this.getClient(id));
    },

    handle: function(id, inputType) {
        var client = this.getClient(id);
        var args = slice.call(arguments, 0);
        var clientMeta = this.getClientMeta(client);
        var handlerMeta;
        if (!client) {
            throw new Error("Could not find client id: " + id + ".");
        }
        if (!clientMeta || (clientMeta && !clientMeta.registered)) {
            this.register(id, client);
        }
        if (!clientMeta.inExitHandler && (handlerMeta = getHandlerMeta(this, inputType, client))) {
            invokeHandler(this, client, args, handlerMeta);
            postHandlerActions(this, client, {
                clientId: id,
                inputType: inputType,
                args: args.slice(2)
            });
        }
    },

    transition: function(id, newState) {
        var client = this.getClient(id);
        var clientMeta = this.getClientMeta(client);
        var info;
        if (!client) {
            throw new Error("Could not find client id: " + id + ".");
        }
        if (!clientMeta.registered) {
            this.register(id, client);
        }
        var curState = clientMeta.state;
        if (!clientMeta.inExitHandler && newState !== clientMeta.state) {
            if (this.states[newState]) {
                handleExitActions(this, client);
                updateClientStateInfo(this, client, newState);
                handleEntryActions(this, client, newState);
            } else {
                info = {
                    state: clientMeta.state,
                    attemptedState: newState
                };
                this.emit.call(this, INVALID_STATE, info);
            }
        }
    },

    processQueue: function(id, type) {
        var client = this.getClient(id);
        var clientMeta = this.getClientMeta(client);
        var filterFn = type === NEXT_TRANSITION ? function(item) {
                return item.type === NEXT_TRANSITION && ((!item.untilState) || (item.untilState === clientMeta.state));
            } : function(item) {
                return item.type === NEXT_HANDLER;
            };
        var toProcess = _.filter(clientMeta.inputQueue, filterFn);
        clientMeta.inputQueue = _.difference(clientMeta.inputQueue, toProcess);
        _.each(toProcess, function(item) {
            BehavioralFsm.prototype.handle.apply(this, item.args);
        }, this);
    },

    clearQueue: function(id, type, name) {
        var client = (typeof id !== "object") ? this.getClient(id) : id;
        var clientMeta = this.getClientMeta(client);
        if (!type) {
            clientMeta.inputQueue = [];
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
            clientMeta.inputQueue = _.filter(clientMeta.inputQueue, filter);
        }
    },

    deferUntilTransition: function(id, stateName) {
        var client = this.getClient(id);
        var clientMeta = this.getClientMeta(client);
        var queued = {
            type: NEXT_TRANSITION,
            untilState: stateName,
            args: clientMeta.currentActionArgs
        };
        clientMeta.inputQueue.push(queued);
        this.emit(DEFERRED, {
            clientId: clientMeta.id,
            state: clientMeta.state,
            queuedArgs: queued
        });
    },

    deferUntilNextHandler: function(id) {
        var client = this.getClient(id);
        var clientMeta = this.getClientMeta(client);
        if (clientMeta.currentActionArgs) {
            var queued = {
                type: NEXT_HANDLER,
                args: clientMeta.currentActionArgs
            };
            clientMeta.inputQueue.push(queued);
            this.emit(DEFERRED, {
                state: clientMeta.state,
                queuedArgs: queued
            });
        }
    }
});

riveter(BehavioralFsm);

BehavioralFsm.inherits(Monologue);