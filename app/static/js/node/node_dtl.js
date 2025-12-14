var g_node_session_id = request_params['node_session_id']; // node_session_id
var g_tag_origin_arr  = [];
var g_tag_origin_dict = [];

$a.page(function(){
	this.init = function(id, param) {
	    initCombo();
		initGrid();
		initData();
		setEventListener();
	};
});

function setEventListener() {

    // 목록
    $("#btn_list_node").on("click", function(e) {
        if (typeof request_params !== 'undefined' && request_params['sc_list_page'] != null){
            opme_postWithParam(request_params['sc_list_page'], request_params);
        } else {
            opme_postWithParam('/node/', request_params);
        }
    });
};

function initCombo() {
    let result = opme_getCode(['node_tag_origin']);
    if (result == false) return;

    g_tag_origin_arr = result['node_tag_origin'];
    g_tag_origin_arr.forEach(function(item) {
        g_tag_origin_dict[item['value']] = item['text'];
    });

    return;
};

// 초기 데이터 요청
function initData() {

    let result = opme_getCode(['node_past_session']);

    if (result == false) return;

    // opme_getCode 가져온 건을 key-value로 꺼내 쓸 수 있도록 처리
    let node_past_session_arr  = result['node_past_session'];
    let node_past_session_dict = {};

    node_past_session_arr.forEach(function(item) {
        node_past_session_dict[item['value']] = item['text'];
    });

    if (response['resultCode'] == 'EM0999') {
        opme_message(response['resultMsg']);
        return;
    }

    let os_name    = '-';
    let os_version = '-';
    let heart_beat = '-';
    let crt_date   = '-';

    if (typeof response['osName'] !== 'undefined')
        os_name    = response['osName'];
    if (typeof response['osVer'] !== 'undefined')
        os_version = response['osVer'];
    if (typeof response['heartbeat'] !== 'undefined')
        heart_beat = opme_formatUTCString(response['heartbeat']);
    if (typeof response['crtDate'] !== 'undefined')
        crt_date   = opme_formatUTCString(response['crtDate']);

    // base_info
    $('#node_session_id').text(response['nodeSessionId']);
    $('#csp_resource_id').text(response['cspResourceId']);
    $('#agent_ver').text(response['agentVer']);

    // host_info
    $('#hostname').text(response['hostname']);
    $('#os_type').text(response['osType']);
    $('#os_name').text(os_name);
    $('#os_version').text(os_version);
    $('#remote_addr').text(response['remoteAddr']);

    // tag_info
    if (response['cspTagList'] != null &&  typeof response !== 'undefined') {
        response['cspTagList'].forEach(function(item) {
            item['origin'] = 'CT'
        });
    }
    $('#tag_grid').alopexGrid('dataSet', response['cspTagList']);
    $('#tag_grid').alopexGrid('dataAdd', response['extTagList']);

    // history_info
    $('#heart_beat').text(heart_beat);
    $('#crt_date').text(crt_date);
    $('#node_past_session').text(node_past_session_dict[response['pastSession']]);

    // history_info 의 Conflict 옆 도움말 표시를 위한 조치
    // absolute position 인 Alopex Tooltip 의 경우, 상위 요소가 relative 인 경우 정상 위치에 rendering 되지 않음.
    // Alopex 에 의해서 자동 생성되는 상위 요소인 Alopex Table 을 강제로 static 으로 변경함.
    $('#history_info > .Table-wrapper').css('position', 'static');
};

function initGrid() {

    // 사용자 그리드 초기화
    $('#tag_grid').alopexGrid({
        height: 'content',
        pager : true,
        paging: {
            enabled   : false,
            pagerTotal: true
        },
        // filter 추가를 위한 설정
        filteringHeader: true,
        filteringHeaderHeight: 30,
        filter: {
		    movable: true,
		    saveFilterSize: true,
		    title: true
	    },
        columnMapping: [
            {
                align: 'center',
                key  : 'origin',
                title: '시스템구분',
                width: '50px',
                render: function(value, data, render, mapping, grid) {
                    return g_tag_origin_dict[value];
                },
                filter: {
				    useRenderToFilter: true,
			    },
            }, {
                align: 'center',
                key  : 'key',
                title: 'KEY',
                width: '100px',
            }, {
                align: 'center',
                key  : 'val',
                title: 'VALUE',
                width: '200px',
            },
        ],
    });

    return;
};
