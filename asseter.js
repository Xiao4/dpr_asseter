/**
 * 
 */

var config = require('./config.json'),
	http = require('http'),
	url = require('url'),
	path = require('path'),
	fs = require('fs'),
	zlib = require('zlib')
	child_process = require('child_process'),
	compiler = child_process.fork(__dirname + '/compiler.js');

function __md5Hash(str) {
	var hash = require('crypto').createHash('md5');
	return hash.update(str).digest('hex');
}

var waitingEnvList ={};
process.on('message',function(m){
	if(m.name == "compile_complete"){
		var envList = waitingEnvList[m.data];
		if(!envList)return;
		for(var i=0; i < envList.length; i++){
			Asseter.handleStatic(envList[i]);
		}
		delete waitingEnvList[m.data];
	}else if(m.name == "compile"){
		compiler.send(m);
	}
});

compiler.on('message',function(m){
	if(m.name == "compile_complete"){
		process.send(m);
	}
});

var Cache = {},
	REG_EXT = /\.(\w+)([\?\#].*)?$/,
	REG_VERSION = new RegExp(config.strRegVersion)
	;
var Asseter = {
	/**
	 * 处理ComboUrl 管道入口
	 * @param  {Env} env 环境对象
	 */
	handleCombo : function(env){
		var tmpVersion = REG_VERSION.exec(env.pathStr),
			version = tmpVersion? tmpVersion[1]:0,
			versionDir = config.tmpPath + '/' + version
			;
		env.hashedPath = __md5Hash(env.pathStr);
		env.fullPath = versionDir + '/' + env.hashedPath;

		fs.stat(env.fullPath, function(err, stats){
			if(err){ //no Combod file found
				if(waitingEnvList[env.hashedPath]){
					waitingEnvList[env.hashedPath].push(env);
					return;
				}
				waitingEnvList[env.hashedPath] = [env];
				process.send({name:'compile', data: {
					fullPath: env.fullPath,
					hashedPath: env.hashedPath,
					ext: env.ext,
					pathStr: env.pathStr,
					filePath: config.filePath
				}});
				return;
			}
			env.stats = stats;
			Asseter.clinetCacheControl(env);
		});
	},
	/**
	 * 处理一般静态文件 管道入口
	 * @param  {Env} env 环境对象
	 */
	handleStatic : function(env){
		env.fullPath = env.fullPath.replace(/[\?#].+$/, '');
		fs.stat(env.fullPath, function(err, stats){
			if(err){Asseter.error(env,404);return;}
			env.stats = stats;
			Asseter.clinetCacheControl(env);
		});
	},
	/**
	 * 检测客户端缓存
	 * @param  {Env} env 环境对象
	 */
	clinetCacheControl : function(env){
		var eTag = env.stats.ino.toString(16)+ "-" + env.stats.size.toString(16) + "-" + env.stats.mtime.valueOf().toString(16) ;
		
		if(env.request.headers['if-none-match'] && eTag == env.request.headers['if-none-match']){
			env.statsCode = 304;
			Asseter.responseEnd(env);
			return;
		}
		env.response.setHeader('ETag', eTag);
 	    env.response.setHeader('Cache-Control', 'public, max-age=31536000');
		env.eTag = eTag;
		Asseter.readFile(env);
	},
	/**
	 * 读取文件
	 * @param  {Env} env 环境对象
	 */
	readFile: function(env){
		!env.hashedPath && (env.hashedPath = __md5Hash(env.pathStr));
		if(config.keepInMem && Cache[env.hashedPath] && Cache[env.hashedPath].eTag == env.eTag){
			env.data = Cache[env.hashedPath].data;
			env.response.setHeader('Content-Type', env.contentType);
			env.clinetCacheStat = 'file';
			Asseter.zipData(env);
			return;
		}

		fs.readFile(env.fullPath,function(err,data){
			if(err){Asseter.error(env,500);return;}
			Cache[env.hashedPath] = {
				eTag: env.eTag,
				gziped: '',
				deflated: '',
				data: data
			};
			env.data = data;
			env.response.setHeader('Content-Type', env.contentType);
			Asseter.zipData(env);
		});
	},
	/**
	 * 压缩 file Buff
	 * @param  {Env} env 环境对象
	 */
	zipData: function(env){
		var acceptEncoding = env.request.headers['accept-encoding'];
		if(config.clinetZipExt[env.ext] && acceptEncoding){
			if(acceptEncoding.match(/\bgzip\b/)){
				if(config.keepInMem && Cache[env.hashedPath] && Cache[env.hashedPath].gziped){
					env.response.setHeader('Content-Encoding', 'gzip');
					env.statsCode = 200;
					env.clinetCacheStat = 'ziped';
					Asseter.responseEnd(env, Cache[env.hashedPath].gziped);
					return;
				}
				zlib.gzip(env.data, function(err, buf){
					if(err){Asseter.error(env,500);return;}

					Cache[env.hashedPath].gziped = buf;
					env.response.setHeader('Content-Encoding', 'gzip');
					env.statsCode = 200;
					Asseter.responseEnd(env, buf);
				});
			}else if(acceptEncoding.match(/\bdeflate\b/)){
				if(config.keepInMem && Cache[env.hashedPath] && Cache[env.hashedPath].deflated){
					env.response.setHeader('Content-Encoding', 'deflated');
					env.statsCode = 200;
					env.clinetCacheStat = 'ziped';
					Asseter.responseEnd(env, Cache[env.hashedPath].deflated);
					return;
				}
				zlib.deflate(env.data, function(err, buf){
					if(err){Asseter.error(env,500);return;}
					Cache[env.hashedPath].deflated = buf;
					env.response.setHeader('Content-Encoding', 'deflate');
					env.statsCode = 200;
					Asseter.responseEnd(env, buf);
				});
			}else{
				Asseter.error(env,406);
			}
		}else{
			env.response.setHeader('Content-Encoding', 'identity');
			env.statsCode = 200;
			Asseter.responseEnd(env, env.data);
		}		
	},
	/**
	 * 完成响应并关闭连接
	 * @param  {Env} env 环境对象
	 * @param  {Buff} buf file Buff
	 */
	responseEnd : function(env, buf){
		if(env.statsCode)env.response.writeHeader(env.statsCode);
		env.response.end(buf);
		env.contentLength = buf ? buf.length||0 : 0;
		env.finishTime = (new Date()).valueOf();
		config.log && Asseter.log(env);
	},
	/**
	 * 返回错误并关闭连接
	 * @param  {Env} env       环境对象
	 * @param  {Mixed} statsCode 错误代码，或报错信息
	 */
	error : function(env, statsCode){
		env.response.setHeader('Content-Type', 'text/html');
		var txt;
		switch(statsCode){
			case 404:
				txt = '<h3>404: Not Found</h3>';
				break;
			case 403:
				txt = '<h3>403: Forbidden</h3>';
				break;
			case 406:
				txt = '<h3>406: Not Acceptable</h3>';
				break;
			case 416:
				txt = '<h3>416: Requested Range Not Satisfiable</h3>';
				break;
			case 500:
				txt = '<h3>500: Internal Server Error</h3>';
				break;
			default:
				txt = "<h3>Ooops, he is dead.</h3><p>"+statsCode+"</p>"
		}
		env.statsCode = statsCode;
		Asseter.responseEnd(env, txt);
	},
	/**
	 * 发送记录log请求
	 * @param  {Env} env 环境对象
	 */
	log : function(env){
		process.send({name:'access_complete', data:{
			remoteAddress: env.request.connection.remoteAddress,
			startTime: env.startTime,
			finishTime: env.finishTime,
			contentLength: env.contentLength,
			statsCode: env.statsCode,
			url: env.request.url,
			method: env.request.method,
			headers: env.request.headers,
			httpVersion: env.request.httpVersion,
			clinetCacheStat: env.clinetCacheStat
		}});
	}
};

function app(request, response) {
	var start = new Date(); 
	var env = {
			urlObj : url.parse(request.url),
			httpHeader:{},
			request : request,
			response : response
		};
	env.pathStr = path.normalize(env.urlObj.path);
	env.startTime = start.valueOf();
	var tmpExt = REG_EXT.exec(env.pathStr);
	env.ext = tmpExt ? tmpExt[1] : 'html';
	env.contentType = config.MIME[env.ext];
	if(!env.contentType){Asseter.error(env, 403);return;}

	if(env.urlObj.pathname == config.comboPathName){
		Asseter.handleCombo(env);
	}else{
		env.fullPath = config.filePath + env.pathStr;
		Asseter.handleStatic(env);
	}
}
http.createServer(app).listen(config.listen, function(){
	console.log("Asset server(pid:" + process.pid + ") listening on " + config.listen);
});
