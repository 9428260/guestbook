var g_page     = 1;
var g_per_page = 10;
var switchery = null;

$a.page(function() {
	this.init = function(id, param) {
        // ERROR
        if (typeof response !== 'undefined' && response['resultCode'] != 'EM0000') {
            opme_message(response['resultMsg'], function (){
                // dtl 로 POST 이동 시에 오류 발생하여, 목록화면으로 돌아오는 경우.
                // - 새로고침 시에 이전 오류가 출력되지 않도록 URL을 목록화면 URL로 변경해준다.
                let idx = location.href.lastIndexOf('/dtl');
                if (idx != -1 && typeof(history.pushState) !== "undefined") {
                    history.pushState(null, null, location.href.substring(0, idx) + '/');
                }
            });
        }

        //getCommonInfo();
	    initGrid();
		setEventListener();
	};
});

function revisionIsZero() {
    let revision = '';
    if ($("#rev_zero").getValues()[0] == '0') {
        revision = '0';
    }
    return revision;
};

function setEventListener() {

    // 검색조건 영역 초기화
    $('#btn_init').on('click', function(e) {
        $(".search_wrap .search_area_input .Textinput").val('');
        $("#rev_zero").setChecked(false);
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
    $('#btn_sel_publish_id').on('click', function() {
        let user_param = { user_id: $('#publish_id').val() };

        opme_searchUser('발행자 조회', 'single', user_param, function(user_info) {
            if (user_info.length == 1) {
                $('#publish_id').val(user_info[0]['id']);
            }
        });
    });

    // 조회
    $('#btn_sel').on('click', function() {
        g_page = 1;
        getGridData();
    });

    // Page 버튼을 클릭 했을 때 데이터 바인딩
    $('#task_grid').on('pageSet', function(e) {
        let evObj = AlopexGrid.parseEvent(e);
        g_page = evObj.page;
        getGridData();
    });

    // 우측 하단 페이지 당 데이터 개수 설정하는 이벤트 바인딩
    $('#task_grid').on('perPageChange', function(e) {
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
    $("#btn_add").on("click", function(e) {
        addTask();
    });

    // Grid 데이터 더블 클릭 시 상세화면
    $('#task_grid').on('dblclick', '.bodycell', function(e){
        let dataObj = AlopexGrid.parseEvent(e).data;
        let rowData = $("#task_grid").alopexGrid( "dataGetByIndex" , {data: dataObj._index.data});

        if (!rowData || !rowData['id']) {
            opme_message("알 수 없는 오류 : 태스크 정보를 확인할 수 없습니다.");
            return;
        }

        // read 권한 없는 경우, 태스크 정보 페이지 이동 불가
        let read = rowData['permMode'].charAt(0);
        if (read != 'r') {
            return;
        }

        let params = {
            'task_id'      : rowData['id'],
            'rev_no'       : rowData['revNo'],
            'sc_id'        : $("#task_id").val(),
            'sc_owner_id'  : $("#owner_id").val(),
            'sc_rev_zero'  : revisionIsZero(),
            'sc_publish_id': $("#publish_id").val(),
            'sc_page'      : g_page,
            'sc_per_page'  : g_per_page,
        };

        // Revision 0. 일때는 "태스크 정보" 화면으로 바로 이동.
        if (rowData['revNo'] == '0') {
            opme_postWithParam('/task/dtl', params);
            return;
        }

        // Revision 0. 가 아닐 때는 Revision 0. 존재 확인 후,
        // 존재하면 Popup 출력, 존재 하지 않으면 "태스크 정보" 화면으로 바로 이동.
        $.ajax({
            url        : '/task/check_zero_rev',
            type       : "POST",
            dataType   : "json",
            data       : JSON.stringify({'id': rowData['id']}),
            contentType: "application/json",
            success    : function(result) {

                // result
                // Revision 0.(미발행/편집중) 없음.
                if (result['revision_zero_yn'] == false) {

                    opme_postWithParam('/task/dtl', params);

                    return;
                }

                $a.popup({
                    url     : '/task/p_select',
                    title   : '태스크 선택',
                    iframe  : true,  // default 는 true
                    width   : 500,
                    height  : 215,
                    movable : true,
                    data    : {'mode': 'single', 'user_param': {'id': rowData['id'], 'rev_no': rowData['revNo']}},
                    callback: function(popup_result) {
                        if (popup_result['go_rev_zero_yn'] == true) {
                            params['rev_no'] = 0;
                        }

                        opme_postWithParam('/task/dtl', params);
                    },
                });
            }
        });

        return;
    });

    // Grid 데이터 mouseover 시 권한 메시지
    $('#task_grid').on('mouseover', '.bodycell', function(e){
        let dataObj = AlopexGrid.parseEvent(e).data;

        // 버튼은 제외
        if (dataObj._index.column > 6) {
            return;
        }

        let rowData = $("#task_grid").alopexGrid( "dataGetByIndex" , {data: dataObj._index.data});

        if (!rowData || !rowData['id']) {
            opme_message("알 수 없는 오류 : 태스크 정보를 확인할 수 없습니다.");
            return;
        }

        // read 권한 없는 경우, 태스크 정보 페이지 이동 불가
    	let tooltip_id  = "msg_tooltip";
        let read = rowData['permMode'].charAt(0);
        if (read != 'r') {
            // Method #1. Trace
            $("body").append('<div id="' + tooltip_id + '" class="grid_message">' + "조회 권한이 없습니다." + '</div>');
    	    $("#" + tooltip_id).css('top' , e.pageY + 10);
    	    $("#" + tooltip_id).css('left', e.pageX + 10);

            /*
            // Method #2. Title
            // $(".table_wrap .con_title").append('<div id="' + tooltip_id + '" class="validation_msg bottom grid_message">' + "조회 권한이 없습니다." + '</div>');
            // $(".table_wrap .con_title").append('<div id="' + tooltip_id + '" class="validation_msg">' + "조회 권한이 없습니다." + '</div>');
    	    msg = rowData['id'] + " 태스크의 조회 권한이 없습니다."
            $(".validation_msg").html(msg);
            $(".validation_msg").show();
    	    */
        }

        return;
    });

    // Method #1. Trace
    $('#task_grid').on('mousemove', '.bodycell', function(e){
        let dataObj = AlopexGrid.parseEvent(e).data;

        // 버튼은 제외
        if (dataObj._index.column > 6) {
            return;
        }

        if ($("#msg_tooltip").length > 0) {
    	    $("#msg_tooltip").css('top' , e.pageY + 10);
    	    $("#msg_tooltip").css('left', e.pageX + 10);
        }

        return;
    });
    /*
    */

    // Grid 데이터 mouseout 시 권한 메시지
    $('#task_grid').on('mouseout', '.bodycell', function(e){
        let dataObj = AlopexGrid.parseEvent(e).data;

        // 버튼은 제외
        if (dataObj._index.column > 6) {
            return;
        }

        /*
        $(".validation_msg").hide();
        */
        if ($("#msg_tooltip").length > 0) {
            $("#msg_tooltip").remove();
        }
        return;
    });

    // 삭제
    $("#btn_del").on("click", function(e) {

        let data = $('#task_grid').alopexGrid('dataGet' , { _state : { selected : true } } );// 선택된 데이터
        if (data == '') return;

        if ( confirm("선택된 Task를 삭제 하시겠습니까?") ) {
            delTask(AlopexGrid.trimData(data));
        }
    });

    // switch button
    switchery = new Switchery(document.querySelector('#taskChecker'));
};


function initGrid() {
    // 태스크 그리드 초기화
    $('#task_grid').alopexGrid({
        height: 501,
        rowSelectOption: {
		    clickSelect : true,
		    singleSelect: false
	    },
	    rowOption: {
	        allowSelect: function (data) {
	            let write = data.permMode.charAt(1);

                // 삭제 불가 처리
	            if (write != 'w') {
	                return false;
	            }
	            return true;
	        },
	        styleclass: function (data) {
	            let read = data.permMode.charAt(0);

                // 조회 불가 처리
	            if (read != 'r') {
	                return "grid_disable_row";
	            }
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
        columnMapping : [
            {
                align          : 'center',
                key            : 'check',
                width          : '50px',
                selectorColumn : true,
                excludeFitWidth: true,
                resizing       : false,
            }, {
                align: 'center',
                key  : 'id',
                title: '태스크 ID',
                width: '100px',
            }, {
                align : 'center',
                key   : 'revNo',
                title : 'Revision No.',
                width : '35px',
                render: function(value, data, render, mapping, grid) {
                    if (value == 0) return '미발행';
                    return value;
                }
            }, {
                align: 'center',
                key  : 'draftExist',
                title: '미발행 존재',
                width: '35px',
            }, {
                align: 'center',
                key  : 'ownerUserId',
                title: '소유자 ID',
                width: '35px',
            }, {
                align: 'center',
                key  : 'permMode',
                title: '권한',
                width: '35px',
            }, {
                align       : 'center',
                key         : 'publishDate',
                title       : '발행일자',
                width       : '70px',
                defaultValue: "-",
                render      : function(value, data, render, mapping, grid) {
                    return opme_formatUTCString(value);
                }
            }, {
                align          : 'center',
                key            : 'revision_history',
                title          : '발행이력',
                width          : '120px',
                excludeFitWidth: true,
                resizing       : false,
                render         : function(value, data, render, mapping, grid) {
	                let read = data.permMode.charAt(0);

                    // 조회 불가 처리
	                if (read != 'r') {
                        return '<div><button class="Button btn btn_grid Disabled">이력보기</button></div>';
	                }

                    if (data['revNo'] == 0) {
                        return '<div><button class="Button btn btn_grid Disabled">이력보기</button></div>';
                    }

                    $execute_button = $(
                        '<div><button id="btn_view_history" class="Button btn btn_grid bg-green">이력보기</button></div>'
                    ).click(function () {
                        // Ajax Call
                        let params = {
                            'task_id'      : data['id'],
                            // 'page': 1,
                            // 'perPage': 10,
                            'sc_id'        : $("#task_id").val(),
                            'sc_owner_id'  : $("#owner_id").val(),
                            'sc_publish_id': $("#publish_id").val(),
                            'sc_rev_zero'  : revisionIsZero(),
                            'sc_page'      : g_page,
                            'sc_per_page'  : g_per_page,
                        };
                        opme_postWithParam('/publist/', params);
                    });

                    return $execute_button;
                },
            }, {
                align          : 'center',
                key            : 'dryrun',
                title          : '모의실행',
                width          : '120px',
                excludeFitWidth: true,
                resizing       : false,
                render         : function(value, data, render, mapping, grid) {

	                let read = data.permMode.charAt(0);

                    // 조회 불가 처리
	                if (read != 'r') {
                        return '<div><button class="Button btn btn_grid Disabled">모의실행</button></div>';
	                }

                    $execute_button = $(
                        '<div><button class="Button btn btn_grid bg-blue">모의실행</button></div>'
                    ).click(function () {
                        // Ajax Call
                        let param = {
                            'task_id': data['id'],
                            'rev_no' : data['revNo'],
                        };

                        // Revision 0. 일때는 "태스크 모의 실행" 팝업 화면 출력.
                        if (data['revNo'] == '0') {
                            // 모의실행 팝업
                            popupDryrun(param);
                            return;
                        }

                        // Revision 0. 가 아닐 때는 Revision 0. 존재 확인 후,
                        // 존재하면 Popup 출력, 존재 하지 않으면 "태스크 모의 실행" 팝업 화면 출력.
                        $.ajax({
                            url        : '/task/check_zero_rev',
                            type       : "POST",
                            dataType   : "json",
                            data       : JSON.stringify({'id': data['id']}),
                            contentType: "application/json",
                            success    : function(result) {

                                // result
                                // Revision 0.(미발행/편집중) 없음.
                                if (result['revision_zero_yn'] == false) {
                                    // 모의실행 팝업
                                    popupDryrun(param);
                                    return;
                                }

                                $a.popup({
                                    url     : '/task/p_select',
                                    title   : '태스크 선택',
                                    iframe  : true,  // default 는 true
                                    width   : 500,
                                    height  : 215,
                                    movable : true,
                                    data    : {'mode': 'single', 'user_param': {'id': param['task_id'], 'rev_no': param['rev_no']}},
                                    callback: function(popup_result) {
                                        if (popup_result['go_rev_zero_yn'] == true) {
                                            param['rev_no'] = 0;
                                        }

                                        // 모의실행 팝업
                                        popupDryrun(param);
                                        return;
                                    },
                                });
                            }
                        });
                    });

                    return $execute_button;
                },
            }, {
                align          : 'center',
                key            : 'execute',
                title          : '실행',
                width          : '120px',
                excludeFitWidth: true,
                resizing       : false,
                render         : function(value, data, render, mapping, grid) {
	                let execute = data.permMode.charAt(2);

                    // 실행 불가 처리
	                if (execute != 'x') {
                        return '<div><button class="Button btn btn_grid Disabled">실행</button></div>';
	                }

                    if (data['revNo'] == 0) {
                        return '<div><button class="Button btn btn_grid Disabled">실행</button></div>';
                    }

                    $execute_button = $(
                        '<div><button id="btn_execute" class="Button btn btn_grid bg-red">실행</button></div>'
                    ).click(function () {
                        if (!confirm("[" + data['id'] + "] 을(를) 실행 하시겠습니까?")) {
                            return;
                        }

                        // Ajax Call
                        let param = {
                            'task_id'    : data['id'],
                            'target_list': null,
                            'task_arg'   : null,
                        };

                        $.ajax({
                            url        : '/execution/execute',
                            type       : "POST",
                            dataType   : "json",
                            data       : JSON.stringify(param),
                            contentType: "application/json",
                            success    : function(result) {
                                if (result['resultCode'] != 'EM0000') {
                                    opme_message("[" + result['resultCode'] + "] " + result['resultMsg']);
                                    return;
                                }

                                opme_message("[" + data['id'] + "] 수행 요청 되었습니다.(Exec No. : " + result['executionNo'] + ")");
                                return;
                            }
                        });
                    });

                    return $execute_button;
                },
            }, {
                align          : 'center',
                key            : 'condition_execute',
                title          : '조건실행',
                width          : '120px',
                excludeFitWidth: true,
                resizing       : false,
                render         : function(value, data, render, mapping, grid) {
	                let execute = data.permMode.charAt(2);

                    // 실행 불가 처리
	                if (execute != 'x') {
                        return '<div><button class="Button btn btn_grid Disabled">조건실행</button></div>';
	                }

                    if (data['revNo'] == 0) {
                        return '<div><button class="Button btn btn_grid Disabled">조건실행</button></div>';
                    }

                    $execute_button = $(
                        '<div><button class="Button btn btn_grid bg-blue">조건실행</button></div>'
                    ).click(function () {
                        // Ajax Call
                        let param = {
                            'task_id': data['id'],
                            'rev_no' : data['revNo'],
                        };

                        $.ajax({
                            url        : '/execution/target_list',
                            type       : "POST",
                            dataType   : "json",
                            data       : JSON.stringify(param),
                            contentType: "application/json",
                            success    : function(result) {
                                if (result['resultCode'] != 'EM0000') {
                                    opme_message("[" + result['resultCode'] + "] " + result['resultMsg']);
                                    return;
                                }

                                let userParam = {
                                    'task_id'    : data['id'],
                                    'rev_no'     : data['revNo'],
                                    'target_list': result['executionNodeList'],
                                }

                                $a.popup({
                                    url    : '/execution/p_condition',
                                    title  : '태스크 조건 실행',
                                    iframe : true,  // default 는 true
                                    width  : 1200,
                                    movable: true,
                                    data   : {'mode': 'single', 'user_param': userParam},
                                    // callback: callback,
                                });
                            }
                        });
                    });

                    return $execute_button;
                },
            }, {
                align          : 'center',
                key            : 'execution_list',
                title          : '실행결과',
                width          : '120px',
                excludeFitWidth: true,
                resizing       : false,
                render         : function(value, data, render, mapping, grid) {
	                let execute = data.permMode.charAt(2);

                    // 실행 불가 처리
	                if (execute != 'x') {
                        return '<div><button class="Button btn btn_grid Disabled">결과보기</button></div>';
	                }

                    if (data['revNo'] == 0) {
                        return '<div><button class="Button btn btn_grid Disabled">결과보기</button></div>';
                    }

                    $execute_button = $(
                        '<div><button id="btn_view_execution" class="Button btn btn_grid bg-green">결과보기</button></div>'
                    ).click(function () {
                        // Ajax Call
                        let params = {
                            'sc_id'      : data['id'],
                            'sc_owner_id': data['ownerUserId'],
                            'sc_page'    : 1,
                            'sc_per_page': 10,
                        };

                        opme_postWithParam('/execution/', params);
                    });

                    return $execute_button;
                },
            },
        ],
    });

    // 조회 조건이 존재하는 경우, 해당 조건으로 재조회.
    if (typeof request_params !== 'undefined' && request_params != null) {
        $('#task_id').val(request_params['sc_id']);
        $('#owner_id').val(request_params['sc_owner_id']);
        if (request_params['sc_rev_zero'] == '0') {
            $("#rev_zero").setChecked(true);
        } else {
            $("#rev_zero").setChecked(false);
        }
        $('#publish_id').val(request_params['sc_publish_id']);

        g_page     = parseInt(request_params['sc_page']);
        g_per_page = parseInt(request_params['sc_per_page']);
    }

    getGridData();
};

function getGridData() {

    let data = {
        page         : g_page,
        perPage      : g_per_page,
        id           : $("#task_id").val(),
        owner_id     : $("#owner_id").val(),
        publish_id   : '', // $("#publish_id").val(),
        permitted_id : document.querySelector('#taskChecker').checked?g_login_id:'',
        rev_zero     : revisionIsZero(),
    };

    console.log(data);

    return $.ajax({
        url        : '/task/list',
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

            $('#task_grid').alopexGrid('dataSet', result['taskList'], serverPageInfo);
        }
    });
};

function addTask() {

    let params = {
        'task_id'      : '',
        'sc_id'        : $("#task_id").val(),
        'sc_owner_id'  : $("#owner_id").val(),
        'sc_rev_zero'  : revisionIsZero(),
        'sc_publish_id': $("#publish_id").val(),
        'sc_page'      : g_page,
        'sc_per_page'  : g_per_page,
    };

    opme_postWithParam('/task/dtl', params);
};

function delTask(param) {

    let id_list = param.map(function(o) {
        return o.id;
    });

    return $.ajax({
        url        : '/task/del',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify({'id_list': id_list}),
        contentType: "application/json",
        success    : function(result) {
            let is_ok  = true;
            let msg    = "";
            $.each(result, function(idx, element) {
                // 삭제 실패한 경우
                if (element['resultCode'] != 'EM0000') {
                    is_ok = false;
                    let error_msg = element['id'] + " : [" + element['resultCode'] + "] " + element['resultMsg'] + "<br/>";
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

function popupDryrun(param) {

    return $.ajax({
        url        : '/execution/target_list',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(param),
        contentType: "application/json",
        success    : function(result) {
            if (result['resultCode'] != 'EM0000') {
                opme_message("[" + result['resultCode'] + "] " + result['resultMsg']);
                return;
            }

            let userParam = {
                'task_id'    : param['task_id'],
                'rev_no'     : param['rev_no'],
                'login_id'   : opme_getLoginId(),
                'target_list': result['executionNodeList'],
            }

            $a.popup({
                url    : '/execution/p_dry_run',
                title  : '태스크 모의 실행',
                iframe : true,  // default 는 true
                width  : 1200,
                movable: true,
                data   : {'mode': 'single', 'user_param': userParam},
                // callback: callback,
            });
        }
    });
};
