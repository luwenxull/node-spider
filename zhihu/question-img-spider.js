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
    , wholeDownloadCount=0
    , downloadIterator;
//    let writeStart=new Date();
let currentOffsetStart, currentOffsetEnd, finish;

let currentQuestionIndex = 0;
/*延时计时*/
let timeoutCheck;

function* ready(srcOfThisQuestion) {
    log('总共筛选', srcOfThisQuestion.length, '张~');
    for (let i = 0; i < srcOfThisQuestion.length; i++) {
        srcOfThisQuestion[i].index = i;
        srcOfThisQuestion[i].questionId = questionId;
    }
    for (let srcIndex = 0; srcIndex < srcOfThisQuestion.length / 20; srcIndex++) {
        let offsetStart = srcIndex * 20
            , offsetEnd = srcIndex * 20 + 20;
        let slice = srcOfThisQuestion.slice(offsetStart, offsetEnd);
        log('下载', offsetStart, '~', offsetEnd - 1, '...');
        currentOffsetStart = offsetStart;
        currentOffsetEnd = offsetEnd - 1;
        yield writeImages(slice, srcOfThisQuestion, offsetStart, offsetEnd - 1);
    }
}
//    downloadIterator.next();

function writeImages(slice, srcOfThisQuestion, offsetStart, offsetEnd) {
    for (let i = 0; i < slice.length; i++) {
        writeImage(slice[i], srcOfThisQuestion, offsetStart, offsetEnd)
    }
    timeoutCheck = setTimeout(() => {
        writeCheck(true);
    }, 20000)
}

function compare(index,cid) {
    let flag1 = index >= currentOffsetStart,
        flag2 = index <= currentOffsetEnd,
        flag3=cid===questionId;
    //log('compare->>>',flag1,flag2,index,currentOffsetStart,currentOffsetEnd);
    return (flag1 && flag2 && flag3)
}
function writeImage(srcObj, srcOfThisQuestion, offsetStart, offsetEnd) {
    let {src, people, index} = srcObj;
    try {
        request(src).pipe(fs.createWriteStream(path.join('pic', questionId, people + path.basename(src)))).on('finish', () => {
            if (compare(index,srcObj.questionId)) {
                downloadCount++;
                log('saved', src, index, offsetStart, '~', offsetEnd, srcObj.questionId);
                writeCheck();
            } else {
                log('save defer!', src, index, offsetStart, '~', offsetEnd, srcObj.questionId);
            }

        }).on('error', err => {
            if (compare(index,srcObj.questionId)) {
                downloadCount++;
                writeCheck();
            }
            log('faild', src, index, offsetStart, '~', offsetEnd, srcObj.questionId);
        });
        if (index === srcOfThisQuestion.length - 1) {
            //            log('finish')
            finish = true;
        }
    }
    catch (err) {
        log(err)
    }
}

function writeCheck(timeout) {
    if (timeout) {
        if (finish) {
            log('下载完成!');
            downloadCount = 0;
            //return getImages(question_img_list[currentQuestionIndex++]);
        }
        log('等待', 20 - downloadCount, '张');
        downloadCount = 0;
        downloadIterator.next();
    }
    if (downloadCount == 20) {
        downloadCount = 0;
        clearTimeout(timeoutCheck);
        downloadIterator.next();
    }
}

function findImgOfAuthorAndConcat($, srcOfThisQuestion) {
    let href, people, imgs, src;
    $('.zm-item-answer').each((index, answer) => {
        href = $(answer).find('.author-link').attr('href');
        if (href) {
            people = href.replace('/people/', '') + '#';
        }
        else {
            people = 'ni-ming#'
        }
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
    let srcOfThisQuestion = [];
    let optionsOfGet = {
        method: 'GET', url: baseGetUrl + questionId
    };
    request(optionsOfGet, (err, res, body) => {
        if (err) throw err;
        let src, $ = cheerio.load(body);
        findImgOfAuthorAndConcat($, srcOfThisQuestion);
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
        let got=false,reGet=false;
        setTimeout(()=>{
            if(!got){
                reGet=true;
                loopGet(offset)
            }
        },5000);
        request(options, function (error, response, body) {
            try {
                if (error) throw new Error(error);
                got=true;
                let json = JSON.parse(body)
                    , $;
                let src, imgs;
                for (let htmlString of json.msg) {
                    $ = cheerio.load(htmlString);
                    findImgOfAuthorAndConcat($, srcOfThisQuestion)
                }
                if (json.msg.length !== 0) {
                    log('检索图片地址...', srcOfThisQuestion.length, '张');
                    loopGet(offset + 10);
                }
                else {
                    fs.mkdirSync('pic/' + questionId);
                    //fs.writeFile('tempSrcList.js', JSON.stringify(srcOfThisQuestion));
                    downloadIterator = ready(srcOfThisQuestion);
                    downloadIterator.next();
                }
            }
            catch (err) {
                log(err);
                loopGet(offset);
            }
        });
    };
    /*request('https://pic3.zhimg.com/f50715d8d94f0cb09bc2bef264f402e2_b.jpg').pipe(fs.createWriteStream(path.join('pic', path.basename('test.jpg'))))*/
}

function writeStart() {
    //log(question_img_list[15]);
    //getImages(question_img_list[currentQuestionIndex++])
    getImages(question_img_list[1])
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
exports.writeStart = writeStart;
exports.reWrite = reWrite;