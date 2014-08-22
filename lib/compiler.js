var fs = require('fs'),
	path = require('path'),
	UglifyJS = require("uglify-js"),
	ejs = require('ejs'),
	config = require('../config.json'),
	asyncTpl = fs.readFileSync(path.normalize(__dirname+'/../views/async.ejs')).toString()
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
		var pathList = env.pathStr.replace(/^[^,]+,?/gi, "").split(','), args,
			tmpVersion = REG_VERSION.exec(env.pathStr),
			version = tmpVersion? tmpVersion[1]:0,
			versionDir = config.tmpPath + '/' + version,
			fullPathList = []
			;
		if(env.type === "component"){
			pathList = env.component[env.ext];
		}
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
				console.trace(e);
				process.send({"code":0, name: 'compile_complete', data: env.hashedPath});
			}
			return;
		}else{
			// args = fullPathList.join(',');
			var cat = spawn('cat', fullPathList);

			//sed -r s/\(\\w\\.\(png\|jpg\|gif\)\)\(\\?v=\\w+\)\?/\\1?v=2/gim
			cat.stdout.on('data', function(data){
				// console.log(Buffer.isBuffer(data));
				fs.appendFile(env.fullPath, data, function(){
					// console.log('appendFile done');
					var sed = spawn('sed', ['-i', '-r', 's/\(\\w\\.\(png\|jpg\|gif\)\)\(\\?v=\\w+\)\?/\\1?v=' + version + '/gim', env.fullPath]);
					sed.stderr.on('data', function (data) {
					});
					sed.on('exit', function(code){
						// console.log('sed done');
						process.send({"code":code, name: 'compile_complete', data: env.hashedPath});
						// fs.unlink(env.fullPath + '_uncomp');
					});
				});
			});
			cat.stdout.on('end', function(){
				if(env.type === "component" && env.ext ==="js" && env.component.css.length){
					var async = ejs.render(asyncTpl, {
						"css": env.component.css,
						"asset_server": config.serverUrl,
						"combo_path": config.comboPathName,
						"version": version
					});
					fs.appendFile(env.fullPath, async, function(){
						// console.log('cp append done');
					});
				}
			});
			// cat.on('exit', function(code){
			// 	console.log('exit:', code);
			// 	if(code){
			// 		process.send({"code":code, name: 'compile_complete', data: env.hashedPath});
			// 		return;
			// 	}
			// });

		}
		return;
	});
	return;
}