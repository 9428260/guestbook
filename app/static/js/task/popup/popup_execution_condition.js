var g_page = 1;
var g_per_page = 10;

$a.page(function(){
	this.init = function(id, param) {
	    initData(param['user_param']);
	    initGrid(param['user_param']);
		setEventListener(param['user_param']);
	};
});

function setEventListener(param) {

    // 검색조건 영역 초기화
    $('#btn_init').on('click', function(e) {
        $(".search_wrap .search_area_input .Textinput").val('');
    });

    // 조회
    $('#btn_sel').on('click', function() {
        g_page = 1;
        getGridData(param);
    });

    // 닫기
    $("#btn_close").on("click", function(e) {
        $a.close();
    });

    // Page 버튼을 클릭 했을 때 데이터 바인딩
    $('#node_grid').on('pageSet', function(e) {
        let evObj = AlopexGrid.parseEvent(e);
        g_page = evObj.page;
        getGridData(param);
    });

    // 우측 하단 페이지 당 데이터 개수 설정하는 이벤트 바인딩
    $('#node_grid').on('perPageChange', function(e) {
        let evObj = AlopexGrid.parseEvent(e);
        g_page = 1;
        g_per_page = evObj.perPage;
        getGridData(param);
    });

    // 검색 버튼 'Enter' 처리
    $(".search_area_input .Textinput").on('keyup', function(e) {
        if(e.keyCode == 13) { // 'Enter' Key
            g_page = 1;
            getGridData(param);
        }
    });

    // 실행 대상 "추가"
    $("#btn_add_node").on("click", function(e) {
        let node_info = AlopexGrid.trimData($('#node_grid').alopexGrid('dataGet' , { _state : { selected : true } } )); // 선택된 데이터
        if (node_info == '') return;

        // 중복제거
        for (let i=0; i<node_info.length; i++) {
            let target = $("#target_grid").alopexGrid("dataGet", {"nodeSessionId": node_info[i]["nodeSessionId"]});
            if ($.isEmptyObject(target)) { // Grid 에 없으면 추가
                $("#target_grid").alopexGrid('dataAdd', node_info[i]);
            }
        }

        $('#node_grid').alopexGrid('rowSelect', { _state: { selected: true } }, false);
    });

    // 실행 대상 "제거"
    $("#btn_del_node").on("click", function(e) {
        $('#target_grid').alopexGrid('dataDelete', { _state: { selected: true } } ); // 선택된 데이터
        $('#target_grid').alopexGrid('rowSelect' , { _state: { selected: true } }, false);
    });

    // 실행
    $("#btn_execute").on("click", function(e) {

        if (!confirm("[" + $('#task_id').text() + "] 을(를) 실행 하시겠습니까?")) {
            return;
        }

        // Ajax Call
        let target_list = AlopexGrid.trimData($('#target_grid').alopexGrid('dataGet'));
        let node_session_id_list = target_list.map( function (o) {
            return o.nodeSessionId;
        });

        let param = {
            'task_id': $('#task_id').text(),
            'target_list': node_session_id_list,
            'task_arg': $("#argument").val(),
        };

        $.ajax({
            url: '/execution/execute',
            type: "POST",
            dataType: "json",
            data : JSON.stringify(param),
            contentType: "application/json",
            success : function(result) {
                if (result['resultCode'] != 'EM0000') {
                    opme_message("[" + result['resultCode'] + "] " + result['resultMsg'], function () {
                        $a.close();
                    });
                    return;
                }

                opme_message("[" + $('#task_id').text() + "] 수행 요청 되었습니다.(Exec No. : " + result['executionNo'] + ")", function () {
                    $a.close();
                });
                return;
            }
        });
    });
};

function initData(param) {
    // 부모창으로부터 데이터가 전달되는 경우.
    if (param != null) {
        $('#task_id').text(param['task_id']);
        $('#revision_no').text(param['rev_no']);
    }

    return;
};

function initGrid(param) {

    // 노드 그리드 초기화
    $('#node_grid').alopexGrid({
        height: 380,
        rowSelectOption: {
		    clickSelect: true,
		    singleSelect: false
	    },
        pager: true,
        paging: {
            perPage: 10,
            pagerCount: 5,
            pagerSelect: true,
            pagerTotal: true
        },
        columnMapping : [
            {
                align : 'center',
                key : 'check',
                width : '50px',
                selectorColumn : true,
                excludeFitWidth: true,
                resizing : false,
            }, {
//                align : 'center',
//                key : 'nodeSessionId',
//                title : '노드세션 ID',
//                width : '300px',
//                readonly : true,
//            }, {
                align : 'center',
                key : 'hostname',
                title : 'Hostname',
                width : '150px',
            }, {
                align : 'center',
                key : 'remoteAddr',
                title : 'IP주소',
                width : '150px',
            }, {
                align : 'center',
                key : 'account',
                title : 'OS계정',
                width : '100px',
            },
        ],
    });

    // 대상 그리드 초기화
    $('#target_grid').alopexGrid({
        height: 380,
        rowSelectOption: {
		    clickSelect: true,
		    singleSelect: false
	    },
        pager: true,
        paging: {
            perPage: 10,
            pagerCount: 5,
            pagerSelect: true,
            pagerTotal: true
        },
        message: {  // no message 처리
	    	nodata: '실행대상을 추가하지 않는 경우, 전체를 대상으로 실행 됩니다.',
	    },
        columnMapping : [
            {
                align : 'center',
                key : 'check',
                width : '50px',
                selectorColumn : true,
                excludeFitWidth: true,
                resizing : false,
            }, {
                align : 'center',
                key : 'hostname',
                title : 'Hostname',
                width : '150px',
            }, {
                align : 'center',
                key : 'remoteAddr',
                title : 'IP주소',
                width : '150px',
            }, {
                align : 'center',
                key : 'account',
                title : 'OS계정',
                width : '100px',
            },
        ],
    });

    getGridData(param);
};

function getGridData(param) {
    let hostname    = $('#hostname').val();
    let remote_addr = $('#remote_addr').val();
    let account     = $('#account').val();

    let data = {};
    data['nodeList'] = param['target_list'].filter(function(element, index) {
        if (hostname != null && hostname != '') {
            if (element.hostname.indexOf(hostname) == -1) return false;
        }

        if (remote_addr != null && remote_addr != '') {
            if (element.remoteAddr.indexOf(remote_addr) == -1) return false;
        }

        if (account != null && account != '') {
            if (element.account.indexOf(account) == -1) return false;
        }

        return true;
    });
    data['totalCnt'] = data['nodeList'].length;

    let serverPageInfo = {
        dataLength : data['totalCnt'], //총 데이터 길이
        current : g_page, //현재 페이지 번호. 서버에서 받아온 현재 페이지 번호를 사용한다.
        perPage : g_per_page || 10 //한 페이지에 보일 데이터 갯수
    };

    let startIdx = (g_page - 1) * g_per_page;
    let endIdx   = startIdx + g_per_page;
    $('#node_grid').alopexGrid('dataSet', data['nodeList'].slice(startIdx, endIdx), serverPageInfo);

    return;
};
