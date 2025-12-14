const PASSWORD_MODE = [{'value': 'auto'    , 'text': '자동'     },
                       {'value': 'specific', 'text': '사용자지정'}];

$a.page(function(){
	this.init = function(id, param) {
        initCombo();
        initData();
        setEventListener(param);
    };
});

function setEventListener(param) {

    $('#password_mode').on('change', function(e) {
        let mode = $('#password_mode').val();

        // mode 와 상관없이, change 시에 초기화 한다.
        $('#input_password').prop("type", "password");
        $("#btn_eye").removeClass('icon_eye_hide');
        $("#btn_eye").addClass('icon_eye');
        $("#btn_eye").attr('title', '보이기');
        $('#input_password').val("");

        if (mode == PASSWORD_MODE[0]['value']) { // 자동 'auto'
            $('#input_password').hide();
            $('#btn_eye').hide();

            // change 이벤트 부여 - sibling 동작
            $('#input_password').trigger('change');

        } else { // 사용자지정 'specific'
            $('#input_password').show();
            $('#btn_eye').show();
        }

        return;
    });

    // 변경
    $("#btn_reset").on("click", function(e){

        // 유효성 체크
        if (validate() == false) {
            opme_message("[Invalid] 입력 하신 내용을 확인해 주세요.");
            return;
        };

        if (confirm("리셋 실행 하시겠습니까??")) {
            resetPw(param);
        }
    });

    // 닫기
    $("#btn_close").on("click", function(e) {
        $a.close();
    });

    $("#btn_eye").on("click", function(e) {
        // button - 보기/숨기기
        if ($("#btn_eye").hasClass('icon_eye')) {
            $("#btn_eye").removeClass('icon_eye');
            $("#btn_eye").addClass('icon_eye_hide');
            $('#input_password').prop("type", "text");
            $("#btn_eye").attr('title', '숨기기');
        } else {
            $("#btn_eye").removeClass('icon_eye_hide');
            $("#btn_eye").addClass('icon_eye');
            $('#input_password').prop("type", "password");
            $("#btn_eye").attr('title', '보이기');
        }
    });
};

function initCombo() {

    $('#password_mode').setData({
        data           : PASSWORD_MODE,
        option_selected: PASSWORD_MODE[0]['value'] // 최초 선택값 설정.
    });

    return;
};

function initData() {
    $('#input_password').hide();
    $('#btn_eye').hide();
    return;
};

// 유효성 검사
function validate() {
    if (!validateInput($("#input_password"))) return false;
    return true;
};

function validateInput(target) {

    // 유효하지 않은 필드는 Skip.
    if (target.css("display") == "none") {
        target.siblings(".validation_msg").html();
        target.siblings(".validation_msg").slideUp();

        return true;
    }

    let target_id  = target.attr("id");
    let target_val = target.val();
    let focus_yn   = true; // Set focus
    let msg        = "";
    let max_len    = 0;

    switch (target_id) {
        case "input_password":
            max_len = 50;
            if (target_val.length == 0) {
                msg = "[패스워드] 를 입력하세요.";
            } else if (target_val.length > max_len) {
                msg = "[패스워드] 는 " + max_len + "자리 이하로 입력하세요.";
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

function resetPw(param) {

    let data = {
        'user_id': param['user_id'],
        'user_pw': $("#input_password").val(),
    };

    // reset 호출
    return $.ajax({
        url        : '/user/reset_pw',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        contentType: "application/json",
        success    : function(data) {
            let popup_msg = "[성공] 리셋 완료 되었습니다. <br/>"
                          + "- 발급된 패스워드로 로그인 하여 패스워드 변경을 해야 합니다. <br/><br/>";

            // copy button
            let button_str = "<button id=\"btn_secret_copy\" class=\"Button btn btn_msg_popup bg-gray\" "
                           + "onclick=\"javascript:opme_copyClipboard('" + data['password'] + "')\">복사</button>";

            // message
            opme_message(popup_msg + "패스워드 : " + data['password']
                        + "&nbsp;&nbsp;&nbsp;&nbsp;" + button_str + "<br/>"
                        , function() {
                            $a.close();
                        });
        }
    });
};
