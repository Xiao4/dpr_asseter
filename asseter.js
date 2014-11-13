/**
 * 
 */

var http = require('http'),
	url = require('url'),
	path = require('path'),
	fs = require('fs'),
	zlib = require('zlib'),
	ejs = require('ejs'),
	crypto = require('crypto'),
	Cache = require('./lib/cache'),
	child_process = require('child_process'),
	compiler = child_process.fork(__dirname + '/lib/compiler.js'),
	pjson = require(__dirname+'/package.json'),
	componentListTpl = fs.readFileSync(path.normalize(__dirname+'/views/component.ejs')).toString(),
	indexTpl = fs.readFileSync(path.normalize(__dirname+'/views/index.ejs')).toString();

var config = require(path.join(process.cwd(), './conf/config.json')),
	componentList = require(path.join(process.cwd(),'./conf/components.json'));

config.tmpPath = path.join(process.cwd(), './tmp');
function __md5Hash(str) {
	var hash = crypto.createHash('md5');
	return hash.update(str).digest('hex');
}
function __clone(obj) {
	return JSON.parse(JSON.stringify(obj));
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
process.setMaxListeners(0);

compiler.on('message',function(m){
	if(m.name == "compile_complete"){
		process.send(m);
	}
});

var cache = new Cache(config.cacheLimit),
	REG_EXT = /\.(\w+)([\?\#].*)?$/,
	REG_VERSION = new RegExp(config.strRegVersion)
	;
var Asseter = {
	/**
	 * 处理ComboUrl 管道入口
	 * @param  {Env} env 环境对象
	 */
	__comboStatList:{},
	handleCombo : function(env){
		if(env.response.finished){Asseter.error(env,0);return;}
		var tmpVersion = REG_VERSION.exec(env.pathStr),
			version = tmpVersion? tmpVersion[1]:0,
			versionDir = config.tmpPath + '/' + version
			;

		env.fullPath = versionDir + '/' + env.hashedPath;

		if(Asseter.__comboStatList[env.hashedPath]){
			Asseter.__comboStatList[env.hashedPath].push(env);
			return;
		}
		Asseter.__comboStatList[env.hashedPath] = [env];
		fs.stat(env.fullPath, function(err, stats){
			var envList = Asseter.__comboStatList[env.hashedPath];
			if(!envList)return;

			if(err){ //no Combod file found
				if(waitingEnvList[envList[0].hashedPath]){
					for(var i=0; i < envList.length; i++){
						waitingEnvList[envList[0].hashedPath].push(envList[i]);
					}
					delete Asseter.__comboStatList[envList[0].hashedPath];
					return;
				}
				waitingEnvList[envList[0].hashedPath] = envList;
				process.send({name:'compile', data: {
					fullPath: envList[0].fullPath,
					hashedPath: envList[0].hashedPath,
					ext: envList[0].ext,
					pathStr: envList[0].pathStr,
					filePath: config.filePath
				}});
				delete Asseter.__comboStatList[envList[0].hashedPath];
				return;
			}
			for(var i=0; i < envList.length; i++){
				envList[i].stats = stats;
				Asseter.clinetCacheControl(envList[i]);
			}
			delete Asseter.__comboStatList[envList[0].hashedPath];
		});
	},
	/**
	 * 处理一般静态文件 管道入口
	 * @param  {Env} env 环境对象
	 */
	__staticStatList:{},
	handleStatic : function(env){
		if(env.response.finished){Asseter.error(env,0);return;}
		if(env.pathStr === "/"){
			Asseter.__renderTpl(env, indexTpl, {
				"title": 'DPR Asseter', 
				"homepage": pjson.homepage,
				"version": pjson.version
			});
			return;
		}
		env.fullPath = env.fullPath.replace(/[\?#].+$/, '');
		if(Asseter.__staticStatList[env.hashedPath]){
			Asseter.__staticStatList[env.hashedPath].push(env);
			return;
		}
		Asseter.__staticStatList[env.hashedPath] = [env];
		fs.stat(env.fullPath, function(err, stats){
			var envList = Asseter.__staticStatList[env.hashedPath];
			if(!envList)return;
			if(err){
				for(var i=0; i < envList.length; i++){
					Asseter.error(envList[i],404);
				}
			}else{
				if(stats.isDirectory()){
					for(var i=0; i < envList.length; i++){
						Asseter.error(envList[i], 403);
					}
				}else{
					for(var i=0; i < envList.length; i++){
						envList[i].stats = stats;
						Asseter.clinetCacheControl(envList[i]);
					}
				}
			}
			delete Asseter.__staticStatList[envList[0].hashedPath];
		});
	},
	__getComboUrl : function(files) {
		var baseURL = config.serverUrl || '/';
		return (files&&files.length)?baseURL + path.normalize(comboPathName+"?"+this.getVersion()+','+files.join(',')) : '';
	},
	__getComponent : function(componentName) {
		if(typeof componentList[componentName] != "undefined"){
			return __clone(componentList[componentName]);
		}else{
			return null;
		}
	},
	__getComponentList : function(){
		return __clone(componentList);
	}, 
	__componentStatList:{},
	handleComponent: function(env){
		if(env.response.finished){Asseter.error(env,0);return;}
		var tmpVersion = REG_VERSION.exec(env.pathStr),
			version = tmpVersion? tmpVersion[1]:0,
			versionDir = config.tmpPath + '/' + version,
			components = env.pathStr.replace(/^[^,]+,?/gi, "").split(','),
			resourceObj = {
				css: [],
				js:[]
			},
			tmpObj;
		env.fullPath = versionDir + '/' + env.hashedPath;
		if(components.length && components[0]){
			for (var i = 0; i < components.length; i++) {
				tmpObj = Asseter.__getComponent(components[i]);
				if(tmpObj){
					if(tmpObj.css && tmpObj.css.length){
						resourceObj.css = resourceObj.css.concat(tmpObj.css);
					}
					if(tmpObj.js && tmpObj.js.length){
						resourceObj.js = resourceObj.js.concat(tmpObj.js);
					}
				}
			};
		}else{
			Asseter.__renderTpl(env, componentListTpl, {
				"title": 'DPR Asseter', 
				"component_path": config.componentPathName, 
				"components": Asseter.__getComponentList(),
				"version": version||'0'
			});
			return;
		}
		if(resourceObj.css.length+resourceObj.js.length == 0){
			Asseter.error(env, 404);
			return;
		}
		env.ext = resourceObj.js.length>0?'js':'css';
		env.contentType = config.MIME[env.ext];

		if(Asseter.__componentStatList[env.hashedPath]){
			Asseter.__componentStatList[env.hashedPath].push(env);
			return;
		}
		Asseter.__componentStatList[env.hashedPath] = [env];
		fs.stat(env.fullPath, function(err, stats){
			var envList = Asseter.__componentStatList[env.hashedPath];
			if(!envList)return;
			if(err){
				if(waitingEnvList[envList[0].hashedPath]){
					for(var i=0; i < envList.length; i++){
						waitingEnvList[envList[0].hashedPath].push(envList[i]);
					}
					delete Asseter.__componentStatList[envList[0].hashedPath];
					return;
				}
				waitingEnvList[envList[0].hashedPath] = envList;
				
				process.send({name:'compile', data: {
					type: 'component',
					component: resourceObj,
					fullPath: envList[0].fullPath,
					hashedPath: envList[0].hashedPath,
					ext: envList[0].ext,
					pathStr: envList[0].pathStr,
					filePath: config.filePath
				}});
				delete Asseter.__componentStatList[envList[0].hashedPath];
				return;
			}else{
				for(var i=0; i < envList.length; i++){
					envList[i].stats = stats;
					Asseter.clinetCacheControl(envList[i]);
				}
			}
			delete Asseter.__componentStatList[env.hashedPath];
		});

	},
	/**
	 * 拼装html
	 * @param  {Env} env 环境对象
	 * @param  {String} tpl Ejs模板
	 * @param  {Object} options 模板参数
	 */
	__renderTpl : function(env, tpl, options){
		env.data = ejs.render(tpl, options);
		Asseter.zipData(env);
	},
	/**
	 * 检测客户端缓存
	 * @param  {Env} env 环境对象
	 */
	clinetCacheControl : function(env){
		if(env.response.finished){Asseter.error(env,0);return;}
		var eTag = env.stats.ino.toString(16)+ "-" + env.stats.size.toString(16) + "-" + env.stats.mtime.valueOf().toString(16) ;
		
		if(env.request.headers['if-none-match'] && eTag == env.request.headers['if-none-match']){
			env.statsCode = 304;
			Asseter.responseEnd(env);
			return;
		}
		env.httpHeader['ETag'] = eTag;
 	    env.httpHeader['Cache-Control'] = 'public, max-age=31536000';
		env.eTag = eTag;
		Asseter.readFile(env);
		return;
	},
	/**
	 * 读取文件
	 * @param  {Env} env 环境对象
	 */
	__readFileList:{},
	readFile: function(env){
		if(env.response.finished){Asseter.error(env,0);return;}
		var hit = cache.get(env.hashedPath) ? cache.get(env.hashedPath)[0] : false;
		if( hit && hit.eTag == env.eTag){
			env.data = hit.data;
			env.httpHeader['Content-Type'] = env.contentType;
			env.clinetCacheStat = 'file';
			Asseter.zipData(env);
			return;
		}
		env.clinetCacheStat = "miss";

		if(Asseter.__readFileList[env.hashedPath]){
			Asseter.__readFileList[env.hashedPath].push(env);
			return;
		}
		Asseter.__readFileList[env.hashedPath] = [env];
		fs.readFile(env.fullPath,function(err,data){
			var envList = Asseter.__readFileList[env.hashedPath];
			if(!envList)return;
			if(err){
				for(var i=0; i < envList.length; i++){
					Asseter.error(envList[i],500);
				}
			}else{
				var cacheEntry = cache.add(env.hashedPath);
				!cacheEntry.length && cacheEntry.push({
					eTag: env.eTag,
					gzipped: '',
					deflated: '',
					data: data
				});
				for(var i=0; i < envList.length; i++){
					envList[i].data = data;
					envList[i].httpHeader['Content-Type'] = envList[i].contentType;
					Asseter.zipData(envList[i]);
				}
			}
			delete Asseter.__readFileList[env.hashedPath];
			return;
		});
		return;
	},
	/**
	 * 压缩 file Buff
	 * @param  {Env} env 环境对象
	 */
	zipData: function(env){
		if(env.response.finished){Asseter.error(env,0);return;}
		var acceptEncoding = env.request.headers['accept-encoding'];
		if(config.clinetZipExt[env.ext] && acceptEncoding){
			var hit = cache.get(env.hashedPath) ? cache.get(env.hashedPath)[0] : false;
			if(acceptEncoding.match(/\bgzip\b/)){
				if(hit && hit.gzipped){
					env.httpHeader['Content-Encoding'] = 'gzip';
					env.statsCode = 200;
					env.clinetCacheStat = 'zipped';
					Asseter.responseEnd(env, hit.gzipped);
					return;
				}
				zlib.gzip(env.data, function(err, buf){
					if(err){Asseter.error(env,500);return;}
					hit.gzipped = buf;
					env.httpHeader['Content-Encoding'] = 'gzip';
					env.statsCode = 200;
					Asseter.responseEnd(env, buf);
				});
			}else if(acceptEncoding.match(/\bdeflate\b/)){
				if(hit && hit.deflated){
					env.httpHeader['Content-Encoding'] = 'deflated';
					env.statsCode = 200;
					env.clinetCacheStat = 'zipped';
					Asseter.responseEnd(env, hit.deflated);
					return;
				}
				zlib.deflate(env.data, function(err, buf){
					if(err){Asseter.error(env,500);return;}
					hit.deflated = buf;
					env.httpHeader['Content-Encoding'] = 'deflate';
					env.statsCode = 200;
					Asseter.responseEnd(env, buf);
				});
			}else{
				Asseter.error(env,406);
			}
		}else{
			env.httpHeader['Content-Encoding'] = 'identity';
			env.statsCode = 200;
			Asseter.responseEnd(env, env.data);
		}
		return;	
	},
	/**
	 * 完成响应并关闭连接
	 * @param  {Env} env 环境对象
	 * @param  {Buff} buf file Buff
	 */
	responseEnd : function(env, buf){
		if(env.response.finished){env.statsCode = 0;}
		if(env.statsCode){
			env.response.writeHeader(env.statsCode, env.httpHeader);
			env.response.end(buf||undefined);
		}
		!env.response.finished && env.response.end();
		env.contentLength = buf ? buf.length||0 : 0;
		var diff = process.hrtime(env.startHrTime);
		env.tookTime = diff[0] * 1e9 + diff[1];
		delete env.startHrTime;
		config.log && Asseter.log(env);
		delete env;
		return;
	},
	/**
	 * 返回错误并关闭连接
	 * @param  {Env} env       环境对象
	 * @param  {Mixed} statsCode 错误代码，或报错信息
	 */
	error : function(env, statsCode){
		env.httpHeader['Content-Type'] = 'text/html';
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
			tookTime: env.tookTime,
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
	var env = {
			urlObj : url.parse(request.url),
			httpHeader:{},
			request : request,
			response : response
		};
	env.pathStr = path.normalize(env.urlObj.path);
	env.startTime = (new Date).valueOf();
	env.startHrTime = process.hrtime();
	var tmpExt = REG_EXT.exec(env.pathStr);
	env.ext = tmpExt ? tmpExt[1] : 'html';
	env.contentType = config.MIME[env.ext];
	if(!env.contentType){Asseter.error(env, 403);return;}
	env.response.on('close',function(){
		env.request && env.request.socket && env.request.socket.destory && env.request.socket.destory();
		env.response.end();
		delete env;
	});
	env.hashedPath = __md5Hash(env.pathStr);
	try{
		if(env.urlObj.pathname == config.comboPathName){
				Asseter.handleCombo(env);
		}else if(env.urlObj.pathname == config.componentPathName){
				Asseter.handleComponent(env);
		}else{
			if(env.urlObj.pathname.match(/^\/dpr/)){
				env.fullPath = __dirname + "/site" + env.pathStr;
			}else{
				env.fullPath = config.filePath + env.pathStr;
			}
			Asseter.handleStatic(env);
		}
	}catch(e){
		console.trace(e);
	}
}
http.createServer(app).listen(config.listen, function(){
	console.info("Asset server(pid:" + process.pid + ") listening on " + config.listen + " at " + (new Date).toString());
}).setMaxListeners(0);
