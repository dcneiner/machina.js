/**
 * machina - A library for creating powerful and flexible finite state machines.  Loosely inspired by Erlang/OTP's gen_fsm behavior.
 * Author: Jim Cowart (http://ifandelse.com)
 * Version: v0.4.0-2
 * Url: http://machina-js.org/
 * License(s): MIT, GPL
 */

(function (root, factory) {
    if (typeof define === "function" && define.amd) {
        // AMD. Register as an anonymous module.
        define(["lodash"], function (_) {
            return factory(_, root);
        });
    } else if (typeof module === "object" && module.exports) {
        // Node, or CommonJS-Like environments
        module.exports = factory(require("lodash"));
    } else {
        // Browser globals
        root.machina = factory(root._, root);
    }
}(this, function (_, global, undefined) {
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
                eventListeners: {
                    "*": []
                },
                states: {},
                eventQueue: [],
                namespace: utils.makeFsmNamespace(),
                targetReplayState: "",
                state: undefined,
                priorState: undefined,
                _priorAction: "",
                _currentAction: ""
            };
        }
    };

    if (!_.deepExtend) {
        var behavior = {
            "*": function (obj, sourcePropKey, sourcePropVal) {
                obj[sourcePropKey] = sourcePropVal;
            },
            "object": function (obj, sourcePropKey, sourcePropVal) {
                obj[sourcePropKey] = deepExtend({}, obj[sourcePropKey] || {}, sourcePropVal);
            },
            "array": function (obj, sourcePropKey, sourcePropVal) {
                obj[sourcePropKey] = [];
                _.each(sourcePropVal, function (item, idx) {
                    behavior[getHandlerName(item)](obj[sourcePropKey], idx, item);
                }, this);
            }
        },
            getActualType = function (val) {
                if (_.isArray(val)) {
                    return "array";
                }
                if (_.isDate(val)) {
                    return "date";
                }
                if (_.isRegExp(val)) {
                    return "regex";
                }
                return typeof val;
            },
            getHandlerName = function (val) {
                var propType = getActualType(val);
                return behavior[propType] ? propType : "*";
            },
            deepExtend = function (obj) {
                _.each(slice.call(arguments, 1), function (source) {
                    _.each(source, function (sourcePropVal, sourcePropKey) {
                        behavior[getHandlerName(sourcePropVal)](obj, sourcePropKey, sourcePropVal);
                    });
                });
                return obj;
            };

        _.mixin({
            deepExtend: deepExtend
        });
    }
    var Fsm = function (options) {
        _.extend(this, options);
        _.defaults(this, utils.getDefaultOptions());
        this.initialize.apply(this, arguments);
        machina.emit(NEW_FSM, this);
        if (this.initialState) {
            this.transition(this.initialState);
        }
    };

    _.extend(Fsm.prototype, {
        initialize: function () {},
        emit: function (eventName) {
            var args = arguments;
            if (this.eventListeners["*"]) {
                _.each(this.eventListeners["*"], function (callback) {
                    try {
                        callback.apply(this, slice.call(args, 0));
                    } catch (exception) {
                        if (console && typeof console.log !== "undefined") {
                            console.log(exception.toString());
                        }
                    }
                }, this);
            }
            if (this.eventListeners[eventName]) {
                _.each(this.eventListeners[eventName], function (callback) {
                    try {
                        callback.apply(this, slice.call(args, 1));
                    } catch (exception) {
                        if (console && typeof console.log !== "undefined") {
                            console.log(exception.toString());
                        }
                    }
                }, this);
            }
        },
        handle: function (inputType) {
            if (!this.inExitHandler) {
                var states = this.states,
                    current = this.state,
                    args = slice.call(arguments, 0),
                    handlerName, handler, catchAll, action;
                this.currentActionArgs = args;
                if (states[current][inputType] || states[current]["*"] || this["*"]) {
                    handlerName = states[current][inputType] ? inputType : "*";
                    catchAll = handlerName === "*";
                    if (states[current][handlerName]) {
                        handler = states[current][handlerName];
                        action = current + "." + handlerName;
                    } else {
                        handler = this["*"];
                        action = "*";
                    }
                    if (!this._currentAction) this._currentAction = action;
                    this.emit.call(this, HANDLING, {
                        inputType: inputType,
                        args: args.slice(1)
                    });
                    if (_.isFunction(handler)) handler = handler.apply(this, catchAll ? args : args.slice(1));
                    if (_.isString(handler)) this.transition(handler);
                    this.emit.call(this, HANDLED, {
                        inputType: inputType,
                        args: args.slice(1)
                    });
                    this._priorAction = this._currentAction;
                    this._currentAction = "";
                    this.processQueue(NEXT_HANDLER);
                } else {
                    this.emit.call(this, NO_HANDLER, {
                        inputType: inputType,
                        args: args.slice(1)
                    });
                }
                this.currentActionArgs = undefined;
                return handler;
            }
        },
        transition: function (newState) {
            if (!this.inExitHandler && newState !== this.state) {
                var curState = this.state;
                if (this.states[newState]) {
                    if (curState && this.states[curState] && this.states[curState]._onExit) {
                        this.inExitHandler = true;
                        this.states[curState]._onExit.call(this);
                        this.inExitHandler = false;
                    }
                    this.targetReplayState = newState;
                    this.priorState = curState;
                    this.state = newState;
                    this.emit.call(this, TRANSITION, {
                        fromState: this.priorState,
                        action: this._currentAction,
                        toState: newState
                    });
                    if (this.states[newState]._onEnter) {
                        this.states[newState]._onEnter.call(this);
                    }
                    if (this.targetReplayState === newState) {
                        this.processQueue(NEXT_TRANSITION);
                    }
                    return;
                }
                this.emit.call(this, INVALID_STATE, {
                    state: this.state,
                    attemptedState: newState
                });
            }
        },
        processQueue: function (type) {
            var filterFn = type === NEXT_TRANSITION ?
            function (item) {
                return item.type === NEXT_TRANSITION && ((!item.untilState) || (item.untilState === this.state));
            } : function (item) {
                return item.type === NEXT_HANDLER;
            };
            var toProcess = _.filter(this.eventQueue, filterFn, this);
            this.eventQueue = _.difference(this.eventQueue, toProcess);
            _.each(toProcess, function (item) {
                this.handle.apply(this, item.args);
            }, this);
        },
        clearQueue: function (type, name) {
            if (!type) {
                this.eventQueue = [];
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
                this.eventQueue = _.filter(this.eventQueue, filter);
            }
        },
        deferUntilTransition: function (stateName) {
            if (this.currentActionArgs) {
                var queued = {
                    type: NEXT_TRANSITION,
                    untilState: stateName,
                    args: this.currentActionArgs
                };
                this.eventQueue.push(queued);
                this.emit.call(this, DEFERRED, {
                    state: this.state,
                    queuedArgs: queued
                });
            }
        },
        deferUntilNextHandler: function () {
            if (this.currentActionArgs) {
                var queued = {
                    type: NEXT_HANDLER,
                    args: this.currentActionArgs
                };
                this.eventQueue.push(queued);
                this.emit.call(this, DEFERRED, {
                    state: this.state,
                    queuedArgs: queued
                });
            }
        },
        on: function (eventName, callback) {
            var self = this;
            if (!self.eventListeners[eventName]) {
                self.eventListeners[eventName] = [];
            }
            self.eventListeners[eventName].push(callback);
            return {
                eventName: eventName,
                callback: callback,
                off: function () {
                    self.off(eventName, callback);
                }
            };
        },
        off: function (eventName, callback) {
            if (!eventName) {
                this.eventListeners = {};
            } else {
                if (this.eventListeners[eventName]) {
                    if (callback) {
                        this.eventListeners[eventName] = _.without(this.eventListeners[eventName], callback);
                    } else {
                        this.eventListeners[eventName] = [];
                    }
                }
            }
        }
    });

    Fsm.prototype.trigger = Fsm.prototype.emit;

    // _machKeys are members we want to track across the prototype chain of an extended FSM constructor
    // Since we want to eventually merge the aggregate of those values onto the instance so that FSMs
    // that share the same extended prototype won't share state *on* those prototypes.
    var _machKeys = ["states", "initialState"];
    var inherits = function (parent, protoProps, staticProps) {
        var fsm; // placeholder for instance constructor
        var machObj = {}; // object used to hold initialState & states from prototype for instance-level merging
        var ctor = function () {}; // placeholder ctor function used to insert level in prototype chain
        // The constructor function for the new subclass is either defined by you
        // (the "constructor" property in your `extend` definition), or defaulted
        // by us to simply call the parent's constructor.
        if (protoProps && protoProps.hasOwnProperty('constructor')) {
            fsm = protoProps.constructor;
        } else {
            // The default machina constructor (when using inheritance) creates a
            // deep copy of the states/initialState values from the prototype and
            // extends them over the instance so that they'll be instance-level.
            // If an options arg (args[0]) is passed in, a states or intialState
            // value will be preferred over any data pulled up from the prototype.
            fsm = function () {
                var args = slice.call(arguments, 0);
                args[0] = args[0] || {};
                var blendedState;
                var instanceStates = args[0].states || {};
                blendedState = _.deepExtend(_.cloneDeep(machObj), {
                    states: instanceStates
                });
                blendedState.initialState = args[0].initialState || this.initialState;
                _.extend(args[0], blendedState);
                parent.apply(this, args);
            };
        }

        // Inherit class (static) properties from parent.
        _.deepExtend(fsm, parent);

        // Set the prototype chain to inherit from `parent`, without calling
        // `parent`'s constructor function.
        ctor.prototype = parent.prototype;
        fsm.prototype = new ctor();

        // Add prototype properties (instance properties) to the subclass,
        // if supplied.
        if (protoProps) {
            _.extend(fsm.prototype, protoProps);
            _.deepExtend(machObj, _.transform(protoProps, function (accum, val, key) {
                if (_machKeys.indexOf(key) !== -1) {
                    accum[key] = val;
                }
            }));
        }

        // Add static properties to the constructor function, if supplied.
        if (staticProps) {
            _.deepExtend(fsm, staticProps);
        }

        // Correctly set child's `prototype.constructor`.
        fsm.prototype.constructor = fsm;

        // Set a convenience property in case the parent's prototype is needed later.
        fsm.__super__ = parent.prototype;

        return fsm;
    };

    // The self-propagating extend function that Backbone classes use.
    Fsm.extend = function (protoProps, classProps) {
        var fsm = inherits(this, protoProps, classProps);
        fsm.extend = this.extend;
        return fsm;
    };
    var MACHINA_PROP = "__machina__";

    function getDefaultBehavioralOptions() {
        return {
            initialState: "uninitialized",
            eventListeners: {
                "*": []
            },
            states: {},
            namespace: utils.makeFsmNamespace()
        };
    }

    function getDefaultClientMeta() {
        return {
            inputQueue: [],
            targetReplayState: "",
            state: undefined,
            priorState: undefined,
            priorAction: "",
            currentAction: "",
            currentActionArgs: undefined,
            inExitHandler: false
        };
    }

    function getLeaklessArgs(args, startIdx) {
        var result = [];
        for (var i = 0; i < args.length; i++) {
            result[i] = args[i];
        }
        return result.slice(startIdx || 0);
    }

    function BehavioralFsm(options) {
        _.extend(this, options);
        _.defaults(this, getDefaultBehavioralOptions());
        this.initialize.apply(this, arguments);
        machina.emit(NEW_FSM, this);
    }

    _.extend(BehavioralFsm.prototype, {
        initialize: function () {},

        // Probably need a getHandlerArgs method
        // to handle not passing client as an arg
        // in classic FSMs
        initClient: function initClient(client) {
            var initialState = this.initialState;
            if (initialState) {
                this.transition(client, initialState);
            }
        },

        ensureClientMeta: function ensureClientMeta(client) {
            if (typeof client !== "object") {
                throw new Error("A BehavioralFsm client must be an object, not a primitive.");
            }
            if (!client[MACHINA_PROP]) {
                client[MACHINA_PROP] = _.cloneDeep(getDefaultClientMeta());
                this.initClient(client);
            }
            return client[MACHINA_PROP];
        },

        emit: function (eventName) {
            var args = getLeaklessArgs(arguments);
            _.each(_.pick(this.eventListeners, "*", eventName), function (listeners) {
                _.each(listeners, function (callback) {
                    try {
                        callback.apply(this, args);
                    } catch (exception) {
                        if (console && typeof console.log !== "undefined") {
                            console.log(exception.toString());
                        }
                    }
                }, this);
            }, this);
        },

        on: function (eventName, callback) {
            var self = this;
            if (!self.eventListeners[eventName]) {
                self.eventListeners[eventName] = [];
            }
            self.eventListeners[eventName].push(callback);
            return {
                eventName: eventName,
                callback: callback,
                off: function () {
                    self.off(eventName, callback);
                }
            };
        },

        off: function (eventName, callback) {
            if (!eventName) {
                this.eventListeners = {};
            } else {
                if (this.eventListeners[eventName]) {
                    if (callback) {
                        this.eventListeners[eventName] = _.without(this.eventListeners[eventName], callback);
                    } else {
                        this.eventListeners[eventName] = [];
                    }
                }
            }
        },

        handle: function (client, inputType) {
            var clientMeta = this.ensureClientMeta(client);
            var args = getLeaklessArgs(arguments);
            var currentState = clientMeta.state;
            clientMeta.currentActionArgs = args.slice(1);
            var handlerName;
            var handler;
            var isCatchAll = false;
            var result;
            if (!clientMeta.inExitHandler) {
                handlerName = this.states[currentState][inputType] ? inputType : "*";
                isCatchAll = (handlerName === "*");
                handler = (this.states[currentState][handlerName] || this[handlerName]) || this["*"];
                action = clientMeta.state + "." + handlerName;
                //if ( !clientMeta.currentAction ) {
                clientMeta.currentAction = action;
                //}
                this.emit(HANDLING, {
                    client: client,
                    inputType: inputType
                });
                if (typeof handler === "function") {
                    result = handler.apply(this, isCatchAll ? args : [args[0]].concat(args.slice(2)));
                } else {
                    result = handler;
                    this.transition(client, handler);
                }
                this.emit(HANDLED, {
                    client: client,
                    inputType: inputType
                });
                clientMeta.priorAction = clientMeta.currentAction;
                clientMeta.currentAction = "";
                this.processQueue(client, NEXT_HANDLER);
            } else {
                this.emit(NO_HANDLER, {
                    inputType: inputType,
                    client: client
                });
            }
        },

        transition: function (client, newState) {
            var clientMeta = this.ensureClientMeta(client);
            var curState = clientMeta.state;
            if (!clientMeta.inExitHandler && newState !== curState) {
                if (this.states[newState]) {
                    if (curState && this.states[curState] && this.states[curState]._onExit) {
                        clientMeta.inExitHandler = true;
                        this.states[curState]._onExit.call(this, client);
                        clientMeta.inExitHandler = false;
                    }
                    clientMeta.targetReplayState = newState;
                    clientMeta.priorState = curState;
                    clientMeta.state = newState;
                    this.emit.call(this, TRANSITION, {
                        fromState: clientMeta.priorState,
                        action: clientMeta.currentAction,
                        toState: newState
                    });
                    if (this.states[newState]._onEnter) {
                        this.states[newState]._onEnter.call(this, client);
                    }
                    if (clientMeta.targetReplayState === newState) {
                        this.processQueue(client, NEXT_TRANSITION);
                    }
                    return;
                }
                this.emit.call(this, INVALID_STATE, {
                    state: clientMeta.state,
                    attemptedState: newState
                });
            }
        },

        deferUntilTransition: function (client, stateName) {
            var clientMeta = this.ensureClientMeta(client);
            if (clientMeta.currentActionArgs) {
                var queued = {
                    type: NEXT_TRANSITION,
                    untilState: stateName,
                    args: clientMeta.currentActionArgs
                };
                clientMeta.inputQueue.push(queued);
                this.emit(DEFERRED, {
                    state: clientMeta.state,
                    queuedArgs: queued
                });
            }
        },

        deferUntilNextHandler: function (client) {
            var clientMeta = this.ensureClientMeta(client);
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
        },

        processQueue: function (client, type) {
            var clientMeta = this.ensureClientMeta(client);
            var filterFn = (type === NEXT_TRANSITION) ?
            function (item) {
                return item.type === NEXT_TRANSITION && ((!item.untilState) || (item.untilState === clientMeta.state));
            } : function (item) {
                return item.type === NEXT_HANDLER;
            };
            var toProcess = _.filter(clientMeta.inputQueue, filterFn);
            clientMeta.inputQueue = _.difference(clientMeta.inputQueue, toProcess);
            _.each(toProcess, function (item) {
                this.handle.apply(this, [client].concat(item.args));
            }, this);
        },

        clearQueue: function (client, type, name) {
            var clientMeta = this.ensureClientMeta(client);
            if (!type) {
                clientMeta.inputQueue = [];
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
                clientMeta.inputQueue = _.filter(clientMeta.inputQueue, filter);
            }
        }
    });

    BehavioralFsm.extend = function (protoProps, classProps) {
        var fsm = inherits(this, protoProps, classProps);
        fsm.extend = this.extend;
        return fsm;
    };

    var NewFsm = BehavioralFsm.extend({
        constructor: function () {
            BehavioralFsm.apply(this, arguments);
            this.ensureClientMeta();
        },
        initClient: function initClient() {
            var initialState = this.initialState;
            if (initialState) {
                this.transition(initialState);
            }
        },
        ensureClientMeta: function ensureClientMeta() {
            if (!this._stamped) {
                this._stamped = true;
                _.defaults(this, _.cloneDeep(getDefaultClientMeta()));
                this.initClient();
            }
            return this;
        },
        handle: function (inputType) {
            return BehavioralFsm.prototype.handle.apply(
            this, (arguments[0] === this) ? arguments : [this].concat(getLeaklessArgs(arguments)));
        },
        transition: function (newState) {
            return BehavioralFsm.prototype.transition.apply(
            this, (arguments[0] === this) ? arguments : [this].concat(newState));
        },
        deferUntilTransition: function (stateName) {
            return BehavioralFsm.prototype.deferUntilTransition.apply(
            this, (arguments[0] === this) ? arguments : [this].concat(stateName));
        },
        deferUntilNextHandler: function () {
            return BehavioralFsm.prototype.deferUntilNextHandler.apply(
            this, (arguments[0] === this) ? arguments : []);
        },
        processQueue: function (type) {
            return BehavioralFsm.prototype.processQueue.apply(
            this, (arguments[0] === this) ? arguments : [this].concat(type));
        },
        clearQueue: function (type, name) {
            return BehavioralFsm.prototype.clearQueue.apply(
            this, (arguments[0] === this) ? arguments : [this].concat([type, name]));
        }
    });

    var machina = {
        Fsm: NewFsm,
        BehavioralFsm: BehavioralFsm,
        NewFsm: NewFsm,
        utils: utils,
        on: function (eventName, callback) {
            if (!this.eventListeners[eventName]) {
                this.eventListeners[eventName] = [];
            }
            this.eventListeners[eventName].push(callback);
            return callback;
        },
        off: function (eventName, callback) {
            if (this.eventListeners[eventName]) {
                this.eventListeners[eventName] = _.without(this.eventListeners[eventName], callback);
            }
        },
        trigger: function (eventName) {
            var i = 0,
                len, args = arguments,
                listeners = this.eventListeners[eventName] || [];
            if (listeners && listeners.length) {
                _.each(listeners, function (callback) {
                    callback.apply(null, slice.call(args, 1));
                });
            }
        },
        eventListeners: {
            newFsm: []
        }
    };

    machina.emit = machina.trigger;

    return machina;
}));