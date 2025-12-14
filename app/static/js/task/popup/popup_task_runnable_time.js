var g_time_mode_arr  = [];
var g_time_mode_dict = {};

const DAYOFWEEK = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const TIME_UNIT = [{'value': 'h', 'text': '시간'},
                   {'value': 'm', 'text': '분'}];

$a.page(function(){
	this.init = function(id, param) {
        initCombo();
        initData();
        setEventListener();
    };
});

function setEventListener() {
    $('#runnable_time_mode').on('change', function(e) {
        printScreen();
    });

    // 추가
    $("#btn_add").on("click", function(e){
        let dataStr = '';

        let mode = $('#runnable_time_mode').val();
        switch (mode) {
            case 'Y':
                dataStr = $('#runnable_time_month').val() + '-' + $('#runnable_time_date').val() + ' '
                        + $('#runnable_time_hour').val() + ':' + $('#runnable_time_minute').val();
                break;
            case 'M':
                dataStr = $('#runnable_time_date').val() + ' '
                        + $('#runnable_time_hour').val() + ':' + $('#runnable_time_minute').val();
                break;
            case 'W':
                dataStr = $('#runnable_time_day').val() + ' '
                        + $('#runnable_time_hour').val() + ':' + $('#runnable_time_minute').val();
                break;
            case 'D':
                dataStr = $('#runnable_time_hour').val() + ':' + $('#runnable_time_minute').val();
                break;
            case 'H':
                dataStr = $('#runnable_time_minute').val();
                break;
            case 'O':
                dataStr = $('#runnable_time_year').val() + '-' + $('#runnable_time_month').val() + '-' + $('#runnable_time_date').val() + ' '
                        + $('#runnable_time_hour').val() + ':' + $('#runnable_time_minute').val();
                break;
            default:
                opme_message('Error');
                return;
        }

        // 유효성 체크
        if (validate() == false) {
            return;
        };

        let dataStrRange = $('#range_minute').val() + $('#range_mode').val();
        $a.close({'mode': g_time_mode_dict[mode], 'start': dataStr, 'range': dataStrRange, 'timeZone': $('#runnable_time_timezone').val()});
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

    // runnable_time Mode
    $('#runnable_time_mode').setData({
        data           : g_time_mode_arr,
        option_selected: g_time_mode_arr[0]['value'] // 최초 선택값 설정.
    });

    // runnable_time year
    let year_option = [];
    for (let i=year; i<year+10; i++) {
        year_option.push({'value': i, 'text': i});
    }
    $('#runnable_time_year').setData({
        data           : year_option,
        option_selected: year_option[0]['value'] // 최초 선택값 설정.
    });

    // runnable_time Month
    let month_option = [];
    for (let i=1; i<=12; i++) {
        if (i < 10) {
            month_option.push({'value': '0'+i, 'text': '0'+i});
        } else {
            month_option.push({'value': ''+i, 'text': ''+i});
        }
    }
    $('#runnable_time_month').setData({
        data           : month_option,
        option_selected: month_option[0]['value'] // 최초 선택값 설정.
    });

    // runnable_time Date
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

    $('#runnable_time_date').setData({
        data           : date_option,
        option_selected: date_option[0]['value'] // 최초 선택값 설정.
    });

    // runnable_time Day(Day of Week)
    let day_option = [];
    for (let i=0; i<DAYOFWEEK.length; i++) {
        day_option.push({'value': DAYOFWEEK[i], 'text': DAYOFWEEK[i].toUpperCase()});
    }
    $('#runnable_time_day').setData({
        data           : day_option,
        option_selected: day_option[0]['value'] // 최초 선택값 설정.
    });

    // runnable_time Hour
    let hour_option = [];
    for (let i=0; i<=23; i++) {
        if (i < 10) {
            hour_option.push({'value': '0'+i, 'text': '0'+i});
        } else {
            hour_option.push({'value': ''+i, 'text': ''+i});
        }
    }
    $('#runnable_time_hour').setData({
        data           : hour_option,
        option_selected: hour_option[0]['value'] // 최초 선택값 설정.
    });

    // runnable_time Minute
    let minute_option = [];
    for (let i=0; i<=59; i++) {
        if (i < 10) {
            minute_option.push({'value': '0'+i, 'text': '0'+i});
        } else {
            minute_option.push({'value': ''+i, 'text': ''+i});
        }
    }
    $('#runnable_time_minute').setData({
        data           : minute_option,
        option_selected: minute_option[0]['value'] // 최초 선택값 설정.
    });

    // runnable_time Timezone
    let valid_timezone  = opme_getValidTimezone();
    let timezone_option = [];
    for (let i=0; i<valid_timezone.length; i++) {
        timezone_option.push({"value": valid_timezone[i], "text": "UTC"+valid_timezone[i]});
    }

    $('#runnable_time_timezone').setData({
        data           : timezone_option,
        option_selected: timezone_option[29]['value'] // 최초 선택값 설정.(UTC+09:00)
    });

    // runnable_time Range(TIME_UNIT)
    $('#range_mode').setData({
        data           : TIME_UNIT,
        option_selected: TIME_UNIT[0]['value'] // 최초 선택값 설정.
    });

    printScreen();
};

function printScreen() {
    let mode = $('#runnable_time_mode').val();

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

// 유효성 검사
function validate() {

    let chk_range = $('#range_minute').val();

    // 숫자 여부
    if (opme_isNumber(chk_range) == false) {
        opme_message('숫자[시간/분]로 입력해주세요.');
        return false;
    }

    // 실행가능시간 시간 입력 숫자 0 처리. 0010 -> 10으로
    chk_range = parseInt(chk_range).toString();

    // 유효시간 입력값 조절
    if (chk_range.length > 7){
        opme_message('입력 값이 너무 큽니다!');
        return false;
    }

    $('#range_minute').val(chk_range);
    return true;
};
