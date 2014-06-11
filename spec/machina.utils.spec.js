/* global describe, it, after, before, expect */
(function() {
    var machina = typeof window === "undefined" ? require("../lib/machina.js")() : window.machina;
    var expect = typeof window === "undefined" ? require("expect.js") : window.expect;
    var _ = typeof window === "undefined" ? require("underscore") : window._;
    var rgx = /.*\.[0-9]*/;
    describe("machina.utils", function() {
        describe("When calling machina.utils.makeFsmNamespace", function() {
            var name = machina.utils.makeFsmNamespace();
            it("should return fsm.{number}", function() {
                expect(rgx.test(name)).to.be(true);
            });
        });
        describe("When calling machina.utils.getDefaultOptions", function() {
            var options = machina.utils.getDefaultOptions();
            it("initialState should default to uninitialized", function() {
                expect(options.initialState).to.be("uninitialized");
            });
            it("states should default to empty object", function() {
                expect(_.isEmpty(options.state)).to.be(true);
            });
            it("namespace should default to expected pattern", function() {
                expect(rgx.test(options.namespace)).to.be(true);
            });
        });
    });
}());