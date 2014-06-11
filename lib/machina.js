/**
 * machina - A library for creating powerful and flexible finite state machines.  Loosely inspired by Erlang/OTP's gen_fsm behavior.
 * Author: Jim Cowart (http://freshbrewedcode.com/jimcowart)
 * Version: v0.3.6
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
                targetReplayState: undefined
            };
        }
    };
    var postHandlerActions = function (fsm, client, evnt) {
        fsm.emit(HANDLED, evnt);
        client.priorAction = client.currentAction;
        client.currentAction = "";
        BehavioralFsm.prototype.processQueue.call(fsm, client.id, NEXT_HANDLER);
    };

    var handleExitActions = function (fsm, client) {
        var curState = client.state;
        if (fsm.states[curState] && fsm.states[curState]._onExit) {
            fsm.inExitHandler = true;
            fsm.states[curState]._onExit.call(fsm, client.getState(), client);
            fsm.inExitHandler = false;
        }
    };

    var handleEntryActions = function (fsm, client, newState) {
        if (fsm.states[newState]._onEnter) {
            fsm.states[newState]._onEnter.call(fsm, client.getState(), client);
        }

        if (client.targetReplayState === newState) {
            // should processQueue take either id OR client instance?
            BehavioralFsm.prototype.processQueue.call(fsm, client.id, NEXT_TRANSITION);
        }
    };

    var updateClientStateInfo = function (fsm, client, newState) {
        client.targetReplayState = newState;
        client.priorState = client.state;
        client.state = newState;
        fsm.emit(TRANSITION, {
            clientId: client.id,
            fromState: client.priorState,
            action: client.currentAction,
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
        var current = client.state;
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
            notifyNoHandler(fsm, client.id, inputType, current);
        }
        return meta;
    };

    var invokeHandler = function (fsm, client, args, meta) {
        var states = fsm.states;
        var state;
        var nextState = typeof meta.handler === "string" ? meta.handler : undefined;
        client.currentAction = meta.action;
        fsm.emit(HANDLING, {
            clientId: client.id,
            inputType: meta.inputType,
            args: args.slice(1)
        });
        if (typeof meta.handler === "function") {
            state = client.getState();
            var handlerArgs = (meta.catchAll ? args.slice(1) : args.slice(2)).concat([state, client]);
            client.currentActionArgs = args;
            nextState = meta.handler.apply(fsm, handlerArgs);
            client.currentActionArgs = undefined;
        }

        if (nextState) {
            BehavioralFsm.prototype.transition.call(fsm, client.id, nextState);
        }
    };

    BehavioralFsm = function (options) {
        _.extend(this, {
            clients: {}
        }, options);
        _.defaults(this, utils.getDefaultOptions());
        this.initialize.apply(this, arguments);
        machina.emit(NEW_FSM, this);
    };

    _.extend(BehavioralFsm.prototype, {
        initialize: function () {},

        register: function (id, accessor, options) {
            options = options || {};
            var _accessor = (typeof accessor === "function") ? accessor : function () {
                return accessor;
            };
            var client;
            if (!this.clients[id]) {
                client = this.clients[id] = _.defaults(
                options.clientMeta || {}, {
                    getState: _accessor,
                    deferUntilTransition: this.deferUntilTransition.bind(this, id),
                    deferUntilNextHandler: this.deferUntilNextHandler.bind(this, id),
                    id: id
                }, utils.getDefaultClientMeta());
                if (!options.doNotStart && !client.state && this.initialState) {
                    this.transition(id, this.initialState);
                }
            }
        },

        unregister: function (id) {
            delete this.clients[id];
        },

        handle: function (id, inputType) {
            var client = this.clients[id];
            var args = slice.call(arguments, 0);
            var meta;
            if (!client) {
                throw new Error("Client id: " + id + " has not been registered with this FSM.");
            }
            if (!client.inExitHandler && (meta = getHandlerMeta(this, inputType, client))) {
                invokeHandler(this, client, args, meta);
                postHandlerActions(this, client, {
                    clientId: id,
                    inputType: inputType,
                    args: args.slice(2)
                });
            }
        },

        transition: function (id, newState) {
            var client = this.clients[id];
            var curState = client.state;
            var info;
            if (!client.inExitHandler && newState !== client.state) {
                if (this.states[newState]) {
                    handleExitActions(this, client);
                    updateClientStateInfo(this, client, newState);
                    handleEntryActions(this, client, newState);
                } else {
                    info = {
                        state: this.state,
                        attemptedState: newState
                    };
                    this.emit.call(this, INVALID_STATE, info);
                }
            }
        },

        processQueue: function (id, type) {
            var client = this.clients[id];
            var filterFn = type === NEXT_TRANSITION ?
            function (item) {
                return item.type === NEXT_TRANSITION && ((!item.untilState) || (item.untilState === client.state));
            } : function (item) {
                return item.type === NEXT_HANDLER;
            };
            var toProcess = _.filter(client.inputQueue, filterFn);
            client.inputQueue = _.difference(client.inputQueue, toProcess);
            _.each(toProcess, function (item) {
                BehavioralFsm.prototype.handle.apply(this, item.args);
            }, this);
        },

        clearQueue: function (id, type, name) {
            var client = (typeof id !== "object") ? this.clients[id] : id;
            if (!type) {
                client.inputQueue = [];
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
                client.inputQueue = _.filter(client.inputQueue, filter);
            }
        },

        deferUntilTransition: function (id, stateName) {
            var client = this.clients[id];
            if (client.currentActionArgs) {
                var queued = {
                    type: NEXT_TRANSITION,
                    untilState: stateName,
                    args: client.currentActionArgs
                };
                client.inputQueue.push(queued);
                this.emit(DEFERRED, {
                    clientId: client.id,
                    state: client.state,
                    queuedArgs: queued
                });
            }
        },

        deferUntilNextHandler: function (id) {
            var client = this.clients[id];
            if (client.currentActionArgs) {
                var queued = {
                    type: NEXT_HANDLER,
                    args: client.currentActionArgs
                };
                client.inputQueue.push(queued);
                this.emit(DEFERRED, {
                    state: client.state,
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

            // We pass the FSM in as the clientMeta object
            // so that the normal FSM-related state and
            // action metadata will be present on the instance
            this.register(id, function () {
                return this;
            }, {
                clientMeta: this,
                doNotStart: true
            });

            // need to curry id into prototype method calls
            // as instance level methods since this is a 
            // one-client FSM like pre v0.4 machina
            _.each(["handle", "transition", "processQueue", "clearQueue", "deferUntilTransition", "deferUntilNextHandler"], function (method) {
                this[method] = this[method].bind(this, id);
            }, this);

            if (this.initialState) {
                this.transition(this.initialState);
            }

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