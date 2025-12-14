var g_page      = 1;
var g_per_page  = 10;
var g_page2     = 1;
var g_per_page2 = 10;

var g_execution_status_arr      = [];
var g_execution_result_arr      = [];
var g_execution_runner_type_arr = [];
var g_execution_node_status_arr = [];

var g_execution_status_dict      = {};
var g_execution_result_dict      = {};
var g_execution_node_status_dict = {};
var g_execution_runner_type_dict = {};

var g_execution_no = 0;
var g_data         = {};
var g_gather_data  = {};

var g_event_source = null;
var g_sse_uuid     = null;

$a.page(function() {
	this.init = function(id, param) {
        // ERROR
        if (typeof response !== 'undefined' && response['resultCode'] != 'EM0000') {
            opme_message(response['resultMsg']);
        }

        initCombo();
        initData();
	    initGrid();
		setEventListener();
	};
});

function setEventListener() {
    // 브라우저 닫기 시 confirm 가능함. 메뉴 이동 시에도 적용되어 대기 중
    //window.addEventListener('beforeunload', function(e) {
    //    if (g_export_ing == null)
    //        return;
    //    del_tmp_file();
    //    e.preventDefault();
    //    e.returnValue = '';
    //    console.log(e.preventDefault()); // undefined
    //    console.log(e.returnValue = ''); // 표시 값 없음
    //});

    // 새로고침 이벤트
    $('#btn_refresh').on('click', function(e) {

        getGridData();

        if (g_execution_no != 0) {
            getExecutionInfo(g_execution_no);
            getExecutionNodeInfo(g_execution_no);
        }
    });

    // 검색조건 영역 초기화
    $('#btn_init').on('click', function(e) {
        $("#execution_list .search_area_input .Textinput").val('');
        $('#execution_grid').alopexGrid('rowSelect', {_state : {selected:false}}, true);
        let aTag      = document.createElement('a');
        aTag.target   = '_self';
        aTag.download = g_execution_no + "_execution_lst" + "_export";
        document.body.append(aTag);
        aTag.click();
        aTag.remove();
    });

    // 검색조건 영역 초기화
    $('#btn_init_node').on('click', function(e) {
        $("#execution_node_list .search_area_input .Textinput").val('');
        $("#execution_node_list .search_area_input .Select").val('all');
    });

    // Task ID 조회
    $('#btn_sel_task_id').on('click', function(e) {

        let param = { task_id: $('#task_id').val() };

        opme_searchTask('태스크 조회', 'single', param, function(task_info) {
            if (task_info.length == 1) {
                $('#task_id').val(task_info[0]['id']);
                $("#task_id").trigger("change");
            }
        });
    });

    // 소유자 조회
    $('#btn_sel_owner_id').on('click', function() {
        let param = { user_id: $('#owner_id').val() };

        opme_searchUser('소유자 조회', 'single', param, function(user_info) {
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

    // Page 버튼을 클릭 했을 때 데이터 바인딩 - execution_grid
    $('#execution_grid').on('pageSet', function(e) {
        let evObj = AlopexGrid.parseEvent(e);
        g_page = evObj.page;
        getGridData();
    });

    // 우측 하단 페이지 당 데이터 개수 설정하는 이벤트 바인딩 - execution_grid
    $('#execution_grid').on('perPageChange', function(e) {
        let evObj  = AlopexGrid.parseEvent(e);
        g_page     = 1;
        g_per_page = evObj.perPage;
        getGridData();
    });

    // Page 버튼을 클릭 했을 때 데이터 바인딩 - execution_node_grid
    $('#execution_node_grid').on('pageSet', function(e) {
        let evObj = AlopexGrid.parseEvent(e);
        g_page2   = evObj.page;
        getExecutionNodeInfo(g_execution_no);
    });

    // 우측 하단 페이지 당 데이터 개수 설정하는 이벤트 바인딩 - execution_node_grid
    $('#execution_node_grid').on('perPageChange', function(e) {
        let evObj   = AlopexGrid.parseEvent(e);
        g_page2     = 1;
        g_per_page2 = evObj.perPage;
        getExecutionNodeInfo(g_execution_no);
    });

    // 검색 버튼 'Enter' 처리
    $("#execution_list .search_area_input .Textinput").on('keyup', function(e) {
        if(e.keyCode == 13) { // 'Enter' Key
            g_page = 1;
            getGridData();
        }
    });

    $("#execution_node_list .search_area_input .Textinput").on('keyup', function(e) {
        if(e.keyCode == 13) { // 'Enter' Key
            g_page2 = 1;

            if (g_execution_no != 0) {
                getExecutionNodeInfo(g_execution_no);
            }
        }
    });

    // Grid 데이터 클릭 시 상세화면 - execution_grid
    $('#execution_grid').on('click', '.bodycell', function(e) {
        let dataObj = AlopexGrid.parseEvent(e).data;
        let rowData = $("#execution_grid").alopexGrid( "dataGetByIndex" , {data: dataObj._index.data});

        // execute 권한 없는 경우, 실행정보 확인 불가
        let execute = rowData['permMode'].charAt(2);
        if (execute != 'x') {
            return;
        }

        let execution_no = rowData['executionNo']
        let task_id      = rowData['taskId']
        getExecutionInfo(execution_no);
	    getExecutionNodeInfo(execution_no);
    });

    // Grid 데이터 mouseover 시 권한 메시지
    $('#execution_grid').on('mouseover', '.bodycell', function(e){
        let dataObj = AlopexGrid.parseEvent(e).data;
        if (dataObj._index.column > 6) { // 버튼은 제외
            return;
        }

        let rowData = $("#execution_grid").alopexGrid( "dataGetByIndex" , {data: dataObj._index.data});
        if (!rowData || !rowData['taskId']) {
            opme_message("알 수 없는 오류 : 태스크 정보를 확인할 수 없습니다.");
            return;
        }

        // read 권한 없는 경우, 태스크 정보 페이지 이동 불가
    	let tooltip_id  = "msg_tooltip";
        let execute = rowData['permMode'].charAt(2);
        if (execute != 'x') {
            $("body").append('<div id="' + tooltip_id + '" class="grid_message">' + "실행정보 상세조회 권한이 없습니다.<br/>태스크 'x' 권한 필요" + '</div>');
    	    $("#" + tooltip_id).css('top' , e.pageY + 10);
    	    $("#" + tooltip_id).css('left', e.pageX + 10);
        }

        return;
    });

    $('#execution_grid').on('mousemove', '.bodycell', function(e){
        let dataObj = AlopexGrid.parseEvent(e).data;

        if (dataObj._index.column > 6) { // 버튼은 제외
            return;
        }

        if ($("#msg_tooltip").length > 0) {
    	    $("#msg_tooltip").css('top' , e.pageY + 10);
    	    $("#msg_tooltip").css('left', e.pageX + 10);
        }

        return;
    });

    // Grid 데이터 mouseout 시 권한 메시지
    $('#execution_grid').on('mouseout', '.bodycell', function(e){
        let dataObj = AlopexGrid.parseEvent(e).data;

        if (dataObj._index.column > 6) { // 버튼은 제외
            return;
        }

        if ($("#msg_tooltip").length > 0) {
            $("#msg_tooltip").remove();
        }
        return;
    });

    // Grid 데이터 더블 클릭 시 상세화면 - execution_node_grid
    $('#execution_node_grid').on('dblclick', '.bodycell', function(e) {
        let dataObj = AlopexGrid.parseEvent(e).data;
        let rowData = $("#execution_node_grid").alopexGrid( "dataGetByIndex" , {data: dataObj._index.data});

        if(rowData && rowData['nodeSessionId']) {
            let userParam = {
                'nodeSessionId': rowData['nodeSessionId'],
                'executionNo'  : g_execution_no,
            };

            $a.popup({
                url    : '/execution/p_node',
                title  : '태스크 실행 상세 정보',
                iframe : true,  // default 는 true
                width  : 1200,
                movable: true,
                data   : { 'mode': 'single', 'user_param': userParam },
                // callback: callback,
            });
        }
    });

    // 조회조건 노드조회
    $('#btn_sel_node').on('click', function() {
        g_page2 = 1;
        getExecutionNodeInfo(g_execution_no,$('#node_hostname').val(),$('#node_status').val(),$('#node_result').val());
    });

    // 실행결과 내보내기
    $('#btn_export').on('click', function() {
        //g_sse_uuid = self.crypto.randomUUID(); // https only

        g_sse_uuid = generateUUID();

        if (sse_enable == 'no'){
            $.blockUI({
                 message: '<img src="../static/images/progress.gif" width="200" height="200" />',
                css: {
                border: 'none',
                padding: '15px',
                backgroundColor: '#000',
                '-webkit-border-radius': '10px',
                '-moz-border-radius': '10px',
                opacity: .5,
                color: '#fff'
            } });
        } else {
            g_event_source = new EventSource('/execution/sse/' + g_sse_uuid);
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
        }

        // Delay 1 second
        setTimeout(function() {
            getExportData();
        }, 1000);
    })

    // 모음 데이터 실행결과 내보내기
    $('#btn_gather_export').on('click', function() {

        g_sse_uuid = generateUUID();


        if (sse_enable == 'no'){
            $.blockUI({
                 message: '<img src="../static/images/progress.gif" width="200" height="200" />',
                css: {
                border: 'none',
                padding: '15px',
                backgroundColor: '#000',
                '-webkit-border-radius': '10px',
                '-moz-border-radius': '10px',
                opacity: .5,
                color: '#fff'
            } });
        } else {
            g_event_source = new EventSource('/execution/sse/' + g_sse_uuid);

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
        }

        // Delay 1 second
        setTimeout(function() {
            getGatherExportData();
        }, 1000);
    })
};

// 초기 데이터 요청
function initData() {
    if (g_execution_no == 0) {
        $('#export_btn_area').hide();
    }

    if (typeof request_params === 'undefined' || request_params == null) {
        return;
    }

    // gather 버튼 숨김
//    $('#btn_gather_export').hide();

    // 조회 조건이 존재하는 경우, 해당 조건으로 재조회.
    $('#task_id').val(request_params['sc_id']);
    $('#owner_id').val(request_params['sc_owner_id']);

    g_page     = parseInt(request_params['sc_page']);
    g_per_page = parseInt(request_params['sc_per_page']);

    return;
};

function getExecutionInfo(execution_no) {

    let data = {
        execution_no: execution_no,
    };

    $.ajax({
        url        : '/execution/info',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        contentType: "application/json",
        success    : function(result) {
            if (result['resultCode'] != 'EM0000') {
                opme_message("[" + result['resultCode'] + "] " + result['resultMsg']);
                return;
            }
            // execution_info
            let execution_info = $('#execution_info td');

            let end_date = '-';
            if (result['endDate'] != null) {
                end_date = opme_formatUTCString(result['endDate']);
            }

            let start_date = opme_formatUTCString(result['startDate']);

            execution_info.eq(0).text(result['executionNo']);
            execution_info.eq(1).text(g_execution_status_dict[result['status']]);
            execution_info.eq(2).text(result['taskId']);
            execution_info.eq(3).text(g_execution_result_dict[result['result']]);
            execution_info.eq(4).text(g_execution_runner_type_dict[result['runnerType']]);
            execution_info.eq(5).text(start_date);
            execution_info.eq(6).text(result['runnerId']);
            execution_info.eq(7).text(end_date);
            execution_info.eq(8).text(result['argument']);
            execution_info.eq(8).attr("title", result['argument']);
            execution_info.eq(9).text(result['nodeCnt']);

	        g_execution_no = execution_no;
            $('#export_btn_area').show();
            if (!("base64Gather" in result)) {
                $('#btn_gather_export').hide();
            } else {
                $('#btn_gather_export').show();
                g_gather_data = result['base64Gather'];
            }
        }
    });

    $("#execution_info").show(); // 'show'

    return;
};

function getExecutionNodeInfo(execution_no) {

    // dblclick 없을 때 operation 없음
    if (execution_no == 0) return;

    let data = {
        page         : g_page2,
        perPage      : g_per_page2,
        execution_no : execution_no,
        node_hostname: $('#node_hostname').val(),
        node_status  : $('#node_status').val(),
        node_result  : $('#node_result').val(),
    };

    return $.ajax({
        url        : '/execution/nodelist',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        contentType: "application/json",
        success    : function(result) {
            if (result['resultCode'] == 'EM0999') {
                opme_message("[" + result['resultCode'] + "] " + result['resultMsg']);
                return;
            }

            let node_serverPageInfo = {
                dataLength: result['totalCnt'], //총 데이터 길이
                current   : g_page2, //현재 페이지 번호. 서버에서 받아온 현재 페이지 번호를 사용한다.
                perPage   : g_per_page2 || 10 //한 페이지에 보일 데이터 갯수
            };

            $('#execution_node_grid').alopexGrid('dataSet', result['executionNodeList'], node_serverPageInfo);
            g_data = result;
        }
    });

};

// 코드값 set
function initCombo() {
    let result = opme_getCode(['execution_status',
                               'execution_result',
                               'execution_runner_type',
                               'execution_node_status',]);
    if (result == false) return;

    g_execution_status_arr = result['execution_status'];
    g_execution_status_arr.forEach(function(item) {
        g_execution_status_dict[item['value']] = item['text'];
    });

    g_execution_result_arr = result['execution_result'];
    g_execution_result_arr.forEach(function(item) {
        g_execution_result_dict[item['value']] = item['text'];
    });

    g_execution_node_status_arr = result['execution_node_status'];
    g_execution_node_status_arr.forEach(function(item) {
        g_execution_node_status_dict[item['value']] = item['text'];
    });

    g_execution_runner_type_arr = result['execution_runner_type'];
    g_execution_runner_type_arr.forEach(function(item) {
        g_execution_runner_type_dict[item['value']] = item['text'];
    });

    $('#node_status').setData({
        data: g_execution_node_status_arr,
        option_selected: g_execution_node_status_arr[0]['value'] // 최초 선택값 설정.
    });

    $('#node_result').setData({
        data: g_execution_result_arr,
        option_selected: g_execution_result_arr[0]['value'] // 최초 선택값 설정.
    });
};

function initGrid() {

    // 태스크실행 그리드 초기화
    $('#execution_grid').alopexGrid({
        height: 501,
        rowSelectOption : {
		    clickSelect : true,
		    singleSelect: true
	    },
	    rowOption: {
	        allowSelect: function (data) {
	            /*
	            let execute = data.permMode.charAt(2);

                // 삭제 불가 처리
	            if (execute != 'x') {
	                return false;
	            }*/
	            return true;
	        },
	        styleclass: function (data) {
	            /*
	            let execute = data.permMode.charAt(2);

                // 조회 불가 처리
	            if (execute != 'x') {
	                return "grid_disable_row";
	            }*/
	            return null;
	        }
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
                align: 'center',
                key  : 'executionNo',
                title: 'Exec No.',
                width: '6px',
            }, {
                align   : 'left',
                key     : 'taskId',
                title   : '태스크 ID',
                width   : '6px',
                readonly: true,
            }, {
                align : 'center',
                key   : 'status',
                title : '상태',
                width : '5px',
                render: function(value, data, render, mapping, grid) {
                    return g_execution_status_dict[value];
                },
            }, {
                align : 'center',
                key   : 'result',
                title : '결과',
                width : '5px',
                render: function(value, data, render, mapping, grid) {
                    let result_str = g_execution_result_dict[value];
                    if (value != "F") return result_str;
                    return "<span class='fc-red'>" + result_str + "</span>";
                },
            }, {
                align       : 'center',
                key         : 'startDate',
                title       : '시작일시',
                width       : '12px',
                defaultValue: "-",
                render      : function(value, data, render, mapping, grid) {
                    return opme_formatUTCString(value);
                }
            }, {
                align       : 'center',
                key         : 'endDate',
                title       : '종료일시',
                width       : '12px',
                defaultValue: "-",
                render      : function(value, data, render, mapping, grid) {
                    return opme_formatUTCString(value);
                }
            }, {
                align       : 'center',
                key         : 'nodeCnt',
                title       : '노드수',
                width       : '4px',
                defaultValue: "-",
                render      : function(value, data, render, mapping, grid) {
                    return value;
                }
            }, {
                align          : 'center',
                key            : 'forceStop',
                title          : '강제종료',
                width          : '110px',
                excludeFitWidth: true,
                render         : function(value, data, render, mapping, grid) {
                    // 강제종료 test 시 3줄 주석
                    if (data['status'] == 'E') {
                        return '<div><button class="Button btn btn_grid Disabled">강제종료</button></div>';
                    }

	                let execute = data.permMode.charAt(2);
	                if (execute != 'x') { // Disable 처리
                        return '<div><button class="Button btn btn_grid Disabled">강제종료</button></div>';
	                }

                    $execute_button = $(
                        '<div><button id="btn_stop" class="Button btn btn_grid bg-red">강제종료</button></div>'
                    ).click(function () {
                        if (!confirm("[Execution No. " + data['executionNo'] + "] 을(를) 강제종료 하시겠습니까?")) {
                            return;
                        }

                        // Ajax Call
                        let param = {
                            'execution_no': data['executionNo'],
                        };

                        $.ajax({
                            url        : '/execution/force_stop',
                            type       : "POST",
                            dataType   : "json",
                            data       : JSON.stringify(param),
                            contentType: "application/json",
                            success    : function(result) {
                                if (result['resultCode'] != 'EM0000') {
                                    opme_message("[" + result['resultCode'] + "] " + result['resultMsg']);
                                    return;
                                }

                                opme_message("[" + data['executionNo'] + "] 강제종료 요청합니다.");
                                return;
                            }
                        });
                    });

                    return $execute_button;
                },
            },
        ],
    });

    // 태스크실행노드 그리드 초기화
    $('#execution_node_grid').alopexGrid({
        height: 'content',
        rowSelectOption: {
		    clickSelect : true,
		    singleSelect: true
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
                align: 'center',
                key  : 'nodeSessionId',
                title: '노드세션 ID',
                width: '25px',
            }, {
                align   : 'center',
                key     : 'hostname',
                title   : 'Hostname',
                width   : '10px',
                readonly: true,
            }, {
                align: 'center',
                key  : 'remoteAddr',
                title: 'IP 주소',
                width: '10px',
            }, {
                align : 'center',
                key   : 'status',
                title : '상태',
                width : '6px',
                render: function(value, data, render, mapping, grid) {
                    return g_execution_node_status_dict[value];
                }
            }, {
                align : 'center',
                key   : 'result',
                title : '결과',
                width : '6px',
                render: function(value, data, render, mapping, grid) {
                    return g_execution_result_dict[value];
                }
            }, {
                align          : 'center',
                key            : 'forceStop',
                title          : '강제종료',
                width          : '120px',
                excludeFitWidth: true,
                render         : function(value, data, render, mapping, grid) {
                    // execution_node_status - 'C': '실행종료', 'T': '실행중단'
                    if (data['status'] == 'C' || data['status'] == 'T') {
                        return '<div><button class="Button btn btn_grid Disabled">강제종료</button></div>';
                    }

                    $execute_button = $(
                        '<div><button id="btn_stop" class="Button btn btn_grid bg-red">강제종료</button></div>'
                    ).click(function () {
                        if (!confirm("[" + data['hostname'] + "] 태스크 실행을 강제종료 하시겠습니까?")) {
                            return;
                        }

                        // Ajax Call
                        let param = {
                            'execution_no'   : g_execution_no,
                            'node_session_id': data['nodeSessionId']
                        };

                        $.ajax({
                            url        : '/execution/node_force_stop',
                            type       : "POST",
                            dataType   : "json",
                            data       : JSON.stringify(param),
                            contentType: "application/json",
                            success    : function(result) {
                                if (result['resultCode'] != 'EM0000') {
                                    opme_message("[" + result['resultCode'] + "] " + result['resultMsg']);
                                    return;
                                }

                                opme_message("[" + data['hostname'] + "] 강제종료 요청했습니다.");
                                return;
                            }
                        });
                    });

                    return $execute_button;
                },
            },
        ],
    });

    // 실행 정보 set 위한 callback
    getGridData();
    // getGridData(function () {
    //     let rowData = $("#execution_grid").alopexGrid( "dataGetByIndex", {data: 0});
    //     if (typeof rowData === 'undefined' || rowData == null) {
    //         return;
    //     }
    //     let execution_no = rowData['executionNo']
    //     getExecutionInfo(execution_no);
    //     getExecutionNodeInfo(execution_no);
    //     g_execution_no = execution_no;
    // });
};

function getGridData(callback) {

    let data = {
        page    : g_page,
        perPage : g_per_page,
        task_id : $("#task_id").val(),
        owner_id: $("#owner_id").val(),
    };

    return $.ajax({
        url        : '/execution/list',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        contentType: "application/json",
        success    : function(data) {

            if (data['resultCode'] == 'EM0999') {
                opme_message("[" + data['resultCode'] + "] " + data['resultMsg']);
                return;
            }

            let serverPageInfo = {
                dataLength: data['totalCnt'], //총 데이터 길이
                current   : g_page, //현재 페이지 번호. 서버에서 받아온 현재 페이지 번호를 사용한다.
                perPage   : g_per_page || 10 //한 페이지에 보일 데이터 갯수
            };

            $('#execution_grid').alopexGrid('dataSet', data['executionList'], serverPageInfo);

            // callback
            if( typeof callback != 'undefined' && callback) {
                callback();
            }
        }
    });
};

function getExportData() {
    /* xl export 우측 상단 info
    $('#execution_info td').eq(0).text() // executionNo
                            eq(1).text() // status
                            eq(2).text() // task id
                            eq(3).text() // result
                            eq(4).text() // runnner type
                            eq(5).text() // start date
                            eq(6).text() // runner id
                            eq(7).text() // end date
                            eq(8).text() // argument
                            eq(9).text() // node cnt
    */
    let data = {
        execution_no    : g_execution_no,
        total_cnt       : g_data['totalCnt'],
        task_id         : $('#execution_info td').eq(2).text(),
        start_date      : $('#execution_info td').eq(5).text(),
        runner_id       : $('#execution_info td').eq(6).text(),
        end_date        : $('#execution_info td').eq(7).text(),
        sc_node_hostname: $('#node_hostname').val(),
        sc_node_status  : $('#node_status').val() == 'all' ? '' : $('#node_status').val(),
        sc_node_result  : $('#node_result').val() == 'all' ? '' : $('#node_result').val(),
        uuid            : g_sse_uuid,
    };

    // user 가 browser 에서 excel export 할 수 있는 처리
    $.ajax({
        url      : '/execution/xl_export',
        type     : "POST",
        data     : data,
        sse_enable : sse_enable,
        xhrFields: {
            responseType: 'arraybuffer'
        },
        success: function (data, textStatus, jqXhr) {

            if (!data) {
                opme_message("파일 다운로드 중 오류가 발생했습니다.");
                return;
            }

            try {
                let blob = new Blob([data], { type: jqXhr.getResponseHeader('content-type') });

                if (window.navigator.msSaveOrOpenBlob) { // IE10+
                    window.navigator.msSaveOrOpenBlob(blob, req_param['filename']);
                } else {
                    let aTag      = document.createElement('a');
                    let url       = window.URL.createObjectURL(blob);
                    aTag.href     = url;
                    aTag.target   = '_self';
                    aTag.download = "execution_" + g_execution_no + "_export.xlsx";
                    document.body.append(aTag);
                    aTag.click();
                    aTag.remove();
                    window.URL.revokeObjectURL(url);
                }
            } catch (e) {
                opme_message(e);
                return;
            }

        },
        complete: function(jqXhr, status) {

            if (sse_enable == 'no') {
                $.unblockUI();
            } else {
                if (g_event_source != null) {
                    g_event_source.close();
                    g_event_source = null;
                }
            }

            // Parse FileName in 'content-disposition'. jqXhr.getAllResponseHeaders() 로 확인
            let contentDisposition = jqXhr.getResponseHeader('content-disposition');
            let fileName = contentDisposition.split(';').filter(function(param) {
                return param.indexOf('filename') > -1
            }).map(function(param) {
                // param : file_name=ABC
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
                'file_name': g_sse_uuid,
            };

            return $.ajax({
                url        : '/execution/del_tmp_file',
                type       : 'POST',
                dataType   : "json",
                data       : JSON.stringify(delTmpFileData),
                contentType: "application/json",
                success    : function(result) {
                    g_sse_uuid = null;

                    if (result['result'] != 'Success') {
                        // opme_message('임시 파일 삭제 중 오류가 발생했습니다.');
                        console.log('임시 파일 삭제 중 오류가 발생했습니다.');
                        console.log(delTmpFileData);
                        return;
                    }
                }
            });
        } // complete - end
    }); // ajax - end
}; // function - end

function getGatherExportData() {
    /* xl export 우측 상단 info
    $('#execution_info td').eq(0).text() // executionNo
                            eq(1).text() // status
                            eq(2).text() // task id
                            eq(3).text() // result
                            eq(4).text() // runnner type
                            eq(5).text() // start date
                            eq(6).text() // runner id
                            eq(7).text() // end date
                            eq(8).text() // argument
                            eq(9).text() // node cnt
    */

    let data = {
        execution_no    : g_execution_no,
        total_cnt       : g_data['totalCnt'],
        task_id         : $('#execution_info td').eq(2).text(),
        start_date      : $('#execution_info td').eq(5).text(),
        runner_id       : $('#execution_info td').eq(6).text(),
        end_date        : $('#execution_info td').eq(7).text(),
        gather_data     : g_gather_data,
    //    sc_node_hostname: $('#node_hostname').val(),
    //    sc_node_status  : $('#node_status').val() == 'all' ? '' : $('#node_status').val(),
    //    sc_node_result  : $('#node_result').val() == 'all' ? '' : $('#node_result').val(),
        uuid            : g_sse_uuid,
    }

    $.ajax({
        url : '/execution/gather_export',
        type: "POST",
        contentType: 'application/json',
        data: JSON.stringify(data),
        sse_enable : sse_enable,
//        data: data,
        xhrFields: {
            responseType: 'blob'
        },
        success: function(data, textStatus, jqXhr) {
            if (!data) {
                opme_message("파일 다운로드 중 오류가 발생했습니다.");
                return;
            }

            try {
                let blob = new Blob([data], { type: jqXhr.getResponseHeader('content-type') });

                if (window.navigator.msSaveOrOpenBlob) { // IE10+
                    window.navigator.msSaveOrOpenBlob(blob, req_param['filename']);
                } else {
                    let aTag      = document.createElement('a');
                    let url       = window.URL.createObjectURL(blob);
                    aTag.href     = url;
                    aTag.target   = '_self';
                    aTag.download = "execution_" + g_execution_no + "_gather.xlsx";
                    document.body.append(aTag);
                    aTag.click();
                    aTag.remove();
                    window.URL.revokeObjectURL(url);
                }
            } catch (e) {
                opme_message(e);
                return;
            }
        }
    });
    return;
}; // function - end

// UUID v4 생성함수
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}