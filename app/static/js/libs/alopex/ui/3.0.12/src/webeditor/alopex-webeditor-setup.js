$a.setup({
	defaultComponentClass: {
		webEditor: 'WebEditor',
		webeditor: 'Webeditor'
	}
});

$a.widget.webEditor = $a.widget.webeditor = $a.inherit($a.widget.object, {
	widgetName: 'webeditor',
	properties: {
		height: 300,
	},
	init: function(el, options){
		var opts = $.extend(true, {}, this.properties, options);
		opts	= this.setLocale(opts); //lsh
		$(el).webeditor(opts);
	},
	setLocale: function(param){
		/**
		 * [ALOPEXUI-288]
		 * 다국어 처리를 위한 설정. alopex global 셋업 적용 및 컴포넌트 개별 셋업 시 적용
		 * global 설정이 되어있더라도 컴포넌트 개별 공통 셋업이 있으면 개별 공통 셋업으로 적용
		 */
		var localeStr = 'ko';
		if($.alopex.util.isValid($.alopex.config.locale)){
			localeStr = $.alopex.config.locale;
		};
		if ($.alopex.util.isValid(param) && param.hasOwnProperty('lang')) {
			localeStr = param.lang;
		};
		if ($.alopex.util.isValid(param) && param.hasOwnProperty('locale')) {
			localeStr = param.locale;
		};
		localeStr = localeStr.split('-')[0].toLowerCase();


		var options = $.extend(true, {},param, {lang : localeStr});
		var language ={};
		language[localeStr] = $.alopex.config.language[localeStr].webeditor;
		$.extend(true,$.webeditor.lang,language)

		return options;
	},
});
