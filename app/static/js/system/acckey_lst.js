var g_page     = 1;
var g_per_page = 10;

var g_status_arr = [];

$a.page(function(){
	this.init = function(id, param) {
        // ERROR
        if (typeof response !== 'undefined' && response['resultCode'] != 'EM0000') {
            opme_message(response['resultMsg']);
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

    // 소유자 조회
    $('#btn_sel_owner_id').on('click', function() {
        let user_param = { user_id: $('#owner_id').val() };

        opme_searchUser('소유자 조회', 'single', user_param, function(user_info) {
            if (user_info.length == 1) {
                $('#owner_id').val(user_info[0]['id']);
            }
        });
    });

    // Page 버튼을 클릭 했을 때 데이터 바인딩
    $('#acckey_grid').on('pageSet', function(e){
        let evObj = AlopexGrid.parseEvent(e);
        g_page = evObj.page;
        getGridData();
    });

    // 우측 하단 페이지 당 데이터 개수 설정하는 이벤트 바인딩
    $('#acckey_grid').on('perPageChange', function(e){
        let evObj  = AlopexGrid.parseEvent(e);
        g_page     = 1;
        g_per_page = evObj.perPage;
        getGridData();
    });

    // 검색 버튼 'Enter' 처리
    $(".search_area_input").on('keyup', function(e){
        if(e.keyCode == 13) { // 'Enter' Key
            g_page = 1;
            getGridData();
        }
    });

    // 등록
    $('#btn_add_acckey').on('click', function(e) {
        addAccKey();
    });

    // Grid 데이터 더블 클릭 시 상세화면
    $('#acckey_grid').on('dblclick', '.bodycell', function(e){
        let dataObj = AlopexGrid.parseEvent(e).data;
        let rowData = $("#acckey_grid").alopexGrid( "dataGetByIndex" , {data: dataObj._index.data});

        if(rowData && rowData['id']) {
            let params = {
                'acckey_id'  : rowData['id'],
                'sc_id'      : $("#id").val(),
                'sc_owner_id': $("#owner_id").val(),
                'sc_status'  : $("#status").val(),
                'sc_page'    : g_page,
                'sc_per_page': g_per_page,
            };

            opme_postWithParam('/acckey/dtl', params);
        }
    });

    // 삭제
    $("#btn_del_acckey").on("click", function(e) {
        let data = $('#acckey_grid').alopexGrid('dataGet' , { _state : { selected : true } } );// 선택된 데이터
        if (data == '') return;

        if ( confirm("선택된 액세스 키를 삭제 하시겠습니까?") ) {
            delAccKey(AlopexGrid.trimData(data));
        }
    });
};

function initCombo() {
    let result = opme_getCode(['acckey_status']);
    if (result == false) return;

    g_status_arr = result['acckey_status'];

    $('#status').setData({
        data           : g_status_arr,
        option_selected: g_status_arr[0]['value'] // 최초 선택값 설정.
    });

    return;
};

function initGrid() {
    // 액세스 키 그리드 초기화
    $('#acckey_grid').alopexGrid({
//        height: 501,
        height: 'content',
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
        columnMapping : [
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
                title   : '액세스 키 ID',
                width   : '200px',
                readonly: true,
            }, {
                align: 'center',
                key  : 'name',
                title: '액세스 키 이름',
                width: '200px',
            }, {
                align: 'center',
                key  : 'ownerUserId',
                title: '소유자 ID',
                width: '200px',
            }, {
                align       : 'center',
                key         : 'expiryDate',
                title       : '만료일자',
                width       : '200px',
                defaultValue: "-",
                render      : function(value, data, render, mapping, grid) {
                    return opme_formatUTCString(value);
                }
            }, {
                align : 'center',
                key   : 'status',
                title : '상태',
                width : '300px',
                render: {
                    type: 'string',
                    rule: function(value, data) {
                        return g_status_arr;
                    }
                }
            },
        ],
    });

    // 조회 조건이 존재하는 경우, 해당 조건으로 재조회.
    if (typeof request_params !== 'undefined' && request_params != null) {
        $('#id').val(request_params['sc_id']);
        $('#owner_id').val(request_params['sc_owner_id']);
        $('#status').val(request_params['sc_status']);

        g_page     = parseInt(request_params['sc_page']);
        g_per_page = parseInt(request_params['sc_per_page']);
    }

    getGridData();
};

function getGridData() {
    let data = {
        page    : g_page,
        perPage : g_per_page,
        id      : $("#id").val(),
        owner_id: $("#owner_id").val(),
        status  : $("#status").val()
    };

    return $.ajax({
        url        : '/acckey/list',
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

            $('#acckey_grid').alopexGrid('dataSet', result['accessKeyList'], serverPageInfo);
        }
    });
};

function addAccKey() {

    let params = {
        'acckey_id'  : '',
        'sc_id'      : $("#id").val(),
        'sc_owner_id': $("#owner_id").val(),
        'sc_status'  : $("#status").val(),
        'sc_page'    : g_page,
        'sc_per_page': g_per_page,
    };

    opme_postWithParam('/acckey/dtl', params);
};

function delAccKey(param) {

    let id_list = param.map(function(o){
        return o.id;
    });

    return $.ajax({
        url        : '/acckey/del',
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
                    let error_msg = element['acckey_id'] + " : [" + element['resultCode'] + "] " + element['resultMsg'] + "<br/>";
                    msg += error_msg;
                }
            });

            // 1건 이라도 삭제 실패한 경우
            if(is_ok == false) {
                opme_message(msg);
                return;
            }
            opme_message("삭제 완료 했습니다.");

            g_page = 1;
            getGridData();
        }
    });
};
