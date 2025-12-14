var g_user_id = request_params['user_id']; // user_id (before changed)

$a.page(function() {
	this.init = function(id, param) {
		setEventListener();
	};
});

function setEventListener() {

    // 목록
    $("#btn_info").on("click", function(e) {
        opme_postWithParam('/user/dtl', request_params);
    });

    // 변경
    $("#btn_change").on("click", function(e) {

        if (validate() == false) {
            opme_message("[Invalid] 입력 하신 내용을 확인해 주세요.");
            return;
        }

        if (confirm("정말 변경 하시겠습니까??")) {
            changePw();
        }

        return;
    });
};

// 패스워드 변경
function changePw() {

    let user_id = g_user_id;
    let current_pw = $("#current_pw").val();
    let new_pw   = $("#input_pw").val();

    let data = {
        user_id    : user_id,
        current_pw : current_pw,
        new_pw     : new_pw,
    };

    return $.ajax({
        url        : '/user/chg_pw_logged',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        contentType: "application/json",
        success    : function(result) {

            let popup_msg;
            let logout_callback = function () {
                document.location.href = '/user/logout';
            };

            if (result['resultCode'] == "EM0000") { // 정상
                popup_msg = "[성공] 변경 완료 되었습니다.<br/>"
                          + "- 변경하신 패스워드로 다시 로그인 해주세요.";
                opme_message(popup_msg, logout_callback);
                return;
            }

            if (result['resultCode'] == "EM1001") { // 인증 실패 (미존재 사용자, 패스워드 불일치)

                popup_msg = "[" + result['resultCode'] + "] " + result['resultMsg'];

                if (typeof result['passwordFailLimit'] == "undefined" || result['passwordFailLimit'] == "0") {
                    opme_message(popup_msg);
                    return;
                }

                popup_msg = popup_msg + " ("  + result['passwordFailCount']
                                      + " / " + result['passwordFailLimit'] + ")";

                if (result['passwordFailCount'] == result['passwordFailLimit']) {
                    opme_message(popup_msg, logout_callback);
                    return;
                }

                opme_message(popup_msg);
                return;
            }

            // FailCount == FailLimit 일때, 이미 logout 처리 되므로, EM1014 분기는 수행될 일 없음.
            // - OPMM 에서 처리를 바꾸거나, OPME 로직에 문제가 있어서 EM1014가 나오는 경우를 대비해서 아래 구문 유지.
            if (result['resultCode'] == "EM1014") { // 패스워드 불일치 횟수 초과
                popup_msg = "[" + result['resultCode'] + "] " + result['resultMsg'];
                opme_message(popup_msg, logout_callback);
                return;
            }

            popup_msg = "[" + result['resultCode'] + "] " + result['resultMsg'];
            opme_message(popup_msg);

            return;
        }
    });
};

// 유효성 검사
function validate() {

    if (!validateInput($("#current_pw"))) return false;
    if (!validateInput($("#input_pw")))   return false;
    if (!validateInput($("#confirm_pw"))) return false;

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
    const regex    = /^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9])(?!.*\s).{10,50}$/;

    switch (target_id) {
        case "current_pw":
            max_len = 50;
            // null 체크는 edit, 일반 사용자에만 한다.
            if (target_val.length == 0) {
                msg = "[패스워드] 를 입력하세요.";
            } else if (target_val.length > max_len) {
                msg = "[패스워드] 는 " + max_len + "자리 이하로 입력하세요.";
            }
            break;
        case "input_pw":
            max_len = 50;
            if (target_val.length == 0) {
                msg = "[패스워드] 를 입력하세요.";
            //} else if (target_val.length > max_len) {
            //    msg = "[패스워드] 는 " + max_len + "자리 이하로 입력하세요.";
            } else if (!regex.test(target_val)) {
                msg = "[패스워드] 는 영문 대문자/소문자, 숫자, 특수문자를 포함하고, 10자 이상 50자 이하로 입력하세요.";
                focus_yn = false;
            } else if (target_val != $("#confirm_pw").val()
                    && $("#confirm_pw").val().length != 0) {
                msg = "[패스워드] 가 불일치 합니다.";
                focus_yn = false;
            } else {    // validation 메세지 동작
                $('#confirm_pw').siblings(".validation_msg").html(msg);
                $('#confirm_pw').siblings(".validation_msg").slideDown();
            }
            break;
        case "confirm_pw":
            max_len = 50;
            if (target_val.length == 0) {
                msg = "[패스워드] 를 입력하세요.";
            //} else if (target_val.length > max_len) {
            //    msg = "[패스워드] 는 " + max_len + "자리 이하로 입력하세요.";
            } else if (!regex.test(target_val)) {
                msg = "[패스워드] 는 영문 대문자/소문자, 숫자, 특수문자를 포함하고, 10자 이상 50자 이하로 입력하세요.";
                focus_yn = false;
            } else if (target_val != $("#input_pw").val()) {
                msg = "[패스워드] 가 불일치 합니다.";
                focus_yn = false;
            } else {    // validation 메세지 동작
                $('#input_pw').siblings(".validation_msg").html(msg);
                $('#input_pw').siblings(".validation_msg").slideDown();
            }
            break;
    }

    // Validation Check : ERROR
    if (msg != "") {
        target.siblings(".validation_msg").html(msg);
        target.siblings(".validation_msg").slideDown();

        if (focus_yn) target.focus();

        return false;
    }

    // Validation Check : SUCCESS
    target.siblings(".validation_msg").html();
    target.siblings(".validation_msg").slideUp();

    return true;
};
