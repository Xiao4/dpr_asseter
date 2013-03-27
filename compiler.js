var fs = require('fs'),
	path = require('path'),
	UglifyJS = require("uglify-js"),
	config = require('./config.json')
	;

process.on('message', function(m) {
	if(m.name == "compile"){
		var env = m.data;
		doCompile(env);
	}
});
var spawn = require('child_process').spawn,
	REG_PARENT = /\.\.\//
	;
function doCompile (env) {
	fs.stat(env.fullPath, function(err, stats){
		if(!err){
			process.send({"code":0, name: 'compile_complete', data: env.hashedPath});
			return;
		}
		var pathList = env.pathStr.replace(/^[^?]+\?([^?]+)(\?.+)?/gi, "$1").split(','), compiler, args,
			tmpRevision = /\?(\w+)$/i.exec(env.pathStr),
			revision = tmpRevision? tmpRevision[1]: 0,
			fullPathList = []
			;
		pathList.forEach(function(value){
			if(!REG_PARENT.test(value)){
				fullPathList.push(env.filePath + '/' + value);
			}
		});

		if(config.compile && env.ext == 'js'){
			var result = UglifyJS.minify(fullPathList);
			fs.writeFile(env.fullPath, result.code, function(err){
				if (err) throw err;
				process.send({"code":0, name: 'compile_complete', data: env.hashedPath});
			});
		}else{
			args = fullPathList.join(',');
			var cat = spawn('cat', args.split(','));

			if(revision){
				//sed -r s/\(\\w\\.\(png\|jpg\|gif\)\)\(\\?v=\\w+\)\?/\\1?v=2/gim
				cat.stdout.on('data', function(data){
					fs.appendFile(env.fullPath, data, function(){
						var sed = spawn('sed', ['-i', '-r', 's/\(\\w\\.\(png\|jpg\|gif\)\)\(\\?v=\\w+\)\?/\\1?v=' + revision + '/gim', env.fullPath]);
						sed.stderr.on('data', function (data) {
						});
						sed.on('exit', function(code){
							process.send({"code":code, name: 'compile_complete', data: env.hashedPath});
							fs.unlink(env.fullPath + '_uncomp');
						});
					});
				});
				cat.on('exit', function(code){
					if(code){
						process.send({"code":code, name: 'compile_complete', data: env.hashedPath});
						return;
					}
				});
			}else{
				cat.stdout.on('data', function(data){
					fs.appendFileSync(env.fullPath, data);
				});
				cat.on('exit', function(code){
					process.send({"code":code, name: 'compile_complete', data: env.hashedPath});
				});
			}
		}
	});
}