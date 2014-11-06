var fs = require('fs'),
	path = require('path'),
	config = require(path.join(process.cwd(), './config.json'))
	;



process.on('message', function(m) {
	if(m.name == "access_complete"){
		doLog(m.data);
	}
});
process.on('exit', function() {
	if(cutTimeout){
		clearTimeout(cutTimeout);
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
			, ' ' , env.workerId].join('')
			;
	console.log(newline);
}
function towDigi(str){
	return ('0'+str).slice(-2);
}

var logPatch, cutTimeout;
function cutLogFile () {
	fs.stat(logPatch, function(err, stat){
		if (err) {
			return;
		}
		if(stat.isFile()){
			var d = new Date(),
				// newPath = logPatch.replace(/[^\/]+$/g, '')+'dpr_mixed_log-'+d.valueOf()+'.log';
				newPath = logPatch.replace(/[^\/]+$/g, '')+'dpr_mixed_log-'+d.getFullYear()+towDigi(d.getMonth()+1)+towDigi(d.getDate())+towDigi(d.getHours())+towDigi(d.getMinutes())+'.log';
			

			fs.createReadStream(logPatch).pipe(fs.createWriteStream(newPath)).on('close', function(err){
				if (err) {
					console.log(err);
					return;
				}
				fs.truncateSync(logPatch, 0);
				// console.log('------ Prev: '+newPath+' ------');
			});
		}
	});
}
if(config.log){
	logPatch = path.join(process.cwd(), config.logPath);
	cutLogFile();
	cutTimeout = setInterval(cutLogFile, config.logCutInterval);
}