var g_page     = 1;
var g_per_page = 10;

var g_privilege_arr  = [];
var g_privilege_dict = {};
var g_status_arr     = [];

$a.page(function(){
	this.init = function(id, param) {
        // ERROR
        if (typeof response !== 'undefined' && response['resultCode'] != 'EM0000') {
            opme_message(response['resultMsg']);
        }

        if (login_privilege != '9') { // Not '9' : Not Super User
            $(".btn-right").hide();
        }

	    initCombo();
	    initGrid();
		setEventListener();
	};
});

function setEventListener() {

    // 검색조건 영역 초기화
    $('#btn_init').on('click', function(e) {
        $(".search_wrap .search_area_input .Textinput").val('');
        $(".search_wrap .search_area_input .Select").val('all');
    });

    // 조회
    $('#btn_sel').on('click', function() {
        g_page = 1;
        getGridData();
    });

    // Page 버튼을 클릭 했을 때 데이터 바인딩
    $('#user_grid').on('pageSet', function(e) {
        let evObj = AlopexGrid.parseEvent(e);
        g_page = evObj.page;
        getGridData();
    });

    // 우측 하단 페이지 당 데이터 개수 설정하는 이벤트 바인딩
    $('#user_grid').on('perPageChange', function(e) {
        let evObj  = AlopexGrid.parseEvent(e);
        g_page     = 1;
        g_per_page = evObj.perPage;
        getGridData();
    });

    // 검색 버튼 'Enter' 처리
    $('.search_area_input .Textinput').on('keyup', function(e) {
        if(e.keyCode == 13) { // 'Enter' Key
            g_page = 1;
            getGridData();
        }
    });

    // 등록
    $('#btn_add_user').on("click", function(e) {
        addUser();
    });

    // Grid 데이터 더블 클릭 시 상세화면
    $('#user_grid').on('dblclick', '.bodycell', function(e) {
        let dataObj = AlopexGrid.parseEvent(e).data;
        let rowData = $("#user_grid").alopexGrid( "dataGetByIndex" , {data: dataObj._index.data});

        if(rowData && rowData['id']) {
            let params = {
                'user_id'          : rowData['id'],
                'sc_user_id'       : $("#user_id").val(),
                'sc_user_nm'       : $("#user_nm").val(),
                'sc_user_privilege': $("#user_privilege").val(),
                'sc_user_status'   : $("#user_status").val(),
                'sc_page'          : g_page,
                'sc_per_page'      : g_per_page,
            };

            opme_postWithParam('/user/dtl', params);
        }
    });

    // 삭제
    $('#btn_del_user').on("click", function(e) {
        let data = $('#user_grid').alopexGrid('dataGet' , { _state : { selected : true } } );// 선택된 데이터
        if (data == '') return;

        if ( confirm("선택된 사용자를 삭제 하시겠습니까?") ) {
            delUser(AlopexGrid.trimData(data));
        }
    });
};

function initCombo() {
    let result = opme_getCode(['user_privilege', 'user_status']);
    if (result == false) return;

    g_privilege_arr = result['user_privilege'];
    g_status_arr    = result['user_status'];

    g_privilege_arr.forEach(function(item) {
        g_privilege_dict[item['value']] = item['text'];
    });

    $('#user_privilege').setData({
        data           : g_privilege_arr,
        option_selected: g_privilege_arr[0]['value'] // 최초 선택값 설정.
    });

    $('#user_status').setData({
        data           : g_status_arr,
        option_selected: g_status_arr[0]['value'] // 최초 선택값 설정.
    });
};

function initGrid() {
    // 사용자 그리드 초기화
    $('#user_grid').alopexGrid({
        height: 501,
        rowSelectOption: {
		    clickSelect : true,
		    singleSelect: false
	    },
        pager: true,
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
                selectorColumn : true,
                excludeFitWidth: true,
                resizing       : false,
            }, {
                align   : 'center',
                key     : 'id',
                title   : '사용자 ID',
                width   : '6px',
                readonly: true,
            }, {
                align: 'center',
                key  : 'name',
                title: '사용자 이름',
                width: '6px',
            }, {
                align : 'center',
                key   : 'privilege',
                title : '사용자 권한',
                width : '6px',
                render: function(value, data, render, mapping, grid) {
                    return g_privilege_dict[value];
                }
            }, {
                align : 'center',
                key   : 'status',
                title : '활성여부',
                width : '5px',
                render: {
                    type: 'string',
                    rule: function(value, data) {
                        return g_status_arr;
                    }
                }
            }, {
                align       : 'center',
                key         : 'lastLoginDate',
                title       : '마지막 접속 시간',
                width       : '12px',
                defaultValue: "-",
                render      : function(value, data, render, mapping, grid) {
                    return opme_formatUTCString(value);
                }
            },
        ],
    });

    // 조회 조건이 존재하는 경우, 해당 조건으로 재조회.
    if (typeof request_params !== 'undefined' && request_params != null) {
        $('#user_id').val(request_params['sc_user_id']);
        $('#user_nm').val(request_params['sc_user_nm']);
        $('#user_privilege').val(request_params['sc_user_privilege']);
        $('#user_status').val(request_params['sc_user_status']);

        g_page     = parseInt(request_params['sc_page']);
        g_per_page = parseInt(request_params['sc_per_page']);
    }
    getGridData();

    return;
};

function getGridData() {
    let data = {
        page          : g_page,
        perPage       : g_per_page,
        user_id       : $("#user_id").val(),
        user_nm       : $("#user_nm").val(),
        user_privilege: $("#user_privilege").val(),
        user_status   : $("#user_status").val(),
    };

    return $.ajax({
        url        : '/user/list',
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

            $('#user_grid').alopexGrid('dataSet', result['userList'], serverPageInfo);
        }
    });
};

function addUser() {

    let params = {
        'user_id'          : '',
        'sc_user_id'       : $("#user_id").val(),
        'sc_user_nm'       : $("#user_nm").val(),
        'sc_user_privilege': $("#user_privilege").val(),
        'sc_user_status'   : $("#user_status").val(),
        'sc_page'          : g_page,
        'sc_per_page'      : g_per_page,
    };

    opme_postWithParam('/user/dtl', params);
};

function delUser(data) {

    let id_list = data.map(function(o){
        return o.id;
    });

    // admin 자가 삭제 금지
//    if (id_list.includes('admin')) {
//        alert("WebConsole 은 삭제 불가합니다.");
//        return ;
//    }

    return $.ajax({
        url        : '/user/del',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify({'id_list': id_list}),
        contentType: "application/json",
        success    : function(result) {
            let is_ok = true;
            let msg   = "";
            $.each(result, function(idx, element) {
                // 삭제 실패한 경우
                if (element['resultCode'] != 'EM0000') {
                    is_ok = false;
                    let error_msg = element['user_id'] + " : [" + element['resultCode'] + "] " + element['resultMsg'] + "<br/>";
                    msg += error_msg;
                }
            });

            // 1건 이라도 삭제 실패한 경우
            if (is_ok == false) {
                opme_message(msg);
                return;
            }
            opme_message("삭제 완료 했습니다.");

            g_page = 1;
            getGridData();
        }
    });
};