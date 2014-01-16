require.config( {
	paths : {
		text             : "/example/connectivity/js/lib/require/text",
		backbone         : '/example/connectivity/js/lib/backbone/backbone',
		underscore       : '/example/connectivity/js/lib/underscore/underscore-min',
		mockjax          : '/example/connectivity/js/lib/jquery.mockjax',
		machina          : '/example/connectivity/js/lib/machina/machina',
		'machina.postal' : '/example/connectivity/js/lib/machina/machina.postal',
		postal           : '/example/connectivity/js/lib/postal/postal',
		'postal.diags'   : '/example/connectivity/js/lib/postal/postal.diagnostics.min'
	},
	shim : {
		mockjax : [ 'jquery' ]
	}
} );

// This first require statement is pulling in foundational libraries
require( [
	'jquery',
	'mockjax',
	'machina.postal',
	'postal.diags'
],
	function ( $ ) {

		require( ['app'], function ( app ) {
			// mockjax setup
			// Mocked response for the heartbeat check
			$.mockjax( {
				url : "heartbeat",
				type : "GET",
				response : function ( settings ) {
					if ( app.simulateDisconnect ) {
						this.isTimeout = true;
					} else {
						this.responseText = { canYouHearMeNow : "good" }
					}
				}
			} );
			// more for convenience, our app gets a global namespace
			window.app = app;
		} );

	}
);