var g_page     = 1;
var g_per_page = 10;

var g_result_page     = 1;
var g_result_per_page = 10;
var g_result_data     = null;
var g_execute_dry_run = 'N'; // '모의실행' 수행 여부

var g_runner_type_arr    = [];
var g_common_result_arr  = [];
var g_common_result_dict = {};

$a.page(function(){
	this.init = function(id, param) {
	    initCombo();
	    initData(param['user_param']);
	    initGrid(param['user_param']);
		setEventListener(param['user_param']);

        $('#dryrun_info').show(); // 모의실행
        $('#result_info').hide(); // 결과보기
	};
});

function setEventListener(param) {

    // 검색조건 영역 초기화
    $('#btn_init').on('click', function(e) {
        $("#dryrun_info .search_wrap .search_area_input .Textinput").val('');
    });

    // 검색조건 영역 초기화
    $('#btn_result_init').on('click', function(e) {
        $("#result_info .search_wrap .search_area_input .Textinput").val('');
    });

    $('#runner_type').on('change', function(e) {
        $('#runner_id').val('');
    });

    $('#runner_id, #btn_sel_runner_id').on('click', function(e) {
        let runner_type = $('#runner_type').val();

        if (runner_type == "U") {
            selectUser();
        } else if (runner_type == "T") {
            selectTask();
        } else {
            opme_message("[실행유형] 을 선택하세요.");
            $('#runner_type').focus();
        }

        return;
    });

    // 조회
    $('#btn_sel').on('click', function() {
        g_page = 1;
        getGridData(param);
    });

    // 조회
    $('#btn_result_sel').on('click', function() {
        g_result_page = 1;
        getDryrunResult();
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

    // Page 버튼을 클릭 했을 때 데이터 바인딩
    $('#result_node_grid').on('pageSet', function(e) {
        let evObj = AlopexGrid.parseEvent(e);
        g_result_page = evObj.page;
        getDryrunResult();
    });

    // 우측 하단 페이지 당 데이터 개수 설정하는 이벤트 바인딩
    $('#result_node_grid').on('perPageChange', function(e) {
        let evObj = AlopexGrid.parseEvent(e);
        g_result_page = 1;
        g_result_per_page = evObj.perPage;
        getDryrunResult();
    });

    // 검색 버튼 'Enter' 처리
    $("#dryrun_info .search_area_input .Textinput").on('keyup', function(e) {
        if(e.keyCode == 13) { // 'Enter' Key
            g_page = 1;
            getGridData(param);
        }
    });

    $("#result_info .search_area_input .Textinput").on('keyup', function(e) {
        if(e.keyCode == 13) { // 'Enter' Key
            g_result_page = 1;
            getDryrunResult();
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
    $("#btn_dry_run").on("click", function(e) {

        // Ajax Call
        let target_list          = AlopexGrid.trimData($('#target_grid').alopexGrid('dataGet'));
        let node_session_id_list = target_list.map( function (o) {
            return o.nodeSessionId;
        });

        let param = {
            'task_id': $('#task_id').text(),
            'rev_no': $('#revision_no').text(),
            'target_list': node_session_id_list,
            'runner_type': $('#runner_type').val(),
            'runner_id': $('#runner_id').val(),
            'run_date': $('#run_date').val() + "T"
                      + $('#run_hour').val() + ":"
                      + $('#run_minute').val() + ":00+09:00",
        };

        $.ajax({
            url: '/execution/dry_run',
            type: "POST",
            dataType: "json",
            data : JSON.stringify(param),
            contentType: "application/json",
            success : function(result) {
                if (result['resultCode'] != 'EM0000') {
                    opme_message("[" + result['resultCode'] + "] " + result['resultMsg']);
                }

                $('#dryrun_info').hide();
                $('#result_info').show();
                $('#btn_dry_run').hide();

                let result_info = $('#result_info td');
                result_info.eq(0).text(g_common_result_dict[result['checkExecutablePermission']]);
                if (result['checkExecutablePermission'] != "success") { // failure
                    result_info.eq(0).addClass("fc-red");
                }

                result_info.eq(1).text(g_common_result_dict[result['checkRunnableTime']]);
                if (result['checkRunnableTime'] != "success") { // failure
                    result_info.eq(1).addClass("fc-red");
                }

                g_result_data = result;
                initResultGrid();
                getDryrunResult();
                g_execute_dry_run = 'Y'; // '모의실행' 수행
                return;
            }
        });
    });

    // Previous Page(모의실행 수행)
    $("#btn_prev").on("click", function(e) {
        $('#dryrun_info').show();
        $('#result_info').hide();
        $('#btn_dry_run').show();
    });

    // Next Page(모의실행 결과보기)
    $("#btn_next").on("click", function(e) {

        if (g_execute_dry_run != "Y") {
            opme_message("[모의실행] 수행 후에 확인 가능합니다.");
            return;
        }

        $('#dryrun_info').hide();
        $('#result_info').show();
        $('#btn_dry_run').hide();
    });

    return;
};

function initCombo() {
    let result = opme_getCode(['execution_runner_type'
                             , 'common_result2']);
    if (result == false) return;

    g_runner_type_arr   = result['execution_runner_type'];
    g_common_result_arr = result['common_result2'];
    g_common_result_arr.forEach(function(item) {
        g_common_result_dict[item['value']] = item['text'];
    });

    return;
};

function initData(param) {

    // 부모창으로부터 데이터가 전달되는 경우.
    if (param != null) {
        $('#task_id').text(param['task_id']);
        $('#revision_no').text(param['rev_no']);
    }

    // Runner Type
    $('#runner_type').setData({
        data           : g_runner_type_arr,
        option_selected: g_runner_type_arr[0]['value'] // 'U' 최초 선택값 설정.
    });

    // Runner ID
    $('#runner_id').val(param['login_id']);

    // Today
    let today  = new Date();
    let year   = today.getFullYear();
    let month  = (today.getMonth()+1 < 10 ? "0" : "") + (today.getMonth()+1);
    let date   = (today.getDate()    < 10 ? "0" : "") + today.getDate();
    let hour   = (today.getHours()   < 10 ? "0" : "") + today.getHours();
    let minute = (today.getMinutes() < 10 ? "0" : "") + today.getMinutes();
    // console.log(year + "/" + month + "/" + date + " " + hour + ":" + minute);

    // Date
    $('#run_date').val(year + "-" + month + "-" + date);

    // Hour
    let hour_option = [];
    for (let i=0; i<=23; i++) {
        if (i < 10) {
            hour_option.push({'value': '0'+i, 'text': '0'+i});
        } else {
            hour_option.push({'value': ''+i, 'text': ''+i});
        }
    }
    $('#run_hour').setData({
        data           : hour_option,
        option_selected: hour // 최초 선택값 설정.
    });

    // Minute
    let minute_option = [];
    for (let i=0; i<=59; i++) {
        if (i < 10) {
            minute_option.push({'value': '0'+i, 'text': '0'+i});
        } else {
            minute_option.push({'value': ''+i, 'text': ''+i});
        }
    }
    $('#run_minute').setData({
        data           : minute_option,
        option_selected: minute // 최초 선택값 설정.
    });

    $('#result_result').setData({
        data           : g_common_result_arr,
        option_selected: g_common_result_arr[0]['value'] // 최초 선택값 설정.
    });

    return;
};

function initGrid(param) {

    // 노드 그리드 초기화
    $('#node_grid').alopexGrid({
        height: 380,
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
//                align   : 'center',
//                key     : 'nodeSessionId',
//                title   : '노드세션 ID',
//                width   : '300px',
//                readonly: true,
//            }, {
                align: 'center',
                key  : 'hostname',
                title: 'Hostname',
                width: '150px',
            }, {
                align: 'center',
                key  : 'remoteAddr',
                title: 'IP주소',
                width: '150px',
            }, {
                align: 'center',
                key  : 'account',
                title: 'OS계정',
                width: '100px',
            },
        ],
    });

    // 대상 그리드 초기화
    $('#target_grid').alopexGrid({
        height: 380,
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
        message: {  // no message 처리
	    	nodata: '실행대상을 추가하지 않는 경우, 전체를 대상으로 실행 됩니다.',
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
                key  : 'hostname',
                title: 'Hostname',
                width: '150px',
            }, {
                align: 'center',
                key  : 'remoteAddr',
                title: 'IP주소',
                width: '150px',
            }, {
                align: 'center',
                key  : 'account',
                title: 'OS계정',
                width: '100px',
            },
        ],
    });

    getGridData(param);

    return;
};


function initResultGrid() {

    // 모의실행결과 노드 그리드 초기화
    $('#result_node_grid').alopexGrid({
        height: 501,
        rowSelectOption: {
		    clickSelect : false,
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
               align: 'center',
               key  : 'hostname',
               title: 'Hostname',
               width: '150px',
            }, {
                align: 'center',
                key  : 'remoteAddr',
                title: 'IP주소',
                width: '150px',
            }, {
                align: 'center',
                key  : 'account',
                title: 'OS계정',
                width: '100px',
            }, {
                align : 'center',
                key   : 'checkRole',
                title : '권한점검',
                width : '100px',
                render: function(value, data, render, mapping, grid) {
                    let result_str = g_common_result_dict[value];
                    if (value == "success") return result_str;
                    return "<span class='fc-red'>" + result_str + "</span>";
                }
            },
        ],
    });

    return;
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
        dataLength: data['totalCnt'], //총 데이터 길이
        current   : g_page, //현재 페이지 번호. 서버에서 받아온 현재 페이지 번호를 사용한다.
        perPage   : g_per_page || 10 //한 페이지에 보일 데이터 갯수
    };

    let startIdx = (g_page - 1) * g_per_page;
    let endIdx   = startIdx + g_per_page;
    $('#node_grid').alopexGrid('dataSet', data['nodeList'].slice(startIdx, endIdx), serverPageInfo);

    return;
};

function getDryrunResult() {

    if (g_result_data == null) return;

    let hostname    = $('#result_hostname').val();
    let remote_addr = $('#result_remote_addr').val();
    let account     = $('#result_account').val();
    let role_result = $('#result_result').val();

    let result = {};
    result['executionNodeList'] = g_result_data['executionNodeList'].filter(function(element, index) {
        if (hostname != null && hostname != '') {
            if (element.hostname.indexOf(hostname) == -1) return false;
        }

        if (remote_addr != null && remote_addr != '') {
            if (element.remoteAddr.indexOf(remote_addr) == -1) return false;
        }

        if (account != null && account != '') {
            if (element.account.indexOf(account) == -1) return false;
        }

        if (role_result != 'all') {
            if (element.checkRole.indexOf(role_result) == -1) return false;
        }

        return true;
    });

    let serverPageInfo = {
        dataLength: result['executionNodeList'].length, //총 데이터 길이
        current   : g_result_page, //현재 페이지 번호. 서버에서 받아온 현재 페이지 번호를 사용한다.
        perPage   : g_result_per_page || 10 //한 페이지에 보일 데이터 갯수
    };

    let startIdx = (g_result_page - 1) * g_result_per_page;
    let endIdx   = startIdx + g_result_per_page;
    $('#result_node_grid').alopexGrid('dataSet', result['executionNodeList'].slice(startIdx, endIdx), serverPageInfo);

    return;
};

function selectUser() {
    let user_param = { user_id: $('#runner_id').val() };

    opme_searchUser('사용자 조회', 'single', user_param, function(user_info) {
        if (user_info.length == 1) {
            $('#runner_id').val(user_info[0]['id']);
            $("#runner_id").trigger("change");
        }
    });
};

function selectTask() {
    let task_param = { task_id: $('#runner_id').val() };

    opme_searchTask('태스크 조회', 'single', task_param, function(task_info) {
        if (task_info.length == 1) {
            $('#runner_id').val(task_info[0]['id']);
            $("#runner_id").trigger("change");
        }
    });
};
