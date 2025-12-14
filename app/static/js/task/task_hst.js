var g_page     = 1;
var g_per_page = 10;

var g_latest_rev_task_id = "";

$a.page(function() {
	this.init = function(id, param) {
	    initData();
	    initGrid();
		setEventListener();
	};
});

function setEventListener() {

    // 검색조건 영역 초기화
    $('#btn_init').on('click', function(e) {
        $(".search_wrap .search_area_input .Textinput").val('');
    });

    // Task ID 조회
    $('#btn_sel_task_id').on('click', function(e) {

        let task_param = {
            perm_yn: true, // true: 권한제어, false: 권한제어없음
            task_id: $('#task_id').val(),
        };

        opme_searchTask('태스크 조회', 'single', task_param, function(task_info) {
            if (task_info.length == 1) {
                $('#task_id').val(task_info[0]['id']);
                $("#task_id").trigger("change");
            }
        });
    });

    // 조회
    $('#btn_sel').on('click', function() {
        g_page = 1;
        getGridData();
    });

    // Page 버튼을 클릭 했을 때 데이터 바인딩
    $('#task_hst_grid').on('pageSet', function(e) {
        let evObj = AlopexGrid.parseEvent(e);
        g_page = evObj.page;
        getGridData();
    });

    // 우측 하단 페이지 당 데이터 개수 설정하는 이벤트 바인딩
    $('#task_hst_grid').on('perPageChange', function(e) {
        let evObj  = AlopexGrid.parseEvent(e);
        g_page     = 1;
        g_per_page = evObj.perPage;
        getGridData();
    });

    // 검색 버튼 'Enter' 처리
    $(".search_area_input .Textinput").on('keyup', function(e) {
        if(e.keyCode == 13) { // 'Enter' Key
            g_page = 1;
            getGridData();
        }
    });

    // Grid 데이터 더블 클릭 시 상세화면
    $('#task_hst_grid').on('dblclick', '.bodycell', function(e) {
        let dataObj = AlopexGrid.parseEvent(e).data;
        let rowData = $("#task_hst_grid").alopexGrid( "dataGetByIndex" , {data: dataObj._index.data});

        if (!rowData || !rowData['id']) {
            opme_message("알 수 없는 오류 : 태스크 정보를 확인할 수 없습니다.");
            return;
        }

        let params = {
            'task_id': rowData['id'],
            'rev_no' : rowData['revNo'],
        };

        // TASK ID 가 변경된 경우를 위해, 최종 Revision 의 TASK ID 를 사용해 조회.
        if (typeof g_latest_rev_task_id !== 'undefined' && g_latest_rev_task_id != "") {
            params['task_id'] = g_latest_rev_task_id;
        }

        if (typeof request_params !== 'undefined' && request_params != null) {
            Object.assign(params, request_params); // params 에 request_params(검색조건)를 병합
        }

        opme_postWithParam('/task/dtl', params);

        return;
    });

    // 목록 버튼
    $('#btn_list').on('click', function(e) {
        if (typeof request_params === 'undefined' || request_params == null) {
            document.location.href = '/task';
        }
        opme_postWithParam('/task/', request_params);
    });
};

function initData() {
    if (typeof response === 'undefined') return;
    $('#task_id').val(response['revisionList'][0]['id']);

    return;
};

function initGrid() {

    // 태스크 그리드 초기화
    $('#task_hst_grid').alopexGrid({
        height: 501,
        rowSelectOption: {
		    clickSelect : true,
		    singleSelect: true,
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
                align   : 'center',
                key     : 'id',
                title   : '태스크 ID',
                width   : '6px',
                readonly: true,
            }, {
                align          : 'center',
                key            : 'revNo',
                title          : 'Revision No.',
                width          : '100px',
                excludeFitWidth: true,
                render         : function(value, data, render, mapping, grid) {
                    if (value == 0) return '미발행';
                    return value;
                }
            }, {
                align: 'center',
                key  : 'ownerUserId',
                title: '소유자 ID',
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
            }, {
                align: 'center',
                key  : 'description',
                title: '설명',
                width: '12px',
            },
        ],
    });

    if (typeof response === 'undefined') return;

    let serverPageInfo = {
        dataLength: response['totalCnt'], //총 데이터 길이
        current   : g_page, //현재 페이지 번호. 서버에서 받아온 현재 페이지 번호를 사용한다.
        perPage   : g_per_page || 10 //한 페이지에 보일 데이터 갯수
    };

    $('#task_hst_grid').alopexGrid('dataSet', response['revisionList'], serverPageInfo);
    g_latest_rev_task_id = $("#task_id").val();

    return;
};

// 유효성 검사
function validate() {

    if ($("#task_id").val() == '') {
        opme_message('[태스크 ID] 를 입력하세요.', function() {
            $("#task_id").focus();
        });
        return false;
    }

    return true;
};

function getGridData() {

    if (validate() == false) return false;

    let data = {
        page   : g_page,
        perPage: g_per_page,
        task_id: $("#task_id").val(),
    };

    return $.ajax({
        url        : '/publist/',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        contentType: "application/json",
        success    : function(result) {

            if (result['resultCode'] == 'EM0999') {
                opme_message("[" + result['resultCode'] + "] " + result['resultMsg']);
                return;
            }

            let serverPageInfo = {
                dataLength: result['totalCnt'], //총 데이터 길이
                current   : g_page, //현재 페이지 번호. 서버에서 받아온 현재 페이지 번호를 사용한다.
                perPage   : g_per_page || 10 //한 페이지에 보일 데이터 갯수
            };

            $('#task_hst_grid').alopexGrid('dataSet', result['revisionList'], serverPageInfo);
            g_latest_rev_task_id = data.task_id;
        }
    });
};
