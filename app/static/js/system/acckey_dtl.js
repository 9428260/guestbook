var g_acckey_id = request_params['acckey_id']; // acckey_id (before changed)
var is_change   = false;

$a.page(function(){
	this.init = function(id, param) {
		initData();
		setEventListener();
	};
});

function setEventListener() {

    // '수정' 처리이고, super-user 인 경우에만 이벤트 등록
    if (g_acckey_id != '' && login_privilege == '9') {
        // Owner ID 조회
        $('#btn_sel_owner_id, #owner_id').on('click', function(e) {
            selectOwner();
        });
    }

    // 수정여부 체크
    $('#base_info td').on("change", function(e) {
        is_change = true;
    });

    // 목록
    $("#btn_list_acckey").on("click", function(e) {
        if (is_change == true) {
            if (!confirm("변경하신 내용을 저장하지 않고, 이동하시겠습니까?")) {
                return;
            }
        }
        opme_postWithParam('/acckey/', request_params);
    });

    // 저장
    $("#btn_save_acckey").on("click", function(e) {

        if (is_change == false) {
            opme_message("변경하신 내용이 없습니다.");
            return false;
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
    // time Hour
    let hour_option = [];
    for (let i=0; i<=23; i++) {
        if (i < 10) {
            hour_option.push({'value': '0'+i, 'text': '0'+i});
        } else {
            hour_option.push({'value': ''+i, 'text': ''+i});
        }
    }
    $('#expiry_hour').setData({
        data           : hour_option,
        option_selected: hour_option[23]['value'] // 최초 선택값 설정.
    });

    // time Minute, time Second
    let minute_option = [];
    let second_option = [];
    for (let i=0; i<=59; i++) {
        if (i < 10) {
            minute_option.push({'value': '0'+i, 'text': '0'+i});
            second_option.push({'value': '0'+i, 'text': '0'+i});
            continue;
        }
        minute_option.push({'value': ''+i, 'text': ''+i});
        second_option.push({'value': ''+i, 'text': ''+i});
    }
    $('#expiry_minute').setData({
        data           : minute_option,
        option_selected: minute_option[59]['value'] // 최초 선택값 설정.
    });
    $('#expiry_second').setData({
        data           : second_option,
        option_selected: second_option[59]['value'] // 최초 선택값 설정.
    });

    let valid_timezone  = opme_getValidTimezone();
    let timezone_option = [];
    for (let i=0; i<valid_timezone.length; i++) {
        timezone_option.push({"value": valid_timezone[i], "text": "UTC"+valid_timezone[i]});
    }

    $('#expiry_timezone').setData({
        data           : timezone_option,
        option_selected: timezone_option[29]['value'] // 최초 선택값 설정.(UTC+09:00)
    });

    let result = opme_getCode(['acckey_status']);
    if (result == false) return;

    let status_arr = result['acckey_status'].filter(function(element, index){ return index != 0 });

    $('#id').prop('disabled', true);

    // create
    if (g_acckey_id == '') {
        $("#base_info tr:first-child").hide(); // acckey id
        $("#base_info tr:nth-child(2) th").addClass('pd-top15px'); // acckey name
        $("#base_info tr:nth-child(2) td").addClass('pd-top10px'); // acckey name

        $("#base_info tr:last-child").hide(); // status
        $("#base_info tr:nth-child(5) td").addClass('pd-bottom10px'); // expiry date

        $('#owner_id').val(login_id);
        $('#owner_id').prop('readonly', true);
        $("#btn_sel_owner_id").hide();

        $('#status').setData({
            data: status_arr,
        });

        return;
    }

    // edit
    if (response['resultCode'] == 'EM0999') {
        opme_message(response['resultMsg']);
        return;
    }

    // base_info
    $('#id').val(response['id']);
    $('#name').val(response['name']);
    $('#owner_id').val(response['ownerUserId']);
    $('#owner_id').prop('readonly', true);
    $('#ip_addr').val(response['ipAddr']);
    $('#expiry_date').val(response['expiryDate'].substring(0, 10));
    $('#expiry_hour').val(response['expiryDate'].substring(11, 13));
    $('#expiry_minute').val(response['expiryDate'].substring(14, 16));
    $('#expiry_second').val(response['expiryDate'].substring(17, 19));

    let expiry_timezone = response['expiryDate'].substring(19);
    $('#expiry_timezone').val(expiry_timezone);
    if ($('#expiry_timezone').val() == null) {
        // timezone 에 해당하는 값이 없으면, 해당 값을 콤보박스에 추가해서 보여준다.
        timezone_option.push({"value": expiry_timezone, "text": "UTC"+expiry_timezone});
        $('#expiry_timezone').setData({
            data: timezone_option,
        });
        $('#expiry_timezone').val(expiry_timezone);
    }

    $('#status').setData({
        data           : status_arr,
        option_selected: response['status'] // 최초 선택값 설정.
    });

    // history_info
    let history_info = $('#history_info td');
    let crt_date     = opme_formatUTCString(response['crtDate']);
    let upd_date     = opme_formatUTCString(response['updDate']);
    history_info.eq(0).text(response['crtUserId']);
    history_info.eq(1).text(crt_date);
    history_info.eq(2).text(response['updUserId']);
    history_info.eq(3).text(upd_date);
    $("#history_info").show(); // 'show'

    // super-user 가 아닌 경우, 변경 불가 처리
    if (login_privilege != '9') {
        $('td input').prop('readonly', true);
        $('td select').setEnabled(false);
        $('.Dateinput').setEnabled(false);

        $("#btn_save_acckey").hide();
    }
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

// 데이터 저장
function saveData() {
    let expiry_date = $("#expiry_date").val() + 'T'
                    + $("#expiry_hour").val() + ':'
                    + $("#expiry_minute").val() + ':'
                    + $("#expiry_second").val()
                    + $("#expiry_timezone").val();

    let base_info = {
        'name'       : $("#name").val(),
        'owner_id'   : $("#owner_id").val(),
        'ip_addr'    : $("#ip_addr").val(),
        'expiry_date': expiry_date,
        'status'     : $("#status").val(),
    };

    let data = {
        acckey_id: g_acckey_id,
        base_info: base_info,
    };

    return $.ajax({
        url        : '/acckey/save',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        contentType: "application/json",
        success    : function(result) {
            if (result['resultCode'] != 'EM0000') {
                opme_message("[" + result['resultCode'] + "] " + result['resultMsg']);
                return;
            }

            // 최초 생성인 경우에만 SECRET KEY Popup.
            if (g_acckey_id != '') {
                document.location.href = '/acckey'
                return;
            }

            // Secret Copy Button in Popup(opme_message)
            // - copy button : Call opme_copyClipboard(result['secret']);
            let popup_msg  = "[성공] SECRET KEY 는 재조회 불가하니, 별도 보관이 필요합니다."
            let button_str = "<button id=\"btn_secret_copy\" class=\"Button btn btn_msg_popup bg-gray\" "
                           + "onclick=\"javascript:opme_copyClipboard('" + result['secret'] + "')\">복사</button>";
            let blank_str  = "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"

            // Resize Popup(opme_message)
            $(".popup-message").removeClass("w400px");
            $(".popup-message").addClass("w500px");
            opme_message(popup_msg + "<br/><br/>"
                       + "- ID" + blank_str + " : " + result['id']     + "<br/>"
                       + "- SECRET"         + " : " + result['secret'] + button_str, function () {
                document.location.href = '/acckey'
            });
        }
    });
};

// 유효성 검사
function validate() {

    if (!validateInput($("#name")))        return false;
    if (!validateInput($("#ip_addr")))     return false;
    if (!validateInput($("#expiry_date"))) return false;

    return true;
};

function validateInput(target) {

    // 유효하지 않은 필드는 Skip.
    if (target.css("display") == "none") {
        return true;
    }

    // 만료일자와 관련된 component 인 경우, exiry_date 확인하도록 함.
    if (target.attr("id").indexOf("expiry_") == 0) {
        target = $("#expiry_date");
    }

    let target_id    = target.attr("id");
    let target_val   = target.val();
    let dateinput_yn = false;
    let msg          = "";
    let max_len      = 0;
    let ip_addr_regexp = new RegExp(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/){1}(?:[0-9]|[1-2][0-9]|[3][0-2])$/);

    switch (target_id) {
        case "name":
            max_len = 30;
            if (target_val.length == 0) {
                msg = "[이름] 을 입력하세요.";
            } else if (target_val.length > max_len) {
                msg = "[이름] 은 " + max_len + "자리 이하로 입력하세요.";
            }
            break;
        case "ip_addr":
            max_len = 100;
            if (target_val.length == 0) {
                msg = "[IP 주소] 를 입력하세요.";
            } else if (target_val.length > max_len) {
                msg = "[IP 주소] 는 " + max_len + "자리 이하로 입력하세요.";
            } else if (ip_addr_regexp.test(target_val) == false) {
                msg = "유효하지 않은 IP 주소 입니다.";
            }
            console.log(ip_addr_regexp);
            break;
        case "expiry_date":

            // yyyyMMdd or yyyy-MM-dd 일자 포맷 정규표현식 체크
            let date_regexp1 = new RegExp(/^\d{4}((-\d{2}){2}|(\d{2}){2})$/);
            let date_regexp2 = new RegExp(/^(2\d{3})-?(0[0-9]|1[0-2])-?([0-2][0-9]|3[0-1])$/);

            if (target_val.length == 0) {
                msg = "[만료일자] 를 선택하세요.";
            } else if (date_regexp1.test(target_val) == false) {
                msg = "[만료일자] 는 yyyyMMdd 또는 yyyy-mm-dd 로 입력하세요.";
            } else if (date_regexp2.test(target_val) == false) {
                msg = "[만료일자] 유효범위는 2000년 01월 01일 ~ 2999년 12월 31일 입니다.";
            } else {
                let s_date     = target_val.replace(/[^0-9]/g, "");
                let s_check_yy = s_date.substring(0,4);
                let s_check_mm = s_date.substring(4,6);
                let s_check_dd = s_date.substring(6,8);
                let b_result   = true;

                if ((s_check_mm == 4 || s_check_mm == 6 || s_check_mm == 9 || s_check_mm == 11) && s_check_dd == 31) {
                    b_result = false;
                } else if (s_check_mm == 2) {
                    let isleap = (s_check_yy % 4 == 0 && (s_check_yy % 100 != 0 || s_check_yy % 400 == 0));
                    if (s_check_dd > 29 || (s_check_dd == 29 && !isleap)) {
                        b_result = false;
                    }
                }
                if (b_result == false) {
                    msg = "[만료일자] 유효하지 않은 날짜 입니다."
                }
            }
            dateinput_yn = true;
            break;
    }

    // Validation Check : ERROR
    if (msg != "") {

        if (dateinput_yn) {
            target.parent().siblings(".validation_msg").html(msg);
            target.parent().siblings(".validation_msg").slideDown();
        } else {
            target.siblings(".validation_msg").html(msg);
            target.siblings(".validation_msg").slideDown();
        }

        target.focus();

        // 자기 자신과 권한 등에 의해 Disabled 처리된 Component 는 제외하고,
        // Validation Check 대상인 Select Box 처리
        $('.Select.validation_tgt, .btn-ico').not('#' + target_id).not('.Disabled').prop('disabled', true);
        if (target_id != 'expiry_date') {
            $('.Calendar').css('pointer-events', 'none');
        }

        return false;
    }

    // Validation Check : SUCCESS
    if (dateinput_yn) {
        target.parent().siblings(".validation_msg").html();
        target.parent().siblings(".validation_msg").slideUp();
    } else {
        target.siblings(".validation_msg").html();
        target.siblings(".validation_msg").slideUp();
    }

    // 자기 자신과 권한 등에 의해 Disabled 처리된 Component 는 제외하고,
    // Validation Check 대상인 Select Box 처리
    $('.Select.validation_tgt, .btn-ico').not('#' + target_id).not('.Disabled').prop('disabled', false);
    if (target_id != 'expiry_date') {
        $('.Calendar').css('pointer-events', 'auto');
    }

    return true;
};
