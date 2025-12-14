var g_task_id = request_params['task_id']; // task id (before changed)
var is_change = false;
var g_grid_scroll_cnt = 10;
var g_latest_revision = 0;

var g_entity_type_arr = [];
var g_encoding_arr    = [];
var g_time_unit_arr   = [];
var g_task_result_arr = [];
var g_tag_origin_arr  = [];
var g_tag_origin_dict = {};
var g_notilist_event_arr = [];
var g_notilist_event_dict = {};
var g_notilist_method_arr = [];

var g_editor;           // textarea editor (codemirror)
var g_editor2;          // textarea editor (codemirror) (for Diff)
var g_script_line_sep;  // Script Line Separator

// Grid Search, Filter, Excel
var g_grid_search  = 0; // 0: init, 1: searching
var g_grid_search2 = 0; // 0: init, 1: searching
var g_search_old;
var g_search_new;
var g_search_old2;
var g_search_new2;
var g_filtered  = false;
var g_filtered2 = false;

$a.page(function(){
	this.init = function(id, param) {

        let isReadOnly = false;

        // revision_no 가 '0' 이 아니고, 미발행 버전이 기 존재
        if (typeof response !== "undefined" && response['revNo'] != '0' && response['draftExist'] == 'Y') {
            isReadOnly = true;
        }

        if (typeof response !== "undefined" && response["is_read_only"]) {
            isReadOnly = true;
        }

	    initCombo();
	    initGrid(isReadOnly);
	    initData(isReadOnly);
		setEventListener(isReadOnly);
	};
});

function setEventListener(isReadOnly) {

    // Folding table_wrap class
    setFoldInfoEvent();

    // 태스크 비교(Diff)
    $('#btn_diff').on('click', function(e) {
        selectTaskForDiff();
        return;
    });

    // 태스크 비교 닫기(Diff close)
    $('#btn_diff_close').on('click', function(e) {
        closeDiffData();
        return;
    });

    // 태스크 ID 유효성 체크
    $('#btn_check_id').on('click', function(e) {
        checkId();
    });

    // 태스크 ID 변경 여부 확인
    $('#id').on('propertychange change keyup paste input', function(e) {
        $(this).attr("data-check-result", "fail");

        let prev_task_id = '';
        if (typeof response['id'] !== 'undefined') {
            prev_task_id = response['id'];
        }

        if (prev_task_id == $('#id').val()) {
            $(this).attr("data-check-result", "ok");
            $("#btn_check_id").setEnabled(false);
            is_change = false;
            return;
        }

        $("#btn_check_id").setEnabled(true);
        is_change = true;
    });

    // '수정' 처리 인 경우
    if (g_task_id != '' && !isReadOnly) {

        // Owner ID 조회
        $('#btn_sel_owner_id, #owner_id').on('click', function(e) {
            selectOwner();
            return;
        });
    }

    // Publisher ID 조회
    $('#btn_sel_publish_id, #publish_id').on('click', function(e) {

        if (isReadOnly) return;

        selectPublisher();
        return;
    });

    // 스크립트 불러오기
    $('#btn_load_script').on('click', function(e) {

        if (!validateInput($("#script_separator"))) return false;
        if (!validateInput($("#script_encoding")))  return false;

        // <input type="file"/> 생성 후, click 이벤트 발생.
        let input = document.createElement('input');

        input.type   = 'file';
        input.accept = 'text/x-sh,.bat,.vbs,.ps1'; // OPMM 수행가능 확장자

        input.click();
        input.onchange = function(event) {
            readLocalFile(event.target.files[0]);
            $("#script_name").val(event.target.files[0]["name"]);
            $("#script_name").blur();
        };

        return;
    });

    // 스크립트 Clipboard 복사
    $('#btn_copy_script').on('click', function(e) {
        opme_message("[스크립트 내용] UTF-8 Encoding 으로 클립보드에 복사완료"
                    , opme_copyClipboard(g_editor.getValue()));
        // opme_message("[스크립트 내용] UTF-8 Encoding 으로 클립보드에 복사완료", function () {
        //     let data = g_editor.getValue();
        //     navigator.clipboard.writeText(data);
        // });

        return;
    });

    // 스크립트 Clipboard 복사(for Diff)
    $('#btn_copy_script2').on('click', function(e) {
        opme_message("[스크립트 내용] UTF-8 Encoding 으로 클립보드에 복사완료"
                    , opme_copyClipboard(g_editor2.getValue()));

        return;
    });

    // 파일 인코딩 변경 시에 인코딩에 따라서 reload.
    $('#script_encoding').on('blur', function(e) {
        // changeEncoding();
        is_change = true;
        return;
    });

    // 파일 형식(Windows/Linux) 변경 시에 Line Separator 에 따라서 reload.
    $('#script_separator').on('blur', function(e) {
        changeLineSeparator();
        is_change = true;
        return;
    });

    // 실행대상정보 추가 버튼
    $('#btn_add_nodeset').on('click', function(e) {
        //레이어 팝업
        addNodeSet();
        return;
    });

    // 실행대상정보 삭제 버튼
    $('#btn_del_nodeset').on('click', function(e) {
        delNodeSet();
        return;
    });

    // 실행대상정보 데이터 더블 클릭 시 상세화면
    $('#target_grid').on('dblclick', '.bodycell', function(e) {
        // NodeSet Grid 내용 조회시 Hostname 목록 조회가 추가 되면서 edit 가 안되도록 isReadOnly = true로 변경
        //editNodeSet(e, isReadOnly);
        editNodeSet(e, true);
        return;
    });

    // 실행대상정보2 데이터 더블 클릭 시 상세화면
    $('#target_grid2').on('dblclick', '.bodycell', function(e) {
        editNodeSet(e, true);
        return;
    });

    // 실행대상 target_grid 검색
    $('#btn_search').on('click', function() {
        searchGridData('startSearch', 'left')
    });

    $('#btn_next').on('click', function() {
        searchGridData('searchNext', 'left')
    });

    $('#btn_prev').on('click', function() {
        searchGridData('searchPrevious', 'left')
    });

    $('#btn_end').on('click', function() {
        $('#search_keyword').val('');
        searchGridData('endSearch', 'left')
    });

    // 실행대상 태스크 비교 target_grid2 검색
    $('#btn_search2').on('click', function() {
        searchGridData('startSearch', 'right')
    });

    $('#btn_next2').on('click', function() {
        searchGridData('searchNext', 'right')
    });

    $('#btn_prev2').on('click', function() {
        searchGridData('searchPrevious', 'right')
    });

    $('#btn_end2').on('click', function() {
        $('#search_keyword2').val('');
        searchGridData('endSearch', 'right')
    });

    // Grid 검색 버튼 'Enter' 처리
    $(".grid_search_input .Textinput").on('keyup', function(e) {
        if (e.keyCode == 13) { // 'Enter' Key
            let grid_search;
            let command = "";
            let area    = "";
            if (this.id == 'search_keyword') {
                grid_search = g_grid_search;
                g_search_new = $('#search_keyword').val();
                area        = 'left';
            }

            if (this.id == 'search_keyword2') {
                grid_search  = g_grid_search;
                g_search_new2 = $('#search_keyword2').val();
                area         = 'right';
            }

            if (grid_search == 0) {
                command = 'startSearch';
            } else {
                if (area == 'left') {
                    if (g_search_old != g_search_new) {
                        command = 'startSearch';
                    }else{
                        command = 'searchNext';
                    }
                }

                if (area == 'right'){
                    if (g_search_old2 != g_search_new2) {
                        command = 'startSearch';
                    }else{
                        command = 'searchNext';
                    }
                }
            }
            searchGridData(command, area);
        }
    });

    $("#target_grid").on('filterChangeEnd', function(e) {
        // Grid 검색 중, Filter 적용하는 경우. 검색을 다시 시작한다.
        if (g_grid_search == 1 && $('#search_keyword').val() != '') {
            searchGridData('endSearch'  , 'left');
            searchGridData('startSearch', 'left');
        }

        let evObj = AlopexGrid.parseEvent(e);
        if (evObj.targetColumnFilterOption == null) {
            g_filtered = false;
        } else {
            g_filtered = true;
        }
    });

    $("#target_grid2").on('filterChangeEnd', function(e) {
        // Grid 검색 중, Filter 적용하는 경우. 검색을 다시 시작한다.
        if (g_grid_search2 == 1 && $('#search_keyword2').val() != '') {
            searchGridData('endSearch'  , 'right');
            searchGridData('startSearch', 'right');
        }

        let evObj = AlopexGrid.parseEvent(e);
        if (evObj.targetColumnFilterOption == null) {
            g_filtered2 = false;
        } else {
            g_filtered2 = true;
        }
    });

    // 스케줄 추가 버튼
    $('#btn_add_schedule').on('click', function(e) {
        addSchedule();
        return;
    });

    // 스케줄 삭제 버튼
    $('#btn_del_schedule').on('click', function(e) {
        $('#schedule_grid').alopexGrid('dataDelete', {_state: {selected: true}}, {_state: {deleted: false}});
        $('#schedule_grid').alopexGrid('rowSelect' , {_state: {selected: true}}, false);
        return;
    });

    // 실행가능시간 추가 버튼
    $('#btn_add_runnable_time').on('click', function(e) {
        addRunnableTime();
        return;
    });

    // 실행가능시간 삭제 버튼
    $('#btn_del_runnable_time').on('click', function(e) {
        $('#runnable_time_grid').alopexGrid('dataDelete', {_state: {selected: true}}, {_state: {deleted: false}});
        $('#runnable_time_grid').alopexGrid('rowSelect' , {_state: {selected: true}}, false);
        return;
    });

    // 트리거 추가 버튼
    $('#btn_add_trigger').on('click', function(e) {
        addTrigger();
        return;
    });

    // 트리거 삭제 버튼
    $('#btn_del_trigger').on('click', function(e) {
        $('#trigger_grid').alopexGrid('dataDelete', {_state: {selected: true}}, {_state: {deleted: false}});
        $('#trigger_grid').alopexGrid('rowSelect' , {_state: {selected: true}}, false);
        return;
    });

    // 사용자 추가 버튼
    $('#btn_add_user').on('click', function(e) {
        addPermissionUser();
        return;
    });

    // 사용자그룹 추가 버튼
    $('#btn_add_usergrp').on('click', function(e) {
        addPermissionUserGroup();
        return;
    });

    // 태스크 추가 버튼
    $('#btn_add_task').on('click', function(e) {
        addPermissionTask();
        return;
    });

    // Grid Permission(Row) 삭제 버튼
    $('#btn_del_permission').on('click', function(e) {
        delPermission();
        return;
    });

    // 알림목록 추가 버튼
    $('#btn_add_notilist').on('click', function(e) {
        addNotilist();
        return;
    });

    // 알림목록 삭제 버튼
    $('#btn_del_notilist').on('click', function(e) {
        $('#notilist_grid').alopexGrid('dataDelete', {_state: {selected: true}}, {_state: {deleted: false}});
        $('#notilist_grid').alopexGrid('rowSelect' , {_state: {selected: true}}, false);
        return;
    });

    // 수정여부 체크
    $('#base_info td').on("change", function(e) {
        is_change = true;
        return;
    });

    $('#script_info td').on("change", function(e) {
        is_change = true;
        return;
    });

    g_editor.on("focus", function(cMirror) {
        return validateScript();
    });

    g_editor.on("change", function(cMirror) {
        is_change = true;
        return;
    });

    $('#target_info #target_grid').on("dataAddEnd dataEditEnd dataDeleteEnd cellValueChanged", function(e) {
        resizeVerticalLine();

        if (e.type != "cellValueChanged") {
            is_change = true;
            return;
        }

        // cellValueChanged
        let gridObject = AlopexGrid.parseEvent(e);
        if (typeof gridObject.prevValue == "undefined" && gridObject.value == "") {
            return;
        }

        if (typeof gridObject.prevValue == "boolean" && typeof gridObject.value == "boolean") {
            // check box 변경 skip.
            return;
        }

        if (gridObject.prevValue == gridObject.value) {
            return;
        }

        is_change = true;
        return;
    });

    $('#schedule_info #schedule_grid').on("dataDeleteEnd dataAddEnd", function(e) {
        is_change = true;
        resizeVerticalLine();
        return;
    });

    $('#runnable_time_info #runnable_time_grid').on("dataDeleteEnd dataAddEnd", function(e) {
        is_change = true;
        resizeVerticalLine();
        return;
    });

    $('#trigger_info #trigger_grid').on(
    //  "dataAddEnd dataDeleteEnd dataEditEnd cellInlineEditEnd", function(e) {
        "dataAddEnd dataDeleteEnd cellValueChanged", function(e) {

        resizeVerticalLine();

        if (e.type != "cellValueChanged") {
            is_change = true;
            return;
        }

        // cellValueChanged
        let gridObject = AlopexGrid.parseEvent(e);
        if (typeof gridObject.prevValue == "undefined" && gridObject.value == "") {
            return;
        }

        if (typeof gridObject.prevValue == "boolean" && typeof gridObject.value == "boolean") {
            // check box 변경 skip.
            return;
        }

        if (gridObject.prevValue == gridObject.value) {
            return;
        }

        is_change = true;
        return;
    });

    $('#permission_info #permission_grid').on("dataDeleteEnd dataAddEnd", function(e) {
        is_change = true;
        resizeVerticalLine();
        return;
    });

    // cellBody checkbox 를 변경한다.
    $('#permission_grid').on('cellValueEditing', function(e) {
        let gridObject      = AlopexGrid.parseEvent(e);
        let permission_grid = gridObject.$grid;
        let col_key         = gridObject.mapping.key;
        // let column_index    = gridObject.mapping.columnIndex;
        // let col_data        = permission_grid.alopexGrid("columnDataGet", col_key);
        let row_data        = gridObject.data;
        let checked         = AlopexGrid.currentValue(row_data, 'all');
        is_change = true;

        // 전체선택 checkbox 클릭시 우측 데이터 권한 설정
        if (col_key == 'all') {
            if (checked == 'T') {
                permission_grid.alopexGrid('cellEdit', 'r', { _index: { row: row_data._index.row } }, 'read');
                permission_grid.alopexGrid('cellEdit', 'w', { _index: { row: row_data._index.row } }, 'write');
                permission_grid.alopexGrid('cellEdit', 'x', { _index: { row: row_data._index.row } }, 'execute');
            } else {
                permission_grid.alopexGrid('cellEdit', '-', { _index: { row: row_data._index.row } }, ['read', 'write', 'execute']);
            }
        }
        return;
    });

    $('#notilist_info #notilist_grid').on("dataDeleteEnd dataAddEnd", function(e) {
        is_change = true;
        resizeVerticalLine();
        return;
    });

    // 목록 버튼
    $('#btn_list').on('click', function(e) {
        /*
           cellValueChanged 이벤트 발생시켜서 is_change 를 True 로 변경하고, -- endEdit
           다시 Editable 상태로 만든다.                                    -- startEdit
        */
        // - endEdit
        $('#target_grid' ).alopexGrid('endEdit');
        $('#trigger_grid').alopexGrid('endEdit');
        // - startEdit
        $('#target_grid' ).alopexGrid('startEdit');
        $('#trigger_grid').alopexGrid('startEdit');

        if (is_change == true) {
            if (!confirm("변경하신 내용을 저장하지 않고, 이동하시겠습니까?")) {
                return;
            }
        }
        opme_postWithParam('/task/', request_params);
        return;
    });

    // 저장 버튼
    $('#btn_save').on('click', function(e) {
        /*
           cellValueChanged 이벤트 발생시켜서 is_change 를 True 로 변경하고, -- endEdit
           다시 Editable 상태로 만든다.                                    -- startEdit
        */
        // - endEdit
        $('#target_grid' ).alopexGrid('endEdit');
        $('#trigger_grid').alopexGrid('endEdit');
        $('#notilist_grid').alopexGrid('endEdit');
        // - startEdit
        $('#target_grid' ).alopexGrid('startEdit');
        $('#trigger_grid').alopexGrid('startEdit');
        $('#notilist_grid').alopexGrid('startEdit');

        if (is_change == false) {
            opme_message("변경하신 내용이 없습니다.");
            return;
        }

        let result = validate();

        if (result != true) {
            let msg = "[Invalid] 입력 하신 내용을 확인해 주세요.";
            if (result != false) msg = result;

            opme_message(msg);
            return;
        }

        if (confirm("저장 하시겠습니까??")) {
            saveData();
        }

        return;
    });

    // 발행 버튼
    $('#btn_publish').on('click', function(e) {
        /*
           cellValueChanged 이벤트 발생시켜서 is_change 를 True 로 변경하고, -- endEdit
           다시 Editable 상태로 만든다.                                    -- startEdit
        */
        // - endEdit
        $('#target_grid' ).alopexGrid('endEdit');
        $('#trigger_grid').alopexGrid('endEdit');
        // - startEdit
        $('#target_grid' ).alopexGrid('startEdit');
        $('#trigger_grid').alopexGrid('startEdit');

        let msg = "";
        if (is_change == true) {
            msg = "변경하신 내용을 저장하지 않고, 발행 하시겠습니까?";
        } else {
            msg = "현재 정보로 발행 하시겠습니까??";
        }

        if (!confirm(msg)) {
            return;
        }
       /*
          OPMM TCS 활성화 추가
        */
        if (tcs_verify_enable == 'yes') {
            popupTcsOtp();
        } else {
            publishTask();
        }

        return;
    });

    // 폐기 버튼
    $('#btn_discard').on('click', function(e) {
        if (confirm("수정 중인 정보를 폐기 하시겠습니까?")) {
            discardTask();
        }
        return;
    });

    // 모의실행 버튼
    $('#btn_dry_run').on('click', function(e) {
        /*
           cellValueChanged 이벤트 발생시켜서 is_change 를 True 로 변경하고, -- endEdit
           다시 Editable 상태로 만든다.                                    -- startEdit
        */
        // - endEdit
        $('#target_grid' ).alopexGrid('endEdit');
        $('#trigger_grid').alopexGrid('endEdit');
        // - startEdit
        $('#target_grid' ).alopexGrid('startEdit');
        $('#trigger_grid').alopexGrid('startEdit');

        if (is_change == true) {
            if (!confirm("저장하지 않은 내용이 존재합니다.\n기존 저장 내용으로 모의실행 하시겠습니까?")) {
                return;
            }
        }

        let param = {
            'task_id': response['id'],
            'rev_no' : response['revNo'],
        };
        popupDryrun(param);

        return;
    });

    // target_grid 의 태그 mouseover 시에 table 로 구조화해서 출력
    $('#target_grid').on('mouseover', '.bodycell', function(e) {
        let dataObj = AlopexGrid.parseEvent(e).data;
        // tag 컬럼이 아닌 경우
        if (dataObj._index.column != 5) {
            return;
        }

    	let rowData = $("#target_grid").alopexGrid( "dataGetByIndex" , { data : dataObj._index.data });
        let value   = rowData.tag;
    	if (value == null || value == '' || Object.keys(value).length == 0) {
    	    return;
    	}

    	let tag_dict    = opme_strToDict(value);
    	let tooltip_id  = "tag_tooltip";
    	let tag_tooltip = '<table class="Table Form-type"><tr><th>시스템구분</th><th>태그 키(Key)</th><th>태그 값(Value)</th></tr>';
    	for (let prop in tag_dict) {
            let idx = prop.indexOf(".");
    	    if (idx == -1) {
    	        opme_message("[태그] 형식 오류 입니다.");
    	        return;
    	    }

    	    let origin = prop.substring(0, idx);
    	    let key    = prop.substring(idx+1);
    	    tag_tooltip += "<tr><td>" + g_tag_origin_dict[origin] + "</td><td>" + key + "</td><td>" + tag_dict[prop] + "</td></tr>";
        }
    	tag_tooltip += "</table>";

    	// this 에 append 하면, 부모 relative 때문에 Cell 영역을 벗어나서 출력할 수 없음.
        $("body").append('<div id="' + tooltip_id + '" class="grid_tooltip">' + tag_tooltip + '</div>');
    	$("#" + tooltip_id).css('top' , e.pageY + 10);
    	$("#" + tooltip_id).css('left', e.pageX + 10);

        // let $tag_element = $('#target_grid').alopexGrid('cellElementGet', {_index: {data: rowData._index.row}}, 'tag').on("mouseover", function(e) {
        let $tag_element = $(this).on("mouseover", function(e) {
    	    $(this).attr('title', ''); // 기존 tooltip 제거
    	}).on("mouseout", function() {
    	    $("#" + tooltip_id).remove();
    	}).on("mousemove", function(e) {
    	    // mouse cursor 를 따라서 tooltip 이 이동함.(10px 간격을 두고 이동)
    	    $("#" + tooltip_id).css('top' , e.pageY + 10);
    	    $("#" + tooltip_id).css('left', e.pageX + 10);
    	});
    });

    // target_grid2 의 tag mouseover 시에 table 로 구조화해서 출력
    $('#target_grid2').on('mouseover', '.bodycell', function(e) {
        let dataObj = AlopexGrid.parseEvent(e).data;
        // tag 컬럼이 아닌 경우
        if (dataObj._index.column != 4) {
            return;
        }

    	let rowData = $("#target_grid2").alopexGrid( "dataGetByIndex" , { data : dataObj._index.data });
        let value   = rowData.tag;
    	if (value == null || value == '' || Object.keys(value).length == 0) {
    	    return;
    	}

    	let tag_dict    = opme_strToDict(value);
    	let tooltip_id  = "tag_tooltip2";
    	let tag_tooltip = '<table class="Table Form-type"><tr><th>시스템구분</th><th>태그 키(Key)</th><th>태그 값(Value)</th></tr>';
    	for (let prop in tag_dict) {
            let idx = prop.indexOf(".");
    	    if (idx == -1) {
    	        opme_message("[태그] 형식 오류 입니다.");
    	        return;
    	    }

    	    let origin = prop.substring(0, idx);
    	    let key    = prop.substring(idx+1);
    	    tag_tooltip += "<tr><td>" + g_tag_origin_dict[origin] + "</td><td>" + key + "</td><td>" + tag_dict[prop] + "</td></tr>";
        }
    	tag_tooltip += "</table>";

    	// this 에 append 하면, 부모 relative 때문에 Cell 영역을 벗어나서 출력할 수 없음.
        $("body").append('<div id="' + tooltip_id + '" class="grid_tooltip">' + tag_tooltip + '</div>');
    	$("#" + tooltip_id).css('top' , e.pageY + 10);
    	$("#" + tooltip_id).css('left', e.pageX + 10);

        // let $tag_element = $('#target_grid').alopexGrid('cellElementGet', {_index: {data: rowData._index.row}}, 'tag').on("mouseover", function(e) {
        let $tag_element = $(this).on("mouseover", function(e) {
    	    $(this).attr('title', ''); // 기존 tooltip 제거
    	}).on("mouseout", function() {
    	    $("#" + tooltip_id).remove();
    	}).on("mousemove", function(e) {
    	    // mouse cursor 를 따라서 tooltip 이 이동함.(10px 간격을 두고 이동)
    	    $("#" + tooltip_id).css('top' , e.pageY + 10);
    	    $("#" + tooltip_id).css('left', e.pageX + 10);
    	});
    });

    $('#btn_export').on('click', function(e){
        opme_exportExcel('task_dtl','Execution Target Information', 'target_grid', g_filtered);
    });

    $('#btn_export2').on('click', function(e){
        opme_exportExcel('task_dtl','Execution Target Information', 'target_grid2', g_filtered2);
    });
};

// 공통코드 조회
function initCombo() {
    let result = opme_getCode(['common_entity_type'
                             , 'common_separator'
                             , 'common_encoding'
                             , 'common_time_unit'
                             , 'common_result'
                             , 'node_tag_origin'
                             , 'notilist_event'
                             , 'notilist_method']);
    if (result == false) return;

    g_entity_type_arr = result['common_entity_type'];
    g_separator_arr   = result['common_separator'];
    g_encoding_arr    = result['common_encoding'];
    g_time_unit_arr   = result['common_time_unit'];
    g_task_result_arr = result['common_result'];

    g_tag_origin_arr = result['node_tag_origin'];
    g_tag_origin_arr.forEach(function(item) {
        g_tag_origin_dict[item['value']] = item['text'];
    });

    g_notilist_event_arr = result['notilist_event'];
    g_notilist_event_arr.forEach(function(item) {
        g_notilist_event_dict[item['value']] = item['text'];
    });
    g_notilist_method_arr = result['notilist_method'];
    return;
};

// 초기 데이터 요청
function initData(isReadOnly) {

    let isReadOnlyForCodeMirror = false;

    if (isReadOnly) {
        isReadOnlyForCodeMirror = "nocursor";
    }

    // CodeMirror 에서 제공하는 Syntax 모드를 사용하기 위한 BaseURL(Jinja2) + 상세 URL
    if (!CodeMirror.modeURL.includes('%N/%N.js')) {
        CodeMirror.modeURL += '%N/%N.js';
    }

    let textarea = $('#script_content');
    
    // 기존 CodeMirror 인스턴스가 있으면 제거
    if (g_editor && typeof g_editor.toTextArea === 'function') {
        g_editor.toTextArea();
        g_editor = null;
    }
    
    g_editor = CodeMirror.fromTextArea(textarea[0], {
        lineNumbers  : true,
        lineWrapping : true,
        lineSeparator: g_script_line_sep,
        theme        : 'rubyblue', // 테마 변경 시에는 html 에서 테마에 해당하는 css 를 추가.
        readOnly     : isReadOnlyForCodeMirror,
        val          : textarea.val(),
        // autoRefresh  : true
    });
    g_editor.setSize(null, 500);

    // Self 발행 가능 여부 확인
    // * OPMM_PUBLISHER_SEPARATE_ENABLE
    //   - 'yes': Publisher is anyone except for myself
    //   - 'no' : Publisher is myself
    if (self_pub_enable == 'no') {
        $("#base_info tr:nth-child(4)").hide(); // publish_id
    }

    // create
    if (g_task_id == '') {
        $('#owner_id').val(login_id);
        $('#owner_id').prop('readonly', true);
        $("#btn_sel_owner_id").hide();

        $("#base_info tr:nth-child(2)").hide(); // Revision No.

        $('#script_separator').setData({
            data: g_separator_arr,
        });

        $('#script_encoding').setData({
            data: g_encoding_arr,
        });

        // revision_no 이 '0' 이 아닌 경우, "발행"/"폐기" 버튼 숨김 처리
        if (typeof response['revNo'] == 'undefined') {
            $('#btn_publish').hide(); // 'hide'
            $('#btn_discard').hide(); // 'hide'
            $('#btn_dry_run').hide(); // 'hide'
        }

        return;
    }

    // edit
    // ERROR
    if (response['resultCode'] != 'EM0000') {
        opme_message(response['resultMsg'], function() {
            opme_postWithParam('/task/', request_params);
        });
        return;
    }

    // base_info
    $('#id').val(response['id']);
    $('#owner_id').val(response['ownerUserId']);
    $('#owner_id').prop('readonly', true);
    if (self_pub_enable != 'no') {
        $('#publish_id').val(response['publishableUserId']);
    }
    $('#description').val(response['description']);
    if (response['draftExist'] == 'N') {
        $('#revision_no').text(response['revNo'] + ' (미발행 없음)');
    } else {
       if (response['revNo'] == '0') {
            $('#revision_no').text(response['revNo'] + ' (미발행)');
       } else {
            $('#revision_no').text(response['revNo'] + ' (미발행 존재)');
       }
    }
    //if (response['cutOffPeriod'].endsWith('m')) {
    //    // response['cutOffPeriod'] = 5m, 웹콘솔에선 m 떼기?
    //    $('#cutoffperiod').val(response['cutOffPeriod'].slice(0, -1));
    //} else {
    //    $('#cutoffperiod').val(response['cutOffPeriod']);
    //}
    $('#cutoffperiod').val(response['cutOffPeriod']);

    // script_info
    $('#script_name'   ).val(response['scriptName']);
    $('#script_account').val(response['scriptAccount']);
	  $('#script_description').val(response['scriptDescription']);
    $('#script_separator').setData({
        data           : g_separator_arr,
        option_selected: response['script_line_separator'] // 최초 선택값 설정.
    });

    $('#script_encoding').setData({
        data           : g_encoding_arr,
        option_selected: response['script_encode'] // 최초 선택값 설정.
    });

    if (response['script_encode'] != 'ascii') {
        $("#script_encoding option[value='ascii']").remove();
    }

    if (response['script_line_separator'] == 'LF') {
        g_script_line_sep = '\n'; // LF (Linux)
    } else {
        g_script_line_sep = '\r\n'; // CRLF (Windows)
    }
    g_editor.setOption("lineSeparator", g_script_line_sep);
    g_editor.setValue(decodeURIComponent(escape(atob(response['base64ScriptContent']))));
    g_editor.refresh();

    // CodeMirror Syntax Mode 변경.
    changeSyntaxMode(g_editor, $('#script_name').val());

    // target_info
    // - Dictionary to String : tag
    for (let i = 0; i < response['targetList'].length; i++) {
        if (jQuery.isEmptyObject(response['targetList'][i]['tag'])) {
            response['targetList'][i]['tag'] = "";
            continue;
        }
        response['targetList'][i]['tag'] = opme_dictToStr(response['targetList'][i]['tag']);
    }

    $('#target_grid').alopexGrid('dataSet', response['targetList']);
    $('#target_grid').alopexGrid('startEdit');

    // schedule_info
    $('#schedule_grid').alopexGrid('dataSet', response['scheduleList']);

    // runnable_time_info
    $('#runnable_time_grid').alopexGrid('dataSet', response['runnableTimeList']);

    // trigger_info
    $('#trigger_grid').alopexGrid('dataSet', response['trigList']);
    $('#trigger_grid').alopexGrid('startEdit');

    // permission_info
    $('#permission_grid').alopexGrid('dataSet', response['permissionList']);
    $('#permission_grid').alopexGrid('startEdit');

    // notilist_info
    $('#notilist_grid').alopexGrid('dataSet', response['notiList']);
    $('#notilist_grid').alopexGrid('startEdit');

    // Grid 데이터가 증가하면, height 를 고정시키고, Scroll 처리.
    let pageInfo = $('#target_grid').alopexGrid('pageInfo');
    if (pageInfo['dataLength'] > g_grid_scroll_cnt) {
        $("#target_grid").alopexGrid('updateOption', {height: '500px'});
    }

    pageInfo = $('#schedule_grid').alopexGrid('pageInfo');
    if (pageInfo['dataLength'] > g_grid_scroll_cnt) {
        $("#schedule_grid").alopexGrid('updateOption', {height: '500px'});
    }

    pageInfo = $('#runnable_time_grid').alopexGrid('pageInfo');
    if (pageInfo['dataLength'] > g_grid_scroll_cnt) {
        $("#runnable_time_grid").alopexGrid('updateOption', {height: '500px'});
    }

    pageInfo = $('#trigger_grid').alopexGrid('pageInfo');
    if (pageInfo['dataLength'] > g_grid_scroll_cnt) {
        $("#trigger_grid").alopexGrid('updateOption', {height: '500px'});
    }

    pageInfo = $('#permission_grid').alopexGrid('pageInfo');
    if (pageInfo['dataLength'] > g_grid_scroll_cnt) {
        $("#permission_grid").alopexGrid('updateOption', {height: '500px'});
    }

    pageInfo = $('#notilist_grid').alopexGrid('pageInfo');
    if (pageInfo['dataLength'] > g_grid_scroll_cnt) {
        $("#notilist_grid").alopexGrid('updateOption', {height: '500px'});
    }

    // history_info
    let history_info = $('#history_info table:first td');
    let crt_date     = opme_formatUTCString(response['crtDate']);
    let upd_date     = opme_formatUTCString(response['updDate']);

    let pub_date = "-";
    if (response['publishDate'] != null) pub_date = opme_formatUTCString(response['publishDate']);
    let pub_user = (response['publishUserId'] == null) ? '-' : response['publishUserId'];

    history_info.eq(0).text(response['crtUserId']);
    history_info.eq(1).text(crt_date);
    history_info.eq(2).text(response['updUserId']);
    history_info.eq(3).text(upd_date);
    history_info.eq(4).text(pub_user);
    history_info.eq(5).text(pub_date);
    $('#history_info').show(); // none

    // revision_no 이 '0' 이 아닌 경우, "발행"/"폐기" 버튼 숨김 처리
    if (response['revNo'] != '0') {
        $('#btn_publish').hide(); // 'hide'
        $('#btn_discard').hide(); // 'hide'
    }

    // revision_no 가 '0' 이 아니고, 미발행 버전이 기 존재
    // - "저장" 버튼 숨김 처리
    // - readonly
    if (isReadOnly) {
        $("#btn_save").hide(); // 'hide'
        $(".Textinput").prop("readonly", true);
        $(".table_wrap table button").hide();
        $(".with_btn").removeClass("with_btn");
        $("#script_separator,#script_encoding").setEnabled(false);
        $(".btn-add,.btn-del,.btn-user_add,.btn-usergrp_add").hide();
        $("#target_grid" ).alopexGrid("updateColumn", { editable: false }, ["account","description"]);
        $("#trigger_grid").alopexGrid("updateColumn", { editable: false }, ["taskResult","time","timeUnit"]);
        // $("#permission_grid").alopexGrid("updateOption", { readonlyRender: true });
        // $("#permission_grid").alopexGrid("updateOption", { cellInlineEdit: false });
        $("#permission_grid").alopexGrid("updateColumn", { render: $("#permission_grid").alopexGrid("columnInfo", "all"    )["editable"] }, "all"    );
        $("#permission_grid").alopexGrid("updateColumn", { render: $("#permission_grid").alopexGrid("columnInfo", "read"   )["editable"] }, "read"   );
        $("#permission_grid").alopexGrid("updateColumn", { render: $("#permission_grid").alopexGrid("columnInfo", "write"  )["editable"] }, "write"  );
        $("#permission_grid").alopexGrid("updateColumn", { render: $("#permission_grid").alopexGrid("columnInfo", "execute")["editable"] }, "execute");
        $("#permission_grid").alopexGrid("updateColumn", { editable: false }, ["all", "read", "write", "execute"]);
        $("#notilist_grid").alopexGrid("updateColumn", { render: $("#notilist_grid").alopexGrid("notilistInfo", "receiver")["editable"] }, "receiver");

	    $('#target_grid'       ).alopexGrid('updateColumn', { selectorColumn : false }, 'check');
	    $('#schedule_grid'     ).alopexGrid('updateColumn', { selectorColumn : false }, 'check');
	    $('#runnable_time_grid').alopexGrid('updateColumn', { selectorColumn : false }, 'check');
	    $('#trigger_grid'      ).alopexGrid('updateColumn', { selectorColumn : false }, 'check');
	    $('#permission_grid'   ).alopexGrid('updateColumn', { selectorColumn : false }, 'check');
	    $('#notilist_grid'     ).alopexGrid('updateColumn', { selectorColumn : false }, 'check');
    } else {
        // Task Id 변경 시에 재조회 경우를 위해, Latest Revision 을 조회한다.
        // Latest Revision
        // - Zero(0)  : Change task_id
        // - Not Zero : Not Change task_id
        getLatestRevision(g_task_id);
    }

    return;
};

// Grid 초기화
function initGrid(isReadOnly) {

    // Target 그리드 초기화
    $('#target_grid').alopexGrid({
        height: 'content',
        leaveDeleted: true,
        rowSelectOption: {
		    clickSelect : true,
		    singleSelect: false
	    },
	    cellInlineEdit: true,
	    cellInlineEditOption: {
		    startEvent             : 'click',
		    focusMoveAtEditEnd     : false,
		    endEditByOtherAreaClick: true,
	    },
	    endInlineEditByOuterClick: true,
        pager : true,
        paging: {
            enabled   : false,
            pagerTotal: true
        },
        // filter 추가를 위한 설정
        filteringHeader: true,
        filteringHeaderHeight: 30,
        filter: {
		    movable: true,
		    saveFilterSize: true,
		    title: true
	    },
        columnMapping : [
            {
                align          : 'center',
                key            : 'check',
                width          : '50px',
                selectorColumn : true,
                excludeFitWidth: true,
                resizing       : false,
            }, {
                align : 'center',
                key   : 'hostname',
                title : 'HOSTNAME',
                width : '100px',
                headerStyleclass: 'export-header',
                render: function(value, data, render, mapping, grid) {
                    if (value == null || value == '') return '-';
                    return value;
                }
            }, {
                align : 'center',
                key   : 'osType',
                title : 'OS 종류',
                width : '100px',
                headerStyleclass: 'export-header',
                render: function(value, data, render, mapping, grid) {
                    if (value == null || value == '') return '-';
                    return value;
                }
            }, {
                align : 'center',
                key   : 'osName',
                title : 'OS 이름',
                width : '100px',
                headerStyleclass: 'export-header',
                render: function(value, data, render, mapping, grid) {
                    if (value == null || value == '') return '-';
                    return value;
                }
            }, {
                align : 'center',
                key   : 'osVersion',
                title : 'OS 버전',
                width : '100px',
                headerStyleclass: 'export-header',
                render: function(value, data, render, mapping, grid) {
                    if (value == null || value == '') return '-';
                    return value;
                }
            }, {
                align : 'left',
                key   : 'tag',
                title : '태그',
                width : '150px',
                headerStyleclass: 'export-header',
                render: function(value, data, render, mapping, grid) {
                    if (value == null || value == '' || Object.keys(value).length == 0) {
                        data['tag'] = "";
                        return '-';
                    }

                    // origin 에 해당 하는 Code value 치환
                    let result = "";
                    let items = value.split(",");
                    for (let i = 0; i < items.length; i++) {
                        let item          = items[i].trim().replace(/\"/g, "");
                        let [tmp, val]    = item.split("=");
                        // let [origin, key, tag] = tmp.split(".");
                        let [origin, key] = tmp.split(".");
                        // let tag_str = "\"" + key + "." + tag + "\"=\"" + val + "\",";
                        let tag_str = "\"" + origin + "." + key + "\"=\"" + val + "\",";
                        result += tag_str;
                    }
                    result = result.substring(0, result.length-1);

                    // 태그 value 가 Object 일경우 검색이 안되므로 value(str) 을 리턴함
                    return result;
                },
                filter: {
                    width            : "350px",
				    useRenderToFilter: true,
			    },
            }, {
                align          : 'left',
                key            : 'account',
                title          : 'OS 계정',
                width          : '200px',
                headerStyleclass: 'export-header',
                excludeFitWidth: true,
                editable       : true,
            }, {
                align          : 'left',
                key            : 'description',
                title          : '설명',
                width          : '400px',
                headerStyleclass: 'export-header',
                excludeFitWidth: true,
                editable       : true,
            },
        ],
    });

    // 스케줄 그리드 초기화
    $('#schedule_grid').alopexGrid({
        height: 'content',
        leaveDeleted: true,
        rowSelectOption: {
		    clickSelect : true,
		    singleSelect: false
	    },
        pager : true,
        paging: {
            enabled   : false,
            pagerTotal: true
        },
        columnMapping: [
            {
                align          : 'center',
                key            : 'check',
                width          : '50px',
                selectorColumn : true,
                excludeFitWidth: true,
                resizing       : false,
            }, {
                align: 'center',
                key  : 'mode',
                title: '유형',
                width: '200px',
            }, {
                align : 'center',
                key   : 'timePoint',
                title : '스케줄',
                width : '200px',
                render: function(value, data, render, mapping, grid) {
                    return opme_formatDatetimeString(data['mode'], value);
                }
            }, {
                align : 'center',
                key   : 'timeZone',
                title : '타임존(UTC offset)',
                width : '100px',
                render: function(value, data, render, mapping, grid) {
                    return "UTC" + value;
                }
            }
        ],
    });

    // 실행가능시간 그리드 초기화
    $('#runnable_time_grid').alopexGrid({
        height: 'content',
        leaveDeleted: true,
        rowSelectOption: {
		    clickSelect : true,
		    singleSelect: false
	    },
        pager : true,
        paging: {
            enabled   : false,
            pagerTotal: true
        },
        columnMapping : [
            {
                align          : 'center',
                key            : 'check',
                width          : '50px',
                selectorColumn : true,
                excludeFitWidth: true,
                resizing       : false,
            }, {
                align: 'center',
                key  : 'mode',
                title: '유형',
                width: '100px',
            }, {
                align : 'center',
                key   : 'start',
                title : '실행가능시간(From)',
                width : '200px',
                render: function(value, data, render, mapping, grid) {
                    return opme_formatDatetimeString(data['mode'], value) + " 부터";
                }
            }, {
                align : 'center',
                key   : 'range',
                title : '유효시간(Range)',
                width : '200px',
                render: function(value, data, render, mapping, grid) {
                    return value.replace("h", "시간").replace("m", "분") + " 동안";
                }
            }, {
                align : 'center',
                key   : 'timeZone',
                title : '타임존(UTC offset)',
                width : '100px',
                render: function(value, data, render, mapping, grid) {
                    return "UTC" + value;
                }
            },
        ],
    });

    // Trigger 그리드 초기화
    $('#trigger_grid').alopexGrid({
        height: 'content',
        leaveDeleted: true,
        rowSelectOption: {
		    clickSelect : true,
		    singleSelect: false
	    },
	    cellInlineEdit:true,
        cellInlineEditOption: {
		    startEvent             : 'click',
		    focusMoveAtEditEnd     : false,
		    endEditByOtherAreaClick: true
	    },
	    endInlineEditByOuterClick: true,
        defaultColumnMapping: {
            align: 'center'
        },
//	    defaultState: {
//            dataAdd: {editing: true},
//            dataSet: {editing: true}
//	    },
        pager: true,
        paging: {
            enabled   : false,
            pagerTotal: true
        },
        columnMapping : [
            {
                align          : 'center',
                key            : 'check',
                width          : '50px',
                selectorColumn : true,
                excludeFitWidth: true,
                resizing       : false,
            }, {
                align: 'center',
                key  : 'taskId',
                title: '태스크ID',
                width: '200px',
            }, {
                align : 'center',
                key   : 'taskResult',
                title : '조건',
                width : '100px',
                render: {
                    type:'string',
                    rule: function(value, data) {
                        let editing_data = [{value:'', text:'선택'}];
                        editing_data = editing_data.concat(g_task_result_arr);
                        return editing_data;
                    }
                },
                editable: {
                    type:'select',
                    rule: function(value, data) {
                        let editing_data = [{value:'', text:'선택'}];
                        editing_data = editing_data.concat(g_task_result_arr);
                        return editing_data;
                    }
                },
                editedValue: function (cell) {
                    return $(cell).find('select option').filter(':selected').val();
                }
            }, {
                align          : 'center',
                key            : 'time',
                title          : '시간',
                width          : '100px',
                excludeFitWidth: true,
                editable       : true,
            }, {
                key   : 'timeUnit',
                title : '단위(시/분/초)',
                width : '100px',
                render: {
                    type:'string',
                    rule: function(value, data) {
                        if (isReadOnly == true && value == "") {
                            return [{value:'', text:'즉시'}];
                        }

                        let editing_data = [{value:'', text:'선택'}];
                        editing_data = editing_data.concat(g_time_unit_arr);
                        return editing_data;
                    }
                },
                editable: {
                    type:'select',
                    rule: function(value, data) {
                        let editing_data = [{value:'', text:'선택'}];
                        editing_data = editing_data.concat(g_time_unit_arr);
                        return editing_data;
                    }
                },
                editedValue: function (cell) {
                    return  $(cell).find('select option').filter(':selected').val();
                }
            }
        ],
    });

    // 권한 그리드 초기화
    $('#permission_grid').alopexGrid({
        height: 'content',
        leaveDeleted: true,
	    pager : true,
        paging: {
            enabled   : false,
            pagerTotal: true
        },
        defaultState: {
            //그리드 렌더링 시점부터 편집모드로 전환
            dataSet: { editing : true }
        },
        rowInlineEdit: true,
		mergeEditingImmediately: true,
        columnMapping: [
            {
                align          : 'center',
                key            : 'check',
                width          : '50px',
                selectorColumn : true,
                excludeFitWidth: true,
                resizing       : false,
            }, {
                align : 'center',
                key   : 'entityType',
                title : '유형',
                width : '100px',
                render: {
                    type: 'string',
                    rule: function(value, data) {
                        return g_entity_type_arr;
                    }
                }
            }, {
                align: 'center',
                key  : 'entityId',
                title: 'ID',
                width: '100px',
            }, {
                align          : 'center',
                key            : 'all',
                title          : 'All',
                width          : '70px',
                excludeFitWidth: true,
                inlineStyle    : { padding: '5px 0px 0px 0px' },
                editable: {
                    type      : 'checkbox',
                    styleclass: 'grid_checkbox',
                    rule      : [{value:'T', checked:true}, {value:'F', checked:false}]
                },
                refreshBy: function(previousValue, changedValue, changedKey, changedData, changedColumnMapping){
                    //다른 칼럼들 데이터 변경 상태에 따라 해당 칼럼 데이터 리프레쉬
                    if(['read', 'write', 'execute'].indexOf(changedColumnMapping.key) > -1 ){
                        $('#permission_grid').alopexGrid('cellEdit', isAllRowDataTrue(changedData), {_index: {row: changedData._index.row}}, 'all');
                        return true;
                    }
                },
                value: function(value, data){
                    //그리드 설정시 다른 권한 데이터로 해당 칼럼 데이터 설정
                    return isAllRowDataTrue(data)
                },
            }, {
                align          : 'center',
                key            : 'read',
                title          : 'read',
                width          : '70px',
                excludeFitWidth: true,
                inlineStyle    : { padding: '5px 0px 0px 0px' },
                editable: {
                    type      : 'checkbox',
                    styleclass: 'grid_checkbox',
                    rule      : [{value:'r', checked:true}, {value:'-', checked:false}]
                },
            }, {
                align          : 'center',
                key            : 'write',
                title          : 'write',
                width          : '70px',
                excludeFitWidth: true,
                inlineStyle    : { padding: '5px 0px 0px 0px' },
                editable: {
                    type      : 'checkbox',
                    styleclass: 'grid_checkbox',
                    rule      : [{value:'w', checked:true}, {value:'-', checked:false}]
                },
            }, {
                align          : 'center',
                key            : 'execute',
                title          : 'exec',
                width          : '70px',
                excludeFitWidth: true,
                inlineStyle    : { padding: '5px 0px 0px 0px' },
                editable: {
                    type      : 'checkbox',
                    styleclass: 'grid_checkbox',
                    rule      : [{value:'x', checked:true}, {value:'-', checked:false}]
                },
            },
        ],
    });

    // 알림목록 그리드 초기화
    $('#notilist_grid').alopexGrid({
        height: 'content',
        leaveDeleted: true,
        rowSelectOption: {
		    clickSelect : true,
		    singleSelect: false
	    },
	    cellInlineEdit:true,
        cellInlineEditOption: {
		    startEvent             : 'click',
		    focusMoveAtEditEnd     : false,
		    endEditByOtherAreaClick: true
	    },
	    endInlineEditByOuterClick: true,
        defaultColumnMapping: {
            align: 'center'
        },
        pager: true,
        paging: {
            enabled   : false,
            pagerTotal: true
        },
        columnMapping : [
            {
                align          : 'center',
                key            : 'check',
                width          : '50px',
                selectorColumn : true,
                excludeFitWidth: true,
                resizing       : false,
            }, {
                align: 'center',
                key  : 'event',
                title: '이벤트',
                width: '200px',
                render: function(value, data, render, mapping, grid) {
                    let result_str = g_notilist_event_dict[value];
                    console.log(data['event']);
                    return result_str;
                }
            }, {
                align : 'center',
                key   : 'condition',
                title : '조건',
                width : '100px',
                render: function(value, data, render, mapping, grid) {
                    console.log(value);
                    console.log(data);
                    return value;
                }
            }, {
                align          : 'center',
                key            : 'method',
                title          : '방법',
                width          : '100px',
                render: function(value, data, render, mapping, grid) {
                    console.log(value);
                    console.log(data);
                    console.log(grid);
                    return value;
                }
            }, {
                key   : 'receiver',
                title : '받는 곳',
                width : '100px',
                render: function(value, data, render, mapping, grid) {
                    console.log(value);
                    console.log(data);
                    console.log(grid);
                    return value;
                }
            }
        ],
    });
};

// Grid 초기화 (for Diff)
function initGridForDiff() {

    // Target 그리드 초기화
    $('#target_grid2').alopexGrid({
        height        : 'content',
        readonlyRender: true,
        pager : true,
        paging: {
            enabled   : false,
            pagerTotal: true
        },
        // filter 추가를 위한 설정
        filteringHeader: true,
        filteringHeaderHeight: 30,
        filter: {
		    movable: true,
		    saveFilterSize: true,
		    title: true
	    },
        columnMapping : [
            {
                align : 'center',
                key   : 'hostname',
                title : 'HOSTNAME',
                width : '100px',
                headerStyleclass: 'export-header',
                render: function(value, data, render, mapping, grid) {
                    if (value == null || value == '') return '-';
                    return value;
                }
            }, {
                align : 'center',
                key   : 'osType',
                title : 'OS 종류',
                width : '100px',
                headerStyleclass: 'export-header',
                render: function(value, data, render, mapping, grid) {
                    if (value == null || value == '') return '-';
                    return value;
                }
            }, {
                align : 'center',
                key   : 'osName',
                title : 'OS 이름',
                width : '100px',
                headerStyleclass: 'export-header',
                render: function(value, data, render, mapping, grid) {
                    if (value == null || value == '') return '-';
                    return value;
                }
            }, {
                align : 'center',
                key   : 'osVersion',
                title : 'OS 버전',
                width : '100px',
                headerStyleclass: 'export-header',
                render: function(value, data, render, mapping, grid) {
                    if (value == null || value == '') return '-';
                    return value;
                }
            }, {
                align : 'left',
                key   : 'tag',
                title : '태그',
                width : '150px',
                headerStyleclass: 'export-header',
                render: function(value, data, render, mapping, grid) {
                    if (value == null || value == '' || Object.keys(value).length == 0) {
                        data['tag'] = "";
                        return '-';
                    }

                    // origin 에 해당 하는 Code value 치환
                    let result = "";
                    let items = value.split(",");
                    for (let i = 0; i < items.length; i++) {
                        let item          = items[i].trim().replace(/\"/g, "");
                        let [tmp, val]    = item.split("=");
                        let [origin, key] = tmp.split(".");
                        let tag_str = "\"" + g_tag_origin_dict[origin] + "." + key + "\"=\"" + val + "\",";
                        result += tag_str;
                    }
                    result = result.substring(0, result.length-1);

                    // 태그 value 가 Object 일경우 검색이 안되므로 value(str) 을 리턴함
                    return result;
                },
                filter: {
                    width            : "350px",
				    useRenderToFilter: true,
			    },
            }, {
                align          : 'left',
                key            : 'account',
                title          : 'OS계정',
                width          : '200px',
                headerStyleclass: 'export-header',
                excludeFitWidth: true,
            }, {
                align          : 'left',
                key            : 'description',
                title          : '설명',
                width          : '400px',
                headerStyleclass: 'export-header',
                excludeFitWidth: true,
            },
        ],
    });

    // 스케줄 그리드 초기화
    $('#schedule_grid2').alopexGrid({
        height: 'content',
        readonlyRender: true,
        pager : true,
        paging: {
            enabled   : false,
            pagerTotal: true
        },
        columnMapping : [
            {
                align : 'center',
                key   : 'mode',
                title : '유형',
                width : '200px',
            }, {
                align : 'center',
                key   : 'timePoint',
                title : '스케줄',
                width : '200px',
                render: function(value, data, render, mapping, grid) {
                    return opme_formatDatetimeString(data['mode'], value);
                }
            }, {
                align : 'center',
                key   : 'timeZone',
                title : '타임존(UTC offset)',
                width : '100px',
                render: function(value, data, render, mapping, grid) {
                    return "UTC" + value;
                }
            }
        ],
    });

    // 실행가능시간 그리드 초기화
    $('#runnable_time_grid2').alopexGrid({
        height: 'content',
        readonlyRender: true,
        pager : true,
        paging: {
            enabled   : false,
            pagerTotal: true
        },
        columnMapping : [
            {
                align: 'center',
                key  : 'mode',
                title: '유형',
                width: '100px',
            }, {
                align : 'center',
                key   : 'start',
                title : '실행가능시간(From)',
                width : '200px',
                render: function(value, data, render, mapping, grid) {
                    return opme_formatDatetimeString(data['mode'], value) + " 부터";
                }
            }, {
                align : 'center',
                key   : 'range',
                title : '유효시간(Range)',
                width : '200px',
                render: function(value, data, render, mapping, grid) {
                    return value.replace("h", "시간").replace("m", "분") + " 동안";
                }
            }, {
                align : 'center',
                key   : 'timeZone',
                title : '타임존(UTC offset)',
                width : '100px',
                render: function(value, data, render, mapping, grid) {
                    return "UTC" + value;
                }
            },
        ],
    });

    // Trigger 그리드 초기화
    $('#trigger_grid2').alopexGrid({
        height: 'content',
        readonlyRender: true,
        defaultColumnMapping: {
            align: 'center'
        },
        pager : true,
        paging: {
            enabled   : false,
            pagerTotal: true
        },
        columnMapping : [
            {
                align: 'center',
                key  : 'taskId',
                title: '태스크ID',
                width: '200px',
            }, {
                align : 'center',
                key   : 'taskResult',
                title : '조건',
                width : '100px',
                render: {
                    type:'string',
                    rule: function(value, data) {
                        let editing_data = [{value:'', text:'선택'}];
                        editing_data = editing_data.concat(g_task_result_arr);
                        return editing_data;
                    }
                },
            }, {
                align          : 'center',
                key            : 'time',
                title          : '시간',
                width          : '100px',
                excludeFitWidth: true,
            }, {
                key   : 'timeUnit',
                title : '단위(시/분/초)',
                width : '100px',
                render: {
                    type:'string',
                    rule: function(value, data) {
                        if (value == "") {
                            return [{value:'', text:'즉시'}];
                        }

                        let editing_data = [{value:'', text:'선택'}];
                        editing_data = editing_data.concat(g_time_unit_arr);
                        return editing_data;
                    }
                },
            }
        ],
    });

    // 권한 그리드 초기화
    $('#permission_grid2').alopexGrid({
        height: 'content',
        readonlyRender: true,
	    pager : true,
        paging: {
            enabled   : false,
            pagerTotal: true
        },
        columnMapping: [
            {
                align : 'center',
                key   : 'entityType',
                title : '유형',
                width : '100px',
                render: {
                    type: 'string',
                    rule: function(value, data) {
                        return g_entity_type_arr;
                    }
                }
            }, {
                align: 'center',
                key  : 'entityId',
                title: 'ID',
                width: '100px',
            }, {
                align          : 'center',
                key            : 'all',
                title          : 'All',
                width          : '70px',
                excludeFitWidth: true,
                inlineStyle    : { padding: '5px 0px 0px 0px' },
                render: {
                    type      : 'checkbox',
                    styleclass: 'grid_checkbox',
                    rule      : [{value:'T', checked:true}, {value:'F', checked:false}]
                },
                value: function(value, data){
                    //그리드 설정시 다른 권한 데이터로 해당 칼럼 데이터 설정
                    return isAllRowDataTrue(data)
                },
            }, {
                align          : 'center',
                key            : 'read',
                title          : 'read',
                width          : '70px',
                excludeFitWidth: true,
                inlineStyle    : { padding: '5px 0px 0px 0px' },
                render: {
                    type      : 'checkbox',
                    styleclass: 'grid_checkbox',
                    rule      : [{value:'r', checked:true}, {value:'-', checked:false}]
                },
            }, {
                align          : 'center',
                key            : 'write',
                title          : 'write',
                width          : '70px',
                excludeFitWidth: true,
                inlineStyle    : { padding: '5px 0px 0px 0px' },
                render: {
                    type      : 'checkbox',
                    styleclass: 'grid_checkbox',
                    rule      : [{value:'w', checked:true}, {value:'-', checked:false}]
                },
            }, {
                align          : 'center',
                key            : 'execute',
                title          : 'exec',
                width          : '70px',
                excludeFitWidth: true,
                inlineStyle    : { padding: '5px 0px 0px 0px' },
                render: {
                    type      : 'checkbox',
                    styleclass: 'grid_checkbox',
                    rule      : [{value:'x', checked:true}, {value:'-', checked:false}]
                },
            },
        ],
    });

    // 알림목록 그리드 초기화
    $('#notilist_grid2').alopexGrid({
        height: 'content',
        readonlyRender: true,
	    pager : true,
        paging: {
            enabled   : false,
            pagerTotal: true
        },
        columnMapping : [
            {
                align          : 'center',
                key            : 'check',
                width          : '50px',
                selectorColumn : true,
                excludeFitWidth: true,
                resizing       : false,
            }, {
                align: 'center',
                key  : 'event',
                title: '이벤트',
                width: '200px',
                render: function(value, data, render, mapping, grid) {
                    let result_str = g_notilist_event_dict[value];
                    //console.log(data['event']);
                    return result_str;
                }
            }, {
                align : 'center',
                key   : 'condition',
                title : '조건',
                width : '100px',
                render: function(value, data, render, mapping, grid) {
                    //console.log(value);
                    //console.log(data);
                    return value;
                }
            }, {
                align          : 'center',
                key            : 'method',
                title          : '방법',
                width          : '100px',
                render: function(value, data, render, mapping, grid) {
                    //console.log(value);
                    //console.log(data);
                    //console.log(grid);
                    return value;
                }
            }, {
                key   : 'receiver',
                title : '받는 곳',
                width : '100px',
                render: function(value, data, render, mapping, grid) {
                    //console.log(value);
                    //console.log(data);
                    //console.log(grid);
                    return value;
                }
            }
        ],
    });
};

// 태스크비교 대상 선택
function selectTaskForDiff() {

    return $a.popup({
        url     : '/task/p_task_hst',
        title   : '태스크비교 대상 선택',
        iframe  : true,  // default 는 true
        width   : 1200,
        movable : true,
        //data    : {'mode': 'single', 'user_param': {'user_id': g_login_id}},
        //data    : {'user_id': g_login_id},
        callback: function (taskInfo) {
            if (taskInfo == null) return;

            $.ajax({
                url        : "/task/dtl",
                type       : "POST",
                dataType   : "json",
                data       : JSON.stringify({"task_id": taskInfo["id"], "rev_no": String(taskInfo["revNo"])}),
                contentType: "application/json",
                success    : function(result) {
                    // ERROR
                    if (typeof result !== 'undefined' && result['resultCode'] != 'EM0000') {
                        opme_message(result['resultMsg']);
                        return;
                    }

                    initGridForDiff();
                    setDiffData(result);
                }
            });
        },
    });

    return;
};

// 중복 ID 확인
function checkId() {

    if ($("#id").val() == '') {
        opme_message('[태스크 ID] 를 입력하세요.', function() {
            $("#id").focus();
        });

        return;
    }

    // Latest Revision 의 Task ID 와 동일한 경우, 사용 가능한 것으로 간주.
    if ($("#id").val() == g_task_id) {
        $("#id").attr("data-check-result", "ok");
        $("#btn_check_id").setEnabled(false);
        opme_message("사용 가능한 ID 입니다.");
        return;
    }

    let data = {
        id: $("#id").val(),
    };

    return $.ajax({
        url        : '/task/dupchk',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        contentType: "application/json",
        success    : function(result) {
            let msg = '';
            if (result['resultCode'] == 'EM0000') {
                msg = $("#id").val() + " : 사용 중인 ID 입니다.";
                $("#id").focus();
            } else if(result['resultCode'] == 'EM0999') {
                msg = "사용 가능한 ID 입니다.";
                $("#id").attr("data-check-result", "ok");
                $("#btn_check_id").setEnabled(false);
                validateInput($("#id"));
            } else {
                msg = "[" + result['resultCode'] + "] " + result['resultMsg'];
                $("#id").focus();
            }

            opme_message(msg);
            return;
        }
    });
};

// 소유자 선택
function selectOwner() {
    let user_param = { user_id: $('#owner_id').val() };

    opme_searchUser('소유자 조회', 'single', user_param, function(user_info) {
        if (user_info.length == 1) {
            $('#owner_id').val(user_info[0]['id']);
            $("#owner_id").trigger("change");
        }
    });
};

// 발행자 선택
function selectPublisher() {
    let user_param = { user_id: $('#publish_id').val() };

    opme_searchUser('발행자 조회', 'single', user_param, function(user_info) {
        if (user_info.length == 1) {
            $('#publish_id').val(user_info[0]['id']);
            $("#publish_id").trigger("change");
        }
    });
};

// Code Mirror - Change Syntax Mode.
// - 지원가능 Mode : https://codemirror.net/mode/
function changeSyntaxMode(editor, script_name) {
    let val = script_name;
    let m, mode, spec;

    if (m = /.+\.([^.]+)$/.exec(val)) { // 파일명(확장자) 로 구분하는 경우
        // 'Windows Batch Script 의 경우, Code Mirror 에서 지원되지 않음.
        // 'bat','cmd' 를 'sh' 에 Mapping 처리함.
        if (m[1] == 'bat' || m[1] == 'cmd') {
            m[1] = 'sh';
        }

        // Shell, PowerShell, VBScript 는 아래에서 처리 됨.
        let info = CodeMirror.findModeByExtension(m[1]);
        if (info) {
            mode = info.mode;
            spec = info.mime;
        }

    } else if (/\//.test(val)) { // MIME Type 으로 구분하는 경우
        let info = CodeMirror.findModeByMIME(val);
        if (info) {
            mode = info.mode;
            spec = val;
        }

    } else { // Code Mirror 의 Mode 로 구분하는 경우
        mode = spec = val;
    }

    if (mode != "shell" && mode != "powershell" && mode != "vbscript") {
        return false;
    }

    editor.setOption("mode", spec);
    CodeMirror.autoLoadMode(editor, mode);
    
    // autoLoadMode는 비동기이므로, 모드가 로드된 후 refresh를 호출하기 위해 약간의 지연을 둠
    setTimeout(function() {
        editor.refresh();
    }, 150);

    return true;
};

// Script File Encoding. Reload Script.
// - Browser 상에 출력된 내용은 인코딩 Select Box 의 값과 상관없이,
//   항상 UTF-8이기에 UTF-8 문자열을 읽어서 euc-kr로 간주하고 UTF-8로 보여주는 의미없는 과정이 된다.
// - euc-kr로 작성된 문자열이라면, Browser 에 UTF-8로 출력했기에 깨져서 보일 것이고
//   깨진 문자열을 읽어들여서 euc-kr로 변경하면, 더 깨지는 식이다.
function changeEncoding() {
    let data   = new Blob([g_editor.getValue()], {type: 'text/plain'});
    let reader = new FileReader();

    reader.onload = function () {
        g_editor.setValue(reader.result);
        g_editor.refresh();
    };

    // Encoding : 'euc-kr', 'UTF-8'
    if ($('#script_encoding').val() == 'utf-8') {
        reader.readAsText(data, 'UTF-8');
    } else {
        reader.readAsText(data, 'euc-kr');
    }

    return;
};

// Script File Line Separator. Reload Script.
function changeLineSeparator() {

    if ($('#script_separator').val() == 'LF') {
        g_script_line_sep = '\n'; // LF (Linux) - 10
    } else {
        g_script_line_sep = '\r\n'; // CRLF (Windows) - 13, 10
    }

    // 아래 두 줄에 대한 주석을 해제하면, 변경한 내용이 Browser 에 표현되지만 서버에는 변경 없이 저장된다.
    // CodeMirror 설정에 따른 차이가 보이기만 할 뿐, 원본을 저장했다가 setting 하므로 값이 바뀌지 않게된다.
    // let script_content = g_editor.getValue();
    g_editor.setOption("lineSeparator", g_script_line_sep);
    // g_editor.setValue(script_content);

    // for Debug
    // let str_len = g_editor.getOption("lineSeparator").length;
    // for (let i=0; i<str_len; i++) {
    //     console.log(g_editor.getOption("lineSeparator").charCodeAt(i));
    // }

    return;
};

// Read from Local Script File.
function readLocalFile(file) {
    let reader = new FileReader();

    reader.onload = function () {
        g_editor.setValue(reader.result);
        g_editor.refresh();
    };

    // Encoding : 'euc-kr', 'UTF-8'
    if ($('#script_encoding').val() == 'utf-8') {
        reader.readAsText(file, 'UTF-8');
    } else {
        reader.readAsText(file, 'euc-kr');
    }
};

// 실행대상정보 추가
function addNodeSet() {

    // 부모창(role, task) 정보를 팝업창으로 전달
    let user_param = { 'parent' : 'task' };
    let addFlag = true;

    opme_searchNode('실행대상 노드집합정보 추가', 'single', user_param, function(nodeSetInfo) {

        if (typeof nodeSetInfo === 'undefined' || nodeSetInfo == null || nodeSetInfo == '') {
            return;
        }

        for (let i in nodeSetInfo) {
           if (addTargetGrid(nodeSetInfo[i]) == false) {
               addFlag = false;
           }
        }

        if (addFlag) {
            opme_message('실행대상 노드집합정보를 추가 했습니다.');
        }

        $("#target_grid").alopexGrid('startEdit');

        // Grid 데이터가 증가하면, height 를 고정시키고, Scroll 처리.
        let pageInfo = $('#target_grid').alopexGrid('pageInfo');
        if (pageInfo['dataLength'] > g_grid_scroll_cnt) {
            $("#target_grid").alopexGrid('updateOption', {height: '500px'});
        }
    });
};

function addTargetGrid(nodeSetInfo){

    // 중복제거
    let nodeSet = $('#target_grid').alopexGrid('dataGet',
                                               {'hostname'   : nodeSetInfo['hostname']
                                                , 'osType'   : nodeSetInfo['osType']
                                                , 'osName'   : nodeSetInfo['osName']
                                                , 'osVersion': nodeSetInfo['osVersion']
                                                , 'tag'      : nodeSetInfo['tag']});
    if ($.isEmptyObject(nodeSet) == false) { // Grid 에 있으면 복원(삭제된 경우, 복원됨)
        if (nodeSet[0]['_state']['deleted']) {
            $('#target_grid').alopexGrid('dataUndelete', nodeSet);
            return true;
        }

        opme_message(nodeSetInfo['hostname'] + ' 동일한 실행 대상 정보가 존재합니다.');
        return false;
    }

    // Grid 에 없으면 추가
    $("#target_grid").alopexGrid('dataAdd', nodeSetInfo);
    return true;
};

// 실행대상정보 수정
function editNodeSet(e, isReadOnly) {
    let dataObj = AlopexGrid.parseEvent(e).data;
    let rowData = $("#target_grid").alopexGrid( "dataGetByIndex" , {data: dataObj._index.data});
    let tag     = (rowData['tag'] == null || rowData['tag'] == "") ? rowData['tag'] : opme_strToDict(rowData['tag']);
    let node_param  = {
        'hostname'       : rowData['hostname'],
        'osType'         : rowData['osType'],
        'osName'         : rowData['osName'],
        'osVersion'      : rowData['osVersion'],
        'tag'            : tag,
        'login_privilege': login_privilege, // Popup 버튼 제어용.
        'isReadOnly'     : isReadOnly,
        'parent'         : 'task', // 부모창(role, task) 정보를 팝업창으로 전달
    };

    opme_searchNode('실행대상 노드집합정보 조건평가', 'single', node_param, function(nodeSetInfo) {
        if (typeof nodeSetInfo === 'undefined' || nodeSetInfo == null || nodeSetInfo == '') {
            return;
        }
        $("#target_grid").alopexGrid('dataEdit', $.extend({}, nodeSetInfo), {_index:{row:rowData['_index']['row']}});
    });
};

// 실행대상정보 삭제
function delNodeSet() {
    $('#target_grid').alopexGrid('dataDelete', {_state: {selected: true}}, {_state: {deleted: false}});
    $('#target_grid').alopexGrid('rowSelect' , {_state: {selected: true}}, false);

    // Grid 데이터가 감소하면, height 를 content 사이즈에 맞게 가변 처리.
    let pageInfo = $('#target_grid').alopexGrid('pageInfo');
    if (pageInfo['dataLength'] <= g_grid_scroll_cnt) {
        $("#target_grid").alopexGrid('updateOption', {height: 'content'});
    }
};

// 스케줄정보 추가
function addSchedule() {
    return $a.popup({
        url     : '/task/p_schedule',
        title   : '스케줄 추가',
        iframe  : true,  // default 는 true
        width   : 1000,
        height  : 347,
        movable : true,
        // data: {'mode': mode, 'user_param': userParam},
        callback: function (scheduleInfo) {

            if (scheduleInfo == null) return;

            // 중복제거
            let schedule = $('#schedule_grid').alopexGrid('dataGet', {'timePoint': scheduleInfo['timePoint'], 'timeZone': scheduleInfo['timeZone']});

            if ($.isEmptyObject(schedule)) { // Grid 에 없으면 추가
                $("#schedule_grid").alopexGrid('dataAdd', scheduleInfo);

                // Grid 데이터가 증가하면, height 를 고정시키고, Scroll 처리.
                let pageInfo = $('#schedule_grid').alopexGrid('pageInfo');
                if (pageInfo['dataLength'] > g_grid_scroll_cnt) {
                    $("#schedule_grid").alopexGrid('updateOption', {height: '500px'});
                }

            } else { // Grid 에 있으면 복원(삭제된 경우, 복원됨)
                $('#schedule_grid').alopexGrid('dataUndelete', scheduleInfo);
            }
        },
    });
};

// 실행가능시간정보 추가
function addRunnableTime() {

    return $a.popup({
        url     : '/task/p_runnable_time',
        title   : '실행가능시간 추가',
        iframe  : true,  // default 는 true
        width   : 1000,
        height  : 430,
        movable : true,
        // data: {'mode': mode, 'user_param': userParam},
        callback: function (runnableTimeInfo) {
            if (runnableTimeInfo == null) return;

            // 중복제거
            let runnable_time = $('#runnable_time_grid').alopexGrid('dataGet', {'start': runnableTimeInfo['start'], 'range': runnableTimeInfo['range'], 'timeZone': runnableTimeInfo['timeZone']});

            if ($.isEmptyObject(runnable_time)) { // Grid 에 없으면 추가
                $("#runnable_time_grid").alopexGrid('dataAdd', runnableTimeInfo);

                // Grid 데이터가 증가하면, height 를 고정시키고, Scroll 처리.
                let pageInfo = $('#runnable_time_grid').alopexGrid('pageInfo');
                if (pageInfo['dataLength'] > g_grid_scroll_cnt) {
                    $("#runnable_time_grid").alopexGrid('updateOption', {height: '500px'});
                }

            } else { // Grid 에 있으면 복원(삭제된 경우, 복원됨)
                $('#runnable_time_grid').alopexGrid('dataUndelete', runnableTimeInfo);
            }
        },
    });
};

// 트리거정보 추가
function addTrigger() {

    let task_param = { 'org_task_id': g_task_id };

    opme_searchTask('태스크 추가 (트리거정보)', 'single', task_param, function(task_info) {
        // 추가 시 중복허용
        $("#trigger_grid").alopexGrid('dataAdd', {'taskId': task_info[0]['id']});
        $("#trigger_grid").alopexGrid('startEdit');

        // Grid 데이터가 증가하면, height 를 고정시키고, Scroll 처리.
        let pageInfo = $('#trigger_grid').alopexGrid('pageInfo');
        if (pageInfo['dataLength'] > g_grid_scroll_cnt) {
            $("#trigger_grid").alopexGrid('updateOption', {height: '500px'});
        }
    });
};

// 권한정보 추가(User)
function addPermissionUser() {

    opme_searchUser('사용자 추가', 'multi', null, function(user_info) {
        // 중복제거
        let add_user_list = [];
        for (let i=0; i<user_info.length; i++) {
            let user = $('#permission_grid').alopexGrid('dataGet', function(data) {
                return data.entityType == 'U' && data.entityId == user_info[i]['id'];
            });
            if ($.isEmptyObject(user)) { // Grid 에 없으면 추가
                add_user_list.push({'entityType': 'U', 'entityId': user_info[i]['id'], 'read': '-', 'write': '-', 'execute': '-'});
            } else { // Grid 에 있으면 복원(삭제된 경우, 복원됨)
                $('#permission_grid').alopexGrid('dataUndelete', {'entityId': user[0].id});
            }
        }
        $("#permission_grid").alopexGrid('dataAdd', add_user_list);
        $("#permission_grid").alopexGrid('startEdit');

        // Grid 데이터가 증가하면, height 를 고정시키고, Scroll 처리.
        let pageInfo = $('#permission_grid').alopexGrid('pageInfo');
        if (pageInfo['dataLength'] > g_grid_scroll_cnt) {
            $("#permission_grid").alopexGrid('updateOption', {height: '500px'});
        }
    });
};

// 권한정보 추가(UserGroup)
function addPermissionUserGroup() {

    opme_searchUserGroup('사용자그룹 추가', 'multi', null, function(usergrp_info) {
        // 중복제거
        let add_usergrp_list = [];
        for (let i=0; i<usergrp_info.length; i++) {
            let usergrp = $('#permission_grid').alopexGrid('dataGet', function(data) {
                return data.entityType == 'G' && data.entityId == usergrp_info[i]['id'];
            });
            if ($.isEmptyObject(usergrp)) { // Grid 에 없으면 추가
                add_usergrp_list.push({'entityType': 'G', 'entityId': usergrp_info[i]['id'], 'read': '-', 'write': '-', 'execute': '-'});
            } else { // Grid 에 있으면 복원(삭제된 경우, 복원됨)
                $('#permission_grid').alopexGrid('dataUndelete', {'entityId': usergrp[0].id});
            }
        }
        $("#permission_grid").alopexGrid('dataAdd', add_usergrp_list);
        $("#permission_grid").alopexGrid('startEdit');

        // Grid 데이터가 증가하면, height 를 고정시키고, Scroll 처리.
        let pageInfo = $('#permission_grid').alopexGrid('pageInfo');
        if (pageInfo['dataLength'] > g_grid_scroll_cnt) {
            $("#permission_grid").alopexGrid('updateOption', {height: '500px'});
        }
    });
};

// 권한정보 추가(Task)
function addPermissionTask() {

    opme_searchTask('태스크 추가 (권한정보)', 'multi', null, function(task_info) {
        // 중복제거
        let add_task_list = [];
        for (let i=0; i<task_info.length; i++) {
            let task = $('#permission_grid').alopexGrid('dataGet', function(data) {
                return data.entityType == 'T' && data.entityId == task_info[i]['id'];
            });
            if ($.isEmptyObject(task)) { // Grid 에 없으면 추가
                add_task_list.push({'entityType': 'T', 'entityId': task_info[i]['id'], 'read': '-', 'write': '-', 'execute': '-'});
            } else { // Grid 에 있으면 복원(삭제된 경우, 복원됨)
                $('#permission_grid').alopexGrid('dataUndelete', {'entityId': task[0].id});
            }
        }
        $("#permission_grid").alopexGrid('dataAdd', add_task_list);
        $("#permission_grid").alopexGrid('startEdit');

        // Grid 데이터가 증가하면, height 를 고정시키고, Scroll 처리.
        let pageInfo = $('#permission_grid').alopexGrid('pageInfo');
        if (pageInfo['dataLength'] > g_grid_scroll_cnt) {
            $("#permission_grid").alopexGrid('updateOption', {height: '500px'});
        }
    });
};

// 권한정보 삭제
function delPermission() {

    $('#permission_grid').alopexGrid('dataDelete', {_state: {selected: true}}, {_state: {deleted: false}});
    $('#permission_grid').alopexGrid('rowSelect' , {_state: {selected: true}}, false);

    // Grid 데이터가 감소하면, height 를 content 사이즈에 맞게 가변 처리.
    let pageInfo = $('#permission_grid').alopexGrid('pageInfo');
    if (pageInfo['dataLength'] <= g_grid_scroll_cnt) {
        $("#permission_grid").alopexGrid('updateOption', {height: 'content'});
    }

    return;
};

// 권한정보 Grid 의 all 컬럼 처리.
function isAllRowDataTrue(row_data) {

    let count = 0;
	for (let i in row_data) {
		// rows key 값 중 선별하여 확인한다.
		switch (i) {
			case 'read'   :
			case 'write'  :
			case 'execute':
			    if (row_data[i] != '-')
			        count++;
			default:
		}
	}

    if (count == 3) return 'T';
	return 'F';
};

// 알람목록정보 추가
function addNotilist() {
    return $a.popup({
        url     : '/task/p_notilist',
        title   : '알림목록정보 추가',
        iframe  : true,  // default 는 true
        width   : 1000,
        height  : 448,
        movable : true,
        // data: {'mode': mode, 'user_param': userParam},
        callback: function (notilistInfo) {

            if (notilistInfo == null) return;

            // 중복제거
            let notilist = $('#notilist_grid').alopexGrid('dataGet', {'event': notilistInfo['event'], 'condition': notilistInfo['condition'], 'method': notilistInfo['method'], 'receiver': notilistInfo['receiver']});
            console.log("333");
            console.log(notilist);
            if ($.isEmptyObject(notilist)) { // Grid 에 없으면 추가
                $("#notilist_grid").alopexGrid('dataAdd', notilistInfo);

                // Grid 데이터가 증가하면, height 를 고정시키고, Scroll 처리.
                let pageInfo = $('#notilist_grid').alopexGrid('pageInfo');
                if (pageInfo['dataLength'] > g_grid_scroll_cnt) {
                    $("#notilist_grid").alopexGrid('updateOption', {height: '500px'});
                }

            } else { // Grid 에 있으면 복원(삭제된 경우, 복원됨)
                $('#notilist_grid').alopexGrid('dataUndelete', notilistInfo);
            }
        },
    });
};

// Search in Target Grid
// area: left or right
function searchGridData (command, area) {

    let grid_search;
    if (area == 'left') {
        input       = $('#search_keyword');
        grid        = $('#target_grid');
        cnt_area    = $('#search_info');
        grid_search = g_grid_search;
    } else if (area == 'right') {
        input       = $('#search_keyword2');
        grid        = $('#target_grid2');
        cnt_area    = $('#search_info2');
        grid_search = g_grid_search2;
    } else {
        opme_message('[ERROR] ' + area);
        return;
    }

    if (command != 'endSearch' && input.val() == '') {
        opme_message("검색조건을 입력하세요");
        return;
    }

    switch (command) {
        case 'startSearch':
            grid_search = 1;
            if (area == 'left') {
                g_search_old = $('#search_keyword').val();
            } else if (area == 'right') {
                g_search_old2 = $('#search_keyword2').val();
            }
            grid.alopexGrid(command, input.val());
            break;
        case 'searchNext':
        case 'searchPrevious':
            grid.alopexGrid(command);
            break;
        case 'endSearch':
            grid_search = 0;
            grid.alopexGrid(command);
            break;
        default:
            opme_message('[ERROR] ' + command);
            return;
    }

    let info = grid.alopexGrid('searchInfo');

    if (info == null) { // endSearch
        cnt_area.text('');
        grid_search = 0;
        return;
    }

    if (info.matchCount == 0) { // Not Matched
        cnt_area.text("No data");
        grid_search = 0;
        return;
    }

    let msg = (info.highlightPointer + 1) + ' / ' + info.matchCount + " 건";
    cnt_area.text(msg);

    if (area == 'left') {
        g_grid_search = grid_search;
    } else if (area == 'right') {
        g_grid_search2 = grid_search;
    }

    return;
};

// 데이터 저장
function saveData() {

    let base_info = {
        task_id     : $("#id").val(),
        owner_id    : $("#owner_id").val(),
        publish_id  : $("#publish_id").val(),
        description : $("#description").val(),
        cutoffperiod: $("#cutoffperiod").val(),
    };

    let script_info = {
        script_name   : $('#script_name').val(),
        script_account: $('#script_account').val(),
        script_description : $("#script_description").val(),
        script_content: btoa(unescape(encodeURIComponent(g_editor.getValue()))),
        script_encode : $('#script_encoding').val(),
        // script_line_separator: response['script_line_separator']
    };

    // let target_list = $('#target_grid').alopexGrid('dataGet', {_state: {deleted: false}}).map(function(o) {
    //     return { 'hostname': o.hostname, 'osType': o.osType, 'osName': o.osName, 'osVersion': o.osVersion,
    //     'tag': opme_strToDict(o.tag), 'account': o.account, 'description': o.description };
    // });
    let target_list = AlopexGrid.trimData($('#target_grid').alopexGrid('dataGet', {_state: {deleted: false}}));
    for (let i=0; i < target_list.length; i++) {
        if (target_list[i]['tag'] == null || target_list[i]['tag'] == "") {
            continue;
        }
        target_list[i]['tag'] = opme_strToDict(target_list[i]['tag']);
    }

    let schedule_list = $('#schedule_grid').alopexGrid('dataGet', {_state: {deleted: false}}).map(function(o) {
        return { 'timePoint': o.timePoint, 'timeZone': o.timeZone };
    });
    console.log(schedule_list);
    let runnable_time_list = $('#runnable_time_grid').alopexGrid('dataGet', {_state: {deleted: false}}).map(function(o) {
        return { 'timeRange': o.start + ' ~ ' + o.range, 'timeZone': o.timeZone };
    });

    let trigger_list = AlopexGrid.trimData($('#trigger_grid').alopexGrid('dataGet', {_state: {deleted: false}}));

    let permission_list = $('#permission_grid').alopexGrid('dataGet', {_state: {deleted: false}}).map(function(o) {
        return { 'entityType': o.entityType, 'entityId': o.entityId, 'mode': o.read + o.write + o.execute };
    });

    let notilist_list = AlopexGrid.trimData($('#notilist_grid').alopexGrid('dataGet', {_state: {deleted: false}}));
    console.log(notilist_list);
//    return;
    let data = {
        id                : g_task_id,
        base_info         : base_info,
        script_info       : script_info,
        target_list       : target_list,
        schedule_list     : schedule_list,
        runnable_time_list: runnable_time_list,
        trigger_list      : trigger_list,
        permission_list   : permission_list,
        notilist_list     : notilist_list,
    };

    return $.ajax({
        url        : "/task/save",
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        contentType: "application/json",
        success    : function(result) {
            opme_message(result["resultMsg"], function () {
                if (result["resultCode"] == "EM0000") {
                    // Latest Revision 이 0인 경우(revision 0 only), 변경된 Task ID로 조회한다.
                    // - Zero(0)  : Change task_id
                    // - Not Zero : Not Change task_id
                    if (g_latest_revision == 0) {
                        request_params['task_id'] = $('#id').val();
                    }

                    request_params['rev_no']  = '0';
                    opme_postWithParam('/task/dtl', request_params);
                }
            });
        }
    });
};

// TASK Latest Revision 조회
function getLatestRevision(task_id) {

    let data = {
        "id"           : task_id,
        "owner_id"     : "",
        "publish_id"   : "",
        "rev_zero"     : "",
        "permitted_id" : g_login_id,
    }

    $.ajax({
        url        : "/task/list",
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        contentType: "application/json",
        success    : function(result) {

            if (result['resultCode'] != 'EM0000') {
                //opme_message("[" + result['resultCode'] + "] " + result['resultMsg']);
                return;
            }

            for (let i=0; i<result['taskList'].length; i++) {
                if (result['taskList'][i]['id'] == task_id) {
                    g_latest_revision = result['taskList'][i]['revNo'];
                    return;
                }
            }
        }
    });

    return;
};

// TASK 발행
// OPMM TCS 활성화 추가
function publishTask(tcsOtpPassCode) {
    return $.ajax({
        url        : "/task/publish",
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify({'id': g_task_id, 'tcsOtpPassCode': tcsOtpPassCode}),
        contentType: "application/json",
        sse_enable : "no",  // BlockUI 로딩 메시지 표시 안함
        success    : function(result) {
            // AI 채팅창을 통한 발행인 경우 리다이렉션 하지 않음
            if (window.isAiChatPublish) {
                console.log("AI 채팅창을 통한 발행 - 리다이렉션 없이 메시지만 표시");
                // AI 채팅창에 결과 메시지 표시 (task_dtl.html의 done/fail 핸들러에서 처리)
                // 플래그 초기화
                window.isAiChatPublish = false;
            } else {
                // 일반 발행 버튼 클릭 시에는 기존 동작 유지 (메시지 + 리다이렉션)
                opme_message(result["resultMsg"], function () {
                    if (result["resultCode"] == "EM0000") {
                        document.location.href = "/task"
                    }
                });
            }
        }
    });
};

// TASK 폐기
function discardTask() {
    return $.ajax({
        url        : "/task/discard",
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify({'id': g_task_id}),
        contentType: "application/json",
        success    : function(result) {
            opme_message(result["resultMsg"], function () {
                if (result["resultCode"] == "EM0000") {
                    document.location.href = "/task"
                }
            });
        }
    });
};

function popupDryrun(param) {

    return $.ajax({
        url        : '/execution/target_list',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(param),
        contentType: "application/json",
        success    : function(result) {
            if (result['resultCode'] != 'EM0000') {
                opme_message("[" + result['resultCode'] + "] " + result['resultMsg']);
                return;
            }

            let userParam = {
                'task_id'    : param['task_id'],
                'rev_no'     : param['rev_no'],
                'login_id'   : opme_getLoginId(),
                'target_list': result['executionNodeList'],
            }

            $a.popup({
                url    : '/execution/p_dry_run',
                title  : '태스크 모의 실행',
                iframe : true,  // default 는 true
                width  : 1200,
                movable: true,
                data   : {'mode': 'single', 'user_param': userParam},
                // callback: callback,
            });
        }
    });
};

// 태스크 비교 처리
function setDiffData(param) {

    let info_str = "#base_info"
                 + ",#script_info"
                 + ",#target_info"
                 + ",#schedule_info"
                 + ",#runnable_time_info"
                 + ",#trigger_info"
                 + ",#permission_info"
                 + ",#notilist_info"
                 + ",#history_info";

    let left_div_str = "#base_info > div:first-child"
                     + ",#script_info > div:first-child"
                     + ",#target_info > div:first-child"
                     + ",#schedule_info > div:first-child"
                     + ",#runnable_time_info > div:first-child"
                     + ",#trigger_info > div:first-child"
                     + ",#permission_info > div:first-child"
                     + ",#notilist_info > div:first-child"
                     + ",#history_info > div:first-child";

    let right_div_str = "#base_info > div:last-child"
                      + ",#script_info > div:last-child"
                      + ",#target_info > div:last-child"
                      + ",#schedule_info > div:last-child"
                      + ",#runnable_time_info > div:last-child"
                      + ",#trigger_info > div:last-child"
                      + ",#permission_info > div:last-child"
                      + ",#notilist_info > div:last-child"
                      + ",#history_info > div:last-child";

    // 1. Set Display
    // 1.1 View component
    $("#btn_diff_close").show();
    $(info_str).addClass("half-layout");
    $(right_div_str).show();
    $(left_div_str).addClass("half-contents");
    $(right_div_str).addClass("half-contents");
    if (g_task_id == '') {
        $("#history_info").show();
    }

    // 1.2 Resize left grid
    $("#target_grid"       ).alopexGrid('updateOption', { width: "parent" });
    $("#schedule_grid"     ).alopexGrid('updateOption', { width: "parent" });
    $("#runnable_time_grid").alopexGrid('updateOption', { width: "parent" });
    $("#trigger_grid"      ).alopexGrid('updateOption', { width: "parent" });
    $("#permission_grid"   ).alopexGrid('updateOption', { width: "parent" });
    $("#notilist_grid"     ).alopexGrid('updateOption', { width: "parent" });

    // 1.3. Set height of table's row (for Diff)
    let th_cnt1 = $("#base_info > div:first-child th").length;
    for (let i=0; i<th_cnt1; i++) {
        let th_h = $("#base_info > div:first-child th:eq(" + i + ")").height();
        $("#base_info > div:last-child th:eq(" + i + ")").height(th_h);
    }

    let th_cnt2 = $("#script_info > div:first-child th").length;
    for (let i=0; i<th_cnt2; i++) {
        let th_h = $("#script_info > div:first-child th:eq(" + i + ")").height();
        $("#script_info > div:last-child th:eq(" + i + ")").height(th_h);
    }

    let th_cnt3 = $("#history_info > div:first-child th").length;
    for (let i=0; i<th_cnt3; i++) {
        let th_h = $("#history_info > div:first-child th:eq(" + i + ")").height();
        $("#history_info > div:last-child th:eq(" + i + ")").height(th_h);
    }

    // 2. Set Data
    // 2.1. base_info
    $("#id2"         ).text(param["id"]);
    $("#revision_no2").text(param["revNo"]);
    $("#owner_id2"   ).text(param["ownerUserId"]);
    $("#publish_id2" ).text(param["publishableUserId"]);
    $("#description2").text(param["description"]);
    $("#cutoffperiod2").text(param["cutOffPeriod"]);

    // 2.2. script_info
    $('#script_separator2').setData({
        data           : g_separator_arr,
        option_selected: param['script_line_separator'] // 최초 선택값 설정.
    });

    $('#script_encoding2').setData({
        data           : g_encoding_arr,
        option_selected: param['script_encode'] // 최초 선택값 설정.
    });

    $("#script_name2").text(param["scriptName"]);
    $("#script_account2").text(param["scriptAccount"]);
    $("#script_description2").text(param["scriptDescription"]);

    let script_line_sep = '\n'; // LF (Linux)
    if (param['script_line_separator'] != 'LF') {
        script_line_sep = '\r\n'; // CRLF (Windows)
    }

    let textarea = $('#script_content2');
    if (typeof g_editor2 !== 'undefined') {
        g_editor2.toTextArea(); // Clear CodeMirror Data.
    }
    g_editor2 = CodeMirror.fromTextArea(textarea[0], {
        lineNumbers  : true,
        lineWrapping : true,
        lineSeparator: script_line_sep,
        theme        : 'rubyblue', // 테마 변경 시에는 html 에서 테마에 해당하는 css 를 추가.
        readOnly     : 'nocursor',
        // val          : textarea.val(),
        // autoRefresh: true
    });
    g_editor2.setSize(null, 500);
    g_editor2.setValue(decodeURIComponent(escape(atob(param['base64ScriptContent']))));
    g_editor2.refresh();

    // CodeMirror Syntax Mode 변경.
    changeSyntaxMode(g_editor2, $('#script_name2').text());

    // 2.3. target_info
    // - Dictionary to String : tag
    for (let i = 0; i < param['targetList'].length; i++) {
        if (jQuery.isEmptyObject(param['targetList'][i]['tag'])) {
            param['targetList'][i]['tag'] = null;
            continue;
        }
        param['targetList'][i]['tag'] = opme_dictToStr(param['targetList'][i]['tag']);
    }
    $('#target_grid2').alopexGrid('dataSet', param['targetList']);

    // 2.4. schedule_info
    $('#schedule_grid2').alopexGrid('dataSet', param['scheduleList']);

    // 2.5. runnable_time_info
    $('#runnable_time_grid2').alopexGrid('dataSet', param['runnableTimeList']);

    // 2.6. trigger_info
    $('#trigger_grid2').alopexGrid('dataSet', param['trigList']);

    // 2.7. permission_info
    $('#permission_grid2').alopexGrid('dataSet', param['permissionList']);

    // 2.8. notilist_info
    $('#notilist_grid2').alopexGrid('dataSet', param['notiList']);

    // Grid 데이터가 증가하면, height 를 고정시키고, Scroll 처리.
    let pageInfo = $('#target_grid2').alopexGrid('pageInfo');
    if (pageInfo['dataLength'] > g_grid_scroll_cnt) {
        $("#target_grid2").alopexGrid('updateOption', {height: '500px'});
    }

    pageInfo = $('#schedule_grid2').alopexGrid('pageInfo');
    if (pageInfo['dataLength'] > g_grid_scroll_cnt) {
        $("#schedule_grid2").alopexGrid('updateOption', {height: '500px'});
    }

    pageInfo = $('#runnable_time_grid2').alopexGrid('pageInfo');
    if (pageInfo['dataLength'] > g_grid_scroll_cnt) {
        $("#runnable_time_grid2").alopexGrid('updateOption', {height: '500px'});
    }

    pageInfo = $('#trigger_grid2').alopexGrid('pageInfo');
    if (pageInfo['dataLength'] > g_grid_scroll_cnt) {
        $("#trigger_grid2").alopexGrid('updateOption', {height: '500px'});
    }

    pageInfo = $('#permission_grid2').alopexGrid('pageInfo');
    if (pageInfo['dataLength'] > g_grid_scroll_cnt) {
        $("#permission_grid2").alopexGrid('updateOption', {height: '500px'});
    }

    // 2.8. history_info
    let history_info = $('#history_info table:last td');
    let crt_date     = opme_formatUTCString(param['crtDate']);
    let upd_date     = opme_formatUTCString(param['updDate']);

    let pub_date = "-";
    if (param['publishDate'] != null) pub_date = opme_formatUTCString(param['publishDate']);
    let pub_user = (param['publishUserId'] == null) ? '-' : param['publishUserId'];

    history_info.eq(0).text(param['crtUserId']);
    history_info.eq(1).text(crt_date);
    history_info.eq(2).text(param['updUserId']);
    history_info.eq(3).text(upd_date);
    history_info.eq(4).text(pub_user);
    history_info.eq(5).text(pub_date);

    // 3. Draw center line
    $(".half-vertical-line").show();
    resizeVerticalLine();

    return;
};

// 태스크 비교 닫기
function closeDiffData() {

    let info_str = "#base_info"
                 + ",#script_info"
                 + ",#target_info"
                 + ",#schedule_info"
                 + ",#runnable_time_info"
                 + ",#trigger_info"
                 + ",#permission_info"
                 + ",#notilist_info"
                 + ",#history_info";

    let left_div_str = "#base_info > div:first-child"
                     + ",#script_info > div:first-child"
                     + ",#target_info > div:first-child"
                     + ",#schedule_info > div:first-child"
                     + ",#runnable_time_info > div:first-child"
                     + ",#trigger_info > div:first-child"
                     + ",#permission_info > div:first-child"
                     + ",#notilist_info > div:first-child"
                     + ",#history_info > div:first-child";

    let right_div_str = "#base_info > div:last-child"
                      + ",#script_info > div:last-child"
                      + ",#target_info > div:last-child"
                      + ",#schedule_info > div:last-child"
                      + ",#runnable_time_info > div:last-child"
                      + ",#trigger_info > div:last-child"
                      + ",#permission_info > div:last-child"
                      + ",#notilist_info > div:last-child"
                      + ",#history_info > div:last-child";

    $('#btn_diff_close').hide();
    $('.half-vertical-line').hide();

    $(info_str).removeClass("half-layout");
    $(right_div_str).hide();
    $(left_div_str).removeClass("half-contents");
    $(right_div_str).removeClass("half-contents");

    $('#target_grid'       ).alopexGrid('updateOption', { width: "parent" });
    $('#schedule_grid'     ).alopexGrid('updateOption', { width: "parent" });
    $('#runnable_time_grid').alopexGrid('updateOption', { width: "parent" });
    $('#trigger_grid'      ).alopexGrid('updateOption', { width: "parent" });
    $('#permission_grid'   ).alopexGrid('updateOption', { width: "parent" });
    $('#notilist_grid'     ).alopexGrid('updateOption', { width: "parent" });

    if (g_task_id == '') {
        $("#history_info").hide();
    }

    return;
};

// Folding
function setFoldInfoEvent() {
    $('#btn_base_info_fold').on('click', function(e) {
        if ($('#base_info table').css('display') === 'none') {
            $('#btn_base_info_fold').removeClass("btn-arrow_down");
            $('#btn_base_info_fold').addClass("btn-arrow_up");
            $('#base_info table').show();
        } else {
            $('#btn_base_info_fold').removeClass("btn-arrow_up");
            $('#btn_base_info_fold').addClass("btn-arrow_down");
            $('#base_info table').hide();
        }

        resizeVerticalLine();
    });

    $('#btn_script_info_fold').on('click', function(e) {
        if ($('#script_info table').css('display') === 'none') {
            $('#btn_script_info_fold').removeClass("btn-arrow_down");
            $('#btn_script_info_fold').addClass("btn-arrow_up");
            $('#script_info table').show();
            $('#script_info .btn-right').show();
        } else {
            $('#btn_script_info_fold').removeClass("btn-arrow_up");
            $('#btn_script_info_fold').addClass("btn-arrow_down");
            $('#script_info table').hide();
            $('#script_info .btn-right').hide();
        }

        resizeVerticalLine();
    });

    $('#btn_target_info_fold').on('click', function(e) {
        if ($('#target_info .list').css('display') === 'none') {
            $('#btn_target_info_fold').removeClass("btn-arrow_down");
            $('#btn_target_info_fold').addClass("btn-arrow_up");
            $('#target_info .list').show();
            $('#target_info .btn-right').show();
        } else {
            $('#btn_target_info_fold').removeClass("btn-arrow_up");
            $('#btn_target_info_fold').addClass("btn-arrow_down");
            $('#target_info .list').hide();
            $('#target_info .btn-right').hide();
        }

        resizeVerticalLine();
    });

    $('#btn_schedule_info_fold').on('click', function(e) {
        if ($('#schedule_info .list').css('display') === 'none') {
            $('#btn_schedule_info_fold').removeClass("btn-arrow_down");
            $('#btn_schedule_info_fold').addClass("btn-arrow_up");
            $('#schedule_info .list').show();
            $('#schedule_info .btn-right').show();
        } else {
            $('#btn_schedule_info_fold').removeClass("btn-arrow_up");
            $('#btn_schedule_info_fold').addClass("btn-arrow_down");
            $('#schedule_info .list').hide();
            $('#schedule_info .btn-right').hide();
        }

        resizeVerticalLine();
    });

    $('#btn_runnable_time_info_fold').on('click', function(e) {
        if ($('#runnable_time_info .list').css('display') === 'none') {
            $('#btn_runnable_time_info_fold').removeClass("btn-arrow_down");
            $('#btn_runnable_time_info_fold').addClass("btn-arrow_up");
            $('#runnable_time_info .list').show();
            $('#runnable_time_info .btn-right').show();
        } else {
            $('#btn_runnable_time_info_fold').removeClass("btn-arrow_up");
            $('#btn_runnable_time_info_fold').addClass("btn-arrow_down");
            $('#runnable_time_info .list').hide();
            $('#runnable_time_info .btn-right').hide();
        }

        resizeVerticalLine();
    });

    $('#btn_trigger_info_fold').on('click', function(e) {
        if ($('#trigger_info .list').css('display') === 'none') {
            $('#btn_trigger_info_fold').removeClass("btn-arrow_down");
            $('#btn_trigger_info_fold').addClass("btn-arrow_up");
            $('#trigger_info .list').show();
            $('#trigger_info .btn-right').show();
        } else {
            $('#btn_trigger_info_fold').removeClass("btn-arrow_up");
            $('#btn_trigger_info_fold').addClass("btn-arrow_down");
            $('#trigger_info .list').hide();
            $('#trigger_info .btn-right').hide();
        }

        resizeVerticalLine();
    });

    $('#btn_permission_info_fold').on('click', function(e) {
        if ($('#permission_info .list').css('display') === 'none') {
            $('#btn_permission_info_fold').removeClass("btn-arrow_down");
            $('#btn_permission_info_fold').addClass("btn-arrow_up");
            $('#permission_info .list').show();
            $('#permission_info .btn-right').show();
        } else {
            $('#btn_permission_info_fold').removeClass("btn-arrow_up");
            $('#btn_permission_info_fold').addClass("btn-arrow_down");
            $('#permission_info .list').hide();
            $('#permission_info .btn-right').hide();
        }

        resizeVerticalLine();
    });

    $('#btn_history_info_fold').on('click', function(e) {
        if ($('#history_info table').css('display') === 'none') {
            $('#btn_history_info_fold').removeClass("btn-arrow_down");
            $('#btn_history_info_fold').addClass("btn-arrow_up");
            $('#history_info table').show();
        } else {
            $('#btn_history_info_fold').removeClass("btn-arrow_up");
            $('#btn_history_info_fold').addClass("btn-arrow_down");
            $('#history_info table').hide();
        }

        resizeVerticalLine();
    });

    return;
};

function resizeVerticalLine() {
    if ($(".half-vertical-line").css("display") === "none") {
        return;
    }

    let xPosition = $("#base_info > div:first-child .con_title").offset().top
                    + $("#base_info > div:first-child .con_title").outerHeight(true);
    let yPosition = $(".btn-wrap.btn-right").offset().top
                    - parseInt($(".btn-wrap.btn-right").css('margin-top'))
                    - xPosition;
    $(".half-vertical-line").offset({top: xPosition});
    $(".half-vertical-line").height(yPosition);

    return;
};

// 유효성 검사
function validate() {

    if (!validateInput($("#id")))           return false;
    if (!validateInput($("#owner_id")))     return false;
    if (!validateInput($("#publish_id")))   return false;
    if (!validateInput($("#description")))  return false;
    if (!validateInput($("#cutoffperiod"))) return false;
    if (!validateScript())                  return false;

    if (g_editor.getValue() == '') {
        g_editor.focus();
        return "[내용] 을 입력하세요.";
    }

    // nodeset account 에 두 개 이상의 계정을 입력 했는지 검출.
    let nodeset_account = $('#target_grid').alopexGrid('dataGet', function(data) {

        if (data._state['deleted'] == true) {
            return false;
        }

        if (data.account == '' || typeof data.account === 'undefined') {
            return false;
        }

        if (data.account.indexOf(',') == -1) {
            return false;
        }

        return true;
    });

    if (nodeset_account.length != 0) {
        return "[실행대상정보] OS 계정 은 단일계정만 가능합니다.";
    }

    // nodeset - 설명 valid
    let nodeset_description = $('#target_grid').alopexGrid('dataGet', function(data) {
        return data._state['deleted'] == false && data.description.length > 500;
    });

    if (nodeset_description.length != 0) {
        return "[실행대상정보] 설명 은 500자 이하로 입력하세요.";
    }

    let trigger_result = $('#trigger_grid').alopexGrid('dataGet', function(data) {
        return data._state['deleted'] == false
                && (data.taskResult == '' || typeof data.taskResult === 'undefined');
    });

    if (trigger_result.length != 0) {
        return "[트리거정보] 조건을 입력하세요.";
    }

    let trigger_time = $('#trigger_grid').alopexGrid('dataGet', function(data) {

        // XOR - time ^ timeUnit
        // 둘 중에 하나만 값이 있는 경우
        if (data._state['deleted'] == false
            && ((typeof data.time === 'undefined' || data.time == '')
            ^ (typeof data.timeUnit === 'undefined' || data.timeUnit == ''))) {
            return true;
        }

        // 둘다 값이 없는 경우, "즉시" 수행으로 처리됨
        if (data._state['deleted'] == false
            && ((typeof data.time === 'undefined' || data.time == '')
            && (typeof data.timeUnit === 'undefined' || data.timeUnit == ''))) {
            return false;
        }

        // time 에 숫자가 아닌 값이 있는 지 체크
        // trigger 시간 입력 숫자 0 처리. 0010 -> 10으로
        data.time = parseInt(data.time).toString();
        if (data._state['deleted'] == false && opme_isNumber(data.time) == false) {
            return true;
        }

        return false;
    });

    if (trigger_time.length != 0) {
        return "[트리거정보] 를 확인하세요.<br/>시간은 양의 정수만 입력 가능 하고,<br/>시간/단위는 둘 중 하나만 입력할 수 없습니다.";
    }

    return true;
};

function validateScript() {

    if (!validateInput($("#script_name")))      return false;
    if (!validateInput($("#script_account")))   return false;
    if (!validateInput($("#script_description")))   return false;
    if (!validateInput($("#script_separator"))) return false;
    if (!validateInput($("#script_encoding")))  return false;

    return true;
};

function validateInput(target) {

    // 유효하지 않은 필드는 Skip.
    if (target.css("display") == "none") {
        return true;
    }

    let target_id  = target.attr("id");
    let target_val = target.val();
    let focus_yn   = true;  // Set focus
    let title_yn   = false; // .con-title > .btn-right (script_separator, script_encoding)
    let msg        = "";
    let max_len    = 0;

    switch (target_id) {
        case "id":
            max_len = 100;
            if (target_val.length == 0) {
                msg = "[태스크 ID] 를 입력하세요.";
            } else if (target_val.length > max_len) {
                msg = "[태스크 ID] 는 " + max_len + "자리 이하로 입력하세요.";
            } else if (target.attr("data-check-result") == "fail") {
                msg = "[태스크 ID] 의 사용 가능 여부를 확인하세요.";
            }
            break;
        case "owner_id":
            max_len = 20;
            if (target_val.length == 0) {
                msg = "[소유자 ID] 를 입력하세요.";
            } else if (target_val.length > max_len) {
                msg = "[소유자 ID] 는 " + max_len + "자리 이하로 입력하세요.";
            }
            break;
        case "publish_id":
            // Self 발행 가능 여부 확인
            // * OPMM_PUBLISHER_SEPARATE_ENABLE
            //   - 'yes': Publisher is anyone except for myself
            //   - 'no' : Publisher is myself
            max_len = 20;
            if (target_val.length == 0 && self_pub_enable != "no") {
                msg = "[발행자 ID] 를 입력하세요.";
            } else if (target_val.length > max_len) {
                msg = "[발행자 ID] 는 " + max_len + "자리 이하로 입력하세요.";
            }
            break;
        case "description":
            max_len = 500;
            if (target_val.length > max_len) {
                msg = "[설명] 은 " + max_len + "자리 이하로 입력하세요.";
            }
            break;
        case "cutoffperiod":
            max_len = 3;
            let cutoffperiod_regexp = new RegExp('^(0?[1-9]|[1-5][0-9]|60)m$');

            if (target_val.length != 0 && cutoffperiod_regexp.test(target_val) == false) {
                msg = "[강제마감시간] 은 1 ~ 60m 까지 가능합니다.";
            }
            break;
        case "script_separator":
            title_yn = true;
            if (target_val == null) {
                msg = "[파일 유형] 을 선택하세요.";
            }
            break;
        case "script_encoding":
            title_yn = true;
            if (target_val == null) {
                msg = "[파일 인코딩] 을 선택하세요.";
            }
            break;
        case "script_name":
            max_len = 200;
            let file_name_regexp = new RegExp('.+\.(ps1|vbs|sh|cmd|bat)$');

            if (target_val.length == 0) {
                msg = "[파일명] 을 입력하세요.";
            } else if (target_val.length > max_len) {
                msg = "[파일명] 을 " + max_len + "자리 이하로 입력하세요.";
            } else if (file_name_regexp.test(target_val) == false) {
                msg = "[파일명] 은 다음의 확장자만 사용 가능합니다.(ps1,vbs,sh,cmd,bat)";
            } else {
                changeSyntaxMode(g_editor, target_val);
            }
            break;
        case "script_account":
            max_len = 20;
            if (target_val.length == 0) {
                msg = "[실행계정] 을 입력하세요.";
            } else if (target_val.length > max_len) {
                msg = "[실행계정] 은 " + max_len + "자리 이하로 입력하세요.";
            }
            break;
        case "script_description":
            max_len = 500;
            if (target_val.length > max_len) {
                msg = "[실행인자] 은 " + max_len + "자리 이하로 입력하세요.";
            }
            break;
    }

    // Validation Check : ERROR
    if (msg != "") {

        if (title_yn) {
            target.parent().siblings(".title-txt").hide();
        }

        target.siblings(".validation_msg").html(msg);
        target.siblings(".validation_msg").slideDown();

        if (focus_yn) target.focus();

        // 자기 자신과 권한 등에 의해 Disabled 처리된 Component 는 제외하고,
        // Validation Check 대상인 Select Box 처리
        $('.Select.validation_tgt, .btn-ico').not('#' + target_id).not('.Disabled').prop('disabled', true);

        return false;
    }

    // Validation Check : SUCCESS
    target.siblings(".validation_msg").html();
    target.siblings(".validation_msg").slideUp();

    if (title_yn) {
        target.parent().siblings(".title-txt").show();
    }

    // 자기 자신과 권한 등에 의해 Disabled 처리된 Component 는 제외하고,
    // Validation Check 대상인 Select Box 처리
    $('.Select.validation_tgt, .btn-ico').not('#' + target_id).not('.Disabled').prop('disabled', false);

    return true;
};

// OPMM TCS 활성화 추가
function popupTcsOtp() {
    opme_popupTcsOtp('TCS 인증', 'single', '', function(data) {

        let result = false;
        if (data != null && data != undefined ) {
            if(data.result == 'success'){
                // AI 채팅창을 통한 발행인 경우 done/fail 핸들러로 결과 처리
                if (window.isAiChatPublish) {
                    publishTask(data.tcsOtpPassCode).done(function(publishResult) {
                        console.log("✅ 태스크 발행 완료 (TCS OTP):", publishResult);
                        if (publishResult["resultCode"] == "EM0000") {
                            // AI 채팅창에 성공 메시지 표시
                            if (typeof addAiMessage === 'function') {
                                addAiMessage('✅ 태스크가 성공적으로 발행되었습니다!\n\n' + publishResult["resultMsg"]);

                                // 태스크 저장 및 발행 완료 후 세션 데이터 초기화 및 환영 메시지 표시
                                console.log("🔄 세션 데이터 초기화 시작... (TCS OTP)");

                                // 세션 데이터 초기화 API 호출
                                $.ajax({
                                    url: "/task/ai_chat",
                                    type: "POST",
                                    dataType: "json",
                                    data: JSON.stringify({
                                        message: "__CLEAR_SESSION__",
                                        chat_mode: (typeof chatMode !== 'undefined' ? chatMode : 'agent'),
                                        task_id: g_task_id
                                    }),
                                    contentType: "application/json",
                                    sse_enable: "no",  // BlockUI 로딩 메시지 표시 안함
                                    success: function(result) {
                                        console.log("✅ 세션 초기화 완료 (TCS OTP):", result);

                                        if (typeof syncExistingTaskContext === 'function') {
                                            syncExistingTaskContext();
                                        }

                                        // 채팅 기록 초기화 (환영 메시지만 남기고)
                                        clearChatHistory();

                                        // 환영 메시지 다시 표시
                                        initWelcomeMessage();

                                        addAiMessage('🎉 모든 작업이 완료되었습니다!\n\n생성된 태스크에서 **스크립트 수정** 또는 **스크립트 리뷰**를 요청해 주세요.\n\n\'스크립트 수정\' 또는 \'스크립트 리뷰\'라고 입력하면 다음 단계를 안내해 드릴게요.');

                                        console.log("✅ 화면 초기화 완료 (TCS OTP)");
                                    },
                                    error: function(xhr, status, error) {
                                        console.error("⚠️ 세션 초기화 실패 (계속 진행, TCS OTP):", error);
                                        // 실패해도 환영 메시지는 표시
                                        if (typeof syncExistingTaskContext === 'function') {
                                            syncExistingTaskContext();
                                        }
                                        clearChatHistory();
                                        initWelcomeMessage();
                                        addAiMessage('🎉 모든 작업이 완료되었습니다!\n\n생성된 태스크에서 **스크립트 수정** 또는 **스크립트 리뷰**를 요청해 주세요.\n\n\'스크립트 수정\' 또는 \'스크립트 리뷰\'라고 입력하면 다음 단계를 안내해 드릴게요.');
                                    }
                                });
                            }
                        } else {
                            if (typeof addAiMessage === 'function') {
                                addAiMessage('⚠️ 태스크 발행 실패: ' + publishResult["resultMsg"]);
                            }
                        }
                        // 플래그 초기화는 publishTask 내부에서 처리됨
                    }).fail(function(xhr, status, error) {
                        console.error("❌ 태스크 발행 AJAX 실패 (TCS OTP):", xhr, status, error);
                        if (typeof addAiMessage === 'function') {
                            addAiMessage('❌ 태스크 발행 중 오류가 발생했습니다.\n\n오류: ' + (xhr.responseText || error));
                        }
                        window.isAiChatPublish = false;
                    });
                } else {
                    // 일반 발행 버튼 클릭 시에는 기존 동작 유지
                    publishTask(data.tcsOtpPassCode);
                }
                result = true;
            }
        }

        if(result == false){
            let msg = "[Invalid] TCS 인증 정보가 입력되지 않았습니다.";
            if (window.isAiChatPublish) {
                if (typeof addAiMessage === 'function') {
                    addAiMessage('❌ TCS 인증 정보가 입력되지 않았습니다.');
                }
                window.isAiChatPublish = false;
            } else {
                opme_message(msg);
            }
        }
    });

};
