let log = console.log;
let fs = require('fs');
let path = require('path');
let request = require('request');


/*延时计时*/
let timeoutCheck;

let openedStreams = [],
    statistic = {};

let id, totalImageNum;
let finish=false;
function willWrite(cid, length) {
    statistic[cid] = {
        writeCount: 0,
        total: length,
        failList: []
    };

    openedStreams=[];
    finish=false;
    id = cid;
    totalImageNum = length;

}

function writeImages(mainData, offsetInfo,downloadIterator) {
    let {slice,whole}=mainData;
    if (slice.length) {
        for (let src of slice) {
            writeImage(src,offsetInfo, downloadIterator,whole.length)
        }
        timeoutCheck = setTimeout(() => {
            writeCheck(true,0,downloadIterator);
        }, 20000)
    }
}

let groupWriteCount = 0;

function writeImage(srcObj, offsetInfo, downloadIterator,length) {
    let {src, people, index,id} = srcObj,
        {offsetStart,offsetEnd}=offsetInfo;
    let lengthToBeCheck=offsetEnd-offsetStart+1;
    //log(offsetInfo,lengthToBeCheck);
    //downloadIterator.next();
    try {
        let stream = fs.createWriteStream(path.join('pic', id, people + path.basename(src)));
        openedStreams.push(stream);
        stream.on('close', () => {
            //log(total++, '张');
            openedStreams.splice(openedStreams.indexOf(stream), 1);
            statistic[id].writeCount++;
            if(index>=offsetStart && index<=offsetEnd && !finish){
                groupWriteCount++;
                log('保存成功', src,index,offsetStart,'~',offsetEnd,length,id);
                writeCheck(false,lengthToBeCheck, downloadIterator);
            }else{
                log('延迟保存', src,index,offsetStart,'~',offsetEnd,length,id);
            }

        }).on('error', err => {
            /*stream.end();
            openedStreams.splice(openedStreams.indexOf(stream), 1);*/
            log('失败', src,index,offsetStart,'~',offsetEnd);
            statistic[id].failList.push(srcObj)
        });
        request(src).pipe(stream);
    }
    catch (err) {
        log(err)
    }
}

function done() {
    finish=true;
    for (let s of openedStreams) {
        s.end();
    }
    log('下载完成!总共:', totalImageNum, '下载:', statistic[id].writeCount);
}
function writeCheck(timeout, lengthToBeCheck,downloadIterator) {
    if (timeout) {
        groupWriteCount = 0;
        if (downloadIterator.next().done)
            done()
    }
    if (groupWriteCount == lengthToBeCheck) {
        clearTimeout(timeoutCheck);
        groupWriteCount = 0;
        if (downloadIterator.next().done)
            done()
    }
}

exports.writeImages = writeImages;
exports.willWrite = willWrite;
//exports.reWrite = reWrite;