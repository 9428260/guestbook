var g_time_mode_arr  = [];
var g_time_mode_dict = {};

const DAYOFWEEK = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

$a.page(function(){
	this.init = function(id, param) {
	    initCombo();
	    initData();
	    setEventListener();
    };
});

function setEventListener() {
    $('#schedule_mode').on('change', function(e) {
        printScreen();
    });

    // 추가
    $("#btn_add").on("click", function(e){
        let dataStr = '';

        let mode = $('#schedule_mode').val();
        switch (mode) {
            case 'Y':
                dataStr = $('#schedule_month').val() + '-' + $('#schedule_date').val() + ' '
                        + $('#schedule_hour').val() + ':' + $('#schedule_minute').val();
                break;
            case 'M':
                dataStr = $('#schedule_date').val() + ' '
                        + $('#schedule_hour').val() + ':' + $('#schedule_minute').val();
                break;
            case 'W':
                dataStr = $('#schedule_day').val() + ' '
                        + $('#schedule_hour').val() + ':' + $('#schedule_minute').val();
                break;
            case 'D':
                dataStr = $('#schedule_hour').val() + ':' + $('#schedule_minute').val();
                break;
            case 'H':
                dataStr = $('#schedule_minute').val();
                break;
            case 'O':
                dataStr = $('#schedule_year').val() + '-' + $('#schedule_month').val() + '-' + $('#schedule_date').val() + ' '
                        + $('#schedule_hour').val() + ':' + $('#schedule_minute').val();
                break;
            default:
                opme_message('Error');
                return;
        }
        $a.close({'mode': g_time_mode_dict[mode], 'timePoint': dataStr, 'timeZone': $('#schedule_timezone').val()});
    });

    // 닫기
    $("#btn_close").on("click", function(e) {
        $a.close();
    });
};

function initCombo() {
    let result = opme_getCode(['common_time_mode']);
    if (result == false) return;

    g_time_mode_arr = result['common_time_mode'];

    g_time_mode_arr.forEach(function(item) {
        g_time_mode_dict[item['value']] = item['text'];
    });
};

function initData() {

    // Today
    let today  = new Date();
    let year   = today.getFullYear();
    let month  = today.getMonth()+1;
    let date   = today.getDate();
    let day    = today.getDay(); // (0~6) Sun : 0, Mon : 1, ...
    let hour   = today.getHours();
    let minute = today.getMinutes();
    // console.log(year + "/" + month + "/" + date + " [" + DAYOFWEEK[day] + "] " + hour + ":" + minute);

    // Schedule Mode
    $('#schedule_mode').setData({
        data           : g_time_mode_arr,
        option_selected: g_time_mode_arr[0]['value'] // 최초 선택값 설정.
    });

    // Schedule year
    let year_option = [];
    for (let i=year; i<year+10; i++) {
        year_option.push({'value': i, 'text': i});
    }
    $('#schedule_year').setData({
        data           : year_option,
        option_selected: year_option[0]['value'] // 최초 선택값 설정.
    });

    // Schedule Month
    let month_option = [];
    for (let i=1; i<=12; i++) {
        if (i < 10) {
            month_option.push({'value': '0'+i, 'text': '0'+i});
        } else {
            month_option.push({'value': ''+i, 'text': ''+i});
        }
    }
    $('#schedule_month').setData({
        data           : month_option,
        option_selected: month_option[0]['value'] // 최초 선택값 설정.
    });

    // Schedule Date
    let date_option = [];
    // let last_day = opme_lastDay($('#schedule_year').val(), $('#schedule_month').val());
    for (let i=1; i<=31; i++) {
        if (i < 10) {
            date_option.push({'value': '0'+i, 'text': '0'+i});
        } else {
            date_option.push({'value': ''+i, 'text': ''+i});
        }
    }
    date_option.push({'value': '99', 'text': '말'}); // 99 : 말일

    $('#schedule_date').setData({
        data           : date_option,
        option_selected: date_option[0]['value'] // 최초 선택값 설정.
    });

    // Schedule Day(Day of Week)
    let day_option = [];
    for (let i=0; i<DAYOFWEEK.length; i++) {
        day_option.push({'value': DAYOFWEEK[i], 'text': DAYOFWEEK[i].toUpperCase()});
    }
    $('#schedule_day').setData({
        data           : day_option,
        option_selected: day_option[0]['value'] // 최초 선택값 설정.
    });

    // Schedule Hour
    let hour_option = [];
    for (let i=0; i<=23; i++) {
        if (i < 10) {
            hour_option.push({'value': '0'+i, 'text': '0'+i});
        } else {
            hour_option.push({'value': ''+i, 'text': ''+i});
        }
    }
    $('#schedule_hour').setData({
        data           : hour_option,
        option_selected: hour_option[0]['value'] // 최초 선택값 설정.
    });

    // Schedule Minute
    let minute_option = [];
    for (let i=0; i<=59; i++) {
        if (i < 10) {
            minute_option.push({'value': '0'+i, 'text': '0'+i});
        } else {
            minute_option.push({'value': ''+i, 'text': ''+i});
        }
    }
    $('#schedule_minute').setData({
        data           : minute_option,
        option_selected: minute_option[0]['value'] // 최초 선택값 설정.
    });

    // Schedule Timezone
    let valid_timezone  = opme_getValidTimezone();
    let timezone_option = [];
    for (let i=0; i<valid_timezone.length; i++) {
        timezone_option.push({"value": valid_timezone[i], "text": "UTC"+valid_timezone[i]});
    }

    $('#schedule_timezone').setData({
        data           : timezone_option,
        option_selected: timezone_option[29]['value'] // 최초 선택값 설정.(UTC+09:00)
    });

    printScreen();
};

function printScreen() {
    let mode = $('#schedule_mode').val();

    switch (mode) {
        case 'Y':
            $('#year').hide();
            $('#month').show();
            $('#date').show();
            $('#day').hide();
            $('#hour').show();
            $('#minute').show();
            break;
        case 'M':
            $('#year').hide();
            $('#month').hide();
            $('#date').show();
            $('#day').hide();
            $('#hour').show();
            $('#minute').show();
            break;
        case 'W':
            $('#year').hide();
            $('#month').hide();
            $('#date').hide();
            $('#day').show();
            $('#hour').show();
            $('#minute').show();
            break;
        case 'D':
            $('#year').hide();
            $('#month').hide();
            $('#date').hide();
            $('#day').hide();
            $('#hour').show();
            $('#minute').show();
            break;
        case 'H':
            $('#year').hide();
            $('#month').hide();
            $('#date').hide();
            $('#day').hide();
            $('#hour').hide();
            $('#minute').show();
            break;
        case 'O':
            $('#year').show();
            $('#month').show();
            $('#date').show();
            $('#day').hide();
            $('#hour').show();
            $('#minute').show();
            break;
        default:
            opme_message('Error');
    }

    return;
};
