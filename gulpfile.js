var gulp        = require("gulp");
var fileImports = require("gulp-imports");
var pkg         = require("./package.json");
var header      = require("gulp-header");
var beautify    = require("gulp-beautify");
var hintNot     = require("gulp-hint-not");
var uglify      = require("gulp-uglify");
var rename      = require("gulp-rename");
var plato       = require("gulp-plato");
var gutil       = require('gulp-util');
var express     = require('express');
var path        = require('path');
var tinylr      = require('tiny-lr');
var rimraf      = require('gulp-rimraf');

var banner = ["/**",
    " * <%= pkg.name %> - <%= pkg.description %>",
    " * Author: <%= pkg.author %>",
    " * Version: v<%= pkg.version %>",
    " * Url: <%= pkg.homepage %>",
    " * License(s): <% pkg.licenses.forEach(function( license, idx ){ %><%= license.type %><% if(idx !== pkg.licenses.length-1) { %>, <% } %><% }); %>",
    " */",
    ""].join("\n");

gulp.task("combine", function() {
    gulp.src(["./src/machina.js"])
        .pipe(header(banner, { pkg : pkg }))
        .pipe(fileImports())
        .pipe(hintNot())
        .pipe(beautify({indentSize: 4}))
        .pipe(gulp.dest("./lib/"))
        .pipe(gulp.dest("./example/connectivity/js/lib/machina"))
        .pipe(gulp.dest("./lib/"))
        .pipe(uglify({ compress: { negate_iife: false }}))
        .pipe(header(banner, { pkg : pkg }))
        .pipe(rename("machina.min.js"))
        .pipe(gulp.dest("./lib/"))
        .pipe(gulp.dest("./example/connectivity/js/lib/machina"));
});

gulp.task('clean', function() {
    gulp.src('./report', { read: false })
        .pipe(rimraf());
});

gulp.task("default", function() {
    gulp.run("clean");
    gulp.run("combine");
    gulp.run("report");
});

gulp.task("report", function () {
    gulp.src("./lib/machina.js")
        .pipe(plato("report"));
});


var createServers = function(port, lrport) {
    var lr = tinylr();
    lr.listen(lrport, function() {
        gutil.log('LR Listening on', lrport);
    });
    var p = path.resolve('./');
    var app = express();
    app.use(express.static(p));
    app.listen(port, function() {
        gutil.log('Listening on', port);
    });

    return {
        lr: lr,
        app: app
    };
};

var servers;

gulp.task('server', function(){
    if(!servers) {
        servers = createServers(3080, 35729);
    }
    gulp.watch(["./**/*", "!./node_modules/**/*"], function(evt){
        gutil.log(gutil.colors.cyan(evt.path), 'changed');
        servers.lr.changed({
            body: {
                files: [evt.path]
            }
        });
    });
});