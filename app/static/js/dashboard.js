var g_max_rows      = 6;
var g_max_tasks     = 100;
var g_str_na        = '-';

/*$a = window.$a || $a;*/
$a.page(function(){
    this.init = function(id, param) {
      fetchTasksAndRender();
      setEventListener();
    };
  }
);

function formatDateTime(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return g_str_na;
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    var hh = String(date.getHours()).padStart(2, '0');
    var mm = String(date.getMinutes()).padStart(2, '0');
    var ss = String(date.getSeconds()).padStart(2, '0');
    return y + '-' + m + '-' + d + ' ' + hh + ':' + mm + ':' + ss;
}

function renderTaskList(tasks) {
    var container = document.getElementById("taskList");
    var nodata = document.getElementById("nodataContainer");
    if (!container) return;

    if (!tasks || tasks.length === 0) {
        container.innerHTML = "";
        container.style.display = "none";
        if (nodata) nodata.style.display = "block";
        return;
    }

    var html = "";
    var rendered = 0;
    for (var i = 0; i < tasks.length && i < g_max_rows; i++) {
        var task = tasks[i];
        html +=
            '<div data-status="' + task.status + '" class="task_item">' +
            '  <div class="task-row">' +
            '    <div data-status="' + task.status_icon + '" class="status-icon"></div>' +
            '    <div class="task-name">' +
            '      <div class="task-name-container"><a href="#" data-task-id="' + task.task_id + '" class="task-name-link">' + task.task_id + '</a></div>' +
            '    </div>' +
            '    <div class="status-container">' +
            '      <div data-status="error" class="status-num">' +
            '        <div class="status-dot"></div>' +
            '        <div class="status-text">' + task.error_count + '</div>' +
            '      </div>' +
            '      <div class="status-divider"></div>' +
            '      <div data-status="warning" class="status-num">' +
            '        <div class="status-dot"></div>' +
            '        <div class="status-text">' + task.warning_count + '</div>' +
            '      </div>' +
            '      <div class="status-divider"></div>' +
            '      <div data-status="normal" class="status-num">' +
            '        <div class="status-dot"></div>' +
            '        <div class="status-text">' + task.success_count + '</div>' +
            '      </div>' +
            '    </div>' +
            '    <div class="action-type">' +
            '      <span class="action-badge" data-type="' + task.action_type + '">' + task.action_label + '</span>' +
            '    </div>' +
            '    <div class="datetime-container">' +
            '      <div class="calendar-event-1"></div>' +
            '      <div class="datetime-text"><span class="f025-08-17110112_span">' + task.datetime + '</span></div>' +
            '    </div>' +
            '    <div class="action-container">' +
            '      <a href="#" data-task-id="' + task.task_id + '" data-revno="' + task.rev_no + '" class="linked-button">' +
            '        <span class="linked-button-text">결과보기</span>' +
            '        <div class="linked-button-icon"></div>' +
            '      </a>' +
            '    </div>' +
            '  </div>' +
            '</div>';
        rendered++;
    }

/*    for (var p = rendered; p < g_max_rows; p++) {
        html +=
            '<div data-status="Default" class="task_item placeholder">' +
            '  <div class="task-row">' +
            '    <div data-status="" class="status-icon"></div>' +
            '    <div class="task-name">' +
            '      <div class="task-name-container">&nbsp;</div>' +
            '    </div>' +
            '    <div class="status-container">' +
            '      <div data-status="error" class="status-num">' +
            '        <div class="status-dot"></div>' +
            '        <div class="status-text">-</div>' +
            '      </div>' +
            '      <div class="status-divider"></div>' +
            '      <div data-status="warning" class="status-num">' +
            '        <div class="status-dot"></div>' +
            '        <div class="status-text">-</div>' +
            '      </div>' +
            '      <div class="status-divider"></div>' +
            '      <div data-status="normal" class="status-num">' +
            '        <div class="status-dot"></div>' +
            '        <div class="status-text">-</div>' +
            '      </div>' +
            '    </div>' +
            '    <div class="action-type">' +
            '      <span class="action-badge" data-type="">-</span>' +
            '    </div>' +
            '    <div class="datetime-container">' +
            '      <div class="calendar-event-1"></div>' +
            '      <div class="datetime-text"><span class="f025-08-17110112_span">-</span></div>' +
            '    </div>' +
            '    <div class="action-container">' +
            '      <a href="#" class="linked-button" tabindex="-1" aria-hidden="true" data-disabled="true">' +
            '        <span class="linked-button-text">-</span>' +
            '        <div class="linked-button-icon"></div>' +
            '      </a>' +
            '    </div>' +
            '  </div>' +
            '</div>';
    }*/

    container.innerHTML = html;
    container.style.display = "flex";
    if (nodata) nodata.style.display = "none";
}

function setLoading() {
    var container = document.getElementById("taskList");
    var nodata = document.getElementById("nodataContainer");
    if (container) {
        container.innerHTML = '<div class="nodata-text">Loading...</div>';
        container.style.display = "flex";
    }
    if (nodata) nodata.style.display = "none";
}

function setError(message) {
    var container = document.getElementById("taskList");
    if (container) {
        container.innerHTML = '<div class="nodata-text">' + (message || "불러오기에 실패했습니다.") + '</div>';
        container.style.display = "flex";
    }
}

function getTaskListData() {
    var data = {
        page: 1,
        perPage: g_max_tasks, // 최대 지정된 Task 수 만큼만 조회 후 조건에 맞는 max개 선택
        id: '',
        owner_id: '',
        publish_id: '',
        permitted_id: g_login_id,
        rev_zero: ''
    };

    return $.ajax({
        url        : '/task/list',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(data),
        async      : false,
        contentType: "application/json",
        success    : function(result) {
            if (result['resultCode'] == 'EM0999') {
                setError("[" + result['resultCode'] + "] " + result['resultMsg']);
                return;
            }

        //console.log('Task List Result:', result);

        // 1단계: Task 목록 확보
        var taskList = result['taskList'] || [];

        // 권한이 있는(Task read 권한) Task만 필터링
        var filteredTasks = taskList.filter(function(t) {
            var hasReadPerm = t && typeof t['permMode'] === 'string' && t['permMode'].charAt(0) === 'r';
            return hasReadPerm;
        });

      if (filteredTasks.length === 0) {
        renderTaskList([]);
        return;
      }

      // 2단계: 각 Task별로 최신 execution 결과 조회 (전량)
      getExecutionResultsForTasks(filteredTasks);
    },
    error: function() {
      setError();
    }
  });
}

function getExecutionResultsForTasks(taskList) {
    var completedTasks = 0;
    var tasksWithExecutionData = [];
    var maxTasks = taskList.length;

    if (maxTasks === 0) {
        renderTaskList([]);
        return;
    }

    for (var i = 0; i < maxTasks; i++) {
        var task = taskList[i];
        getLatestExecutionForTask(task, function(taskData, executionData) {
            tasksWithExecutionData.push({
                task: taskData,
                execution: executionData
            });

            completedTasks++;

            // 모든 Task의 execution 조회가 완료되면 렌더링
            if (completedTasks === maxTasks) {
                renderTasksWithExecutionData(tasksWithExecutionData);
            }
        });
    }
}

function getExecutionInfo(executionNo, callback) {
    var param = {
        execution_no: executionNo
    };

    $.ajax({
        url        : '/execution/info',
        type       : "POST",
        dataType   : "json",
        data       : JSON.stringify(param),
        async      : false,
        contentType: "application/json",
        success    : function(result) {

            //console.log("result", result);
            var info = result && (result['executionInfo'] || result);
            callback(info || null);
        },
        error: function() {
          callback(null);
        }
    });
}

function getLatestExecutionForTask(task, callback) {
    var executionData = {
        page: 1,
        perPage: 1, // 가장 최근 1개만 조회
        task_id: task['id'],
        owner_id: "",
    };

    //console.log("executionData", executionData);

    $.ajax({
        url: '/execution/list',
        type: "POST",
        dataType: "json",
        data: JSON.stringify(executionData),
        contentType: "application/json",
        success: function(result) {
            //console.log('Execution Result for Task ' + task['id'] + ':', result);

            var latestExecution = null;
            if (result['executionList'] && result['executionList'].length > 0) {
                // endDate 기준으로 정렬하여 가장 최근 것 선택
                var executions = result['executionList'].sort(function(a, b) {
                  var dateA = new Date(a['endDate'] || 0);
                  var dateB = new Date(b['endDate'] || 0);
                  return dateB - dateA; // 내림차순 정렬
                });
                latestExecution = executions[0];
              }

            if (latestExecution && latestExecution['executionNo']) {
                getExecutionInfo(latestExecution['executionNo'], function(info) {
                    if (info) {
                        latestExecution['_info'] = info;
                    }
                    callback(task, latestExecution);
                });
                return;
            }

            callback(task, latestExecution);
        },
        error: function() {
            console.log('Failed to get execution data for task:', task['id']);
            callback(task, null);
        }
    });
}

function renderTasksWithExecutionData(tasksWithExecutionData) {
    var tasks = [];
  
    // 실행 기록 있는 항목 우선, endDate 최신순 정렬
    var sorted = tasksWithExecutionData.slice().sort(function(a, b) {
        var aHas = !!(a.execution && a.execution['endDate']);
        var bHas = !!(b.execution && b.execution['endDate']);

        if (aHas !== bHas) {
            return aHas ? -1 : 1; // 실행 기록 있는 것을 먼저
        }
        if (aHas && bHas) {
            var aTime = new Date(a.execution['endDate']).getTime();
            var bTime = new Date(b.execution['endDate']).getTime();
            return bTime - aTime; // 최신 먼저
        }

        // 실행 기록이 모두 없으면 발행일자 최신순 정렬
        var aPub = a.task && a.task['publishDate'] ? new Date(a.task['publishDate']).getTime() : -Infinity;
        var bPub = b.task && b.task['publishDate'] ? new Date(b.task['publishDate']).getTime() : -Infinity;
        return bPub - aPub;
    });
  
    // 정렬된 리스트에서 상위 5개만 사용
    for (var i = 0; i < sorted.length && i < g_max_rows; i++) {
        var taskData = sorted[i].task;
        var executionData = sorted[i].execution;

        // execution 데이터가 있는 경우 상태 정보 추출
        var errorCount   = g_str_na;
        var warningCount = g_str_na;
        var successCount = g_str_na;
        var status       = 'Normal';
        var statusIcon   = 'NoExec';
        var datetime     = g_str_na;
        var executionNo  = executionData && executionData['executionNo'] ? executionData['executionNo'] : null;

        var actionType = 'NoExec';
        var actionLabel = '미수행';

        // execution 기록이 있는 경우, 해당 데이터로 display 항목 세팅
        if (executionData) {
            var info = executionData['_info'] || {};
            var infoFailure = info['resultFailureCnt'];
            var infoNa      = info['resultNaCnt'];
            var infoSuccess = info['resultSuccessCnt'];
            var listFailure = executionData['resultFailureCnt'];
            var listNa      = executionData['resultNaCnt'];
            var listSuccess = executionData['resultSuccessCnt'];

            if(info && info['resultCode']=='EM1005') {
                errorCount   = g_str_na;
                warningCount = g_str_na;
                successCount = g_str_na;
            } else {
                errorCount   = (infoFailure != null ? infoFailure : (listFailure != null ? listFailure : 0));
                warningCount = (infoNa      != null ? infoNa      : (listNa      != null ? listNa      : 0));
                successCount = (infoSuccess != null ? infoSuccess : (listSuccess != null ? listSuccess : 0));
            }

            // 상태 결정 : N(n/a), S(성공,success), F(실패,failure)
            if (info['result'] === 'F') {
                status = 'Error';
                statusIcon = 'Error';
            } else if (info['result'] === 'N') {
                status = 'Warning';
                statusIcon = 'Warning';
            } else {
                status = 'Normal';
                statusIcon = 'Normal';
            }

            // 수행 일시: execution/list 의 endDate 사용
            var endDate = executionData['endDate'];
            if (endDate) {
                datetime = formatDateTime(new Date(endDate));
            }

            // 실행 타입: runnerType 기반으로 표시
            var rt = info['runnerType'] || executionData['runnerType'] || 'Task';
            if (rt === 'S') {
                actionType = 'Schedule';
                actionLabel = '스케줄';
            } else if (rt === 'U') {
                actionType = 'Manual';
                actionLabel = '사용자';
            } else {
                actionType = 'Task';
                actionLabel = '태스크';
            }
        }

        // 최종 5개 중 revNo == 0 인 경우 실행타입을 '미발행' 으로 표시
        var revNoFinal = parseInt(taskData['revNo'], 10);
        if (!isNaN(revNoFinal) && revNoFinal === 0) {
            actionType = 'NoExec';
            actionLabel = '미발행';
        }
    
        tasks.push({
            task_id: taskData['id'],
            rev_no: taskData['revNo'],
            status: status,
            status_icon: statusIcon,
            error_count: errorCount,
            warning_count: warningCount,
            success_count: successCount,
            execution_no: executionNo,
            action_type: actionType,
            action_label: actionLabel,
            datetime: datetime
        });
    }
  
    renderTaskList(tasks);
}

function fetchTasksAndRender() {
    setLoading();
    getTaskListData();
}

function setEventListener() {

    if ($('#taskList')._eventBound) return;

    $('#taskList').on('click', function(e) {

        // 1) Task 이름 링크 클릭 시 수행이력 이동
        var nameLink = e.target && e.target.closest && e.target.closest('.task-name-link');
        if (nameLink) {
            e.preventDefault();
            var taskId = nameLink.getAttribute('data-task-id');
            if (!taskId) return;

            var params = {
                'sc_id'      : taskId,
                'sc_owner_id': "",
                'sc_page'    : 1,
                'sc_per_page': 10,
            };

            opme_postWithParam('/execution/', params);
            return;
        }

        // 1-1) Task 링크 클릭 시 상세조회 이동
        var taskLink = e.target && e.target.closest && e.target.closest('.linked-button');
        if (taskLink) {
/*            e.preventDefault();
            var taskId = taskLink.getAttribute('data-task-id');
            var revNo = taskLink.getAttribute('data-revno');
            if (!taskId || !revNo) return;

            var params = {
                'task_id'      : taskId,
                'rev_no'       : revNo,
                'sc_id'        : "",
                'sc_owner_id'  : "",
                'sc_rev_zero'  : 0,
                'sc_publish_id': "",
                'sc_page'      : 1,
                'sc_per_page'  : 10,
            };

            opme_postWithParam('/task/dtl', params);
            return;*/

            e.preventDefault();
            var taskId = taskLink.getAttribute('data-task-id');
            if (!taskId) return;

            var params = {
                'sc_id'      : taskId,
                'sc_owner_id': "",
                'sc_page'    : 1,
                'sc_per_page': 10,
            };

            opme_postWithParam('/execution/', params);
            return;
        }

    });

    $('#taskList')._eventBound = true;

    // 매뉴얼 버튼. Overview 페이지로 강제 이동
    $('#btn_manual').on('click', function(e){
        opme_popupHelp("/overview/");
    });

    // Tag 찾기 버튼 > 태그 정보 조회 팝업
    $('#btn_tag_search').on('click', function(e){
        opme_searchTag("Tag 정보 조회",'single');
    });

    // Homepage 버튼
    $('#btn_home').on('click', function(e){
        window.open('https://opmate.github.io/', '_blank');
    });
}

