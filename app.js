/*var koa = require('koa');
var app = koa();
//let fetch = require('node-fetch');

app.use(function* (next) {
    var start = new Date;
    yield next;
    var ms = new Date - start;
    console.log('%s %s - %s', this.method, this.url, ms);
});
// response
app.use(function* () {
    this.body = 'Hello World';
});*/
let {
    writeStart, reWrite
} = require('./zhihu/question-spider/spider'); //start();

let spider=require('./zhihu/user-spider/spider');
spider.writeStart(7);

//reWrite('38694587');
// writeStart(0);
//app.listen(3000);