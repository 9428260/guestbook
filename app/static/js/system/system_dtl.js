var g_grid_scroll_cnt = 10;

$a.page(function(){
	this.init = function(id, param) {
		initData(); // Get Version Info.
		initGrid(); // Get Conn Info.
		setEventListener();
	};
});

function setEventListener(){

    // 세팅정보 조회는 super-user 만 (by master)
    if (login_privilege == '5') {
        $('#set_info').hide();
    }
}

function initGrid() {
    // 사용자 그리드 초기화
    $('#sysprop_grid').alopexGrid({
        height: 'content',
        rowSelectOption: {
		    clickSelect : true,
		    singleSelect: false
	    },
        pager: true,
        paging: {
            enabled   : false,
            pagerTotal: true
        },
        columnMapping : [
            {
                align: 'center',
                key  : 'name',
                title: '속성명',
                width: '250px',
                // excludeFitWidth : true,
            }, {
                align: 'center',
                key  : 'value',
                title: '속성값',
                width: '300px',
            },
        ],
    });

    $('#sysprops_grid').alopexGrid({
        height: 'content',
        rowSelectOption: {
		    clickSelect : true,
		    singleSelect: false
	    },
        pager: true,
        paging: {
            enabled   : false,
            pagerTotal: true
        },
        columnMapping : [
            {
                align: 'center',
                key  : 'name',
                title: '속성명',
                width: '250px',
                // excludeFitWidth : true,
            }, {
                align: 'center',
                key  : 'value',
                title: '속성값',
                width: '300px',
            },
        ],
    });

    // 조회 조건이 존재하는 경우, 해당 조건으로 재조회.
    getGridConnData();
    getGridSetData();
};

// conn info
function getGridConnData() {

    return $.ajax({
        url        : '/system/listc',
        type       : "POST",
        dataType   : "json",
        contentType: "application/json",
        success    : function(result){

            if (result['resultCode'] == 'EM0999') {
                opme_message("[" + result['resultCode'] + "] " + result['resultMsg']);
                return;
            }
            $('#sysprop_grid').alopexGrid('dataSet', result['metricList']);

            // Grid 데이터가 증가하면, height 를 고정시키고, Scroll 처리.
            let pageInfo = $('#sysprop_grid').alopexGrid('pageInfo');
            if (pageInfo['dataLength'] > g_grid_scroll_cnt) {
                $("#sysprop_grid").alopexGrid('updateOption', {height: '500px'});
            } else {
                $("#sysprop_grid").alopexGrid('updateOption', {height: 'content'});
            }
        }
    });
};

// ver info
function initData() {

    return $.ajax({
        url        : '/system/listv',
        type       : "POST",
        dataType   : "json",
        contentType: "application/json",
        success    : function(result) {

            let opmm_version     = null;
            let opmm_min_version = null;
            let opmm_max_version = null;

            for (let i=0; i<result['versionList'].length; i++) {
                if (result['versionList'][i]['name'] == "MASTER-VERSION") {
                    opmm_version = result['versionList'][i]['value'];
                }
                if (result['versionList'][i]['name'] == "MASTER-MIN-VERSION") {
                    opmm_min_version = result['versionList'][i]['value'];
                }
                if (result['versionList'][i]['name'] == "MASTER-MAX-VERSION") {
                    opmm_max_version = result['versionList'][i]['value'];
                }
            }

            // OPMM Version is NULL
            if (opmm_version == null) {
                $('#sysprop_vname').text("MASTER-VERSION");
                $('#sysprop_vval').text(result['resultMsg']);
                $('#sysprop_vval').css('color', "#eb0530");
                return;
            }

            // OPMM Version 호환 여부 확인 등
            if (result['resultCode'] == "EM0999" || opmm_min_version == null || opmm_max_version == null) {
                $('#sysprop_vname').text("MASTER-VERSION");
                $('#sysprop_vval').text(opmm_version);
                $('#sysprop_vval').css('color', "#eb0530");
                opme_message("[" + result['resultCode'] + "] " + result['resultMsg'] + "<br/>"
                            + "- MASTER-MIN-VERSION : " + opmm_min_version + "<br/>"
                            + "- MASTER-MAX-VERSION : " + opmm_max_version
                );
                return;
            }

            $('#sysprop_vname').text("MASTER-VERSION");
            $('#sysprop_vval').text(opmm_version);
            return;
        }
    });
};

// set info
function getGridSetData() {

    return $.ajax({
        url        : '/system/lists',
        type       : "POST",
        dataType   : "json",
        contentType: "application/json",
        success    : function(result){

            if (result['resultCode'] == 'EM0999') {
                opme_message("[" + result['resultCode'] + "] " + result['resultMsg']);
                return;
            }
            $('#sysprops_grid').alopexGrid('dataSet', result['settingList']);

            // Grid 데이터가 증가하면, height 를 고정시키고, Scroll 처리.
            let pageInfo = $('#sysprops_grid').alopexGrid('pageInfo');
            if (pageInfo['dataLength'] > g_grid_scroll_cnt) {
                $("#sysprops_grid").alopexGrid('updateOption', {height: '500px'});
            } else {
                $("#sysprops_grid").alopexGrid('updateOption', {height: 'content'});
            }
        }
    });
};
