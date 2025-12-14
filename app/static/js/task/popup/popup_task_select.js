$a.page(function(){
	this.init = function(id, param) {
	    initData(param);
	    setEventListener();
    };
});

function setEventListener() {
    // Go Rev. 0(편집중/미발행)
    $("#btn_go_editing").on("click", function(e){
        $a.close({'go_rev_zero_yn': true});
    });

    // Go Rev. XX(실행중/발행)
    $("#btn_go_running").on("click", function(e){
        $a.close({'go_rev_zero_yn': false});
    });

    return;
};

function initData(param) {

    // 부모창으로부터 데이터가 전달되는 경우.
    if (param['user_param'] != null) {
        // let task_id     = param['user_param']['id'];
        let revision_no = param['user_param']['rev_no'];
        $('#btn_go_running').html("Running(Rev. " + revision_no + ")");
    }

    return;
};