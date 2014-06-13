require.config({
    baseUrl: "../../../",
    paths: {
        text: "bower/requirejs-text/text",
        mockjax: 'bower/jquery-mockjax/jquery.mockjax',
        machina: 'lib/machina',
        'machina.postal': 'example/connectivity/js/machina.postal',
        'monologue': 'bower/monologue.js/lib/monologue',
        postal: 'bower/postal.js/lib/postal',
        'postal.diags': 'bower/postal.diagnostics/lib/postal.diagnostics.min',
        jquery: 'bower/jquery/jquery',
        'riveter': 'bower/riveter/lib/riveter',
        conduitjs: 'bower/conduitjs/lib/conduit',
        lodash: '../../bower/lodash/dist/lodash',
        backbone: 'bower/backbone/backbone'
    },
    shim: {
        mockjax: ['jquery'],
        backbone: {
            deps: ['lodash', 'jquery'],
            exports: 'Backbone'
        }
    }
});

// This first require statement is pulling in foundational libraries
require([
        'jquery',
        'mockjax',
        'machina.postal',
        'postal.diags'
    ],
    function($) {

        require(['example/connectivity/js/app'], function(app) {
            // mockjax setup
            // Mocked response for the heartbeat check
            $.mockjax({
                url: "heartbeat",
                type: "GET",
                response: function(settings) {
                    if (app.simulateDisconnect) {
                        this.isTimeout = true;
                    } else {
                        this.responseText = {
                            canYouHearMeNow: "good"
                        };
                    }
                }
            });
            // more for convenience, our app gets a global namespace
            window.app = app;
        });

    }
);