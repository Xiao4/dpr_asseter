var cluster = require('cluster'),
	path = require('path'),
	config;

var working_base = process.cwd();

process.argv.forEach(function(val, index, array) {
	if(val === "-d" && typeof process.argv[index+1] !== "undefined"){
		working_base = process.argv[index+1];
	}
});

//change cwd to working_base
try {
  process.chdir(working_base);
  console.log('working in: ' + process.cwd());
}
catch (err) {
  console.log('chdir: ' + err);
}

config = require(path.join(process.cwd(),'./conf/config.json'));
config.tmpPath = path.join(process.cwd(), './tmp');

if (cluster.isMaster) {
	config.dev && console.log('prepare master');
	var child_process = require('child_process'),
		logger = child_process.fork(__dirname + '/lib/logger.js'),
		waitingList = {};

	function messageHandler(workerId, m) {
		if(m.name == "compile"){
			// 压缩请求
			// 已经存在压缩请求时，记录在相应压缩请求等待队列中
			if(waitingList[m.data.hashedPath]){
				waitingList[m.data.hashedPath].push(workerId);
				return;
			}

			// 批准压缩请求
			waitingList[m.data.hashedPath] = [workerId];
			cluster.workers[workerId].send(m);
		}else if(m.name == "compile_complete"){
			config.dev && console.log('compile_complete', m.data)
			// 压缩完成轮询等待队列，发送压缩完成通知
			var workerList = waitingList[m.data];
			if(!workerList)return;
			for(var i=0; i < workerList.length; i++){
				cluster.workers[workerList[i]].send(m);
			}
			// console.log('Process Complete Global WaitingList: ',m.data, ' worker count: ', workerList.length);
			delete waitingList[m.data];
		}else if(m.name == "access_complete"){
			config.dev && console.log('access_complete', m.data)
			// 日志
			m.data.workerId = workerId;
			config.log && logger.send(m);
		}
	}
	// process. .kill('SIGHUP')
	process.on('exit', function exit(code) {
		console.log('exit asseter:'+code);
		try{
			logger.kill();
		}catch(e){ console.log(e); }
	});
	process.on('SIGINT', function exitSIGINT(code) {
		console.log('exit asseter SIGINT:'+code);
		try{
			logger.kill();
			process.exit();
		}catch(e){ console.log(e); }
	});

	//start up workers for each cpu
	var processerCount = 0;
	require('os').cpus().forEach(function() {
		if(processerCount++ < config.processerLimit)cluster.fork();
	});
	Object.keys(cluster.workers).forEach(function(id) {
		cluster.workers[id].on('message', (function(id){
					var workerId = id;
					return function(m){
						messageHandler(workerId, m);
					}
				})(id));
	});


	//monitor
	if(config.monitorOptions && config.monitorOptions.server === "on") {
		config.dev && console.log('prepare monitor');
		var monitor=require('./lib/monitor');
		monitor.init(process, config.monitorOptions);
	}
} else {
	//load up asseter as a worker
	config.dev && console.log('prepare worker');
	require('./asseter.js');
}
