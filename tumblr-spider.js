let cheerio = require('cheerio');
let log = console.log;
let fs = require('fs');
let path = require('path');
let request = require('request');

request.get('https://www.tumblr.com/video_file/147800940075/tumblr_nj40jpRN8m1u7pqn8').pipe(fs.createWriteStream('test.mp4'))