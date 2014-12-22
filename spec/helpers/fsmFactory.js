/* global _ */
module.exports = function( machina ) {
	var BehavioralFsm = machina.BehavioralFsm;
	var Fsm = machina.Fsm;
	var grandparentOptions = {
		states: {
			uninitialized: {
				start: "ready",
				letsDoThis: function( client ) {
					this.deferUntilTransition( client, "ready" );
				}
			},
			ready: {
				_onEnter: function() {
					this.emit( "ready-OnEnterFiring" );
				},
				letsDoThis: function() {
					this.emit( "WeAreDoingThis", { someprop: "someval" } );
				},
				_onExit: function() {
					this.emit( "ready-OnExitFiring" );
				}
			}
		}
	};
	var parentOptions = {
		states: {
			notQuiteDone: {
				doMoar: function( client ) {
					this.emit( "doingMoar" );
					this.transition( client, "done" );
				}
			}
		}
	};
	var childOptions = {
		namespace: "specialSauceNamespace",
		states: {
			ready: {
				letsDoThis: function( client ) {
					this.emit( "WeAreDoingThis", { someprop: "someval" } );
					this.transition( client, "notQuiteDone" );
				},
				canWeDoThis: function() {
					return "yep, can";
				}
			},
			done: {
				_onEnter: function() {
					this.emit( "done-OnEnterFiring" );
				}
			}
		}
	};
	return {
		behavioral: {
			"With No Inheritance": {
				instanceWithDefaults: function() {
					return new machina.BehavioralFsm( { states: { uninitialized: {} } } );
				},
				instanceWithOptions: function( opt ) {
					return new machina.BehavioralFsm( _.merge( {}, this.options, ( opt || {} ) ) );
				},
				options: _.merge( {}, grandparentOptions, parentOptions, childOptions )
			},
			"With Some Inheritance": {
				instanceWithDefaults: function() {
					var ParentFsm = BehavioralFsm.extend( { states: { uninitialized: {} } } );
					return new ParentFsm();
				},
				instanceWithOptions: function( opt ) {
					var options = _.merge( {}, grandparentOptions, parentOptions, childOptions, ( opt || {} ) );
					var ParentFsm = BehavioralFsm.extend( options );
					return new ParentFsm();
				},
				extendingWithStaticProps: function() {
					var options = _.merge( {}, grandparentOptions, parentOptions, childOptions );
					var ParentFsm = BehavioralFsm.extend( options, { someStaticMethod: function() {} } );
					return ParentFsm;
				},
				options: _.merge( {}, grandparentOptions, parentOptions, childOptions )
			},
			"With More Inheritance": {
				instanceWithDefaults: function() {
					var ParentFsm = BehavioralFsm.extend( { states: { uninitialized: {} } } );
					var ChildFsm = ParentFsm.extend( {} );
					return new ChildFsm();
				},
				instanceWithOptions: function( opt ) {
					var options = _.merge( {}, grandparentOptions, parentOptions );
					var ParentFsm = BehavioralFsm.extend( options );
					var ChildFsm = ParentFsm.extend( _.merge( {}, childOptions, ( opt || {} ) ) );
					return new ChildFsm();
				},
				extendingWithStaticProps: function() {
					var options = _.merge( {}, grandparentOptions, parentOptions );
					var ParentFsm = BehavioralFsm.extend( options, { someStaticMethod: function() {} } );
					var ChildFsm = ParentFsm.extend( _.merge( {}, childOptions ) );
					return ChildFsm;
				},
				options: _.merge( {}, grandparentOptions, parentOptions, childOptions )
			},
			"With Too Much Inheritance": {
				instanceWithDefaults: function() {
					var GrandparentFsm = BehavioralFsm.extend( { states: { uninitialized: {} } } );
					var ParentFsm = GrandparentFsm.extend( {} );
					var ChildFsm = ParentFsm.extend( {} );
					return new ChildFsm();
				},
				instanceWithOptions: function( opt ) {
					var GrandparentFsm = BehavioralFsm.extend( grandparentOptions );
					var ParentFsm = GrandparentFsm.extend( parentOptions );
					var ChildFsm = ParentFsm.extend( _.merge( {}, childOptions, ( opt || {} ) ) );
					return new ChildFsm();
				},
				extendingWithStaticProps: function() {
					var GrandparentFsm = BehavioralFsm.extend( grandparentOptions, { someStaticMethod: function() {} } );
					var ParentFsm = GrandparentFsm.extend( parentOptions );
					var ChildFsm = ParentFsm.extend( _.merge( {}, childOptions ) );
					return ChildFsm;
				},
				options: _.merge( {}, grandparentOptions, parentOptions, childOptions )
			}
		},
		machinaFsm: {
			"With No Inheritance": {
				instanceWithDefaults: function() {
					return new machina.Fsm( { states: { uninitialized: {} } } );
				},
				instanceWithOptions: function( opt ) {
					return new machina.Fsm( _.merge( {}, this.options, ( opt || {} ) ) );
				},
				options: _.merge( {}, grandparentOptions, parentOptions, childOptions )
			},
			"With Some Inheritance": {
				instanceWithDefaults: function() {
					var ParentFsm = Fsm.extend( { states: { uninitialized: {} } } );
					return new ParentFsm();
				},
				instanceWithOptions: function( opt ) {
					var options = _.merge( {}, grandparentOptions, parentOptions, childOptions );
					var ParentFsm = Fsm.extend( _.merge( {}, options, opt ) );
					return new ParentFsm();
				},
				extendingWithStaticProps: function() {
					var options = _.merge( {}, grandparentOptions, parentOptions, childOptions );
					var ParentFsm = Fsm.extend( options, { someStaticMethod: function() {} } );
					return ParentFsm;
				},
				options: _.merge( {}, grandparentOptions, parentOptions, childOptions )
			},
			"With More Inheritance": {
				instanceWithDefaults: function() {
					var ParentFsm = Fsm.extend( { states: { uninitialized: {} } } );
					var ChildFsm = ParentFsm.extend( {} );
					return new ChildFsm();
				},
				instanceWithOptions: function( opt ) {
					var options = _.merge( {}, grandparentOptions, parentOptions );
					var ParentFsm = Fsm.extend( options );
					var ChildFsm = ParentFsm.extend( _.merge( {}, childOptions, opt ) );
					return new ChildFsm();
				},
				extendingWithStaticProps: function() {
					var options = _.merge( {}, grandparentOptions, parentOptions );
					var ParentFsm = Fsm.extend( options, { someStaticMethod: function() {} } );
					var ChildFsm = ParentFsm.extend( _.merge( {}, childOptions ) );
					return ChildFsm;
				},
				options: _.merge( {}, grandparentOptions, parentOptions, childOptions )
			},
			"With Too Much Inheritance": {
				instanceWithDefaults: function() {
					var GrandparentFsm = Fsm.extend( { states: { uninitialized: {} } } );
					var ParentFsm = GrandparentFsm.extend( {} );
					var ChildFsm = ParentFsm.extend( {} );
					return new ChildFsm();
				},
				instanceWithOptions: function( opt ) {
					var GrandparentFsm = Fsm.extend( grandparentOptions );
					var ParentFsm = GrandparentFsm.extend( parentOptions );
					var ChildFsm = ParentFsm.extend( _.merge( {}, childOptions, opt ) );
					return new ChildFsm();
				},
				extendingWithStaticProps: function() {
					var GrandparentFsm = Fsm.extend( grandparentOptions, { someStaticMethod: function() {} } );
					var ParentFsm = GrandparentFsm.extend( parentOptions );
					var ChildFsm = ParentFsm.extend( _.merge( {}, childOptions ) );
					return ChildFsm;
				},
				options: _.merge( {}, grandparentOptions, parentOptions, childOptions )
			}
		}
	};
};
