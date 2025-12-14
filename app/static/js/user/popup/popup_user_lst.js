var g_page        = 1;
var g_per_page    = 10;
var g_single_mode = false; // mode initial value (true: single, false: multi)

var g_user_privilege_arr = [];
var g_user_privilege_dict = {};
var g_user_status_arr    = [];

$a.page(function() {
    this.init = function(id, param) {
        if (param['mode'] != null && param['mode'] == "single") {
            g_single_mode = true;
        }

        if (param['user_param'] != null) {
            $('#id').val(param['user_param']['user_id']);
        }

        initCombo();
        initGrid();
        setEventListener();
    }
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

    // Grid 데이터 더블 클릭 시 추가
    $('#user_grid').on('dblclick', '.bodycell', function(e) {
        // "multi" 인 경우, double click 이벤트 처리 없음.
        if (g_single_mode == false) return;

        let dataObj = AlopexGrid.parseEvent(e).data;
        let rowData = $("#user_grid").alopexGrid( "dataGetByIndex" , {data: dataObj._index.data});

        $a.close(new Array(AlopexGrid.trimData(rowData)));
    });

    // 추가
    $("#btn_add").on("click", function(e) {
        let userInfo = $('#user_grid').alopexGrid( 'dataGet' , { _state : { selected : true } } );// 선택된 데이터

        if (userInfo.length == 0) {
            opme_message("사용자를 선택해주세요.");
            return;
        }
        $a.close(AlopexGrid.trimData(userInfo));
    });

    // 닫기
    $("#btn_close").on("click", function(e) {
        $a.close();
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
    $(".search_area_input").on('keyup', function(e) {
        if(e.keyCode == 13) { // 'Enter' Key
            g_page = 1;
            getGridData();
        }
    });
};

function initCombo() {

    let result = opme_getCode(['user_privilege', 'user_status']);
    if (result == false) return;

    g_user_privilege_arr = result['user_privilege'];
    g_user_status_arr    = result['user_status'];

    g_user_privilege_arr.forEach(function(item) {
        g_user_privilege_dict[item['value']] = item['text'];
    });

    $('#privilege').setData({
        data           : g_user_privilege_arr,
        option_selected: g_user_privilege_arr[0]['value'] // 최초 선택값 설정.
    });

    $('#status').setData({
        data           : g_user_status_arr,
        option_selected: g_user_status_arr[0]['value'] // 최초 선택값 설정.
    });
};

function initGrid() {
    // 사용자 그리드 초기화
    $('#user_grid').alopexGrid({
        height: 501,
        rowSelectOption: {
            clickSelect : true,
            singleSelect: g_single_mode,
            radioColumn : g_single_mode,
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
                align   : 'center',
                key     : 'id',
                title   : '사용자 ID',
                width   : '6px',
                readonly: true,
            }, {
                align : 'center',
                key   : 'name',
                title : '사용자 이름',
                width : '6px',
            }, {
                align : 'center',
                key   : 'privilege',
                title : '사용자 권한',
                width : '6px',
                render: function(value, data, render, mapping, grid) {
                    return g_user_privilege_dict[value];
                }
            }, {
                align : 'center',
                key   : 'status',
                title : '활성 상태',
                width : '5px',
                render: {
                    type: 'string',
                    rule: function(value, data) {
                        return g_user_status_arr;
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

    getGridData();
};

function getGridData() {
    let data = {
        page          : g_page,
        perPage       : g_per_page,
        user_id       : $("#id").val(),
        user_nm       : $("#nm").val(),
        user_privilege: $("#privilege").val(),
        user_status   : $("#status").val(),
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
                dataLength : result['totalCnt'], //총 데이터 길이
                current    : g_page, //현재 페이지 번호. 서버에서 받아온 현재 페이지 번호를 사용한다.
                perPage    : g_per_page || 10 //한 페이지에 보일 데이터 갯수
            };

            $('#user_grid').alopexGrid('dataSet', result['userList'], serverPageInfo);
        }
    });
};
