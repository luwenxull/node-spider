/**
 * Created by luwenxu on 2016/7/27.
 */
let cheerio = require('cheerio');
let log = console.log;
let fs = require('fs');
let path = require('path');
let request = require('request');

function test() {
	let count = 0;
	let record = [];
	while (count < 50) {
		request.get('https://www.zhihu.com', (err, res, body) => {
			if (err) {\
				log(err.name, err.message);
			} else {
				record.push({
					// count: count,
					title: cheerio.load(body)('title').text(),
					// body:body
				});
				if (count == 50) fs.writeFile('test.js', JSON.stringify(record), ()=>{});
			}
			// log(body)

		})
		count++;

	}
}
// var a=1;	
test()


// module.exports=test;