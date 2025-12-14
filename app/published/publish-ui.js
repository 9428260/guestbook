$a.setup('datepicker', {
	showbottom: true,
});

$a.page(function(){
    this.init = function(){
        //left menu open close
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

        //left sub menu toggle
        var lnbSub = $('nav > ul > li');
        $(lnbSub).find('.lnb-sub').parent().addClass('expandable');

        if($(lnbSub).hasClass('expandable')){
            var lnbSubExpand = $('nav > ul > li.expandable > a');
            $(lnbSubExpand).click(function(e){
                e.preventDefault();
                $(this).parent().find('.lnb-sub').slideToggle();
                $(this).parent().toggleClass('expanded');
                $(this).toggleClass('selected');
            });
        };

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

        //상단버튼 0730
        $(".drop_btn").click( function(){
            $(this).toggleClass('drop_close');
            $(".user-menus").slideToggle();
        });

        //tab menu -0713추가
        $(".tab_cont").hide();
        $(".tab_cont:first").show();
        $("ul.tab_list li").click(function () {
            $("ul.tab_list li").removeClass("active");
            $(this).addClass("active");
            $(".tab_cont").hide()
            var activeTab = $(this).attr("rel");
            $("#" + activeTab).fadeIn()
        });


        //user box click event
    //	var user = $('.user');
    //	var userBox = $('.user-menus');
    //	userBox.hide();
    //	$(user).click(function(e){
    //		e.preventDefault();
    //		if(userBox.css('display') === 'none') {
    //			userBox.show();
    //			$(user).addClass('close');
    //		} else {
    //			userBox.hide();
    //			$(user).removeClass('close');
    //		}
    //	});
    //
    //
    //	//popup
    //	$('#popup-hwinfo').on('click', function() {
    //			$a.popup({
    //					url: "infra-25_2.html",
    //					width: 900,
    //					height: 650,
    //					title : "H/W 펌웨어 정보",
    //			});
    //	});
    }
});