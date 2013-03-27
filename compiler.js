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
			if(config.compiler == "GCC"){
				args = '-jar,java/GCC/compiler.jar,--' + env.ext + ',' 
						+ pathList.join(',--' + env.ext + ',')
						+ ',--js_output_file,' + env.fullPath;
				compiler = spawn('java', args.split(','));
				compiler.stderr.on('data', function (data) {
				});
				compiler.on('exit', function (code) {
					process.send({"code":code, name: 'compile_complete', data: env.hashedPath});
				});
			}else if(config.compiler == "YUI"){ //use YUI in default for faster compress
				args = fullPathList.join(',');
				var cat = spawn('cat', args.split(','));

				cat.stdout.on('data', function(data){
					fs.appendFileSync(env.fullPath + '_uncomp', data);
				});
				cat.on('exit', function(code){
					if(code){
						process.send({"code":code, name: 'compile_complete', data: env.hashedPath});
						return;
					}
					var yui = spawn('java', ['-jar','java/YUI/yuicompressor.jar', env.fullPath + '_uncomp','--type','js','-o', env.fullPath]);
					yui.stderr.on('data', function (data) {
					});
					yui.on('exit', function(code){
						process.send({"code":code, name: 'compile_complete', data: env.hashedPath});
						fs.unlink(env.fullPath + '_uncomp');
					});
				});
			}else{
				var result = UglifyJS.minify(fullPathList);
				fs.writeFile(env.fullPath, result.code, function(err){
					if (err) throw err;
					process.send({"code":0, name: 'compile_complete', data: env.hashedPath});
				});
			}
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



// function compile(){
	
// 	var outFile = 'bl.js';
// 	var compiler = spawn('java', ['-jar', 'java/compiler.jar', '--js', 'java/base.js', '--js', 'java/list.js', '--js_output_file', outFile]);
// 	compiler.stdout.on('data', function (data) {
// 		console.log('out:',data);
// 	});
// 	compiler.stderr.on('data', function (data) {
// 		console.log('Err:',data);
// 	});
// 	compiler.on('exit', function (code) {
// 		code ==0 ? console.log('Compiled:', outFile) : console.log('Exit:',code);
// 	});
// 	return outFile;
// }