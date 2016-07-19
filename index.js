var koa = require('koa');
var app = koa();
let fetch = require('node-fetch');
let cheerio = require('cheerio');
let log = console.log;
// logger
app.use(function* (next) {
    var start = new Date;
    yield next;
    var ms = new Date - start;
    console.log('%s %s - %s', this.method, this.url, ms);
});
// response
app.use(function* () {
    this.body = 'Hello World';
});
fetch('http://ggoer.com').then(res => res.text()).then(body => {
    //    log(body)
    let $ = cheerio.load(body);
    $('img').each((i, img) => {
        log($(img).attr('src'))
    })
})
app.listen(3000);