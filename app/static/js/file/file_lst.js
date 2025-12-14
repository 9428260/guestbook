var g_page      = 1; // 현재 페이지
var g_per_page  = 10; // 한 번에 조회할 건수.
var g_total_cnt = 0; // 총 건수.(from Server)

var g_type_arr  = [];
var g_type_dict = {};

var g_current_path = '/';
var g_event_source = null;
var g_sse_uuid     = null;

var file_idx       = 0;


$a.page(function(){
	this.init = function(id, param) {
	    initCombo();
	    initData();
	    initGrid();
		setEventListener();
	};
});

function setEventListener() {

    // 검색조건 영역 초기화
    $('#btn_init').on('click', function(e) {
        g_current_path = '/';

        $('#filehub_id').val('');
        $('#current_path').val(g_current_path);
    });

    // 파일허브 조회
    $('#btn_sel_filehub_id').on('click', function() {
        let filehub_param = { filehub_id: $('#filehub_id').val() };

        opme_searchFileHub('파일허브 조회', 'single', filehub_param, function(filehub_info) {
            if (filehub_info.length == 1) {
                $('#filehub_id').val(filehub_info[0]['id']);
                g_page = 1;
                getGridData($('#current_path').val());
            }
        });
    });

    // 조회
    $('#btn_sel, #btn_sel_path').on('click', function() {
        g_page = 1;
        getGridData($('#current_path').val());
    });

    // Scroll Bottom 인 경우
    $('#file_grid').on('scrollBottom', function(e) {
        let pageInfo = $('#file_grid').alopexGrid('pageInfo');

        if (pageInfo['dataLength'] >= g_total_cnt) {
            return;
        }

        g_page = g_page + 1;
        getGridData(g_current_path);
    });

    // current_path 변경 시에, '\' => '/' 로 변경.
    $('#current_path').on('blur', function(e) {
        $('#current_path').val($('#current_path').val().replace(/\\/g, '/'));
    });

    // 검색 버튼 'Enter' 처리
    $('.search_area_input').on('keyup', function(e) {
        if(e.keyCode == 13) { // 'Enter' Key
            $('#current_path').val($('#current_path').val().replace(/\\/g, '/'));
            g_page = 1;
            getGridData($('#current_path').val());
        }
    });

    // Grid 데이터 더블 클릭 시 상세화면
    $('#file_grid').on('dblclick', '.bodycell', function(e) {
        let dataObj = AlopexGrid.parseEvent(e).data;
        let rowData = $("#file_grid").alopexGrid( "dataGetByIndex" , {data: dataObj._index.data});

        // Directory 가 아닌 경우, Skip
        if (rowData['type'] != 'D') {
            return;
        }

        let newPath = '';

        // Parent Directory 인 경우.
        if (rowData['name'] == '..') {
            let currentPath = g_current_path;
            let idx = currentPath.length;

            if (currentPath[currentPath.length-1] == '/') {
                idx = idx - 1;
            }

            newPath = currentPath.substring(0, currentPath.substring(0, idx).lastIndexOf('/'));

        } else { // Child Directory 조회 요청.
            newPath = g_current_path + rowData['name'];
        }

        g_page = 1;
        getGridData(newPath);
    });

    // File Upload
    $('#btn_upload').on('click', function(e) {

        if ($("#filehub_id").val() == null || $("#filehub_id").val() == "") {
            opme_message("[파일허브 ID] 를 입력하세요.", function() {
                $("#filehub_id").focus();
            });

            return;
        }

        uploadFile();
        // e.preventDefault();
        // $("#upload_file").click();
        // uploadSingleFile();
    });

    // File Download
    $('#btn_download').on('click', function(e) {
        let data = $('#file_grid').alopexGrid('dataGet' , { _state : { selected : true } } ); // 선택된 데이터
        if (data == '') {
            opme_message("다운 받을 파일을 선택 후 다시 시도 하십시오.");
            return;
        }

        if ($("#filehub_id").val() == null || $("#filehub_id").val() == "") {
            opme_message("[파일허브 ID] 를 입력하세요.", function() {
                $("#filehub_id").focus();
            });

            return;
        }

        if ( confirm("선택된 파일를 다운로드 하시겠습니까?\n- 10개 이상 파일은 불가합니다.") ) {
            file_idx = 0;
            let fileNameList = AlopexGrid.trimData(data).map(function(o){
                return o.name;
            });

            // 파일 수 제한
            if ( fileNameList.length > 10 ) {
                opme_message("다운 받을 파일을 선택 후 다시 시도 하십시오.<br/>- 선택된 파일 수 : " + fileNameList.length);
                return;
            }

            preDownload();
            prepareDownload(fileNameList[0], fileNameList.slice(1), file_idx, fileNameList.length);
        }
    });

    // Grid 파일 더블 클릭 시 다운로드
    $('#file_grid').on('dblclick', '.bodycell', function(e) {
        let dataObj = AlopexGrid.parseEvent(e).data;
        let rowData = $("#file_grid").alopexGrid( "dataGetByIndex" , {data: dataObj._index.data});

        // File 이 아닌 경우, Skip
        if (rowData['type'] != 'F') {
            return;
        }

        let fileName = rowData['name'];

        if ( confirm(fileName + " 를(을) 다운로드 하시겠습니까?") ) {
            // let sse_uuid = self.crypto.randomUUID(); // https only
            let sse_uuid = generateUUID();

            g_event_source = new EventSource('/file/sse/' + sse_uuid);
            // g_event_source.onopen = function() {
            //     console.log("onopen");
            // };

            // g_event_source.onretry = function() {
            //     console.log("onretry");
            //     return false;
            // };

            g_event_source.onmessage = function(e) {
                // console.log("onmessage - [" + e.data + "]");
                if (Number(e.data) >= 100 && g_event_source != null) {
                    g_event_source.close();
                    g_event_source = null;
                }

                $('#common-progress').width(e.data + '%');
                $('#common-progress').text(e.data + '%');
            };

            g_event_source.onerror = function(e) {
                console.log(e);
                opme_message('[ERROR] Server Sent Event.');
                return;
            };

            let req_param = {
                filehub_id: $('#filehub_id').val(),
                path      : $('#current_path').val(),
                name      : fileName,
                uuid      : sse_uuid,
                idx       : 0,
                length    : 1
            };

            // Delay 1 second
            setTimeout(function() {
                downloadFile(req_param);
            }, 1000);
        }
    });

    // 삭제
    $("#btn_del_file").on("click", function(e) {
        let data = $('#file_grid').alopexGrid('dataGet' , { _state : { selected : true } } );// 선택된 데이터
        if (data == '') return;

        if ($("#filehub_id").val() == null || $("#filehub_id").val() == "") {
            opme_message("[파일허브 ID] 를 입력하세요.", function() {
                $("#filehub_id").focus();
            });

            return;
        }

        if ( confirm("선택된 파일을 삭제 하시겠습니까?") ) {
            deleteFile(AlopexGrid.trimData(data));
        }
    });
};


function prepareDownload(fileName, fileNameArr, fileIdx, fileLength){
     //console.log("prepareDownload idx:"+fileIdx);
     //console.log("prepareDownload fileLength:"+fileLength);

    // let sse_uuid = self.crypto.randomUUID(); // https only
    let sse_uuid = generateUUID();

    g_event_source = new EventSource('/file/sse/' + sse_uuid);
    // g_event_source.onopen = function() {
    //     console.log("onopen");
    // };

    // g_event_source.onretry = function() {
    //     console.log("onretry");
    //     return false;
    // };

    g_event_source.onmessage = function(e) {
        // console.log("onmessage - [" + e.data + "]");
        if (Number(e.data) >= 100 && g_event_source != null) {
            g_event_source.close();
            g_event_source = null;
        }

        $('#common-progress').width(e.data + '%');
        $('#common-progress').text(e.data + '%');
    };

    g_event_source.onerror = function(e) {
        console.log(e);
        opme_message('[ERROR] Server Sent Event.');
        return;
    };

    let req_param = {
        filehub_id: $('#filehub_id').val(),
        path      : $('#current_path').val(),
        name      : fileName,
        uuid      : sse_uuid,
        idx       : fileIdx,
        length    : fileLength
    };
    //console.log("prepareDownload 000:"+fileNameArr);
    // Delay 1 second
    setTimeout(function() {
        downloadFile(req_param,fileNameArr, fileIdx, fileLength);
    }, 1000);

}



function initCombo() {
    let result = opme_getCode(['file_type']);
    if (result == false) return;

    g_type_arr = result['file_type'];
    g_type_arr.forEach(function(item) {
        g_type_dict[item['value']] = item['text'];
    });

    return;
};


function initGrid() {

    // 파일 그리드 초기화
    $('#file_grid').alopexGrid({
        height: 501,
        rowSelectOption: {
		    clickSelect : true,
		    singleSelect: false
	    },
	    rowOption: {
	        allowSelect: function(data) {
                // File 인 경우만, 선택 가능.
	            if (data['type'] == 'F') {
	                return true;
                }
                return false;
	        },
	    },
        pager: true,
        paging: {
            enabled   : false,
            pagerTotal: true
        },
        columnMapping : [
            {
                align          : 'center',
                key            : 'check',
                width          : '50px',
                selectorColumn : true,
                excludeFitWidth: true,
                resizing       : false,
            }, {
                align          : 'center',
                key            : 'type',
                title          : '유형',
                width          : '80px',
                excludeFitWidth: true,
                render         : function(value, data, render, mapping, grid) {
                    let resultStr = "";
                    if (value == 'D') { // "D" : Directory
                        resultStr = '<div class="grid_icon ico_dir"></div>';
                    } else { // "F" : file
                        resultStr = '<div class="grid_icon ico_file"></div>';
                    }

                    return resultStr;
                },
                tooltip: function(value, data, mapping) {
				    return g_type_dict[value];
                }
            }, {
                align   : 'left',
                key     : 'name',
                title   : '파일명',
                width   : '200px',
                readonly: true,
            }, {
                align          : 'right',
                key            : 'size',
                title          : '크기(Byte)',
                width          : '200px',
                excludeFitWidth: true,
            }, {
                align       : 'center',
                key         : 'date',
                title       : '일시',
                width       : '100px',
                defaultValue: "-",
                render      : function(value, data, render, mapping, grid) {
                    return opme_formatUTCString(value);
                }
            }, {
                align          : 'center',
                key            : 'availableDay',
                title          : '잔여보존일<span class="Button btn-ico sx borderless btn-help"></span>',
                width          : '200px',
                excludeFitWidth: true,
                headerTooltip  : function(data, mapping) {
                    return "잔여보존일은 파일의 최소 보장 기간을 알려줍니다.\n"
                         + " - 5일 : D+5일간 보장\n"
                         + " - 1일 : D+1일간 보장\n"
                         + " - 0일 : 24시간 내 보장 불가\n"
                         + "조회되지 않는 파일은 복구할 수 없다는 점 참고해 주세요.";
                },
                render: function(value, data, render, mapping, grid) {
                    if (typeof value !== "undefined") {
                        value += " 일";
                    }
                    return value;
                }
            },
        ],
    });

    // 파일허브ID 가 입력되어 있는 경우에만 자동 조회.
    if ($("#filehub_id").val() != "") {
        getGridData($('#current_path').val());
    }
};

// 초기 데이터 요청
function initData() {
    if ($('#current_path').val() == '') {
        $('#current_path').val('/');
    }

    // 조회 조건이 존재하는 경우, 해당 조건 설정.
    if (typeof request_params !== 'undefined' && request_params != null) {
        $('#filehub_id').val(request_params['sc_id']);
    };

    return;
};

function getGridData(p_path) {

    // 유효성 검사
    if ($("#filehub_id").val() == null || $("#filehub_id").val() == "") {
        opme_message("[파일허브 ID] 를 입력하세요.", function() {
            $("#filehub_id").focus();
        });

        return;
    }

    if (p_path == '') {
        p_path = '/';
    }

    let data = {
        page      : g_page,
        perPage   : g_per_page,
        filehub_id: $("#filehub_id").val(),
        path      : p_path,
    };

    return $.ajax({
        url        : '/file/list',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        contentType: "application/json",
        success    : function(result) {

            // EM0000 : 정상, EM1002 : Not Found 이 아닌 경우, 오류 메시지 팝업
            if (result['resultCode'] != 'EM0000' && result['resultCode'] != 'EM1002') {
                opme_message("[" + result['resultCode'] + "] " + result['resultMsg'], function () {
                    $('#current_path').val(g_current_path);
                });

                return;
            }

        	$('#file_grid').alopexGrid('updateOption', {
        		paging : {
        			pagerTotal: function(paging) {
        				return '총 건수 : ' + result['totalCnt'];
        			}
        		}
        	});

            if (g_page == 1) {
                $('#file_grid').alopexGrid('dataSet', result['subFileList']);
                g_total_cnt = result['totalCnt'];
            } else {
                $('#file_grid').alopexGrid('dataAdd', result['subFileList']);
            }

            // Current Path 갱신.
            if (p_path.endsWith('/')) {
                g_current_path = p_path;
            } else {
                g_current_path = p_path + '/';
            }
            $('#current_path').val(g_current_path);

            // Parent directory(..) 를 0번째 row 에 삽입합니다.
            if ($('#current_path').val() != '/' && g_page == 1) {
                let parentDir = {'key': '', 'type': 'D', 'name': '..', 'size': '', 'date': ''};
	            $('#file_grid').alopexGrid('dataAdd', parentDir, {_index:{row:0}});
                g_total_cnt = g_total_cnt + 1;
	        }
        }
    });
};

// Popup 페이지 호출하여, Popup 에서 실제 업로드 수행.
function uploadFile(data) {

    return $.ajax({
        url        : '/filehub/dupchk',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify({id: $('#filehub_id').val()}),
        contentType: "application/json",
        success    : function(result) {

            if(result['resultCode'] == 'EM0999') {
                opme_message("[파일허브 ID] 를 확인하세요.", function() {
                    $("#filehub_id").focus();
                });
                return;
            }

            if (result['resultCode'] != 'EM0000') {
                let msg = "[" + result['resultCode'] + "] " + result['resultMsg'];
                opme_message(msg);

                return;
            }

            $a.popup({
                url     : '/file/p_upload',
                title   : '파일 업로드',
                iframe  : true,  // default 는 true
                width   : 1000,
                movable : true,
                data    : {'filehub_id': $('#filehub_id').val(), 'path': $('#current_path').val()},
                callback: function () {
                    g_page = 1;
                    getGridData(g_current_path);
                }
            });

            return;
        }
    });
};

// 다건 선택 시, 파일 별로 서비스 호출하여 다운로드.
// - 다운로드 성공하면, Python 서버에 생성된 임시 파일 삭제 서비스 호출.
function downloadFile(req_param, filenameArr, fileIdx, fileLength) {
//console.log("prepareDownload 333:"+filenameArr);
    return $.ajax ({
        url      : '/file/download',
        type     : 'POST',
        data     : req_param,
        xhrFields: {
            responseType: 'arraybuffer'
        },
        success  : function(data, textStatus, jqXhr) {

            if (!data) {
                opme_message("파일 다운로드 중 오류가 발생했습니다.");
                return;
            }

            try {
                // Blob 참고
                // - https://taegon.kim/archives/5078
                // - https://heropy.blog/2019/02/28/blob/
                // Chrome 브라우저는 파일 명에 '~'가 있는 경우, '_'로 바꾸어 저장한다.
                // - Windows 의 '~' 문자는 파일 명이 길어지면, 표기되는 문자이기에 해당 방식을 사용한다고 함.
                // - https://superuser.com/questions/1360571/character-will-be-automatically-changed-to-in-filename-during-downloadin
                let blob = new Blob([data], { type: jqXhr.getResponseHeader('content-type') });

                if (window.navigator.msSaveOrOpenBlob) { // IE10+
                    window.navigator.msSaveOrOpenBlob(blob, req_param['name']);
                } else {
                    let aTag    = document.createElement('a');
                    let url     = window.URL.createObjectURL(blob);
                    aTag.href   = url;
                    aTag.target = '_self';
                    // aTag.download = fileName;
                    aTag.download = req_param['name'];
                    document.body.append(aTag);
                    aTag.click();
                    aTag.remove();
                    window.URL.revokeObjectURL(url);
                }
            } catch (e) {
                opme_message(e);
                return;
            }
        },  // success - end
        complete: function(jqXhr, status) {

            if (g_event_source != null) {
                g_event_source.close();
                g_event_source = null;
            }

            // Parse FileName in 'content-disposition'
            let contentDisposition = jqXhr.getResponseHeader('content-disposition');
            let fileName = contentDisposition.split(';').filter(function(param) {
                return param.indexOf('filename') > -1
            }).map(function(param) {
                // param : filename=ABC
                return param.replace(/"/g, '').split('=')[1]
            });

            if (!fileName || !fileName[0]) {
                opme_message("파일 다운로드 중 오류가 발생했습니다.");
                return;
            }
            fileName = decodeURI(fileName[0]);

            let parseIdx    = fileName.indexOf('/');
            let currentDate = fileName.substring(0, parseIdx);
            let tmpFileName = fileName.substring(parseIdx+1);

            let delTmpFileData = {
                'date'     : currentDate,
                // g_sse_uuid == tmpFileName
                'file_name': req_param.uuid ,
            };

            // 임시파일 삭제 서비스 호출
            return $.ajax({
                url        : '/file/del_tmp_file',
                type       : 'POST',
                dataType   : "json",
                data       : JSON.stringify(delTmpFileData),
                contentType: "application/json",
                success    : function(result) {
                    //g_sse_uuid = null;

                    if (result['result'] != 'Success') {
                        // opme_message('임시 파일 삭제 중 오류가 발생했습니다.');
                        console.log('임시 파일 삭제 중 오류가 발생했습니다.');
                        console.log(delTmpFileData);
                        return;
                    }

                    if (filenameArr != undefined && filenameArr.length > 0) {
                      // console.log("prepareDownload 111:"+filenameArr[0]);
                      // console.log("prepareDownload 222:"+filenameArr.length);
                       fileIdx = fileIdx + 1;

                      // console.log("prepareDownload 333 fileIdx:"+fileIdx);
                       prepareDownload(filenameArr[0], filenameArr.slice(1), fileIdx, fileLength);
                    }else{
                       postDownload();
                    }
                }
            });
        } // complete - end
    }); // ajax - end
}; // function - end

function deleteFile(param) {

    let file_list = param.map(function(o){
        return o.name;
    });

    let data = {
        filehub_id: $('#filehub_id').val(),
        path      : $('#current_path').val(),
        file_list : file_list
    }

    return $.ajax({
        url        : '/file/del',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        contentType: "application/json",
        success    : function(result) {
            let is_ok = true;
            let msg   = "";

            $.each(result, function(idx, element) {
                // 삭제 실패한 경우
                if (element['resultCode'] != 'EM0000') {
                    is_ok = false;
                    let error_msg = element['name'] + " : [" + element['resultCode'] + "] " + element['resultMsg'] + "<br/>";
                    msg += error_msg;
                }
            });

            // 1건 이라도 삭제 실패한 경우
            if(is_ok == false) {
                opme_message(msg);
                return;
            }

            opme_message("삭제 완료 했습니다.", function () {
                g_page = 1;
                getGridData(g_current_path);
            });
        }
    });
};

function preDownload() {
    // console.log($("#upload_file")[0].files[0]);
    // console.log($("#upload_file"));
    $(document).unbind('ajaxStop');
    $.ajax({
        url        : '/file/predownload',
        type       : 'GET',
        success    : function(result) {

        }
    });

    return;
};
var unblock = function () {
   $.unblockUI();
}

function postDownload() {
    // console.log($("#upload_file")[0].files[0]);
    // console.log($("#upload_file"));
    $('.progress-txt').html( '파일 생성 중 입니다. 잠시 후 다운로드가 시작됩니다.'  );
    $.unblockUI();
    $(document).bind("ajaxStop", unblock );

    return;
};

// Deprecated 단건 Upload
function uploadSingleFile() {
    // console.log($("#upload_file")[0].files[0]);
    // console.log($("#upload_file"));

    return;

    $.ajax({
        url        : '',
        processData: false,
        contentType: false,
        data       : formData,
        type       : 'POST',
        success    : function(result) {
            alert("업로드 성공!!");
        }
    });
};

// UUID v4 생성함수
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
