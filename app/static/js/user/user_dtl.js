var g_user_id = request_params['user_id']; // user_id (before changed)
var is_change = false;

$a.page(function() {
	this.init = function(id, param) {
		initData();
		setEventListener();
	};
});

function setEventListener() {

    // 사용자ID 유효성 체크.
    $("#btn_check_id").on("click", function(e) {
        checkId();
    });

    // 사용자 ID 변경 여부 확인
    $('#user_id').on('propertychange change keyup paste input', function(e) {
        $(this).attr("data-check-result", "fail");

        if (g_user_id == $('#user_id').val()) {
            $(this).attr("data-check-result", "ok");
            $("#btn_check_id").setEnabled(false);
            is_change = false;
            return;
        }

        $("#btn_check_id").setEnabled(true);
        is_change = true;
    });

    // 수정여부 체크
    $('#base_info td, #enable_info td').on("change", function(e) {
        is_change = true;
    });

    /*
       [2023.11.04] SKT-PRD 보안인증 심사 보완사항
       마스킹 해제를 위한 패스워드 OR 2차 인증코드를 입력 받는 팝업창 생성
    */
    $("#btn_mask").on("click", function(e) {
        popupLogin();
    });

    // 목록
    $("#btn_list").on("click", function(e) {
        if (is_change == true) {
            if (!confirm("변경하신 내용을 저장하지 않고, 이동하시겠습니까?")) {
                return;
            }
        }
        // 241008. request_params 가 mask 해제 후 비어서 분기
        if ('mask_view' in request_params) {
            window.location.href = "/user/";
        } else {
            opme_postWithParam('/user/', request_params);
        }
    });

    // 저장
    $("#btn_save").on("click", function(e) {

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

    // 2차인증 등록
    $("#btn_register_mfa").on("click", function(e) {
        if (is_change == true) {
            if (!confirm("저장하지 않은 변경 사항은 반영되지 않습니다. 진행 하시겠습니까?")) {
                return;
            }
        }

        if (!confirm("2차인증 등록을 진행 하시겠습니까?\n(Google Authenticator App.)")) {
            return;
        }

        registerMfa();
    });

    // 2차인증 초기화
    $("#btn_init_mfa").on("click", function(e) {
        if (is_change == true) {
            if (!confirm("저장하지 않은 변경 사항은 반영되지 않습니다. 진행 하시겠습니까?")) {
                return;
            }
        } else {
            if (!confirm("2차인증 초기화를 진행 하시겠습니까?")) {
                return;
            }
        }

        initMfa();
    });

    // 패스워드 변경
    $("#btn_change_pw").on("click", function(e) {
        let params = {
            'user_id': g_login_id, // login ID
        };
        opme_postWithParam('/user/chg_pw', params);
    });

    // 패스워드 리셋
    $("#btn_reset_pw").on("click", function(e) {
        resetUser();
    });
};

// init Data
function initData() {
    let result = opme_getCode(['user_privilege', 'user_status']);
    if (result == false) return;

    let privilege_arr = result['user_privilege'].filter(function(element, index) {
        return index != 0
    });

    let user_status_arr = result['user_status'].filter(function(element, index) {
        return index != 0
    });

    $('#user_privilege').setData({
        data: privilege_arr,
    });

    $('#user_status').setData({
        data: user_status_arr,
    });

    // create
    if (g_user_id == '') {
        // '생성' 시에는 2차인증 관련 처리 불가.
        $("#btn_change_pw").hide();
        $("#btn_reset_pw").hide();
        $("#btn_init_mfa").hide();
        $("#btn_register_mfa").hide();
        $("#row_mfa_register_yn").hide();
        mask_view = 'Y';
        return;
    }

    // edit
    if (response['resultCode'] == 'EM0999') {
        opme_message(response['resultMsg']);
        return;
    }

    // 권한에 따른 편집 제한
    if (login_privilege != '9') { // '9': Super User, '5': Normal User
        $("#user_id").prop('readonly', true);
        $("#user_privilege").setEnabled(false);
        $("#user_status").setEnabled(false);
        $("#btn_check_id").hide();
        $("#btn_reset_pw").hide();
        $("#user_id").removeClass("with_btn");

        if (login_id != g_user_id) {
            $(".Textinput").prop('readonly', true);
            $("#btn_save").hide();
        }
	}

    // 로그인 사용자, 권한 유무 등에 따른 화면제어(2차인증, 패스워드 리셋, 패스워드 변경)
    if (login_id == g_user_id) {

        // 로그인한 본인인 경우, 패스워드 리셋은 필요 없음.
        $("#btn_reset_pw").hide();

        // 로그인한 본인인 경우에만 2차 인증 등록 여부 확인 가능.
        // 2차인증 코드 미등록 상태
        if (typeof response['mfaKey'] == "undefined" || response['mfaKey'] == "") {
            $("#btn_init_mfa").hide(); // 초기화 버튼 숨김.
            $("#row_mfa_register_yn td").text("미등록");
        } else { // 2차인증 코드 기등록 상태
            $("#btn_register_mfa").hide(); // 등록 버튼 숨김.
            $("#row_mfa_register_yn td").text("사용중");
        }
    } else {

        // 로그인한 본인이 아닌 다른 사람의 패스워드 변경은 불가(super-user 인 경우, 리셋은 가능)
        $("#btn_change_pw").hide();

        $("#btn_register_mfa").hide(); // 등록 버튼 숨김.
        $("#row_mfa_register_yn").hide(); // 2차인증 등록 여부 숨김.

        if (login_privilege != '9') {
            $("#btn_init_mfa").hide(); // 초기화 버튼 숨김.
        }
    }

    // base_info
    $('#user_id').val(response['id']);
    $('#user_nm').val(response['name']);
    $('#user_privilege').val(response['privilege']); // 최초 선택값 설정.
    $('#user_status').val(response['status']); // 최초 선택값 설정.
    //$('#user_notiAddr').val(response['notiAddr']);
    //$('#user_contact').val(response['contact']);
    $('#user_description').val(response['description']);

    // history_info
    let history_info = $('#history_info td');
    let login_date = "-";
    if (response['loginDate'] != null) {
        login_date = opme_formatUTCString(response['loginDate']);
    }

    let crt_date = opme_formatUTCString(response['crtDate']);
    let upd_date = opme_formatUTCString(response['updDate']);

    history_info.eq(0).text(response['crtUserId']);
    history_info.eq(1).text(crt_date);
    history_info.eq(2).text(response['updUserId']);
    history_info.eq(3).text(upd_date);
    history_info.eq(4).text(login_date);
    $("#history_info").show(); // 'show'

    if (mask_view == 'Y') {
        $('#btn_mask').hide();
    } else {
        $('#btn_mask').show();
    //    setReadOnly("#user_notiAddr");
    //    setReadOnly("#user_contact");
    }
};

// 중복 ID 확인
function checkId() {

    if ($("#user_id").val() == '') {
        opme_message('[사용자 ID] 를 입력하세요.', function() {
            $("#user_id").focus();
        });

        return;
    }

    let data = {
        user_id: $("#user_id").val(),
    };

    return $.ajax({
        url        : '/user/dupchk',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        contentType: "application/json",
        success    : function(result) {
            let msg = '';
            if (result['resultCode'] == 'EM0000') {
                msg = $("#user_id").val() + " : 사용 중인 ID 입니다.";
                $("#user_id").focus();
            } else if(result['resultCode'] == 'EM0999') {
                msg = "사용 가능한 ID 입니다.";
                $("#user_id").attr("data-check-result", "ok");
                $("#btn_check_id").setEnabled(false);
                validateInput($("#user_id"));
            } else {
                msg = "[" + result['resultCode'] + "] " + result['resultMsg'];
                $("#user_id").focus();
            }

            opme_message(msg);
            return;
        }
    });
};

// 데이터 저장
function saveData() {

    let base_info = {
        'user_id'         : $("#user_id").val(),
        'user_nm'         : $("#user_nm").val(),
        'user_privilege'  : $("#user_privilege").val(),
        'user_status'     : $("#user_status").val(),
        'user_notiaddr'   : "",
        'user_contact'    : "",
        'user_description': $("#user_description").val(),
    };

    // 241008. mask 에 따른 분기 처리
    if (mask_view != "Y") {
        let remove_key = ["user_contact","user_notiaddr"];
        remove_key.forEach(key => {
            delete base_info[key];
        });
    }

    let data = {
        user_id  : g_user_id,
        base_info: base_info,
        mask_view: mask_view,
    };

    return $.ajax({
        url        : '/user/save',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        contentType: "application/json",
        success    : function(result) {

            // create - rest result 에 password 여부로 체크
            if (result['password'] != null) {
                let popup_msg  = "[성공] 계정 생성 완료 되었습니다. <br/>"
                               + "- 발급된 패스워드로 로그인 하여 패스워드 변경을 해야 합니다. <br/><br/>";

                // copy button
                let button_str = "<button id=\"btn_secret_copy\" class=\"Button btn btn_msg_popup bg-gray\" "
                               + "onclick=\"javascript:opme_copyClipboard('" + result['password'] + "')\">복사</button>";

                // message
                opme_message(popup_msg + "패스워드 : " + result['password']
                        + "&nbsp;&nbsp;&nbsp;&nbsp;" + button_str + "<br/>"
                        , function() {
                            document.location.href = '/user'
                        });
                return;
            };

            // edit
            opme_message(result['resultMsg'], function () {
                document.location.href = '/user'
            });
        }
    });
};

// 2차인증 등록
function registerMfa() {
    let data = {
        user_id: g_user_id,
    };

    return $.ajax({
        url        : '/user/register_mfa',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        contentType: "application/json",
        success    : function(result) {
            let popup_msg  = "<b>[성공] 2차인증 키는 재조회 불가합니다.</b><br/>"
                            + "- 소유하신 휴대기기에 \"Google Authenticator\" App. 을 설치해 주세요.<br/>"
                            + "- \"Google Authenticator\" App. 에서 설정 키 입력 또는 QR 코드 스캔을 진행해주세요.<br/>"
                            + "- 등록이 완료 되신 후, \"닫기\" 버튼을 누르면 자동으로 로그아웃 됩니다.<br/><br/>"
            let src_str = "data:image/png;base64," + result["qr_code"];
            let tag_str = "<img alt=\"baba\" class=\"w320px, h320px\" src=\"" + src_str + "\"/>";

            // Resize Popup(opme_message)
            $(".popup-message").removeClass("w400px");
            $(".popup-message").removeClass("h200px");
            $(".popup-message").addClass("w600px");
            $(".popup-message").addClass("h600px");
            opme_message(popup_msg
                        + "설정 키 : " + result['mfa_key'] + "<br/>"
                        + "QR 코드<br/>"
                        + tag_str, function () {
                document.location.href = "/user/logout";
            });
        }
    });
};

// 2차인증 초기화
function initMfa() {
    let data = {
        user_id: g_user_id,
    };

    return $.ajax({
        url        : '/user/init_mfa',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        contentType: "application/json",
        success    : function(result) {
            opme_message(g_user_id + "님의 2차인증 정보가 초기화 되었습니다.", function () {
                document.location.href = '/user'
            });
        }
    });
};

// 유효성 검사
function validate() {

    if (!validateInput($("#user_id")))          return false;
    if (!validateInput($("#user_nm")))          return false;
    if (!validateInput($("#user_privilege")))   return false;
    //if (!validateInput($("#user_notiAddr")))    return false;
    //if (!validateInput($("#user_contact")))     return false;
    if (!validateInput($("#user_description"))) return false;
    if (!validateInput($("#user_status")))      return false;

    return true;
};

function validateInput(target) {

    // 유효하지 않은 필드는 Skip.
    if (target.css("display") == "none") {
        return true;
    }

    let target_id  = target.attr("id");
    let target_val = target.val();
    let focus_yn   = true; // Set focus
    let msg        = "";
    let max_len    = 0;

    switch (target_id) {
        case "user_id":
            max_len = 20;
            if (target_val.length == 0) {
                msg = "[사용자 ID] 를 입력하세요.";
            } else if (target_val.length > max_len) {
                msg = "[사용자 ID] 는 " + max_len + "자리 이하로 입력하세요.";
            } else if (opme_validId(target_val) == false) {
                msg = "[사용자 ID] 는 알파벳,숫자,_,- 만 사용 가능합니다.(첫 문자는 알파벳,숫자)";
            } else if (target.attr("data-check-result") == "fail") {
                msg = "[사용자 ID] 의 사용 가능 여부를 확인하세요.";
            }
            break;
        case "user_nm":
            max_len = 30;
            if (target_val.length == 0) {
                msg = "[이름] 을 입력하세요.";
            } else if (target_val.length > max_len) {
                msg = "[이름] 은 " + max_len + "자리 이하로 입력하세요.";
            }
            break;
        case "user_privilege":
            if (target_val == null) {
                msg = "[권한] 을 선택하세요.";
            }
            break;
//        case "user_notiAddr":
//            max_len = 50;
//            if (target_val.length > max_len) {
//                msg = "[Noti(이메일)] 은 " + max_len + "자리 이하로 입력하세요.";
//            }
//            break;
//        case "user_contact":
//            max_len = 30;
//            if (target_val.length > max_len) {
//                msg = "[연락처] 는 " + max_len + "자리 이하로 입력하세요.";
//            }
//            break;
        case "user_description":
            max_len = 500;
            if (target_val.length > max_len) {
                msg = "[상세사항] 은 " + max_len + "자리 이하로 입력하세요.";
            }
            break;
        case "user_status":
            if (target_val == null) {
                msg = "[활성여부] 를 선택하세요.";
            }
            break;
    }

    // Validation Check : ERROR
    if (msg != "") {
        target.siblings(".validation_msg").html(msg);
        target.siblings(".validation_msg").slideDown();

        // $(location).attr("href", "#" + target_id); // target_id 위치로 스크롤 이동.
        if (focus_yn) target.focus();

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

// 유저 리셋
function resetUser() {

    return $a.popup({
        url    : '/user/p_reset_pw',
        title  : '사용자 패스워드 리셋',
        iframe : true,  // default 는 true
        width  : 850,
        height : 320,
        movable: true,
        data   : {'user_id': $("#user_id").val()},
    });
};

/*
   [2023.11.04] SKT-PRD 보안인증 심사 보완사항
   마스킹 해제를 위한 패스워드 OR 2차 인증코드를 입력 받는 팝업창
   입력값이 정상이고 btn_mask 버튼이 visible 인경우
   btn_mask 버튼을 없애고 마스킹 해제 데이터를 보이도록
   사용자 정보를 조회함
*/
function popupLogin() {

    let user_param = { user_id: g_user_id };
    opme_popupLogin('사용자 정보 인증', 'single', user_param, function(data) {
        if (data == 'success') {
            if ($('#btn_mask').is(':visible')) {
                $('#btn_mask').hide();
                if(g_user_id) {
                    let params = {
                        'user_id'          : g_user_id,
                        'mask_view'        : 'Y',
                    };
                    opme_postWithParam('/user/dtl', params);
                }
            }
        }
    });

};

function setReadOnly(selector) {
    $(selector).prop('readonly', true);
    $(selector).css('background-color', '#f9f9f9');
}