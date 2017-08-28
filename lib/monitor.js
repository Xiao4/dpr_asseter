var thrift = require('thrift'),
	util = require('util'),
	usage = require('pidusage'),
	psTree = require('ps-tree'),
    DomobService = require('./Thrift/DomobService'),
    ttypes = require('./Thrift/dm303_types');

var Monitor = function Monitor () {
	this.server = undefined;
}
Monitor.prototype.init = function(process, options) {
	var thatMonitor = this;
	this.server = thrift.createServer(DomobService, serverObj, {});
	this.aliveSince = new Date();
	this.hostProcess = process;
	this.workerPids = [];
	this.workerStatus = {};
	this.getters = [
		"test",
		"rss",
		"cpuUsage_percent"
	];
	psTree(this.hostProcess.pid, function (err, children) {
		if(err){
			console.log(err);
		}else{
			for (var i = children.length - 1; i >= 0; i--) {
				if(children[i].COMMAND == 'node'){
					thatMonitor.workerPids.push(children[i].PID);
				}
			};
		}
	});

	if(options.listen){
		this.server.listen(options.listen);
		console.log('Dm303 monitor listening on ' + options.listen);

		var thatMonitor =this;
		this.usageMonitingTimmer = setInterval(function(){
			thatMonitor.usageMoniting()
		}, 5000);
	}
};

Monitor.prototype.usageMoniting = function(){
	var thatMonitor = this;
	for (var i = this.workerPids.length - 1; i >= 0; i--) {
		/*
			{
				memory: 19460096,
				memoryInfo: {
					rss: 19460096,
					vsize: 2829511032832
				},
				cpu: 0.21842355175533965,
				cpuInfo: {
					pcpu: 0.21842355175533965,
					pcpuUser: 0.01899335232655127,
					pcpuSystem: 0.19943019942878834,
					cpuTime: undefined
				}
			}
		*/
		(function getUsage(index){
			usage.stat(thatMonitor.workerPids[index], function(err, result) {
				thatMonitor.workerStatus[thatMonitor.workerPids[index]]=result;
			});
		})(i);
	};

	return;
}
Monitor.prototype.getTest = function(){
	return (new Date()).valueOf();
}
Monitor.prototype.getRss = function(){
	var tmpUsage = 0, thatMonitor = this;
	Object.keys(this.workerStatus).forEach(function(pid) {
		if(thatMonitor.workerStatus[pid])
			tmpUsage += thatMonitor.workerStatus[pid].memoryInfo.rss;
	});
	return tmpUsage;
}
Monitor.prototype.getCpuUsage_percent = function(){
	var tmpUsage = 0, thatMonitor = this;
	Object.keys(this.workerStatus).forEach(function(pid) {
		if(thatMonitor.workerStatus[pid])
			tmpUsage += thatMonitor.workerStatus[pid].cpu;
	});
	return tmpUsage*100;
}
var monitor = new Monitor();

var serverObj ={
	"getName": function (result) {
		result(null, 'domob.DPR.server');
	},
	"getVersion": function (result) {
		result(null, '0.1');
	},
	"getStatus": function (result) {
		var status;

		if(true){
			status = ttypes.dm_status.ALIVE
		}

		result(null, status);
	},
	"getStatusDetails": function (result) {
		result(null, 'ALIVE until now.');
	},
	"getCounters":function (result) {
		var tmpResult = {}, tmpKey;
		for (var i = monitor.getters.length - 1; i >= 0; i--) {
			tmpKey = 'get' + monitor.getters[i].charAt(0).toUpperCase() + monitor.getters[i].slice(1)
			
			if(typeof monitor[tmpKey] == "function"){
				tmpResult[monitor.getters[i]] = monitor[tmpKey]();
			}
		}

		result(null, tmpResult);
	},
	"getCounter":function (counterName, result) {
		var tmpKey = 'get' + counterName.charAt(0).toUpperCase() + counterName.slice(1)

		if(typeof monitor[tmpKey] == "function"){
			result(null, monitor[tmpKey]());
		}else{
			result(null, 0);
		}
	},
	"setOption": function(key, value, result){
		result(null);
	},
	"getOptions": function(result){
		result(null, {});
	},
	"getCpuProfile": function(result){
		result(null, 'still good.');
	},
	"aliveSince": function(result){
		result(null, Math.floor(monitor.aliveSince.valueOf()/1000));
	},
	"reinitialize": function(){},
	"shutdown": function(){}
};

module.exports = monitor;
