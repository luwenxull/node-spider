let cheerio = require('cheerio');
let log = console.log;
let fs = require('fs');
let path = require('path');
let request = require('request');
let question_img_list = require('./question-img-list');
/*参数*/
let questionId;
let pageSize = 10
    , offset = 10;
let baseGetUrl = 'https://www.zhihu.com/question/'
    , basePostUrl = 'https://www.zhihu.com/node/QuestionAnswerListV2';
let downloadCount = 0
    , downloadIterator;

let questionStatistic = {};
//    let writeStart=new Date();
let currentOffsetStart, currentOffsetEnd, finish;

let currentQuestionIndex = 5,
    singleDownload = false;
/*延时计时*/
let timeoutCheck;

function *recordSrc(srcOfThisQuestion, recordPath) {
    //fs.writeFile(recordPath,JSON.stringify(srcOfThisQuestion),(err)=>{});
    let filter = yield fs.readFile(recordPath, (err, data)=> {
        let newSrc = [];
        if (err) {
            let onlySrc = [];
            for (let srcWithPeople of srcOfThisQuestion) {
                onlySrc.push(srcWithPeople.src)
            }
            fs.writeFile(recordPath, JSON.stringify(onlySrc), (err)=> {
                if (err) log(err)
            });
            downloadIterator.next(srcOfThisQuestion)
        } else {
            let writedSrc = JSON.parse(data);
            for (let srcWithPeople of srcOfThisQuestion) {
                if (writedSrc.indexOf(srcWithPeople.src) == -1) newSrc.push(srcWithPeople)
            }
            downloadIterator.next(newSrc)
        }
    });
    return filter
}

function *recordAndGo(srcOfThisQuestion) {
    let recordPath = 'zhihu/srcDownloaded/' + questionId + '.js';
    let filterSrc = yield * recordSrc(srcOfThisQuestion, recordPath);
    yield * ready(filterSrc);
}

function* ready(srcOfThisQuestion) {
    let length = srcOfThisQuestion.length;
    log('总共筛选', length, '张~');
    questionStatistic[questionId] = {
        currentWriteCount: 0,
        wholeWriteCount: srcOfThisQuestion.length,
        failList: []
    };
    //log(questionStatistic);
    let streamOfOneQuestion = [];
    for (let i = 0; i < srcOfThisQuestion.length; i++) {
        srcOfThisQuestion[i].index = i;
        srcOfThisQuestion[i].questionId = questionId;
    }
    for (let srcIndex = 0; srcIndex < srcOfThisQuestion.length / 20; srcIndex++) {
        let offsetStart = srcIndex * 20
            , offsetEnd = srcIndex * 20 + 20;
        if (offsetEnd > length) offsetEnd = length;
        let slice = srcOfThisQuestion.slice(offsetStart, offsetEnd);
        log('下载', offsetStart, '~', offsetEnd - 1, '...');
        currentOffsetStart = offsetStart;
        currentOffsetEnd = offsetEnd - 1;
        yield writeImages(slice, srcOfThisQuestion, offsetStart, offsetEnd - 1, streamOfOneQuestion);
    }
}
//    downloadIterator.next();

function writeImages(slice, srcOfThisQuestion, offsetStart, offsetEnd, streamOfOneQuestion) {
    if (slice.length) {
        for (let i = 0; i < slice.length; i++) {
            writeImage(slice[i], srcOfThisQuestion, offsetStart, offsetEnd, streamOfOneQuestion)
        }

        timeoutCheck = setTimeout(() => {
            writeCheck(true, streamOfOneQuestion, offsetEnd - offsetStart + 1);
        }, 20000)
    }
}

function compare(index, cid) {
    let flag1 = index >= currentOffsetStart,
        flag2 = index <= currentOffsetEnd,
        flag3 = cid === questionId;
    //log('compare->>>',flag1,flag2,index,currentOffsetStart,currentOffsetEnd);
    return (flag1 && flag2 && flag3)
}

function writeImage(srcObj, srcOfThisQuestion, offsetStart, offsetEnd, streamOfOneQuestion) {
    let {src, people, index} = srcObj;
    try {
        let stream = fs.createWriteStream(path.join('pic', questionId, people + path.basename(src)));
        streamOfOneQuestion.push(stream);
        stream.on('close', () => {
            //log(total++, '张');
            streamOfOneQuestion.splice(streamOfOneQuestion.indexOf(stream), 1);
            if (questionStatistic[questionId])
                questionStatistic[questionId].currentWriteCount++;
            if (compare(index, srcObj.questionId)) {
                downloadCount++;
                log('saved', src, index, offsetStart, '~', offsetEnd, srcOfThisQuestion.length, srcObj.questionId);
                writeCheck(false, streamOfOneQuestion, offsetEnd - offsetStart + 1);
            } else {
                log('save defer!', src, index, offsetStart, '~', offsetEnd, srcOfThisQuestion.length, srcObj.questionId);
            }
        }).on('error', err => {
            //log(err);
            stream.end();
            streamOfOneQuestion.splice(streamOfOneQuestion.indexOf(stream), 1);
            log('faild', src, index, offsetStart, '~', offsetEnd, srcObj.questionId);
            if (compare(index, srcObj.questionId)) {
                downloadCount++;
                writeCheck(false, streamOfOneQuestion, offsetEnd - offsetStart + 1);
            }
            questionStatistic[questionId].failList.push(srcObj)
        });
        request(src).pipe(stream);
    }
    catch (err) {
        log(err)
    }
}

function done(streamOfOneQuestion, countToBeCheck) {
    log('无响应：', streamOfOneQuestion.length);
    let stat = questionStatistic[questionId];
    for (let s of streamOfOneQuestion) {
        s.end();
    }
    log('下载完成!总共:', stat.wholeWriteCount, '下载:', stat.currentWriteCount);
    if (!singleDownload && currentQuestionIndex < question_img_list.length)
        return getImages(question_img_list[currentQuestionIndex++]);
}
function writeCheck(timeout, streamOfOneQuestion, countToBeCheck) {
    //log(questionStatistic);
    if (timeout) {
        log('等待', countToBeCheck - downloadCount, '张');
        downloadCount = 0;
        if (downloadIterator.next().done)
            done(streamOfOneQuestion, countToBeCheck)

    }
    if (downloadCount == countToBeCheck) {
        clearTimeout(timeoutCheck);
        downloadCount = 0;
        if (downloadIterator.next().done)
            done(streamOfOneQuestion, countToBeCheck)

    }


}

function findImgOfAuthorAndConcat($, srcOfThisQuestion, ni_ming_index) {
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
                srcOfThisQuestion.push({
                    people, src
                });
            }
        })
    })
}

function getImages(question) {
    questionId = question.questionId;
    let ni_ming_index = 0;
    let srcOfThisQuestion = [];
    let optionsOfGet = {
        method: 'GET', url: baseGetUrl + questionId
    };
    request(optionsOfGet, (err, res, body) => {
        if (err) throw err;
        let src, $ = cheerio.load(body);
        findImgOfAuthorAndConcat($, srcOfThisQuestion, ni_ming_index);
        loopGet(10);
    });
    let getOptionsOfPost = function (offset) {
        return {
            method: 'POST'
            , url: basePostUrl
            , headers: {
                'content-type': 'application/x-www-form-urlencoded'
            }
            , form: {
                method: 'next'
                , params: '{"url_token":' + questionId + ',"pagesize":' + pageSize + ',"offset":' + offset + '}'
            }
        };
    };
    let loopGet = function (offset) {
        let options = getOptionsOfPost(offset);
        let got = false, reGet = false;
        setTimeout(()=> {
            if (!got) {
                reGet = true;
                loopGet(offset)
            }
        }, 5000);
        request(options, function (error, response, body) {
            try {
                if (error) throw new Error(error);
                if (!reGet) {
                    got = true;
                    let json = JSON.parse(body)
                        , $;
                    let src, imgs;
                    for (let htmlString of json.msg) {
                        $ = cheerio.load(htmlString);
                        findImgOfAuthorAndConcat($, srcOfThisQuestion, ni_ming_index)
                    }
                    if (json.msg.length !== 0) {
                        log('检索图片地址...', srcOfThisQuestion.length, '张');
                        loopGet(offset + 10);
                    }
                    else {
                        fs.access('pic/' + questionId, err=> {
                            if (err) {
                                fs.mkdirSync('pic/' + questionId);
                            }
                            downloadIterator = recordAndGo(srcOfThisQuestion);
                            downloadIterator.next();
                        });
                        //fs.writeFile('tempSrcList.js', JSON.stringify(srcOfThisQuestion));
                    }
                }
            }
            catch (err) {
                log(err);
                loopGet(offset);
            }
        });
    };
}

function writeStart() {
    //singleDownload = true;
    getImages(question_img_list[currentQuestionIndex++]);
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
        let srcOfThisQuestion = JSON.parse(data);
        downloadIterator = ready(srcOfThisQuestion);
        downloadIterator.next();
    })
}

process.on('uncaughtException', (err) => {
    log(err);
});

exports.writeStart = writeStart;
exports.reWrite = reWrite;