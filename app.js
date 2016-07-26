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
    /*let path=this.request.path,
        pathArr=path.split('/');
    let title=this.request.querystring.replace('t=','').replace(/\\u/g,'|0x').split('|').slice(1);
    let href=pathArr[3],
        qid=pathArr[4];

    this.body=href+'.'+qid+'.'+title*/
    let reqBody=this.request.body;
    //log(reqBody);
    question_spider.fetchImageOfQuestion(reqBody.href,reqBody.qid,reqBody.title);
    this.body='finish'
}).post('/zh/u/',koaBody,function*(){
    /*let path=this.request.path,
        pathArr=path.split('/');
    let title=this.request.querystring.replace('t=','').replace(/\\u/g,'|0x').split('|').slice(1);
    let href=pathArr[3];
    user_spider.fetchImageOfUser(href,href,title);
    this.body=href+'.'+title*/
    let reqBody=this.request.body;
    //log(reqBody);
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
// question_spider.writeStart(20);
// question_spider.fetchImageOfQuestion();
 /*
let spider=require('./zhihu/user-spider/spider');
spider.writeStart(7);*/
/*
//reWrite('38694587');
// writeStart(0);*/
app.listen(3000);