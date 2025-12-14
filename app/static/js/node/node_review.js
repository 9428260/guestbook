var g_editor;              // textarea editor (codemirror)
var g_grid_search = 0;     // 0: init, 1: searching
var g_search_old;
var g_search_new;
var g_filtered = false;
var g_textarea_val = "";

$a.page(function() {
	this.init = function(id, param) {

	    initData(param);
	    initRadio(); //codemirror 생성 전에 codemirror Text Area 를 hide 하면 숫자 표시 라인이 오류가 발생함 따라서 initData 뒤에 위치
	    initGrid();
		setEventListener();
	};
});

function setEventListener() {

    // 조회
    $('#btn_sel').on('click', function() {
        getGridData();
    });

    // 평가 결과 노드 검색 영역 Start
    $('#btn_search').on('click', function() {
        searchGridData('startSearch');
    });

    $('#btn_next').on('click', function() {
        searchGridData('searchNext');
    });

    $('#btn_prev').on('click', function() {
        searchGridData('searchPrevious');
    });

    $('#btn_end').on('click', function() {
        $('#search_keyword').val('');
        searchGridData('endSearch');
    });
    // 평가 결과 노드 검색 End

    // 조회 버튼 'Enter' 처리
    $(".search_area_input .Textinput").on('keyup', function(e) {
        if (e.keyCode == 13) { // 'Enter' Key
            getGridData();
        }
    });

    // Grid 검색 버튼 'Enter' 처리
    $(".grid_search_input .Textinput").on('keyup', function(e) {
        if (e.keyCode == 13) { // 'Enter' Key
            if (g_grid_search == 0) {
                searchGridData('startSearch');
            } else {
                g_search_new = $('#search_keyword').val();
                if (g_search_old == g_search_new) {
                    searchGridData('searchNext');
                } else {
                    searchGridData('startSearch');
                }
            }
        }
    });

    // Grid 검색 중, Filter 적용하는 경우. 검색을 다시 시작한다.
    $("#node_grid").on('filterChangeEnd', function(e) {
        if (g_grid_search == 1 && $('#search_keyword').val() != '') {
            searchGridData('endSearch');
            searchGridData('startSearch');
        }
        let evObj = AlopexGrid.parseEvent(e);
        if (evObj.targetColumnFilterOption == null) {
            g_filtered = false;
        } else {
            g_filtered = true;
        }
    });

    $('#btn_export').on('click', function(e){
        opme_exportExcel('node_review','Evaluation Results', 'node_grid', g_filtered);
    });

    $("#btn_template_download").on("click", function(e) {
        excelTemplateDownload();
    });

    $('#btn_upload').after('<input id="import_file_input" class="input-file-import" type="file" value="import" style="display:none" name="file"/>');

    // button 이벤트 바인딩
    $('#btn_upload').on('click', function(e) {
    	$('#import_file_input').click();
    });
    // 파일이 선택됐을때 로직
    $('#import_file_input').change( function(e){
    	var $input = $(this);
    	var $grid = $('#node_grid');
    	var files = e.target.files;
    	var worker = new ExcelWorker();
    	worker.import($grid, files, function(dataList){
            let edit_value = g_editor.getValue();
            if (edit_value != null && edit_value.length > 0) {
                edit_value += '\r\n';
            }
            let xl_value = "";
            for (let i = 0; i < dataList.length; i++) {
                xl_value += dataList[i]['hostname'];
                if (dataList[i]['account'] != null && dataList[i]['account'].length > 0) {
                    xl_value += '|' + dataList[i]['account'];
                }
                if(i != dataList.length -1){
                   xl_value = xl_value + '\r\n';
                }
            }
            g_editor.setValue(edit_value + xl_value);
            getGridData();
    	});
    	$input.val('');
    });

    $('#node_grid').on('dblclick', '.bodycell', function(e) {
        let dataObj = AlopexGrid.parseEvent(e).data;
        let rowData = $("#node_grid").alopexGrid( "dataGetByIndex" , {data: dataObj._index.data});

        if (rowData && rowData['status'] == 'disable') {
            opme_message("Node 상태가 disable 이므로 세부 정보가 존재하지 않습니다.");
            return;
        }

        if(rowData && rowData['nodeSessionId']) {
            let params = {
                'node_session_id'   : rowData['nodeSessionId'],
                'sc_list_page'      : "/nodereview/",
                'sc_textarea_val'   : g_textarea_val,
            };

            opme_postWithParam('/node/dtl', params);
        }
    });
};

function initRadio(){

    role_info  = 'Hostname의 첫문자, 마지막 문자는 영문자, 숫자만 가능 하고<br>';
    role_info += '그이후 문자는 영문자,숫자, -만 가능 합니다.<br>';
    role_info += '입력양식은 다음과 같습니다.</br>';
    role_info += '-----------------------------------------------------------------------------------</br>';
    role_info += 'Hostname1</br>';
    role_info += 'Hostname2</br>';
    role_info += '...</br>';
    role_info += 'Hostname3</br>';
    role_info += '-----------------------------------------------------------------------------------</br>';

    $('#sc_info').html(role_info);
    return;
}

// Search in Target Grid
function searchGridData (command) {

    if (command != 'endSearch' && $('#search_keyword').val() == '') {
        opme_message("검색조건을 입력하세요");
        return;
    }

    switch (command) {
        case 'startSearch':
            g_grid_search = 1;
            g_search_old  = $('#search_keyword').val();
            $('#node_grid').alopexGrid(command, $('#search_keyword').val());
            $(".popup-contents").scrollTop($(document).height());
            break;
        case 'searchNext':
        case 'searchPrevious':
            $('#node_grid').alopexGrid(command);
            break;
        case 'endSearch':
            g_grid_search = 0;
            $('#node_grid').alopexGrid(command);
            $(".popup-contents").scrollTop(0);
            break;
        default:
            opme_message('[ERROR] ' + command);
            return;
    }

    let info = $('#node_grid').alopexGrid('searchInfo');

    if (info == null) { // endSearch
        $('#search_info').text('');
        g_grid_search = 0;
        return;
    }

    if (info.matchCount == 0) { // Not Matched
        $('#search_info').text("No data");
        g_grid_search = 0;
        return;
    }

    let msg = (info.highlightPointer + 1) + ' / ' + info.matchCount + " 건";
    $('#search_info').text(msg);

    return;
}

function initGrid() {
    $('#node_grid').alopexGrid({
        // height: 'content',
        height: 530,
        rowSelectOption: {
		    clickSelect : true,
            singleSelect: true,
	    },
        pager : true,
        paging: {
            enabled    : false,
            pagerTotal : true
        },
        filteringHeader      : true,
        filteringHeaderHeight: 30,
        // filteringHeader: false,
        filter: {
		    movable: true,
		    saveFilterSize: true,
		    title: true
	    },
        columnMapping: [
            {
                align   : 'center',
                key     : 'nodeSessionId',
                title   : '노드세션 ID',
                width   : '260px',
                headerStyleclass: 'export-header',
                readonly: true,
                hidden  : true,
            }, {
                align: 'center',
                key  : 'hostname',
                title: 'Hostname',
                width: '130px',
                headerStyleclass: 'export-header',
            }, {
                align       : 'center',
                key         : 'osType',
                title       : 'OS 종류',
                width       : '80px',
                headerStyleclass: 'export-header',
                defaultValue: "-",
            }, {
                align       : 'center',
                key         : 'osName',
                title       : 'OS 이름',
                width       : '80px',
                headerStyleclass: 'export-header',
                defaultValue: "-",
            }, {
                align       : 'center',
                key         : 'osVer',
                title       : 'OS 버전',
                headerStyleclass: 'export-header',
                defaultValue: "-",
            }, {
                align       : 'center',
                key         : 'remoteAddr',
                title       : 'IP 주소',
                width       : '130px',
                headerStyleclass: 'export-header',
                defaultValue: "-",
            }, {
                align       : 'center',
                key         : 'agentVer',
                title       : 'Agent Ver.',
                width       : '230px',
                headerStyleclass: 'export-header',
                defaultValue: "-",
            }, {
                align       : 'center',
                key         : 'heartbeat',
                title       : 'Heart Beat',
                width       : '190px',
                headerStyleclass: 'export-header',
                defaultValue: "-",
                render      : function(value, data, render, mapping, grid) {
                    return opme_formatUTCString(value);
                }
            }, {
                align: 'center',
                key  : 'status',
                title: '상태',
                width: '100px',
                headerStyleclass: 'export-header',
                defaultValue: "enable",
            }
        ],
    });

    if (typeof request_params !== 'undefined' && request_params != null) {
        if (request_params['sc_textarea_val']) {
           g_editor.setValue(request_params['sc_textarea_val']);
           getGridData();
        }
    }

    return;
};

function getGridData() {
    g_textarea_val = unescape(encodeURIComponent(g_editor.getValue()));

    if (g_textarea_val == '') {
        opme_message("Hostname 을 입력하세요");
        return;
    }

    let hostname_arr      = g_textarea_val.split('\r\n');
    let case_include      = $('#case_include').is(':checked');
    let hostname_list     = new Array();

    for (let i = 0; i < hostname_arr.length; i++) {
        if ($.trim(hostname_arr[i]) == '') {
            continue;
        }
        // Hostname 입력값 유효성 검증
        if (!validateHostname(hostname_arr[i],i)) {
            return false;
        }
        hostname_list.push(hostname_arr[i]);
    }

    let data = {
        case_include : case_include,
        hostname_list: hostname_list,
        // 부모창 (role, task) 정보를 전달
        parent       : 'task',
    };

    return $.ajax({
        url        : '/nodereview/exact_list',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        contentType: "application/json",
        success    : function(result) {
            if (result['resultCode'] != 'EM0000') {
                $('#node_grid').alopexGrid('dataSet', result['nodeList']);
                opme_message("[" + result['resultCode'] + "] " + result['resultMsg']);
                return false;
            }

            let serverPageInfo = {
                dataLength: result['totalCnt'], //총 데이터 길이
            };

            $('#node_grid').alopexGrid('dataSet', result['nodeList'], serverPageInfo);
            return true;
        }
    });
};

// Hostname 유효성 검증
function validateHostname(str, idx) {

    let host              = '';
    let account           = '';
    // 공백 정규식
    const reg_white_space = /\s/gi;
    // Hostname 입력시 라인과 입력값
    let msg = "[line. " + (idx + 1) + "]&nbsp;&nbsp;'" + decodeURIComponent(escape(str)) + "'";
    max_len = 63;
    str = str.trim();

    // 공백 체크
    if (reg_white_space.test(str)) {
        opme_message("입력된 값에 공백이 존재 합니다.<br/>" + msg);
        return false;
    }

    if (str.length > max_len) {
        opme_message ("Hostname 은 " + max_len + "자리 이하만 입력 가능합니다.<br/>" + msg);
        return false;
    }

    if (opme_validHostname(str) == false) {
        opme_message ("Hostname 명명 규칙에 맞지 않는 이름입니다.<br/>" + msg);
        return false;
    }

    if (opme_hasKorean(str)) {
        opme_message("Hostname 은 영문, 숫자만 입력 가능합니다.<br/>" + msg);
        return false;
    }

    return true;
}

function initData(param) {

    // CodeMirror 에서 제공하는 Syntax 모드를 사용하기 위한 BaseURL(Jinja2) + 상세 URL

    CodeMirror.modeURL += '%N/%N.js'

    let textarea = $('#script_content');

    g_editor = CodeMirror.fromTextArea(textarea[0], {
        lineNumbers  : true,
        lineWrapping : true,
        lineSeparator: '\r\n',
        theme        : 'solarized light', // 테마 변경 시에는 html 에서 테마에 해당하는 css 를 추가.
        readOnly     : false,
        val          : textarea.val(),
        // autoRefresh  : true
    });

    //부모창 (role, task)에 따라 설정 스크립트 입력정보가 달라져서 height를 다르게 적용
    g_editor.setSize(500, 180); // width, height

    g_editor.setOption("mode", "text/x-sh");
    CodeMirror.autoLoadMode(g_editor, "shell");

    return;
};

function excelTemplateDownload() {
    let data = [
	    {
		    "hostname": "test-host0"
	    },{
		    "hostname": "test-host1"
	    },{
		    "hostname": "test-host2"
	    }
    ];

	$('body').append('<div id="excelGridTemporation" style="visibility: hidden"></div>');

	// 엑셀 내보내기 임시 그리드 옵션
	var exportGridOption = {
		columnMapping : [
			{
				key : 'hostname',
				title : 'hostname',
				width : '100px',
                headerStyleclass: 'export-header',
			}
		],
		data: data
	}
	$('#excelGridTemporation').alopexGrid(exportGridOption);

	var worker = new ExcelWorker({
		excelFileName : 'node_review_template',
    	defaultPalette : {
			fontsize: 11,
			font: '맑은 고딕',
		},
		//useCSSParser < defaultPalette < palette 순으로 우선순위가 높음
		palette : [{
			className : 'export-header',
			backgroundColor: '217,217,217',
			color : '0,0,0',
			font: '맑은 고딕',
			fontbold: true
		}],
		sheetList: [{
			sheetName: 'node_review',
			$grid: [$('#excelGridTemporation')]
		}]
	});
	worker.export({
		merge: true,
		border: true,
		useGridColumnWidth: true,
		useCSSParser: true,
	});

	// 메모리 해제를 위하여 AlopexGrid 객체를 우선 제거한다.
	$("#excelGridTemporation").removeAlopexGrid();
	$('#excelGridTemporation').remove();
}
