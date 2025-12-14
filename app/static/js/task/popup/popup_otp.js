/*
  OPMM TCS 활성화 추가
*/
$(document).ready(function() {
    initData();
    setEventListener();
});

function initData() {

};

function setEventListener() {
   $('#btn_close').on('click', function(e) {
        let data = {
            result : 'close',
            tcsOtpPassCode: '',
        };
        $a.close(data);
    });

    $('#btn_certify').on('click', function(e) {
        if(verify()){
            let data = {
                result : 'success',
                tcsOtpPassCode: $("#verification_code").val(),
            };
            $a.close(data);
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
        return false;
    }

    return true;
};

