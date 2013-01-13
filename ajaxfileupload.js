;(function($) {
    //初始化参数
    var noop = function(){ return true; },
        uploadDefault = {
            url: '',//cgi地址
            secureuri:false,
            fileElementId: '',//file文件域的id
            dataType: '',//返回的数据格式
            timeout: 0,
            params: {},//传递的参数
            send: noop,//上传之前的检查，返回false就不会执行上传, 注意这里必须返回true或false
            success: noop,//上传成功
            complete: noop,//上传结束
            error: noop//上传出错
        };

    //创建iframe
    var _createUploadIframe = function(id, uri) {
        var frameId = 'jUploadFrame' + id,
            //iframeHtml = '<iframe id="' + frameId + '" name="' + frameId + '"';
            iframeHtml = '<iframe id="' + frameId + '" name="' + frameId + '" style="position:absolute; top:-9999px; left:-9999px"';

        if(window.ActiveXObject) {
            if(typeof uri== 'boolean'){
                iframeHtml += ' src="' + 'javascript:false' + '"';
            }else if(typeof uri== 'string'){
                iframeHtml += ' src="' + uri + '"';
            }   
        }
        iframeHtml += ' />';

        $(iframeHtml).appendTo(document.body);
        return $('#' + frameId).get(0);            
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
        //create form   
        var formId = 'jUploadForm' + id;
        var fileId = 'jUploadFile' + id;
        var form = $('<form  action="" method="POST" name="' + formId + '" id="' + formId + '" enctype="multipart/form-data">' + _createUploadParams(params) + '</form>');    
        var oldElement = $('#' + fileElementId);
        var newElement = $(oldElement).clone();
        $(oldElement).attr('id', fileId);
        $(oldElement).before(newElement);//暂时不明白神马意思
        $(oldElement).appendTo(form);
        //该表单不可见
        $(form).css('position', 'absolute');
        $(form).css('top', '-9999px');
        $(form).css('left', '-9999px');
        $(form).appendTo('body');      
        return form;
    };

    //处理服务器返回的值
    var _uploadHttpData = function( r, type ) {
        var data = "";

        try{
            switch(type) {//目前只支持xml、text、json
                case "xml":
                    data = r.responseXML;
                    break;
                case "script"://如果是script类型，在全局范围内执行它
                    /*data = r.responseText;
                    $.globalEval( data );*/
                    break;
                case "json"://转化为json对象
                    data = $.parseJSON(r.responseText);
                    break;
                case "html":// evaluate scripts within html
                    //data = $("<div>").html(r.responseText).evalScripts();
                    break;
                case "text":
                    data = r.responseText;
                    break;
                default:
                    data = r.responseText;
                    break;
            }
        }catch(e) {
            alert("处理返回数据出现问题，可能是格式不正确");
        }

        return data;
    };

    //核心函数
    $.ajaxFileUpload = function(options) {

        var opts = $.extend(uploadDefault, options);
        //检测参数
        if (opts.url == '') {
            return;
        }
        if('' == opts.fileElementId) {
            return;
        }
        var canSend = opts.send();
        if (!canSend) {
            return;
        }

        //ajax文件上传,核心函数
        return function(opts) {
            var id = new Date().getTime(),//时间戳作为id        
                form = _createUploadForm(id, opts.fileElementId, opts.params),
                iframe = _createUploadIframe(id, opts.secureuri),
                iframeId = 'jUploadFrame' + id,
                formId = 'jUploadForm' + id;
            //请求是否已经完成，false未完成    
            var requestDone = false;
            // 创建一个请求响应对象
            var xml = {};   

            // 请求响应后的回调
            var uploadCallback = function(isTimeout) {          
                var iframe = document.getElementById(iframeId),
                    status = (isTimeout !== "timeout") ? "success" : "timeout";//当前的状态
                try {               
                    if(iframe.contentWindow) {
                        xml.responseText = iframe.contentWindow.document.body?iframe.contentWindow.document.body.innerHTML:null;
                        xml.responseXML = iframe.contentWindow.document.XMLDocument?iframe.contentWindow.document.XMLDocument:iframe.contentWindow.document;
                         
                    }else if(iframe.contentDocument) {
                        xml.responseText = iframe.contentDocument.document.body?iframe.contentDocument.document.body.innerHTML:null;
                        xml.responseXML = iframe.contentDocument.document.XMLDocument?iframe.contentDocument.document.XMLDocument:iframe.contentDocument.document;
                    }                       
                }catch(e) {
                    status = "error";
                    alert("解析返回数据出错");
                }

                if ( xml || isTimeout ) {             
                    var data = _uploadHttpData( xml, opts.dataType );    
                    requestDone = true;
                    // 成功
                    if ( status == "success" ){
                        opts.success && opts.success( data, status );
                    } else {
                        alert("错误或超时");//$.handleError(s, xml, status);
                        opts.error && opts.error( data, status );
                    }

                    // 上传结束的处理，包括成功和失败
                    opts.complete && opts.complete(xml, status);
                    //移除所有事件
                    $(iframe).unbind();
                    //移除节点
                    setTimeout(function() { 
                        $(iframe).remove();
                        $(form).remove();                                   
                    }, 200);

                    xml = null;
                }
            }

            // 检查是否超时(Timeout checker)
            if ( opts.timeout > 0 ) {
                setTimeout(function(){
                    // 如果之前解析返回数据出错，可能是请求未完成，现在再解析一次
                    if( !requestDone ) uploadCallback("timeout");
                }, opts.timeout);
            }

            try {
                var form = $('#' + formId);
                $(form).attr('action', opts.url);
                $(form).attr('method', 'POST');
                $(form).attr('target', iframeId);
                //兼容了不同浏览器上传文件的编码方式
                if(form.encoding) {
                    $(form).attr('encoding', 'multipart/form-data');               
                }
                else {  
                    $(form).attr('enctype', 'multipart/form-data');            
                }           
                $(form).submit();

            } catch(e) {            
                //$.handleError(s, xml, null, e);
                alert("提交文件时出现问题");
            }
            
            $('#' + iframeId).load(uploadCallback);//uploadCallback第一个参数是事件对象

            return {abort: function () {}};//暂不明白 

        }(opts);
    }

})(jQuery);

