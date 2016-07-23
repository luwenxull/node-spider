let cheerio = require('cheerio');
let log = console.log;
let fs = require('fs');
let path = require('path');
let request = require('request');
/*参数*/
let questionId;
let pageSize = 10
    , offset = 10;
let baseGetUrl = 'https://www.zhihu.com/question/'
    , basePostUrl = 'https://www.zhihu.com/node/QuestionAnswerListV2'
let srcArr = []
    , filterSrc = [];
let downloadIterator;
let StreamCount = 0
    , downloadCount = 0;
//    let writeStart=new Date();
let start, end;
/*延时计时*/
let timeoutCheck;

function* ready() {
    log('总共筛选', filterSrc.length, '张~');
    for (let srcIndex = 0; srcIndex < filterSrc.length / 10; srcIndex++) {
        let ten = filterSrc.slice(srcIndex * 10, srcIndex * 10 + 10);
        let tenSrcObj = ten.map((src, i) => ({
            src, index: srcIndex * 10 + i
        }));
        log('下载', srcIndex * 10, '~', srcIndex * 10 + 9, '...');
        start = srcIndex * 10;
        end = srcIndex * 10 + 9;
        yield writeImages(tenSrcObj);
        //            log(JSON.stringify(tenSrcObj))
    }
};
//    downloadIterator.next();
function writeImages(srcArrOfTen) {
    for (let i = 0; i < srcArrOfTen.length; i++) {
        writeImage(srcArrOfTen[i].src, srcArrOfTen[i].index)
    }
    timeoutCheck = setTimeout(() => {
        writeCheck(true);
    }, 20000)
}

function writeCheck(timeout) {
    if (timeout) {
        log('等待', 10 - downloadCount, '张');
        downloadCount = 0;
        downloadIterator.next();
    }
    if (downloadCount == 10) {
        downloadCount = 0;
        clearTimeout(timeoutCheck);
        downloadIterator.next();
    }
}

function writeImage(src, index) {
    try {
        request(src).pipe(fs.createWriteStream(path.join('pic', questionId, path.basename(src)))).on('finish', () => {
            if (index >= start && index <= end) {
                log('saved', src);
                downloadCount++;
                writeCheck();
            }
        }).on('error', err => {
            if (index >= start && index <= end) {
                log('faild', src);
                downloadCount++;
                writeCheck();
            }
            //            downloadIterator.next();
        })
    }
    catch (err) {
        log(err)
    }
};

function getImages(id) {
    questionId = id;
    let optionsOfGet = {
        method: 'GET'
        , url: baseGetUrl + questionId
    };
    request(optionsOfGet, (err, res, body) => {
        if (err) throw err;
        let src, $ = cheerio.load(body);
        $('img').each((index, img) => {
            src = $(img).attr('src');
            srcArr.push(src);
        });
        let title = $('title').text(), //            titleTrim=title.slice(0,title.indexOf('？'));
            titleTrim = title.slice(0, 5);
        loopGet(10, questionId);
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
    let loopGet = function (offset, title) {
        //        console.log(title)
        let options = getOptionsOfPost(offset)
        request(options, function (error, response, body) {
            try {
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
                    log('获取数据中...', '当前未过滤：', srcArr.length, '张')
                    loopGet(offset + 10, title);
                    //                log(title)
                }
                else {
                    fs.mkdirSync('pic/' + title);
                    let last;
                    for (let src of srcArr) {
                        try {
                            if (src && src.indexOf('http') != -1 && src.indexOf('_s') === -1) {
                                src = src.replace('_b', '_r').replace('_200x112', '_r');
                                if (src != last) {
                                    last = src;
                                    filterSrc.push(src)
                                }
                            }
                        }
                        catch (err) {
                            log(err)
                        }
                    }
                    fs.writeFile('tempSrcList.js', JSON.stringify(filterSrc))
                    downloadIterator = ready();
                    downloadIterator.next();
                }
            }
            catch (err) {
                log(err);
                loopGet(offset, title);
            }
        });
    };
    /*request('https://pic3.zhimg.com/f50715d8d94f0cb09bc2bef264f402e2_b.jpg').pipe(fs.createWriteStream(path.join('pic', path.basename('test.jpg'))))*/
}

function writeStart() {
    //getImages('30594270')//如何健康的丰胸？
    //getImages('35990613')//作为一个黄金比例身材的女生是一种怎样的体验？
    //getImages('23147606')//大胸怎样防止下垂？
    //getImages('44863755')//拥有S型身材是什么体验？
    //getImages('29279000')//胸大的妹子穿什么才好看并且不容易走光？
    //getImages('45533425')//为什么夏天女生喜欢穿热裤？
    //getImages('25361867')//穿情趣内衣真的能增加情趣吗？
    //getImages('39833238')//女生胸大真的自信吗？
    //    getImages('24214727') //大胸妹子如何挑选合身又好看的比基尼？
    //getImages('30859793') //胸大是遗传吗？
    //getImages('46228652') //大胸妹子夏天怎么穿衣服不显胸大？
//    getImages('24715519') //腿细是怎样的一种体验？
    getImages('28152313') //有一个非常漂亮有很多人追的妹妹是一种怎样的体验？
}

function reWrite(id) {
    questionId = id;
    fs.mkdirSync('pic/' + id);
    fs.readFile('tempSrcList.js', {
        encoding: 'utf8'
    }, (err, data) => {
        if (err) throw err;
        filterSrc = JSON.parse(data);
        downloadIterator = ready();
        downloadIterator.next();
    })
}
exports.writeStart = writeStart;
exports.reWrite = reWrite;