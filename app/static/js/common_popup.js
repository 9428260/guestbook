var g_login_id_p = '';

/*************************
 ** Ajax 공통 설정       **
 *************************/
$.ajaxSetup({
  error: function(jqXHR, exception) {
        if (jqXHR.status === 0) {
            alert('Not connect.\n Verify Network.');
        } else if (jqXHR.status == 400) {
            alert('Server understood the request, but request content was invalid. [400]');
        } else if (jqXHR.status == 401) {
            opme_message('로그인 정보를 확인할 수 없습니다. 다시 로그인 하십시오.', function() {
                $a.close(jqXHR.status);
            });
            //window.open("/user/login?req=log_expire",'로그인 창', "width=800, height=700, toolbar=no, menubar=no, scrollbars=no, resizable=yes");
        } else if (jqXHR.status == 403) {
            alert('해당 요청에 대한 권한이 없습니다.');
        } else if (jqXHR.status == 404) {
            alert('Requested page not found. [404]');
        } else if (jqXHR.status == 500) {
            opme_message('['+ jqXHR.status + '] ' + jqXHR.statusText, function() {
                $a.close(jqXHR.status);
            });
        } else if (jqXHR.status == 503) {
            alert('Service unavailable. [503]');
        } else if (exception === 'parsererror') {
            alert('Requested JSON parse failed. [Failed]');
        } else if (exception === 'timeout') {
            alert('Time out error. [Timeout]');
        } else if (exception === 'abort') {
            alert('Ajax request aborted. [Aborted]');
        } else {
            alert('Uncaught Error.n' + jqXHR.responseText);
        }
    }
});

/*************************
 **  Ajax BlockUI 적용.  **
 *************************/
$(document).ajaxStart(function () {
    $.blockUI(
        {
            message: "<br/>요청을 처리하는 중 입니다.",
            css: {
                width: '500px',
                height: '70px',
                textAlign: 'center'
            },
            overlayCSS: {
                backgroundColor: "#000000",
                opacity: 0.6
            },
            centerY: true,
            centerX: true,
        }
    );
});

$(document).ajaxStop(function () {
    $.unblockUI();
});

/*************************
 ** Alopex 공통 설정     **
 *************************/
$a.setup('datepicker', {
	showbottom: true,
});

AlopexGrid.setup({
    fitTableWidth : true, // 테이블의 너비를 그리드 너비에 맞춰 확장시키는 옵션
    autoColumnIndex : true, // column 인덱스 자동 생성
    defaultColumnMapping : {  // column 기본 설정
        resizing : true, // 자동크기변환
        sorting : true, // 정렬
    },
    ellipsisText : true, // 긴 text 줄임 표시
    message: {  // no message 처리
		nodata: '데이터가 없습니다.',
		filterNodata: 'No data',
		noFilteredData: '필터링된 데이터가 없습니다.'
	},
	useClassHovering : true,
	enableContextMenu: false,
    enableDefaultContextMenu: false,
});

/*************************
 ** 화면 레이아웃 설정     **
 *************************/
$(document).ready(function() {

	// Mouse 우클릭 방지
	document.oncontextmenu = function() {
	    return false;
	};

    // Html Element drag 방지
	document.ondragstart = function() {
	    return false;
	};

	setCommonEventListener();

	// Popup에서 Session의 UserID 정보 조회
	getLoginIdFromPopup();

	return;
});

function setCommonEventListener() {

    // 입력 페이지 validation event
    $(".validation_tgt").on("input focusout change", function(e) {

        // 빈 영역 클릭 시, validation check
        if (e.relatedTarget == null || typeof e.relatedTarget === "undefined") {
            return validateInput($(this));
        }

        // Textinput, Select 및 다른 validation check 대상 컴포넌트 클릭 시, validation check
        if (e.relatedTarget.classList.contains("Textinput")
         || e.relatedTarget.classList.contains("Select")
         || e.relatedTarget.classList.contains("validation_tgt")
         || e.relatedTarget.type == "textarea") {
            return validateInput($(this));
        }

        // Button, Link 등의 기타 요소 인 경우는 validation check 하기 않고,
        // 해당 기능을 수행하도록 한다.
    });

    return;
};

// Get login_id
function getLoginIdFromPopup() {

    $.ajax({
        url        : '/common/info',
        type       : "GET",
        dataType   : "json",
        data       : JSON.stringify(),
        contentType: "application/json",
        async      : false,
        success    : function(data){

            g_login_id_p = data['login_id'];
            return g_login_id_p;
        } // success
    });
};
