'use strict';
var gulp = require('gulp'),
    jshint = require('gulp-jshint'),
    mocha = require('gulp-mocha');

gulp.task('lint', function() {
  return gulp.src(['*.js', './lib/*.js', './test/*.js'])
    .pipe(jshint())
    .pipe(jshint.reporter('default'))
    .pipe(jshint.reporter('fail'));
});

gulp.task('test', function () {
    return gulp.src('./test/*.js', {read: false})
        .pipe(mocha({reporter: 'nyan'}));
});

gulp.task('default', ['lint', 'test']);