var fs = require('fs'),
	config = require('../config.json')
	;

process.on('message', function(m) {
	if(m.name == "access_complete"){
		doLog(m.data);
	}
});
/*
{
	remoteAddress: env.request.connection.remoteAddress,
	startTime: env.startTime,
	tookTime: env.tookTime,
	contentLength: env.contentLength,
	statsCode: env.statsCode,
	url: env.request.url,
	method: env.request.method,
	headers: env.request.headers,
	httpVersion: env.request.httpVersion
}
*/

function doLog(env) {
	var reqTime = new Date(env.startTime),
		newline;
	newline = [env.remoteAddress ||'0.0.0.0'
			, ' - - [' , reqTime , '] ' 
			, (env.tookTime/1e6) , 'ms' 
			, ' "' , env.method , ' ' , env.url , ' HTTP/' , env.httpVersion , '" ' 
			, '\x1B[32m',env.statsCode, '\x1B[39m', ' ' , env.contentLength 
			, ' "' , (env.headers['referer']||'-') ,'"'
			, ' "' , env.headers['user-agent'] , '"'
			, ' "' , (env.clinetCacheStat||'null') , '"'
			, ' ' , env.workerId
			, "\n"].join('')
			;
	console.log(newline);
}