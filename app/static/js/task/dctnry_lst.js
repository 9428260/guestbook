var g_page     = 1;
var g_per_page = 10;

var g_type_arr = [];

$a.page(function(){
	this.init = function(id, param) {
        // ERROR
        if (typeof response !== 'undefined' && response['resultCode'] != 'EM0000') {
            opme_message(response['resultMsg']);
        }

        // Super-User 가 아니면, 추가/삭제 불가
        if (login_privilege != "9") {
            $(".table_wrap .btn-right").hide();
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
    $('#dctnry_grid').on('pageSet', function(e) {
        let evObj = AlopexGrid.parseEvent(e);
        g_page = evObj.page;
        getGridData();
    });

    // 우측 하단 페이지 당 데이터 개수 설정하는 이벤트 바인딩
    $('#dctnry_grid').on('perPageChange', function(e) {
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

    // 등록
    $("#btn_add_dctnry").on("click", function(e) {
        addDict();
    });

    // Grid 데이터 더블 클릭 시 상세화면
    $('#dctnry_grid').on('dblclick', '.bodycell', function(e) {
        let dataObj = AlopexGrid.parseEvent(e).data;
        let rowData = $("#dctnry_grid").alopexGrid( "dataGetByIndex" , {data: dataObj._index.data});

        if(rowData && rowData['vocaNo']) {
            let params = {
                'dctnry_voca_no'   : rowData['vocaNo'],
                'sc_dctnry_voca_no': $("#dctnry_voca_no").val(),
                'sc_dctnry_word'   : $("#dctnry_word").val(),
                'sc_dctnry_type'   : $("#dctnry_type").val(),
                'sc_page'          : g_page,
                'sc_per_page'      : g_per_page,
            };

            opme_postWithParam('/dctnry/dtl', params);
        }
    });

    // 삭제
    $("#btn_del_dctnry").on("click", function(e) {
        let data = $('#dctnry_grid').alopexGrid('dataGet', { _state : { selected : true } } );// 선택된 데이터
        if (data == '') return;

        if (confirm("선택된 단어를 삭제 하시겠습니까?")) {
            delDict(AlopexGrid.trimData(data));
        }
    });
};

function initCombo() {
    let result = opme_getCode(['dctnry_type']);
    if (result == false) return;

    g_type_arr = result['dctnry_type'];

    $('#dctnry_type').setData({
        data           : g_type_arr,
        option_selected: g_type_arr[0]['value'] // 최초 선택값 설정.
    });
};

function initGrid() {
    // 사용자 그리드 초기화
    $('#dctnry_grid').alopexGrid({
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
                key     : 'vocaNo',
                title   : 'No.',
                width   : '6px',
                readonly: true,
                hidden  : true,
            }, {
                align : 'center',
                key   : 'type',
                title : '구분',
                width : '300px',
                render: {
                    type: 'string',
                    rule: function(value, data) {
                        return g_type_arr;
                    }
                }
            }, {
                align: 'center',
                key  : 'word',
                title: '단어명',
                width: '300px',
            },
        ],
    });

    // 조회 조건이 존재하는 경우, 해당 조건으로 재조회.
    if (typeof request_params !== 'undefined' && request_params != null) {
        $('#dctnry_voca_no').val(request_params['sc_dctnry_voca_no']);
        $('#dctnry_word').val(request_params['sc_dctnry_word']);
        $('#dctnry_type').val(request_params['sc_dctnry_type']);

        g_page     = parseInt(request_params['sc_page']);
        g_per_page = parseInt(request_params['sc_per_page']);
    }

    getGridData();
};

function getGridData() {
    let data = {
        page          : g_page,
        perPage       : g_per_page,
        dctnry_voca_no: $("#dctnry_voca_no").val(),
        dctnry_word   : $("#dctnry_word").val(),
        dctnry_type   : $("#dctnry_type").val(),
    };

    return $.ajax({
        url        : '/dctnry/list',
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

            $('#dctnry_grid').alopexGrid('dataSet', result['vocaList'], serverPageInfo);
        }
    });
};

function addDict() {

    let params = {
        'dctnry_voca_no'   : '',
        'sc_dctnry_voca_no': $("#dctnry_voca_no").val(),
        'sc_dctnry_word'   : $("#dctnry_word").val(),
        'sc_dctnry_type'   : $("#dctnry_type").val(),
        'sc_page'          : g_page,
        'sc_per_page'      : g_per_page,
    };

    opme_postWithParam('/dctnry/dtl', params);
};

function delDict(param) {

    let id_list = param.map(function(o){
        return o.vocaNo;
    });

    return $.ajax({
        url        : '/dctnry/del',
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
                    let error_msg = element['dctnry_voca_no'] + " : [" + element['resultCode'] + "] " + element['resultMsg'] + "<br/>";
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
