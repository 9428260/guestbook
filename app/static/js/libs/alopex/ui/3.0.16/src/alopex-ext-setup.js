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
	// lbs multiSelect setup 관련 수정
	setupProperties: {},
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

			// lbs multiSelect setup 관련 수정
			$.extend(el.opts, this.setupProperties);

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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm11bHRpc2VsZWN0LXNldHVwLmpzIiwic3BsaXR0ZXItc2V0dXAuanMiLCJmaWxldXBsb2FkLXNldHVwLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJhbG9wZXgtZXh0LXNldHVwLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy9NdWx0aS1zZWxlY3Qg7Lu07Y+s64SM7Yq4XHJcbiRhLnNldHVwKHtcclxuXHRkZWZhdWx0Q29tcG9uZW50Q2xhc3M6IHtcclxuXHRcdG11bHRpU2VsZWN0OiAnTXVsdGlTZWxlY3QnLCBtdWx0aXNlbGVjdDogJ011bHRpc2VsZWN0JyxcclxuXHRcdHNwbGl0dGVyOiAnU3BsaXR0ZXInLFxyXG5cdFx0ZmlsZVVwbG9hZDogJ0ZpbGVVcGxvYWQnLFxyXG5cdFx0ZmlsZXVwbG9hZDogJ0ZpbGV1cGxvYWQnXHJcblx0fVxyXG59KTtcclxuXHJcbiRhLndpZGdldC5tdWx0aVNlbGVjdCA9ICRhLndpZGdldC5tdWx0aXNlbGVjdCA9ICRhLmluaGVyaXQoJGEud2lkZ2V0Lm9iamVjdCwge1xyXG5cdHdpZGdldE5hbWU6ICdtdWx0aVNlbGVjdCcsXHJcblx0c2V0dGVyczogWydtdWx0aXBsZXNlbGVjdCcsICdyZWZyZXNoJ10sXHJcblx0Z2V0dGVyczogWydpc09wZW4nLCAnZ2V0Q2hlY2tlZCcsICdnZXRCdXR0b24nLCAnd2lkZ2V0JywgJ2dldE11bHRpc2VsZWN0QnV0dG9uJ10sXHJcblx0Ly8gbGJzIG11bHRpU2VsZWN0IHNldHVwIOq0gOugqCDsiJjsoJVcclxuXHRzZXR1cFByb3BlcnRpZXM6IHt9LFxyXG5cdHByb3BlcnRpZXM6IHtcclxuXHRcdG11bHRpcGxlOiB0cnVlLFxyXG5cdFx0bm9uZVNlbGVjdGVkVGV4dDogXCLshKDtg53tlZjshLjsmpRcIixcclxuXHRcdGhlYWRlcjogdHJ1ZSxcclxuXHRcdG1pbldpZHRoOiAxODAsXHJcblx0XHRtZW51V2lkdGg6bnVsbCxcclxuXHRcdHNlbGVjdGVkTGlzdDogMixcclxuXHRcdGNoZWNrQWxsVGV4dDogJ+yghOyytOyEoO2DnScsXHJcblx0XHR1bmNoZWNrQWxsVGV4dDogJ+yghOyytO2VtOygnCcsXHJcblx0XHRzZWxlY3RlZFRleHQ6ICcj6rCcIOyEoO2DneuQqCcsXHJcblx0XHRjbGFzc2VzOiAnTXVsdGlTZWxlY3QnLFxyXG5cdFx0ZmlsdGVyOiB0cnVlLFxyXG5cdFx0bGFiZWw6ICftlYTthLAnLFxyXG5cdFx0cGxhY2Vob2xkZXI6ICfqsoDsg4nslrTrpbwg7J6F66Cl7ZWY7IS47JqUJyxcclxuXHRcdGNoZWNrZWRoZWFkZXI6dHJ1ZSxcclxuXHRcdGh0bWxCaW5kOiB0cnVlLFxyXG5cdFx0cG9zaXRpb24gOiAnYm90dG9tJ1xyXG5cdH0sXHJcblxyXG5cdC8vIOyDiOuhnOyatCDsu7Ttj6zrhIztirjsnZgg64+Z7J6R7J2064KYIOuniO2BrOyXheuTseydhCDshKTsoJXtlZjripQg67aA67aE7J6F64uI64ukLiDsgqzsmqnsnpDripQgJGVs7J2EIOydtOyaqe2VmOyXrCDsu6TsiqTthYDtlZjqsowg66eI7YGs7JeFLCDsiqTtg4Dsnbzrk7HsnYQg66eM65Ok7Ja064K8IOyImCDsnojsirXri4jri6QuXHJcblx0aW5pdDogZnVuY3Rpb24oZWwsIG9wdGlvbnMpIHtcclxuXHRcdFx0dmFyICRlbCA9ICQoZWwpO1xyXG5cdFx0XHQkZWwuYXR0cignbXVsdGlwbGUnLCAnbXVsdGlwbGUnKTtcclxuXHJcblx0XHRcdGVsLm9wdHMgPSAkLmV4dGVuZCh0cnVlLCB7fSwgdGhpcy5wcm9wZXJ0aWVzLCBvcHRpb25zKTtcclxuXHRcdFx0ZWwub3B0c1x0PSB0aGlzLnNldExvY2FsZShlbC5vcHRzKTsgLy9sc2hcclxuXHJcblx0XHRcdC8vIGxicyBtdWx0aVNlbGVjdCBzZXR1cCDqtIDroKgg7IiY7KCVXHJcblx0XHRcdCQuZXh0ZW5kKGVsLm9wdHMsIHRoaXMuc2V0dXBQcm9wZXJ0aWVzKTtcclxuXHJcblx0XHRcdGVsLm9wdHMuY2xhc3NlcyA9ICRlbC5hdHRyKCdjbGFzcycpO1xyXG5cdFx0XHRpZiAoZWwub3B0cy5maWx0ZXIpe1xyXG5cdFx0XHRcdCRlbC5tdWx0aXNlbGVjdChlbC5vcHRzKS5tdWx0aXNlbGVjdGZpbHRlcihlbC5vcHRzKTtcclxuXHRcdFx0fSBlbHNle1xyXG5cdFx0XHRcdCRlbC5tdWx0aXNlbGVjdChlbC5vcHRzKTtcclxuXHRcdFx0fVxyXG5cdFx0XHQvL0xTSFxyXG5cdFx0XHRlbC5idXR0b24gPSAkKGVsKS5uZXh0KCdidXR0b24udWktbXVsdGlzZWxlY3QnKVswXTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdH0sXHJcblx0c2V0TG9jYWxlOiBmdW5jdGlvbihwYXJhbSl7XHJcblx0XHQvKipcclxuXHRcdCAqIFtBTE9QRVhVSS0yODhdXHJcblx0XHQgKiDri6Tqta3slrQg7LKY66as66W8IOychO2VnCDshKTsoJUuIGFsb3BleCBnbG9iYWwg7IWL7JeFIOyggeyaqSDrsI8g7Lu07Y+s64SM7Yq4IOqwnOuzhCDshYvsl4Ug7IucIOyggeyaqVxyXG5cdFx0ICogZ2xvYmFsIOyEpOygleydtCDrkJjslrTsnojrjZTrnbzrj4Qg7Lu07Y+s64SM7Yq4IOqwnOuzhCDqs7XthrUg7IWL7JeF7J20IOyeiOycvOuptCDqsJzrs4Qg6rO17Ya1IOyFi+yXheycvOuhnCDsoIHsmqlcclxuXHRcdCAqL1xyXG5cdFx0dmFyIG9wdGlvbnMgPSB7fTtcclxuXHJcblx0XHR2YXIgbG9jYWxlU3RyID0gJ2tvJztcclxuXHRcdGlmKCQuYWxvcGV4LnV0aWwuaXNWYWxpZCgkLmFsb3BleC5jb25maWcubG9jYWxlKSl7XHJcblx0XHRcdGxvY2FsZVN0ciA9ICQuYWxvcGV4LmNvbmZpZy5sb2NhbGU7XHJcblx0XHR9O1xyXG5cdFx0aWYgKCQuYWxvcGV4LnV0aWwuaXNWYWxpZChwYXJhbSkgJiYgcGFyYW0uaGFzT3duUHJvcGVydHkoJ2xvY2FsZScpKSB7XHJcblx0XHRcdGxvY2FsZVN0ciA9IHBhcmFtLmxvY2FsZTtcclxuXHRcdH07XHJcblx0XHRsb2NhbGVTdHIgPSBsb2NhbGVTdHIudG9Mb3dlckNhc2UoKTtcclxuXHRcdHZhciBsb2NhbGVPYmogPSB7fTtcclxuXHRcdGxvY2FsZU9iaiA9ICQuYWxvcGV4LmNvbmZpZy5sYW5ndWFnZVtsb2NhbGVTdHJdLm11bHRpc2VsZWN0O1xyXG5cclxuXHRcdHZhciBvcHRpb25zID0gJC5leHRlbmQodHJ1ZSwge30scGFyYW0sIGxvY2FsZU9iaik7XHJcblx0XHRyZXR1cm4gb3B0aW9ucztcclxuXHR9LFxyXG5cdHJlZnJlc2g6IGZ1bmN0aW9uKGVsKSB7XHJcblx0XHRcdCQoZWwpLm11bHRpc2VsZWN0KCdyZWZyZXNoJyk7XHJcblx0fSxcclxuXHRnZXRNdWx0aXNlbGVjdEJ1dHRvbjogZnVuY3Rpb24oZWwpIHtcclxuXHRcdHJldHVybiBlbC5idXR0b247XHJcblx0fSxcclxuXHRvcGVuIDogZnVuY3Rpb24oZWwpe1xyXG5cdFx0JChlbCkubXVsdGlzZWxlY3QoJ29wZW4nKTtcclxuXHR9LFxyXG5cdGNsb3NlIDogZnVuY3Rpb24oZWwpe1xyXG5cdFx0JChlbCkubXVsdGlzZWxlY3QoJ2Nsb3NlJyk7XHJcblx0fVxyXG59KTtcclxuIiwiLy9zcGxpdHRlcl9wYW5lbFxyXG4kYS53aWRnZXQuc3BsaXR0ZXIgPSAkYS5pbmhlcml0KCRhLndpZGdldC5vYmplY3QsIHtcclxuXHR3aWRnZXROYW1lOiAnc3BsaXR0ZXInLFxyXG5cdHByb3BlcnRpZXM6IHtcclxuXHRcdHBvc2l0aW9uOiAnNTAlJyxcclxuXHRcdGxpbWl0OiAxMCxcclxuXHRcdG9yaWVudGF0aW9uOiAnaG9yaXpvbnRhbCdcclxuXHR9LFxyXG5cdGluaXQ6IGZ1bmN0aW9uKGVsLCBvcHRpb25zKXtcclxuXHRcdHZhciBvcHRzID0gJC5leHRlbmQodHJ1ZSwge30sIHRoaXMucHJvcGVydGllcywgb3B0aW9ucyk7XHJcblx0XHQkKGVsKS5zcGxpdCh7XHJcblx0XHRcdFx0b3JpZW50YXRpb246IG9wdHMub3JpZW50YXRpb24sXHJcblx0XHRcdFx0bGltaXQ6IG9wdHMubGltaXQsXHJcblx0XHRcdFx0cG9zaXRpb246IG9wdHMucG9zaXRpb25cclxuXHRcdH0pO1xyXG5cdH0sXHJcblx0c2V0T3B0aW9uczogZnVuY3Rpb24oZWwsIG9wdGlvbnMpe1xyXG5cdFx0dmFyIG9wdHMgPSAkLmV4dGVuZCh0cnVlLCB7fSwgJChlbCkuZGF0YShcInNwbGl0dGVyXCIpLnNldHRpbmdzLCBvcHRpb25zKTtcclxuXHRcdCQoZWwpLnNwbGl0KCkuZGVzdHJveSgpO1xyXG5cdFx0cmV0dXJuICQoZWwpLnNwbGl0KG9wdHMpO1xyXG5cdH1cclxufSk7XHJcbiIsIi8vZmlsZSB1cGxvYWRcclxuJGEud2lkZ2V0LmZpbGVVcGxvYWQgPSAkYS53aWRnZXQuZmlsZXVwbG9hZCA9ICRhLmluaGVyaXQoJGEud2lkZ2V0Lm9iamVjdCwge1xyXG5cdHdpZGdldE5hbWU6ICdmaWxlVXBsb2FkJyxcclxuXHRwcm9wZXJ0aWVzOiB7XHJcblx0XHR1cmwgOiAnJyxcclxuXHRcdGZpbGVOYW1lIDogJ3VwbG9hZEZpbGVzJyxcclxuXHRcdG11bHRpcGxlIDogdHJ1ZSxcclxuXHRcdGRyYWdEcm9wOmZhbHNlLFxyXG5cdFx0ZHJhZ2Ryb3BXaWR0aCA6ICcxMDAlJyxcclxuXHRcdGFsbG93RHVwbGljYXRlcyA6IGZhbHNlLFxyXG5cdFx0c2hvd1F1ZXVlRGl2IDogZmFsc2UsXHJcblx0XHRzZXF1ZW50aWFsIDogdHJ1ZSxcclxuXHRcdHNlcXVlbnRpYWxDb3VudCA6IDEsXHJcblx0XHRhdXRvU3VibWl0IDogZmFsc2UsXHJcblx0XHRzaG93Q2FuY2VsIDogdHJ1ZSxcclxuXHRcdHNob3dEb25lIDogdHJ1ZSxcclxuXHRcdHNob3dEZWxldGU6IHRydWUsXHJcblx0XHRzaG93RG93bmxvYWQ6dHJ1ZSxcclxuXHRcdHNob3dBYm9ydCA6IHRydWUsXHJcblx0XHRzaG93UHJldmlldyA6IHRydWUsXHJcblx0XHQvL2FsbG93ZWRUeXBlcyA6IFwianBnLHBuZyxnaWZcIixcclxuXHRcdC8vYWNjZXB0RmlsZXMgOiBcImltYWdlL1wiLFxyXG5cdFx0ZHJhZ0Ryb3BTdHIgOiBcIjxkaXYgY2xhc3M9J2ZpbGV1cGxvYWQtYm94Jz7sl6zquLDsl5Ag7YyM7J287J2EIOuBjOyWtOuLpCDrhpPsnLzshLjsmpQ8L2Rpdj5cIixcclxuXHRcdG11bHRpRHJhZ0Vycm9yU3RyOiBcIuupgO2LsCDtjIzsnbwgRHJhZyAmYW1wOyBEcm9wIOyLpO2MqOyeheuLiOuLpC5cIixcclxuXHRcdGR1cGxpY2F0ZUVycm9yU3RyOiBcIuydtOuvuCDsobTsnqztlZjripQg7YyM7J287J6F64uI64ukLlwiLFxyXG5cdFx0ZXh0RXJyb3JTdHI6XCLtl4jsmqnrkJjsp4Ag7JWK64qUIO2ZleyepeyekOyeheuLiOuLpC7tl4jsmqnrkJjripQg7ZmV7J6l7J6QIDogXCIsXHJcblx0XHRzaXplRXJyb3JTdHI6XCLtl4jsmqkg7YyM7J28IOyaqeufieydhCDstIjqs7ztlZjsmIDsirXri4jri6QuIOy1nOuMgCDtjIzsnbwg7Jqp65+JIDogXCIsXHJcblx0XHRtYXhGaWxlQ291bnRFcnJvclN0cjogXCLtl4jsmqkg7YyM7J28IOqwr+yImOulvCDstIjqs7ztlZjsmIDsirXri4jri6QuIOy1nOuMgCDtjIzsnbwg6rCv7IiYIDogXCIsXHJcblx0XHR1cGxvYWRFcnJvclN0cjpcIuyXheuhnOuTnOqwgCDsi6TtjKjtlZjsmIDsirXri4jri6QuXCIsXHJcblx0XHR1cGxvYWRTdHI6ICftjIzsnbwg7LaU6rCAJyxcclxuXHRcdGNoZWNrQWxsU3RyIDogJ+yghOyytCDshKDtg50nLFxyXG5cdFx0dW5DaGVja0FsbFN0ciA6ICfsoITssrQg7ZW07KCcJyxcclxuXHRcdGNoZWNrZWREZWxldGVTdHIgOiAn7ISg7YOdIOyCreygnCcsXHJcblx0XHRhYm9ydEJ1dHRvbkNsYXNzOiBcIkJ1dHRvblwiLFxyXG5cdFx0Y2FuY2VsQnV0dG9uQ2xhc3M6IFwiQnV0dG9uXCIsXHJcblx0XHR1cGxvYWRCdXR0b25DbGFzczogXCJCdXR0b25cIixcclxuXHJcblx0XHRzaG93RmlsZUNvdW50ZXIgOiBmYWxzZSxcclxuXHRcdHNob3dTdGF0dXNBZnRlclN1Y2Nlc3MgOiB0cnVlLFxyXG5cdFx0c2hvd0NoZWNrZWRBbGw6IHRydWUsXHJcblx0XHRzaG93VW5DaGVja2VkQWxsOiB0cnVlLFxyXG5cdFx0c2hvd0RlbGV0ZUNoZWNrZWQ6IHRydWUsXHJcblx0XHRzaG93QWRkRmlsZTogdHJ1ZSxcclxuXHRcdHNob3dCdXR0b25Hcm91cDogdHJ1ZSxcclxuXHRcdG9uU2VsZWN0IDogZnVuY3Rpb24oZmlsZXMpIHtcclxuXHJcblx0XHR9LFxyXG5cdFx0b25TdWNjZXNzOmZ1bmN0aW9uKGZpbGVzLGRhdGEseGhyLHBkKVx0e1xyXG5cclxuXHRcdH0sXHJcblx0XHRzZWxlY3R0eXBlIDogXCJiYXNpY1wiXHJcblx0fSxcclxuXHRzZXR0ZXJzOiBbJ2ZpbGVVcGxvYWQnLCAnc2V0T3B0aW9ucycsJ3N0YXJ0VXBsb2FkJywnc3RvcFVwbG9hZCcsJ2NhbmNlbEFsbCcsJ2NoZWNrQWxsJywndW5DaGVja0FsbCcsJ2NoZWNrRGVsZXRlJywncmVtb3ZlRWxlbWVudCcsJ2NsZWFyRmlsZSddLFxyXG5cdGdldHRlcnM6IFsnZ2V0RmlsZUNvdW50JywnZ2V0UmVzcG9uc2VzJ10sXHJcblxyXG5cdGluaXQ6IGZ1bmN0aW9uKGVsLCBvcHRpb25zKXtcclxuXHJcblx0XHR2YXIgb3B0cyA9ICQuZXh0ZW5kKHRydWUsIHt9LCB0aGlzLnByb3BlcnRpZXMsIG9wdGlvbnMpO1xyXG5cdFx0b3B0c1x0PSB0aGlzLnNldExvY2FsZShvcHRzKTsgLy9sc2hcclxuXHRcdHZhciB2YXJJZCA9XCJvdXRwdXRcIisobmV3IERhdGUoKS5nZXRUaW1lKCkpO1xyXG5cdFx0dmFyIHBydkNvbj0nJztcclxuXHRcdGlmIChvcHRzLnNlbGVjdHR5cGU9PSAnYmFzaWMnKXtcclxuXHRcdFx0b3B0cy5kcmFnRHJvcCA9ZmFsc2U7XHJcblx0XHRcdG9wdHMubWF4RmlsZUNvdW50ID0gMTtcclxuXHRcdFx0b3B0cy5tdWx0aXBsZSA9IGZhbHNlO1xyXG5cdFx0XHRvcHRzLnNob3dEZWxldGUgPSBmYWxzZTtcclxuXHRcdFx0b3B0cy5zaG93RG93bmxvYWQgPSBmYWxzZTtcclxuXHRcdFx0b3B0cy5zaG93UHJldmlldyA9IGZhbHNlO1xyXG5cdFx0XHRvcHRzLnNob3dQcm9ncmVzcyA9IGZhbHNlO1xyXG5cdFx0XHRvcHRzLnNob3dGaWxlQ291bnRlciA9IGZhbHNlO1xyXG5cclxuXHRcdFx0b3B0cy5jdXN0b21Qcm9ncmVzc0Jhcj0gZnVuY3Rpb24ob2JqLHMpXHR7XHJcblx0XHRcdFx0dGhpcy5zdGF0dXNiYXIgPSAkKFwiPGRpdj48L2Rpdj5cIik7XHJcblx0XHRcdFx0dGhpcy5maWxlbmFtZSA9ICQoXCI8c3BhbiBjbGFzcz0nb25lZmlsZS10ZXh0Jz48L3NwYW4+XCIpLmFwcGVuZFRvKHRoaXMuc3RhdHVzYmFyKTtcclxuXHRcdFx0XHR2YXIgcHJvZ3Jlc3NCb3ggPSAkKFwiPHNwYW4+PC9zcGFuPlwiKS5hcHBlbmRUbyh0aGlzLnN0YXR1c2Jhcik7XHJcblx0XHRcdFx0dGhpcy5wcm9ncmVzc0RpdiA9ICQoXCI8c3Bhbj5cIikuYXBwZW5kVG8ocHJvZ3Jlc3NCb3gpLmhpZGUoKTtcclxuXHRcdFx0XHR0aGlzLnByb2dyZXNzYmFyID0gJChcIjxzcGFuPlwiKS5hcHBlbmRUbyh0aGlzLnByb2dyZXNzRGl2KTtcclxuXHRcdFx0XHR2YXIgYnRuQm94ID0gJChcIjxkaXYgY2xhc3M9J29uZWZpbGUtYnV0dG9uJz48L2Rpdj5cIikuYXBwZW5kVG8odGhpcy5zdGF0dXNiYXIpO1xyXG5cdFx0XHRcdHRoaXMuYWJvcnQgPSAkKFwiPGJ1dHRvbiBjbGFzcz0nQnV0dG9uIE9ubHlpY29uIGFib3J0Jz48c3BhbiBjbGFzcz0nSWNvbiBQYXVzZScgZGF0YS1wb3NpdGlvbj0ndG9wJz48L3NwYW4+PC9idXR0b24+XCIpLmFwcGVuZFRvKGJ0bkJveCkuaGlkZSgpO1xyXG5cdFx0XHRcdHRoaXMuY2FuY2VsID0gJChcIjxidXR0b24gY2xhc3M9J0J1dHRvbiBPbmx5aWNvbiBjYW5jZWwnPjxzcGFuIGNsYXNzPSdJY29uIFJlbW92ZScgZGF0YS1wb3NpdGlvbj0ndG9wJz48L3NwYW4+PC9idXR0b24+XCIpLmFwcGVuZFRvKGJ0bkJveCkuaGlkZSgpO1xyXG5cdFx0XHRcdHRoaXMuZG9uZSA9ICQoXCI8YnV0dG9uIGNsYXNzPSdCdXR0b24gT25seWljb24gZG9uZSc+PHNwYW4gY2xhc3M9J0ljb24gT2snIGRhdGEtcG9zaXRpb249J3RvcCc+PC9zcGFuPjwvYnV0dG9uPlwiKS5hcHBlbmRUbyhidG5Cb3gpLmhpZGUoKTtcclxuXHRcdFx0XHR0aGlzLmRvd25sb2FkID0gJChcIjxidXR0b24gY2xhc3M9J0J1dHRvbiBPbmx5aWNvbiBkb3dubG9hZCc+PHNwYW4gY2xhc3M9J0ljb24gRG93bmxvYWQnIGRhdGEtcG9zaXRpb249J3RvcCc+PC9zcGFuPjwvYnV0dG9uPlwiKS5hcHBlbmRUbyhidG5Cb3gpLmhpZGUoKTtcclxuXHRcdFx0XHR0aGlzLmRlbCA9ICQoXCI8YnV0dG9uIGNsYXNzPSdCdXR0b24gT25seWljb24gZGVsJz48c3BhbiBjbGFzcz0nSWNvbiBUcmFzaCcgZGF0YS1wb3NpdGlvbj0ndG9wJz48L3NwYW4+PC9idXR0b24+XCIpLmFwcGVuZFRvKGJ0bkJveCkuaGlkZSgpO1xyXG5cdFx0XHRcdCRhLmNvbnZlcnQodGhpcy5zdGF0dXNiYXIpO1xyXG5cdFx0XHRcdHJldHVybiB0aGlzO1xyXG5cdFx0XHR9XHJcblx0XHRcdHBydkNvbiArPSAnPGRpdiBpZD1cIicrdmFySWQgKydcIiBjbGFzcz1cIm9uZWZpbGVcIj48L2Rpdj4nXHJcblx0XHRcdCQoZWwpLmFmdGVyKHBydkNvbik7XHJcblx0XHRcdFx0b3B0cy5zaG93UXVldWVEaXY9dmFySWQ7XHJcblx0XHRcdFx0JChlbCkuYWRkQ2xhc3MoXCJmaWxlLW9uZXVwbG9hZFwiKVxyXG5cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdG9wdHMuY3VzdG9tUHJvZ3Jlc3NCYXI9IGZ1bmN0aW9uKG9iaixzKVx0e1xyXG5cclxuXHRcdFx0XHR0aGlzLnN0YXR1c2JhciA9ICQoXCI8ZGl2IGNsYXNzPSdwcmV2aWV3LWxpc3QnPjwvZGl2PlwiKTtcclxuXHRcdFx0XHR2YXIgY29udGVudEJveCA9ICQoXCI8ZGl2IGNsYXNzPSdwcmV2aWV3LWNvbnRlbnRzJz48L2Rpdj5cIikuYXBwZW5kVG8odGhpcy5zdGF0dXNiYXIpO1xyXG5cdFx0XHRcdHZhciBmaWxlQm94ID0gJChcIjxkaXYgY2xhc3M9J3ByZXZpZXctdGl0bGUnPjwvZGl2PlwiKS5hcHBlbmRUbyhjb250ZW50Qm94KTtcclxuXHRcdFx0XHR2YXIgaUNoZWNrQm94ID0gJChcIjxsYWJlbCBjbGFzcz0nSW1hZ2VDaGVja2JveCc+PC9sYWJlbD5cIikuYXBwZW5kVG8oZmlsZUJveClcclxuXHRcdFx0XHR2YXIgY2hlY2tib3ggPSAkKFwiPGlucHV0IGNsYXNzPSdDaGVja2JveCcgIHR5cGU9J2NoZWNrYm94JyBuYW1lPSdmaWxlU2VsZWN0XCIrdmFySWQrXCInPlwiKS5hcHBlbmRUbyhpQ2hlY2tCb3gpO1xyXG5cdFx0XHRcdC8vdGhpcy5wcmV2aWV3ID0gJChcIjxpbWcgLz5cIikud2lkdGgocy5wcmV2aWV3V2lkdGgpLmhlaWdodChzLnByZXZpZXdIZWlnaHQpLmFwcGVuZFRvKGZpbGVCb3gpLmhpZGUoKTtcclxuXHRcdFx0XHR0aGlzLnByZXZpZXcgPSAkKFwiPGltZyBjbGFzcz0ncHJldmlldy1pbWcnLz5cIikuYXBwZW5kVG8oaUNoZWNrQm94KS5oaWRlKCk7XHJcblxyXG5cdFx0XHRcdHRoaXMuZmlsZW5hbWUgPSAkKFwiPHNwYW4gY2xhc3M9J211bHRpZmlsZS10ZXh0Jz48L3NwYW4+XCIpLmFwcGVuZFRvKGZpbGVCb3gpO1xyXG5cdFx0XHRcdHZhciBwcm9ncmVzc0JveCA9ICQoXCI8ZGl2IGNsYXNzPSdwcmV2aWV3LXByb2dyZXNzJz48L2Rpdj5cIikuYXBwZW5kVG8oY29udGVudEJveCk7XHJcblx0XHRcdFx0dGhpcy5wcm9ncmVzc0RpdiA9ICQoXCI8ZGl2IGNsYXNzPSdQcm9ncmVzc2Jhcic+XCIpLmFwcGVuZFRvKHByb2dyZXNzQm94KS5oaWRlKCk7XHJcblx0XHRcdFx0dGhpcy5wcm9ncmVzc2JhciA9ICQoXCI8ZGl2IHN0eWxlPSdwb3NpdGlvbjogcmVsYXRpdmU7IGxlZnQ6IDBweDsgaGVpZ2h0OiA4cHg7IGJvcmRlcjogMHB4IG5vbmUgcmdiKDAsIDAsIDApOyc+PC9kaXY+XCIpLmFwcGVuZFRvKHRoaXMucHJvZ3Jlc3NEaXYpO1xyXG5cdFx0XHRcdHZhciBidG5Cb3ggPSAkKFwiPGRpdiBjbGFzcz0ncHJldmlldy1idG4nPjwvZGl2PlwiKS5hcHBlbmRUbyhjb250ZW50Qm94KTtcclxuXHRcdFx0XHR0aGlzLmFib3J0ID0gJChcIjxidXR0b24gY2xhc3M9J0J1dHRvbiBPbmx5aWNvbiBhYm9ydCc+PHNwYW4gY2xhc3M9J0ljb24gUGF1c2UnIGRhdGEtcG9zaXRpb249J3RvcCc+PC9zcGFuPjwvYnV0dG9uPlwiKS5hcHBlbmRUbyhidG5Cb3gpLmhpZGUoKTtcclxuXHRcdFx0XHR0aGlzLmNhbmNlbCA9ICQoXCI8YnV0dG9uIGNsYXNzPSdCdXR0b24gT25seWljb24gY2FuY2VsJz48c3BhbiBjbGFzcz0nSWNvbiBSZW1vdmUnIGRhdGEtcG9zaXRpb249J3RvcCc+PC9zcGFuPjwvYnV0dG9uPlwiKS5hcHBlbmRUbyhidG5Cb3gpLmhpZGUoKTtcclxuXHRcdFx0XHR0aGlzLmRvbmUgPSAkKFwiPGJ1dHRvbiBjbGFzcz0nQnV0dG9uIE9ubHlpY29uIGRvbmUnPjxzcGFuIGNsYXNzPSdJY29uIE9rJyBkYXRhLXBvc2l0aW9uPSd0b3AnPjwvc3Bhbj48L2J1dHRvbj5cIikuYXBwZW5kVG8oYnRuQm94KS5oaWRlKCk7XHJcblx0XHRcdFx0XHRcdFx0XHR0aGlzLmRvd25sb2FkID0gJChcIjxidXR0b24gY2xhc3M9J0J1dHRvbiBPbmx5aWNvbiBkb3dubG9hZCc+PHNwYW4gY2xhc3M9J0ljb24gRG93bmxvYWQtYWx0JyBkYXRhLXBvc2l0aW9uPSd0b3AnPjwvc3Bhbj48L2J1dHRvbj5cIikuYXBwZW5kVG8oYnRuQm94KS5oaWRlKCk7XHJcblx0XHRcdFx0dGhpcy5kZWwgPSAkKFwiPGJ1dHRvbiBjbGFzcz0nQnV0dG9uIE9ubHlpY29uIGRlbCc+PHNwYW4gY2xhc3M9J0ljb24gVHJhc2gnIGRhdGEtcG9zaXRpb249J3RvcCc+PC9zcGFuPjwvYnV0dG9uPlwiKS5hcHBlbmRUbyhidG5Cb3gpLmhpZGUoKTtcclxuXHRcdFx0XHQkYS5jb252ZXJ0KHRoaXMuc3RhdHVzYmFyKTtcclxuXHRcdFx0XHRyZXR1cm4gdGhpcztcclxuXHRcdFx0fVxyXG5cdFx0XHRwcnZDb24gKz0gJzxkaXYgaWQ9XCInK3ZhcklkICsnXCIgY2xhc3M9XCJwcmV2aWV3LWNvbnRhaW5lclwiPjwvZGl2PidcclxuXHRcdFx0JChlbCkuYWZ0ZXIocHJ2Q29uKTtcclxuXHRcdFx0b3B0cy5zaG93UXVldWVEaXY9dmFySWQ7XHJcblx0XHRcdG9wdHMubXVsdGlwbGUgPSB0cnVlO1xyXG5cdFx0fVxyXG5cdFx0ZWwudXBsb2FkT2JqPSQoZWwpLnVwbG9hZEZpbGUob3B0cyk7XHJcblx0fSxcclxuXHRzZXRMb2NhbGU6IGZ1bmN0aW9uKHBhcmFtKXtcclxuXHRcdC8qKlxyXG5cdFx0ICogW0FMT1BFWFVJLTI4OF1cclxuXHRcdCAqIOuLpOq1reyWtCDsspjrpqzrpbwg7JyE7ZWcIOyEpOyglS4gYWxvcGV4IGdsb2JhbCDshYvsl4Ug7KCB7JqpIOuwjyDsu7Ttj6zrhIztirgg6rCc67OEIOyFi+yXhSDsi5wg7KCB7JqpXHJcblx0XHQgKiBnbG9iYWwg7ISk7KCV7J20IOuQmOyWtOyeiOuNlOudvOuPhCDsu7Ttj6zrhIztirgg6rCc67OEIOqzte2GtSDshYvsl4XsnbQg7J6I7Jy866m0IOqwnOuzhCDqs7XthrUg7IWL7JeF7Jy866GcIOyggeyaqVxyXG5cdFx0ICovXHJcblx0XHR2YXIgbG9jYWxlU3RyID0gJ2tvJztcclxuXHRcdGlmKCQuYWxvcGV4LnV0aWwuaXNWYWxpZCgkLmFsb3BleC5jb25maWcubG9jYWxlKSl7XHJcblx0XHRcdGxvY2FsZVN0ciA9ICQuYWxvcGV4LmNvbmZpZy5sb2NhbGU7XHJcblx0XHR9O1xyXG5cdFx0aWYgKCQuYWxvcGV4LnV0aWwuaXNWYWxpZChwYXJhbSkgJiYgcGFyYW0uaGFzT3duUHJvcGVydHkoJ2xvY2FsZScpKSB7XHJcblx0XHRcdGxvY2FsZVN0ciA9IHBhcmFtLmxvY2FsZTtcclxuXHRcdH07XHJcblx0XHRsb2NhbGVTdHIgPSBsb2NhbGVTdHIudG9Mb3dlckNhc2UoKTtcclxuXHRcdHZhciBsb2NhbGVPYmogPSB7fTtcclxuXHRcdGxvY2FsZU9iaiA9ICQuYWxvcGV4LmNvbmZpZy5sYW5ndWFnZVtsb2NhbGVTdHJdLmZpbGV1cGxvYWQ7XHJcblx0XHR2YXIgb3B0aW9ucyA9ICQuZXh0ZW5kKHRydWUsIHt9LHBhcmFtLCBsb2NhbGVPYmopO1xyXG5cdFx0cmV0dXJuIG9wdGlvbnM7XHJcblx0fSxcclxuXHRzZXRPcHRpb25zOiBmdW5jdGlvbihlbCwgb3B0aW9ucykge1xyXG5cdFx0ZWwudXBsb2FkT2JqLnVwZGF0ZShvcHRpb25zKTtcclxuXHR9LFxyXG5cdHN0YXJ0VXBsb2FkOiBmdW5jdGlvbihlbCkge1xyXG5cdFx0ZWwudXBsb2FkT2JqLnN0YXJ0VXBsb2FkKCk7XHJcblx0fSxcclxuXHRzdG9wVXBsb2FkOiBmdW5jdGlvbihlbCkge1xyXG5cdFx0ZWwudXBsb2FkT2JqLnN0b3BVcGxvYWQoKTtcclxuXHR9LFxyXG5cdGNhbmNlbEFsbDogZnVuY3Rpb24oZWwpIHtcclxuXHRcdGVsLnVwbG9hZE9iai5jYW5jZWxBbGwoKTtcclxuXHR9LFxyXG5cdGdldEZpbGVDb3VudCA6IGZ1bmN0aW9uKGVsKXtcclxuXHRcdHJldHVybiBlbC51cGxvYWRPYmouZ2V0RmlsZUNvdW50KCk7XHJcblx0fSxcclxuXHRyZW1vdmVFbGVtZW50IDogZnVuY3Rpb24oZWwpe1xyXG5cdFx0ZWwudXBsb2FkT2JqLnJlbW92ZSgpO1xyXG5cdH0sXHJcblx0Z2V0UmVzcG9uc2VzIDogZnVuY3Rpb24oZWwpe1xyXG5cdFx0cmV0dXJuIGVsLnVwbG9hZE9iai5nZXRSZXNwb25zZXMoKTtcclxuXHR9LFxyXG5cdGNsZWFyRmlsZTogZnVuY3Rpb24oZWwsIGZpbGVOYW1lKSB7XHJcblx0XHRlbC51cGxvYWRPYmouY2xlYXJGaWxlKGZpbGVOYW1lKTtcclxuXHR9XHJcbn0pOyJdfQ==
