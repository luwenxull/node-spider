let cheerio = require('cheerio');
let log = console.log;
let fs = require('fs');
let path = require('path');
let request = require('request');
let question_img_list = require('./question-img-list');

/*写图片*/
let {writeImages,willWrite}=require('./writeImages');

/*参数*/
let pageSize = 10
    , offset = 10;
let baseGetUrl = 'https://www.zhihu.com/question/'
    , basePostUrl = 'https://www.zhihu.com/node/QuestionAnswerListV2';
let downloadIterator;

let currentQuestionIndex,
    singleDownload = false;

let globalSettings={};
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
            downloadIterator.next(newSrc)
        }
    });
    return filter
}

function *recordAndGo(wholeSrcOfQuestion) {
    let recordPath = 'zhihu/srcDownloaded/' + globalSettings.currentQuestion.questionId + '.js';
    let filterSrc = yield * recordSrc(wholeSrcOfQuestion, recordPath);
    yield * ready(filterSrc);
}

function *ready(wholeSrcOfQuestion) {
    let length = wholeSrcOfQuestion.length;
    log('总共筛选', length, '张~');
    if(length){
        let id=globalSettings.currentQuestion.questionId;
        willWrite(id,length);
        for (let i = 0; i < wholeSrcOfQuestion.length; i++) {
            wholeSrcOfQuestion[i].index = i;
            wholeSrcOfQuestion[i].id = id;
        }

        for (let srcIndex = 0; srcIndex < wholeSrcOfQuestion.length / 20; srcIndex++) {
            let offsetStart = srcIndex * 20
                , offsetEnd = srcIndex * 20 + 20;
            if (offsetEnd > length) offsetEnd = length;
            let slice = wholeSrcOfQuestion.slice(offsetStart, offsetEnd);
            yield writeImages({slice,whole:wholeSrcOfQuestion},{offsetStart,offsetEnd:offsetEnd-1},downloadIterator)
        }
    }
    log(singleDownload,currentQuestionIndex,question_img_list.length)
    if (!singleDownload && currentQuestionIndex < question_img_list.length-1)
        return writeStart(++currentQuestionIndex);
}

function getImageUrl(question) {

    let ni_ming_index = 0;
    let wholeSrcOfQuestion = [];
    indexGet(wholeSrcOfQuestion,ni_ming_index);
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

function indexGet(wholeSrcOfQuestion,ni_ming_index){
    let optionsOfGet = {
        method: 'GET', url: baseGetUrl + globalSettings.currentQuestion.questionId
    };
    request(optionsOfGet, (err, res, body) => {
        if (err) log(err);
        let $ = cheerio.load(body);
        loopPost(10,wholeSrcOfQuestion,findImgOfAuthorAndConcat($, wholeSrcOfQuestion, ni_ming_index));
    });
}

function getOptionsOfPost(offset) {
    return {
        method: 'POST'
        , url: basePostUrl
        , headers: {
            'content-type': 'application/x-www-form-urlencoded'
        }
        , form: {
            method: 'next'
            , params: '{"url_token":' + globalSettings.currentQuestion.questionId + ',"pagesize":' + pageSize + ',"offset":' + offset + '}'
        }
    };
}

function loopPost(offset,wholeSrcOfQuestion,ni_ming_index) {
    let options = getOptionsOfPost(offset);
    let got = false, rePost = false;
    setTimeout(()=> {
        if (!got) {
            rePost = true;
            loopPost(offset,wholeSrcOfQuestion,ni_ming_index)
        }
    }, 5000);
    request(options, function (error, response, body) {
        try {
            if (error) throw new Error(error);
            if (!rePost) {
                got = true;
                //log(body);
                let json = JSON.parse(body)
                    , $;
                let src;

                if (json.msg.length !== 0) {
                    for (let htmlString of json.msg) {
                        $ = cheerio.load(htmlString);
                        ni_ming_index=findImgOfAuthorAndConcat($, wholeSrcOfQuestion, ni_ming_index)
                    }
                    log('检索图片地址...', wholeSrcOfQuestion.length, '张');
                    loopPost(offset + 10,wholeSrcOfQuestion, ni_ming_index);
                } else {
                    fs.access('pic/' + globalSettings.currentQuestion.questionId, err=> {
                        if (err) {
                            fs.mkdirSync('pic/' + globalSettings.currentQuestion.questionId);
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
            loopPost(offset);
        }
    });
}

function writeStart(index) {
    //singleDownload = true;
    currentQuestionIndex=index;
    let currentQuestion=question_img_list[index];
    globalSettings.currentQuestion=currentQuestion;
    getImageUrl(currentQuestion);
    /*getImages({
     questionId: '30994559',
     //index:21
     })*/
}

function reWrite(id) {
    questionId = id;
    fs.mkdirSync('pic/' + id);
    fs.readFile('tempSrcList.js', {
        encoding: 'utf8'
    }, (err, data) => {
        if (err) throw err;
        let wholeSrcOfQuestion = JSON.parse(data);
        downloadIterator = ready(wholeSrcOfQuestion);
        downloadIterator.next();
    })
}

process.on('uncaughtException', (err) => {
    log(err);
});

exports.writeStart = writeStart;
exports.reWrite = reWrite;