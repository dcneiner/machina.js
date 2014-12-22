var slice = [].slice;
var NEXT_TRANSITION = "transition";
var HANDLING = "handling";
var HANDLED = "handled";
var NO_HANDLER = "nohandler";
var TRANSITION = "transition";
var INVALID_STATE = "invalidstate";
var DEFERRED = "deferred";
var NEW_FSM = "newfsm";

// _machKeys are members we want to track across the prototype chain of an extended FSM constructor
// Since we want to eventually merge the aggregate of those values onto the instance so that FSMs
// that share the same extended prototype won't share state *on* those prototypes.
var _machKeys = [ "states", "initialState" ];
var extend = function( protoProps, staticProps ) {
	var parent = this;
	var fsm; // placeholder for instance constructor
	var machObj = {}; // object used to hold initialState & states from prototype for instance-level merging
	var ctor = function() {}; // placeholder ctor function used to insert level in prototype chain

	// The constructor function for the new subclass is either defined by you
	// (the "constructor" property in your `extend` definition), or defaulted
	// by us to simply call the parent's constructor.
	if ( protoProps && protoProps.hasOwnProperty( 'constructor' ) ) {
		fsm = protoProps.constructor;
	} else {
		// The default machina constructor (when using inheritance) creates a
		// deep copy of the states/initialState values from the prototype and
		// extends them over the instance so that they'll be instance-level.
		// If an options arg (args[0]) is passed in, a states or intialState
		// value will be preferred over any data pulled up from the prototype.
		fsm = function() {
			var args = slice.call( arguments, 0 );
			args[ 0 ] = args[ 0 ] || {};
			var blendedState;
			var instanceStates = args[ 0 ].states || {};
			blendedState = _.merge( _.cloneDeep( machObj ), { states: instanceStates } );
			blendedState.initialState = args[ 0 ].initialState || this.initialState;
			_.extend( args[ 0 ], blendedState );
			parent.apply( this, args );
		};
	}

	// Inherit class (static) properties from parent.
	_.merge( fsm, parent );

	// Set the prototype chain to inherit from `parent`, without calling
	// `parent`'s constructor function.
	ctor.prototype = parent.prototype;
	fsm.prototype = new ctor();

	// Add prototype properties (instance properties) to the subclass,
	// if supplied.
	if ( protoProps ) {
		_.extend( fsm.prototype, protoProps );
		_.merge( machObj, _.transform( protoProps, function( accum, val, key ) {
			if ( _machKeys.indexOf( key ) !== -1 ) {
				accum[ key ] = val;
			}
		} ) );
	}

	// Add static properties to the constructor function, if supplied.
	if ( staticProps ) {
		_.merge( fsm, staticProps );
	}

	// Correctly set child's `prototype.constructor`.
	fsm.prototype.constructor = fsm;

	// Set a convenience property in case the parent's prototype is needed later.
	fsm.__super__ = parent.prototype;
	return fsm;
};

var utils = {
	makeFsmNamespace: ( function() {
		var machinaCount = 0;
		return function() {
			return "fsm." + machinaCount++;
		};
	})()
};
