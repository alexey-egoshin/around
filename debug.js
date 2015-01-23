var fs = require("fs");
var helper = require('./helper');
var logfile = './log.txt';

function log(msg){
	var time = helper.getTime();
    filename = logfile;
    fs.appendFile(filename,time+': '+msg+"\n",function(err){
        if(err) throw err;
    });
}

function log2(msg){
    filename = logfile;
    fs.appendFile(filename,msg+"\n",function(err){
        if(err) throw err;
    });
}
exports.log = log;
exports.log2 = log2;