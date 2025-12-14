var g_single_mode = false; // mode initial value (true: single, false: multi)
var g_read_only   = null;
var g_parent;
var g_editor;               // textarea editor (codemirror)

var g_hostname_arr    = null;
var g_tag_origin_arr  = [];
var g_tag_origin_dict = {};

var g_taglist_arr  = []; // add for tag
var g_taglist_dict = {}; // add for tag

// Grid Search, Filter, Excel
var g_grid_search = 0;     // 0: init, 1: searching
var g_search_old;
var g_search_new;
var g_filtered    = false;

$a.page(function() {
	this.init = function(id, param) {
        if (param['mode'] != null && param['mode'] == "single") {
            g_single_mode = true;
        }

        if (param['user_param'] != null) {
            // 부모창(role, task) 정보를 저장
            g_parent    = param['user_param']['parent'];
            // 부모창 grid 내용 조회시 readOnly
            g_read_only = param['user_param']['isReadOnly'];
        }
        getNodetagData();
        initCombo();
	    initData(param);
	    initRadio(); //codemirror 생성 전에 codemirror Text Area 를 hide 하면 숫자 표시 라인이 오류가 발생함 따라서 initData 뒤에 위치
	    initGrid();
		setEventListener();
	};
});

function setEventListener() {

    // add for tag
    getNodetagData();

    //노드집합표현식, Hostname 목록 구분 Radio 버튼 이벤트 추가(구분에 따른 show, hide 변경)
    $("input[name='ruleType']").change(function () {
        if (this.value == 'rule') {
            $('#rule_div').show();
            $('#exact_div').hide();
            $('#rule_comment').show();
            $('#exact_comment').hide();
            $('#disableInclude').hide();
            $('#btn_template_download').hide();
            $('#btn_upload').hide();
            $('.search_area_sel_btn').show();
            $('#sc_info').hide();
        } else if(this.value == 'exact') {
            $('#rule_div').hide();
            $('#exact_div').show();
            $('#rule_comment').hide();
            $('#exact_comment').show();
            $('#disableInclude').show();
            $('#btn_template_download').show();
            $('#btn_upload').show();
            $('.search_area_sel_btn').show();
            $('#sc_info').show();
        }
        $('#node_grid').alopexGrid('dataEmpty');
    });

    // 검색조건 영역 초기화
    $('#btn_init').on('click', function(e) {
        $(".search_wrap .search_area_input .Textinput").val('');
        $('#tag_grid').alopexGrid('dataSet', [{'origin': '', 'tag_key': '', 'tag_val': ''}]);
        $('#tag_grid').alopexGrid('startEdit');
    });

    // 조회
    $('#btn_sel').on('click', function() {
        // endEdit 로 값을 확정 하고 다시 startEdit 상태로 변경.
        $('#tag_grid').alopexGrid('endEdit');
        $('#tag_grid').alopexGrid('startEdit');

        getGridData();
    });

    // 평가 결과 노드 검색 영역 Start
    $('#btn_search').on('click', function() {
        searchGridData('startSearch');
    });

    $('#btn_next').on('click', function() {
        searchGridData('searchNext');
    });

    $('#btn_prev').on('click', function() {
        searchGridData('searchPrevious');
    });

    $('#btn_end').on('click', function() {
        $('#search_keyword').val('');
        searchGridData('endSearch');
    });
    // 평가 결과 노드 검색 End

    // 태그 검색조건 행추가 버튼
    $('#btn_add_tag').on('click', function(e) {
        $('#tag_grid').alopexGrid('dataAdd', [{'origin': '', 'tag_key': '', 'tag_val': ''}]);
        $('#tag_grid').alopexGrid('startEdit');
        return;
    });

    // 태그 검색조건 행삭제 버튼
    $('#btn_del_tag').on('click', function(e) {
        $('#tag_grid').alopexGrid('dataDelete', {_state: {selected: true}});

        // 태그 검색 row 가 존재하지 않으면, 사용자가 입력할 empty row 를 만든다.
        if ($('#tag_grid').alopexGrid('dataGet').length < 1) {
            // Advanced Search 가 show 상태일 때, dataSet 을 해야 Alopex 가 UI를 정상 위치에 rendering 한다.
            $('#tag_grid').alopexGrid('dataSet', [{'origin': '', 'tag_key': '', 'tag_val': ''}]);
            $('#tag_grid').alopexGrid('startEdit');
        }

        return;
    });

    // 추가
    $("#btn_add").on("click", function(e) {
        // ruleType Radio 버튼 (노드집합표현식, Hostname 목록) 구분에 따라 node List 형태 구분
        let ruleType = $("input[name='ruleType']:checked").val();

        if (ruleType == 'exact') {
            //Hostname 목록 검색 결과 Array
            let exact_data_arr = new Array();
            //대소문자 구분 포함 체크 박스 (체크시 대소문자 case 추가)
            let case_include    = $('#case_include').is(':checked');
            //disable 포함 체크 박스(체크시 포함)
            let disable_include = $('#disable_include').is(':checked');
            let hn_map  = new Map(); // 추가한 hostname 객체

            AlopexGrid.trimData($('#node_grid').alopexGrid('dataGet', {_state: {deleted: false}})).map(function(o) {
                let set_host = o.hostname;

                if (disable_include == false && o.status == 'disable') {
                    return;
                }

                if (set_host.indexOf('.') > 0) {
                    set_host = set_host.replace(/\./gi, '\\.');
                }

                let key_hn = set_host;
                if (case_include == true) {
                    key_hn = set_host.toLowerCase();
                }

                if (hn_map.has(key_hn)) {
                    hn_map.get(key_hn).add(set_host);
                } else {
                    hn_map.set(key_hn, new Set([set_host]));
                }

                return;
            });

            let textarea_val = unescape(encodeURIComponent(g_editor.getValue()));

            if (textarea_val == '') {
                opme_message("Hostname 을 입력하세요");
                return;
            }

            if (hn_map.size == 0) {
                opme_message("평가 결과 조회 내용이 없습니다.");
                return;
            }

            let hn_desc_map = new Map();
            let hn_acc_map  = new Map();
            g_hostname_arr.forEach(function(val) {
                let account = '';
                if (g_parent == 'role') {
                    account = '*';
                }

                if (val.indexOf('|') > 0) {
                    host_account = val.split('|');
                    val          = host_account[0];
                    account      = host_account[1];
                }

                let key_hn = val;
                if (case_include) {
                    key_hn = val.toLowerCase();
                }

                if (hn_desc_map.has(key_hn)) {
                    hn_desc_map.get(key_hn).push(val);
                }  else {
                    hn_desc_map.set(key_hn, new Array(val));
                    hn_acc_map.set(key_hn, account);
                }
            });

            hn_map.forEach( function(value, key){
                let rule_str = '';
                value.forEach(function(hn) {
                     rule_str  += hn + "|"
                });

                let host         = new Object();
                host.hostname    = "^(" + rule_str.substring( 0, rule_str.length -1 ) + ")$";
                host.osType      = '';
                host.osName      = '';
                host.osVersion   = '';
                host.description = '[Exact] ' + hn_desc_map.get(key);
                host.account     = hn_acc_map.get(key);
                exact_data_arr.push(host);
            });

            //평가 결과 (노드) 항목이 0 이상 있어야 함
            if (exact_data_arr.length == 0) {
                let add_msg = "";

                if (disable_include == false) {
                    add_msg = "추가 가능한(enable) 대상이 없습니다.";
                } else {
                    add_msg = "조회된 결과가 없습니다.";
                }

                opme_message(add_msg);
                return;
            }

            $a.close(exact_data_arr);
        }

        // 노드집합표현식
        if (ruleType == 'rule') {
            let data_dict = {};
            let tag_dict  = {};
            let is_valid  = false;

            /*
                btn_add 클릭 시에 편집 중인 값이 반영 되도록,
                endEdit 로 값을 확정 하고 다시 startEdit 상태로 변경.
            */
            $('#tag_grid').alopexGrid('endEdit');
            $('#tag_grid').alopexGrid('startEdit');

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

                    let key = o.origin + "." + o.tag_key;  // 실행대상정보는 이게 조회됨
//                    let key = o.tag_key;  // 모의실행은 이게 조회됨
                    tag_dict[key] = o.tag_val;
                    return;
                }
            );

            if ($('#hostname_regx').val()    != '') is_valid = true;
            if ($('#os_type_regx').val()     != '') is_valid = true;
            if ($('#os_name_regx').val()     != '') is_valid = true;
            if ($('#os_version_regx').val()  != '') is_valid = true;
            if (Object.keys(tag_dict).length != 0 ) is_valid = true;

            if (!is_valid) {
                opme_message('적어도 하나 이상의 조건이 입력되어야 합니다.');
                return;
            }

            data_dict['hostname']  = $('#hostname_regx').val();
            data_dict['osType']    = $('#os_type_regx').val();
            data_dict['osName']    = $('#os_name_regx').val();
            data_dict['osVersion'] = $('#os_version_regx').val();
            data_dict['tag']       = opme_dictToStr(tag_dict); // Main 창에서 노드정보 Tag 검색을 위한 dict -> str 로 변경 전달

            if (warnFlag == true) {
                opme_message("[태그] 입력이 완료되지 않은 조건은 무시됩니다.", function() {
                    $a.close(new Array(data_dict));
                });
                return;
            }

            $a.close(new Array(data_dict));
        }

        return;
    });

    // 닫기
    $("#btn_close").on("click", function(e) {
        $a.close();
    });

    // 조회 버튼 'Enter' 처리
    $("#rule_div").on('keyup', function(e) {
        if (e.keyCode == 13) { // 'Enter' Key
            // endEdit 로 값을 확정 하고 다시 startEdit 상태로 변경.
            $('#tag_grid').alopexGrid('endEdit');
            $('#tag_grid').alopexGrid('startEdit');
            getGridData();
        }
    });

    // Grid 검색 버튼 'Enter' 처리
    $(".grid_search_input .Textinput").on('keyup', function(e) {
        if (e.keyCode == 13) { // 'Enter' Key
            if (g_grid_search == 0) {
                searchGridData('startSearch');
            } else {
                g_search_new = $('#search_keyword').val();
                if (g_search_old == g_search_new) {
                    searchGridData('searchNext');
                } else {
                    searchGridData('startSearch');
                }
            }
        }
    });

    // Grid 검색 중, Filter 적용하는 경우. 검색을 다시 시작한다.
    $("#node_grid").on('filterChangeEnd', function(e) {
        if (g_grid_search == 1 && $('#search_keyword').val() != '') {
            searchGridData('endSearch');
            searchGridData('startSearch');
        }
        let evObj = AlopexGrid.parseEvent(e);
        if (evObj.targetColumnFilterOption == null) {
            g_filtered = false;
        } else {
            g_filtered = true;
        }
    });

    $('#btn_export').on('click', function(e){
        opme_exportExcel('popup_node_lst','Node Set Information', 'node_grid', g_filtered);
    });

    $("#btn_template_download").on("click", function(e) {
        excelTemplateDownload();
    });

    $('#btn_upload').after('<input id="import_file_input" class="input-file-import" type="file" value="import" style="display:none" name="file"/>');

    // button 이벤트 바인딩
    $('#btn_upload').on('click', function(e) {
    	$('#import_file_input').click();
    });
    // 파일이 선택됐을때 로직
    $('#import_file_input').change( function(e){
    	var $input = $(this);
    	var $grid = $('#node_grid');
    	var files = e.target.files;
    	var worker = new ExcelWorker();
    	worker.import($grid, files, function(dataList){
            let edit_value = g_editor.getValue();
            if (edit_value != null && edit_value.length > 0) {
                edit_value += '\r\n';
            }
            let xl_value = "";
            for (let i = 0; i < dataList.length; i++) {
                xl_value += dataList[i]['hostname'];
                if (dataList[i]['account'] != null && dataList[i]['account'].length > 0) {
                    xl_value += '|' + dataList[i]['account'];
                }
                if(i != dataList.length -1){
                   xl_value = xl_value + '\r\n';
                }
            }
            g_editor.setValue(edit_value + xl_value);
            getGridData();
    	});
    	$input.val('');
    });

    // Tag 찾기 버튼 > 태그 정보 조회 팝업
    $('#btn_tag_search').on('click', function(e){
        $a.popup({
        url    : '/node/p_node_tag',
        title  : '노드 태그 정보',
        iframe : true,  // default 는 true
        width  : 1200,
        height : 750,
        movable: true,
        data   : { 'mode': 'single' },
        });
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

    g_taglist_dict = g_taglist_arr.map(data => {
        return {
            value: data,
            text: data,
        };
    });
    //return;
};

function initRadio(){
    $("input[name='ruleType'][value='rule']").prop("checked", true);
    $('#exact_div').hide();
    $('#exact_count_div').hide();
    $('#exact_comment').hide();
    $('#disableInclude').hide();
    $('#btn_template_download').hide();
    $('#btn_upload').hide();
    $('#sc_info').hide();

    //부모창(role, task)에 따라 Hostname 입력 설명이 달라짐
    let role_info;
    if (g_parent == 'role') {
         // role_info  = 'Hostname, Hostname|OS계정 두가지 항목이 입력 가능합니다</br>';
         role_info  = '다수의 OS 계정을 \',\' 로 구분하여 입력 가능합니다.</br>';
         role_info += 'Hostname 만 입력시 OS계정은 <b>*</b> 가 default 로 입력됩니다.(모든 계정)</br>';
         role_info += '입력양식은 다음과 같습니다.</br>';
         role_info += '-----------------------------------------------------------------------------------</br>';
         role_info += 'Hostname1</br>';
         role_info += 'Hostname2|webwas,appadmin</br>';
         role_info += '...</br>';
         role_info += 'Hostname3</br>';
         role_info += 'Hostname4|webwas</br>';
         role_info += 'Hostname5</br>';
         role_info += '-----------------------------------------------------------------------------------</br>';
    } else {
         role_info  = '특정 서버들에만 실행계정을 지정해야 하는 경우, \'|\' 로 구분하여 OS 계정을 지정합니다.</br>';
         role_info += '입력양식은 다음과 같습니다.</br>';
         role_info += '-----------------------------------------------------------------------------------</br>';
         role_info += 'Hostname1</br>';
         role_info += 'Hostname2</br>';
         role_info += '...</br>';
         role_info += 'Hostname3|appadmin</br>';
         role_info += 'Hostname4</br>';
         role_info += '-----------------------------------------------------------------------------------</br>';
    }

    $('#sc_info').html(role_info);

    return;
}

// Search in Target Grid
function searchGridData (command) {

    if (command != 'endSearch' && $('#search_keyword').val() == '') {
        opme_message("검색조건을 입력하세요");
        return;
    }

    switch (command) {
        case 'startSearch':
            g_grid_search = 1;
            g_search_old  = $('#search_keyword').val();
            $('#node_grid').alopexGrid(command, $('#search_keyword').val());
            $(".popup-contents").scrollTop($(document).height());
            break;
        case 'searchNext':
        case 'searchPrevious':
            $('#node_grid').alopexGrid(command);
            break;
        case 'endSearch':
            g_grid_search = 0;
            $('#node_grid').alopexGrid(command);
            $(".popup-contents").scrollTop(0);
            break;
        default:
            opme_message('[ERROR] ' + command);
            return;
    }

    let info = $('#node_grid').alopexGrid('searchInfo');

    if (info == null) { // endSearch
        $('#search_info').text('');
        g_grid_search = 0;
        return;
    }

    if (info.matchCount == 0) { // Not Matched
        $('#search_info').text("No data");
        g_grid_search = 0;
        return;
    }

    let msg = (info.highlightPointer + 1) + ' / ' + info.matchCount + " 건";
    $('#search_info').text(msg);

    return;
}

function initTagInputGrid() {

    // tag_grid 초기화
    $('#tag_grid').alopexGrid({
        height: 'content',
        rowSelectOption: {
		    clickSelect : false,
		    singleSelect: false,
	    },
	    cellInlineEdit: true,
        cellInlineEditOption: {
		    startEvent             : 'click',
		    focusMoveAtEditEnd     : false,
		    endEditByOtherAreaClick: true,
	    },
	    endInlineEditByOuterClick: true,
	    // ui combobox 잘 안됨...

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
                width   : '80px',
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

    return;
};

function initGrid() {
    $('#node_grid').alopexGrid({
        // height: 'content',
        height: 530,
        rowSelectOption: {
		    clickSelect : true,
            singleSelect: g_single_mode,
	    },
        pager : true,
        paging: {
            enabled    : false,
            pagerTotal : true
        },
        filteringHeader      : true,
        filteringHeaderHeight: 30,
        // filteringHeader: false,
        filter: {
		    movable: true,
		    saveFilterSize: true,
		    title: true
	    },
        columnMapping: [
            {
                align          : 'center',
                key            : 'customer_nm',
                title          : '고객사',
                width          : '120px',
                excludeFitWidth: true,
                render: function(value, data) {

                    if( data == null || data['cspTagList'] == null ) return "-";

                    var cspTagArr = data['cspTagList'];

                    for(let i=0; i<cspTagArr.length; i++) {
                        if( cspTagArr[i]['key'] == "WP.customer_nm" ) {
                            value = cspTagArr[i]['val'];
                            break;
                        }
                    }

                    if (value == null) return "-";
                    return value;
                },
            }, {
                align   : 'center',
                key     : 'nodeSessionId',
                title   : '노드세션 ID',
                width   : '260px',
                headerStyleclass: 'export-header',
                readonly: true,
                hidden : true,
            }, {
                align: 'center',
                key  : 'hostname',
                title: 'Hostname',
                width: '130px',
                headerStyleclass: 'export-header',
            }, {
                align       : 'center',
                key         : 'osType',
                title       : 'OS 종류',
                width       : '110px',
                headerStyleclass: 'export-header',
                defaultValue: "-",
            }, {
                align       : 'center',
                key         : 'osName',
                title       : 'OS 이름',
                width       : '110px',
                headerStyleclass: 'export-header',
                defaultValue: "-",
            }, {
                align       : 'center',
                key         : 'osVer',
                title       : 'OS 버전',
                headerStyleclass: 'export-header',
                defaultValue: "-",
            }, {
                align       : 'center',
                key         : 'remoteAddr',
                title       : 'IP 주소',
                width       : '120px',
                headerStyleclass: 'export-header',
                defaultValue: "-",
            }, /*{
                align       : 'center',
                key         : 'agentVer',
                title       : 'Agent Ver.',
                width       : '130px',
                headerStyleclass: 'export-header',
                defaultValue: "-",
            }, */{
                align       : 'center',
                key         : 'heartbeat',
                title       : 'Heart Beat',
                width       : '130px',
                headerStyleclass: 'export-header',
                defaultValue: "-",
                render      : function(value, data, render, mapping, grid) {
                    return opme_formatUTCString(value);
                }
            }, {
                align: 'center',
                key  : 'status',
                title: '상태',
                width: '100px',
                headerStyleclass: 'export-header',
                defaultValue: "enable",
            }, {
                align: 'center',
                key  : 'account',
                title: 'OS 계정',
                width: '100px',
                headerStyleclass: 'export-header',
                //hidden : true,
            }
        ],
    });

    if (g_read_only) {
        getGridData();
    }
    return;
};

function getGridData() {

    let ruleType = $("input[name='ruleType']:checked").val();

    if (ruleType == "rule") {
        getRuleGridData();
    }

    if (ruleType == "exact") {
        getExactGridData();
    }

    return;
};

function getRuleGridData() {

    if (opme_validRegexp($("#hostname_regx").val()  ) == false) return;
    if (opme_validRegexp($("#os_type_regx").val()   ) == false) return;
    if (opme_validRegexp($("#os_name_regx").val()   ) == false) return;
    if (opme_validRegexp($("#os_version_regx").val()) == false) return;

    /* 노드집합표현식 : Server */
    let nodeset_svr_condition = {
        'HOSTNAME': $("#hostname_regx").val()  ,
        'OS-TYPE' : $("#os_type_regx").val()   ,
        'OS-NAME' : $("#os_name_regx").val()   ,
        'OS-VER'  : $("#os_version_regx").val(),
    };

    /* 노드집합표현식 : TAG */
    let nodeset_tag_condition = {};
    let warnFlag              = false;

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
//            let key = o.tag_key;  //240701 수정
            nodeset_tag_condition[key] = o.tag_val;
            return;
        }
    );

    if (warnFlag == true) {
        opme_message("[태그] 입력이 완료되지 않은 조건은 무시됩니다.");
    }

    let data = {
        nodeset_svr_condition: nodeset_svr_condition, /* 노드집합표현식(Server)  */
        nodeset_tag_condition: nodeset_tag_condition, /* 노드집합표현식(TAG)     */
        // 추가 조회할 field. 1차 고정 후 dynamic 하게 처리하도록 개선 (CSP : 표준 필수 5개+Name, WorkPortal : 고객사, 서비스명, 서버운영자, env
        extra_fields         : "CT.Name,CT.cz-project,CT.cz-stage,CT.cz-org,CT.cz-owner,CT.cz-appl,WP.customer_nm,WP.sys_operator1_nm,WP.service_nm,WP.env",
    };

    return $.ajax({
        url        : '/node/list_all',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        contentType: "application/json",
        success    : function(result) {

            if (result['resultCode'] != 'EM0000') {
                $('#node_grid').alopexGrid('dataSet', result['nodeList']);
                opme_message("[" + result['resultCode'] + "] " + result['resultMsg']);
                return;
            }

            let serverPageInfo = {
                dataLength: result['totalCnt'], //총 데이터 길이
            };

            $('#node_grid').alopexGrid('dataSet', result['nodeList'], serverPageInfo);
        }
    });
};

function getExactGridData() {
    let textarea_val = unescape(encodeURIComponent(g_editor.getValue()));

    if (textarea_val == '') {
        opme_message("Hostname 을 입력하세요");
        return;
    }
    g_hostname_arr   = new Array();
    let hostname_arr = textarea_val.split('\r\n');
    let host_dict    = {};

    for (let i = 0; i < hostname_arr.length; i++) {
        if ($.trim(hostname_arr[i]) == '') {
            continue;
        }
        // Hostname 입력값 유효성 검증
        if (!validateHostname(hostname_arr[i], i, host_dict)) {
            return;
        }

        g_hostname_arr.push(hostname_arr[i]);
    }

    let data = {
        case_include : $('#case_include').is(':checked'),
        hostname_list: g_hostname_arr,
        type : 'exact',
        // 부모창 (role, task) 정보를 전달
        parent       : g_parent,
    };

    return $.ajax({
        url        : '/nodereview/exact_list',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        contentType: "application/json",
        success    : function(result) {

            if (result['resultCode'] != 'EM0000') {
                $('#node_grid').alopexGrid('dataSet', result['nodeList']);
                opme_message("[" + result['resultCode'] + "] " + result['resultMsg']);
                $('#node_grid').alopexGrid('dataEmpty');
                return;
            }

            let serverPageInfo = {
                dataLength: result['totalCnt'], //총 데이터 길이
            };

            $('#node_grid').alopexGrid('dataSet', result['nodeList'], serverPageInfo);
        }
    });
};

// Hostname 유효성 검증
function validateHostname(str, idx, host_dict) {
    let hostname    = '';
    let account_str = '';
    let account_arr;

    if (g_parent == 'role'){
        account_str = '*';
    }

    // 공백 정규식
    const reg_white_space = /\s/gi;
    // Hostname 입력시 라인과 입력값
    let msg = "[line." + (idx + 1) + "]&nbsp;&nbsp;'" + decodeURIComponent(escape(str)) + "'";

    str = str.trim();

    // 공백 체크
    if (reg_white_space.test(str)) {
        opme_message("입력 값에 공백이 존재합니다.<br/>" + msg);
        return false;
    }

    let input_arr = str.split('|');

    if (input_arr.length > 2) {
        opme_message("입력 값에 '|' 구분자가 하나 이상입니다.<br/>" + msg);
        return false;
    }

    hostname = input_arr[0];

    // account 입력된 경우.
    if (input_arr.length == 2) {
        account_str = input_arr[1];
    }

    // 동일 Hostname 에 서로 다른 Account 를 입력한 경우.
    // host_dict = {'hostname lower': {'hostname': hostname, 'account': account, 'line': line}};
    let hostname_key = hostname.toLowerCase();
    if (hostname_key in host_dict && host_dict[hostname_key]['account'] != account_str) {
        let msg1 = "[line." + host_dict[hostname_key]['line'] + "] "
                   + host_dict[hostname_key]['hostname'] + '|'
                   + host_dict[hostname_key]['account'] + "<br/>";
        let msg2 = "[line." + (idx+1) + "] "
                   + hostname + '|'
                   + account_str;
        opme_message('OS 계정이 일치하지 않습니다.<br/>' + msg1 + msg2);
        return false;
    }
    if($('#case_include').is(':checked')) { // 대소문자 포함인 경우, Account 체크
        host_dict[hostname_key] = {'hostname': hostname, 'account': account_str, 'line': idx+1};
    }

    // 태스크 실행대상 노드집합 추가에 Account 입력된 경우.
    if (g_parent == 'task') {
        if (account_str.indexOf(',') != -1) {
            opme_message ("OS 계정 은 ',' 를 입력할 수 없습니다.<br/>" + msg);
            return false;
        }

        if (account_str.indexOf('*') != -1) {
            opme_message ("OS 계정 은 '*' 를 입력할 수 없습니다.<br/>" + msg);
            return false;
        }
    }

    account_arr = account_str.split(',');

    let max_len = 63;
    if (hostname.length > max_len) {
        opme_message ("Hostname 은 " + max_len + " 자리 이하만 입력 가능합니다.<br/>" + msg);
        return false;
    }

    if (opme_validHostname(hostname) == false) {
        opme_message ("Hostname 명명 규칙에 맞지 않는 이름입니다.<br/>" + msg);
        return false;
    }

    if (opme_hasKorean(hostname)) {
        opme_message("Hostname 은 영문, 숫자만 입력 가능합니다.<br/>" + msg);
        return false;
    }

    for (let i=0; i<account_arr.length; i++) {
        if (account_arr[i] == "*" || account_arr[i] == "") {
            continue;
        }

        if (opme_validId(account_arr[i]) == false) {
           opme_message ("OS계정 은 첫 문자 알파벳,숫자 그 이후는 알파벳,숫자,-,_,* 만 가능합니다.<br/>" + msg);
           return false;
        }
    }

    return true;
};

function initData(param) {

    initTagInputGrid();

    // CodeMirror 에서 제공하는 Syntax 모드를 사용하기 위한 BaseURL(Jinja2) + 상세 URL

    CodeMirror.modeURL += '%N/%N.js'

    let textarea = $('#script_content');

    g_editor = CodeMirror.fromTextArea(textarea[0], {
        lineNumbers  : true,
        lineWrapping : true,
        lineSeparator: '\r\n',
        theme        : 'solarized light', // 테마 변경 시에는 html 에서 테마에 해당하는 css 를 추가.
        readOnly     : false,
        val          : textarea.val(),
        // autoRefresh  : true
    });

    //부모창 (role, task)에 따라 설정 스크립트 입력정보가 달라져서 height를 다르게 적용
    if (g_parent == 'role') {
        g_editor.setSize(500, 215); // width, height
    } else {
        g_editor.setSize(500, 180); // width, height
    }

    g_editor.setOption("mode", "text/x-sh");
    CodeMirror.autoLoadMode(g_editor, "shell");


    // 부모창으로부터 데이터가 전달되는 경우.
    if (param['user_param'] != null) {
        $('#hostname_regx').val(param['user_param']['hostname']);
        $('#os_type_regx').val(param['user_param']['osType']);
        $('#os_name_regx').val(param['user_param']['osName']);
        $('#os_version_regx').val(param['user_param']['osVersion']);

        let tag_list = [];
        for (let prop in param['user_param']['tag']) {
            let idx = prop.indexOf(".");
    	    if (idx == -1) {
    	        opme_message("[태그] 형식 오류 입니다.");
    	        continue;
    	    }

    	    let origin = prop.substring(0, idx);
    	    let key    = prop.substring(idx+1);
            tag_list.push({'origin': origin, 'tag_key': key, 'tag_val': param['user_param']['tag'][prop]});
        }
        $('#tag_grid').alopexGrid('dataSet', tag_list);

        if (g_read_only) {
            $("#btn_add").hide();
            $(".radio-right").hide();
        }
    }

    // 태그 검색 row 가 존재하지 않으면, 사용자가 입력할 empty row 를 만든다.
    if ($('#tag_grid').alopexGrid('dataGet').length < 1) {
        // Advanced Search 가 show 상태일 때, dataSet 을 해야 Alopex 가 UI를 정상 위치에 rendering 한다.
        $('#tag_grid').alopexGrid('dataSet', [{'origin': '', 'tag_key': '', 'tag_val': ''}]);
    }
    $('#tag_grid').alopexGrid('startEdit');

    return;
};

function excelTemplateDownload() {
    let data = [
	    {
		    "hostname": "test-host0",
		    "account" : "admin"
	    },{
		    "hostname": "test-host1",
		    "account" : "admin"
	    },{
		    "hostname": "test-host2",
		    "account" : "admin"
	    }
    ];

	$('body').append('<div id="excelGridTemporation" style="visibility: hidden"></div>');

	// 엑셀 내보내기 임시 그리드 옵션
	var exportGridOption = {
		columnMapping : [
			{
				key : 'hostname',
				title : 'hostname',
				width : '100px',
                headerStyleclass: 'export-header',
			},{
				key : 'account',
				title : 'account',
				width : '100px',
                headerStyleclass: 'export-header',
			}
		],
		data: data
	}
	$('#excelGridTemporation').alopexGrid(exportGridOption);

    let excelFileName = "";
    let sheetName     = "";

    if (g_parent == "role") {
        excelFileName = "role_dtl_template";
        sheetName     = "role";
    } else {
        excelFileName = "task_dtl_template";
        sheetName     = "task";
    }

	let worker = new ExcelWorker({
		excelFileName : excelFileName,
    	defaultPalette : {
			fontsize: 11,
			font: '맑은 고딕',
		},
		//useCSSParser < defaultPalette < palette 순으로 우선순위가 높음
		palette : [{
			className : 'export-header',
			backgroundColor: '217,217,217',
			color : '0,0,0',
			font: '맑은 고딕',
			fontbold: true
		}],
		sheetList: [{
			sheetName: sheetName,
			$grid: [$('#excelGridTemporation')]
		}]
	});
	worker.export({
		merge: true,
		border: true,
		useGridColumnWidth: true,
		useCSSParser: true,
	});

	// 메모리 해제를 위하여 AlopexGrid 객체를 우선 제거한다.
	$("#excelGridTemporation").removeAlopexGrid();
	$('#excelGridTemporation').remove();
}

// add for tag - 태그 가져오는 함수
function getNodetagData() {

    $.ajax({
        url        : '/system/nodetag',
        type       : "POST",
        dataType   : "json",
        contentType: "application/json",
        async      : false,
        success    : function(result) {

            g_taglist_arr = result['nodeTagList'];

        return result;
        }
    });
};
