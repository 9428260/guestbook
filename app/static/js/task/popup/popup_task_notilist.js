var g_common_condition_arr  = [];
var g_common_condition_dict = {};
var g_notilist_event_arr = [];
var g_notilist_method_arr  = [];

$a.page(function(){
	this.init = function(id, param) {
	    initCombo();
	    initData();
	    setEventListener();
    };
});

function setEventListener() {
    $('#notilist_event').on('change', function(e) {
        setNotiCondition();
    });

    // 추가
    $("#btn_add").on("click", function(e){

        // 유효성 체크
        if (validate() == false) {
            opme_message("[Invalid] 수신 이메일 주소를 확인해주세요 - " + msg);
            return;
        };

        // 알림목록 param 시작
        var notiParams = [];
        notiParams.push({'event': $('#notilist_event').val()});

        // 'condition' 조건 추가 - all, success, fail (항상, 성공, 실패) 중 항상 엔 없음
        if ($('#notilist_condition').val() !== "all") {
            notiParams.push({'condition': "result=\"" + $('#notilist_condition').val() + "\""});
        }

        notiParams.push({'method': $('#notilist_method').val()});
        notiParams.push({'receiver': $('#notilist_receiver').val()});

        // 최종 객체 변환
        var finalParams = Object.assign({}, ...notiParams);
        $a.close(finalParams);
        // 알림목록 param 끝
        return;
    });

    // 닫기
    $("#btn_close").on("click", function(e) {
        $a.close();
    });
};

function initCombo() {

    g_common_condition_arr = JSON.parse(noti_condition);
    g_notilist_event_arr = JSON.parse(noti_event);
    g_notilist_method_arr = JSON.parse(noti_method);

};

function initData() {

    // notilist - 조건
    $('#notilist_condition').setData({
        data           : g_common_condition_arr,
    });

    // notilist - 이벤트
    $('#notilist_event').setData({
        data           : g_notilist_event_arr,
    });

    // notilist - 방법
    let notilist_method_arr = [];
    $('#notilist_method').setData({
        data           : g_notilist_method_arr,
    });

    setNotiCondition();
};

function setNotiCondition() {
    let mode = $('#notilist_event').val();

    switch (mode) {
        case 'ES':
            $('#notilist_condition').hide();
            break;
        case 'ET':
            $('#notilist_condition').show();
            break;
        default:
            return;
    }
    return;
}

// 유효성 검사
function validate() {
    if (!validateInput($("#notilist_receiver"))) return false;
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
        case "notilist_receiver":
            max_len = 100;
            if (target_val.length == 0) {
                msg = "수신 이메일을 입력하세요.";
                break;
            } else if (target_val.length > max_len) {
                msg = "수신 이메일은 " + max_len + "자리 이하로 입력하세요.";
                break;
            }
            if( !opme_validEmail(target_val) ) {
                msg = "수신 이메일 주소 형식에 오류가 있습니다.";
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
