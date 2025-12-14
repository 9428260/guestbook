// 화면 레이아웃 설정
$(document).ready(function(){

    // 조회
    $(btn_sel).click(function(e) {
        $(r_color).css("backgroundColor", $(i_rgb).val());
        return;
    });

    // 초기화
    $(btn_init).click(function(e) {
        $(i_rgb).val('');
        $(r_color).css("backgroundColor", "white");
        return;
    });
});