var g_task_page     = 1;
var g_task_per_page = 10;
var g_hst_page      = 1;
var g_hst_per_page  = 10;

var g_task_id     = '';
var g_revision_no = '';

var switchery = null;

$a.page(function() {
	this.init = function() {
	    initGrid();
		setEventListener();
	};
});

function setEventListener() {

    // 검색조건 영역 초기화
    $('#btn_init').on('click', function(e) {
        $('.search_wrap .search_area_input .Textinput').val('');
    });

    // 조회
    $('#btn_sel').on('click', function() {
        g_task_page = 1;
        getTaskGridData();
        $('#hst_grid').alopexGrid('dataEmpty'); // Grid 초기화
        $('#hst_title').text("발행이력");
    });

    // 소유자 조회
    $('#btn_sel_owner_id').on('click', function() {
        let user_param = { user_id: $('#owner_id').val() };

        opme_searchUser('소유자 조회', 'single', user_param, function(user_info) {
            if (user_info.length == 1) {
                $('#owner_id').val(user_info[0]['id']);
            }
        });
    });

    // 발행자 조회
    /*
    $('#btn_sel_publisher_id').on('click', function() {
        let user_param = { user_id: $('#publisher_id').val() };

        opme_searchUser('발행자 조회', 'single', user_param, function(user_info) {
            if (user_info.length == 1) {
                $('#publisher_id').val(user_info[0]['id']);
            }
        });
    });
    */

    // Page 버튼을 클릭 했을 때 데이터 바인딩
    $('#task_grid').on('pageSet', function(e) {
        let evObj = AlopexGrid.parseEvent(e);
        g_task_page = evObj.page;
        getTaskGridData();
    });

    // 우측 하단 페이지 당 데이터 개수 설정하는 이벤트 바인딩
    $('#task_grid').on('perPageChange', function(e) {
        let evObj = AlopexGrid.parseEvent(e);
        g_task_page     = 1;
        g_task_per_page = evObj.perPage;
        getTaskGridData();
    });

    // 검색 버튼 'Enter' 처리
    $('.search_area_input').on('keyup', function(e) {
        if(e.keyCode == 13) { // 'Enter' Key
            g_task_page = 1;
            getTaskGridData();
        }
    });

    // Page 버튼을 클릭 했을 때 데이터 바인딩
    $('#hst_grid').on('pageSet', function(e) {
        let evObj = AlopexGrid.parseEvent(e);
        g_hst_page = evObj.page;
        getHstGridData();
    });

    // 우측 하단 페이지 당 데이터 개수 설정하는 이벤트 바인딩
    $('#hst_grid').on('perPageChange', function(e) {
        let evObj = AlopexGrid.parseEvent(e);
        g_hst_page     = 1;
        g_hst_per_page = evObj.perPage;
        getHstGridData();
    });

    // Grid 데이터 클릭 시 상세화면
    $('#task_grid').on('click', '.bodycell', function(e) {
        let dataObj = AlopexGrid.parseEvent(e).data;
        let rowData = $("#task_grid").alopexGrid( "dataGetByIndex" , { data: dataObj._index.data } );

        if (!rowData || !rowData['id']) {
            opme_message("알 수 없는 오류 : 태스크 정보를 확인할 수 없습니다.");
            return;
        }

        // read 권한 없는 경우, 선택불가
        let read = rowData['permMode'].charAt(0);
        if (read != 'r') {
            return;
        }

        g_hst_page = 1;
        g_task_id  = rowData['id'];

        // 우측 Grid Title 에 Task ID 표기.
        $('#hst_title').text(g_task_id + " 발행이력");
        // dblclick 데이터를 선택된 상태로 변경.
        $('#task_grid').alopexGrid('rowSelect', { _index: dataObj._index }, true);

        getHstGridData();
    });

    // 비교
    $('#btn_diff').on('click', function(e) {
        let taskInfo = $('#task_grid').alopexGrid( 'dataGet' , { _state : { selected : true } } );// 선택된 데이터

        if (taskInfo.length != 1) {
            opme_message("[태스크] 목록에서 태스크를 선택해 주세요.");
            return;
        }

        let hstInfo = $('#hst_grid').alopexGrid( 'dataGet' , { _state : { selected : true } } );// 선택된 데이터
        if (hstInfo.length != 1) {
            opme_message("[발행이력] 목록에서 이력을 선택해 주세요.");
            return;
        }

        // if (taskInfo[0].id != hstInfo[0].id) {
        //     opme_message("[발행이력] " + hstInfo[0].revNo + "는(은) 선택된 태스크(" + taskInfo[0].id + ")의 발행이력이 아닙니다.");
        //     return;
        // }

        // console.log(AlopexGrid.trimData(taskInfo));
        // console.log(AlopexGrid.trimData(hstInfo));
        // $a.close({ 'id': hstInfo[0].id, "revNo": hstInfo[0].revNo });
        $a.close({ 'id': taskInfo[0].id, "revNo": hstInfo[0].revNo });
        return;
    });

    // 닫기
    $("#btn_close").on("click", function(e) {
        $a.close();
    });

    // switch button
    switchery = new Switchery(document.querySelector('#taskChecker'));
};

function initGrid() {

    // 태스크 그리드 초기화
    $('#task_grid').alopexGrid({
        height: 501,
        rowSelectOption: {
		    clickSelect : true,
		    singleSelect: true,
		    radioColumn : true,
	    },
	    rowOption: {
	        allowSelect: function (data) {
	            let read = data.permMode.charAt(0);

	            if (read != 'r') {
	                return false;
	            }
	            return true;
	        },
	        styleclass: function (data) {
	            let read = data.permMode.charAt(0);

	            if (read != 'r') {
	                return "grid_disable_row";
	            }
	            return null;
	        }
	    },
        pager : true,
        paging: {
            perPage    : 10,
            pagerCount : 5,
            pagerSelect: true,
            pagerTotal : true
        },
        columnMapping: [
            {
                align          : 'center',
                key            : 'check',
                width          : '50px',
                title          : "",
                selectorColumn : true,
                excludeFitWidth: true,
                resizing       : false,
            }, {
                align   : 'left',
                key     : 'id',
                title   : '태스크 ID',
                // width   : '60px',
                readonly: true,
            }, {
                align : 'center',
                key   : 'revNo',
                title : 'Rev No.',
                width : '60px',
                render: function (value, data, render, mapping, grid) {
                    if (value == 0) return '미발행';
                    return value;
                }
            }, {
                align: 'center',
                key  : 'ownerUserId',
                title: '소유자 ID',
                width: '60px',
            }, {
                align: 'center',
                key  : 'permMode',
                title: '권한',
                width: '60px',
            //}, {
            //    align       : 'center',
            //    key         : 'publishDate',
            //    title       : '발행일자',
            //    width       : '250px',
            //    defaultValue: "-",
            //    render      : function(value, data, render, mapping, grid) {
            //        return opme_formatUTCString(value);
            //    }
            },
        ],
    });

    // 리비전 그리드 초기화
    $('#hst_grid').alopexGrid({
        height: 501,
        rowSelectOption: {
		    clickSelect : true,
		    singleSelect: true,
		    radioColumn : true,
	    },
        pager : true,
        paging: {
            perPage    : 10,
            pagerCount : 5,
            pagerSelect: true,
            pagerTotal : true
        },
        columnMapping: [
            {
                align          : 'center',
                key            : 'check',
                width          : '50px',
                title          : "",
                selectorColumn : true,
                excludeFitWidth: true,
                resizing       : false,
            }, {
                align          : 'center',
                key            : 'revNo',
                title          : 'Rev No.',
                width          : '60px',
                excludeFitWidth: true,
                render         : function(value, data, render, mapping, grid) {
                    if (value == 0) return '미발행';
                    return value;
                }
            }, {
                align: 'center',
                key  : 'ownerUserId',
                title: '소유자 ID',
            //  width: '60px',
            }, {
                align       : 'center',
                key         : 'publishDate',
                title       : '발행일자',
                width       : '250px',
                defaultValue: "-",
                render      : function(value, data, render, mapping, grid) {
                    return opme_formatUTCString(value);
                }
            }, {
                align: 'left',
                key  : 'description',
                title: '설명',
                width: '200px',
            },
        ],
    });

    getTaskGridData();
};

// 유효성 검사
function validate() {

    if (g_task_id == '') {
        opme_message('[태스크] 를 선택하세요.');
        return false;
    }

    return true;
};

function getTaskGridData() {

    let data = {
        page      : g_task_page,
        perPage   : g_task_per_page,
        id        : $('#task_id').val(),
        owner_id  : $('#owner_id').val(),
        publish_id: '', // $('#publisher_id').val(),
        permitted_id : document.querySelector('#taskChecker').checked?g_login_id_p:'',
        rev_zero  : ''
    };

    return $.ajax({
        url        : '/task/list',
        type       : 'POST',
        dataType   : 'json',
        data       : JSON.stringify(data),
        contentType: 'application/json',
        success    : function(result) {

            if (result['resultCode'] == 'EM0999') {
                opme_message('[' + result['resultCode'] + '] ' + result['resultMsg']);
                return;
            }

            let serverPageInfo = {
                'dataLength': result['totalCnt'], //총 데이터 길이
                'current'   : g_task_page, //현재 페이지 번호. 서버에서 받아온 현재 페이지 번호를 사용한다.
                'perPage'   : g_task_per_page || 10 //한 페이지에 보일 데이터 갯수
            };

            $('#task_grid').alopexGrid('dataSet', result['taskList'], serverPageInfo);
        }
    });
};

function getHstGridData() {

    if (validate() == false) return false;

    let data = {
        page   : g_hst_page,
        perPage: g_hst_per_page,
        task_id: g_task_id,
    };

    return $.ajax({
        url        : '/publist/add_zero_rev',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        contentType: "application/json",
        success    : function(result) {

            if (result['resultCode'] == 'EM0999') {
                opme_message("[" + result['resultCode'] + "] " + result['resultMsg']);
                return;
            }

            let serverPageInfo = {
                dataLength: result['totalCnt'], //총 데이터 길이
                current   : g_hst_page, //현재 페이지 번호. 서버에서 받아온 현재 페이지 번호를 사용한다.
                perPage   : g_hst_per_page || 10 //한 페이지에 보일 데이터 갯수
            };

            $('#hst_grid').alopexGrid('dataSet', result['revisionList'], serverPageInfo);
        }
    });
};
