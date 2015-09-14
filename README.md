DPR Asster
=========

DPR Asster is a resource server

  - try [asset/component?20] 
  - try [asset/combo?1002,core/plugin/ajaxf...e.js]
  - or a magic

Version
----

0.4.2

Installation
--------------

```
git clone [git-repo-url] dpr_asseter
cd dpr_asseter
npm rebuild
cp config.json.dist config.json
vi config.json
```

##### Configure :

config.json

```
{
    // the port DPR Asseter focks on
	"listen"	:"14445",

	//ssl options
	"sslOptions":{
		// https On/Off
		"server" : "on",

		// https focks
		"listen" : "14446", 

		// ssl certs
		"keyPath": "/home/xiao4/work/dpr_asseter/conf/ssl/key.pem",
		"certPath": "/home/xiao4/work/dpr_asseter/conf/ssl/cert.pem",
		"caPath": "/home/xiao4/work/dpr_asseter/conf/ssl/ca.pem"
	},

	//dm303 Monitor setting, trun off if u don't has one.
	"monitorOptions":{
		"server": "on",
		"listen": "14500"
	},

	// where all the resource files are
	"filePath"	:"/home/xiao4/git/dpr_files",
	
	// DPR Asseter will put temp files in it
	"tmpPath"	:"/home/xiao4/tmp/combo",
	
	// combo url prefix
	"comboPathName"	:"/asset/combo",
	
	// component url prefix
	"componentPathName"	:"/asset/component",
	
	// how to get the version string in a url
	"strRegVersion":"\\?(\\w+),?",
	
	// use this server for develop or not
	"dev"	:false,
	
	// log accesses or not
	"log"		:true,

	// cache limit
	"cacheLimit":300,

	// maximum child worker count
	"processerLimit":4,
	
	// mime types
	"MIME" : {
		"jpg":	"image/jpeg",
		"gif":	"image/gif",
		"png":	"image/png",
		"ico":	"image/x-icon",
		"icon":	"image/x-icon",
		"icns":	"image/x-icns",
		"eot":	"application/vnd.ms-fontobject",
		"otf":	"application/font-sfnt",
		"ttf":	"application/font-sfnt",
		"woff":	"application/font-woff",
		"svg":	"image/svg+xml",
		"svgz":	"image/svg+xml",
		"css":	"text/css",
		"js":	"text/javascript",
		"html":	"text/html",
		"htm":	"text/html",
		"txt":	"text/plain",
		"map":	"application/json",
		"mobileconfig":	"application/mobileconfig"
	},

	// compress specific kinds of files or not
	"clinetZipExt" : {
		"css":	true,
		"js":	true,
		"html":	true,
		"htm":	true,
		"txt":	true,
		"eot":	true,
		"otf":	true,
		"ttf":	true,
		"svg":	true,
		"svgz":	true
	}
}
```

##### Run :

```
. dpr.sh start
```


Tech
-----------

DPR Asster uses a number of open source projects to work properly:

* [Node.js] - making all this come possible
* [Twitter Bootstrap] - great UI boilerplate for modern web apps

**memeda!**

[asset/component?20]:http://domob-206.domob-inc.cn:4444/asset/component?20
[asset/combo?1002,core/plugin/ajaxf...e.js]:http://domob-206.domob-inc.cn:4444/asset/combo?1002,core/plugin/ajaxform/jquery.ajaxform.js,core/plugin/interactive/jquery.interactive.js,core/plugin/customradio/jquery.customradio.js,core/plugin/customselect/jquery.customselect.js,core/plugin/customfileinput/jquery.customfileinput.js,core/plugin/fileupload/jquery.ui.widget.js,core/plugin/fileupload/jquery.fileupload.js,core/plugin/datepicker/jquery.datepicker.js,core/plugin/treeview/jquery.treeview.js,core/plugin/treeselect/jquery.treeselect.js,adinfo/js/addstrategy.js
[node.js]:http://nodejs.org
[Twitter Bootstrap]:http://twitter.github.com/bootstrap/
