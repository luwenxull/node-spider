/**
 * Created by luwenxu on 2016/7/25.
 */
let cheerio = require('cheerio');
let log = console.log;
let fs = require('fs');
let path = require('path');
let request = require('request');
// let user_img_list = require('./user-list');
let cookieValue=require('../cookie');
/*写图片*/
let {writeImages}=require('./../writeImages');

let baseGetUrl = 'https://www.zhihu.com/people/$$id/answers',
    deepQuestionUrl = 'https://www.zhihu.com';


function writeStart(index,user_img_list) {
    
    let singleDownload = false;
    let downloadIterator;

    let user = user_img_list[index],
        srcCollection = [];

    let page = 1;

    /*zhihu cookie*/
    let j = request.jar();

    let cookie = request.cookie(cookieValue);
    j.setCookie(cookie, 'https://www.zhihu.com');

    /*request({
     method: 'GET',
     url: 'https://www.zhihu.com',
     jar:j
     },(err,res,body)=>{
     fs.writeFile('test.html',body)
     });*/

    /*request('https://www.zhihu.com',(err,res,body)=>{
     fs.writeFile('test.html',body)
     });*/
    let indexGet = function (page) {
        let options = {
            method: 'GET',
            url: baseGetUrl.replace('$$id', user.id),
            qs: {page: page},
            jar: j
        };

        let got = false,
            reGot = false;

        log('retrieve page:', page);
        let timeout = setTimeout(()=> {
            log('page', page, ' timeout,will start an new fetch');
            reGot = true;
            indexGet(page)
        }, 5000);
        request(options, (err, res, body) => {
            if (err) {
                log(err);
                log(page, 'err');
                if (!reGot) {
                    clearTimeout(timeout);
                    indexGet(page);
                }
            } else {
                if (!reGot) {
                    log('page', page, 'got!');
                    clearTimeout(timeout);
                    let $ = cheerio.load(body);
                    findQuestionWithImage($)
                }
            }
        });
    };

    function findQuestionWithImage($) {
        let href, people, img, src;
        let zm_item = $('.zm-item'),
            length = zm_item.length,
            count = 0;

        let answerWithImage = [];
        if (length) {
            zm_item.each((index, answer) => {
                href = $(answer).find('.question_link').attr('href');
                img = $(answer).find('.origin_image');
                // log(href);
                if (img.length) {
                    answerWithImage.push(href)
                }
            });
            log(answerWithImage);
            if (answerWithImage.length) {
                for (let answer of answerWithImage) {
                    (()=>{
                        let wrapFn = function () {
                            let reGot = false;
                            let timeout = setTimeout(()=> {
                                reGot = true;
                                wrapFn();
                            }, 5000);
                            request.get(deepQuestionUrl + answer, (err, res, body)=> {
                                if (err) {
                                    if (!reGot) {
                                        log(err);
                                        clearTimeout(timeout);
                                        count++;
                                    }
                                } else if (!reGot) {
                                    clearTimeout(timeout);
                                    let $ = cheerio.load(body);
                                    //log(answer.split('/')[2])
                                    getUserQuestionImages($, answer.split('/')[2]);
                                    count++;
                                    //log(srcCollection);
                                    if (count == answerWithImage.length) {
                                        // log(srcCollection)
                                        indexGet(++page)
                                    }
                                }
                            })
                        };
                        wrapFn();
                    })();

                }
            } else {
                indexGet(++page)
            }

        } else {
            fs.access('pic/' + user.id, err=> {
                if (err) {
                    fs.mkdirSync('pic/' + user.id);
                }
                downloadIterator = recordAndGo(srcCollection);
                downloadIterator.next();
            });

            // log(srcCollection)
        }
    }


    function getUserQuestionImages($, question) {
        $('.zm-editable-content img').each((index, img)=> {
            let src = $(img).attr('src').replace('_b', '_r');
            if (src.search('http') != -1) {
                srcCollection.push({
                    src,
                    question: question + '#'
                });
                //log(question)
            }
        })
    }

    function *recordSrc(wholeSrcOfQuestion, recordPath) {
        //fs.writeFile(recordPath,JSON.stringify(wholeSrcOfQuestion),(err)=>{});
        let filter = yield fs.readFile(recordPath, (err, data)=> {
            let newSrc = [];
            if (err) {
                let onlySrc = [];
                for (let srcWithPeople of wholeSrcOfQuestion) {
                    onlySrc.push(srcWithPeople.src)
                }
                fs.writeFile(recordPath, JSON.stringify(onlySrc), (err)=> {
                    if (err) log(err)
                });
                downloadIterator.next(wholeSrcOfQuestion)
            } else {
                let writedSrc = JSON.parse(data);
                for (let srcWithPeople of wholeSrcOfQuestion) {
                    if (writedSrc.indexOf(srcWithPeople.src) == -1) newSrc.push(srcWithPeople)
                }
                downloadIterator.next(newSrc);
                // downloadIterator.next(wholeSrcOfQuestion)
            }
        });
        return filter
    }

    function *recordAndGo(wholeSrcOfQuestion) {
        let recordPath = 'zhihu/user-spider/userImageRecord/' + user.id + '.js';
        let filterSrc = yield * recordSrc(wholeSrcOfQuestion, recordPath);
        yield * ready(filterSrc);
    }

    function *ready(wholeSrcOfQuestion) {
        let length = wholeSrcOfQuestion.length;
        log('find', length, ' images');
        if (length) {
            yield *writeImages(wholeSrcOfQuestion, user, downloadIterator, notifyOfContinue, 'pic/' + user.id);
        } else {
            notifyOfContinue();
        }

    }

    function notifyOfContinue() {
        //singleDownload=true;
        if (!singleDownload && index < user_img_list.length - 1) {
            writeStart(++index)
        } else {
            log('all finished!!!')
        }
    }


    /*get*/
    indexGet(page);
}


process.on('uncaughtException', (err) => {
    log(err);
});

function fetchImageOfUser(href,id,title){
    fs.readFile(__dirname+'/user-list.js','utf8',(err,data)=>{
        let currentSrcArr=JSON.parse(data);
        let newSrc={href,id,name:title,index:currentSrcArr.length};
        currentSrcArr.push(newSrc);
        fs.writeFile(__dirname+'/user-list.js',JSON.stringify(currentSrcArr),(err)=>{
            if(err){
                log(err)
            }else{
                writeStart(currentSrcArr.length-1,currentSrcArr)
            }
        })
    });

}

module.exports={
    fetchImageOfUser,
    writeStart
};

exports.writeStart = writeStart;
