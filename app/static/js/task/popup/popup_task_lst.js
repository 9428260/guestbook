var g_page        = 1;
var g_per_page    = 10;
var g_single_mode = false; // mode initial value (true: single, false: multi)
var g_perm_yn     = false; // 태스크 권한에 따른 제어 여부 (true: 권한제어, false: 권한제어없음)

var switchery     = null; // 권한있는 Task만 볼지 여부 토글버튼

$a.page(function() {
	this.init = function(id, param) {
        if (param['mode'] != null && param['mode'] == "single") {
            g_single_mode = true;
        }

        if (param['user_param'] != null) {
            $('#task_id').val(param['user_param']['task_id']);

            if (typeof param['user_param']['perm_yn'] !== "undefined" && param['user_param']['perm_yn'] != null) {
                g_perm_yn = param['user_param']['perm_yn'];
            }
        }

	    initGrid();
		setEventListener(param);
	};
});

function setEventListener(param) {

    // 검색조건 영역 초기화
    $('#btn_init').on('click', function(e) {
        $('.search_wrap .search_area_input .Textinput').val('');
    });

    // 조회
    $('#btn_sel').on('click', function() {
        // console.log($('#rev_zero').is(':checked'));
        g_page = 1;
        getGridData();
    });

    // 소유자 조회
    $('#btn_sel_owner_id').on('click', function() {
        let user_param = { user_id: $('#owner_id').val() };

        opme_searchUser('소유자 조회', 'single', user_param, function(user_info) {
            if (user_info.length == 1) {
                $('#owner_id').val(user_info[0]['id']);
            }
        });
    });

    // 발행자 조회
    $('#btn_sel_publisher_id').on('click', function() {
        let user_param = { user_id: $('#publisher_id').val() };

        opme_searchUser('발행자 조회', 'single', user_param, function(user_info) {
            if (user_info.length == 1) {
                $('#publisher_id').val(user_info[0]['id']);
            }
        });
    });

    // Grid 데이터 더블 클릭 시 추가
    $('#task_grid').on('dblclick', '.bodycell', function(e) {
        // "multi" 인 경우, double click 이벤트 처리 없음.
        if (g_single_mode == false) return;

        let dataObj = AlopexGrid.parseEvent(e).data;
        let rowData = $("#task_grid").alopexGrid( "dataGetByIndex" , {data: dataObj._index.data});

        // read 권한 없는 경우, 태스크 정보 페이지 이동 불가
        let read = rowData['permMode'].charAt(0);
        if (g_perm_yn == true && read != 'r') {
            return;
        }

        $a.close(new Array(AlopexGrid.trimData(rowData)));
    });

    // 추가
    $('#btn_add').on('click', function(e) {
        let taskInfo = $('#task_grid').alopexGrid( 'dataGet' , { _state : { selected : true } } );// 선택된 데이터

        if (taskInfo.length == 0) {
            opme_message("태스크를 선택해주세요.");
            return;
        }

        // 트리거 태스크 추가 시에 자기 자신은 추가 불가.
        if (param['user_param'] != null && param['user_param']['org_task_id'] !== 'undefined') {
            let org_task_id = param['user_param']['org_task_id'];
            if (org_task_id != null && org_task_id != '') {
                if (taskInfo[0]['id'] == org_task_id) {
                    opme_message("[" + taskInfo[0]['id'] + "] (을)를 추가할 수 없습니다.(자기자신 추가 불가)");
                    return;
                }
            }
        }

        $a.close(AlopexGrid.trimData(taskInfo));
    });

    // 닫기
    $("#btn_close").on("click", function(e) {
        $a.close();
    });

    // Page 버튼을 클릭 했을 때 데이터 바인딩
    $('#task_grid').on('pageSet', function(e) {
        let evObj = AlopexGrid.parseEvent(e);
        g_page = evObj.page;
        getGridData();
    });

    // 우측 하단 페이지 당 데이터 개수 설정하는 이벤트 바인딩
    $('#task_grid').on('perPageChange', function(e) {
        let evObj = AlopexGrid.parseEvent(e);
        g_page = 1;
        g_per_page = evObj.perPage;
        getGridData();
    });

    // 검색 버튼 'Enter' 처리
    $('.search_area_input').on('keyup', function(e) {
        if(e.keyCode == 13) { // 'Enter' Key
            g_page = 1;
            getGridData();
        }
    });

    // switch button
    switchery = new Switchery(document.querySelector('#taskChecker'));

};

function initGrid() {
    $('#task_grid').alopexGrid({
        height: 501,
        rowSelectOption: {
		    clickSelect : true,
		    singleSelect: g_single_mode,
            radioColumn : g_single_mode,
	    },
	    rowOption: {
	        allowSelect: function (data) {
	            if (g_perm_yn != true) {
	                return true;
	            }

	            let read = data.permMode.charAt(0);

	            if (read != 'r') {
	                return false;
	            }
	            return true;
	        },
	        styleclass: function (data) {
	            if (g_perm_yn != true) {
	                return null;
	            }

	            let read = data.permMode.charAt(0);

	            if (read != 'r') {
	                return "grid_disable_row";
	            }
	            return null;
	        }
	    },
        pager : true,
        paging: {
            perPage    : 10,
            pagerCount : 5,
            pagerSelect: true,
            pagerTotal : true
        },
        columnMapping: [
            {
                align          : 'center',
                key            : 'check',
                width          : '50px',
                title          : (g_single_mode ? "": null),
                selectorColumn : true,
                excludeFitWidth: true,
                resizing       : false,
            }, {
                align   : 'left',
                key     : 'id',
                title   : '태스크 ID',
                width   : '6px',
                readonly: true,
            }, {
                align : 'center',
                key   : 'revNo',
                title : 'Revision No.',
                width : '6px',
                render: function(value, data, render, mapping, grid) {
                    if (value == 0) return '미발행';
                    return value;
                }
            }, {
                align: 'center',
                key  : 'ownerUserId',
                title: '소유자 ID',
                width: '6px',
            }, {
                align: 'center',
                key  : 'permMode',
                title: '권한',
                width: '6px',
            }, {
                align       : 'center',
                key         : 'publishDate',
                title       : '발행일자',
                width       : '12px',
                defaultValue: "-",
                render      : function(value, data, render, mapping, grid) {
                    return opme_formatUTCString(value);
                }
            },
        ],
    });

    getGridData();
};

function getGridData() {

    let data = {
        page         : g_page,
        perPage      : g_per_page,
        id           : $('#task_id').val(),
        owner_id     : $('#owner_id').val(),
        publish_id   : "",//$('#publisher_id').val(),
        permitted_id : document.querySelector('#taskChecker').checked?g_login_id_p:'',
        rev_zero     : ''
    };

    return $.ajax({
        url        : '/task/list',
        type       : 'POST',
        dataType   : 'json',
        data       : JSON.stringify(data),
        contentType: 'application/json',
        success    : function(result) {

            if (result['resultCode'] == 'EM0999') {
                opme_message('[' + result['resultCode'] + '] ' + result['resultMsg']);
                return;
            }

            let serverPageInfo = {
                'dataLength': result['totalCnt'], //총 데이터 길이
                'current'   : g_page, //현재 페이지 번호. 서버에서 받아온 현재 페이지 번호를 사용한다.
                'perPage'   : g_per_page || 10 //한 페이지에 보일 데이터 갯수
            };

            $('#task_grid').alopexGrid('dataSet', result['taskList'], serverPageInfo);
        }
    });
};
