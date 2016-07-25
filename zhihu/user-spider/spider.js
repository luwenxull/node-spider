/**
 * Created by luwenxu on 2016/7/25.
 */
let cheerio = require('cheerio');
let log = console.log;
let fs = require('fs');
let path = require('path');
let request = require('request');
let user_img_list = require('./user-list');

/*写图片*/
let {writeImages}=require('./../writeImages');

let baseGetUrl = 'https://www.zhihu.com/people/$$id/answers',
    deepQuestionUrl = 'https://www.zhihu.com';


function writeStart(index) {
    let singleDownload = false;
    let downloadIterator;

    let user = user_img_list[index],
        srcCollection = [];

    let page = 1;

    /*zhihu cookie*/
    let j = request.jar();

    //let cookie=request.cookie('q_c1=cb283635a2754dfdac9779853e1b425e|1469447248000|1469447248000;_xsrf=f57a2d71687e156598a2256f7467459f;d_c0="AHCA9ROMSAqPTgKXzEqnOHvw3Y8fuupAw2Y=|1469447250";_zap=589ea08c-c214-4c0b-b8aa-453b635f6478;_za=4f864a44-21bc-47f6-a364-8d70db60e99e;l_cap_id="YThlZjYwNDY3ZjUyNDhlZmFiODIyODc3MmRlMjM0MzU=|1469447550|aa5d4eab880e360f84a939d1ea707e7a8307a051"; cap_id="YmQ1ZDdiOTNhYTA1NDc1Yjg5ZDRkNTgzODkxZDgxOGE=|1469447550|1fd229b6065c0150af9304f3b33734b383c02ed1"; login="ZmU2ZDY0ZjE0NWE1NDUwYTliZTgwZWU4ZGJiNzRlYTc=|1469447575|4a36d14a89f814742cf1d82993a9c0b99b62e9cb"; a_t="2.0AAAAUYkgAAAXAAAAl4q9VwAAAFGJIAAAAHCA9ROMSAoXAAAAYQJVTZeKvVcAMdqqxNHKvecJsMsSboBGrp2T62jVZIiGoc5YPnTclFKRHnwr9f6j5A=="; z_c0=Mi4wQUFBQVVZa2dBQUFBY0lEMUU0eElDaGNBQUFCaEFsVk5sNHE5VndBeDJxckUwY3E5NXdtd3l4SnVnRWF1blpQcmFB|1469447575|f51f5da0aa9b63afea447656e22cba0deeb3509e; n_c=1; s-q=leimeitaisi; s-i=1; sid=286t5368; s-t=autocomplete; __utmt=1; __utma=51854390.1542997138.1469447251.1469447251.1469450783.2; __utmb=51854390.16.9.1469451606938; __utmc=51854390; __utmz=51854390.1469450783.2.2.utmcsr=zhihu.com|utmccn=(referral)|utmcmd=referral|utmcct=/; __utmv=51854390.100-1|2=registration_date=20131111=1^3=entry_date=20131111=1');
    let cookie = request.cookie('z_c0=Mi4wQUFBQVVZa2dBQUFBY0lEMUU0eElDaGNBQUFCaEFsVk5sNHE5VndBeDJxckUwY3E5NXdtd3l4SnVnRWF1blpQcmFB|1469447575|f51f5da0aa9b63afea447656e22cba0deeb3509e;a=1')
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

        log('retrieve', page);
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
                    // log(body);

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
                if (img.length) {
                    answerWithImage.push(href)
                }
            });
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

exports.writeStart = writeStart;
