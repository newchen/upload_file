;(function($) {
    //初始化参数
    var noop = function(){ return true; },
        uploadDefault = {
            url: '',//cgi地址
            fileElementId: '',//file文件域的id
            dataType: 'text',//返回的数据格式
            timeout: 0,
            params: {},//传递的参数，{name1:value1, name2:value2, ......}
            onBefore: noop,//上传之前的检查，返回false就不会执行上传，最后总需要返回一个布尔值
            onSuccess: noop,//上传成功
            onComplete: noop,//上传结束
            onError: noop//上传出错
        },
        idPrefix = {
            iframe: "jUploadIframe",
            form: "jUploadForm",
            file: "jUploadFile"
        };

    /**
     * 判断是否是ie及ie的版本，返回：false|6|7|8|9 
     */
    var _ie = function () {
        var v = 4, 
            div = document.createElement('div'),
            i = div.getElementsByTagName('i');
        do {
            div.innerHTML = '<!--[if gt IE ' + (++v) + ']><i></i><![endif]-->';
        } while (i[0]);
        return v > 5 ? v : false; //如果不是IE，返回false
    };

    //创建iframe
    var _createUploadIframe = function(id) {
        var iframeId = idPrefix.iframe + id,
            iframeHtml = '<iframe id="' + iframeId + '" name="' + iframeId + '" style="display:none;" />';

        $(iframeHtml).appendTo(document.body);

        return $('#' + iframeId)[0];            
    };

    //创建参数隐藏域   
    var _createUploadParams = function(params) {
        var paramHtml = "";
        for (key in params) {
            if(params.hasOwnProperty(key))
                paramHtml += '<input type="hidden" name="' + key + '" value="' + params[key] + '" />';
        }
        return paramHtml;
    };

    //创建上传表单 
    var _createUploadForm = function(id, fileElementId, params) {
        var formId = idPrefix.form + id,
            fileId = idPrefix.file + id,
            form = $('<form  action="#" method="POST" name="' + formId + '" id="' + formId + '" enctype="multipart/form-data">' + _createUploadParams(params) + '</form>'),    
            oldElement = $('#' + fileElementId),
            newElement = $(oldElement).clone();

        $(oldElement).attr('id', fileId)
            .before(newElement)
            .appendTo(form);

        $(form).css({display:"none"})
            .appendTo('body');

        return form;
    };

    //处理服务器返回的值
    var _uploadHttpData = function(r, type) {
        var data = "";

        try{
            switch(type) {//目前支持xml、text、json、script、html
                case "xml":
                    data = r.responseXML;
                    break;
                case "script":// 如果是 "script", 在全局执行
                    data = r.responseText;
                    $.globalEval(data);
                    break;
                case "json":
                    data = $.parseJSON(r.responseText);
                    break;
                case "text":
                    data = r.responseText;
                    break;
                case "html":
                    data = r.responseHTML;
                    break;
                default:
                    data = r.responseText;
                    break;
            }
        }catch(e) {
            throw new Error("处理返回数据出现问题，可能是格式不正确");
        }

        return data;
    };

    //核心函数
    $.ajaxFileUpload = function(options) {

        // 只支持 xhtml 1.0 或者以上的 DOCTYPE 声明
        /*if (document.compatMode === 'BackCompat') {
            throw new Error('只支持 xhtml 1.0 或者以上的 DOCTYPE 声明');
        };*/

        var opts = $.extend(uploadDefault, options),
            canSend = opts.onBefore();
        //检测参数
        if ('' === opts.url) {
            throw new Error("url为必传参数");
        }
        if('' === opts.fileElementId) {
            throw new Error("fileElementId为必传参数");
        }
        if (!canSend) {
            if(undefined === canSend) {
                throw new Error("onBefore最后总需要返回一个布尔值");
            }
            return;
        }

        //ajax文件上传,核心函数
        return function(opts) {
            var id = +new Date(), //时间戳作为id后缀
                form = _createUploadForm(id, opts.fileElementId, opts.params),
                iframe = _createUploadIframe(id),
                iframeId = idPrefix.iframe + id,
                formId = idPrefix.form + id;
            
            var requestDone = false, //请求是否已经完成，false未完成    
                xhr = {}, // 创建一个请求响应对象  
                error = {}; //保存错误对象

            // 请求响应后的回调
            var uploadCallback = function(isTimeout) {          
                var iframe = document.getElementById(iframeId),
                    status = (isTimeout !== "timeout") ? "success" : "timeout";//当前的状态
                    
                try {
                    var iframeWin = iframe.contentWindow,
                        iframeDoc = iframeWin.document,
                        ie = _ie();
                        pre = null; 

                    xhr.responseHTML = iframeDoc.body ? iframeDoc.body.innerHTML : "";
                    /**
                     * cgi如果设置了数据返回的格式：setContentType("text/html;charset=GBK")或是读取html之类格式的文件; 返回的数据会放入iframe页面的body标签里
                     * cgi如果没有设置数据返回的格式或是读取txt格式的文件，其返回的字符串，会放入iframe页面body下的pre标签中
                    */
                    xhr.responseText = xhr.responseHTML;
                    /**
                     * cgi设置了返回的数据格式为xml，
                     * 标准浏览器中iframe将没有head、body之类的标签，返回的数据会填充iframe的所有内容；
                     * 而IE7和8会用div和span元素将返回的数据包裹起来，需用XMLDocument属性获取xml数据，但是IE9中已经没有了XMLDocument属性
                     */
                    xhr.responseXML = (!ie ? iframeDoc : (iframeDoc.XMLDocument ? iframeDoc.XMLDocument : iframeDoc));
                    //该属性只有firefox下有作用
                    xhr.contentType = iframeDoc.contentType ? iframeDoc.contentType : "";

                    //如果iframe的body标签中有内容，或不存在body标签，都表示cgi数据已返回
                    if(!!xhr.responseHTML || !iframeDoc.body) {
                        status = "success";
                    }
                }catch(e) {
                    error = e;
                    status = "error";
                }

                if (xhr || isTimeout) {
                    //返回对应格式的数据
                    var data = _uploadHttpData(xhr, opts.dataType); 
                    //请求结束
                    requestDone = true;
                    
                    if (status == "success") { // 成功
                        opts.onSuccess && opts.onSuccess(data, status);
                    } else { //错误或超时
                        opts.onError && opts.onError(xhr, status, error);
                    }

                    // 上传结束的处理，包括成功和失败
                    opts.onComplete && opts.onComplete(xhr, status);

                    //移除所有事件
                    $(iframe).unbind();
                    //移除节点
                    setTimeout(function() { 
                        $(iframe).remove();
                        $(form).remove();                                   
                    }, 200);

                    xhr = null;
                }
            };

            // 如果iframe的load事件失效什么的，可确保会解析一次cgi返回或iframe页面的数据
            if (opts.timeout > 0) {
                setTimeout(function(){
                    // 请求未完成，确保会解析一次cgi返回或iframe页面的数据
                    if(!requestDone) uploadCallback("timeout");
                }, opts.timeout);
            }

            try {
                var form = $('#' + formId);
                $(form).attr({action: opts.url, method: "POST", target: iframeId});
                //兼容了不同浏览器上传文件的编码方式
                if(form.encoding) {//IE
                    $(form).attr('encoding', 'multipart/form-data');               
                }
                else {  
                    $(form).attr('enctype', 'multipart/form-data');            
                }           
                $(form).submit();

            } catch(e) {            
                throw new Error("提交文件时出现问题");
            }
            
            $('#' + iframeId).load(uploadCallback);//uploadCallback第一个参数是事件对象

        }(opts);
    }

})(jQuery);