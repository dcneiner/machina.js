/* global _ */

/*
	This is a spec factory that takes a description and
	an object containing factory methods necessary to get
	the proper instances. These tests are run on Behavioral
	FSMs with varying levels of inheritance.
*/
function runBehavioralFsmSpec( description, fsmFactory ) {
	describe( "BehavioralFsm", function() {
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
				it( "should set the expected states and input handlers", function() {
					fsm.states.should.eql( fsmFactory.options.states );
				} );
			} );
			describe( "When acting on a client", function() {
				it( "should transition a new client to the initial state", function() {
					var fsm = fsmFactory.instanceWithOptions();
					var events = [];
					fsm.on( "*", function( evnt, data ) {
						events.push( { eventName: evnt, data: data } );
					} );
					var client = { name: "Dijkstra" };
					fsm.handle( client, "start" );
					events[ 0 ].should.eql( {
						eventName: "transition",
						data: {
							fromState: undefined,
							action: "",
							toState: "uninitialized"
						}
					} );
				} );
				it( "should handle input", function() {
					var fsm = fsmFactory.instanceWithOptions();
					var events = [];
					fsm.on( "*", function( evnt, data ) {
						events.push( { eventName: evnt, data: data } );
					} );
					var client = { name: "Dijkstra" };
					fsm.handle( client, "start" );
					events[ 1 ].should.eql( {
						eventName: "handling",
						data: { client: client, inputType: "start" }
					} );
					events[ 4 ].should.eql( {
						eventName: "handled",
						data: { client: client, inputType: "start" }
					} );
					client.__machina__.state.should.equal( "ready" );
				} );
				it( "should transition properly", function() {
					var fsm = fsmFactory.instanceWithOptions();
					var events = [];
					fsm.on( "*", function( evnt, data ) {
						events.push( { eventName: evnt, data: data } );
					} );
					var client = { name: "Dijkstra" };
					fsm.handle( client, "start" );
					events[ 2 ].should.eql( {
						eventName: "transition",
						data: {
							fromState: "uninitialized",
							action: "uninitialized.start",
							toState: "ready"
						}
					} );
					events[ 3 ].should.eql( { eventName: "ready-OnEnterFiring", data: undefined } );
				} );
				it( "should handle deferred input properly", function() {
					var fsm = fsmFactory.instanceWithOptions();
					var events = [];
					fsm.on( "*", function( evnt, data ) {
						events.push( { eventName: evnt, data: data } );
					} );
					var client = { name: "Dijkstra" };
					fsm.handle( client, "letsDoThis" );
					fsm.handle( client, "start" );
					events.should.eql( [
						{
							eventName: "transition",
							data: {
								fromState: undefined,
								action: "",
								toState: "uninitialized"
							}
						},
						{
							eventName: "handling",
							data: {
								client: client,
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
								client: client,
								inputType: "letsDoThis"
							}
						},
						{
							eventName: "handling",
							data: {
								client: client,
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
								client: client,
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
								client: client,
								inputType: "letsDoThis"
							}
						},
						{
							eventName: "handled",
							data: {
								client: client,
								inputType: "start"
							}
					} ] );
				} );
			} );
			describe( "When creating two instances from the same extended constructor function", function() {
				it( "should not share instance configuration state", function() {
					var eventA = [];
					var eventB = [];
					var fsmA = fsmFactory.instanceWithOptions();
					var fsmB = fsmFactory.instanceWithOptions( { initialState: "done" } );
					var clientA = { name: "Dijkstra" };
					var clientB = { name: "Joy" };
					fsmA.on( "*", function( eventName, data ) {
						eventA.push( { eventName: eventName, data: data } );
					} );
					fsmB.on( "*", function( eventName, data ) {
						eventB.push( { eventName: eventName, data: data } );
					} );

					fsmA.initialState.should.equal( "uninitialized" );
					fsmB.initialState.should.equal( "done" );

					// Acting on fsmA should not affect fsmB
					fsmA.handle( clientA, "start" );
					eventA[ 2 ].should.eql( {
						eventName: "transition",
						data: {
							fromState: "uninitialized",
							action: "uninitialized.start",
							toState: "ready"
						}
					} );
					eventA[ 3 ].should.eql( { eventName: "ready-OnEnterFiring", data: undefined } );
					eventB.length.should.equal( 0 );

					fsmB.handle( clientB, "letsDoThis" );
					fsmB.handle( clientB, "start" );
					eventA.length.should.equal( 5 );
					eventB.length.should.equal( 8 );
				} );
			} );
		} );
	} );
}

_.each( global.specFactory.behavioral, function( val, key ) {
	runBehavioralFsmSpec( key, val );
} );
