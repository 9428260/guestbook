var g_dctnry_voca_no = request_params['dctnry_voca_no']; // dctnry_voca_no (before changed)
var g_dctnry_word    = ""; // dctnry_voca_no (before changed)

var is_change = false;

$a.page(function(){
	this.init = function(id, param) {
		initData();
		setEventListener();
	};
});

function setEventListener() {

    // 단어명 유효성 체크.
    $("#btn_check_id").on("click", function(e) {
        checkId();
    });

    // 단어명 변경 여부 확인
    $('#dctnry_word').on('propertychange change keyup paste input', function(e) {
        $(this).attr("data-check-result", "fail");

        if (g_dctnry_word == $('#dctnry_word').val()) {
            $(this).attr("data-check-result", "ok");
            $("#btn_check_id").setEnabled(false);
            return;
        }

        $("#btn_check_id").setEnabled(true);
    });

    // 수정여부 체크
    $('#base_info td').on("change", function(e) {
        is_change = true;
    });

    // 목록
    $("#btn_list_dctnry").on("click", function(e) {
        if (is_change == true) {
            if (!confirm("변경하신 내용을 저장하지 않고, 이동하시겠습니까?")) {
                return;
            }
        }
        opme_postWithParam('/dctnry/', request_params);
    });

    // 저장
    $("#btn_save_data").on("click", function(e) {

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

// init Data (권한)
function initData() {
    let result = opme_getCode(['dctnry_type']);
    if (result == false) return;

    let type_arr = result['dctnry_type'].filter(function(element, index){ return index != 0 });

    $("#base_info tr:nth-child(2) th").addClass('pd-top15px'); // dctnry_voca_no
    $("#base_info tr:nth-child(2) td").addClass('pd-top10px'); // dctnry_voca_no

    // create
    if (g_dctnry_voca_no == '') {

        $('#dctnry_type').setData({
            data: type_arr,
        });

        return;
    }

    // edit
    if (response['resultCode'] == 'EM0999') {
        opme_message(response['resultMsg']);
        return;
    }

    // base_info
    $('#dctnry_voca_no').val(response['vocaNo']);
    g_dctnry_word = response['word'];
    $('#dctnry_word').val(response['word']);
    $('#dctnry_type').setData({
        data           : type_arr,
        option_selected: response['type'] // 최초 선택값 설정.
    });

    // history_info
    let history_info = $('#history_info td');

    let crt_date = opme_formatUTCString(response['crtDate']);
    let upd_date = opme_formatUTCString(response['updDate']);

    history_info.eq(0).text(response['crtUserId']);
    history_info.eq(1).text(crt_date);
    history_info.eq(2).text(response['updUserId']);
    history_info.eq(3).text(upd_date);
    $("#history_info").show(); // 'show'

    // super-user 가 아닌 경우, 변경 불가 처리
    if (login_privilege != '9') {
        $('td input').prop('readonly', true);
        $('td select').setEnabled(false);

        $('#btn_save_data').hide(); // 'hide'
    }
};

// 중복 단어 확인
function checkId() {

    if ($('#dctnry_word').val() == '') {
        opme_message('[단어명] 을 입력하세요.', function() {
            $("#dctnry_word").focus();
        });

        return;
    }

    let data = {
        dctnry_word: $('#dctnry_word').val().trim(),
    };

    return $.ajax({
        url        : '/dctnry/dupchk',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        contentType: "application/json",
        success    : function(result) {
            let msg = '';
            if (result['resultCode'] == 'EM0000') {
                msg = $("#dctnry_word").val() + " : 사용 중인 단어명 입니다.";
                $("#dctnry_word").focus();
            } else if(result['resultCode'] == 'EM0999' || result['resultCode'] == 'EM1002') {
                msg = "사용 가능한 단어명 입니다.";
                $("#dctnry_word").attr("data-check-result", "ok");
                $("#btn_check_id").setEnabled(false);
                validateInput($("#dctnry_word"));
            } else {
                msg = "[" + result['resultCode'] + "] " + result['resultMsg'];
                $("#dctnry_word").focus();
            }

            opme_message(msg);
            return;
        }
    });
};

// 데이터 저장
function saveData() {

    let base_info = {
        'dctnry_voca_no': $("#dctnry_voca_no").val(),
        'dctnry_word'   : $("#dctnry_word").val(),
        'dctnry_type'   : $("#dctnry_type").val(),
    };

    let data = {
        dctnry_voca_no: g_dctnry_voca_no,
        base_info     : base_info,
    };

    return $.ajax({
        url        : '/dctnry/save',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        contentType: "application/json",
        success    : function(result) {
            opme_message(result['resultMsg'], function () {
                if (result['resultCode'] == 'EM0000') {
                    document.location.href = '/dctnry'
                }
            });
        }
    });
};

// 유효성 검사
function validate() {

    if (!validateInput($("#dctnry_word"))) return false;
    if (!validateInput($("#dctnry_type"))) return false;

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
        case "dctnry_word":
            max_len = 100;
            if (target_val.length == 0) {
                msg = "[단어명] 를 입력하세요.";
            } else if (target_val.length > max_len) {
                msg = "[단어명] 는 " + max_len + "자리 이하로 입력하세요.";
            } else if (target.attr("data-check-result") == "fail") {
                msg = "[단어명] 의 사용 가능 여부를 확인하세요.";
            }
            break;
        case "dctnry_type":
            if (target_val == null) {
                msg = "[구분] 을 선택하세요.";
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
