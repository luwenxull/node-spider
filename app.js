var koa = require('koa');
var koa_router=require('koa-router');
var app = koa(),
    router=koa_router();
//let fetch = require('node-fetch');
var log=console.log;
var fs=require('fs');
var serve=require('koa-static');
var koaBody=require('koa-body')();
app.use(function* (next) {
    var start = new Date;
    yield next;
    var ms = new Date - start;
    console.log('%s %s - %s', this.method, this.url, ms);
});

router.get('/',function *() {
    // this.body=
}).post('/zh/q',koaBody,function*(...args){
    let reqBody=this.request.body;
    question_spider.fetchImageOfQuestion(reqBody.href,reqBody.qid,reqBody.title);
    this.body='finish'
}).post('/zh/u/',koaBody,function*(){
    let reqBody=this.request.body;
    user_spider.fetchImageOfUser(reqBody.href,reqBody.href,reqBody.name);
    this.body='finish'
});

app.use(serve('views'));
app.use(router.routes());
/*// response
app.use(function* () {
    this.body = 'Hello World';
});*/
let question_spider= require('./zhihu/question-spider/spider'),
    user_spider=require('./zhihu/user-spider/spider');

let tumblr_test=require('./tumblr/spider');
// tumblr_test.test()
app.listen(3000);