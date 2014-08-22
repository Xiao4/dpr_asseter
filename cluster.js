var cluster = require('cluster'),
	config = require('./config.json');

if (cluster.isMaster) {
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
			// 压缩完成轮询等待队列，发送压缩完成通知
			var workerList = waitingList[m.data];
			if(!workerList)return;
			for(var i=0; i < workerList.length; i++){
				cluster.workers[workerList[i]].send(m);
			}
			console.log('Process Complete Global WaitingList: ', workerList.length);
			delete waitingList[m.data];
		}else if(m.name == "access_complete"){
			// 日志
			m.data.workerId = workerId;
			config.log && logger.send(m);
		}
	}

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

} else {
	//load up asseter as a worker
	require('./asseter.js');
}
