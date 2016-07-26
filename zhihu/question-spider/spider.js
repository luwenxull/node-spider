let cheerio = require('cheerio');
let log = console.log;
let fs = require('fs');
let path = require('path');
let request = require('request');
// let question_img_list = require('./img-list');

let cookieValue=require('../cookie');

/*写图片*/
let {writeImages}=require('./../writeImages');

/*参数*/
let pageSize = 10
    , offset = 10;
let baseGetUrl = 'https://www.zhihu.com/question/'
    , basePostUrl = 'https://www.zhihu.com/node/QuestionAnswerListV2'
    , collapsedAnswers='https://www.zhihu.com/node/QuestionCollapsedAnswerListV2';

function writeStart(index,question_img_list) {
    let singleDownload = true,
        downloadIterator;
    let ni_ming_index=0;
    let wholeSrcOfQuestion=[];

    let question = question_img_list[index],
        qid=question.qid;

    // log(index,question_img_list);


    function indexGet() {
        let optionsOfGet = {
            method: 'GET', url: baseGetUrl + question.href
        };
        request(optionsOfGet, (err, res, body) => {
            if (err) log(err);
            let $ = cheerio.load(body);
            findImgOfAuthorAndConcat($);
            // loopPost(10);
            getCollapsedAnswers();
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
                let ifNewSrc=false;
                for (let srcWithPeople of wholeSrcOfQuestion) {
                    if (writedSrc.indexOf(srcWithPeople.src) == -1){
                        ifNewSrc=true;
                        newSrc.push(srcWithPeople);
                        writedSrc.push(srcWithPeople.src)
                    }
                }

                if(ifNewSrc){
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
        let recordPath = 'zhihu/question-spider/questionImageRecord/' + question.href + '.js';
        let filterSrc = yield * recordSrc(recordPath);
        yield * ready(filterSrc);
    }

    function *ready(wholeSrcOfQuestion) {
        let length = wholeSrcOfQuestion.length;
        log('find', length, ' images');
        if (length) {
            yield *writeImages(wholeSrcOfQuestion, question, downloadIterator, notifyOfContinue);
        } else {
            notifyOfContinue();
        }

    }



    function findImgOfAuthorAndConcat($) {
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
    }



    function getOptionsOfPost(offset) {
        return {
            method: 'POST',
            url: basePostUrl,
            headers: {'content-type': 'application/x-www-form-urlencoded'},
            form: {
                method: 'next',
                params: '{"url_token":' + question.href + ',"pagesize":' + pageSize + ',"offset":' + offset + '}'
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
                        for (let htmlString of json.msg) {
                            $ = cheerio.load(htmlString);
                            findImgOfAuthorAndConcat($)
                        }
                        log('retrieve images...,find:', wholeSrcOfQuestion.length);
                        loopPost(offset + 10);
                    } else {
                        fs.access('pic/' + question.href, err=> {
                            if (err) {
                                fs.mkdirSync('pic/' + question.href);
                            }
                            //log(wholeSrcOfQuestion);
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

    function getCollapsedAnswers(){
        let j = request.jar();
        let cookie = request.cookie(cookieValue);
        j.setCookie(cookie, 'https://www.zhihu.com');
        let options = {
            method: 'GET',
            url: collapsedAnswers,
            qs:{
                params: '%7B%22question_id%22%3A'+qid+'%7D'
            },
            jar: j
        };

        log(options.qs.params);
        request(options,(err,res,body)=>{
            log(body)
        })

    }

    function notifyOfContinue() {
        if (!singleDownload && index < question_img_list.length - 1) {
            writeStart(++index)
        } else {
            log('all finished!!!')
        }
    }

    indexGet();
}



process.on('uncaughtException', (err) => {
    log(err);
});

function fetchImageOfQuestion(href,qid,titleCodePoint){

    let title='';
    for(let codePoint of titleCodePoint){
        title+=String.fromCodePoint(codePoint)
    }
    fs.readFile(__dirname+'/img-list.js','utf8',(err,data)=>{
        let currentSrcArr=JSON.parse(data);
        let newSrc={href,qid,title,index:currentSrcArr.length};
        currentSrcArr.push(newSrc);
        fs.writeFile(__dirname+'/img-list.js',JSON.stringify(currentSrcArr),(err)=>{
            if(err){
                log(err)
            }else{
                writeStart(currentSrcArr.length-1,currentSrcArr)
            }
        })
    });

}

module.exports={
    fetchImageOfQuestion,
    writeStart
};
/*
exports.writeStart = writeStart;
exports.fetchImageOfQuestion=fetchImageOfQuestion();
*/
