var koa = require('koa');
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
});

let getImages=require('./zhihu-spider');
//getImages('30594270')//如何健康的xx
//getImages('35990613')//作为一个黄金比例身材的女生是一种怎样的体验？
//getImages('23147606')//大胸怎样防止下垂？
getImages('44863755')//拥有S型身材是什么体验？？


app.listen(3000);