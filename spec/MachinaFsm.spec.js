/* global _ */

/*
	This is a spec factory that takes a description and
	an object containing factory methods necessary to get
	the proper instances. These tests are run on Machina
	"classic" FSMs with varying levels of inheritance.
*/
function runMachinaFsmSpec( description, fsmFactory ) {
	describe( "MachinaFsm", function() {
		describe( description, function() {
			describe( "and assuming defaults", function() {
				var fsm;
				before( function() {
					fsm = fsmFactory.instanceWithDefaults();
				} );
				it( "should default the initial state to uninitialized", function() {
					fsm.initialState.should.equal( "uninitialized" );
				} );
				it( "should assign a generic namespace", function() {
					fsm.namespace.should.match( /fsm\.[0-9]*/ );
				} );
				it( "should default to empty states object", function() {
					fsm.states.should.be.empty;
				} );
			} );
			describe( "and passing in options", function() {
				var fsm;
				before( function() {
					fsm = fsmFactory.instanceWithOptions();
				} );
				it( "should set the expected namespace", function() {
					fsm.namespace.should.equal( "specialSauceNamespace" );
				} );
				it( "should set the expected initial state value", function() {
					fsm.initialState.should.equal( "uninitialized" );
				} );
				it( "should transition to the intialState", function() {
					fsm.state.should.equal( "uninitialized" );
				} );
				it( "should set the expected states and input handlers", function() {
					fsm.states.should.eql( fsmFactory.options.states );
				} );
			} );
			describe( "When acting on itself as the client", function() {
				it( "should handle input", function() {
					var fsm = fsmFactory.instanceWithOptions();
					var events = [];
					fsm.on( "*", function( evnt, data ) {
						events.push( { eventName: evnt, data: data } );
					} );
					fsm.handle( "start" );
					events[ 0 ].should.eql( {
						eventName: "handling",
						data: { client: fsm, inputType: "start" }
					} );
					events[ 3 ].should.eql( {
						eventName: "handled",
						data: { client: fsm, inputType: "start" }
					} );
					fsm.state.should.equal( "ready" );
				} );
				it( "should transition properly", function() {
					var fsm = fsmFactory.instanceWithOptions();
					var events = [];
					fsm.on( "*", function( evnt, data ) {
						events.push( { eventName: evnt, data: data } );
					} );
					fsm.handle( "start" );
					events[ 1 ].should.eql( {
						eventName: "transition",
						data: {
							fromState: "uninitialized",
							action: "uninitialized.start",
							toState: "ready"
						}
					} );
					events[ 2 ].should.eql( { eventName: "ready-OnEnterFiring", data: undefined } );
				} );
				it( "should handle deferred input properly", function() {
					var fsm = fsmFactory.instanceWithOptions();
					var events = [];
					fsm.on( "*", function( evnt, data ) {
						events.push( { eventName: evnt, data: data } );
					} );
					fsm.handle( "letsDoThis" );
					fsm.handle( "start" );
					//console.log( events );
					events.should.eql( [ {
						eventName: "handling",
						data: {
							client: fsm,
							inputType: "letsDoThis"
						}
						},
						{
							eventName: "deferred",
							data: {
								state: "uninitialized",
								queuedArgs: { "args": [ "letsDoThis" ], "type": "transition", "untilState": "ready" }
							}
						},
						{
							eventName: "handled",
							data: {
								client: fsm,
								inputType: "letsDoThis"
							}
						},
						{
							eventName: "handling",
							data: {
								client: fsm,
								inputType: "start"
							}
						},
						{
							eventName: "transition",
							data: {
								fromState: "uninitialized",
								action: "uninitialized.start",
								toState: "ready"
							}
						},
						{
							eventName: "ready-OnEnterFiring",
							data: undefined
						},
						{
							eventName: "handling",
							data: {
								client: fsm,
								inputType: "letsDoThis"
							}
						},
						{
							eventName: "WeAreDoingThis",
							data: {
								someprop: "someval"
							}
						},
						{
							eventName: "ready-OnExitFiring",
							data: undefined
						},
						{
							eventName: "transition",
							data: {
								fromState: "ready",
								action: "ready.letsDoThis",
								toState: "notQuiteDone"
							}
						},
						{
							eventName: "handled",
							data: {
								client: fsm,
								inputType: "letsDoThis"
							}
						},
						{
							eventName: "handled",
							data: {
								client: fsm,
								inputType: "start"
							}
					} ] );
				} );
			} );
			describe( "When creating two instances from the same extended constructor function", function() {
				it( "should not share instance state", function() {
					var eventA = [];
					var eventB = [];
					var fsmA = fsmFactory.instanceWithOptions();
					var fsmB = fsmFactory.instanceWithOptions( { initialState: "done" } );
					fsmA.on( "*", function( eventName, data ) {
						eventA.push( { eventName: eventName, data: data } );
					} );
					fsmB.on( "*", function( eventName, data ) {
						eventB.push( { eventName: eventName, data: data } );
					} );

					fsmA.initialState.should.equal( "uninitialized" );
					fsmA.state.should.equal( "uninitialized" );
					fsmB.initialState.should.equal( "done" );
					fsmB.state.should.equal( "done" );

					// Acting on fsmA should not affect fsmB
					fsmA.handle( "start" );
					eventA.length.should.equal( 4 );
					eventB.length.should.equal( 0 );

					fsmB.handle( "letsDoThis" );
					fsmB.handle( "start" );
					eventA.length.should.equal( 4 );
					eventB.length.should.equal( 6 );
				} );
			} );
		} );
	} );
}

_.each( global.specFactory.machinaFsm, function( val, key ) {
	runMachinaFsmSpec( key, val );
} );
