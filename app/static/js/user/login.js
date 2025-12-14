var g_login_fail_cnt = 0;

$(document).ready(function() {
    // Browser Check
    if (checkBrowser() == false) {
        return false;
    }

    initData();
    setEventListener();
});

function initData() {
    $("#user_id").focus();
};

function setEventListener() {

    // 비밀번호 변경
    $("#go_password a").on('click', function(e) {

        document.location.href = "/user/chg_pw";
        return;
    });

    // 담당자 문의
    $("#go_help a").on('click', function(e) {
        let msg = '<b>OPME(OPMATE WebConsole)</b><br/>'
                + '&nbsp;- 시스템 담당자 : 강인모/신인호/윤형준<br/>'
                + '<style type="text/css">a:hover { color: purple; text-decoration: underline; }</style>'
                + '&nbsp;- 연락처 : <a href="mailto:opmate@sk.com">opmate@sk.com</a>';
        opme_message(msg, function () {
            $("#user_id").focus();
        });

        return;
    });

    // 로그인
    $('#btn_login').on('click', function(e) {
        login();
        return;
    });

    // 인증요청
    $('#btn_verify').on('click', function(e) {
        verify();
        return;
    });

    // 'Enter' 처리
    $('.login-box').on('keyup', function(e) {
        if (e.keyCode != 13) { // 'Enter' Key
            return;
        }

        // 'Enter' Key
        if ($("#btn_login").css("display") !== "none") {
            login();
        } else {
            verify();
        }
    });

    return;
};

// Login
function login() {

    let data = {
        user_id : $("#user_id").val(),
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

            // Resize Popup(opme_message)
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

            // EM0999 : 기타 오류
            // EM1001 : 인증 실패
            if (result['resultCode'] == 'EM0999' || result['resultCode'] == 'EM1001') {
                $("#login_info .error_txt").html(base_msg + "<br/>"
                                                + fail_cnt_msg);
                $("#password").val('');
                return;
            }

            // EM1011 : 비활성화된 사용자
            // EM1014 : 패스워드 불일치 횟수 초과 사용자
            if (result['resultCode'] == 'EM1011' || result['resultCode'] == 'EM1014') {
                base_msg = base_msg + "<br/>" + "관리자에게 문의하세요.";
                $("#password").val('');
                opme_message(base_msg);
                return;
            }

            // EM1012 : 패스워드 만료
            // EM1013 : 리셋된 사용자
            if (result['resultCode'] == 'EM1012' || result['resultCode'] == 'EM1013') {
                base_msg = base_msg + "<br/>" + "패스워드 변경 페이지로 이동합니다.";
                opme_message(base_msg, function() {
                    document.location.href = "/user/chg_pw";
                });
                return;
            }

            // 2차인증 수단을 지정하지 않은 경우.
            if (result["existMfaKeyYn"] == "N") {
                base_msg = result['name'] + " 님은 2차인증 미사용 중 입니다." + "<br/>"
                            + "2차인증 등록을 진행해주세요.";

                opme_message(base_msg + "<br/><br/>"
                            + fail_cnt_msg + "<br/>"
                            + last_login_msg + "<br/>"
                            + expiry_dt_msg
                            , function () {
                                // 내정보 화면 이동
                                let params = {
                                    'user_id'    : data['user_id'], // login ID
                                    'sc_page'    : 1,               // Default value
                                    'sc_per_page': 10,              // Default value
                                };
                                opme_postWithParam('/user/dtl', params);
                            }
                );
                return;
            }

            base_msg = result['name'] + " 님, 로그인 인증번호 확인해 주세요.";
            opme_message(base_msg         + "<br/>"
                         + fail_cnt_msg   + "<br/>"
                         + last_login_msg + "<br/>"
                         + expiry_dt_msg
            );

            // 인증번호 요구
            $("#login_info").hide();
            $("#btn_login").hide();
            $("#verification_info").show();
            $("#btn_verify").show();
            $("#verification_code").focus();

            return;
        }
    });
};

// 인증요청
function verify() {

    // 인증코드 공백제거
    let verification_code = $("#verification_code").val().replace(/ /g, "");

    // isNaN - true: number, false: not number
    if (verification_code.length != 6 || isNaN(verification_code)) {
        opme_message("6자리 인증코드(숫자)를 입력해주세요.");
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

            if (result['resultCode'] != 'EM0000') {
                g_login_fail_cnt++;
                $("#verification_code").focus();
                $("#verification_info #error_msg1").text("[" + result['resultCode'] + "] " + result['resultMsg']);

                // 인증 3회 이상 실패 시에는 시간정보 확인하도록 가이드 메시지 추가.
                if (g_login_fail_cnt > 2) {
                    let msg = "(휴대기기의 시간과 서버의 시간이 다른 경우, 인증에 실패할 수 있습니다.)"
                    $("#verification_info #error_msg2").text(msg);
                }

                return;
            }

            // index(대시보드)로 이동.
            document.location.href = "/";

            return;
        }
    });
};

// Check Browser(Chrome)
function checkBrowser() {
    const agent = window.navigator.userAgent.toLowerCase();
    let browserName;

    switch (true) {
        case agent.indexOf("edge") > -1: // MS Edge
            browserName = "Edge";
            break;
        case agent.indexOf("edg/") > -1: // Edge Chromium based
            browserName = "Edge (chromium based)";
            break;
        case agent.indexOf("opr") > -1 && !!window.opr: // Opera
            browserName = "Opera";
            break;
        case agent.indexOf("chrome") > -1 && !!window.chrome: // Chrome
            browserName = "Chrome";
            break;
        case agent.indexOf("trident") > -1: // Internet Explorer
            browserName = "Internet Explorer";
            break;
        case agent.indexOf("firefox") > -1: // Mozilla Firefox
            browserName = "Firefox";
            break;
        case agent.indexOf("safari") > -1: // Safari
            browserName = "Safari";
            break;
        default: // Other
            browserName = "Other";
            break;
    }

    if( browserName !== "Chrome" && !browserName.startsWith("Edge")) {
        opme_message("이 사이트는 Chrome Browser 만 지원합니다.<br/>- Current Browser : " + browserName);
        return false;
    }

    return true;
};
