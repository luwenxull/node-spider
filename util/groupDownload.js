let log = console.log;
let fs = require('fs');
let path = require('path');
let request = require('request');

function preHandle(srcArr, item) {
    for (let i = 0; i < srcArr.length; i++) {
        srcArr[i].index = i;
        // srcArr[i].id = item.href;
    }
}
function * writeImages(srcArr, item, iterator, notify) {
    preHandle(srcArr, item);
    let groupIndex = 0,
        groupCount = Math.ceil(srcArr.length / 20),
        length = srcArr.length,
        href = item.href,
        dir=item.dir,
        successCount = 0,
        downloadFinish = false;


    let groupStreamsCollection = [],
        timeoutCheck;
    let groupWrite = function (slice, offsetInfo, groupIndex) {
        let groupOpenedStreams = [];
        for (let srcData of slice) {
            try {
                groupOpenedStreams.push(writeImage(srcData, offsetInfo, groupOpenedStreams, groupIndex))
            } catch (err) {
                log(err)
            }
        }
        groupStreamsCollection.push(groupOpenedStreams);
        timeoutCheck = setTimeout(()=> {
            groupWriteCheck(null, groupOpenedStreams, true)
        }, 15000)
    };

    let groupWriteCheck = function (stream, groupOpenedStreams, timeout) {
        if (timeout) {
            checkIfFinish();
        } else {
            groupOpenedStreams.splice(groupOpenedStreams.indexOf(stream), 1);
            if (groupOpenedStreams.length === 0) {
                log('group download finish,next>>>');
                clearTimeout(timeoutCheck);
                checkIfFinish();
            }
        }
    };

    let checkIfFinish = function () {
        if (iterator.next().done) {
            downloadFinish = true;
            for (let groupOpenedStreams of groupStreamsCollection) {
                for (let s of groupOpenedStreams) {
                    s.end()
                }
            }
            log('Download Finish!Total：', length, ',success：', successCount);
            notify();
        }
    };

    let writeImage = function (srcData, offsetInfo, groupOpenedStreams, groupIndex) {
        let {src, people, index,question} = srcData,
            {offsetStart, offsetEnd}=offsetInfo;
        let savePath=path.join('pic', dir, (people || question) + path.basename(src));
        let stream = fs.createWriteStream(savePath);
        stream.on('close', () => {
            if (!downloadFinish) {
                log('save', src, index, offsetStart + '~' + offsetEnd, length,href);
                successCount++;
                groupWriteCheck(stream, groupOpenedStreams)
            }
        }).on('error', err => {
            log(err);
            log('fail', src, length);
            groupWriteCheck(stream, groupOpenedStreams)
        });
        return request(src).pipe(stream);
    };

    while (groupIndex < groupCount) {
        let offsetStart = groupIndex * 20
            , offsetEnd = groupIndex * 20 + 20;
        groupIndex++;
        if (offsetEnd > length) offsetEnd = length;
        let slice = srcArr.slice(offsetStart, offsetEnd);
        yield groupWrite(slice, {offsetStart, offsetEnd: offsetEnd - 1}, groupIndex)
    }
}

exports.writeImages = writeImages;