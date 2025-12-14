var g_filehub_id      = request_params['filehub_id']; // filehub id (before changed)
var is_change         = false;
var g_grid_scroll_cnt = 10;

var g_entity_type_arr = [];

$a.page(function(){
	this.init = function(id, param) {
	    initCombo();
	    initGrid();
	    initData();
		setEventListener(param);
	};
});

function setEventListener(data) {

    // 파일허브ID 유효성 체크
    $('#btn_check_id').on('click', function(e) {
        checkId();
    });

    // 아이디 변경 여부 확인
    $('#id').on('propertychange change keyup paste input', function(e) {
        $(this).attr("data-check-result", "fail");

        if (g_filehub_id == $('#id').val()) {
            $(this).attr("data-check-result", "ok");
            $("#btn_check_id").setEnabled(false);
            is_change = false;
            return;
        }

        $("#btn_check_id").setEnabled(true);
        is_change = true;
    });

    // Owner ID 조회
    $('#btn_sel_owner_id, #owner_id').on('click', function(e) {
        // '수정' 처리 인 경우
        if (g_filehub_id == '') {
            return;
        }
        // 권한에 따른 편집 제한
        if (login_privilege != '9' && login_id != response['ownerUserId']) { // '9': Super User, '5': Normal User
            return;
        }
        selectOwner();
    });

    // 사용자 추가 버튼
    $('#btn_add_user').on('click', function(e) {
        addUser();
    });

    // 사용자그룹 추가 버튼
    $('#btn_add_usergrp').on('click', function(e) {
        addUserGroup();
    });

    // 태스크 추가 버튼
    $('#btn_add_task').on('click', function(e) {
        addTask();
    });

    // Grid Entity(Row) 삭제 버튼
    $('#btn_del_entity').on('click', function(e) {
        $('#permission_grid').alopexGrid('dataDelete', {_state: {selected: true}}, {_state: {deleted: false}});
        $('#permission_grid').alopexGrid('rowSelect' , {_state: {selected: true}}, false);

        // Grid 데이터가 감소하면, height 를 content 사이즈에 맞게 가변 처리.
        let pageInfo = $('#permission_grid').alopexGrid('pageInfo');
        if (pageInfo['dataLength'] <= g_grid_scroll_cnt) {
            $("#permission_grid").alopexGrid('updateOption', {height: 'content'});
        }
    });

    // 수정여부 체크
    $('#base_info td').on("change", function(e) {
        is_change = true;
    });

    $('#permission_info #permission_grid').on("dataDeleteEnd dataAddEnd", function(e) {
        is_change = true;
    });

    // cellBody checkbox 를 변경한다.
    $('#permission_grid').on('cellValueEditing', function(e) {
        let gridObject      = AlopexGrid.parseEvent(e);
        let permission_grid = gridObject.$grid;
        let col_key         = gridObject.mapping.key;
        // let column_index    = gridObject.mapping.columnIndex;
        // let col_data        = permission_grid.alopexGrid("columnDataGet", col_key);
        let row_data        = gridObject.data;
        let checked         = AlopexGrid.currentValue(row_data, 'all');
        is_change = true;

        // 전체선택 checkbox 클릭시 우측 데이터 권한 설정
        if (col_key == 'all') {
            if (checked == 'T') {
                permission_grid.alopexGrid('cellEdit', 'r', { _index: { row: row_data._index.row } }, 'read');
                permission_grid.alopexGrid('cellEdit', 'w', { _index: { row: row_data._index.row } }, 'write');
                permission_grid.alopexGrid('cellEdit', 'x', { _index: { row: row_data._index.row } }, 'execute');
            } else {
                permission_grid.alopexGrid('cellEdit', '-', { _index: { row: row_data._index.row } }, ['read', 'write', 'execute']);
            }
            return;
        }

        // bodyCell 클릭시 헤더셀 체크박스 상태 연동
//        $('#'+col_key).prop({
//            indeterminate: !(col_data.unique().length === 1),
//            checked: col_data.unique()[0] === 'T'
//        })
    });

    // 목록 버튼
    $('#btn_list').on('click', function(e) {
        if (is_change == true) {
            if (!confirm("변경하신 내용을 저장하지 않고, 이동하시겠습니까?")) {
                return;
            }
        }
        opme_postWithParam('/filehub/', request_params);
    });

    // 저장 버튼
    $('#btn_save').on('click', function(e) {

        if (is_change == false) {
            opme_message("변경하신 내용이 없습니다.");
            return;
        }

        if (validate() == false) {
            opme_message("[Invalid] 입력 하신 내용을 확인해 주세요.");
            return;
        }

        if (confirm("정말 실행 하시겠습니까??")) {
            saveData();
        }

        return;
    });
};

function initCombo() {
    let result = opme_getCode(['common_entity_type']);
    if (result == false) return;

    g_entity_type_arr = result['common_entity_type'];
};

// 초기 데이터 요청
function initData() {

    // create
    if (g_filehub_id == '') {
        $('#owner_id').val(login_id);
        $('#owner_id').prop('readonly', true);
        $("#btn_sel_owner_id").hide();
        return;
    }

    // edit
    if (response['resultCode'] == 'EM0999') {
        opme_message(response['resultMsg']);
        return;
    }

    // 권한에 따른 편집 제한
    if (login_privilege != '9' && login_id != response['ownerUserId']) { // '9': Super User, '5': Normal User
        $("#id").prop('readonly', true);
        $("#btn_check_id").hide();
        $("#id").removeClass("with_btn");
        $("#owner_id").prop('readonly', true);
        $("#btn_sel_owner_id").hide();
        $("#permission_info .btn-right").hide();
        $("#permission_grid").alopexGrid("updateOption", { rowSelectOption: {clickSelect: false} });
        $("#permission_grid").alopexGrid("updateColumn", { render: $("#permission_grid").alopexGrid("columnInfo", "all"    )["editable"] }, "all"    );
        $("#permission_grid").alopexGrid("updateColumn", { render: $("#permission_grid").alopexGrid("columnInfo", "read"   )["editable"] }, "read"   );
        $("#permission_grid").alopexGrid("updateColumn", { render: $("#permission_grid").alopexGrid("columnInfo", "write"  )["editable"] }, "write"  );
        $("#permission_grid").alopexGrid("updateColumn", { render: $("#permission_grid").alopexGrid("columnInfo", "execute")["editable"] }, "execute");
        $("#permission_grid").alopexGrid("updateColumn", { editable: false }, ["all", "read", "write", "execute"]);
	    $('#permission_grid').alopexGrid('updateColumn', { selectorColumn : false }, 'check');

        $("#btn_save").hide();
	}

    // base_info
    $('#id').val(response['id']);
    $('#owner_id').val(response['ownerUserId']);
    $('#owner_id').prop('readonly', true);

    // history_info
    let history_info = $('#history_info td');
    let crt_date     = opme_formatUTCString(response['crtDate']);
    let upd_date     = opme_formatUTCString(response['updDate']);
    history_info.eq(0).text(response['crtUserId']);
    history_info.eq(1).text(crt_date);
    history_info.eq(2).text(response['updUserId']);
    history_info.eq(3).text(upd_date);
    $('#history_info').show(); // none

    // permission_info
    $('#permission_grid').alopexGrid('dataSet', response['permissionList']);

    // Grid 데이터가 증가하면, height 를 고정시키고, Scroll 처리.
    let pageInfo = $('#permission_grid').alopexGrid('pageInfo');
    if (pageInfo['dataLength'] > g_grid_scroll_cnt) {
        $("#permission_grid").alopexGrid('updateOption', {height: '500px'});
    }

    return;
};

function initGrid() {

    // 권한 그리드 초기화
    $('#permission_grid').alopexGrid({
        height: 'content',
        rowSelectOption: {
		    clickSelect : true,
		    singleSelect: false
	    },
        leaveDeleted: true,
	    pager: true,
        paging: {
            enabled   : false,
            pagerTotal: true
        },
        defaultState: {
            //그리드 렌더링 시점부터 편집모드로 전환
            dataSet: { editing : true }
        },
        rowInlineEdit: true,
		mergeEditingImmediately: true,
        columnMapping: [
            {
                align          : 'center',
                key            : 'check',
                width          : '50px',
                selectorColumn : true,
                excludeFitWidth: true,
                resizing       : false,
            }, {
                align : 'center',
                key   : 'entityType',
                title : '유형',
                width : '100px',
                render: {
                    type: 'string',
                    rule: function(value, data) {
                        return g_entity_type_arr;
                    }
                }
            }, {
                align: 'center',
                key  : 'entityId',
                title: 'ID',
                width: '100px',
            }, {
                align          : 'center',
                key            : 'all',
                title          : 'All',
                width          : '110px',
                excludeFitWidth: true,
                inlineStyle    : { padding: '5px 0px 0px 0px' },
                editable: {
                    type      : 'checkbox',
                    styleclass: 'grid_checkbox',
                    rule      : [{value:'T', checked:true}, {value:'F', checked:false}]
                },
                refreshBy: function(previousValue, changedValue, changedKey, changedData, changedColumnMapping){
                    //다른 칼럼들 데이터 변경 상태에 따라 해당 칼럼 데이터 리프레쉬
                    if(['read', 'write', 'execute'].indexOf(changedColumnMapping.key) > -1 ){
                        $('#permission_grid').alopexGrid('cellEdit', isAllRowDataTrue(changedData), {_index: {row: changedData._index.row}}, 'all');
                        return true;
                    }
                },
                value: function(value, data){
                    //그리드 설정시 다른 권한 데이터로 해당 칼럼 데이터 설정
                    return isAllRowDataTrue(data)
                },
            }, {
                align          : 'center',
                key            : 'execute',
                title          : '목록보기',
                width          : '110px',
                excludeFitWidth: true,
                inlineStyle    : { padding: '5px 0px 0px 0px' },
                editable       : {
                    type      : 'checkbox',
                    styleclass: 'grid_checkbox',
                    rule      : [{value:'x', checked:true}, {value:'-', checked:false}]
                },
            }, {
                align          : 'center',
                key            : 'read',
                title          : '다운로드',
//              title: function(e) {
//				    return '<div><input type="checkbox" id="read"><span>read</span></div>';
//			    },
                width          : '110px',
                excludeFitWidth: true,
                inlineStyle    : { padding: '5px 0px 0px 0px' },
                editable       : {
                    type      : 'checkbox',
                    styleclass: 'grid_checkbox',
                    rule      : [{value:'r', checked:true}, {value:'-', checked:false}]
                },
            }, {
                align          : 'center',
                key            : 'write',
                title          : '업로드/삭제',
                width          : '110px',
                excludeFitWidth: true,
                inlineStyle    : { padding: '5px 0px 0px 0px' },
                editable       : {
                    type      : 'checkbox',
                    styleclass: 'grid_checkbox',
                    rule      : [{value:'w', checked:true}, {value:'-', checked:false}]
                },
            },
        ],
    });
};

function isAllRowDataTrue(row_data) {

    let count = 0;
	for (let i in row_data) {
		// rows key 값 중 선별하여 확인한다.
		switch (i) {
			case 'read':
			case 'write':
			case 'execute':
			    if (row_data[i] != '-')
			        count++;
			default:
		}
	}

    if (count == 3) return 'T';
	return 'F';
}

function checkId() {

    if ($("#id").val() == '') {
        opme_message('[파일허브 ID] 를 입력하세요.', function() {
            $("#id").focus();
        });

        return;
    }

    let data = {
        id: $("#id").val(),
    };

    return $.ajax({
        url        : '/filehub/dupchk',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        contentType: "application/json",
        success    : function(result){
            let msg = '';
            if (result['resultCode'] == 'EM0000') {
                msg = $("#id").val() + " : 사용 중인 ID 입니다.";
                $("#id").focus();
            } else if (result['resultCode'] == 'EM0999') {
                msg = "사용 가능한 ID 입니다.";
                $("#id").attr("data-check-result", "ok");
                $("#btn_check_id").setEnabled(false);
                validateInput($("#id"));
            } else {
                msg = "[" + result['resultCode'] + "] " + result['resultMsg'];
                $("#id").focus();
            }

            opme_message(msg);
            return;
        }
    });
};

function selectOwner() {
    let user_param = { user_id: $('#owner_id').val() };

    opme_searchUser('소유자 조회', 'single', user_param, function(user_info) {
        if (user_info.length == 1) {
            $('#owner_id').val(user_info[0]['id']);
            $("#owner_id").trigger("change");
        }
    });
};

function addUser() {

    opme_searchUser('사용자 추가', 'multi', null, function(user_info) {
        // 중복제거
        let add_user_list = [];
        for (let i=0; i<user_info.length; i++) {
            let user = $('#permission_grid').alopexGrid('dataGet', function(data) {
                return data.entityType == 'U' && data.entityId == user_info[i]['id'];
            });
            if ($.isEmptyObject(user)) { // Grid 에 없으면 추가
                add_user_list.push({'entityType': 'U', 'entityId': user_info[i]['id'], 'read': '-', 'write': '-', 'execute': '-'});
            } else { // Grid 에 있으면 복원(삭제된 경우, 복원됨)
                $('#permission_grid').alopexGrid('dataUndelete', {'entityId': user[0].id});
            }
        }
        $("#permission_grid").alopexGrid('dataAdd', add_user_list);
        $("#permission_grid").alopexGrid('startEdit');

        // Grid 데이터가 증가하면, height 를 고정시키고, Scroll 처리.
        let pageInfo = $('#permission_grid').alopexGrid('pageInfo');
        if (pageInfo['dataLength'] > g_grid_scroll_cnt) {
            $("#permission_grid").alopexGrid('updateOption', {height: '500px'});
        }
    });
};

function addUserGroup() {
    opme_searchUserGroup('사용자그룹 추가', 'multi', null, function(usergrp_info) {
        // 중복제거
        let add_usergrp_list = [];
        for (let i=0; i<usergrp_info.length; i++) {
            let usergrp = $('#permission_grid').alopexGrid('dataGet', function(data) {
                return data.entityType == 'G' && data.entityId == usergrp_info[i]['id'];
            });
            if ($.isEmptyObject(usergrp)) { // Grid 에 없으면 추가
                add_usergrp_list.push({'entityType': 'G', 'entityId': usergrp_info[i]['id'], 'read': '-', 'write': '-', 'execute': '-'});
            } else { // Grid 에 있으면 복원(삭제된 경우, 복원됨)
                $('#permission_grid').alopexGrid('dataUndelete', {'entityId': usergrp[0].id});
            }
        }
        $("#permission_grid").alopexGrid('dataAdd', add_usergrp_list);
        $("#permission_grid").alopexGrid('startEdit');

        // Grid 데이터가 증가하면, height 를 고정시키고, Scroll 처리.
        let pageInfo = $('#permission_grid').alopexGrid('pageInfo');
        if (pageInfo['dataLength'] > g_grid_scroll_cnt) {
            $("#permission_grid").alopexGrid('updateOption', {height: '500px'});
        }
    });
};

function addTask() {
    opme_searchTask('태스크 추가', 'multi', null, function(task_info) {
        // 중복제거
        let add_task_list = [];
        for (let i=0; i<task_info.length; i++) {
            let task = $('#permission_grid').alopexGrid('dataGet', function(data) {
                return data.entityType == 'T' && data.entityId == task_info[i]['id'];
            });
            if ($.isEmptyObject(task)) { // Grid 에 없으면 추가
                add_task_list.push({'entityType': 'T', 'entityId': task_info[i]['id'], 'read': '-', 'write': '-', 'execute': '-'});
            } else { // Grid 에 있으면 복원(삭제된 경우, 복원됨)
                $('#permission_grid').alopexGrid('dataUndelete', {'entityId': task[0].id});
            }
        }
        $("#permission_grid").alopexGrid('dataAdd', add_task_list);
        $("#permission_grid").alopexGrid('startEdit');

        // Grid 데이터가 증가하면, height 를 고정시키고, Scroll 처리.
        let pageInfo = $('#permission_grid').alopexGrid('pageInfo');
        if (pageInfo['dataLength'] > g_grid_scroll_cnt) {
            $("#permission_grid").alopexGrid('updateOption', {height: '500px'});
        }
    });
};

// 데이터 저장
function saveData() {

    let entity_list = $('#permission_grid').alopexGrid('dataGet', {_state: {deleted: false}}).map(function(o) {
        return { 'entityType': o.entityType, 'entityId': o.entityId, 'mode': o.read + o.write + o.execute };
    });

    let base_info = {
        id      : $("#id").val(),
        owner_id: $("#owner_id").val(),
    };

    let data = {
        id             : g_filehub_id,
        base_info      : base_info,
        permission_list: entity_list,
    };

    return $.ajax({
        url        : '/filehub/save',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        contentType: "application/json",
        success    : function(result) {
            opme_message(result['resultMsg'], function () {
                if (result['resultCode'] == 'EM0000') {
                    document.location.href = '/filehub'
                }
            });
        }
    });
}

// 유효성 검사
function validate() {

    if (!validateInput($("#id")))       return false;
    if (!validateInput($("#owner_id"))) return false;

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
        case "id":
            max_len = 200;
            if (target_val.length == 0) {
                msg = "[파일허브ID] 를 입력하세요.";
            } else if (target_val.length > max_len) {
                msg = "[파일허브ID] 는 " + max_len + "자리 이하로 입력하세요.";
            } else if (opme_validId(target_val) == false) {
                msg = "[파일허브ID] 는 알파벳,숫자,_,- 만 사용 가능합니다.(첫 문자는 알파벳,숫자)";
            } else if (target.attr("data-check-result") == "fail") {
                msg = "[파일허브ID] 의 사용 가능 여부를 확인하세요.";
            }
            break;
        case "owner_id":
            max_len = 20;
            if (target_val.length == 0) {
                msg = "[소유자 ID] 를 입력하세요.";
            } else if (target_val.length > max_len) {
                msg = "[소유자 ID] 는 " + max_len + "자리 이하로 입력하세요.";
            }
            break;
    }

    // Validation Check : ERROR
    if (msg != "") {
        target.siblings(".validation_msg").html(msg);
        target.siblings(".validation_msg").slideDown();

        target.focus();

        // 자기 자신과 권한 등에 의해 Disabled 처리된 Component 는 제외하고,
        // Validation Check 대상인 Select Box 처리
        $('.Select.validation_tgt, .btn-ico').not('#' + target_id).not('.Disabled').prop('disabled', true);

        return false;
    }

    // Validation Check : SUCCESS
    target.siblings(".validation_msg").html();
    target.siblings(".validation_msg").slideUp();

    // 자기 자신과 권한 등에 의해 Disabled 처리된 Component 는 제외하고,
    // Validation Check 대상인 Select Box 처리
    $('.Select.validation_tgt, .btn-ico').not('#' + target_id).not('.Disabled').prop('disabled', false);

    return true;
};
