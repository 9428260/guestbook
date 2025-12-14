//Multi-select 컴포넌트
$a.setup({
	defaultComponentClass: {
		multiSelect: 'MultiSelect', multiselect: 'Multiselect',
		splitter: 'Splitter',
		fileUpload: 'FileUpload',
		fileupload: 'Fileupload'
	}
});

$a.widget.multiSelect = $a.widget.multiselect = $a.inherit($a.widget.object, {
	widgetName: 'multiSelect',
	setters: ['multipleselect', 'refresh'],
	getters: ['isOpen', 'getChecked', 'getButton', 'widget', 'getMultiselectButton'],

	properties: {
		multiple: true,
		noneSelectedText: "선택하세요",
		header: true,
		minWidth: 180,
		menuWidth:null,
		selectedList: 2,
		checkAllText: '전체선택',
		uncheckAllText: '전체해제',
		selectedText: '#개 선택됨',
		classes: 'MultiSelect',
		filter: true,
		label: '필터',
		placeholder: '검색어를 입력하세요',
		checkedheader:true,
		htmlBind: true,
		position : 'bottom'
	},

	// 새로운 컴포넌트의 동작이나 마크업등을 설정하는 부분입니다. 사용자는 $el을 이용하여 커스텀하게 마크업, 스타일등을 만들어낼 수 있습니다.
	init: function(el, options) {
			var $el = $(el);
			$el.attr('multiple', 'multiple');

			el.opts = $.extend(true, {}, this.properties, options);
			el.opts	= this.setLocale(el.opts); //lsh
			el.opts.classes = $el.attr('class');
			if (el.opts.filter){
				$el.multiselect(el.opts).multiselectfilter(el.opts);
			} else{
				$el.multiselect(el.opts);
			}
			//LSH
			el.button = $(el).next('button.ui-multiselect')[0];
			return;
	},
	setLocale: function(param){
		/**
		 * [ALOPEXUI-288]
		 * 다국어 처리를 위한 설정. alopex global 셋업 적용 및 컴포넌트 개별 셋업 시 적용
		 * global 설정이 되어있더라도 컴포넌트 개별 공통 셋업이 있으면 개별 공통 셋업으로 적용
		 */
		var options = {};

		var localeStr = 'ko';
		if($.alopex.util.isValid($.alopex.config.locale)){
			localeStr = $.alopex.config.locale;
		};
		if ($.alopex.util.isValid(param) && param.hasOwnProperty('locale')) {
			localeStr = param.locale;
		};
		localeStr = localeStr.toLowerCase();
		var localeObj = {};
		localeObj = $.alopex.config.language[localeStr].multiselect;

		var options = $.extend(true, {},param, localeObj);
		return options;
	},
	refresh: function(el) {
			$(el).multiselect('refresh');
	},
	getMultiselectButton: function(el) {
		return el.button;
	},
	open : function(el){
		$(el).multiselect('open');
	},
	close : function(el){
		$(el).multiselect('close');
	}
});

//splitter_panel
$a.widget.splitter = $a.inherit($a.widget.object, {
	widgetName: 'splitter',
	properties: {
		position: '50%',
		limit: 10,
		orientation: 'horizontal'
	},
	init: function(el, options){
		var opts = $.extend(true, {}, this.properties, options);
		$(el).split({
				orientation: opts.orientation,
				limit: opts.limit,
				position: opts.position
		});
	},
	setOptions: function(el, options){
		var opts = $.extend(true, {}, $(el).data("splitter").settings, options);
		$(el).split().destroy();
		return $(el).split(opts);
	}
});

//file upload
$a.widget.fileUpload = $a.widget.fileupload = $a.inherit($a.widget.object, {
	widgetName: 'fileUpload',
	properties: {
		url : '',
		fileName : 'uploadFiles',
		multiple : true,
		dragDrop:false,
		dragdropWidth : '100%',
		allowDuplicates : false,
		showQueueDiv : false,
		sequential : true,
		sequentialCount : 1,
		autoSubmit : false,
		showCancel : true,
		showDone : true,
		showDelete: true,
		showDownload:true,
		showAbort : true,
		showPreview : true,
		//allowedTypes : "jpg,png,gif",
		//acceptFiles : "image/",
		dragDropStr : "<div class='fileupload-box'>여기에 파일을 끌어다 놓으세요</div>",
		multiDragErrorStr: "멀티 파일 Drag &amp; Drop 실패입니다.",
		duplicateErrorStr: "이미 존재하는 파일입니다.",
		extErrorStr:"허용되지 않는 확장자입니다.허용되는 확장자 : ",
		sizeErrorStr:"허용 파일 용량을 초과하였습니다. 최대 파일 용량 : ",
		maxFileCountErrorStr: "허용 파일 갯수를 초과하였습니다. 최대 파일 갯수 : ",
		uploadErrorStr:"업로드가 실패하였습니다.",
		uploadStr: '파일 추가',
		checkAllStr : '전체 선택',
		unCheckAllStr : '전체 해제',
		checkedDeleteStr : '선택 삭제',
		abortButtonClass: "Button",
		cancelButtonClass: "Button",
		uploadButtonClass: "Button",

		showFileCounter : false,
		showStatusAfterSuccess : true,
		showCheckedAll: true,
		showUnCheckedAll: true,
		showDeleteChecked: true,
		showAddFile: true,
		showButtonGroup: true,
		onSelect : function(files) {

		},
		onSuccess:function(files,data,xhr,pd)	{

		},
		selecttype : "basic"
	},
	setters: ['fileUpload', 'setOptions','startUpload','stopUpload','cancelAll','checkAll','unCheckAll','checkDelete','removeElement','clearFile'],
	getters: ['getFileCount','getResponses'],

	init: function(el, options){

		var opts = $.extend(true, {}, this.properties, options);
		opts	= this.setLocale(opts); //lsh
		var varId ="output"+(new Date().getTime());
		var prvCon='';
		if (opts.selecttype== 'basic'){
			opts.dragDrop =false;
			opts.maxFileCount = 1;
			opts.multiple = false;
			opts.showDelete = false;
			opts.showDownload = false;
			opts.showPreview = false;
			opts.showProgress = false;
			opts.showFileCounter = false;

			opts.customProgressBar= function(obj,s)	{
				this.statusbar = $("<div></div>");
				this.filename = $("<span class='onefile-text'></span>").appendTo(this.statusbar);
				var progressBox = $("<span></span>").appendTo(this.statusbar);
				this.progressDiv = $("<span>").appendTo(progressBox).hide();
				this.progressbar = $("<span>").appendTo(this.progressDiv);
				var btnBox = $("<div class='onefile-button'></div>").appendTo(this.statusbar);
				this.abort = $("<button class='Button Onlyicon abort'><span class='Icon Pause' data-position='top'></span></button>").appendTo(btnBox).hide();
				this.cancel = $("<button class='Button Onlyicon cancel'><span class='Icon Remove' data-position='top'></span></button>").appendTo(btnBox).hide();
				this.done = $("<button class='Button Onlyicon done'><span class='Icon Ok' data-position='top'></span></button>").appendTo(btnBox).hide();
				this.download = $("<button class='Button Onlyicon download'><span class='Icon Download' data-position='top'></span></button>").appendTo(btnBox).hide();
				this.del = $("<button class='Button Onlyicon del'><span class='Icon Trash' data-position='top'></span></button>").appendTo(btnBox).hide();
				$a.convert(this.statusbar);
				return this;
			}
			prvCon += '<div id="'+varId +'" class="onefile"></div>'
			$(el).after(prvCon);
				opts.showQueueDiv=varId;
				$(el).addClass("file-oneupload")

		} else {
			opts.customProgressBar= function(obj,s)	{

				this.statusbar = $("<div class='preview-list'></div>");
				var contentBox = $("<div class='preview-contents'></div>").appendTo(this.statusbar);
				var fileBox = $("<div class='preview-title'></div>").appendTo(contentBox);
				var iCheckBox = $("<label class='ImageCheckbox'></label>").appendTo(fileBox)
				var checkbox = $("<input class='Checkbox'  type='checkbox' name='fileSelect"+varId+"'>").appendTo(iCheckBox);
				//this.preview = $("<img />").width(s.previewWidth).height(s.previewHeight).appendTo(fileBox).hide();
				this.preview = $("<img class='preview-img'/>").appendTo(iCheckBox).hide();

				this.filename = $("<span class='multifile-text'></span>").appendTo(fileBox);
				var progressBox = $("<div class='preview-progress'></div>").appendTo(contentBox);
				this.progressDiv = $("<div class='Progressbar'>").appendTo(progressBox).hide();
				this.progressbar = $("<div style='position: relative; left: 0px; height: 8px; border: 0px none rgb(0, 0, 0);'></div>").appendTo(this.progressDiv);
				var btnBox = $("<div class='preview-btn'></div>").appendTo(contentBox);
				this.abort = $("<button class='Button Onlyicon abort'><span class='Icon Pause' data-position='top'></span></button>").appendTo(btnBox).hide();
				this.cancel = $("<button class='Button Onlyicon cancel'><span class='Icon Remove' data-position='top'></span></button>").appendTo(btnBox).hide();
				this.done = $("<button class='Button Onlyicon done'><span class='Icon Ok' data-position='top'></span></button>").appendTo(btnBox).hide();
								this.download = $("<button class='Button Onlyicon download'><span class='Icon Download-alt' data-position='top'></span></button>").appendTo(btnBox).hide();
				this.del = $("<button class='Button Onlyicon del'><span class='Icon Trash' data-position='top'></span></button>").appendTo(btnBox).hide();
				$a.convert(this.statusbar);
				return this;
			}
			prvCon += '<div id="'+varId +'" class="preview-container"></div>'
			$(el).after(prvCon);
			opts.showQueueDiv=varId;
			opts.multiple = true;
		}
		el.uploadObj=$(el).uploadFile(opts);
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
		if ($.alopex.util.isValid(param) && param.hasOwnProperty('locale')) {
			localeStr = param.locale;
		};
		localeStr = localeStr.toLowerCase();
		var localeObj = {};
		localeObj = $.alopex.config.language[localeStr].fileupload;
		var options = $.extend(true, {},param, localeObj);
		return options;
	},
	setOptions: function(el, options) {
		el.uploadObj.update(options);
	},
	startUpload: function(el) {
		el.uploadObj.startUpload();
	},
	stopUpload: function(el) {
		el.uploadObj.stopUpload();
	},
	cancelAll: function(el) {
		el.uploadObj.cancelAll();
	},
	getFileCount : function(el){
		return el.uploadObj.getFileCount();
	},
	removeElement : function(el){
		el.uploadObj.remove();
	},
	getResponses : function(el){
		return el.uploadObj.getResponses();
	},
	clearFile: function(el, fileName) {
		el.uploadObj.clearFile(fileName);
	}
});
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm11bHRpc2VsZWN0LXNldHVwLmpzIiwic3BsaXR0ZXItc2V0dXAuanMiLCJmaWxldXBsb2FkLXNldHVwLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3RGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImFsb3BleC1leHQtc2V0dXAuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvL011bHRpLXNlbGVjdCDsu7Ttj6zrhIztirhcclxuJGEuc2V0dXAoe1xyXG5cdGRlZmF1bHRDb21wb25lbnRDbGFzczoge1xyXG5cdFx0bXVsdGlTZWxlY3Q6ICdNdWx0aVNlbGVjdCcsIG11bHRpc2VsZWN0OiAnTXVsdGlzZWxlY3QnLFxyXG5cdFx0c3BsaXR0ZXI6ICdTcGxpdHRlcicsXHJcblx0XHRmaWxlVXBsb2FkOiAnRmlsZVVwbG9hZCcsXHJcblx0XHRmaWxldXBsb2FkOiAnRmlsZXVwbG9hZCdcclxuXHR9XHJcbn0pO1xyXG5cclxuJGEud2lkZ2V0Lm11bHRpU2VsZWN0ID0gJGEud2lkZ2V0Lm11bHRpc2VsZWN0ID0gJGEuaW5oZXJpdCgkYS53aWRnZXQub2JqZWN0LCB7XHJcblx0d2lkZ2V0TmFtZTogJ211bHRpU2VsZWN0JyxcclxuXHRzZXR0ZXJzOiBbJ211bHRpcGxlc2VsZWN0JywgJ3JlZnJlc2gnXSxcclxuXHRnZXR0ZXJzOiBbJ2lzT3BlbicsICdnZXRDaGVja2VkJywgJ2dldEJ1dHRvbicsICd3aWRnZXQnLCAnZ2V0TXVsdGlzZWxlY3RCdXR0b24nXSxcclxuXHJcblx0cHJvcGVydGllczoge1xyXG5cdFx0bXVsdGlwbGU6IHRydWUsXHJcblx0XHRub25lU2VsZWN0ZWRUZXh0OiBcIuyEoO2Dne2VmOyEuOyalFwiLFxyXG5cdFx0aGVhZGVyOiB0cnVlLFxyXG5cdFx0bWluV2lkdGg6IDE4MCxcclxuXHRcdG1lbnVXaWR0aDpudWxsLFxyXG5cdFx0c2VsZWN0ZWRMaXN0OiAyLFxyXG5cdFx0Y2hlY2tBbGxUZXh0OiAn7KCE7LK07ISg7YOdJyxcclxuXHRcdHVuY2hlY2tBbGxUZXh0OiAn7KCE7LK07ZW07KCcJyxcclxuXHRcdHNlbGVjdGVkVGV4dDogJyPqsJwg7ISg7YOd65CoJyxcclxuXHRcdGNsYXNzZXM6ICdNdWx0aVNlbGVjdCcsXHJcblx0XHRmaWx0ZXI6IHRydWUsXHJcblx0XHRsYWJlbDogJ+2VhO2EsCcsXHJcblx0XHRwbGFjZWhvbGRlcjogJ+qygOyDieyWtOulvCDsnoXroKXtlZjshLjsmpQnLFxyXG5cdFx0Y2hlY2tlZGhlYWRlcjp0cnVlLFxyXG5cdFx0aHRtbEJpbmQ6IHRydWUsXHJcblx0XHRwb3NpdGlvbiA6ICdib3R0b20nXHJcblx0fSxcclxuXHJcblx0Ly8g7IOI66Gc7Jq0IOy7tO2PrOuEjO2KuOydmCDrj5nsnpHsnbTrgpgg66eI7YGs7JeF65Ox7J2EIOyEpOygle2VmOuKlCDrtoDrtoTsnoXri4jri6QuIOyCrOyaqeyekOuKlCAkZWzsnYQg7J207Jqp7ZWY7JesIOy7pOyKpO2FgO2VmOqyjCDrp4jtgazsl4UsIOyKpO2DgOydvOuTseydhCDrp4zrk6TslrTrgrwg7IiYIOyeiOyKteuLiOuLpC5cclxuXHRpbml0OiBmdW5jdGlvbihlbCwgb3B0aW9ucykge1xyXG5cdFx0XHR2YXIgJGVsID0gJChlbCk7XHJcblx0XHRcdCRlbC5hdHRyKCdtdWx0aXBsZScsICdtdWx0aXBsZScpO1xyXG5cclxuXHRcdFx0ZWwub3B0cyA9ICQuZXh0ZW5kKHRydWUsIHt9LCB0aGlzLnByb3BlcnRpZXMsIG9wdGlvbnMpO1xyXG5cdFx0XHRlbC5vcHRzXHQ9IHRoaXMuc2V0TG9jYWxlKGVsLm9wdHMpOyAvL2xzaFxyXG5cdFx0XHRlbC5vcHRzLmNsYXNzZXMgPSAkZWwuYXR0cignY2xhc3MnKTtcclxuXHRcdFx0aWYgKGVsLm9wdHMuZmlsdGVyKXtcclxuXHRcdFx0XHQkZWwubXVsdGlzZWxlY3QoZWwub3B0cykubXVsdGlzZWxlY3RmaWx0ZXIoZWwub3B0cyk7XHJcblx0XHRcdH0gZWxzZXtcclxuXHRcdFx0XHQkZWwubXVsdGlzZWxlY3QoZWwub3B0cyk7XHJcblx0XHRcdH1cclxuXHRcdFx0Ly9MU0hcclxuXHRcdFx0ZWwuYnV0dG9uID0gJChlbCkubmV4dCgnYnV0dG9uLnVpLW11bHRpc2VsZWN0JylbMF07XHJcblx0XHRcdHJldHVybjtcclxuXHR9LFxyXG5cdHNldExvY2FsZTogZnVuY3Rpb24ocGFyYW0pe1xyXG5cdFx0LyoqXHJcblx0XHQgKiBbQUxPUEVYVUktMjg4XVxyXG5cdFx0ICog64uk6rWt7Ja0IOyymOumrOulvCDsnITtlZwg7ISk7KCVLiBhbG9wZXggZ2xvYmFsIOyFi+yXhSDsoIHsmqkg67CPIOy7tO2PrOuEjO2KuCDqsJzrs4Qg7IWL7JeFIOyLnCDsoIHsmqlcclxuXHRcdCAqIGdsb2JhbCDshKTsoJXsnbQg65CY7Ja07J6I642U652864+EIOy7tO2PrOuEjO2KuCDqsJzrs4Qg6rO17Ya1IOyFi+yXheydtCDsnojsnLzrqbQg6rCc67OEIOqzte2GtSDshYvsl4XsnLzroZwg7KCB7JqpXHJcblx0XHQgKi9cclxuXHRcdHZhciBvcHRpb25zID0ge307XHJcblxyXG5cdFx0dmFyIGxvY2FsZVN0ciA9ICdrbyc7XHJcblx0XHRpZigkLmFsb3BleC51dGlsLmlzVmFsaWQoJC5hbG9wZXguY29uZmlnLmxvY2FsZSkpe1xyXG5cdFx0XHRsb2NhbGVTdHIgPSAkLmFsb3BleC5jb25maWcubG9jYWxlO1xyXG5cdFx0fTtcclxuXHRcdGlmICgkLmFsb3BleC51dGlsLmlzVmFsaWQocGFyYW0pICYmIHBhcmFtLmhhc093blByb3BlcnR5KCdsb2NhbGUnKSkge1xyXG5cdFx0XHRsb2NhbGVTdHIgPSBwYXJhbS5sb2NhbGU7XHJcblx0XHR9O1xyXG5cdFx0bG9jYWxlU3RyID0gbG9jYWxlU3RyLnRvTG93ZXJDYXNlKCk7XHJcblx0XHR2YXIgbG9jYWxlT2JqID0ge307XHJcblx0XHRsb2NhbGVPYmogPSAkLmFsb3BleC5jb25maWcubGFuZ3VhZ2VbbG9jYWxlU3RyXS5tdWx0aXNlbGVjdDtcclxuXHJcblx0XHR2YXIgb3B0aW9ucyA9ICQuZXh0ZW5kKHRydWUsIHt9LHBhcmFtLCBsb2NhbGVPYmopO1xyXG5cdFx0cmV0dXJuIG9wdGlvbnM7XHJcblx0fSxcclxuXHRyZWZyZXNoOiBmdW5jdGlvbihlbCkge1xyXG5cdFx0XHQkKGVsKS5tdWx0aXNlbGVjdCgncmVmcmVzaCcpO1xyXG5cdH0sXHJcblx0Z2V0TXVsdGlzZWxlY3RCdXR0b246IGZ1bmN0aW9uKGVsKSB7XHJcblx0XHRyZXR1cm4gZWwuYnV0dG9uO1xyXG5cdH0sXHJcblx0b3BlbiA6IGZ1bmN0aW9uKGVsKXtcclxuXHRcdCQoZWwpLm11bHRpc2VsZWN0KCdvcGVuJyk7XHJcblx0fSxcclxuXHRjbG9zZSA6IGZ1bmN0aW9uKGVsKXtcclxuXHRcdCQoZWwpLm11bHRpc2VsZWN0KCdjbG9zZScpO1xyXG5cdH1cclxufSk7XHJcbiIsIi8vc3BsaXR0ZXJfcGFuZWxcclxuJGEud2lkZ2V0LnNwbGl0dGVyID0gJGEuaW5oZXJpdCgkYS53aWRnZXQub2JqZWN0LCB7XHJcblx0d2lkZ2V0TmFtZTogJ3NwbGl0dGVyJyxcclxuXHRwcm9wZXJ0aWVzOiB7XHJcblx0XHRwb3NpdGlvbjogJzUwJScsXHJcblx0XHRsaW1pdDogMTAsXHJcblx0XHRvcmllbnRhdGlvbjogJ2hvcml6b250YWwnXHJcblx0fSxcclxuXHRpbml0OiBmdW5jdGlvbihlbCwgb3B0aW9ucyl7XHJcblx0XHR2YXIgb3B0cyA9ICQuZXh0ZW5kKHRydWUsIHt9LCB0aGlzLnByb3BlcnRpZXMsIG9wdGlvbnMpO1xyXG5cdFx0JChlbCkuc3BsaXQoe1xyXG5cdFx0XHRcdG9yaWVudGF0aW9uOiBvcHRzLm9yaWVudGF0aW9uLFxyXG5cdFx0XHRcdGxpbWl0OiBvcHRzLmxpbWl0LFxyXG5cdFx0XHRcdHBvc2l0aW9uOiBvcHRzLnBvc2l0aW9uXHJcblx0XHR9KTtcclxuXHR9LFxyXG5cdHNldE9wdGlvbnM6IGZ1bmN0aW9uKGVsLCBvcHRpb25zKXtcclxuXHRcdHZhciBvcHRzID0gJC5leHRlbmQodHJ1ZSwge30sICQoZWwpLmRhdGEoXCJzcGxpdHRlclwiKS5zZXR0aW5ncywgb3B0aW9ucyk7XHJcblx0XHQkKGVsKS5zcGxpdCgpLmRlc3Ryb3koKTtcclxuXHRcdHJldHVybiAkKGVsKS5zcGxpdChvcHRzKTtcclxuXHR9XHJcbn0pO1xyXG4iLCIvL2ZpbGUgdXBsb2FkXHJcbiRhLndpZGdldC5maWxlVXBsb2FkID0gJGEud2lkZ2V0LmZpbGV1cGxvYWQgPSAkYS5pbmhlcml0KCRhLndpZGdldC5vYmplY3QsIHtcclxuXHR3aWRnZXROYW1lOiAnZmlsZVVwbG9hZCcsXHJcblx0cHJvcGVydGllczoge1xyXG5cdFx0dXJsIDogJycsXHJcblx0XHRmaWxlTmFtZSA6ICd1cGxvYWRGaWxlcycsXHJcblx0XHRtdWx0aXBsZSA6IHRydWUsXHJcblx0XHRkcmFnRHJvcDpmYWxzZSxcclxuXHRcdGRyYWdkcm9wV2lkdGggOiAnMTAwJScsXHJcblx0XHRhbGxvd0R1cGxpY2F0ZXMgOiBmYWxzZSxcclxuXHRcdHNob3dRdWV1ZURpdiA6IGZhbHNlLFxyXG5cdFx0c2VxdWVudGlhbCA6IHRydWUsXHJcblx0XHRzZXF1ZW50aWFsQ291bnQgOiAxLFxyXG5cdFx0YXV0b1N1Ym1pdCA6IGZhbHNlLFxyXG5cdFx0c2hvd0NhbmNlbCA6IHRydWUsXHJcblx0XHRzaG93RG9uZSA6IHRydWUsXHJcblx0XHRzaG93RGVsZXRlOiB0cnVlLFxyXG5cdFx0c2hvd0Rvd25sb2FkOnRydWUsXHJcblx0XHRzaG93QWJvcnQgOiB0cnVlLFxyXG5cdFx0c2hvd1ByZXZpZXcgOiB0cnVlLFxyXG5cdFx0Ly9hbGxvd2VkVHlwZXMgOiBcImpwZyxwbmcsZ2lmXCIsXHJcblx0XHQvL2FjY2VwdEZpbGVzIDogXCJpbWFnZS9cIixcclxuXHRcdGRyYWdEcm9wU3RyIDogXCI8ZGl2IGNsYXNzPSdmaWxldXBsb2FkLWJveCc+7Jes6riw7JeQIO2MjOydvOydhCDrgYzslrTri6Qg64aT7Jy87IS47JqUPC9kaXY+XCIsXHJcblx0XHRtdWx0aURyYWdFcnJvclN0cjogXCLrqYDti7Ag7YyM7J28IERyYWcgJmFtcDsgRHJvcCDsi6TtjKjsnoXri4jri6QuXCIsXHJcblx0XHRkdXBsaWNhdGVFcnJvclN0cjogXCLsnbTrr7gg7KG07J6s7ZWY64qUIO2MjOydvOyeheuLiOuLpC5cIixcclxuXHRcdGV4dEVycm9yU3RyOlwi7ZeI7Jqp65CY7KeAIOyViuuKlCDtmZXsnqXsnpDsnoXri4jri6Qu7ZeI7Jqp65CY64qUIO2ZleyepeyekCA6IFwiLFxyXG5cdFx0c2l6ZUVycm9yU3RyOlwi7ZeI7JqpIO2MjOydvCDsmqnrn4nsnYQg7LSI6rO87ZWY7JiA7Iq164uI64ukLiDstZzrjIAg7YyM7J28IOyaqeufiSA6IFwiLFxyXG5cdFx0bWF4RmlsZUNvdW50RXJyb3JTdHI6IFwi7ZeI7JqpIO2MjOydvCDqsK/siJjrpbwg7LSI6rO87ZWY7JiA7Iq164uI64ukLiDstZzrjIAg7YyM7J28IOqwr+yImCA6IFwiLFxyXG5cdFx0dXBsb2FkRXJyb3JTdHI6XCLsl4XroZzrk5zqsIAg7Iuk7Yyo7ZWY7JiA7Iq164uI64ukLlwiLFxyXG5cdFx0dXBsb2FkU3RyOiAn7YyM7J28IOy2lOqwgCcsXHJcblx0XHRjaGVja0FsbFN0ciA6ICfsoITssrQg7ISg7YOdJyxcclxuXHRcdHVuQ2hlY2tBbGxTdHIgOiAn7KCE7LK0IO2VtOygnCcsXHJcblx0XHRjaGVja2VkRGVsZXRlU3RyIDogJ+yEoO2DnSDsgq3soJwnLFxyXG5cdFx0YWJvcnRCdXR0b25DbGFzczogXCJCdXR0b25cIixcclxuXHRcdGNhbmNlbEJ1dHRvbkNsYXNzOiBcIkJ1dHRvblwiLFxyXG5cdFx0dXBsb2FkQnV0dG9uQ2xhc3M6IFwiQnV0dG9uXCIsXHJcblxyXG5cdFx0c2hvd0ZpbGVDb3VudGVyIDogZmFsc2UsXHJcblx0XHRzaG93U3RhdHVzQWZ0ZXJTdWNjZXNzIDogdHJ1ZSxcclxuXHRcdHNob3dDaGVja2VkQWxsOiB0cnVlLFxyXG5cdFx0c2hvd1VuQ2hlY2tlZEFsbDogdHJ1ZSxcclxuXHRcdHNob3dEZWxldGVDaGVja2VkOiB0cnVlLFxyXG5cdFx0c2hvd0FkZEZpbGU6IHRydWUsXHJcblx0XHRzaG93QnV0dG9uR3JvdXA6IHRydWUsXHJcblx0XHRvblNlbGVjdCA6IGZ1bmN0aW9uKGZpbGVzKSB7XHJcblxyXG5cdFx0fSxcclxuXHRcdG9uU3VjY2VzczpmdW5jdGlvbihmaWxlcyxkYXRhLHhocixwZClcdHtcclxuXHJcblx0XHR9LFxyXG5cdFx0c2VsZWN0dHlwZSA6IFwiYmFzaWNcIlxyXG5cdH0sXHJcblx0c2V0dGVyczogWydmaWxlVXBsb2FkJywgJ3NldE9wdGlvbnMnLCdzdGFydFVwbG9hZCcsJ3N0b3BVcGxvYWQnLCdjYW5jZWxBbGwnLCdjaGVja0FsbCcsJ3VuQ2hlY2tBbGwnLCdjaGVja0RlbGV0ZScsJ3JlbW92ZUVsZW1lbnQnLCdjbGVhckZpbGUnXSxcclxuXHRnZXR0ZXJzOiBbJ2dldEZpbGVDb3VudCcsJ2dldFJlc3BvbnNlcyddLFxyXG5cclxuXHRpbml0OiBmdW5jdGlvbihlbCwgb3B0aW9ucyl7XHJcblxyXG5cdFx0dmFyIG9wdHMgPSAkLmV4dGVuZCh0cnVlLCB7fSwgdGhpcy5wcm9wZXJ0aWVzLCBvcHRpb25zKTtcclxuXHRcdG9wdHNcdD0gdGhpcy5zZXRMb2NhbGUob3B0cyk7IC8vbHNoXHJcblx0XHR2YXIgdmFySWQgPVwib3V0cHV0XCIrKG5ldyBEYXRlKCkuZ2V0VGltZSgpKTtcclxuXHRcdHZhciBwcnZDb249Jyc7XHJcblx0XHRpZiAob3B0cy5zZWxlY3R0eXBlPT0gJ2Jhc2ljJyl7XHJcblx0XHRcdG9wdHMuZHJhZ0Ryb3AgPWZhbHNlO1xyXG5cdFx0XHRvcHRzLm1heEZpbGVDb3VudCA9IDE7XHJcblx0XHRcdG9wdHMubXVsdGlwbGUgPSBmYWxzZTtcclxuXHRcdFx0b3B0cy5zaG93RGVsZXRlID0gZmFsc2U7XHJcblx0XHRcdG9wdHMuc2hvd0Rvd25sb2FkID0gZmFsc2U7XHJcblx0XHRcdG9wdHMuc2hvd1ByZXZpZXcgPSBmYWxzZTtcclxuXHRcdFx0b3B0cy5zaG93UHJvZ3Jlc3MgPSBmYWxzZTtcclxuXHRcdFx0b3B0cy5zaG93RmlsZUNvdW50ZXIgPSBmYWxzZTtcclxuXHJcblx0XHRcdG9wdHMuY3VzdG9tUHJvZ3Jlc3NCYXI9IGZ1bmN0aW9uKG9iaixzKVx0e1xyXG5cdFx0XHRcdHRoaXMuc3RhdHVzYmFyID0gJChcIjxkaXY+PC9kaXY+XCIpO1xyXG5cdFx0XHRcdHRoaXMuZmlsZW5hbWUgPSAkKFwiPHNwYW4gY2xhc3M9J29uZWZpbGUtdGV4dCc+PC9zcGFuPlwiKS5hcHBlbmRUbyh0aGlzLnN0YXR1c2Jhcik7XHJcblx0XHRcdFx0dmFyIHByb2dyZXNzQm94ID0gJChcIjxzcGFuPjwvc3Bhbj5cIikuYXBwZW5kVG8odGhpcy5zdGF0dXNiYXIpO1xyXG5cdFx0XHRcdHRoaXMucHJvZ3Jlc3NEaXYgPSAkKFwiPHNwYW4+XCIpLmFwcGVuZFRvKHByb2dyZXNzQm94KS5oaWRlKCk7XHJcblx0XHRcdFx0dGhpcy5wcm9ncmVzc2JhciA9ICQoXCI8c3Bhbj5cIikuYXBwZW5kVG8odGhpcy5wcm9ncmVzc0Rpdik7XHJcblx0XHRcdFx0dmFyIGJ0bkJveCA9ICQoXCI8ZGl2IGNsYXNzPSdvbmVmaWxlLWJ1dHRvbic+PC9kaXY+XCIpLmFwcGVuZFRvKHRoaXMuc3RhdHVzYmFyKTtcclxuXHRcdFx0XHR0aGlzLmFib3J0ID0gJChcIjxidXR0b24gY2xhc3M9J0J1dHRvbiBPbmx5aWNvbiBhYm9ydCc+PHNwYW4gY2xhc3M9J0ljb24gUGF1c2UnIGRhdGEtcG9zaXRpb249J3RvcCc+PC9zcGFuPjwvYnV0dG9uPlwiKS5hcHBlbmRUbyhidG5Cb3gpLmhpZGUoKTtcclxuXHRcdFx0XHR0aGlzLmNhbmNlbCA9ICQoXCI8YnV0dG9uIGNsYXNzPSdCdXR0b24gT25seWljb24gY2FuY2VsJz48c3BhbiBjbGFzcz0nSWNvbiBSZW1vdmUnIGRhdGEtcG9zaXRpb249J3RvcCc+PC9zcGFuPjwvYnV0dG9uPlwiKS5hcHBlbmRUbyhidG5Cb3gpLmhpZGUoKTtcclxuXHRcdFx0XHR0aGlzLmRvbmUgPSAkKFwiPGJ1dHRvbiBjbGFzcz0nQnV0dG9uIE9ubHlpY29uIGRvbmUnPjxzcGFuIGNsYXNzPSdJY29uIE9rJyBkYXRhLXBvc2l0aW9uPSd0b3AnPjwvc3Bhbj48L2J1dHRvbj5cIikuYXBwZW5kVG8oYnRuQm94KS5oaWRlKCk7XHJcblx0XHRcdFx0dGhpcy5kb3dubG9hZCA9ICQoXCI8YnV0dG9uIGNsYXNzPSdCdXR0b24gT25seWljb24gZG93bmxvYWQnPjxzcGFuIGNsYXNzPSdJY29uIERvd25sb2FkJyBkYXRhLXBvc2l0aW9uPSd0b3AnPjwvc3Bhbj48L2J1dHRvbj5cIikuYXBwZW5kVG8oYnRuQm94KS5oaWRlKCk7XHJcblx0XHRcdFx0dGhpcy5kZWwgPSAkKFwiPGJ1dHRvbiBjbGFzcz0nQnV0dG9uIE9ubHlpY29uIGRlbCc+PHNwYW4gY2xhc3M9J0ljb24gVHJhc2gnIGRhdGEtcG9zaXRpb249J3RvcCc+PC9zcGFuPjwvYnV0dG9uPlwiKS5hcHBlbmRUbyhidG5Cb3gpLmhpZGUoKTtcclxuXHRcdFx0XHQkYS5jb252ZXJ0KHRoaXMuc3RhdHVzYmFyKTtcclxuXHRcdFx0XHRyZXR1cm4gdGhpcztcclxuXHRcdFx0fVxyXG5cdFx0XHRwcnZDb24gKz0gJzxkaXYgaWQ9XCInK3ZhcklkICsnXCIgY2xhc3M9XCJvbmVmaWxlXCI+PC9kaXY+J1xyXG5cdFx0XHQkKGVsKS5hZnRlcihwcnZDb24pO1xyXG5cdFx0XHRcdG9wdHMuc2hvd1F1ZXVlRGl2PXZhcklkO1xyXG5cdFx0XHRcdCQoZWwpLmFkZENsYXNzKFwiZmlsZS1vbmV1cGxvYWRcIilcclxuXHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRvcHRzLmN1c3RvbVByb2dyZXNzQmFyPSBmdW5jdGlvbihvYmoscylcdHtcclxuXHJcblx0XHRcdFx0dGhpcy5zdGF0dXNiYXIgPSAkKFwiPGRpdiBjbGFzcz0ncHJldmlldy1saXN0Jz48L2Rpdj5cIik7XHJcblx0XHRcdFx0dmFyIGNvbnRlbnRCb3ggPSAkKFwiPGRpdiBjbGFzcz0ncHJldmlldy1jb250ZW50cyc+PC9kaXY+XCIpLmFwcGVuZFRvKHRoaXMuc3RhdHVzYmFyKTtcclxuXHRcdFx0XHR2YXIgZmlsZUJveCA9ICQoXCI8ZGl2IGNsYXNzPSdwcmV2aWV3LXRpdGxlJz48L2Rpdj5cIikuYXBwZW5kVG8oY29udGVudEJveCk7XHJcblx0XHRcdFx0dmFyIGlDaGVja0JveCA9ICQoXCI8bGFiZWwgY2xhc3M9J0ltYWdlQ2hlY2tib3gnPjwvbGFiZWw+XCIpLmFwcGVuZFRvKGZpbGVCb3gpXHJcblx0XHRcdFx0dmFyIGNoZWNrYm94ID0gJChcIjxpbnB1dCBjbGFzcz0nQ2hlY2tib3gnICB0eXBlPSdjaGVja2JveCcgbmFtZT0nZmlsZVNlbGVjdFwiK3ZhcklkK1wiJz5cIikuYXBwZW5kVG8oaUNoZWNrQm94KTtcclxuXHRcdFx0XHQvL3RoaXMucHJldmlldyA9ICQoXCI8aW1nIC8+XCIpLndpZHRoKHMucHJldmlld1dpZHRoKS5oZWlnaHQocy5wcmV2aWV3SGVpZ2h0KS5hcHBlbmRUbyhmaWxlQm94KS5oaWRlKCk7XHJcblx0XHRcdFx0dGhpcy5wcmV2aWV3ID0gJChcIjxpbWcgY2xhc3M9J3ByZXZpZXctaW1nJy8+XCIpLmFwcGVuZFRvKGlDaGVja0JveCkuaGlkZSgpO1xyXG5cclxuXHRcdFx0XHR0aGlzLmZpbGVuYW1lID0gJChcIjxzcGFuIGNsYXNzPSdtdWx0aWZpbGUtdGV4dCc+PC9zcGFuPlwiKS5hcHBlbmRUbyhmaWxlQm94KTtcclxuXHRcdFx0XHR2YXIgcHJvZ3Jlc3NCb3ggPSAkKFwiPGRpdiBjbGFzcz0ncHJldmlldy1wcm9ncmVzcyc+PC9kaXY+XCIpLmFwcGVuZFRvKGNvbnRlbnRCb3gpO1xyXG5cdFx0XHRcdHRoaXMucHJvZ3Jlc3NEaXYgPSAkKFwiPGRpdiBjbGFzcz0nUHJvZ3Jlc3NiYXInPlwiKS5hcHBlbmRUbyhwcm9ncmVzc0JveCkuaGlkZSgpO1xyXG5cdFx0XHRcdHRoaXMucHJvZ3Jlc3NiYXIgPSAkKFwiPGRpdiBzdHlsZT0ncG9zaXRpb246IHJlbGF0aXZlOyBsZWZ0OiAwcHg7IGhlaWdodDogOHB4OyBib3JkZXI6IDBweCBub25lIHJnYigwLCAwLCAwKTsnPjwvZGl2PlwiKS5hcHBlbmRUbyh0aGlzLnByb2dyZXNzRGl2KTtcclxuXHRcdFx0XHR2YXIgYnRuQm94ID0gJChcIjxkaXYgY2xhc3M9J3ByZXZpZXctYnRuJz48L2Rpdj5cIikuYXBwZW5kVG8oY29udGVudEJveCk7XHJcblx0XHRcdFx0dGhpcy5hYm9ydCA9ICQoXCI8YnV0dG9uIGNsYXNzPSdCdXR0b24gT25seWljb24gYWJvcnQnPjxzcGFuIGNsYXNzPSdJY29uIFBhdXNlJyBkYXRhLXBvc2l0aW9uPSd0b3AnPjwvc3Bhbj48L2J1dHRvbj5cIikuYXBwZW5kVG8oYnRuQm94KS5oaWRlKCk7XHJcblx0XHRcdFx0dGhpcy5jYW5jZWwgPSAkKFwiPGJ1dHRvbiBjbGFzcz0nQnV0dG9uIE9ubHlpY29uIGNhbmNlbCc+PHNwYW4gY2xhc3M9J0ljb24gUmVtb3ZlJyBkYXRhLXBvc2l0aW9uPSd0b3AnPjwvc3Bhbj48L2J1dHRvbj5cIikuYXBwZW5kVG8oYnRuQm94KS5oaWRlKCk7XHJcblx0XHRcdFx0dGhpcy5kb25lID0gJChcIjxidXR0b24gY2xhc3M9J0J1dHRvbiBPbmx5aWNvbiBkb25lJz48c3BhbiBjbGFzcz0nSWNvbiBPaycgZGF0YS1wb3NpdGlvbj0ndG9wJz48L3NwYW4+PC9idXR0b24+XCIpLmFwcGVuZFRvKGJ0bkJveCkuaGlkZSgpO1xyXG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5kb3dubG9hZCA9ICQoXCI8YnV0dG9uIGNsYXNzPSdCdXR0b24gT25seWljb24gZG93bmxvYWQnPjxzcGFuIGNsYXNzPSdJY29uIERvd25sb2FkLWFsdCcgZGF0YS1wb3NpdGlvbj0ndG9wJz48L3NwYW4+PC9idXR0b24+XCIpLmFwcGVuZFRvKGJ0bkJveCkuaGlkZSgpO1xyXG5cdFx0XHRcdHRoaXMuZGVsID0gJChcIjxidXR0b24gY2xhc3M9J0J1dHRvbiBPbmx5aWNvbiBkZWwnPjxzcGFuIGNsYXNzPSdJY29uIFRyYXNoJyBkYXRhLXBvc2l0aW9uPSd0b3AnPjwvc3Bhbj48L2J1dHRvbj5cIikuYXBwZW5kVG8oYnRuQm94KS5oaWRlKCk7XHJcblx0XHRcdFx0JGEuY29udmVydCh0aGlzLnN0YXR1c2Jhcik7XHJcblx0XHRcdFx0cmV0dXJuIHRoaXM7XHJcblx0XHRcdH1cclxuXHRcdFx0cHJ2Q29uICs9ICc8ZGl2IGlkPVwiJyt2YXJJZCArJ1wiIGNsYXNzPVwicHJldmlldy1jb250YWluZXJcIj48L2Rpdj4nXHJcblx0XHRcdCQoZWwpLmFmdGVyKHBydkNvbik7XHJcblx0XHRcdG9wdHMuc2hvd1F1ZXVlRGl2PXZhcklkO1xyXG5cdFx0XHRvcHRzLm11bHRpcGxlID0gdHJ1ZTtcclxuXHRcdH1cclxuXHRcdGVsLnVwbG9hZE9iaj0kKGVsKS51cGxvYWRGaWxlKG9wdHMpO1xyXG5cdH0sXHJcblx0c2V0TG9jYWxlOiBmdW5jdGlvbihwYXJhbSl7XHJcblx0XHQvKipcclxuXHRcdCAqIFtBTE9QRVhVSS0yODhdXHJcblx0XHQgKiDri6Tqta3slrQg7LKY66as66W8IOychO2VnCDshKTsoJUuIGFsb3BleCBnbG9iYWwg7IWL7JeFIOyggeyaqSDrsI8g7Lu07Y+s64SM7Yq4IOqwnOuzhCDshYvsl4Ug7IucIOyggeyaqVxyXG5cdFx0ICogZ2xvYmFsIOyEpOygleydtCDrkJjslrTsnojrjZTrnbzrj4Qg7Lu07Y+s64SM7Yq4IOqwnOuzhCDqs7XthrUg7IWL7JeF7J20IOyeiOycvOuptCDqsJzrs4Qg6rO17Ya1IOyFi+yXheycvOuhnCDsoIHsmqlcclxuXHRcdCAqL1xyXG5cdFx0dmFyIGxvY2FsZVN0ciA9ICdrbyc7XHJcblx0XHRpZigkLmFsb3BleC51dGlsLmlzVmFsaWQoJC5hbG9wZXguY29uZmlnLmxvY2FsZSkpe1xyXG5cdFx0XHRsb2NhbGVTdHIgPSAkLmFsb3BleC5jb25maWcubG9jYWxlO1xyXG5cdFx0fTtcclxuXHRcdGlmICgkLmFsb3BleC51dGlsLmlzVmFsaWQocGFyYW0pICYmIHBhcmFtLmhhc093blByb3BlcnR5KCdsb2NhbGUnKSkge1xyXG5cdFx0XHRsb2NhbGVTdHIgPSBwYXJhbS5sb2NhbGU7XHJcblx0XHR9O1xyXG5cdFx0bG9jYWxlU3RyID0gbG9jYWxlU3RyLnRvTG93ZXJDYXNlKCk7XHJcblx0XHR2YXIgbG9jYWxlT2JqID0ge307XHJcblx0XHRsb2NhbGVPYmogPSAkLmFsb3BleC5jb25maWcubGFuZ3VhZ2VbbG9jYWxlU3RyXS5maWxldXBsb2FkO1xyXG5cdFx0dmFyIG9wdGlvbnMgPSAkLmV4dGVuZCh0cnVlLCB7fSxwYXJhbSwgbG9jYWxlT2JqKTtcclxuXHRcdHJldHVybiBvcHRpb25zO1xyXG5cdH0sXHJcblx0c2V0T3B0aW9uczogZnVuY3Rpb24oZWwsIG9wdGlvbnMpIHtcclxuXHRcdGVsLnVwbG9hZE9iai51cGRhdGUob3B0aW9ucyk7XHJcblx0fSxcclxuXHRzdGFydFVwbG9hZDogZnVuY3Rpb24oZWwpIHtcclxuXHRcdGVsLnVwbG9hZE9iai5zdGFydFVwbG9hZCgpO1xyXG5cdH0sXHJcblx0c3RvcFVwbG9hZDogZnVuY3Rpb24oZWwpIHtcclxuXHRcdGVsLnVwbG9hZE9iai5zdG9wVXBsb2FkKCk7XHJcblx0fSxcclxuXHRjYW5jZWxBbGw6IGZ1bmN0aW9uKGVsKSB7XHJcblx0XHRlbC51cGxvYWRPYmouY2FuY2VsQWxsKCk7XHJcblx0fSxcclxuXHRnZXRGaWxlQ291bnQgOiBmdW5jdGlvbihlbCl7XHJcblx0XHRyZXR1cm4gZWwudXBsb2FkT2JqLmdldEZpbGVDb3VudCgpO1xyXG5cdH0sXHJcblx0cmVtb3ZlRWxlbWVudCA6IGZ1bmN0aW9uKGVsKXtcclxuXHRcdGVsLnVwbG9hZE9iai5yZW1vdmUoKTtcclxuXHR9LFxyXG5cdGdldFJlc3BvbnNlcyA6IGZ1bmN0aW9uKGVsKXtcclxuXHRcdHJldHVybiBlbC51cGxvYWRPYmouZ2V0UmVzcG9uc2VzKCk7XHJcblx0fSxcclxuXHRjbGVhckZpbGU6IGZ1bmN0aW9uKGVsLCBmaWxlTmFtZSkge1xyXG5cdFx0ZWwudXBsb2FkT2JqLmNsZWFyRmlsZShmaWxlTmFtZSk7XHJcblx0fVxyXG59KTsiXX0=
