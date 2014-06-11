/*global module, define */
(function(root, factory) {
    if (typeof module === "object" && module.exports) {
        // Node, or CommonJS-Like environments
        module.exports = function() {
            return factory(require("lodash"), require("monologue.js"), require("riveter"));
        };
    } else if (typeof define === "function" && define.amd) {
        // AMD. Register as an anonymous module.
        define(["lodash", "monologue", "riveter"], function(_, Monologue, riveter) {
            return factory(_, Monologue, riveter, root);
        });
    } else {
        // Browser globals
        root.machina = factory(root._, root.Monologue, root.riveter, root);
    }
}(this, function(_, Monologue, riveter, global, undefined) {
    //import("utils.js");
    //import("BehavioralFsm.js");
    //import("Fsm.js");
    //import("api.js");
    return machina;
}));