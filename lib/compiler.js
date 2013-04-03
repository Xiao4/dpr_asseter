var fs = require('fs'),
	path = require('path'),
	UglifyJS = require("uglify-js"),
	config = require('../config.json')
	;

process.on('message', function(m) {
	if(m.name == "compile"){
		var env = m.data;
		doCompile(env);
	}
});
var spawn = require('child_process').spawn,
	REG_PARENT = /\.\.\//,
	REG_VERSION = new RegExp(config.strRegVersion),
	ExistVersionDir = {}
	;
function doCompile (env) {
	fs.stat(env.fullPath, function(err, stats){
		if(!err){
			process.send({"code":0, name: 'compile_complete', data: env.hashedPath});
			return;
		}
		var pathList = env.pathStr.replace(/^[^?]+\?(\d+,)?([^?]+)(\?.+)?/gi, "$2").split(','), args,
			tmpVersion = REG_VERSION.exec(env.pathStr),
			version = tmpVersion? tmpVersion[1]:0,
			versionDir = config.tmpPath + '/' + version,
			fullPathList = []
			;
		//check path & file stat
		pathList.forEach(function(value){
			if(!REG_PARENT.test(value)){
				fullPathList.push(env.filePath + '/' + value);
			}
		});

		if(!ExistVersionDir[versionDir]){
			if(!fs.existsSync(versionDir)){
				fs.mkdirSync(versionDir);
			}
			ExistVersionDir[versionDir] = true;
		}

		if(config.compile && env.ext == 'js'){
			var result;
			try{
				result = UglifyJS.minify(fullPathList);
				fs.writeFile(env.fullPath, result.code, function(err){
					if (err){
						ExistVersionDir[versionDir] = false;
						console.warn('Missing versionDir: ', versionDir);
					}
					process.send({"code":0, name: 'compile_complete', data: env.hashedPath});
				});
			}catch (e){
				console.error(e);
				process.send({"code":0, name: 'compile_complete', data: env.hashedPath});
			}
			return;
		}else{
			// args = fullPathList.join(',');
			var cat = spawn('cat', fullPathList);

			//sed -r s/\(\\w\\.\(png\|jpg\|gif\)\)\(\\?v=\\w+\)\?/\\1?v=2/gim
			cat.stdout.on('data', function(data){
				fs.appendFile(env.fullPath, data, function(){
					var sed = spawn('sed', ['-i', '-r', 's/\(\\w\\.\(png\|jpg\|gif\)\)\(\\?v=\\w+\)\?/\\1?v=' + version + '/gim', env.fullPath]);
					sed.stderr.on('data', function (data) {
					});
					sed.on('exit', function(code){
						process.send({"code":code, name: 'compile_complete', data: env.hashedPath});
						// fs.unlink(env.fullPath + '_uncomp');
					});
				});
			});
			cat.on('exit', function(code){
				if(code){
					process.send({"code":code, name: 'compile_complete', data: env.hashedPath});
					return;
				}
			});

		}
		return;
	});
	return;
}