var fs = require('fs'),
	util = require('util'),
	path = require('path'),
	UglifyJS = require("uglify-js"),
	ejs = require('ejs'),
	stream = require('stream'),
	config = require(path.join(process.cwd(), './conf/config.json')),
	asyncTpl = fs.readFileSync(path.normalize(__dirname+'/../views/async.ejs')).toString()
	;

config.tmpPath = path.join(process.cwd(), './tmp');
process.on('message', function(m) {
	if(m.name == "compile"){
		var env = m.data;
		doCompile(env);
	}
});
var spawn = require('child_process').spawn,
	REG_PARENT = /\.\.\//,
	REG_VERSION = new RegExp(config.strRegVersion)
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


		if(!fs.existsSync(versionDir)){
			try{
				fs.mkdirSync(versionDir);
			}catch (e){
				console.trace(e);
				console.log('Try to make dir:'+versionDir+', and it\'s '+(fs.existsSync(versionDir)?'exist': 'not exist')+'.')
			}
		}

		if(config.compile && env.ext == 'js'){
			var result;
			try{
				result = UglifyJS.minify(fullPathList);
				fs.writeFile(env.fullPath, result.code, function(err){
					process.send({"code":0, name: 'compile_complete', data: env.hashedPath});
				});
			}catch (e){
				console.trace(e);
				process.send({"code":0, name: 'compile_complete', data: env.hashedPath});
			}
			return;
		}else{
			env.ws = fs.createWriteStream(env.fullPath);
			env.ws.on('error', function(err){
				console.trace(err);
				process.send({"code": 1, name: 'compile_complete', data: env.hashedPath});
			});
			env.ws.on('finish', function(code){
				process.send({"code": 0, name: 'compile_complete', data: env.hashedPath})
			});
			env.rv = (new PipeReaplaceVarsion(env, version));
			env.rv.on('error', function(err){
				console.trace(err);
				process.send({"code": 1, name: 'compile_complete', data: env.hashedPath});
			});
			env.rv.on('finish', function(code){
				if(env.type === "component" && env.ext ==="js" && env.component.css.length){
					var async = ejs.render(asyncTpl, {
						"css": env.component.css,
						"asset_server": env.component.server,
						"combo_path": config.comboPathName,
						"version": version
					});
					fs.appendFile(env.fullPath, async, function(){
						console.log('cp append done');
						env.ws.end();
					});
				}else{
					env.ws.end();
				}
			});
			__doCombo(env, fullPathList);
			

			// // args = fullPathList.join(',');
			// var cat = spawn('cat', fullPathList);

			// //sed -r s/\(\\w\\.\(png\|jpg\|gif\)\)\(\\?v=\\w+\)\?/\\1?v=2/gim
			// cat.stdout.on('data', function(data){
			// 	// console.log(Buffer.isBuffer(data));
			// 	fs.appendFile(env.fullPath, data, function(){
			// 		// console.log('appendFile done');
			// 		var sed = spawn('sed', ['-i', '-r', 's/\(\\w\\.\(png\|jpg\|gif\)\)\(\\?v=\\w+\)\?/\\1?v=' + version + '/gim', env.fullPath]);
			// 		sed.stderr.on('data', function (data) {
			// 		});
			// 		sed.on('exit', function(code){
			// 			// console.log('sed done');
			// 			process.send({"code":code, name: 'compile_complete', data: env.hashedPath});
			// 			// fs.unlink(env.fullPath + '_uncomp');
			// 		});
			// 	});
			// });
			// cat.stdout.on('end', function(){
			// 	// console.log('end', env.fullPath, fullPathList);
			// 	if(env.type === "component" && env.ext ==="js" && env.component.css.length){
			// 		var async = ejs.render(asyncTpl, {
			// 			"css": env.component.css,
			// 			"asset_server": config.serverUrl,
			// 			"combo_path": config.comboPathName,
			// 			"version": version
			// 		});
			// 		fs.appendFile(env.fullPath, async, function(){
			// 			// console.log('cp append done');
			// 		});
			// 	}
			// });
			// cat.on('exit', function(code){
			// 	// console.log('exit:', code);
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


function __doCombo (env, files){
	if(!files.length){
		env.rv.end();
		return ;
	}
	var file;

	do{
		file = files.shift();
		if(file != '')break;
	}while(files.length);

	// file = path.normalize(path.join(config.filePath, file));
	if(!fs.existsSync(file)){
		return __doCombo(env, files);
	}

	var rs = fs.createReadStream(file);
	rs.pipe(env.rv, {"end": false});
	rs.on("end", function(){
		__doCombo(env, files);
	});
}

function PipeReaplaceVarsion (env, version) { // step 2
	// stream.Duplex.call(this);
	stream.Writable.call(this);
	this.version = version;
	this.env = env;
};
util.inherits(PipeReaplaceVarsion, stream.Duplex);
PipeReaplaceVarsion.prototype._write = function(chunk, encoding, next){
	try{
		if(chunk !== null){
			var tmp = chunk.toString();
			tmp = tmp.replace(/(\w\.(png|jpg|gif))(\?v=\w+)?/g, "$1?v="+this.version);
			tmp = new Buffer(tmp);
			this.env.ws.write(tmp);
		}else{
			this.env.ws.write('');
		}
		// stream.Readable.call(this);
		if(typeof next === "function")next(null, tmp||null);
	}catch(e){
		console.dir(e);
		this.emit('error', e);
		if(typeof next === "function")next(e);
	}
}
// PipeReaplaceVarsion.prototype._read = function(){
// 	this.push(this._buffs.shift());
// }
// PipeReaplaceVarsion.prototype.clean = function(){
// 	this._buffs = [];
// 	return this;
// }
