$a.page(function(){
    this.init = function(id, param){

	    initData(param);
        setFileUpload();
        setEventListener();
    }
});

function setEventListener(){

    // 추가
    $("#btn_upload").on("click", function(e) {
        $("#file_upload").startUpload();
    });

    // 닫기
    $("#btn_close").on("click", function(e) {
        $a.close();
    });
};

// 초기 데이터 요청
function initData(param) {
    $('#filehub_id').val(param['filehub_id']);
    $('#path').val(param['path']);

    return;
};

function setFileUpload() {
    let uploadResult = {};

    $("#file_upload").setOptions({
        url              : '/file/upload',
        fileName         : 'uploadFiles',
        // maxTotalFileSize: 5242880,
        maxTotalFileSize : 300 * 1024 * 1024, // 300MB
        maxFileCount     : 5,
        duplicateErrorStr: "이미 동일한 이름의 파일이 존재합니다. 파일명을 변경해주세요.",
        showDelete       : false, // 파일상태영역 "삭제"
        showDownload     : false, // 파일상태영역 "파일다운로드"
//        showFileSize: true, // 파일명 "파일사이즈"
//        showFileCounter: false, // 파일명 "index 숫자"
//        showButtonGroup: true, // "전체선택", "전체취소", "선택삭제", "파일추가"
//        showCheckedAll: true, // "전체선택"
//        showUnCheckedAll: true, // "전체취소"
//        showDeleteChecked: true, // "선택삭제"
//        showAddFile: true, // "파일추가"
//        showDone: true, // 파일상태영역 "완료"
//        showCancel: false, // 파일상태영역 "취소"
//        showAbort: false, // 파일상태영역 "중단"
//        showPreview: true, // 파일상태영역 "이미지프리뷰"
//        showStatusAfterSuccess: true, // 파일상태영역 "전송완료된 파일내역"
        dynamicFormData: function() {
            let data = { "filehub_id": $('#filehub_id').val()
                         , "path": $('#path').val()
                         , "overwrite": $("#overwrite_yn").getValue() }
            return data;
        },
        onLoad: function (obj) {
        },
        onSelect: function (files) {
        },
        onSuccess: function (files, data, xhr, pd) {
            if (data['resultCode'] == 'EM0000') {
                uploadResult[files[0]] = '[성공]';
            } else if (data['resultCode'] == 'EM0999') {
                uploadResult[files[0]] = '[중복]';
            } else {
                uploadResult[files[0]] = '[오류] (' + data['resultCode'] + ' - ' + data['resultMsg'] + ')';
            }
        },
        onError: function (files, status, errMsg, pd, xhr) {
            if (status == 'error') { // 'error' : BackEnd Error
                uploadResult[files[0]] = '[오류] (' + errMsg + ')';
            } else { // 'Alert' : FrontEnd Error
                opme_message(errMsg);
            }
        },
        afterUploadAll: function (obj) {
            let resultStr = '';
            for (let key in uploadResult) {
                let str = uploadResult[key] + " " + key + "<br/>";
		        $("#file_upload").clearFile(uploadResult[key]);
                delete uploadResult[key];
                resultStr += str;
            }
            opme_message(resultStr);
        },
        doneCallback: function (fileInfo, pd) {
		    //완료 시에 완료한 파일에 대한 목록 삭제
		    $("#file_upload").clearFile(fileInfo);
	    },
	    deleteCallback: function (fileInfo, pd) {
		    $("#file_upload").clearFile(fileInfo);
	    },
	    onCancel: function (fileInfo, pd) {
		    $("#file_upload").clearFile(fileInfo);
	    },
    });
};
