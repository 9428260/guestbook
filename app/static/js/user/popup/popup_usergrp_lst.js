var g_page        = 1;
var g_per_page    = 10;
var g_single_mode = false; // mode initial value (true: single, false: multi)

$a.page(function() {
    this.init = function(id, param) {
        if (param['mode'] != null && param['mode'] == "single") {
            g_single_mode = true;
        }

        if (param['user_param'] != null) {
            $('#id').val(param['user_param']['usergrp_id']);
        }

        initGrid();
        setEventListener();
    }
});

function setEventListener() {

    // 검색조건 영역 초기화
    $('#btn_init').on('click', function(e) {
        $(".search_wrap .search_area_input .Textinput").val('');
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

    // 조회
    $('#btn_sel').on('click', function() {
        g_page = 1;
        getGridData();
    });

    // Grid 데이터 더블 클릭 시 추가 - 단건(single) 추가 인 경우만
    $('#usergrp_grid').on('dblclick', '.bodycell', function(e) {
        // "multi" 인 경우, double click 이벤트 처리 없음.
        if (g_single_mode == false) return;

        let dataObj = AlopexGrid.parseEvent(e).data;
        let rowData = $("#usergrp_grid").alopexGrid( "dataGetByIndex" , {data: dataObj._index.data});

        $a.close(new Array(AlopexGrid.trimData(rowData)));
    });

    // 추가
    $("#btn_add").on("click", function(e) {
        let userGroupInfo = $('#usergrp_grid').alopexGrid( 'dataGet' , { _state : { selected : true } } );// 선택된 데이터

        if (userGroupInfo.length == 0) {
            opme_message("사용자그룹을 선택해주세요.");
            return;
        }
        $a.close(AlopexGrid.trimData(userGroupInfo));
    });

    // 닫기
    $("#btn_close").on("click", function(e) {
        $a.close();
    });

    // Page 버튼을 클릭 했을 때 데이터 바인딩
    $('#usergrp_grid').on('pageSet', function(e) {
        let evObj = AlopexGrid.parseEvent(e);
        g_page = evObj.page;
        getGridData();
    });

    // 우측 하단 페이지 당 데이터 개수 설정하는 이벤트 바인딩
    $('#usergrp_grid').on('perPageChange', function(e) {
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

function initGrid() {
    // 사용자 그리드 초기화
    $('#usergrp_grid').alopexGrid({
        height: 501,
        rowSelectOption: {
            clickSelect : true,
            singleSelect: g_single_mode,
            radioColumn : g_single_mode,
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
                title          : (g_single_mode ? "": null),
                selectorColumn : true,
                excludeFitWidth: true,
                resizing       : false,
            }, {
                align   : 'center',
                key     : 'id',
                title   : '사용자그룹 ID',
                width   : '200px',
                readonly: true,
            }, {
                align: 'center',
                key  : 'ownerUserId',
                title: '소유자 ID',
                width: '200px',
            }, {
                align: 'center',
                key  : 'ownerUserName',
                title: '소유자 이름',
                width: '200px',
            }, {
                align: 'center',
                key  : 'description',
                title: '설명',
                width: '300px'
            },
        ],
    });

    getGridData();
};

function getGridData() {
    let data = {
        page      : g_page,
        perPage   : g_per_page,
        usergrp_id: $("#id").val(),
        owner_id  : $("#owner_id").val(),
    };

    return $.ajax({
        url        : '/usergroup/list',
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

            $('#usergrp_grid').alopexGrid('dataSet', result['userGroupList'], serverPageInfo);
        }
    });
};
