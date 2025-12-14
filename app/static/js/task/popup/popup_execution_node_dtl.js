var g_result_arr      = [];
var g_runner_type_arr = [];
var g_node_status_arr = [];
var g_force_stop_arr  = [];

var g_result_dict      = {};
var g_node_status_dict = {};
var g_runner_type_dict = {};
var g_force_stop_dict  = {};
var g_param            = {};   // refresh

$a.page(function(){
	this.init = function(id, param) {

        initCombo();
	    initData(param);
		setEventListener();
	};
});

function setEventListener() {

    // 새로고침 이벤트
    $('#btn_refresh').on('click', function(e) {
        getExecutionInfoDtl(g_param);
    });

    // 닫기
    $("#btn_close").on("click", function(e) {
        $a.close();
    });

};

// 코드값 set
function initCombo() {
    let result = opme_getCode(['execution_result',
                               'execution_runner_type',
                               'execution_node_status',
                               'execution_force_stop',]);
    if (result == false) return;

    g_result_arr = result['execution_result'];
    g_result_arr.forEach(function(item) {
        g_result_dict[item['value']] = item['text'];
    });

    g_node_status_arr = result['execution_node_status'];
    g_node_status_arr.forEach(function(item) {
        g_node_status_dict[item['value']] = item['text'];
    });

    g_runner_type_arr = result['execution_runner_type'];
    g_runner_type_arr.forEach(function(item) {
        g_runner_type_dict[item['value']] = item['text'];
    });

    g_force_stop_arr = result['execution_force_stop'];
    g_force_stop_arr.forEach(function(item) {
        g_force_stop_dict[item['value']] = item['text'];
    });
};

function initData(param) {

    // refresh 시 사용
    g_param = param['user_param'];

    // ajax 호출
    getExecutionInfoDtl(param['user_param']);

    return;
};

function getExecutionInfoDtl(param) {

    let data = {
        executionNo  : param['executionNo'],
        nodeSessionId: param['nodeSessionId'],
    };

    return $.ajax({
        url        : "/execution/nodeinfo",
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
            let execution_info = $('#base_info td');

            // date convert
            let end_date = '-';
            if (result['endDate'] != null) {
                end_date = opme_formatUTCString(result['endDate']);
            }
            let start_date = '-';
            if (result['startDate'] != null) {
                start_date = opme_formatUTCString(result['startDate']);
            }

            // status|stopCause
            let status = g_node_status_dict[result['status']];
            let stopCause = '';
            if (typeof result['stopCause'] !== 'undefined') {
                stopCause = " (" + result['stopCause'] + ")";
            }

            execution_info.eq(0).text(result['nodeSessionId']);
            execution_info.eq(1).text(status + stopCause);
            execution_info.eq(2).text(result['hostname']);
            execution_info.eq(3).text(g_result_dict[result['result']]);
            execution_info.eq(4).text(result['remoteAddr']);
            execution_info.eq(5).text(start_date);
            execution_info.eq(6).text(result['account']);
            execution_info.eq(7).text(end_date);
            $('#stdout').val(decodeURIComponent(escape(atob(result['base64Stdout']))));
            $('#stderr').val(decodeURIComponent(escape(atob(result['base64Stderr']))));
        }
    });
};