define([
    'jquery',
    'example/connectivity/js/bus',
    'example/connectivity/js/connectivityFsm',
    'example/connectivity/js/stethoscope',
    'example/connectivity/js/mainView'
], function($, bus, ConnectivityFsm, Stethoscope, MainView) {
    var stethoscope = new Stethoscope({
        url: "heartbeat"
    });
    stethoscope.on("checking-heartbeat", function() {
        bus.heartbeat.publish({
            topic: "checking",
            data: {}
        });
    });

    var app = {
        simulateDisconnect: false,
        toggleDisconnectSimulation: function() {
            this.simulateDisconnect = !this.simulateDisconnect;
            $(window).trigger(this.simulateDisconnect ? "offline" : "online");
        },
        view: new MainView(),
        monitor: new ConnectivityFsm({
            stethoscope: stethoscope
        })
    };

    app.view.render();

    return app;
});