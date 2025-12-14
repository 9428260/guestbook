var g_page_key_grid = 1;
var g_per_page_key_grid = 10;
var g_page_value_grid = 1;
var g_per_page_value_grid = 100;
var g_tag_key_arr = [];
var g_tag_value_arr = [];
var g_current_tag_key = "";
var g_selected_tag_key = "";

var g_tag_origin_arr = [];
var g_tag_origin_dict = {};

$a.page(function(){
	this.init = function(id, param) {

	    getNodeTagKey();
	    initGrid();
		setEventListener();
	};
});

function setEventListener() {

    // 닫기
    $("#btn_close").on("click", function(e) {
        $a.close();
    });

    // Page 버튼을 클릭 했을 때 데이터 바인딩
    $('#key_grid').on('pageSet', function(e) {
        let evObj = AlopexGrid.parseEvent(e);
        g_page_key_grid = evObj.page;
        getKeyGridData();
    });

    // 우측 하단 페이지 당 데이터 개수 설정하는 이벤트 바인딩
    $('#key_grid').on('perPageChange', function(e) {
        let evObj = AlopexGrid.parseEvent(e);
        g_page_key_grid = 1;
        g_per_page_key_grid = evObj.perPage;
        getKeyGridData();
    });

    // Page 버튼을 클릭 했을 때 데이터 바인딩
    $('#value_grid').on('pageSet', function(e) {
        let evObj = AlopexGrid.parseEvent(e);
        g_page_value_grid = evObj.page;
        getValueGridData();
    });

    // 우측 하단 페이지 당 데이터 개수 설정하는 이벤트 바인딩
    $('#value_grid').on('perPageChange', function(e) {
        let evObj = AlopexGrid.parseEvent(e);
        g_page_value_grid = 1;
        g_per_page_value_grid = evObj.perPage;
        getValueGridData();
    });

    // Tag Key 선택 -> Tag Value 조회
    $('#key_grid').on('click', '.bodycell', function(e) {

        let dataObj = AlopexGrid.parseEvent(e).data;
        let rowData = $("#key_grid").alopexGrid( "dataGetByIndex" , {data: dataObj._index.data});

        if (!rowData || !rowData['tagorigin'] || !rowData['tagkey'] ) {
            opme_message("알 수 없는 오류 : 태그 정보를 확인할 수 없습니다.");
            return;
        }

        g_selected_tag_key  = rowData['tagorigin'] + "." + rowData['tagkey'];

        $('#key_grid').alopexGrid('rowSelect', { _index: dataObj._index }, true);

        getValueGridData();
    });
};

function initGrid() {

    // Tag Key 선택 그리드 초기화
    $('#key_grid').alopexGrid({
        height: 501,
        rowSelectOption: {
		    clickSelect : true,
		    singleSelect: true,
		    radioColumn : true,
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
                align          : 'center',
                key            : 'check',
                width          : '50px',
                title          : "",
                selectorColumn : true,
                excludeFitWidth: true,
                resizing       : false,
            }, {
                align          : 'center',
                key            : 'tagorigin',
                title          : 'Tag 구분',
                width          : '150px',
                hidden         : true,
            }, {
                align          : 'center',
                key            : 'tagtype',
                title          : '시스템구분',
                width          : '150px',
            }, {
                align          : 'center',
                key            : 'tagkey',
                title          : '태그 키(Key)',
                width          : '150px',
            },
        ],
    });

    // 결과 그리드 초기화
    $('#value_grid').alopexGrid({
        height: 501,
        rowSelectOption: {
		    clickSelect: false,
		    singleSelect: false
	    },
        pager: true,
        paging: {
            perPage: 100,
            pagerCount: 5,
            pagerSelect: true,
            pagerTotal: true
        },
        message: {  // no message 처리
	    	nodata: '조회할 Tag Key 를 선택해주세요.',
	    },
        columnMapping : [
            {
                align : 'center',
                key : 'tagorigin',
                title : 'Tag 구분',
                width : '100px',
                hidden: true,
            }, {
                align : 'center',
                key : 'tagtype',
                title : '시스템구분',
                width : '100px',
            }, {
                align : 'center',
                key : 'tagkey',
                title : '태그 키(Key)',
                width : '150px',
            }, {
                align : 'center',
                key : 'tagvalue',
                title : '태그 값(Value)',
                width : '150px',
            },
        ],
    });

    getKeyGridData();
};

function getNodeTagKey() {

    // Tag Origin set.
    let result = opme_getCode(['node_tag_origin']);
    if (result == false) return;
    g_tag_origin_arr = result['node_tag_origin'];

    g_tag_origin_arr.forEach(function(item) {
        g_tag_origin_dict[item['value']] = item['text'];
    });

    // Tag Key List
    $.ajax({
        url        : '/system/nodetag',
        type       : "POST",
        dataType   : "json",
        contentType: "application/json",
        async      : false,
        success    : function(result) {

            for(const key of result['nodeTagList']) {

                if (key.includes(".")) {
                    const resultArr = key.split(".");
                    g_tag_key_arr.push({
                        'tagorigin' : resultArr[0],
                        'tagtype'   : g_tag_origin_dict[resultArr[0]]==null? resultArr[0] : g_tag_origin_dict[resultArr[0]],
                        'tagkey'    : resultArr[1]
                    });
                } else {
                    console.log(key);
                }
            }

            return result;
        }
    });
};

function getKeyGridData() {

    let data = {};
    data['keyList'] = g_tag_key_arr;
    data['totalCnt'] = g_tag_key_arr.length;

    let tagKeyPageInfo = {
        dataLength : data['totalCnt'],
        current    : g_page_key_grid,
        perPage    : g_per_page_key_grid || 10
    };

    let startIdx = (g_page_key_grid - 1) * g_per_page_key_grid;
    let endIdx   = startIdx + g_per_page_key_grid;

    $('#key_grid').alopexGrid('dataSet', data['keyList'].slice(startIdx, endIdx), tagKeyPageInfo);

    return;
};

function getValueGridData() {

    let data = {};

    if( g_selected_tag_key != null && g_current_tag_key != g_selected_tag_key) {

        $('#value_grid').alopexGrid('dataEmpty'); // Grid 초기화
        g_page_value_grid = 1;
        g_tag_value_arr=[];

        getNodeTagValue(g_selected_tag_key);
    };

    data['valueList'] = g_tag_value_arr;
    data['totalCnt'] = g_tag_value_arr.length;

    let tagValuePageInfo = {
        dataLength : data['totalCnt'],
        current    : g_page_value_grid,
        perPage    : g_per_page_value_grid || 100
    };

    let startIdx = (g_page_value_grid - 1) * g_per_page_value_grid;
    let endIdx   = startIdx + g_per_page_value_grid;

    $('#value_grid').alopexGrid('dataSet', data['valueList'].slice(startIdx, endIdx), tagValuePageInfo);

    return;
};

function getNodeTagValue(nodeTagKey) {

    const keyArr = nodeTagKey.split(".");

    g_current_tag_key = nodeTagKey;

    $.ajax({
        url        : '/system/nodetags',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify({'nodeTagKey': g_current_tag_key}),
        contentType: "application/json",
        async      : false,
        success    : function(result) {

            if (result['resultCode'] == 'EM0999') {
                opme_message("[" + result['resultCode'] + "] " + result['resultMsg']);
                return;
            }

            for(const values of result['nodeTagValList']) {
                g_tag_value_arr.push({
                    'tagorigin' : keyArr[0],
                    'tagtype'   : g_tag_origin_dict[keyArr[0]]==null? keyArr[0] : g_tag_origin_dict[keyArr[0]],
                    'tagkey'    : keyArr[1],
                    'tagvalue'  : values});
            }

            return;
        }
    });
};