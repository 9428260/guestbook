var g_login_id = '';

/*************************
 ** Ajax 공통 설정       **
 *************************/
$.ajaxSetup({
  error: function(jqXHR, exception, error) {
        if (jqXHR.status === 0) {
            alert('Not connect.\n Verify Network.');
        } else if (jqXHR.status == 400) {
            alert('Server understood the request, but request content was invalid. [400]');
        } else if (jqXHR.status == 401) {
            opme_message('로그인 정보를 확인할 수 없습니다. 다시 로그인 하십시오.', function () {
                window.location.href = "/user/login";
            });
            //window.open("/user/login?req=log_expire",'로그인 창', "width=800, height=700, toolbar=no, menubar=no, scrollbars=no, resizable=yes");
        } else if (jqXHR.status == 403) {
            alert('해당 요청에 대한 권한이 없습니다.');
        } else if (jqXHR.status == 404) {
            alert('Requested page not found. [404]');
        } else if (jqXHR.status == 500) {
            opme_message('['+ jqXHR.status + '] ' + jqXHR.statusText);
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
//$(document).ajaxStart($.blockUI).ajaxStop($.unblockUI);
//$(document).ajaxStart(function () {
$(document).ajaxSend(function (event, jqxhr, settings) {

    if ( settings.sse_enable != undefined && settings.sse_enable == 'no' ) {
        return;
    }

    if (settings.url.endsWith("/del_tmp_file")){
       return;
    }

    let message = "<br/>요청을 처리하는 중 입니다."
    if (settings.url.endsWith("/xl_export") || settings.url.endsWith("/download") || settings.url.endsWith("/predownload")) {
        message = $('#common-progress-bar');
        $('#common-progress').width("0%");
        $('#common-progress').text("0%");
    }


    if (settings.url.endsWith("/download")) {
          let arr = settings.data.split('&');
          let filenameArr = arr[arr.length-4];
          let idxArr = arr[arr.length-2];
          let totalArr = arr[arr.length-1];

          let filename = filenameArr.split('=')[1];
          let idx = idxArr.split('=')[1];
          let total= totalArr.split('=')[1];

          if(total > 1) {
              $('.progress-txt').empty();
              $('.progress-txt').append( '[' + (Number(idx) +1) + '/' + total + '] ' + filename + ' 파일 생성 중 입니다.'  );
              return;
          }
    }

    $.blockUI(
        {
            message: message,
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
    height : 'content', // 높이를 우선 content 로 맞춤
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
	// scrollbar 적용 대기
//    scrollbarPreview : {
//		enabled : true,
//		column : function(data, mapping) {
//			if (mapping.columnIndex === 0){
//				return '체크박스 칼럼';
//			}
//			return mapping.title;
//		}
//	},
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

    // Mouse Double Click 시에 Block Select 방지
    document.onmousedown = function (event) {
        if (event.detail > 1) {
            event.preventDefault ();
        }
    };

    // Browser Check
    if (checkBrowser() == false) {
        return false;
    }

    // toggleLeftMenu();
    // toggleQuickMenu();

    // Login User ID, Left Navigation Bar Menu List
    getCommonInfo();

	$('.user-menus').hide();
	setCommonEventListener();

	return;
});

function setCommonEventListener() {

	//user box click event
	$('#user_menu').click(function(e) {
	    e.preventDefault();
	    $(this).toggleClass('drop_close');
	    $(".user-menus").slideToggle(50);
	});

    // 내정보
    $('#my_info').click(function(e) {
        var params = {
            'user_id'    : g_login_id, // login ID
            'sc_page'    : 1,          // Default value
            'sc_per_page': 10,         // Default value
        };
        opme_postWithParam('/user/dtl', params);
    });

    // PW 변경
    $('#my_password').click(function(e) {
        var params = {
            'user_id'    : g_login_id, // login ID
        };
        opme_postWithParam('/user/chg_pw', params);
    });

    // 도움말
    $('#opmedocs').click(function(e) {
        //window.open('about:blank').location.href = opme_getHelpURL();
        opme_popupHelp();
    });

    // 로그아웃
    $('#logout').click(function(e) {
        document.location.href = "/user/logout";
    });

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
         || e.relatedTarget.classList.contains("btn-ico")
         || e.relatedTarget.classList.contains("alopexgrid-default-renderer")
         || e.relatedTarget.type == "textarea") {
            return validateInput($(this));
        }

        // Button, Link 등의 기타 요소 인 경우는 validation check 하기 않고,
        // 해당 기능을 수행하도록 한다.
    });

    return;
};

// Get Login User Id
function opme_getLoginId() {
    // console.log(g_login_id);
    return g_login_id;
};

// Get Common Information. (login_id, privilege, menu)
function getCommonInfo() {
    let strPath = document.location.pathname;

    var currentPage = "/" + strPath.split("/")[1];

    var result = opme_getCode(['user_privilege']);
    if (result == false) return;

    var privilege_arr = result['user_privilege'].filter(function(element, index) {
        return index != 0
    });

    return $.ajax({
        url        : '/common/info',
        type       : "GET",
        dataType   : "json",
        data       : JSON.stringify(),
        contentType: "application/json",
        async      : false,
        success    : function(data){
            g_login_id = data['login_id'];
            $('.user-organ').text(data['privilege']['text']);
            $('span.user').text(g_login_id);

            // menu
            var menu_list = data['menu_list'];

            for (var i = 0; i < menu_list.length; i++) {
                var subMenu = menu_list[i]['sub'];
                var subMenuStr = '';
                var ulTagStr = '<ul class="lnb-sub">'; // Not Selected.
                var liTagStr = '';

                // sub menu
                for (var j = 0; j < subMenu.length; j++) {
                    if (currentPage == subMenu[j]['url']) {
                        ulTagStr = '<ul class="lnb-sub" style="display: block;">'; // Selected.
                        liTagStr = '<li class="selected">' // Selected.
                    } else {
                        liTagStr = '<li>'; // Not Selected.
                    }
                    subMenuStr += liTagStr;
                    subMenuStr += '<a href="' + subMenu[j]['url'] + '/">' + subMenu[j]['value'] + '</a></li>';
                }
                $('#menu_list').append('<li><a href="#">' + menu_list[i]['value'] + '</a>' + ulTagStr + subMenuStr + '</ul></li>');
            }

        	//left sub menu toggle
            var lnbSub = $('nav > ul > li');
            $(lnbSub).find('.lnb-sub').parent().addClass('expandable');
            $(lnbSub).children('ul').find('.selected').parent().parent().addClass('expanded');

            if($(lnbSub).hasClass('expandable')){
                var lnbSubExpand = $('nav > ul > li.expandable > a');
                $(lnbSubExpand).click(function(e){
                    e.preventDefault();
                    $(this).parent().find('.lnb-sub').slideToggle();
                    $(this).parent().toggleClass('expanded');
                    $(this).toggleClass('selected');
                });
            };
        } // success
    });
};

// Deprecated
function toggleLeftMenu() {
    // Left Menu Toggle(접기/펼치기)
    var btnToggle = $('.Button.btn-toggle');

	$(btnToggle).click(function(e){
		e.preventDefault();
		if(btnToggle.hasClass('lnb-close')){
			$(this).parent().parent().addClass('close');
			$(this).parents().find(".lnb-wrap").addClass('close');
			$(this).parents().find(".privacy-wrap").addClass('close');
			$(this).removeClass('lnb-close').addClass('lnb-open');
			$(this).text('펼치기');
			$('.alopexgrid').alopexGrid("viewUpdate");
		} else if(btnToggle.hasClass('lnb-open')){
			$(this).parent().parent().removeClass('close');
			$(this).parents().find(".lnb-wrap").removeClass('close');
			$(this).parents().find(".privacy-wrap").removeClass('close');
			$(this).removeClass('lnb-open').addClass('lnb-close');
			$(this).text('접기');
		};
	});

    return;
};

// Deprecated
function toggleQuickMenu() {
	// quick toggle
	var quickWrap = $('.quick-wrap');
	var quickToggle = $('.quick-toggle');
	$(quickToggle).click(function(e){
		e.preventDefault();
		if(quickWrap.hasClass('close')) {
			$(quickWrap).removeClass('close');
			$(this).children('a').text('Quick Link');
		} else {
			$(quickWrap).addClass('close');
			$(this).children('a').text('QL');
		}
	});

    return;
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