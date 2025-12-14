var g_usergrp_id = request_params['usergrp_id']; // usergroup id (before changed)
var is_change    = false;

$a.page(function(){
	this.init = function(id, param) {
	    initData();
	    initGrid();
		setEventListener();
	};
});

function setEventListener() {

    // 사용자그룹 ID 유효성 체크
    $('#btn_check_id').on('click', function(e) {
        checkId();
    });

    // 사용자그룹 ID 변경 여부 확인
    $('#usergrp_id').on('propertychange change keyup paste input', function(e) {
        $(this).attr("data-check-result", "fail");

        if (g_usergrp_id == $('#usergrp_id').val()) {
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
        // '수정' 처리 구분
        if (g_usergrp_id == '') {
            return;
        }

        // 권한에 따른 편집 제한
        if (login_privilege != '9' && login_id != response['ownerUserId']) { // '5' : Normal User
            return;
        }

        selectOwner();
    });

    // 멤버 추가 버튼
    $('#btn_add_member').on('click', function(e) {
        addMember();
    });

    // 멤버 삭제 버튼
    $('#btn_del_member').on('click', function(e) {
        $('#member_grid').alopexGrid('dataDelete', {_state: {selected: true}}, {_state: {deleted: false}});
        $('#member_grid').alopexGrid('rowSelect' , {_state: {selected: true}}, false);
    });

    // 수정여부 체크
    $('#base_info td').on("change", function(e) {
        is_change = true;
    });
    $('#member_info #member_grid').on("dataDeleteEnd", function(e) {
        is_change = true;
    });
    $('#member_info #member_grid').on("dataAddEnd", function(e) {
        is_change = true;
    });

    // 목록 버튼
    $('#btn_list').on('click', function(e) {
        if (is_change == true) {
            if (!confirm("변경하신 내용을 저장하지 않고, 이동하시겠습니까?")) {
                return;
            }
        }
        opme_postWithParam('/usergroup/', request_params);
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

// 초기 데이터 요청
function initData() {

    // create
    if (g_usergrp_id == '') {
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

    // super-user 체크
    if (login_privilege != '9' && login_id != response['ownerUserId']) { // '5' : Normal User
        // $("#user_privilege").setEnabled(false);
        // $("#user_status").setEnabled(false);

        $(".Textinput").prop('readonly', true);
        $("#btn_sel_owner_id").hide();
        $("#btn_check_id").hide();
        $("#usergrp_id").removeClass("with_btn");
        $("#member_info .btn-right").hide();
        $("#btn_save").hide();
	} else {
        $('#owner_id').prop('readonly', true);
	}

    // base_info
    $('#usergrp_id').val(response['id']);
    $('#owner_id').val(response['ownerUserId']);
    $('#description').val(response['description']);

    // history_info
    let history_info = $('#history_info td');
    let crt_date     = opme_formatUTCString(response['crtDate']);
    let upd_date     = opme_formatUTCString(response['updDate']);
    history_info.eq(0).text(response['crtUserId']);
    history_info.eq(1).text(crt_date);
    history_info.eq(2).text(response['updUserId']);
    history_info.eq(3).text(upd_date);
    $('#history_info').show(); // none

    // member_info
    $('#member_grid').alopexGrid('dataSet', response['memberList']);
}

function initGrid() {
    // 사용자그룹 그리드 초기화
    $('#member_grid').alopexGrid({
        height: 451,
        leaveDeleted: true,
        rowSelectOption: {
		    clickSelect : true,
		    singleSelect: false
	    },
	    filteringHeader: true,
    	filter: {
	    	title          : true,
    		movable        : true,
	    	saveFilterSize : true,
		    sorting        : true,
    		filterByEnter  : true,
	    	typeListDefault: {
			    selectValue      : 'contain',
			    expandSelectValue: 'contain'
    		},
			filterByEnter  : false,
			focus          : 'searchInput'
		},  // filter 적용 끝
	    pager: true,
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
            }, {
                align: 'center',
                key  : 'id',
                title: '사용자 ID',
                width: '200px',
            }, {
                align: 'center',
                key  : 'name',
                title: '사용자 이름',
                width: '200px',
            }
        ],
    });
};

function checkId() {

    if ($("#usergrp_id").val() == '') {
        opme_message('[사용자그룹 ID] 를 입력하세요.', function() {
            $("#usergrp_id").focus();
        });

        return;
    }

    let data = {
        id: $("#usergrp_id").val(),
    };

    return $.ajax({
        url        : '/usergroup/dupchk',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        contentType: "application/json",
        success    : function(result){
            let msg = '';
            if (result['resultCode'] == 'EM0000') {
                msg = $("#usergrp_id").val() + " : 사용 중인 ID 입니다.";
                $("#usergrp_id").focus();
            } else if(result['resultCode'] == 'EM0999') {
                msg = "사용 가능한 ID 입니다.";
                $("#usergrp_id").attr("data-check-result", "ok");
                $("#btn_check_id").setEnabled(false);
                validateInput($("#usergrp_id"));
            } else {
                msg = "[" + result['resultCode'] + "] " + result['resultMsg'];
                $("#usergrp_id").focus();
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

function addMember() {

    opme_searchUser('멤버 추가', 'multi', null, function(user_info) {
        // 중복제거
        let add_member_list = [];
        for (let i=0; i<user_info.length; i++) {
            let user = $('#member_grid').alopexGrid('dataGet', {'id': user_info[i]['id']});
            if ($.isEmptyObject(user)) { // Grid 에 없으면 추가
                add_member_list.push(user_info[i]);
            } else { // Grid 에 있으면 복원(삭제된 경우, 복원됨)
                $('#member_grid').alopexGrid('dataUndelete', {'id': user[0].id});
            }
        }

        $("#member_grid").alopexGrid('dataAdd', add_member_list);
    });
};

// 데이터 저장
function saveData() {

    let id_list = $('#member_grid').alopexGrid('dataGet', {_state: {deleted: false}}).map(function(o) {
        return o.id;
    });

    let base_info = {
        usergrp_id : $("#usergrp_id").val(),
        owner_id   : $("#owner_id").val(),
        description: $("#description").val(),
    };

    let data = {
        usergrp_id : g_usergrp_id,
        base_info  : base_info,
        member_list: id_list,
    };

    return $.ajax({
        url        : '/usergroup/save',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        contentType: "application/json",
        success    : function(result) {
            opme_message(result['resultMsg'], function () {
                if (result['resultCode'] == 'EM0000') {
                    document.location.href = '/usergroup'
                }
            });
        }
    });
}

// 유효성 검사
function validate() {

    if (!validateInput($("#usergrp_id")))  return false;
    if (!validateInput($("#owner_id")))    return false;
    if (!validateInput($("#description"))) return false;

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
        case "usergrp_id":
            max_len = 20;
            if (target_val.length == 0) {
                msg = "[사용자그룹ID] 를 입력하세요.";
            } else if (target_val.length > max_len) {
                msg = "[사용자그룹ID] 는 " + max_len + "자리 이하로 입력하세요.";
            } else if (opme_validId(target_val) == false) {
                msg = "[사용자그룹ID] 는 알파벳,숫자,_,- 만 사용 가능합니다.(첫 문자는 알파벳,숫자)";
            } else if (target.attr("data-check-result") == "fail") {
                msg = "[사용자그룹ID] 의 사용 가능 여부를 확인하세요.";
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
        case "description":
            max_len = 500;
            if (target_val.length > max_len) {
                msg = "[설명] 은 " + max_len + "자리 이하로 입력하세요.";
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
