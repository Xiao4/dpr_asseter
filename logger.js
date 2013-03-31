var fs = require('fs'),
	config = require('./config.json')
	;

process.on('message', function(m) {
	if(config.log && m.name == "access_complete"){
		doLog(m.data);
	}
});
/*
{
	remoteAddress: env.request.connection.remoteAddress,
	startTime: env.startTime,
	finishTime: env.finishTime,
	contentLength: env.contentLength,
	statsCode: env.statsCode,
	url: env.request.url,
	method: env.request.method,
	headers: env.request.headers,
	httpVersion: env.request.httpVersion
}
*/

var __lines = [], __writeTimeout;
function writeFile () {
	if(!__lines.length){ clearTimeout(__writeTimeout);__writeTimeout = null; return};
	fs.appendFile(config.logFile, __lines.join(''));
	__lines = [];
}
if(config.log)__writeTimeout = setInterval(writeFile, 500);
function doLog(env) {
	var reqTime = new Date(env.startTime),
		newline;
	newline = env.remoteAddress 
			+ ' - - [' + reqTime + '] ' 
			+ (env.finishTime - env.startTime) 
			+ ' "' + env.method + ' ' + env.url + ' HTTP/' + env.httpVersion + '" ' 
			+ env.statsCode + ' ' + env.contentLength 
			+ ' "' + (env.headers['referer']||'-') +'"'
			+ ' "' + env.headers['user-agent'] + '"'
			+ ' "' + (env.clinetCacheStat||'null') + '"'
			+ ' by process ' + env.workerId
			+ "\n"
			;
	__lines.push(newline);
	if(!__writeTimeout)__writeTimeout = setInterval(writeFile, 500);
}