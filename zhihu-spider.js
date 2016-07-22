let cheerio = require('cheerio');
let log = console.log;
let fs = require('fs');
let path = require('path');
let request = require('request')
module.exports = function (questionId) {
    let pageSize = 10
        , offset = 10;
    let baseGetUrl = 'https://www.zhihu.com/question/'
        , basePostUrl = 'https://www.zhihu.com/node/QuestionAnswerListV2'
    let optionsOfGet = {
        method: 'GET'
        , url: baseGetUrl + questionId
    };
    let srcArr = [];
    request(optionsOfGet, (err, res, body) => {
        if (err) throw err;
        let src, $ = cheerio.load(body);
        $('img').each((index, img) => {
                src = $(img).attr('src');
                srcArr.push(src);
            });
        let title=$('title').text(),
//            titleTrim=title.slice(0,title.indexOf('？'));
            titleTrim=title.slice(0,5);

        loopGet(10,questionId);
//        console.log(title.slice(0,title.indexOf('？')))
//        log(path.normalize(titleTrim))
//        fs.mkdirSync('pic/'+path.normalize(titleTrim));
    });
    let getOptionsOfPost = function (offset) {
        let optionsOfPost = {
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
        return optionsOfPost;
    };
    let loopGet = function (offset,title) {
//        console.log(title)
        let options = getOptionsOfPost(offset)
        request(options, function (error, response, body) {
            if (error) throw new Error(error);
            let json = JSON.parse(body)
                , $;
            let src, imgs;
            for (let htmlString of json.msg) {
                $ = cheerio.load(htmlString);
                $('img').each((index, img) => {
                    src = $(img).attr('src');
                    srcArr.push(src)
                })
            }
            if (json.msg.length !== 0) {
                log('continue...')
                loopGet(offset + 10);
            }
            else {
                log('ready,start to download img!~');
                fs.mkdirSync('pic/'+title);
                let last;
                for (let src of srcArr) {
                    try{
                        if (src && src.indexOf('http') != -1 && src.indexOf('_s') === -1) {
                            src = src.replace('_b', '_r').replace('_200x112', '_r');
                            if (src != last) {
                                last = src;
                                writeImage(src,title);
                            }
                        }
                    }catch(err){
                        log(err)
                    }finally{
                        
                    }
                }
            }
        });
    };
    let writeImage = function (src,title) {
//        request(src).pipe(fs.createWriteStream(path.join('pic',title, path.basename(src))))
    };
}