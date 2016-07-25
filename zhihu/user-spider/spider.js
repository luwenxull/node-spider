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
    let singleDownload = true;
    let downloadIterator;

    let user = user_img_list[index],
        srcCollection = [];

    let page=1;
    let indexGet = function (page) {
        let options = {
            method: 'GET',
            url: baseGetUrl.replace('$$id', user.id),
            qs: {page: page}
        };

        log('retrieve page',page);
        request(options, (err, res, body) => {
            if (err) {
                log(err)
            } else {
                let $ = cheerio.load(body);
                // log(body);
                findQuestionWithImage($)
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
            if(answerWithImage.length){
                for (let answer of answerWithImage) {
                    request.get(deepQuestionUrl + answer, (err, res, body)=> {
                        if (err) {
                            log(err);
                            count++;
                        } else {
                            let $ = cheerio.load(body);
                            getUserQuestionImages($, srcCollection);
                            count++;
                            if (count == answerWithImage.length) {
                                // log(srcCollection)
                                indexGet(++page)
                            }
                        }

                    })
                }
            }else{
                indexGet(++page)
            }

        }else{
            downloadIterator=recordAndGo(srcCollection);
            downloadIterator.next();
            // log(srcCollection)
        }
    }


    function getUserQuestionImages($) {
        $('.zm-editable-content img').each((index, img)=> {
            let src = $(img).attr('src').replace('_b', '_r');
            if (src.search('http') != -1) {
                srcCollection.push({
                    src
                });
            }
        })
    }

    indexGet(page);

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
            yield *writeImages(wholeSrcOfQuestion,user, downloadIterator, notifyOfContinue);
        } else {
            notifyOfContinue();
        }

    }

    function notifyOfContinue() {
        if (!singleDownload && index < user_img_list.length - 1) {
            writeStart(++index)
        } else {
            log('all finished!!!')
        }
    }
}



process.on('uncaughtException', (err) => {
    log(err);
});

exports.writeStart = writeStart;
