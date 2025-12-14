var g_role_id         = request_params['role_id']; // role_id (before changed)
var is_change         = false;
var g_grid_scroll_cnt = 10;

var g_tag_origin_arr  = [];
var g_tag_origin_dict = {};

// Grid Search, Filter, Excel
var g_grid_search = 0; // 0: init, 1: searching
var g_search_old;
var g_search_new;
var g_filtered    = false;

$a.page(function(){
	this.init = function(id, param) {
	    initCombo();
		initGrid();
		initData();
		setEventListener();
	};
});

function setEventListener() {

    // 사용자ID 유효성 체크.
    $("#btn_check_id").on("click", function(e) {
        checkId();
        return;
    });

    // Role ID 변경 여부 확인
    $('#role_id').on('propertychange change keyup paste input', function(e) {
        $(this).attr("data-check-result", "fail");

        if (g_role_id == $('#role_id').val()) {
            $(this).attr("data-check-result", "ok");
            $("#btn_check_id").setEnabled(false);
            is_change = false;
            return;
        }

        $("#btn_check_id").setEnabled(true);
        is_change = true;
    });

    // 수정여부 체크
    $('#base_info td').on("change", function(e) {
        is_change = true;
    });

    $('#nodeset_info #nodeset_grid').on(
        "dataAddEnd dataEditEnd dataDeleteEnd cellValueChanged", function(e) {
     // "dataAddEnd dataDeleteEnd dataEditEnd cellValueChanged cellInlineEditEnd", function(e) {
        if (e.type != "cellValueChanged") {
            is_change = true;
            return;
        }

        // cellValueChanged
        let gridObject = AlopexGrid.parseEvent(e);
        if (typeof gridObject.prevValue == "undefined" && gridObject.value == "") {
            return;
        }

        if (typeof gridObject.prevValue == "boolean" && typeof gridObject.value == "boolean") {
            // check box 변경 skip.
            return;
        }

        if (gridObject.prevValue == gridObject.value) {
            return;
        }

        is_change = true;
        return;
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

    // nodeset_grid 의 태그 mouseover 시에 table 로 구조화해서 출력
    $('#nodeset_grid').on('mouseover', '.bodycell', function(e) {
        let dataObj = AlopexGrid.parseEvent(e).data;
        // tag 컬럼이 아닌 경우
        if (dataObj._index.column != 5) {
            return;
        }

    	let rowData = $("#nodeset_grid").alopexGrid( "dataGetByIndex" , { data : dataObj._index.data });
        let value   = rowData.tag;
    	if (value == null || value == '' || Object.keys(value).length == 0) {
    	    return;
    	}

    	let tag_dict    = opme_strToDict(value);
    	let tooltip_id  = "tag_tooltip";
    	let tag_tooltip = '<table class="Table Form-type"><tr><th>시스템구분</th><th>태그 키(Key)</th><th>태그 값(Value)</th></tr>';
    	for (let prop in tag_dict) {
            let idx = prop.indexOf(".");
    	    if (idx == -1) {
    	        opme_message("[태그] 형식 오류 입니다.");
    	        return;
    	    }

    	    let origin = prop.substring(0, idx);
    	    let key    = prop.substring(idx+1);
    	    tag_tooltip += "<tr><td>" + g_tag_origin_dict[origin] + "</td><td>" + key + "</td><td>" + tag_dict[prop] + "</td></tr>";
        }
    	tag_tooltip += "</table>";

    	// this 에 append 하면, 부모 relative 때문에 Cell 영역을 벗어나서 출력할 수 없음.
        $("body").append('<div id="' + tooltip_id + '" class="grid_tooltip">' + tag_tooltip + '</div>');
    	$("#" + tooltip_id).css('top' , e.pageY + 10);
    	$("#" + tooltip_id).css('left', e.pageX + 10);

        let $tag_element = $(this).on("mouseover", function(e) {
    	    $(this).attr('title', ''); // 기존 tooltip 제거
    	}).on("mouseout", function() {
    	    $("#" + tooltip_id).remove();
    	}).on("mousemove", function(e) {
    	    // mouse cursor 를 따라서 tooltip 이 이동함.(10px 간격을 두고 이동)
    	    $("#" + tooltip_id).css('top' , e.pageY + 10);
    	    $("#" + tooltip_id).css('left', e.pageX + 10);
    	});
    });

    $('#member_info #member_grid').on("dataAddEnd dataDeleteEnd", function(e) {
        is_change = true;
    });

    // 사용자 추가 버튼
    $('#btn_add_user').on('click', function(e) {
        //레이어 팝업
        addUser();
    });

    // 사용자그룹 추가 버튼
    $('#btn_add_usergrp').on('click', function(e) {
        //레이어 팝업
        addUserGroup();
    });

    // 멤버 삭제 버튼
    $('#btn_del_member').on('click', function(e) {
        delMember();
    });

    // 노드셋 추가 버튼
    $('#btn_add_nodeset').on('click', function(e) {
        //레이어 팝업
        addNodeSet();
    });

    // 노드셋 삭제 버튼
    $('#btn_del_nodeset').on('click', function(e) {
        delNodeSet();
    });

    // 목록
    $("#btn_list").on("click", function(e) {
        /*
           cellValueChanged 이벤트 발생시켜서 is_change 를 True 로 변경하고, -- endEdit
           다시 Editable 상태로 만든다.                                    -- startEdit
        */
        $('#nodeset_grid').alopexGrid('endEdit');
        $('#nodeset_grid').alopexGrid('startEdit');

        if (is_change == true) {
            if (!confirm("변경하신 내용을 저장하지 않고, 이동하시겠습니까?")) {
                return;
            }
        }
        opme_postWithParam('/role/', request_params);
    });

    // NodeSet Grid 데이터 더블 클릭 시 상세화면
    $('#nodeset_grid').on('dblclick', '.bodycell', function(e) {
        let dataObj = AlopexGrid.parseEvent(e).data;
        let rowData = $("#nodeset_grid").alopexGrid( "dataGetByIndex" , {data: dataObj._index.data});
        let tag     = (rowData['tag'] == null || rowData['tag'] == "") ? rowData['tag'] : opme_strToDict(rowData['tag']);

        // NodeSet Grid 내용 조회시 Hostname 목록 조회가 추가 되면서 edit 가 안되도록 isReadOnly = true로 변경
        //if (login_privilege == 9) isReadOnly = false;

        let node_param = {
            'hostname'       : rowData['hostname'],
            'osType'         : rowData['osType'],
            'osName'         : rowData['osName'],
            'osVersion'      : rowData['osVersion'],
            'tag'            : tag,
            'login_privilege': login_privilege, // Popup 버튼 제어용.
            'isReadOnly'     : true,
            'parent'         : 'role', // 부모창 구분을 팝업창에 전달
        };

        opme_searchNode('노드집합 조건평가', 'single', node_param, function(nodeSetInfo) {
            if (typeof nodeSetInfo === 'undefined' || nodeSetInfo == null || nodeSetInfo == '') {
                return;
            }

            $("#nodeset_grid").alopexGrid('dataEdit', $.extend({}, nodeSetInfo), {_index:{row:rowData['_index']['row']}});
        });
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
    $("#nodeset_grid").on('filterChangeEnd', function(e) {
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

    // 저장
    $("#btn_save").on("click", function(e) {
        /*
           cellValueChanged 이벤트 발생시켜서 is_change 를 True 로 변경하고, -- endEdit
           다시 Editable 상태로 만든다.                                    -- startEdit
        */
        $('#nodeset_grid').alopexGrid('endEdit');
        $('#nodeset_grid').alopexGrid('startEdit');

        if (is_change == false) {
            opme_message("변경하신 내용이 없습니다.");
            return;
        }

        let result = validate();

        if (result != true) {
            let msg = "[Invalid] 입력 하신 내용을 확인해 주세요.";
            if (result != false) msg = result;

            opme_message(msg);
            return;
        }

        if (confirm("정말 실행 하시겠습니까??")) {
            saveData();
        }

        return;
    });

    $('#btn_export').on('click', function(e){
        opme_exportExcel('role_dtl','Node Set Information', 'nodeset_grid', g_filtered);
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

    return;
};

// init Data (권한)
function initData() {

    // super-user 체크
    if (login_privilege == '9') {
        $('#btn_save').show(); // 'show'
        $("#role_id").addClass('with_btn');
    } else { // '5' : Normal User
        $('td input').prop('readonly', true);
        $('#btn_check_id').hide(); // 'hide'
        $("#role_id").removeClass('with_btn'); // '확인' 버튼
        $("#nodeset_grid").alopexGrid("updateColumn", { editable: false }, ["account", "description"]);
        $("#nodeset_info .btn-right").hide();
        $("#member_info  .btn-right").hide();
	}

    // create
    if (g_role_id == '') {
        return;
    }

    // base_info
    $('#role_id').val(response['id']);
    $('#role_nm').val(response['name']);

    // history_info
    let history_info = $('#history_info td');

    let crt_date = opme_formatUTCString(response['crtDate']);
    let upd_date = opme_formatUTCString(response['updDate']);
    history_info.eq(0).text(response['crtUserId']);
    history_info.eq(1).text(crt_date);
    history_info.eq(2).text(response['updUserId']);
    history_info.eq(3).text(upd_date);
    $("#history_info").show(); // 'show'

    // nodeset_info
    // - Dictionary to String : tag
    for (let i = 0; i < response['nodeSetAccountList'].length; i++) {
        if (jQuery.isEmptyObject(response['nodeSetAccountList'][i]['tag'])) {
            response['nodeSetAccountList'][i]['tag'] = "";
            continue;
        }
        response['nodeSetAccountList'][i]['tag'] = opme_dictToStr(response['nodeSetAccountList'][i]['tag']);
    }

    $('#nodeset_grid').alopexGrid('dataSet', response['nodeSetAccountList']);
    $('#nodeset_grid').alopexGrid('startEdit');

    // history_info
    $('#member_grid').alopexGrid('dataSet', response['userList']);

    // Grid 데이터가 증가하면, height 를 고정시키고, Scroll 처리.
    let pageInfo = $('#nodeset_grid').alopexGrid('pageInfo');
    if (pageInfo['dataLength'] > g_grid_scroll_cnt) {
        $("#nodeset_grid").alopexGrid('updateOption', {height: '500px'});
    }

    pageInfo = $('#member_grid').alopexGrid('pageInfo');
    if (pageInfo['dataLength'] > g_grid_scroll_cnt) {
        $("#member_grid").alopexGrid('updateOption', {height: '500px'});
    }

    return;
};

function initGrid() {

    // 노드셋 그리드 초기화
    $('#nodeset_grid').alopexGrid({
        height: 'content',
        leaveDeleted: true,
        rowSelectOption: {
		    clickSelect : true,
		    singleSelect: false
	    },
	    cellInlineEdit: true,
	    cellInlineEditOption: {
		    startEvent             : 'click',
		    focusMoveAtEditEnd     : false,
		    endEditByOtherAreaClick: true
	    },
	    endInlineEditByOuterClick: true,
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
        columnMapping : [
            {
                align          : 'center',
                key            : 'check',
                width          : '50px',
                selectorColumn : true,
                excludeFitWidth: true,
                resizing       : false,
            }, {
                align : 'center',
                key   : 'hostname',
                title : 'HOSTNAME',
                width : '100px',
                headerStyleclass: 'export-header',
                render: function(value, data, render, mapping, grid) {
                    if (value == null || value == '') return '-';
                    return value;
                },
            }, {
                align : 'center',
                key   : 'osType',
                title : 'OS 종류',
                width : '100px',
                headerStyleclass: 'export-header',
                render: function(value, data, render, mapping, grid) {
                    if (value == null || value == '') return '-';
                    return value;
                },
            }, {
                align : 'center',
                key   : 'osName',
                title : 'OS 이름',
                width : '100px',
                headerStyleclass: 'export-header',
                render: function(value, data, render, mapping, grid) {
                    if (value == null || value == '') return '-';
                    return value;
                },
            }, {
                align : 'center',
                key   : 'osVersion',
                title : 'OS 버전',
                width : '100px',
                headerStyleclass: 'export-header',
                render: function(value, data, render, mapping, grid) {
                    if (value == null || value == '') return '-';
                    return value;
                },
            }, {
                align : 'left',
                key   : 'tag',
                title : '태그',
                width : '100px',
                headerStyleclass: 'export-header',
                render: function(value, data, render, mapping, grid) {
                    if (value == null || value == '' || Object.keys(value).length == 0) {
                        data['tag'] = "";
                        return '-';
                    }

                    // origin 에 해당 하는 Code value 치환
                    let result = "";
                    let items = value.split(",");
                    for (let i = 0; i < items.length; i++) {
                        let item          = items[i].trim().replace(/\"/g, "");
                        let [tmp, val]    = item.split("=");
                        let [origin, key] = tmp.split(".");
                        let tag_str = "\"" + g_tag_origin_dict[origin] + "." + key + "\"=\"" + val + "\",";
                        result += tag_str;
                    }
                    result = result.substring(0, result.length-1);

                    // 태그 value 가 Object 일경우 검색이 안되므로 value(str) 을 리턴함
                    return result;
                },
                filter: {
                    width            : "350px",
				    useRenderToFilter: true,
			    },
            }, {
                align          : 'left',
                key            : 'account',
                title          : 'OS 계정(user1,user2,...)',
                width          : '200px',
                headerStyleclass: 'export-header',
                excludeFitWidth: true,
                editable       : true,
            }, {
                align          : 'left',
                key            : 'description',
                title          : '설명',
                width          : '400px',
                headerStyleclass: 'export-header',
                excludeFitWidth: true,
                editable       : true,
            }
        ],
    });

    // 사용자 그리드 초기화
    $('#member_grid').alopexGrid({
        height         : 'content',
        leaveDeleted   : true,
        rowSelectOption: {
		    clickSelect : true,
		    singleSelect: false
	    },
        pager : true,
        paging: {
            enabled   : false,
            pagerTotal: true
        },
        columnMapping: [
            {
                align          : 'center',
                key            : 'check',
                width          : '50px',
                selectorColumn : true,
                excludeFitWidth: true,
                resizing       : false,
            },{
                align: 'center',
                key  : 'id',
                title: 'ID',
                width: '200px',
            }, {
                align: 'center',
                key  : 'name',
                title: '이름',
                width: '200px',
            },
        ],
    });

};

// 중복 ID 확인
function checkId() {

    if ($('#role_id').val() == '') {
        opme_message('[Role ID] 를 입력하세요.', function() {
            $("#role_id").focus();
        });

        return;
    }

    let data = {
        role_id: $('#role_id').val(),
    };

    return $.ajax({
        url        : '/role/dupchk',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        contentType: "application/json",
        success    : function(result) {
            let msg = '';
            if (result['resultCode'] == 'EM0000') {
                msg = $("#role_id").val() + " : 사용 중인 ID 입니다.";
                $("#role_id").focus();
            } else if(result['resultCode'] == 'EM0999') {
                msg = "사용 가능한 ID 입니다.";
                $("#role_id").attr("data-check-result", "ok");
                $("#btn_check_id").setEnabled(false);
                validateInput($("#role_id"));
            } else {
                msg = "[" + result['resultCode'] + "] " + result['resultMsg'];
                $("#role_id").focus();
            }

            opme_message(msg);
            return;
        }
    });
};

function addUser() {

    opme_searchUser('사용자 추가', 'multi', null, function(user_info) {
        // 중복제거
        let add_member_list = [];
        for(let i=0; i<user_info.length; i++) {
            let user = $('#member_grid').alopexGrid('dataGet', {'id': user_info[i]['id']});
            if ($.isEmptyObject(user)) { // Grid 에 없으면 추가
                add_member_list.push(user_info[i]);
            } else { // Grid 에 있으면 복원(삭제된 경우, 복원됨)
                $('#member_grid').alopexGrid('dataUndelete', {'id': user[0].id});
            }
        }

        $("#member_grid").alopexGrid('dataAdd', add_member_list);

        // Grid 데이터가 증가하면, height 를 고정시키고, Scroll 처리.
        let pageInfo = $('#member_grid').alopexGrid('pageInfo');
        if (pageInfo['dataLength'] > g_grid_scroll_cnt) {
            $("#member_grid").alopexGrid('updateOption', {height: '500px'});
        }
    });
};

function addUserGroup() {

    opme_searchUserGroup('사용자그룹 추가', 'single', null, function(user_group_info) {

        let data = {
            "usergrp_id" : user_group_info[0]["id"]
        }

        // 사용자그룹 멤버 조회 및 member_grid 추가
        $.ajax({
            url        : "/usergroup/dtl",
            type       : "POST",
            dataType   : "json",
            data       : JSON.stringify(data),
            contentType: "application/json",
            success    : function(result) {

                if (result['resultCode'] != 'EM0000') {
                    opme_message("[" + result['resultCode'] + "] " + result['resultMsg']);
                    return;
                }

                // 중복제거
                let add_member_list = [];
                for(let i=0; i<result.memberList.length; i++) {
                    let user = $('#member_grid').alopexGrid('dataGet', {'id': result.memberList[i]['id']});
                    if ($.isEmptyObject(user)) { // Grid 에 없으면 추가
                        add_member_list.push(result.memberList[i]);
                    } else { // Grid 에 있으면 복원(삭제된 경우, 복원됨)
                        $('#member_grid').alopexGrid('dataUndelete', {'id': user[0].id});
                    }
                }

                $("#member_grid").alopexGrid('dataAdd', add_member_list);

                // Grid 데이터가 증가하면, height 를 고정시키고, Scroll 처리.
                let pageInfo = $('#member_grid').alopexGrid('pageInfo');
                if (pageInfo['dataLength'] > g_grid_scroll_cnt) {
                    $("#member_grid").alopexGrid('updateOption', {height: '500px'});
                }
            }
        });

        return;
    });
};

function delMember() {
    $('#member_grid').alopexGrid('dataDelete', {_state: {selected: true}}, {_state: {deleted: false}});
    $('#member_grid').alopexGrid('rowSelect' , {_state: {selected: true}}, false);

    // Grid 데이터가 감소하면, height 를 content 사이즈에 맞게 가변 처리.
    let pageInfo = $('#member_grid').alopexGrid('pageInfo');
    if (pageInfo['dataLength'] <= g_grid_scroll_cnt) {
        $("#member_grid").alopexGrid('updateOption', {height: 'content'});
    }
};

function addNodeSet() {

    // 부모창(role, task) 정보를 팝업창으로 전달
    let user_param = { 'parent' : 'role' };
    let addFlag = true;

    opme_searchNode('노드집합정보 추가', 'single', user_param, function(nodeSetInfo) {

        if (typeof nodeSetInfo === 'undefined' || nodeSetInfo == null || nodeSetInfo == '') {
            return;
        }

        for (let i in nodeSetInfo) {
           if (addTargetGrid(nodeSetInfo[i]) == false) {
               addFlag = false;
           }
        }

        if (addFlag) {
            opme_message('노드집합정보를 추가 했습니다.');
        }

        $("#nodeset_grid").alopexGrid('startEdit');

        // Grid 데이터가 증가하면, height 를 고정시키고, Scroll 처리.
        let pageInfo = $('#nodeset_grid').alopexGrid('pageInfo');
        if (pageInfo['dataLength'] > g_grid_scroll_cnt) {
            $("#nodeset_grid").alopexGrid('updateOption', {height: '500px'});
        }
    });
};

function addTargetGrid(nodeSetInfo){

    // 중복제거
    let nodeSet = $('#nodeset_grid').alopexGrid('dataGet',
                                               {'hostname'   : nodeSetInfo['hostname']
                                                , 'osType'   : nodeSetInfo['osType']
                                                , 'osName'   : nodeSetInfo['osName']
                                                , 'osVersion': nodeSetInfo['osVersion']
                                                , 'tag'      : nodeSetInfo['tag']});

    if ($.isEmptyObject(nodeSet) == false) { // Grid 에 있으면 복원(삭제된 경우, 복원됨)
        if (nodeSet[0]['_state']['deleted']) {
            $('#nodeset_grid').alopexGrid('dataUndelete', nodeSet);
            return true;
        }

        opme_message(nodeSetInfo['hostname'] + ' 동일한 노드 집합 정보가 존재합니다.');
        return false;
    }

    // Grid 에 없으면 추가
    $("#nodeset_grid").alopexGrid('dataAdd', nodeSetInfo);
    return true;
};

function delNodeSet() {
    $('#nodeset_grid').alopexGrid('dataDelete', {_state: {selected: true}}, {_state: {deleted: false}});
    $('#nodeset_grid').alopexGrid('rowSelect' , {_state: {selected: true}}, false);

    // Grid 데이터가 감소하면, height 를 content 사이즈에 맞게 가변 처리.
    let pageInfo = $('#nodeset_grid').alopexGrid('pageInfo');
    if (pageInfo['dataLength'] <= g_grid_scroll_cnt) {
        $("#nodeset_grid").alopexGrid('updateOption', {height: 'content'});
    }
};

// 데이터 저장
function saveData() {

    let base_info = {
        role_id: $("#role_id").val(),
        role_nm: $("#role_nm").val(),
    };

    let nodeset_list = AlopexGrid.trimData($('#nodeset_grid').alopexGrid('dataGet', {_state: {deleted: false}}));
    for (let i = 0; i < nodeset_list.length; i++) {
        if (nodeset_list[i]['tag'] == null || nodeset_list[i]['tag'] == "") {
            continue;
        }
        nodeset_list[i]['tag'] = opme_strToDict(nodeset_list[i]['tag']);
    }

    let id_list = $('#member_grid').alopexGrid('dataGet', {_state: {deleted: false}}).map(function(o) {
        return o.id;
    });

    let data = {
        role_id     : g_role_id,
        base_info   : base_info,
        member_list : id_list,
        nodeset_list: nodeset_list,
    };

    return $.ajax({
        url        : '/role/save',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        contentType: "application/json",
        success    : function(result) {
            opme_message(result['resultMsg'], function () {
                if (result['resultCode'] == 'EM0000') {
                    document.location.href = '/role'
                }
            });
        }
    });
};

// 유효성 검사
function validate() {

    if (!validateInput($("#role_id"))) return false;
    if (!validateInput($("#role_nm"))) return false;

    // nodeset - OS 계정 valid
    let nodeset_account = $('#nodeset_grid').alopexGrid('dataGet', function(data) {
        return data._state['deleted'] == false && data.account == '';
    });

    if (nodeset_account.length != 0) {
        return "[노드집합정보] OS 계정을 입력하세요.";
    }

    // nodeset - 설명 valid
    let nodeset_description = $('#nodeset_grid').alopexGrid('dataGet', function(data) {
        return data._state['deleted'] == false && data.description.length > 500;
    });

    if (nodeset_description.length != 0) {
        return "[노드집합정보] 설명 은 500자 이하로 입력하세요.";
    }

    return true;
};

function validateInput(target) {

    // 유효하지 않은 필드는 Skip.
    if (target.css("display") == "none") {
        return true;
    }

    let target_id  = target.attr("id");
    let target_val = target.val();
    let msg        = "";
    let max_len    = 0;

    switch (target_id) {
        case "role_id":
            max_len = 20;
            if (target_val.length == 0) {
                msg = "[Role ID] 를 입력하세요.";
            } else if (target_val.length > max_len) {
                msg = "[Role ID] 는 " + max_len + "자리 이하로 입력하세요.";
            } else if (opme_validId(target_val) == false) {
                msg = "[Role ID] 는 알파벳,숫자,_,- 만 사용 가능합니다.(첫 문자는 알파벳,숫자)";
            } else if (target.attr("data-check-result") == "fail") {
                msg = "[Role ID] 의 사용 가능 여부를 확인하세요.";
            }
            break;
        case "role_nm":
            max_len = 30;
            if (target_val.length == 0) {
                msg = "[이름] 을 입력하세요.";
            } else if (target_val.length > max_len) {
                msg = "[이름] 은 " + max_len + "자리 이하로 입력하세요.";
            }
            break;
    }

    // Validation Check : ERROR
    if (msg != "") {
        target.siblings(".validation_msg").html(msg);
        target.siblings(".validation_msg").slideDown();

        target.focus();

        return false;
    }

    // Validation Check : SUCCESS
    target.siblings(".validation_msg").html();
    target.siblings(".validation_msg").slideUp();

    return true;
};

// Search in Target Grid
function searchGridData (command) {

    if (command != 'endSearch' && $('#search_keyword').val() == '') {
        opme_message("검색조건을 입력하세요");
        return;
    }

    switch (command) {
        case 'startSearch':
            g_grid_search = 1;
            g_search_old   = $('#search_keyword').val();
            $('#nodeset_grid').alopexGrid(command, $('#search_keyword').val());
            break;
        case 'searchNext':
        case 'searchPrevious':
            $('#nodeset_grid').alopexGrid(command);
            break;
        case 'endSearch':
            g_grid_search = 0;
            $('#nodeset_grid').alopexGrid(command);
            break;
        default:
            opme_message('[ERROR] ' + command);
            return;
    }

    let info = $('#nodeset_grid').alopexGrid('searchInfo');

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
};
