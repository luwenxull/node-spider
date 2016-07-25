let cheerio = require('cheerio');
let log = console.log;
let fs = require('fs');
let path = require('path');
let request = require('request');
let question_img_list = require('./img-list');

/*写图片*/
let {writeImages}=require('./../writeImages');

/*参数*/
let pageSize = 10
    , offset = 10;
let baseGetUrl = 'https://www.zhihu.com/question/'
    , basePostUrl = 'https://www.zhihu.com/node/QuestionAnswerListV2';
let downloadIterator;

let currentQuestionIndex,
    singleDownload = false;

let globalSettings = {};
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
    let recordPath = 'zhihu/question-spider/questionImageRecord/' + globalSettings.currentQuestion.id + '.js';
    let filterSrc = yield * recordSrc(wholeSrcOfQuestion, recordPath);
    yield * ready(filterSrc);
}

function *ready(wholeSrcOfQuestion) {
    let length = wholeSrcOfQuestion.length;
    log('find', length, ' images');
    if (length) {
        yield *writeImages(wholeSrcOfQuestion, globalSettings.currentQuestion, downloadIterator, notifyOfContinue);
    } else {
        notifyOfContinue();
    }

}

function getImageUrl() {
    let ni_ming_index = 0;
    let wholeSrcOfQuestion = [];
    indexGet(wholeSrcOfQuestion, ni_ming_index);
}

function findImgOfAuthorAndConcat($, wholeSrcOfQuestion, ni_ming_index) {
    let href, people, imgs, src;
    $('.zm-item-answer').each((index, answer) => {
        href = $(answer).find('.author-link').attr('href');
        if (href) {
            people = href.replace('/people/', '') + '#';
        }
        else {
            people = 'ni-ming' + (ni_ming_index++) + '#'
        }
        //log(href,people);
        imgs = $(answer).find('.zm-editable-content').find('img').each((index, img) => {
            src = $(img).attr('src').replace('_b', '_r');
            if (src.search('http') != -1) {
                wholeSrcOfQuestion.push({
                    people, src
                });
            }
        })
    });
    return ni_ming_index;
}

function indexGet(wholeSrcOfQuestion, ni_ming_index) {
    let optionsOfGet = {
        method: 'GET', url: baseGetUrl + globalSettings.currentQuestion.id
    };
    request(optionsOfGet, (err, res, body) => {
        if (err) log(err);
        let $ = cheerio.load(body);
        loopPost(10, wholeSrcOfQuestion, findImgOfAuthorAndConcat($, wholeSrcOfQuestion, ni_ming_index));
    });
}

function getOptionsOfPost(offset) {
    return {
        method: 'POST',
        url: basePostUrl,
        headers: {'content-type': 'application/x-www-form-urlencoded'},
        form: {
            method: 'next',
            params: '{"url_token":' + globalSettings.currentQuestion.id + ',"pagesize":' + pageSize + ',"offset":' + offset + '}'
        }
    };
}

function loopPost(offset, wholeSrcOfQuestion, ni_ming_index) {
    let options = getOptionsOfPost(offset);
    let got = false, rePost = false;
    let timeout = setTimeout(()=> {
        rePost = true;
        loopPost(offset, wholeSrcOfQuestion, ni_ming_index)
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
                    for (let htmlString of json.msg) {
                        $ = cheerio.load(htmlString);
                        ni_ming_index = findImgOfAuthorAndConcat($, wholeSrcOfQuestion, ni_ming_index)
                    }
                    log('retrieve images...,find:', wholeSrcOfQuestion.length);
                    loopPost(offset + 10, wholeSrcOfQuestion, ni_ming_index);
                } else {
                    fs.access('pic/' + globalSettings.currentQuestion.id, err=> {
                        if (err) {
                            fs.mkdirSync('pic/' + globalSettings.currentQuestion.id);
                        }
                        //log(wholeSrcOfQuestion);
                        downloadIterator = recordAndGo(wholeSrcOfQuestion);
                        downloadIterator.next();
                    });
                }
            }
        }
        catch (err) {
            log(err);
            if (!rePost) {
                clearTimeout(timeout);
                loopPost(offset, wholeSrcOfQuestion, ni_ming_index);
            }

        }
    });
}

function writeStart(index) {
    singleDownload = true;
    currentQuestionIndex = index;

    globalSettings.currentQuestion = question_img_list[index];
    getImageUrl();
    /*getImages({
     questionId: '30994559',
     //index:21
     })*/
}

function notifyOfContinue() {
    if (!singleDownload && currentQuestionIndex < question_img_list.length - 1) {
        writeStart(++currentQuestionIndex)
    } else {
        log('all finished!!!')
    }
}

process.on('uncaughtException', (err) => {
    log(err);
});

exports.writeStart = writeStart;
