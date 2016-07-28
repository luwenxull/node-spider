let cheerio = require('cheerio');
let log = console.log;
let fs = require('fs');
let path = require('path');
let request = require('request');
// let question_img_list = require('./img-list');

let cookieValue = require('../cookie');

/*写图片*/
let {writeImages}=require('../../util/groupDownload');

/*参数*/
let pageSize = 10
    , offset = 10;
let baseGetUrl = 'https://www.zhihu.com/question/'
    , basePostUrl = 'https://www.zhihu.com/node/QuestionAnswerListV2'
    , collapsedAnswers = 'https://www.zhihu.com/node/QuestionCollapsedAnswerListV2';

let j = request.jar();
let cookie = request.cookie(cookieValue);
j.setCookie(cookie, 'https://www.zhihu.com');

function prepareForWrite(href) {
    let singleDownload = true,
        downloadIterator;
    let ni_ming_index = 0;
    let wholeSrcOfQuestion = [];

    let qid, title;

    function indexGet(fn) {
        let optionsOfGet = {
            method: 'GET',
            url: baseGetUrl + href,
            jar: j
        };
        request(optionsOfGet, (err, res, body) => {
            if (err) log(err);
            // fs.writeFile('index-'+question.href+'.html',body,()=>{});
            let $ = cheerio.load(body);
            qid = $('#zh-question-detail').data('resourceid');
            title = $('title').text().replace(/\s/g,'').slice(0,-4);
            fn(qid,title,()=>{
                log('find', findImgOfAuthorAndConcat($), ' images of index,total:', wholeSrcOfQuestion.length, 'continue...');
                getCollapsedAnswers();
            });

        });
    }

    function *recordSrc(recordPath) {
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
                let ifNewSrc = false;
                for (let srcWithPeople of wholeSrcOfQuestion) {
                    if (writedSrc.indexOf(srcWithPeople.src) == -1) {
                        ifNewSrc = true;
                        newSrc.push(srcWithPeople);
                        writedSrc.push(srcWithPeople.src)
                    }
                }

                if (ifNewSrc) {
                    fs.writeFile(recordPath, JSON.stringify(writedSrc), (err)=> {
                        if (err) log(err)
                    });
                }
                downloadIterator.next(newSrc);

            }
        });
        return filter
    }

    function *recordAndGo() {
        let recordPath = 'zhihu/question-spider/questionImageRecord/' + href + '.js';
        let filterSrc = yield * recordSrc(recordPath);

        yield * ready(filterSrc);
    }

    function *ready(wholeSrcOfQuestion) {
        let length = wholeSrcOfQuestion.length;
        log('find', length, ' images');
        if (length) {
            yield *writeImages(wholeSrcOfQuestion, {href,qid,title,dir:href+'-'+title}, downloadIterator, notifyOfContinue);
        } else {
            notifyOfContinue();
        }

    }


    function findImgOfAuthorAndConcat($) {
        let href, people, imgs, src;
        let count = 0;
        $('.zm-item-answer').each((index, answer) => {
            href = $(answer).find('.author-link').attr('href');
            if (href) {
                people = href.replace('/people/', '') + '#';
            }
            else {
                people = 'ni-ming' + (ni_ming_index++) + '#'
            }
            imgs = $(answer).find('.zm-editable-content').find('img').each((index, img) => {
                src = $(img).attr('src').replace('_b', '_r');
                if (src.search('http') != -1) {
                    count++;
                    wholeSrcOfQuestion.push({
                        people, src
                    });
                }
            })
        });
        return count;
    }


    function getOptionsOfPost(offset) {
        return {
            method: 'POST',
            url: basePostUrl,
            headers: {'content-type': 'application/x-www-form-urlencoded'},
            form: {
                method: 'next',
                params: '{"url_token":' + href + ',"pagesize":' + pageSize + ',"offset":' + offset + '}'
            }
        };
    }

    function loopPost(offset) {
        let options = getOptionsOfPost(offset);
        let got = false, rePost = false;
        let timeout = setTimeout(()=> {
            rePost = true;
            loopPost(offset)
        }, 5000);
        request(options, function (error, response, body) {
            try {
                if (error) throw new Error(error);
                if (!rePost) {
                    clearTimeout(timeout);
                    //log(body);
                    let json = JSON.parse(body)
                        , $;
                    let src;

                    if (json.msg.length !== 0) {
                        let count = 0;
                        for (let htmlString of json.msg) {
                            $ = cheerio.load(htmlString);
                            count += findImgOfAuthorAndConcat($)
                        }
                        log('find', count, ' images in offset', offset / 10, ',total:', wholeSrcOfQuestion.length, 'continue...');
                        loopPost(offset + 10);
                    } else {
                        fs.access('pic/' + href+'-'+title, err=> {
                            if (err) {
                                fs.mkdirSync('pic/' + href+'-'+title);
                            }
                            downloadIterator = recordAndGo();
                            downloadIterator.next();
                        });
                    }
                }
            }
            catch (err) {
                log(err);
                if (!rePost) {
                    clearTimeout(timeout);
                    loopPost(offset);
                }

            }
        });
    }

    function getCollapsedAnswers() {
        let options = {
            method: 'GET',
            url: collapsedAnswers + '?params=%7B%22question_id%22%3A' + qid + '%7D',
            //qs:{ params: '%7B%22question_id%22%3A6976557%7D' },
            jar: j
        };
        log('retrieve collapsed answers >>>');
        request(options, (err, res, body)=> {
            if (err) {
                log(err)
            }
            let $ = cheerio.load(body);
            log('find', findImgOfAuthorAndConcat($), ' images of collapsed answers ,total:', wholeSrcOfQuestion.length, 'continue...');
            loopPost(10)
        });

        // loopPost(10)
    }

    function notifyOfContinue() {
        /*if (!singleDownload && index < question_img_list.length - 1) {
            writeStart(++index)
        } else {
            log('all finished!!!')
        }*/
        log('download finish!')
    }

    return indexGet
}


process.on('uncaughtException', (err) => {
    log('uncaughtException:',err.name,err.message)
    // log(err);
});


function ifAlreadyRecord(item, arr) {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i].href === item.href) {
            return {
                recorded: true,
                index: i
            }
        }
    }
    return {recorded: false}
}

function fetchImageOfQuestion(href) {

    let indexGet = prepareForWrite(href);
    indexGet(function (qid,title,callback) {
        fs.readFile(__dirname + '/img-list.js', 'utf8', (err, data)=> {
            let currentSrcArr = JSON.parse(data);
            let newSrc = {href, qid, title, index: currentSrcArr.length};
            //log(newSrc);
            let result = ifAlreadyRecord(newSrc, currentSrcArr);
            if (result.recorded) {
                log('Already Record!Start to fetch images!');
                // writeStart(result.index, currentSrcArr)
                callback();
            } else {
                currentSrcArr.push(newSrc);
                fs.writeFile(__dirname + '/img-list.js', JSON.stringify(currentSrcArr), (err)=> {
                    if (err) {
                        log(err)
                    } else {
                        // writeStart(currentSrcArr.length - 1, currentSrcArr)
                        callback()
                    }
                })
            }

        });
    });


}

module.exports = {
    fetchImageOfQuestion
    // writeStart
};
/*
 exports.writeStart = writeStart;
 exports.fetchImageOfQuestion=fetchImageOfQuestion();
 */