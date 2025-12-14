// Common Message Popup
function opme_message(msg, callback)
{
    // target 을 초기화 후 다시 셋팅
    var cloneObj = $('.popup-message').clone();
    $('.popup-message').empty().append( cloneObj.html() );

    // Setting Message
    $('.popup-message').find(".message").html(msg);

    var oHeight = $('.popup-message').height();
    var wHeight = $(window).height();
    var oWidth = $('.popup-message').width();

    $('html,body').css('overflow','hidden');
    $('.popup-message').css({
        top:(wHeight-oHeight)/2,
        marginLeft:(-(oWidth/2)),
        visibility:'visible'
    });
    $('body').append('<div class="popup-modal-bg"></div>');

    $('.popup-message').draggable();

    // Fixed focus
    $("#btn_close_popup_message").focus().bind('blur', function() {
        $(this).focus();
    });

    $("html").click(function() {
        $("#btn_close_popup_message").val($("#btn_close_popup_message").val()).focus();
    });

    //disable the tab key
    $(document).on('keydown', function(e){
        if (e.keyCode == 9) {  //tab pressed
            e.preventDefault(); // stops its action
        }
    });

    $("#btn_close_popup_message").on('click', function(e){
        e.preventDefault();
        $('html,body').css('overflow', 'visible');
        // $('.popup-modal-bg:last-child').remove();
        $('.popup-modal-bg').remove();
        $(this).parents('.popup-message').css({top:'-9999px',visibility:'hidden'});

        // Setting Message
        $('.popup-message').find(".message").html('');

        $("#btn_close_popup_message").unbind('blur');
        $("html").unbind('click');
        $(document).unbind('keydown');

        // callback
        if( typeof callback != 'undefined' && callback) {
            callback();
        }
    });
};

function opme_getCode(p_code_list, p_isAsync) {
    let result;
    let isAsync = false;

    // sync
    if( typeof p_isAsync != 'undefined' && p_isAsync) {
        isAsync = true;
    }

    $.ajax({
        url: '/common/comm_code',
        type: "POST",
        dataType: "json",
        data : JSON.stringify({'code_list': p_code_list}),
        contentType: "application/json",
        async: isAsync,
        success : function(code_list) {

            for (let i = 0; i < p_code_list.length; i++) {
                if ((typeof code_list[p_code_list[i]] === 'undefined') || (code_list[p_code_list[i]] == null)) {
                    opme_message("Do not found. Common Code : " + p_code_list[i]);
                    result = false;
                    return;
                }
            }
            result = code_list;
        }
    });

    return result;
};

// Call Post with Param.
function opme_postWithParam(url, params) {
    let hiddenForm = $('<form></form>');
    hiddenForm.attr('method', 'post');
    hiddenForm.attr('action', url);
    hiddenForm.attr('target', '_self');

    for (let key in params) {
        if (params.hasOwnProperty(key)) {
            hiddenForm.append($('<input/>', {type: 'hidden', name: key, value: params[key]}));
        }
    }
    hiddenForm.appendTo('body');
    hiddenForm.submit();
};

// Popup : Search User
// - title     : Popup Title
// - mode      : Popup Mode ('single' : Single Select, 'multi' : Multiple Select)
// - userParam : User Parameter (Map Data)
// - callback  : Call Back Function
function opme_searchUser(title, mode, userParam, callback) {

    $a.popup({
        url: '/user/p_user',
        title: title,
        iframe: true,  // default 는 true
        width: 980,
        movable: true,
        data: {'mode': mode, 'user_param': userParam},
        callback: function(data) {
            if (data == 401) {
                window.location.href = "/user/login";
                return;
            }
            callback(data);
        }
    });
};

// Popup : Search UserGroup
// - title     : Popup Title
// - mode      : Popup Mode ('single' : Single Select, 'multi' : Multiple Select)
// - userParam : User Parameter (Map Data)
// - callback  : Call Back Function
function opme_searchUserGroup(title, mode, userParam, callback) {

    $a.popup({
        url: '/usergroup/p_usergroup',
        title: title,
        iframe: true,  // default 는 true
        width: 980,
        movable: true,
        data: {'mode': mode, 'user_param': userParam},
        callback: function(data) {
            if (data == 401) {
                window.location.href = "/user/login";
                return;
            }
            callback(data);
        }
    });
};

// Popup : Search FileHub
// - title     : Popup Title
// - mode      : Popup Mode ('single' : Single Select, 'multi' : Multiple Select)
// - userParam : User Parameter (Map Data)
// - callback  : Call Back Function
function opme_searchFileHub(title, mode, userParam, callback) {

    $a.popup({
        url: '/filehub/p_filehub',
        title: title,
        iframe: true,  // default 는 true
        width: 980,
        movable: true,
        data: {'mode': mode, 'user_param': userParam},
        callback: function(data) {
            if (data == 401) {
                window.location.href = "/user/login";
                return;
            }
            callback(data);
        }
    });
};

// Popup : Search Node
// - title     : Popup Title
// - mode      : Popup Mode ('single' : Single Select, 'multi' : Multiple Select)
// - userParam : User Parameter (Map Data)
// - callback  : Call Back Function
function opme_searchNode(title, mode, userParam, callback) {

    $a.popup({
        url: '/node/p_node',
        title: title,
        iframe: true,  // default 는 true
        width: 1450, // 팝업 scroll 과 grid scroll 이 중복으로 나타나지 않도록 팝업 크기를 조정 1200 -> 1450
        movable: true,
        data: {'mode': mode, 'user_param': userParam},
        callback: function(data) {
            if (data == 401) {
                window.location.href = "/user/login";
                return;
            }
            callback(data);
        }
    });
};

// Popup : Search Task
// - title     : Popup Title
// - mode      : Popup Mode ('single' : Single Select, 'multi' : Multiple Select)
// - userParam : User Parameter (Map Data)
// - callback  : Call Back Function
function opme_searchTask(title, mode, userParam, callback) {

    $a.popup({
        url: '/task/p_task',
        title: title,
        iframe: true,  // default 는 true
        width: 1100,
        movable: true,
        data: {'mode': mode, 'user_param': userParam},
        callback: function(data) {
            if (data == 401) {
                window.location.href = "/user/login";
                return;
            }
            callback(data);
        }
    });
};

// Popup : Search Tag
// - title     : Popup Title
// - mode      : Popup Mode ('single' : Single Select, 'multi' : Multiple Select)
// - userParam : User Parameter (Map Data)
// - callback  : Call Back Function
function opme_searchTag(title, mode, userParam, callback) {

    $a.popup({
        url: '/node/p_node_tag',
        title: title,
        iframe: true,  // default 는 true
        width: 1200,
        height: 750,
        movable: true,
        data: {'mode': mode, 'user_param': userParam},
        callback: function(data) {
            if (data == 401) {
                window.location.href = "/user/login";
                return;
            }
            callback(data);
        }
    });
};

// Formatting UTC String
// - param
//  - datetime : date time string(ISO-8601) ex) 2017-03-10T11:30:00+09:00
// - return : UTC String ex) 2017-03-10 11:30:00 UTC+09:00
function opme_formatUTCString(datetime) {
    if (datetime.length != 25) return datetime;

    return datetime.substring(0, 10) + " "
         + datetime.substring(11, 19) + " UTC"
         + datetime.substring(19);
};

// Formatting Date Time String
// - param
//  - mode : Yearly, Monthly, Weekly, Daily, Hourly
//  - datetime : date time string ex) 2017-03-10 11:30, SUN 07:30, ...
// - return : String ex) 2017년 03월 10일 11시 30분, 매주 일요일 07시 30분, ...
function opme_formatDatetimeString(mode, datetime) {
    let result;
    let day;
    const DAYOFWEEK = {"sun": "일", "mon": "월", "tue": "화", "wed": "수", "thu": "목", "fri": "금", "sat": "토"};

    switch (mode) {
        case 'Once':    // 2022-01-01 00:00
            day = (datetime.substring(8, 10) == "99") ? "말" : datetime.substring(8, 10);
            result = datetime.substring(0, 4) + "년 " + datetime.substring(5, 7) + "월 " + day + "일 "
                   + datetime.substring(11, 13) + "시 " + datetime.substring(14, 16) + "분";
            break;
        case 'Yearly':  // 01-01 00:00
            day = (datetime.substring(3, 5) == "99") ? "말" : datetime.substring(3, 5);
            result = "매년 " + datetime.substring(0, 2) + "월 " + day + "일 "
                   + datetime.substring(6, 8) + "시 " + datetime.substring(9, 11) + "분";
            break;
        case 'Monthly': // 01 00:00
            day = (datetime.substring(0, 2) == "99") ? "말" : datetime.substring(0, 2);
            result = "매월 " + day + "일 "
                   + datetime.substring(3, 5) + "시 " + datetime.substring(6, 8) + "분";
            break;
        case 'Weekly':  // SUN 00:00
            result = "매주 " + DAYOFWEEK[datetime.substring(0, 3)] + "요일 "
                   + datetime.substring(4, 6) + "시 " + datetime.substring(7, 9) + "분";
            break;
        case 'Daily':   // 00:00
            result = "매일 " + datetime.substring(0, 2) + "시 " + datetime.substring(3, 5) + "분";
            break;
        case 'Hourly':  // 00
            result = "매시 " + datetime.substring(0, 2) + "분";
            break;
    }

    return result;
};

// 년과 월에 따라 마지막 일 구하기
function opme_lastDay(year, month) {
    var last_day = 31;

    if (year.length == 4) {
        last_day = new Date(new Date(year, month, 1) - 86400000).getDate();
    }

    // console.log(last_day);
    return last_day;
};

// 유효 Timezone 반환.
// - return : Array of UTC offset (https://en.wikipedia.org/wiki/List_of_UTC_offsets)
function opme_getValidTimezone() {
    return ["-12:00", "-11:00", "-10:00", "-09:30", "-09:00",
            "-08:00", "-07:00", "-06:00", "-05:00", "-04:00",
            "-03:30", "-03:00", "-02:00", "-01:00", "+00:00",
            "+01:00", "+02:00", "+03:00", "+03:30", "+04:00",
            "+04:30", "+05:00", "+05:30", "+05:45", "+06:00",
            "+06:30", "+07:00", "+08:00", "+08:45", "+09:00",
            "+09:30", "+10:00", "+10:30", "+11:00", "+12:00",
            "+12:45", "+13:00", "+14:00"];
};

// 유효성 검사 - 숫자만 존재
// - true  : 숫자로만 되어 있음.
// - false : 숫자가 아닌 것이 있음.
function opme_isNumber(str) {
    return /^\d+$/.test(str);
};

// 유효성 검사 - 한글이 포함되는지 검사
// - true  : 한글이 문자열에 포함.
// - false : 한글 전혀 없음.
function opme_hasKorean(str) {
    return /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(str);
};

// 유효성 검사 - ID 유효여부 검사
// - true  : 첫 문자는 숫자/알파벳, 이후는 숫자/알파벳/-/_
// - false : 규칙에 맞지 않음.
function opme_validId(str) {
    return /^([a-zA-Z0-9])([\w-_]*)$/.test(str);
};

// 유효성 검사 - Hostname 유효성 검사
// - true  : 첫 문자 마지막 문자는 숫자/알파벳, 이후는 숫자/알파벳/-, 64자 이하, _는 넣을수 없음
// - false : 규칙에 맞지 않음.
function opme_validHostname(str) {
    //return /^([a-zA-Z0-9])[a-zA-Z0-9\-_]{1,63}([a-zA-Z0-9])$/.test(str);
    // 전체 길이 제한 (최대 255자)
    if (str.length > 255) return false;

    // 각 label은 . 으로 구분됨
    const labels = str.split('.');

    // 각 label 검사
    for (const label of labels) {
        // label 길이 제한 (1~63자)
        if (label.length < 1 || label.length > 63) return false;

        // label은 영숫자로 시작하고 끝나야 함
        if (!/^[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9]$/.test(label)) {
        return false;
    }

    // 하이픈만으로 구성된 label은 허용되지 않음
    if (/^-+$/.test(label)) return false;
    }

    return true;
};

// 유효성 검사 - 정규표현식 유효성 검사
// - true  : 정상
// - false : SyntaxError
function opme_validRegexp(str) {
    try {
        new RegExp(str);
    } catch(e) {
        opme_message("[" + e.name + "] " + e.message);
        return false;
    }
    return true;
};

// 유혀성 검사 - 이메일 주소 형식
function opme_validEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

// Clipboard 복사 기능
function opme_copyClipboard(contents) {
    // if (typeof navigator.clipboard !== "undefined") {
    //     // Only https or http(localhost)
    //     navigator.clipboard.writeText(contents);
    //     return;
    // }
    var textArea = document.createElement("textarea");
    textArea.value = contents;
    textArea.style.position = "fixed"; // avoid scrolling to bottom
    document.body.appendChild(textArea);

    // message popup event
    if ($("html,body").css("overflow") == "hidden") {
        $("#btn_close_popup_message").unbind('blur');
        $("html").unbind('click');
    }

    // Fixed focus
    textArea.focus();
    textArea.select();

    try {
        let result = document.execCommand('copy');

        if (!result) {
            opme_message("[ERROR] Clipboard Copy 실패");
        }
    } catch (err) {
        opme_message("[ERROR] " + err);
    }

    document.body.removeChild(textArea);

    // message popup event
    if ($("html,body").css("overflow") == "hidden") {
        $("#btn_close_popup_message").focus().bind('blur', function() {
            $(this).focus();
        });

        $("html").click(function() {
            $("#btn_close_popup_message").val($("#btn_close_popup_message").val()).focus();
        });
    }

    return;
};

// - Dictionary to String (Tag)
function opme_dictToStr (dict) {
    let keys = Object.keys(dict);
    let str = "";
    let delim = ',';

    for (let j = 0; j < keys.length; j++) {
        if (j == keys.length - 1) {
            delim = '';
        }

        let tmpStr = '"' + keys[j] + '"="' + dict[keys[j]] + '"' + delim;
        str += tmpStr;
    }

    return str;
};

// - String to Dictionary (Tag)
function opme_strToDict(str) {

    if (str == null){
        return str;
    }
    let dict = {};
    let items = str.split(",");

    for (let i = 0; i < items.length; i++) {
        let item = items[i];
        let [key, value] = item.split("=");
        dict[key.trim().replace(/"/g, "")] = value.trim().replace(/"/g, "");
    }

    return dict;
}

function opme_exportExcel(...args) {
    let worker = new ExcelWorker({
    	excelFileName : args[0],
    	defaultPalette : {
			fontsize: 11,
			font: '맑은 고딕',
		},
		//useCSSParser < defaultPalette < palette 순으로 우선순위가 높음
		palette : [{
			className : 'export-header',
			backgroundColor: '217,217,217',
			color : '0,0,0',
			font: '맑은 고딕',
			fontbold: true
		}],
    	sheetList: [{
    		sheetName: args[1],
    		$grid    : $('#' + args[2])
    	}]
    });

    let filtered = false;
    if(args[3] != null){
        filtered = args[3];
    }

    worker.export({
    	merge             : true,
    	exportHidden      : true,
    	filtered          : filtered,
    	selected          : false,
    	useGridColumnWidth: true,
    	border            : true,
    	exportNewline     : true,
    	useCSSParser      : true,
    });
}

// Task Permission 조회
function opme_getTaskPermission(task_id) {

    let result    = "---"; // task permission
    let permParam = {
        page      : 1,
        perPage   : 100,
        id        : task_id,
        owner_id  : '',
        publish_id: '', // $("#publish_id").val(),
        permitted_id : "",
        rev_zero  : '',
    };

    $.ajax({
        url        : '/task/list',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(permParam),
        contentType: "application/json",
        success    : function(result) {

            if (result['resultCode'] == 'EM0999') {
                opme_message("[" + result['resultCode'] + "] " + result['resultMsg']);
                return result;
            }

            let task_list = result['taskList'];

            for (let i=0; i<task_list.length; i++) {
                if (task_list[i].id == $("#task_id").val()) {
                    permission = task_list[i].permMode;
                    break;
                }
            }
        }
    });

    return result;
};

// 도움말 url 호출할 때
function opme_getHelpURL() {

    // 도움말 page 이동
    let url = "/opmedocs";
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
        url = "http://localhost:8000"
    }
    return url;
};

function opme_popupHelp(setUrl) {
	let helpUrl = "";
	//let manualUrl = opme_getHelpURL();
    let manualUrl = "/opmedocs";
	if ( setUrl != null && typeof setUrl != "undefined" && setUrl.length > 0 ) {
	    helpUrl = setUrl;
	} else {
	    helpUrl = $(location).attr('pathname');
	}
    
    if(helpUrl.endsWith('/')){
	    helpUrl = manualUrl + helpUrl.slice(0, -1) + ".html";
    } else {
	    helpUrl = manualUrl + helpUrl.substring(0, helpUrl.lastIndexOf('/')) + ".html";
    }
	// var popup = window.open(helpUrl, 'Manual', 'width=1450,height=800,top=200,left=100,scrollbars=yes,resizable=yes');
    $a.popup({
		url: helpUrl,
		// url: "popup/popup_test.html",
		windowpopup: true,
		modal : false,
		other: "width=1450,height=800,top=200,left=100,scrollbars=yes,resizable=yes"
	});
};

/*
    - Popup : Popup login
    - title     : Popup Title
    - mode      : Popup Mode ('single' : Single Select, 'multi' : Multiple Select)
    - userParam : User Parameter (Map Data)
    - callback  : Call Back Function
    [2023.11.04] SKT-PRD 보안인증 심사 보완사항
    마스킹 해제를 위한 패스워드 OR 2차 인증코드를 입력 받는 팝업창 생성
*/
function opme_popupLogin(title, mode, userParam, callback) {
    var left = (screen.width/2)-(460/2);
    var top = (screen.height/2)-(215/2);

    $a.popup({
        url: '/user/p_login',
        title: title,
        iframe: true,  // default 는 true
        width: 440, //
        height: 255,
        movable: true,
        data: {'mode': mode, 'user_param': userParam},
        callback: function(data) {
            callback(data);
        }
    });
};

// OPMM TCS 활성화 추가
function opme_popupTcsOtp(title, mode, userParam, callback) {
    var left = (screen.width/2)-(460/2);
    var top = (screen.height/2)-(215/2);

    $a.popup({
        url: '/task/p_tcsotp',
        title: title,
        iframe: true,  // default 는 true
        width: 440, //
        height: 275,
        movable: true,
        data: {'mode': mode, 'user_param': userParam},
        callback: function(data) {
            callback(data);
        }
    });
};

// 정규표현식에 들어갈 문자열에 메타문자가 포함되어있으면 일반문자로 인식되도록 처리
function sanitizeRegexString(input) {
  // 정규표현식 메타문자 목록
  const metaChars = /[.*+?^${}()|[\]\\]/;

  // 메타문자가 포함되어 있는지 확인
  if (metaChars.test(input)) {
    // 메타문자를 이스케이프 처리
    const escaped = input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped;
  }

  // 메타문자가 없으면 원본 그대로 반환
  return input;
}
