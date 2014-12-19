var NewFsm = BehavioralFsm.extend( {
	constructor: function() {
		BehavioralFsm.apply( this, arguments );
		this.ensureClientMeta();
	},
	initClient: function initClient() {
		var initialState = this.initialState;
		if ( initialState ) {
			this.transition( initialState );
		}
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
	deferUntilNextHandler: function() {
		return BehavioralFsm.prototype.deferUntilNextHandler.apply(
			this, ( arguments[ 0 ] === this ) ? arguments : []
		);
	},
	processQueue: function( type ) {
		return BehavioralFsm.prototype.processQueue.apply(
			this, ( arguments[ 0 ] === this ) ? arguments : [ this ].concat( type )
		);
	},
	clearQueue: function( type, name ) {
		return BehavioralFsm.prototype.clearQueue.apply(
			this, ( arguments[ 0 ] === this ) ? arguments : [ this ].concat( [ type, name ] )
		);
	}
} );
