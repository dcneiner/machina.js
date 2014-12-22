var Fsm = BehavioralFsm.extend( {
	constructor: function() {
		BehavioralFsm.apply( this, arguments );
		this.ensureClientMeta();
	},
	initClient: function initClient() {
		var initialState = this.initialState;
		if ( !initialState ) {
			throw new Error( "You must specify an initial state for this FSM" );
		}
		if ( !this.states[ initialState ] ) {
			throw new Error( "The initial state specified does not exist in the states object." );
		}
		this.transition( initialState );
	},
	ensureClientMeta: function ensureClientMeta() {
		if ( !this._stamped ) {
			this._stamped = true;
			_.defaults( this, _.cloneDeep( getDefaultClientMeta() ) );
			this.initClient();
		}
		return this;
	},
	handle: function( inputType ) {
		return BehavioralFsm.prototype.handle.apply(
			this, ( arguments[ 0 ] === this ) ? arguments : [ this ].concat( getLeaklessArgs( arguments ) )
		);
	},
	transition: function( newState ) {
		return BehavioralFsm.prototype.transition.apply(
			this, ( arguments[ 0 ] === this ) ? arguments : [ this ].concat( newState )
		);
	},
	deferUntilTransition: function( stateName ) {
		return BehavioralFsm.prototype.deferUntilTransition.apply(
			this, ( arguments[ 0 ] === this ) ? arguments : [ this ].concat( stateName )
		);
	},
	processQueue: function( type ) {
		return BehavioralFsm.prototype.processQueue.apply(
			this, ( arguments[ 0 ] === this ) ? arguments : [ this ]
		);
	},
	clearQueue: function( name ) {
		return BehavioralFsm.prototype.clearQueue.apply(
			this, ( arguments[ 0 ] === this ) ? arguments : [ this ].concat( [ name ] )
		);
	}
} );
