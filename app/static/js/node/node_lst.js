var g_page     = 1;
var g_per_page = 10;

var g_tag_arr        = [];
var g_tag_origin_arr = [];
var g_tag_origin_dict = {};

var g_taglist_arr  = []; // add for tag info
var g_taglist_dict = {}; // add for tag info

var g_customer_arr = []; // add for customer name

var g_tag_customer = "WP.customer_nm";
var g_tag_operator = "WP.sys_operator1_nm";
var max_customer_cnt = 3;

var g_data         = {};
var g_sse_uuid     = null;

$a.page(function() {
	this.init = function(id, param) {
        // ERROR
        if (typeof response !== 'undefined' && response['resultCode'] != 'EM0000') {
            opme_message(response['resultMsg']);
        }
        getNodetagData(); // get tag info
        getCustomerData(); // get customer list (tag values)
        initCombo();
        initGrid();
        initCustomerSelect();
		setEventListener();
	};
});

function setEventListener() {

    // 검색조건 영역 초기화
    $('#btn_init').on('click', function(e) {
        $(".search_wrap .search_area_input .Textinput").val('');
        $('#customer_select').multiselect('deselectAll', false);
        $('#customer_select').multiselect('updateButtonText');
        $('#tag_grid').alopexGrid('dataSet', [{'origin': '', 'tag_key': '', 'tag_val': ''}]);
    });

    // Advanced Search
    $(".search_wrap > .btn-center > .btn-adv").on("click", function(e) {
        toggleAdvancedSearch();
    });

    // Advanced Search 태그 검색조건 행추가 버튼
    $('#btn_add_tag').on('click', function(e) {
        $('#tag_grid').alopexGrid('dataAdd', [{'origin': '', 'tag_key': '', 'tag_val': ''}]);
        $('#tag_grid').alopexGrid('startEdit');
        return;
    });

    // Advanced Search 태그 검색조건 행삭제 버튼
    $('#btn_del_tag').on('click', function(e) {
        $('#tag_grid').alopexGrid('dataDelete', {_state: {selected: true}});

        // Advanced Search 태그 검색 row 가 존재하지 않으면, 사용자가 입력할 empty row 를 만든다.
        if ($('#tag_grid').alopexGrid('dataGet').length < 1) {
            // Advanced Search 가 show 상태일 때, dataSet 을 해야 Alopex 가 UI를 정상 위치에 rendering 한다.
            $('#tag_grid').alopexGrid('dataSet', [{'origin': '', 'tag_key': '', 'tag_val': ''}]);
        }

        return;
    });

    // 정규식 도움말 link
    $('#regexp_help').on('click', function(e) {
        //window.open('about:blank').location.href = opme_getHelpURL() + "Regexp.html";
        opme_popupHelp('/regexp/');
        return;
    });

    // 조회
    $('#btn_sel').on('click', function() {
        g_page = 1;
        /*
            btn_sel 클릭 시에 편집 중인 값이 반영 되도록,
            endEdit 로 값을 확정 하고 다시 startEdit 상태로 변경.
        */
        $('#tag_grid').alopexGrid('endEdit');
        $('#tag_grid').alopexGrid('startEdit');

        getGridData();

        return;
    });

    // Page 버튼을 클릭 했을 때 데이터 바인딩
    $('#node_grid').on('pageSet', function(e) {
        let evObj = AlopexGrid.parseEvent(e);
        g_page = evObj.page;
        getGridData();
    });

    // 우측 하단 페이지 당 데이터 개수 설정하는 이벤트 바인딩
    $('#node_grid').on('perPageChange', function(e) {
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

    // Grid 데이터 더블 클릭 시 상세화면. 세션ID로만 처리하도록 볼것.
    $('#node_grid').on('dblclick', '.bodycell', function(e) {
        let dataObj = AlopexGrid.parseEvent(e).data;
        let rowData = $("#node_grid").alopexGrid( "dataGetByIndex" , {data: dataObj._index.data});

        if(rowData && rowData['nodeSessionId']) {
            /* 노드집합표현식 : TAG */
            // ex) ,origin="CT",tag_key="Name",tag_val="ec2.*",origin="CT",tag_key="Creator",tag_val="Terraform"
            let tag_str = "";
            AlopexGrid.trimData(
                $('#tag_grid').alopexGrid('dataGet', {_state: {deleted: false}})).map(function(o) {
                    tag_str += ",origin=" + o.origin + ",tag_key=" + o.tag_key + ",tag_val=" + o.tag_val
                }
            );

            let params = {
                'node_session_id'     : rowData['nodeSessionId'],
                'sc_hostname'         : $("#hostname").val(),
                'sc_hostname_regx'    : $("#hostname_regx").val(),
                'sc_os_type'          : $("#os_type").val(),
                'sc_os_type_regx'     : $("#os_type_regx").val(),
                'sc_os_name_regx'     : $("#os_name_regx").val(),
                'sc_os_version_regx'  : $("#os_version_regx").val(),
                'sc_remote_addr'      : $("#remote_addr").val(),
                'sc_sys_operator1_nm' : $("#sys_operator1_nm").val(),
                'sc_tag'              : tag_str,
                'sc_page'             : g_page,
                'sc_per_page'         : g_per_page,
            };

            opme_postWithParam('/node/dtl', params);
        }
    });

    // 고객사 multi select 초기 세팅
    $('#customer_select').each(function(){
        var $this = $(this);
        $this.multiselect({
            enableClickableOptGroups: true,
            nonSelectedText: '선택해주세요',
            includeSelectAllOption : true,
            selectAllText: '전체 선택/해제',
            selectedButtonClass: 'on-selected',

            // 선택 갯수 제한 로직 추가
            onChange: function(option, checked) {

                var selectedOptions = $this.find('option:selected');

                if (selectedOptions.length > max_customer_cnt) {
                    opme_message('고객사는 최대 ' + max_customer_cnt + '개까지만 선택할 수 있습니다.');

                    if ( selectedOptions.length == max_customer_cnt+1 ) {
                        $this.multiselect('deselect', option.val());
                    } else {
                        $this.multiselect('deselectAll', false);
                        $this.multiselect('updateButtonText');
                    }

                }
            }
        });
    });

    // Tag 찾기 버튼 > 태그 정보 조회 팝업
    $('#btn_tag_search').on('click', function(e){
        opme_searchTag("Tag 정보 조회",'single');
    });

    // 엑셀 다운로드
    $('#btn_export').on('click', function(e){
        // opme_exportExcel('node','Node List', 'node_grid', g_filtered);
                // UUID 만들기
        g_sse_uuid = generateUUID();

        // 진행 표시 (SSE 사용/미사용 그대로)
        if (sse_enable == 'no') {
            $.blockUI({
                message: '<img src="../static/images/progress.gif" width="200" height="200" />',
                css: { border:'none', padding:'15px', backgroundColor:'#000',
                       '-webkit-border-radius':'10px','-moz-border-radius':'10px',
                       opacity:.5, color:'#fff' }
            });
        } else {
            g_event_source = new EventSource('/node/sse/' + g_sse_uuid);
            g_event_source.onmessage = function(e) {
                if (Number(e.data) >= 100 && g_event_source != null) {
                    g_event_source.close();
                    g_event_source = null;
                }
                $('#common-progress').width(e.data + '%').text(e.data + '%');
            };
            g_event_source.onerror = function(e) {
                console.log(e);
                opme_message('[ERROR] Server Sent Event.');
                return;
            };
        }

        setTimeout(function(){
            getExportData();
        }, 1000);
    });
};

// 공통코드 조회
function initCombo() {
    let result = opme_getCode(['node_tag_origin']);
    if (result == false) return;

    g_tag_origin_arr = result['node_tag_origin'];
    g_tag_origin_arr.forEach(function(item) {
        g_tag_origin_dict[item['value']] = item['text'];
    });

    if(g_taglist_arr.length == 0) return;

    g_taglist_dict = g_taglist_arr.map(data => {
        return {
            value: data,
            text: data,
        };
    });
};

function initGrid() {
    // 사용자 그리드 초기화
    $('#node_grid').alopexGrid({
        height: 501,
        rowSelectOption: {
		    clickSelect : true,
		    singleSelect: true
	    },
        pager : true,
        paging: {
            perPage    : 10,
            pagerCount : 5,
            pagerSelect: true,
            pagerTotal : true

        },
        defaultColumnMapping : {
            align      : 'center',
        },
        columnMapping: [
            {
                key            : 'customer_nm',
                title          : '고객사',
                width          : '120px',
                excludeFitWidth: true,
                render: function(value, data) {

                    if( data == null || data['extTagList'] == null ) return "-";

                    var extTagArr = data['extTagList'];

                    for(let i=0; i<extTagArr.length; i++) {
                        if( extTagArr[i]['origin'] == g_tag_customer.split(".")[0] && extTagArr[i]['key'] == g_tag_customer.split(".")[1] ) {
                            value = extTagArr[i]['val'];
                            break;
                        }
                    }

                    if (value == null) return "-";
                    return value;
                },
            }, {
                key            : 'nodeSessionId',
                title          : 'NodeSessionID',
                hidden         : true,
            }, {
                key            : 'hostname',
                title          : 'Hostname',
                width          : '150px',
                excludeFitWidth: true,
            }, {
                key            : 'sys_operator1_nm',
                title          : '운영자',
                width          : '120px',
                excludeFitWidth: true,
                render: function(value, data) {

                    if( data == null || data['extTagList'] == null ) return "-";

                    var extTagArr = data['extTagList'];

                    for(let i=0; i<extTagArr.length; i++) {
                        if( extTagArr[i]['origin'] == g_tag_operator.split(".")[0] && extTagArr[i]['key'] == g_tag_operator.split(".")[1] ) {
                            value = extTagArr[i]['val'];
                            break;
                        }
                    }

                    if (value == null) return "-";
                    return value;
                },
            // Hidden column. for tag-value Excel export
            }, {
                key            : 'osType',
                title          : 'OS 종류',
                width          : '100px',
                excludeFitWidth: true,
            }, {
                key   : 'osName',
                title : 'OS 이름',
                width : '100px',
                render: function(value, data, render, mapping, grid) {
                    if (value == null) return "-";
                    return value;
                },
            }, {
                key   : 'osVer',
                title : 'OS 버전',
                width : '150px',
                render: function(value, data, render, mapping, grid) {
                    if (value == null) return "-";
                    return value;
                },
            }, {
                key            : 'remoteAddr',
                title          : 'IP 주소',
                width          : '150px',
                excludeFitWidth: true,
            }, {
                key            : 'agentVer',
                title          : 'Agent Ver.',
                width          : '270px',
                excludeFitWidth: true,
            }, {
                key            : 'heartbeat',
                title          : 'Heart Beat',
                width          : '250px',
                excludeFitWidth: true,
                defaultValue   : "-",
                render         : function(value, data, render, mapping, grid) {
                    return opme_formatUTCString(value);
                }
            }, {
                key            : 'pastSession',
                title          : 'Conflict<span class="Button btn-ico sx borderless btn-help"></span>',
                width          : '100px',
                excludeFitWidth: true,
                headerTooltip  : function(data, mapping) {
                    return "인스턴스의 재기동 또는 복제 시에\n"
                         + "일시적으로 기존 노드와 Conflict 가 발생할 수 있으나\n"
                         + "정상 통신되는 경우 15초 이내 자동 해소 되며,\n"
                         + "약 10분 동안 통신이 안되는 경우 자동 삭제 됩니다.";
                },
                render         : function(value, data, render, mapping, grid) {
                    let resultStr = "";
                    if (value == 'P') { // "P" : PastSession
                        resultStr = '<div class="grid_icon ico_caution"></div>';
                    }

                    return resultStr;
                }
            }, {
                key            : 'service_nm',
                title          : '서비스명',
                hidden         : true,
                render         : function(value, data) {

                    if( data == null || data['extTagList'] == null ) return "-";

                    var extTagArr = data['extTagList'];

                    for(let i=0; i<extTagArr.length; i++) {
                        if( extTagArr[i]['origin'] == "WP" && extTagArr[i]['key'] == "service_nm" ) {
                            value = extTagArr[i]['val'];
                            break;
                        }
                    }

                    if (value == null) return "-";
                    return value;
                },
            }, {
                key            : 'env',
                title          : '운영여부',
                hidden         : true,
                render         : function(value, data) {

                    if( data == null || data['extTagList'] == null ) return "-";

                    var extTagArr = data['extTagList'];

                    for(let i=0; i<extTagArr.length; i++) {
                        if( extTagArr[i]['origin'] == "WP" && extTagArr[i]['key'] == "env" ) {
                            value = extTagArr[i]['val'];
                            break;
                        }
                    }

                    if (value == null) return "-";
                    return value;
                },
            }, {
                key            : 'Name',
                title          : 'Name',
                hidden         : true,
                render         : function(value, data) {

                    if( data == null || data['cspTagList'] == null ) return "-";

                    var cspTagArr = data['cspTagList'];

                    for(let i=0; i<cspTagArr.length; i++) {
                        if( cspTagArr[i]['key'] == "Name" ) {
                            value = cspTagArr[i]['val'];
                            break;
                        }
                    }

                    if (value == null) return "-";
                    return value;
                },
            }, {
                key            : 'cz-project',
                title          : 'cz-project',
                hidden         : true,
                render         : function(value, data) {

                    if( data == null || data['cspTagList'] == null ) return "-";

                    var cspTagArr = data['cspTagList'];

                    for(let i=0; i<cspTagArr.length; i++) {
                        if( cspTagArr[i]['key'] == "cz-project" ) {
                            value = cspTagArr[i]['val'];
                            break;
                        }
                    }

                    if (value == null) return "-";
                    return value;
                },
            }, {
                key            : 'cz-owner',
                title          : 'cz-owner',
                hidden         : true,
                render         : function(value, data) {

                    if( data == null || data['cspTagList'] == null ) return "-";

                    var cspTagArr = data['cspTagList'];

                    for(let i=0; i<cspTagArr.length; i++) {
                        if( cspTagArr[i]['key'] == "cz-owner" ) {
                            value = cspTagArr[i]['val'];
                            break;
                        }
                    }

                    if (value == null) return "-";
                    return value;
                },
            }, {
                key            : 'cz-org',
                title          : 'cz-org',
                hidden         : true,
                render         : function(value, data) {

                    if( data == null || data['cspTagList'] == null ) return "-";

                    var cspTagArr = data['cspTagList'];

                    for(let i=0; i<cspTagArr.length; i++) {
                        if( cspTagArr[i]['key'] == "cz-org" ) {
                            value = cspTagArr[i]['val'];
                            break;
                        }
                    }

                    if (value == null) return "-";
                    return value;
                },
            }, {
                key            : 'cz-stage',
                title          : 'cz-stage',
                hidden         : true,
                render         : function(value, data) {

                    if( data == null || data['cspTagList'] == null ) return "-";

                    var cspTagArr = data['cspTagList'];

                    for(let i=0; i<cspTagArr.length; i++) {
                        if( cspTagArr[i]['key'] == "cz-stage" ) {
                            value = cspTagArr[i]['val'];
                            break;
                        }
                    }

                    if (value == null) return "-";
                    return value;
                },
            }, {
                key            : 'cz-appl',
                title          : 'cz-appl',
                hidden         : true,
                render         : function(value, data) {

                    if( data == null || data['cspTagList'] == null ) return "-";

                    var cspTagArr = data['cspTagList'];

                    for(let i=0; i<cspTagArr.length; i++) {
                        if( cspTagArr[i]['key'] == "cz-appl" ) {
                            value = cspTagArr[i]['val'];
                            break;
                        }
                    }

                    if (value == null) return "-";
                    return value;
                },
            //////////////////////////////////////////////////////////////////////////
            },
        ],
    });

    // tag_grid 초기화
    $('#tag_grid').alopexGrid({
        height: 'content',
        rowSelectOption: {
		    clickSelect : false,
		    singleSelect: false,
	    },
	    cellInlineEdit:true,
        cellInlineEditOption: {
		    startEvent             : 'click',
		    focusMoveAtEditEnd     : false,
		    endEditByOtherAreaClick: true
	    },
	    endInlineEditByOuterClick: true,
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
                key     : 'origin',
                title   : '시스템구분',
                width   : '100px',
                render: {
                    type:'string',
                    rule: function(value, data) {
                        let editing_data = [{value:'', text:'선택'}];
                        editing_data = editing_data.concat(g_tag_origin_arr);
                        return editing_data;
                    }
                },
                editable: {
                    type:'select',
                    rule: function(value, data) {
                        let editing_data = [{value:'', text:'선택'}];
                        editing_data = editing_data.concat(g_tag_origin_arr);
                        return editing_data;
                    }
                },
                editedValue: function (cell) {
                    return  $(cell).find('select option').filter(':selected').val();
                }
            }, {
                align   : 'center',
                key     : 'tag_key',
                title   : '태그 키(Key)',
                width   : '150px',
                render  : {
                    type: 'string',
                    rule: function(value, data) {
                        let editing_data= [{value:'', text:'선택'}];
                        var currentData = AlopexGrid.currentData(data);
                        let selectedVal = currentData.origin;
                        if (selectedVal != null && selectedVal.trim().length > 0){
                            searchData = g_taglist_dict.filter(object => {
                                if(object.value.indexOf(selectedVal+".") > -1){
                                    return object;
                                }
                            });
                            searchData.forEach(object => {
                                let newval = object.value.substring(3);
                                editing_data.push({ value: object.value, text: newval });
                            });
                            editing_data = editing_data.concat(searchData);
                        }
                        return editing_data;
                    }
                },
                editable: {
                    type:'select',
                    rule: function(value, data){
                        let editing_data = [{value:'', text:'선택'}];
                        var currentData = AlopexGrid.currentData(data);
                        let selectedVal = currentData.origin;

                        if(selectedVal != null && selectedVal.trim().length > 0){
                            searchData = g_taglist_dict.filter(object => {
                                if(object.value.indexOf(selectedVal+".") > -1){
                                    return object;
                                }
                            });

                            let n_editing_data = [];
                            searchData.forEach(object => {
                                let newval = object.value.substring(3);
                                n_editing_data.push({ value: newval, text: newval });
                                //n_editing_data.push({ value: object.value, text: newval });
                            });
                            editing_data = editing_data.concat(n_editing_data);
                        }

                        return editing_data;
                    }
                },
                editedValue: function(cell){
                    return $(cell).find('select option').filter(':selected').val();
                },
                refreshBy: 'origin',
            }, {
                align   : 'center',
                key     : 'tag_val',
                title   : '태그 값(Value)',
                width   : '150px',
                editable: true,
            },
        ],
    });

    // 조회 조건이 존재하는 경우, 해당 조건으로 재조회.
    if (typeof request_params !== 'undefined' && request_params != null) {
        $('#hostname').val(request_params['sc_hostname']);
        $('#os_type').val(request_params['sc_os_type']);
        $('#remote_addr').val(request_params['sc_remote_addr']);
        $('#sys_operator1_nm').val(request_params['sc_sys_operator1_nm']);

        $('#hostname_regx').val(request_params['sc_hostname_regx']);
        $('#os_type_regx').val(request_params['sc_os_type_regx']);
        $('#os_name_regx').val(request_params['sc_os_name_regx']);
        $('#os_version_regx').val(request_params['sc_os_version_regx']);

        // TAG 검색조건 유지 기능
        // ex) ,origin="CT",tag_key="Name",tag_val="ec2.*",origin="CT",tag_key="Creator",tag_val="Terraform"
        const TAG_KEY = [",origin=", ",tag_key=", ",tag_val="];
        let tag_str = request_params['sc_tag'];

        while (true) {
            let origin = ""; // origin
            let key    = ""; // tag_key
            let val    = ""; // tag_val

            let idx = tag_str.indexOf(TAG_KEY[0]); // ,origin=
            if (idx == -1) {
                break;
            }
            tag_str = tag_str.substring(idx);

            idx = tag_str.indexOf(TAG_KEY[1]); // ,tag_key=
            if (idx == -1) {
                break;
            }

            origin  = tag_str.substring(8, idx);
            tag_str = tag_str.substring(idx);

            idx = tag_str.indexOf(TAG_KEY[2]); // ,tag_val=
            if (idx == -1) {
                break;
            }

            key = tag_str.substring(9, idx);
            tag_str = tag_str.substring(idx);

            idx = tag_str.indexOf(TAG_KEY[0]); // ,origin=
            if (idx == -1) { // 다음 Tag 없는 경우
                val = tag_str.substring(9);
                g_tag_arr.push({'origin': origin, 'tag_key': key, 'tag_val': val});
                break;
            }

            val = tag_str.substring(9, idx);
            g_tag_arr.push({'origin': origin, 'tag_key': key, 'tag_val': val});
        }

        // Advanced Search 와 관련한 입력 값이 있으면, Advanced Search 영역을 보여준다.
        let nodeset_str = request_params['sc_hostname_regx'] + request_params['sc_os_type_regx']
                        + request_params['sc_os_name_regx']  + request_params['sc_os_version_regx'];
        if (nodeset_str != "" || g_tag_arr.length > 0) {
            toggleAdvancedSearch();
        }

        g_page     = parseInt(request_params['sc_page']);
        g_per_page = parseInt(request_params['sc_per_page']);
    }
    getGridData();

    return;
};

// 고객사 Select Box 세팅
function initCustomerSelect() {

    const selectBox = document.getElementById("customer_select");

    g_customer_arr.forEach(customerName => {
        const option = document.createElement("option");
        option.value = customerName;
        option.textContent = customerName;
        selectBox.appendChild(option);
    });
};

function getGridData() {

    if (opme_validRegexp($("#hostname_regx").val()  ) == false) return;
    if (opme_validRegexp($("#os_type_regx").val()   ) == false) return;
    if (opme_validRegexp($("#os_name_regx").val()   ) == false) return;
    if (opme_validRegexp($("#os_version_regx").val()) == false) return;

    /* 일반조회조건 */
    let base_condition = {
        hostname  : $("#hostname").val(),
        osType    : $("#os_type").val(),
        remoteAddr: $("#remote_addr").val(),
        agentVer  : "",
    };

    /* 노드집합표현식 : Server */
    let nodeset_svr_condition = {
        'HOSTNAME': $("#hostname_regx").val()  ,
        'OS-TYPE' : $("#os_type_regx").val()   ,
        'OS-NAME' : $("#os_name_regx").val()   ,
        'OS-VER'  : $("#os_version_regx").val(),
    };

    /* 노드집합표현식 : TAG */
    let nodeset_tag_condition = {};
    let warnFlag = false;
    AlopexGrid.trimData(
        $('#tag_grid').alopexGrid('dataGet', {_state: {deleted: false}})).map(function(o) {

            // 모든 값이 없는 Row 는 Skip.
            if (o.origin == "" && o.tag_key == "" && o.tag_val == "") {
                return;
            }

            // 값이 없는 곳도 있는 Row 는 message 출력
            if (o.origin == "" || o.tag_key == "" || o.tag_val == "") {
                warnFlag = true;
                return;
            }

            if (opme_validRegexp(o.tag_val) == false) return;

            let key = o.origin + "." + o.tag_key;
            nodeset_tag_condition[key] = o.tag_val;
            return;
        }
    );

    if (warnFlag == true) {
        opme_message("[태그] 입력이 완료되지 않은 조건은 무시됩니다.");
    }

    // 고객사/운영자 검색. Advanced Search Tag 중 WP.customer_nm(고객사), WP.sys_operator1_nm(운영자) 조회조건 처리
    // Advanced Search 위치에서 Tag 검색 조건 입력 하더라도, 선택된 두개 Tag는 상단 조회조건으로 대체한다.
    let search_customers = $('#customer_select').val();
    let customer_combo_str="";

    // 고객사 선택이 있고, 전체가 아닌 경우 처리
    if(search_customers.length > 0 && (search_customers.length != g_customer_arr.length)) {

         // 선택 조회 정규식
         for(let i = 0 ; i < search_customers.length ; i++) {
            let customerStr = sanitizeRegexString(search_customers[i]);

            if(i==0) {
                customer_combo_str = customerStr;
            } else {
                customer_combo_str += "|" + customerStr;
            }
         }

         nodeset_tag_condition[g_tag_customer] = customer_combo_str;
    }

    let sys_oper_name = $('#sys_operator1_nm').val();
    if(sys_oper_name != "" && sys_oper_name.length > 0) {
        nodeset_tag_condition[g_tag_operator] = sanitizeRegexString(sys_oper_name);
    }

    let data = {
        page   : g_page,
        perPage: g_per_page,

        base_condition       : base_condition,        /* 일반조회조건           */
        nodeset_svr_condition: nodeset_svr_condition, /* 노드집합표현식(Server) */
        nodeset_tag_condition: nodeset_tag_condition, /* 노드집합표현식(TAG)    */
        // 추가 조회할 field. 1차 고정 후 dynamic 하게 처리하도록 개선 (CSP : 표준 필수 5개+Name, WorkPortal : 고객사, 서비스명, 서버운영자, env
        extra_fields         : "CT.Name,CT.cz-project,CT.cz-stage,CT.cz-org,CT.cz-owner,CT.cz-appl,WP.customer_nm,WP.sys_operator1_nm,WP.service_nm,WP.env",
    };

    return $.ajax({
        url        : '/node/list',
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
                dataLength: result['totalCnt'],
                current   : g_page,
                perPage   : g_per_page || 10
            };

            $('#node_grid').alopexGrid('dataSet', result['nodeList'], serverPageInfo);
            g_data = result;
        }
    });
};

function toggleAdvancedSearch() {

    let adv_search = $(".search_wrap > .btn-center > .btn-adv");

    if (adv_search.hasClass("btn-adv_search_close")) { // State : open
        $(".search_wrap > .adv_search_table_wrap").hide();
        $(".search_wrap > .btn-center > .Tooltip").setOption("text", "Advanced Search 열기");
    } else { // State : close
        $(".search_wrap > .adv_search_table_wrap").show();
        $(".search_wrap > .btn-center > .Tooltip").setOption("text", "Advanced Search 닫기");

        $('#tag_grid').alopexGrid('dataSet', g_tag_arr);

        // CSP태그 검색 row 가 존재하지 않으면, 사용자가 입력할 empty row 를 만든다.
        if ($('#tag_grid').alopexGrid('dataGet').length < 1) {
            // Advanced Search 가 show 상태일 때, dataSet 을 해야 Alopex 가 UI를 정상 위치에 rendering 한다.
            $('#tag_grid').alopexGrid('dataSet', [{'origin': '', 'tag_key': '', 'tag_val': ''}]);
        }
    }

    adv_search.toggleClass("btn-adv_search_close");
    adv_search.toggleClass("btn-adv_search_open");

    return;
};

// add for tag - 태그 가져오는 함수
function getNodetagData() {

    $.ajax({
        url        : '/system/nodetag',
        type       : "POST",
        dataType   : "json",
        contentType: "application/json",
        async      : false,
        success    : function(result) {

            // 고객사 정보가 없는 경우 선택 option을 "N/A"로 처리
            if (result['resultCode'] == 'EM0999' || result['resultCode'] == 'EM1002') {
                console.log("No tag values.");
                return;
            }

            g_taglist_arr = result['nodeTagList'];

        return result;
        }
    });
};

// 고객사 리스트 처리. 연동된 노드의 고객사만 처리하기 위해 WP.customer_nm Tag Value 사용
function getCustomerData() {

    $.ajax({
        url        : '/system/nodetags',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify({'nodeTagKey': g_tag_customer}),
        contentType: "application/json",
        async      : false,
        success    : function(result) {

            // 고객사 정보가 없는 경우 선택 option을 "N/A"로 처리
            if (result['resultCode'] == 'EM0999' || result['resultCode'] == 'EM1002') {
                g_customer_arr.push("N/A");
                return;
            }

            for(const values of result['nodeTagValList']) {
                g_customer_arr.push(values);
            }

            return;
        }
    });
};
// 엑셀 내보내기 데이터 가져오기 - 검색 조건 기반
function getExportData() {

    if (opme_validRegexp($("#hostname_regx").val()  ) == false) return;
    if (opme_validRegexp($("#os_type_regx").val()   ) == false) return;
    if (opme_validRegexp($("#os_name_regx").val()   ) == false) return;
    if (opme_validRegexp($("#os_version_regx").val()) == false) return;

    /* Grid 데이터 값 가져오기*/


    /* 일반조회조건 */
    let base_condition = {
        hostname  : $("#hostname").val(),
        osType    : $("#os_type").val(),
        remoteAddr: $("#remote_addr").val(),
        agentVer  : "",
    };

    /* 노드집합표현식 : Server */
    let nodeset_svr_condition = {
        'HOSTNAME': $("#hostname_regx").val()  ,
        'OS-TYPE' : $("#os_type_regx").val()   ,
        'OS-NAME' : $("#os_name_regx").val()   ,
        'OS-VER'  : $("#os_version_regx").val(),
    };

    /* 노드집합표현식 : TAG */
    let nodeset_tag_condition = {};
    let warnFlag = false;
    AlopexGrid.trimData(
        $('#tag_grid').alopexGrid('dataGet', {_state: {deleted: false}})).map(function(o) {

            // 모든 값이 없는 Row 는 Skip.
            if (o.origin == "" && o.tag_key == "" && o.tag_val == "") {
                return;
            }

            // 값이 없는 곳도 있는 Row 는 message 출력
            if (o.origin == "" || o.tag_key == "" || o.tag_val == "") {
                warnFlag = true;
                return;
            }

            if (opme_validRegexp(o.tag_val) == false) return;

            let key = o.origin + "." + o.tag_key;
            nodeset_tag_condition[key] = o.tag_val;
            return;
        }
    );

    if (warnFlag == true) {
        opme_message("[태그] 입력이 완료되지 않은 조건은 무시됩니다.");
    }

    // 고객사/운영자 검색. Advanced Search Tag 중 WP.customer_nm(고객사), WP.sys_operator1_nm(운영자) 조회조건 처리
    // Advanced Search 위치에서 Tag 검색 조건 입력 하더라도, 선택된 두개 Tag는 상단 조회조건으로 대체한다.
    let search_customers = $('#customer_select').val();
    let customer_combo_str="";

    // 고객사 선택이 있고, 전체가 아닌 경우 처리
    if(search_customers.length > 0 && (search_customers.length != g_customer_arr.length)) {

         // 선택 조회 정규식
         for(let i = 0 ; i < search_customers.length ; i++) {

            let customerStr = sanitizeRegexString(search_customers[i]);

            if(i==0) {
                customer_combo_str = customerStr;
            } else {
                customer_combo_str += "|" + customerStr;
            }
         }

         nodeset_tag_condition[g_tag_customer] = customer_combo_str;
    }

    let sys_oper_name = $('#sys_operator1_nm').val();
    if(sys_oper_name != "" && sys_oper_name.length > 0) {
        nodeset_tag_condition[g_tag_operator] = sanitizeRegexString(sys_oper_name);
    }

    let data = {
        total_cnt       : g_data['totalCnt'],
        base_condition       : JSON.stringify(base_condition),        /* 일반조회조건           */
        nodeset_svr_condition: JSON.stringify(nodeset_svr_condition), /* 노드집합표현식(Server) */
        nodeset_tag_condition: JSON.stringify(nodeset_tag_condition), /* 노드집합표현식(TAG)    */
        // 추가 조회할 field. 1차 고정 후 dynamic 하게 처리하도록 개선 (CSP : 표준 필수 5개+Name, WorkPortal : 고객사, 서비스명, 서버운영자, env
        extra_fields         : "CT.Name,CT.cz-project,CT.cz-stage,CT.cz-org,CT.cz-owner,CT.cz-appl,WP.customer_nm,WP.sys_operator1_nm,WP.service_nm,WP.env",
        uuid                 : g_sse_uuid
    };

    // user 가 browser 에서 excel export 할 수 있는 처리
    $.ajax({
        url        : '/node/xl_export',
        type       : "POST",
        data       : data,
        sse_enable : sse_enable,
        xhrFields  : {
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
                    aTag.download = "nodelst_export.xlsx";
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
                url        : '/node/del_tmp_file',
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

// UUID v4 생성함수
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
