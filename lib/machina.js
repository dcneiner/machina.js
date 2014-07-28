/**
 * machina - A library for creating powerful and flexible finite state machines.  Loosely inspired by Erlang/OTP's gen_fsm behavior.
 * Author: Jim Cowart (http://freshbrewedcode.com/jimcowart)
 * Version: v0.3.8
 * Url: http://machina-js.org/
 * License(s): MIT, GPL
 */

(function (root, factory) {
    if (typeof define === "function" && define.amd) {
        // AMD. Register as an anonymous module.
        define(["lodash", "monologue", "riveter"], function (_, Monologue, riveter) {
            return factory(_, Monologue, riveter, root);
        });
    } else if (typeof module === "object" && module.exports) {
        // Node, or CommonJS-Like environments
        module.exports = factory(require("lodash"), require("monologue.js"), require("riveter"));
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
    var REGISTERED = "registered";
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
    var handleExitActions = function (fsm, client) {
        var meta = fsm.getClientMeta(client);
        var curState = meta.state;
        if (fsm.states[curState] && fsm.states[curState]._onExit) {
            fsm.inExitHandler = true;
            fsm.states[curState]._onExit.call(fsm, client, meta);
            fsm.inExitHandler = false;
        }
    };

    var updateClientStateInfo = function (fsm, client, newState) {
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

    var handleEntryActions = function (fsm, client, newState) {
        var meta = fsm.getClientMeta(client);
        if (fsm.states[newState]._onEnter) {
            fsm.states[newState]._onEnter.call(fsm, client, meta);
        }
        if (meta.targetReplayState === newState) {
            fsm.processQueue(client, NEXT_TRANSITION);
        }
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

    var invokeHandler = function (fsm, client, args, handlerMeta) {
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

    var postHandlerActions = function (fsm, client, evnt) {
        var meta = fsm.getClientMeta(client);
        fsm.emit(HANDLED, evnt);
        meta.priorAction = meta.currentAction;
        meta.currentAction = "";
        fsm.processQueue(client, NEXT_HANDLER);
    };

    var Functional = function (options) {
        options = options || {};
        // events legacy compatibility.
        // Might be removing this soon.
        var listeners = options.eventListeners || {};
        _.each(listeners, function (callbacks, topic) {
            callbacks = _.isArray(callbacks) ? callbacks : [callbacks];
            _.each(callbacks, function (cb) {
                this.on(topic, cb).withContext(this);
            }, this);
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
        initialize: function () {},

        getClientMeta: function (client) {
            return client.__machina ? client.__machina : (client.__machina = {});
        },

        getClientId: function (client) {
            return client.namespace;
        },

        getHandlerArgs: function (args) {
            // by default handlers take the client
            // as the first arg, followed by
            // any remaining arguments, so we will
            // remove the inputType arg from what
            // gets passed to the input handler
            return [args[0]].concat(slice.call(args, 2));
        },

        register: function (client) {
            var meta = this.getClientMeta(client);
            meta = _.defaults(
            this.getClientMeta(client), utils.getDefaultClientMeta(), {
                id: this.getClientId(client)
            });
            this.emit(REGISTERED, meta);
            if (!meta.state && this.initialState) {
                this.transition(this.initialState, client);
            }
        },

        transition: function (client, newState) {
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

        handle: function (client, inputType) {
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

        deferUntilTransition: function (client, stateName) {
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

        deferUntilNextHandler: function (client) {
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

        processQueue: function (client, type) {
            var meta = this.getClientMeta(client);
            var filterFn = type === NEXT_TRANSITION ?
            function (item) {
                return item.type === NEXT_TRANSITION && ((!item.untilState) || (item.untilState === meta.state));
            } : function (item) {
                return item.type === NEXT_HANDLER;
            };
            var toProcess = _.filter(meta.inputQueue, filterFn);
            meta.inputQueue = _.difference(meta.inputQueue, toProcess);
            _.each(toProcess, function (item) {
                console.log("Processing Item: " + item.args[1]);
                this.handle.apply(this, item.args);
            }, this);
        },

        clearQueue: function (client, type, name) {
            var meta = this.getClientMeta(client);
            if (!type) {
                meta.inputQueue = [];
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
                meta.inputQueue = _.filter(meta.inputQueue, filter);
            }
        }
    });

    riveter(Functional);

    Functional.inherits(Monologue);
    var Fsm = Functional.extend({
        constructor: function () {
            Fsm.prototype.constructor.__super.apply(this, arguments);
            this.register();
        },

        getHandlerArgs: function (args) {
            // The 'classic' machina.Fsm does NOT
            // pass the `client` argument to input
            // handlers.
            return slice.call(args, 2);
        },

        handle: function () {
            var args = slice.call(arguments, 0);
            return Functional.prototype.handle.apply(
            this, (args[0] === this) ? args : [this].concat(args));
        },

        transition: function (newState) {
            var args = slice.call(arguments, 0);
            return Functional.prototype.transition.apply(
            this, (args[0] === this) ? args : [this].concat(args));
        },

        register: function () {
            return Functional.prototype.register.call(this, this);
        },

        getClient: function (id) {
            return this;
        },

        getClientMeta: function () {
            return this;
        }
    }, {}, {
        deep: true
    });
    var Async = Functional.extend({

        handle: function (id) {
            var args = slice.call(arguments, 1);
            var self = this;
            self.getClient(id, function (client) {
                Functional.prototype.handle.apply(self, [self].concat(args));
            });
        },

        transition: function (id) {
            var args = slice.call(arguments, 1);
            var self = this;
            self.getClient(id, function (client) {
                Functional.prototype.transition.apply(self, [self].concat(args));
            });
        },

        // TODO: need to emit registration as event?
        register: function (id) {
            var self = this;
            self.getClient(id, function (client) {
                Functional.prototype.register.call(self, self);
            });
        },

        deferUntilTransition: function () {
            throw new Error("Async/Remote FSMs do not support deferred input(s). Sorry.");
        },

        deferUntilNextHandler: function () {
            throw new Error("Async/Remote FSMs do not support deferred input(s). Sorry.");
        },

        processQueue: function () {
            // no-op
        },

        clearQueue: function () {
            // no-op
        }
    });
    var machina = _.extend({

        Functional: Functional,

        Fsm: Fsm,

        Async: Async,

        utils: utils

    }, Monologue.prototype);
    return machina;
}));