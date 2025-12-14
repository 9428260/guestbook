$a.page(function() {
	this.init = function(id, param) {
	    initGrid();
	    initCombo();
		setEventListener();
	};
});

function setEventListener() {
    //next 버튼 클릭 이벤트 핸들러
    $('#btn_sel').on('click', function() {
        getGridData(1, $("#code_gr").alopexGrid('pageInfo').perPage);
    });

    // 검색조건 영역 초기화
    $("#btn_init").on("click", function(e){
        $(".search_wrap .baba2 .Textinput").val('');
        $(".search_wrap .baba2 .Select").val('all');
    });
};

function initGrid() {
    // 사용자 그리드 초기화
    $('#code_gr').alopexGrid({
        height: 501,
        autoColumnIndex: true,
        pager: true,
        paging: {
            perPage: 10,
            pagerCount: 5,
            pagerSelect: true,
            pagerTotal: true
        },
        defaultColumnMapping: {
            resizing: true
        },
        autoColumnIndex: true,
        columnMapping : [
            {
                align : 'center',
                key : 'check',
                width : '30px',
                selectorColumn : true
            }, {
                key : 'k',
                title : 'key',
                //width : '100px',
                hidden : true,
            }, {
                key : 'user_id',
                title : '사용자 ID',
                width : '100px',
            }, {
                key : 'user_nm',
                title : '사용자 이름',
                width : '100px',
            }, {
                key : 'role',
                title : '사용자 권한',
                width : '100px',
            },
        ],
    });
}

var status_dict = {};

function initCombo() {
    var role_data = [{key:"all", value:"ALL"}, {key:"0", value:"Admin"},{key:"4", value:"User"}];
    $('#role').setData({
        data: role_data,
        option_selected: '0' // 최초 선택값 설정
    });

    return $.ajax({
        url: '/sample/rest/init',
        type: "POST",
        dataType: "json",
        success : function(status_list){
            // Convert Array to Dictionary
            for(let idx in status_list){
                status_dict[status_list[idx]['key']] = status_list[idx]['value'];
            }

            // console.log(status_data);
            // console.log(status_dict);

            $('#status').setData({
                data: status_list,
                option_selected: status_list[0]['key'] // 최초 선택값 설정
            });
        }
    });
}

function getGridData(page, perPage) {
    var data = {
        page: page,
        perPage: perPage,
        user_id: $("#user_id").val(),
        user_status: $("#status").val(),
    };

    return $.ajax({
        url: '/sample/rest/list',
        type: "POST",
        dataType: "json",
        data : JSON.stringify(data),
        contentType: "application/json",
        success : function(data){

            var serverPageInfo = {
                dataLength : data['dataLength'], //총 데이터 길이
                current : page, //현재 페이지 번호. 서버에서 받아온 현재 페이지 번호를 사용한다.
                perPage : perPage || 10 //한 페이지에 보일 데이터 갯수
            };

            $('#code_gr').alopexGrid('dataSet', data['data'], serverPageInfo);
        }
    });
}