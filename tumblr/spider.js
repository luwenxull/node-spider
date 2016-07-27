/**
 * Created by luwenxu on 2016/7/27.
 */
let cheerio = require('cheerio');
let log = console.log;
let fs = require('fs');
let path = require('path');
let request = require('request');

function test(){
    request('http://69.171.234.64',function(err,res,body){
        err && log(err);
        log(body);
    });
}


module.exports=test;