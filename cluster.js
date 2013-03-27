var cluster = require('cluster');

if (cluster.isMaster) {
	var child_process = require('child_process');
	var compiler = child_process.fork(__dirname + '/compiler.js');
	var logger = child_process.fork(__dirname + '/logger.js');

	var waitingList = {};
	function messageHandler(workerId, m) {
		if(m.name == "compile"){
			if(waitingList[m.data.hashedPath]){
				waitingList[m.data.hashedPath].push(workerId);
				return;
			}
			waitingList[m.data.hashedPath] = [workerId];
			compiler.send(m);
		}else if(m.name == "access_complete"){
			m.data.workerId = workerId;
			logger.send(m);
		}
	}
	compiler.on('message',function(m){
		if(m.name == "compile_complete"){
			var workerList = waitingList[m.data];
			if(!workerList)return;
			for(var i=0; i < workerList.length; i++){
				cluster.workers[workerList[i]].send(m);
			}
			delete waitingList[m.data];
		}
	});

	//start up workers for each cpu
	require('os').cpus().forEach(function() {
		cluster.fork();
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
	//load up your application as a worker
	require('./asseter.js');
}
