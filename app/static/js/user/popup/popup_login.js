/*
   [2023.11.04] SKT-PRD 보안인증 심사 보완사항
   마스킹 해제를 위한 패스워드 OR 2차 인증코드를 입력 받는 팝업창
   패스워드 OR 2차 인증 코드를 입력 받음
*/
$(document).ready(function() {
    initData();
    setEventListener();
});

function initData() {

    if (mfa_key_yn == 'Y'){
        $('#pw').hide();
        $('#token').show();
    }else{
        $('#pw').show();
        $('#token').hide();
    }
};

function setEventListener() {

    // 인증요청
    $('#btn_certify').on('click', function(e) {
        if (mfa_key_yn == 'Y'){
            verify();
            return;
        } else {
            login();
            return;
        }
    });

    $('#btn_close').on('click', function(e) {
        $a.close();
    });
};

// Login
function login() {
    let data = {
        user_id : user_id,
        password: $("#password").val(),
    };

    $.ajax({
        url        : "/user/login",
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        contentType: "application/json",
        success    : function(result) {

            let base_msg       = "[" + result['resultCode'] + "] " + result['resultMsg'];
            let fail_cnt_msg   = "";
            let last_login_msg = "";
            let expiry_dt_msg  = "";

            $(".popup-message").removeClass("h200px");
            $(".popup-message").addClass("h270px");

            // 메시지 처리 - failCount, lastLoginDate, passwordExpiryDate
            if (typeof result['passwordFailCount'] !== "undefined" && result['passwordFailCount'] != 0) {
                fail_cnt_msg = "접속 실패 누적 횟수 : " + result['passwordFailCount'] + "회";
            }
            if (typeof result['passwordFailLimit'] !== "undefined"
                    && result['passwordFailLimit'] != 0
                    && result['passwordFailCount'] != 0 ) {
                fail_cnt_msg += " / " + result['passwordFailLimit'] + "회";
            }

            if (typeof result['lastLoginDate'] !== "undefined") {
                last_login_msg = "최근 접속 시간 확인 : " + opme_formatUTCString(result['lastLoginDate']);
            }

            if (typeof result['passwordExpiryDate'] !== "undefined"
                    && result['passwordChangeDate'] != result['passwordExpiryDate']) {
                expiry_dt_msg = "패스워드 만료 시기&nbsp; : " + opme_formatUTCString(result['passwordExpiryDate']);
            }

            $("#error_txt").html(base_msg);

            if(result['resultCode'] == 'EM0000'){
                $a.close('success');
            }
        }
    });
};

// 인증요청
function verify() {

    // 인증코드 공백제거
    let verification_code = $("#verification_code").val().replace(/ /g, "");

    // isNaN - true: number, false: not number
    if (verification_code.length != 6 || isNaN(verification_code)) {
        //opme_message("6자리 인증코드(숫자)를 입력해주세요.");
        $("#error_txt").html("6자리 인증코드(숫자)를 입력해주세요.");
        return;
    }

    let data = {
        "verification_code": verification_code
    };

    $.ajax({
        url        : "/user/verify",
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        contentType: "application/json",
        success    : function(result) {
            if (result['resultCode'] == 'EM0000') {
                $a.close('success');
            } else {
                $("#verification_code").focus();
                $("#error_txt").text("[" + result['resultCode'] + "] " + result['resultMsg']);
            }
        }
    });
};

