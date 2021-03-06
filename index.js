// mdn-compat-importer
var fs = require('fs');
var mkdirp = require('mkdirp');
var Q = require('q');
var Reader = require('./lib/Reader.js');
var Converter = require('./lib/Converter.js');
var _ = require('lodash-node');

if (fs.existsSync('.disabled')) {
  console.log('WARNING');
  console.log('Make sure you understand the implications of this tool before running!');
  console.log('Remove the .disabled file when you do.');
  return;
}

mkdirp.sync('data/cache');

var reader = new Reader();
var converter = new Converter();

var tags = ['CSS', 'HTML', 'HTML5', 'API', 'WebAPI'];

Q.
  // process each tag and wait for everything to finish
  all(tags.map(function(tag) {
    // get a promise for this tag
    return reader.processFeed(tag);
  })).

  // find out how the compat section is named for each page
  then(function() {
    console.log('retrieving compat section ids for ' + _.size(reader.links) + ' pages');
    return reader.getSectionNames();
  }).

  // fetch the compat sections
  then(function(links) {
    console.log('retrieving compat sections for ' + _.size(links) + ' pages');
    return reader.fetchSections();
  }).

  // we are only interested in pages with at least something in their compat tables section
  then(function(pages) {
    var pagesWithCompatTables = _.pick(pages, function(html) {
      return html && html.length > 10;
    });
    console.log('found ' + _.size(pagesWithCompatTables) + ' pages with compat tables');
    return pagesWithCompatTables;

    // use these to test specific pages, comment the return directly above this line
    //return _.pick(pagesWithCompatTables, function(value, key) { return key === "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/header"; }); // simple table
    //return _.pick(pagesWithCompatTables, function(value, key) { return key === "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video"; }); // table with several rows
    //return _.pick(pagesWithCompatTables, function(value, key) { return key === "https://developer.mozilla.org/en-US/docs/Web/CSS/@keyframes"; }); // table with prefixes
    //return _.pick(pagesWithCompatTables, function(value, key) { return key === "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/Input"; }); // very complex table
  }).

  // convert the compat tables to JSON
  then(function(pages) {
    return _.mapValues(pages, function(page) {
      return converter.extract(page);
    });
  }).

  // transform to WPD format
  then(function(tables) {
    //console.log(require('util').inspect(tables, { depth: 4 })); // uncomment to see the object, single page mode from above recommended
    var wpd = {};
    _.each(tables, function(table, url) {
      var compat = converter.convert(table, url);
      wpd[compat.uuid] = compat.data;
    });
    return wpd;
  }).

  // save to disk
  then(function(wpd) {
    fs.writeFileSync('data/compat-mdn.json', JSON.stringify(wpd));
    console.log('data saved');
  }).

  // this will throw if something went wrong
  done();
