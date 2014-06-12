/**
 * machina - A library for creating powerful and flexible finite state machines.  Loosely inspired by Erlang/OTP's gen_fsm behavior.
 * Author: Jim Cowart (http://freshbrewedcode.com/jimcowart)
 * Version: v0.4.0-rc1
 * Url: http://machina-js.org/
 * License(s): MIT, GPL
 */

(function (root, factory) {
    if (typeof module === "object" && module.exports) {
        // Node, or CommonJS-Like environments
        module.exports = function () {
            return factory(require("lodash"), require("monologue.js"), require("riveter"));
        };
    } else if (typeof define === "function" && define.amd) {
        // AMD. Register as an anonymous module.
        define(["lodash", "monologue", "riveter"], function (_, Monologue, riveter) {
            return factory(_, Monologue, riveter, root);
        });
    } else {
        // Browser globals
        root.machina = factory(root._, root.Monologue, root.riveter, root);
    }
}(this, function (_, Monologue, riveter, global, undefined) {
    var slice = [].slice;
    var NEXT_TRANSITION = "transition";
    var NEXT_HANDLER = "handler";
    var HANDLING = "handling";
    var HANDLED = "handled";
    var NO_HANDLER = "nohandler";
    var TRANSITION = "transition";
    var INVALID_STATE = "invalidstate";
    var DEFERRED = "deferred";
    var NEW_FSM = "newfsm";
    var utils = {
        makeFsmNamespace: (function () {
            var machinaCount = 0;
            return function () {
                return "fsm." + machinaCount++;
            };
        })(),
        getDefaultOptions: function () {
            return {
                initialState: "uninitialized",
                states: {},
                namespace: utils.makeFsmNamespace()
            };
        },
        getDefaultClientMeta: function () {
            return {
                currentAction: undefined,
                currentActionArgs: undefined,
                inExitHandler: false,
                inputQueue: [],
                priorState: undefined,
                priorAction: undefined,
                state: undefined,
                targetReplayState: undefined,
                registered: true
            };
        }
    };
    var postHandlerActions = function (fsm, client, evnt) {
        fsm.emit(HANDLED, evnt);
        client.__machina.priorAction = client.__machina.currentAction;
        client.__machina.currentAction = "";
        BehavioralFsm.prototype.processQueue.call(fsm, client.__machina.id, NEXT_HANDLER);
    };

    var handleExitActions = function (fsm, client) {
        var curState = client.__machina.state;
        if (fsm.states[curState] && fsm.states[curState]._onExit) {
            fsm.inExitHandler = true;
            fsm.states[curState]._onExit.call(fsm, client);
            fsm.inExitHandler = false;
        }
    };

    var handleEntryActions = function (fsm, client, newState) {
        if (fsm.states[newState]._onEnter) {
            fsm.states[newState]._onEnter.call(fsm, client);
        }

        if (client.__machina.targetReplayState === newState) {
            // should processQueue take either id OR client instance?
            BehavioralFsm.prototype.processQueue.call(fsm, client.__machina.id, NEXT_TRANSITION);
        }
    };

    var updateClientStateInfo = function (fsm, client, newState) {
        client.__machina.targetReplayState = newState;
        client.__machina.priorState = client.__machina.state;
        client.__machina.state = newState;
        fsm.emit(TRANSITION, {
            clientId: client.__machina.id,
            fromState: client.__machina.priorState,
            action: client.__machina.currentAction,
            toState: newState
        });
    };

    var notifyNoHandler = function (fsm, clientId, inputType, state) {
        var info = {
            state: state,
            clientId: clientId,
            inputType: inputType,
            type: NO_HANDLER
        };
        fsm.emit(NO_HANDLER, info);
    };

    var getHandlerMeta = function (fsm, inputType, client) {
        var states = fsm.states;
        var current = client.__machina.state;
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
            notifyNoHandler(fsm, client.__machina.id, inputType, current);
        }
        return meta;
    };

    var invokeHandler = function (fsm, client, args, meta) {
        var states = fsm.states;
        var state;
        var nextState = typeof meta.handler === "string" ? meta.handler : undefined;
        client.__machina.currentAction = meta.action;
        fsm.emit(HANDLING, {
            clientId: client.__machina.id,
            inputType: meta.inputType,
            args: args.slice(1)
        });
        if (typeof meta.handler === "function") {
            var handlerArgs = (meta.catchAll ? args.slice(1) : args.slice(2)).concat([client]);
            client.__machina.currentActionArgs = args;
            var oldDfrTrans = fsm.deferUntilTransition;
            var oldDfrHndlr = fsm.deferUntilNextHandler;
            fsm.deferUntilTransition = client.__machina.deferUntilTransition;
            fsm.deferUntilNextHandler = client.__machina.deferUntilNextHandler;
            nextState = meta.handler.apply(fsm, handlerArgs);
            fsm.deferUntilTransition = oldDfrTrans;
            fsm.deferUntilNextHandler = oldDfrHndlr;
            client.__machina.currentActionArgs = undefined;
        }

        if (nextState) {
            BehavioralFsm.prototype.transition.call(fsm, client.__machina.id, nextState);
        }
    };

    BehavioralFsm = function (options) {
        _.merge(this, options);
        _.defaults(this, utils.getDefaultOptions());
        this.initialize.apply(this, arguments);
        machina.emit(NEW_FSM, this);
    };

    _.extend(BehavioralFsm.prototype, {

        initialize: function () {},

        getClient: function (id) {
            throw new Error("You need to tell this FSM how to get a client instance by providing a getClient implementation.");
        },

        getClientMeta: function (client) {
            return client.__machina ? client.__machina : (client.__machina = {});
        },

        register: function (id, client) {
            var meta = this.getClientMeta(client);
            meta = _.defaults(
            this.getClientMeta(client), {
                deferUntilTransition: this.deferUntilTransition.bind(this, id),
                deferUntilNextHandler: this.deferUntilNextHandler.bind(this, id),
                id: id
            }, utils.getDefaultClientMeta());
            if (this.initialState && !meta.state) {
                this.transition(id, this.initialState);
            }
        },

        start: function (id) {
            this.register(id, this.getClient(id));
        },

        handle: function (id, inputType) {
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

        transition: function (id, newState) {
            var client = this.getClient(id);
            var info;
            if (!client) {
                throw new Error("Could not find client id: " + id + ".");
            }
            if (!client.__machina || (client.__machina && !client.__machina.registered)) {
                this.register(id, client);
            }
            var curState = client.__machina.state;
            if (!client.__machina.inExitHandler && newState !== client.__machina.state) {
                if (this.states[newState]) {
                    handleExitActions(this, client);
                    updateClientStateInfo(this, client, newState);
                    handleEntryActions(this, client, newState);
                } else {
                    info = {
                        state: client.__machina.state,
                        attemptedState: newState
                    };
                    this.emit.call(this, INVALID_STATE, info);
                }
            }
        },

        processQueue: function (id, type) {
            var client = this.getClient(id);
            var filterFn = type === NEXT_TRANSITION ?
            function (item) {
                return item.type === NEXT_TRANSITION && ((!item.untilState) || (item.untilState === client.__machina.state));
            } : function (item) {
                return item.type === NEXT_HANDLER;
            };
            var toProcess = _.filter(client.__machina.inputQueue, filterFn);
            client.__machina.inputQueue = _.difference(client.__machina.inputQueue, toProcess);
            _.each(toProcess, function (item) {
                BehavioralFsm.prototype.handle.apply(this, item.args);
            }, this);
        },

        clearQueue: function (id, type, name) {
            var client = (typeof id !== "object") ? this.getClient(id) : id;
            if (!type) {
                client.__machina.inputQueue = [];
            } else {
                var filter;
                if (type === NEXT_TRANSITION) {
                    filter = function (evnt) {
                        return (evnt.type === NEXT_TRANSITION && (name ? evnt.untilState === name : true));
                    };
                } else if (type === NEXT_HANDLER) {
                    filter = function (evnt) {
                        return evnt.type === NEXT_HANDLER;
                    };
                }
                client.__machina.inputQueue = _.filter(client.__machina.inputQueue, filter);
            }
        },

        deferUntilTransition: function (id, stateName) {
            var client = this.getClient(id);
            var queued = {
                type: NEXT_TRANSITION,
                untilState: stateName,
                args: client.__machina.currentActionArgs
            };
            client.__machina.inputQueue.push(queued);
            this.emit(DEFERRED, {
                clientId: client.__machina.id,
                state: client.__machina.state,
                queuedArgs: queued
            });
        },

        deferUntilNextHandler: function (id) {
            var client = this.getClient(id);
            if (client.__machina.currentActionArgs) {
                var queued = {
                    type: NEXT_HANDLER,
                    args: client.__machina.currentActionArgs
                };
                client.__machina.inputQueue.push(queued);
                this.emit(DEFERRED, {
                    state: client.__machina.state,
                    queuedArgs: queued
                });
            }
        }
    });

    riveter(BehavioralFsm);

    BehavioralFsm.inherits(Monologue);
    var Fsm = BehavioralFsm.extend({
        constructor: function (name, title, salary, shouldExpectFbiRaid) {
            Fsm.prototype.constructor.__super.apply(this, arguments);

            var id = this.namespace;

            this.__machina = this;

            // need to curry id into prototype method calls
            // as instance level methods since this is a 
            // one-client FSM like pre v0.4 machina
            _.each(["handle", "transition", "processQueue", "clearQueue", "deferUntilTransition", "deferUntilNextHandler"], function (method) {
                this[method] = this[method].bind(this, id);
            }, this);

            if (this.initialState) {
                this.transition(this.initialState);
            }

        },

        getClient: function (id) {
            return this;
        }
    }, {}, {
        deep: true
    });
    var machina = _.extend({

        BehavioralFsm: BehavioralFsm,

        Fsm: Fsm,

        utils: utils

    }, Monologue.prototype);
    return machina;
}));