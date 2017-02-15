var async = require('async');
var cheerio = require('cheerio');
var mkdirp = require("mkdirp");
var fs = require("fs");
var http = require("http");
var config = require("./config")
var imoocUrl = 'http://www.imooc.com/learn/'+config.lessonId;
var courseData = [];
var mainPath = config.rootPath;
//获取视频id
var getIds = (imoocUrl,callback)=>{
	var req = http.get(imoocUrl,(res)=>{
		var datas = "";
		res.on("data",(data)=>{
		    datas+=data
		})
		res.on("end",()=>{
			//视频id
			var videoIds = [];
	        var $ = cheerio.load(datas);
	        mainPath = mainPath + $(".course-infos h2").text().trim();
	        $('.mod-chapters .chapter').each(function (idx, element) {

				var $element = $(element);

				$element.find(".chapter-content").remove();
				//章节标题
				var courseTitle = $element.find("h3 strong").text().trim();
				//创建文件路径
				mkdirp(mainPath+"/"+courseTitle,function(err){
					if (err) {
					  return console.error(err);
					}
				});
				//课程id,名称
				var courseIds = [],fileNames = [];

				$element.find("li a").each(function(idx,element){
					var $element = $(element);
					$element.children().remove();
					var id = $element.attr('href').trim().split('video/')[1];
					var name = $element.text().replace(/\(.*\)/,'').replace(/\(.*\)/,'').replace(/\（.*\）/,"").trim();
					console.log(name)
					videoIds.push(id);courseIds.push(id);fileNames.push(name)
				})

				courseData.push({
					courseTitle:courseTitle,
					courseIds:courseIds,
					fileNames:fileNames
				})
        	});
        	callback(videoIds)
		})
	});
	req.on('error', ()=>{
		console.log("getIds request error");
	});
	req.end();
}
//获取视频地址
var getUrl = (videoId,callback)=> {
	var videoUrl = 'http://www.imooc.com/course/ajaxmediainfo/?mid=' + videoId + '&mode=flash';
	var req = http.request(videoUrl,(res)=>{
		var datas = ""

		res.on("data",(data)=>{
		    datas+=data
		})

		res.on("end",()=>{
		    var videoUrl = JSON.parse(datas).data.result.mpath[0];
		    callback(videoUrl,videoId)
		})
	})
	req.on('error', ()=>{
		console.log("getUrl request error");
	});
	req.end();
}
//建立下载任务
var startDownload = (videoUrl,videoId,callback)=>{
	var path = null;
	var fileName = null
	for(var i in courseData){
    	var courseIds = courseData[i].courseIds;
    	for (var j in courseIds) {
    		if(courseIds[j]==videoId){
    			path =  mainPath + "/" + courseData[i].courseTitle + "/";
    			fileName = courseData[i].fileNames[j] + ".mp4";
    			console.log("开始下载:",fileName,"\r\n");
    			break
    		}
    	};
	}
	var req = http.request(videoUrl,(res)=>{
		var fileBuff = [];
		res.on("data",(data)=>{
		    var buffer = new Buffer(data);
		    fileBuff.push(buffer)
		})
		var contentLength = res.headers['Content-Length']-0;
      	res.on('end', function() {
	        var totalBuff = Buffer.concat(fileBuff);
	        if (totalBuff.length < contentLength) {
	        	startDownload(videoUrl,videoId,callback);
	          	return console.log(videoUrl + " download error, try again");
	        }
	        fs.appendFile(path + fileName, totalBuff, function(){
				console.log("下载完毕: ",fileName,"\r\n")
			});
			callback(null,null)
      });
	})

	req.on('error', ()=>{
	 	console.log("startDownload request error,try again");
	 	startDownload(videoUrl,videoId,callback)
	});

	req.end();
}
//建立任务队列
var taskList = (videoIds)=>{
	//并发请求控制
	async.mapLimit(videoIds,config.taskNumber,function(videoId,callback){
          getUrl(videoId,function(videoUrl,videoId){
          	startDownload(videoUrl,videoId,callback)
          })
        }, function (err, result) {})
}
getIds(imoocUrl,function(videoIds){
	taskList(videoIds)
})