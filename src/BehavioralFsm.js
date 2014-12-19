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

function getLeaklessArgs( args, startIdx ) {
	var result = [];
	for (var i = 0; i < args.length; i++) {
		result[ i ] = args[ i ];
	}
	return result.slice( startIdx || 0 );
}

function BehavioralFsm( options ) {
	_.extend( this, options );
	_.defaults( this, getDefaultBehavioralOptions() );
	this.initialize.apply( this, arguments );
	machina.emit( NEW_FSM, this );
}

_.extend( BehavioralFsm.prototype, {
	initialize: function() {},

	// Probably need a getHandlerArgs method
	// to handle not passing client as an arg
	// in classic FSMs

	initClient: function initClient( client ) {
		var initialState = this.initialState;
		if ( initialState ) {
			this.transition( client, initialState );
		}
	},

	ensureClientMeta: function ensureClientMeta( client ) {
		if ( typeof client !== "object" ) {
			throw new Error( "A BehavioralFsm client must be an object, not a primitive." );
		}
		if ( !client[ MACHINA_PROP ] ) {
			client[ MACHINA_PROP ] = _.cloneDeep( getDefaultClientMeta() );
			this.initClient( client );
		}
		return client[ MACHINA_PROP ];
	},

	emit: function( eventName ) {
		var args = getLeaklessArgs( arguments );
		_.each( _.pick( this.eventListeners, "*", eventName ), function( listeners ) {
			_.each( listeners, function( callback ) {
				try {
					callback.apply( this, args );
				} catch (exception) {
					if ( console && typeof console.log !== "undefined" ) {
						console.log( exception.toString() );
					}
				}
			}, this );
		}, this );
	},

	on: function( eventName, callback ) {
		var self = this;
		if ( !self.eventListeners[ eventName ] ) {
			self.eventListeners[ eventName ] = [];
		}
		self.eventListeners[ eventName ].push( callback );
		return {
			eventName: eventName,
			callback: callback,
			off: function() {
				self.off( eventName, callback );
			}
		};
	},

	off: function( eventName, callback ) {
		if ( !eventName ) {
			this.eventListeners = {};
		} else {
			if ( this.eventListeners[ eventName ] ) {
				if ( callback ) {
					this.eventListeners[ eventName ] = _.without( this.eventListeners[ eventName ], callback );
				} else {
					this.eventListeners[ eventName ] = [];
				}
			}
		}
	},

	handle: function( client, inputType ) {
		var clientMeta = this.ensureClientMeta( client );
		var args = getLeaklessArgs( arguments );
		var currentState = clientMeta.state;
		clientMeta.currentActionArgs = args.slice( 1 );
		var handlerName;
		var handler;
		var isCatchAll = false;
		var result;
		if ( !clientMeta.inExitHandler ) {
			handlerName = this.states[ currentState ][ inputType ] ? inputType : "*";
			isCatchAll = ( handlerName === "*" );
			handler = ( this.states[ currentState ][ handlerName ] || this[ handlerName ] ) || this[ "*" ];
			action = clientMeta.state + "." + handlerName;
			//if ( !clientMeta.currentAction ) {
			clientMeta.currentAction = action;
			//}
			this.emit( HANDLING, {
				client: client,
				inputType: inputType
			} );
			if ( typeof handler === "function" ) {
				result = handler.apply( this, isCatchAll ? args : [ args[ 0 ] ].concat( args.slice( 2 ) ) );
			} else {
				result = handler;
				this.transition( client, handler );
			}
			this.emit( HANDLED, {
				client: client,
				inputType: inputType
			} );
			clientMeta.priorAction = clientMeta.currentAction;
			clientMeta.currentAction = "";
			this.processQueue( client, NEXT_HANDLER );
		} else {
			this.emit( NO_HANDLER, {
				inputType: inputType,
				client: client
			} );
		}
	},

	transition: function( client, newState ) {
		var clientMeta = this.ensureClientMeta( client );
		var curState = clientMeta.state;
		if ( !clientMeta.inExitHandler && newState !== curState ) {
			if ( this.states[ newState ] ) {
				if ( curState && this.states[ curState ] && this.states[ curState ]._onExit ) {
					clientMeta.inExitHandler = true;
					this.states[ curState ]._onExit.call( this, client );
					clientMeta.inExitHandler = false;
				}
				clientMeta.targetReplayState = newState;
				clientMeta.priorState = curState;
				clientMeta.state = newState;
				this.emit.call( this, TRANSITION, {
					fromState: clientMeta.priorState,
					action: clientMeta.currentAction,
					toState: newState
				} );
				if ( this.states[ newState ]._onEnter ) {
					this.states[ newState ]._onEnter.call( this, client );
				}
				if ( clientMeta.targetReplayState === newState ) {
					this.processQueue( client, NEXT_TRANSITION );
				}
				return;
			}
			this.emit.call( this, INVALID_STATE, {
				state: clientMeta.state,
				attemptedState: newState
			} );
		}
	},

	deferUntilTransition: function( client, stateName ) {
		var clientMeta = this.ensureClientMeta( client );
		if ( clientMeta.currentActionArgs ) {
			var queued = {
				type: NEXT_TRANSITION,
				untilState: stateName,
				args: clientMeta.currentActionArgs
			};
			clientMeta.inputQueue.push( queued );
			this.emit( DEFERRED, {
				state: clientMeta.state,
				queuedArgs: queued
			} );
		}
	},

	deferUntilNextHandler: function( client ) {
		var clientMeta = this.ensureClientMeta( client );
		if ( clientMeta.currentActionArgs ) {
			var queued = {
				type: NEXT_HANDLER,
				args: clientMeta.currentActionArgs
			};
			clientMeta.inputQueue.push( queued );
			this.emit( DEFERRED, {
				state: clientMeta.state,
				queuedArgs: queued
			} );
		}
	},

	processQueue: function( client, type ) {
		var clientMeta = this.ensureClientMeta( client );
		var filterFn = ( type === NEXT_TRANSITION ) ? function( item ) {
			return item.type === NEXT_TRANSITION && ( ( !item.untilState ) || ( item.untilState === clientMeta.state ) );
		} : function( item ) {
			return item.type === NEXT_HANDLER;
		};
		var toProcess = _.filter( clientMeta.inputQueue, filterFn );
		clientMeta.inputQueue = _.difference( clientMeta.inputQueue, toProcess );
		_.each( toProcess, function( item ) {
			this.handle.apply( this, [ client ].concat( item.args ) );
		}, this );
	},

	clearQueue: function( client, type, name ) {
		var clientMeta = this.ensureClientMeta( client );
		if ( !type ) {
			clientMeta.inputQueue = [];
		} else {
			var filter;
			if ( type === NEXT_TRANSITION ) {
				filter = function( evnt ) {
					return ( evnt.type === NEXT_TRANSITION && ( name ? evnt.untilState === name : true ) );
				};
			} else if ( type === NEXT_HANDLER ) {
				filter = function( evnt ) {
					return evnt.type === NEXT_HANDLER;
				};
			}
			clientMeta.inputQueue = _.filter( clientMeta.inputQueue, filter );
		}
	}
} );

BehavioralFsm.extend = function( protoProps, classProps ) {
	var fsm = inherits( this, protoProps, classProps );
	fsm.extend = this.extend;
	return fsm;
};
