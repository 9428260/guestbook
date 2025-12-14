// AI Chat 관련 변수
function hasValidTaskId(taskId) {
    return typeof taskId !== 'undefined' && taskId !== null && String(taskId).trim() !== '';
}

var aiChatOpen = false;
var chatHistory = [];
var taskact = '';
var chatMode = 'agent'; // 'agent' or 'ask'
var hasSearchedInAskMode = false; // Ask 모드에서 검색을 진행했는지 추적
var isExistingTaskContext = hasValidTaskId(g_task_id);
var agentModeAllowedPatterns = [
    /스크립트(?:를|을)?\s*(수정|개선|업데이트|리뷰|검토|분석)/i,
    /script\s*(modify|improve|update|review|analy[sz]e)/i,
    /(modify|improve|update|review|analy[sz]e)\s+(the\s+)?script/i
];
var pendingRegisterTaskData = null;
var isAwaitingTaskRegisterConfirm = false;
var hasShownRegisterTaskAlert = false;
var pendingSchedulePromptMessage = null;
var isAwaitingTargetInfo = false;
var isTaskWithNodesRegistration = false;  // 태스크와 노드를 함께 등록했는지 여부

function formatWorkflowTemplate(template, context) {
    if (!template) {
        return '';
    }

    var safeContext = context || {};
    return template.replace(/\{([^}]+)\}/g, function(match, key) {
        var normalizedKey = (key || '').trim();
        if (!normalizedKey) {
            return '';
        }
        if (!Object.prototype.hasOwnProperty.call(safeContext, normalizedKey)) {
            return '';
        }
        var value = safeContext[normalizedKey];
        return value === undefined || value === null ? '' : String(value);
    });
}

function getWorkflowSystemMessage(step, context) {
    if (!step) {
        return '';
    }
    var templates = window.workflowSystemMessages || {};
    var template = templates[step];
    if (!template) {
        return '';
    }
    return formatWorkflowTemplate(template, context);
}

function getScheduleGuideContent(taskName) {
    var context = {
        task_name: taskName || ((window.taskWorkflowSession && window.taskWorkflowSession.task_name) || '')
    };
    var message = getWorkflowSystemMessage('ask_schedule', context);
    if (message) {
        return message;
    }
    var fallback = getWorkflowSystemMessage('schedule_prompt_fallback', context);
    return fallback || '';
}

function getCurrentWorkflowStep() {
    if (typeof window.taskWorkflowSession === 'object' && window.taskWorkflowSession !== null) {
        return window.taskWorkflowSession.workflow_step || '';
    }
    return '';
}

function isAgentMessageAllowed(message) {
    if (!isExistingTaskContext) {
        return true;
    }

    if (!message) {
        return false;
    }

    var workflowStep = getCurrentWorkflowStep();
    if (workflowStep === 'waiting_for_modification_request' ||
        workflowStep === 'waiting_for_review_request' ||
        workflowStep === 'ask_modification') {
        return true;
    }

    return agentModeAllowedPatterns.some(function(pattern) {
        return pattern.test(message);
    });
}

function getAgentRestrictionNotice() {
    return getWorkflowSystemMessage('agent_restriction_notice') ||
        '현재 선택한 태스크에서는 Agent 모드로 스크립트 수정 또는 스크립트 리뷰 요청만 수행할 수 있습니다.';
}

function notifyAgentRestriction() {
    addAiMessage(getAgentRestrictionNotice());
}

function getWelcomeMarkdown() {
    var key = isExistingTaskContext ? 'welcome_existing_task' : 'welcome_new_task';
    var message = getWorkflowSystemMessage(key);
    if (message) {
        return message;
    }

    if (isExistingTaskContext) {
        return `안녕하세요! **OPMATE AI 어시스턴트**입니다.
현재 편집 중인 태스크에 대해 도움이 필요하시면 말씀해주세요.
##### 🤖 **Agent 모드** (편집 지원)
- ⚙️ **스크립트 수정**: "스크립트 수정", "스크립트 개선", "스크립트 업데이트" 등으로 요청
- 📋 **스크립트 리뷰**: "스크립트 리뷰", "스크립트 검토", "스크립트 분석" 등으로 요청
##### 💬 **Ask 모드** (정보 검색)
- 📚 **OPMATE 매뉴얼 검색**: "태스크에 대해 알려줘", "노드에 대해 알려줘"등으로 요청`;
    }

    return `안녕하세요! **OPMATE 태스크 작성**에 도움을 드리는 AI 어시스턴트입니다.
##### 🤖 **Agent 모드** (태스크 생성)
- 📝 **태스크 작성**: "태스크 작업", "태스크 작성"등으로 요청 
- 📝 태스크명 입력 -> OS Type(Linux, Window) -> 스크립트 작성 -> 실행 노드 등록순 진행.
##### 💬 **Ask 모드** (정보 검색)
- 📚 **OPMATE 매뉴얼 검색**: "태스크에 대해 알려줘", "노드에 대해 알려줘"등으로 요청`;
}

function applyExistingTaskChatRestrictions() {
    if (!isExistingTaskContext) {
        return;
    }

    $('#chat_input').attr('placeholder', '스크립트 수정 또는 스크립트 리뷰 요청을 입력하세요...');
    $('.suggestion-btn[data-suggestion="create"]').remove();
}

function inferExistingTaskOsType() {
    var scriptName = ($('#script_name').val() || '').toLowerCase();
    if (scriptName.endsWith('.ps1') || scriptName.endsWith('.bat') || scriptName.endsWith('.cmd')) {
        return 'windows';
    }

    var separator = ($('#script_separator').val() || '').toUpperCase();
    if (separator === 'CRLF') {
        return 'windows';
    }

    return 'linux';
}

function ensureExistingTaskWorkflowDefaults() {
    if (!isExistingTaskContext) {
        return;
    }

    if (typeof window.taskWorkflowSession !== 'object' || window.taskWorkflowSession === null) {
        window.taskWorkflowSession = {};
    }

    var currentStep = window.taskWorkflowSession.workflow_step || '';
    var needsInitialization = currentStep === '' ||
        currentStep === 'ask_name' ||
        currentStep === 'ask_os_type' ||
        currentStep === 'ask_requirements';

    if (needsInitialization) {
        window.taskWorkflowSession.workflow_step = 'ask_modification';
    }

    if (!window.taskWorkflowSession.task_name) {
        window.taskWorkflowSession.task_name = $('#id').val() || '';
    }

    if (!window.taskWorkflowSession.os_type) {
        window.taskWorkflowSession.os_type = inferExistingTaskOsType();
    }

    window.taskWorkflowSession.existing_task_id = g_task_id || '';

    var scriptContent = '';
    if (typeof g_editor !== 'undefined' && g_editor && typeof g_editor.getValue === 'function') {
        scriptContent = g_editor.getValue();
    } else {
        scriptContent = $('#script_content').val() || '';
    }
    window.taskWorkflowSession.script_content = scriptContent;
    window.taskWorkflowSession.script_description = $('#description').val() || '';
}

function syncExistingTaskContext() {
    var previousContext = isExistingTaskContext;
    isExistingTaskContext = hasValidTaskId(g_task_id);

    if (!isExistingTaskContext) {
        return;
    }

    if (!previousContext) {
        applyExistingTaskChatRestrictions();
    }
    ensureExistingTaskWorkflowDefaults();
}

function showRegisterTaskConfirmationMessage() {
    var messageHtml = getWorkflowSystemMessage('register_task_confirmation_notice') ||
        `<div style="border-left: 4px solid #f44336; padding: 16px; background-color: #ffebee; color: #b71c1c; border-radius: 6px;">
<strong>⚠️ 중요 안내</strong><br>
작성된 스크립트가 서버에서 실행되도록 반영되므로 각별한 주의가 필요합니다!<br>
등록을 계속하려면 채팅창에 <strong style="color:#d32f2f;">예</strong> 라고 입력해주세요.<br>
취소하려면 다른 내용을 입력하거나 "아니오"라고 입력하면 스크립트 생성 단계로 돌아갑니다.
</div>`;

    addAiMessage(messageHtml);
}

function isYesResponse(input) {
    if (!input) {
        return false;
    }
    var lowered = input.toLowerCase();
    return input === '예' || input === '네' || lowered === 'yes' || lowered === 'y';
}

function isNoResponse(input) {
    if (!input) {
        return false;
    }
    var lowered = input.toLowerCase();
    return input === '아니오' || input === '아니요' || lowered === 'no' || lowered === 'n';
}

function redirectToScriptCreationStage(registerData) {
    if (typeof window.taskWorkflowSession !== 'object' || window.taskWorkflowSession === null) {
        window.taskWorkflowSession = {};
    }

    var session = window.taskWorkflowSession;
    var taskName = session.task_name || (registerData && registerData.task_name) || '';
    var osType = session.os_type || (registerData && registerData.os_type) || '';

    if (taskName) {
        session.task_name = taskName;
    }
    if (osType) {
        session.os_type = osType;
    }

    session.workflow_step = 'ask_requirements';
    session.task_requirements = '';

    // 스크립트/노드 관련 이전 상태는 초기화하여 생성 단계에 집중하도록 함
    delete session.script_content;
    delete session.script_description;
    delete session.search_results;
    delete session.search_result_nodes;
    delete session.selected_nodes;

    window.currentSearchResults = [];
    window.currentSearchParams = null;
    isAwaitingTargetInfo = false;

    var osDisplay = '';
    if (osType === 'windows') {
        osDisplay = '윈도우 (PowerShell)';
    } else if (osType === 'linux') {
        osDisplay = '리눅스 (Shell)';
    }

    var redirectContext = {
        task_name_line: taskName ? '✅ 태스크명: **' + taskName + '**\n' : '',
        os_display_line: osDisplay ? '✅ 운영체제: **' + osDisplay + '**\n' : ''
    };
    var guidanceMessage = getWorkflowSystemMessage('task_registration_cancelled_redirect', redirectContext);
    if (!guidanceMessage) {
        guidanceMessage = '태스크 등록을 취소하고 **스크립트 생성 단계**로 이동합니다.\n\n' +
            redirectContext.task_name_line +
            redirectContext.os_display_line +
            '\n스크립트에 포함할 요건을 다시 입력해주세요.\n' +
            '**예시:**\n' +
            '- 리눅스에서 특정 디렉토리 밑에 있는 전체 로그를 읽어서 해당 로그 내에 특정 키워드 \"reboot\", \"stop\" 등이 있는지 체크해서 찾은 결과(로그명, 라인위치)를 JSON 포맷으로 출력할 수 있도록 해주세요.\n' +
            '- 디스크 사용량 80% 이상 확인\n' +
            '- CPU 사용률 모니터링\n' +
            '- 로그 파일 정리';
    }

    addAiMessage(guidanceMessage);
}

async function handleTargetInfoInput(userInput) {
    var trimmedInput = (userInput || '').trim();

    if (!trimmedInput) {
        addAiMessage(getWorkflowSystemMessage('target_input_empty_error') ||
            '입력이 비어있습니다. 다시 입력해주세요.');
        return;
    }

    // 실행 대상 검색 요청 처리
    isAwaitingTargetInfo = false;

    try {
        // 워크플로우 세션 데이터 업데이트 - search_nodes로 변경
        if (typeof window.taskWorkflowSession !== 'object' || window.taskWorkflowSession === null) {
            window.taskWorkflowSession = {};
        }
        window.taskWorkflowSession.workflow_step = 'search_nodes';

        console.log('[프론트엔드] 실행 대상 검색 시작 - workflow_step:', window.taskWorkflowSession.workflow_step);
        console.log('[프론트엔드] 검색 조건:', trimmedInput);

        // AI 응답 요청 (generateAiResponse 내부에서 진행률 인디케이터 관리)
        var aiResponse = await generateAiResponse(trimmedInput);

        // 스트리밍 메시지 완료 처리
        finalizeStreamingMessage();

        // 스트리밍 응답이 없는 경우에만 새 메시지 추가
        if (!aiResponse || aiResponse.trim() === '') {
            addAiMessage(getWorkflowSystemMessage('ai_response_generation_error') ||
                '죄송합니다. 응답을 생성하는 중 문제가 발생했습니다. 다시 시도해주세요.');
        }

    } catch (error) {
        console.error('실행 대상 검색 중 오류:', error);

        // 스트리밍 메시지 정리
        finalizeStreamingMessage();

        var targetError = getWorkflowSystemMessage('target_search_error', { error_detail: error.message }) ||
            ('실행 대상 검색 중 오류가 발생했습니다: ' + error.message + '\n\n다시 시도해주세요.');
        addAiMessage(targetError);
        isAwaitingTargetInfo = true;
    }
}

function handleRegisterTaskConfirmation(userInput) {
    var trimmedInput = (userInput || '').trim();

    if (isYesResponse(trimmedInput)) {
        isAwaitingTaskRegisterConfirm = false;

        if (pendingRegisterTaskData) {
            performTaskRegistration(pendingRegisterTaskData);

            // 실행 대상 정보가 있는지 확인
            let hasTargetInfo = false;
            try {
                if (typeof $("#target_grid") !== 'undefined' && $("#target_grid").length > 0) {
                    let targetList = AlopexGrid.trimData($('#target_grid').alopexGrid('dataGet', {_state: {deleted: false}}));
                    hasTargetInfo = targetList && targetList.length > 0;
                }
            } catch (error) {
                console.error("실행 대상 정보 확인 중 오류:", error);
                hasTargetInfo = false;
            }

            console.log("[handleRegisterTaskConfirmation] isTaskWithNodesRegistration:", isTaskWithNodesRegistration);
            console.log("[handleRegisterTaskConfirmation] hasTargetInfo:", hasTargetInfo);

            // 태스크와 노드를 함께 등록한 경우 메시지 표시하지 않음
            // (add_nodes 이벤트에서 처리할 것임)
            if (isTaskWithNodesRegistration) {
                console.log("[handleRegisterTaskConfirmation] 태스크와 노드를 함께 등록 - add_nodes 이벤트에서 메시지 표시 예정");
                // 메시지 표시하지 않고 바로 종료
                // 플래그는 add_nodes 이벤트에서 리셋됨
            } else {
                // 실행 대상 정보 유무에 따라 다른 메시지 표시
                if (hasTargetInfo) {
                    // 실행 대상 정보가 있으면 스케줄 등록으로 이동
                    if (pendingSchedulePromptMessage) {
                        addAiMessage(pendingSchedulePromptMessage);
                        pendingSchedulePromptMessage = null;
                    } else {
                        // 태스크만 등록한 경우 기존 메시지 표시
                        var scheduleGuide = getScheduleGuideContent(window.taskWorkflowSession && window.taskWorkflowSession.task_name);
                        var scheduleMessage = getWorkflowSystemMessage(
                            'task_registration_completed_with_schedule',
                            { schedule_guide: scheduleGuide || '' }
                        ) || ('태스크 등록이 완료되었습니다! ✅\n\n' + (scheduleGuide || ''));
                        addAiMessage(scheduleMessage);
                    }
                } else {
                    // 실행 대상 정보가 없으면 실행 대상 등록으로 이동
                    var targetGuide = getWorkflowSystemMessage('task_registration_completed_need_targets');
                    if (!targetGuide) {
                        targetGuide = '태스크 등록이 완료되었습니다! ✅\n\n' +
                            '이제 **실행 대상 정보를 설정**해보겠습니다.\n\n' +
                            '실행할 서버의 호스트명이나 조건을 입력해주세요.\n' +
                            '- 특정 호스트명: "hostname=server01"\n' +
                            '- OS 타입으로 검색: "os_type=linux"\n' +
                            '- 여러 조건: "hostname=web*, os_type=linux"\n\n' +
                            '또는 **노드 검색**이라고 입력하여 노드를 검색할 수 있습니다.';
                    }
                    addAiMessage(targetGuide);
                    isAwaitingTargetInfo = true;
                }
            }

            pendingRegisterTaskData = null;
        } else {
            addAiMessage(getWorkflowSystemMessage('task_registration_missing_data') ||
                '등록할 태스크 정보가 존재하지 않습니다. 다시 시도해주세요.');
        }

        return;
    }

    if (isNoResponse(trimmedInput)) {
        var registerDataSnapshot = pendingRegisterTaskData;
        isAwaitingTaskRegisterConfirm = false;
        pendingRegisterTaskData = null;
        pendingSchedulePromptMessage = null;
        redirectToScriptCreationStage(registerDataSnapshot);
        return;
    }

    // Any response other than '예' is treated as cancellation.
    isAwaitingTaskRegisterConfirm = false;
    pendingRegisterTaskData = null;
    pendingSchedulePromptMessage = null;
    addAiMessage(getWorkflowSystemMessage('task_registration_cancelled') ||
        '태스크 등록을 취소했습니다. 필요하시면 다시 요청해주세요.');
}

function performTaskRegistration(data) {
    if (!data) {
        addAiMessage(getWorkflowSystemMessage('task_registration_data_absent') ||
            '등록할 태스크 데이터가 없습니다. 다시 시도해주세요.');
        return;
    }

    try {
        const taskName = data.task_name || '';
        const scriptContent = data.script_content || '';
        const scriptDescription = data.script_description || '';
        const osType = data.os_type || 'linux';

        // 세션 데이터 확인
        console.log("===== register_task 이벤트 처리 시작 =====");
        console.log("현재 taskWorkflowSession:", window.taskWorkflowSession);
        console.log("selected_nodes 존재 여부:", window.taskWorkflowSession && window.taskWorkflowSession.selected_nodes);

        console.log("===== 추출된 값들 =====");
        console.log("태스크명:", taskName);
        console.log("스크립트 길이:", scriptContent.length);
        console.log("스크립트 설명:", scriptDescription);
        console.log("스크립트 설명 타입:", typeof scriptDescription);
        console.log("스크립트 설명 길이:", scriptDescription ? scriptDescription.length : 0);
        console.log("OS 타입:", osType);

        // 1. 태스크 ID 입력 필드에 태스크명 설정
        const taskIdInput = document.getElementById('id');
        if (taskIdInput) {
            taskIdInput.value = taskName;
            console.log("태스크명이 입력 필드에 설정되었습니다:", taskName);
        }

        // 2. 스크립트명 설정 (OS 타입에 따라 .sh 또는 .ps1)
        const scriptNameInput = document.getElementById('script_name');
        const fileExtension = osType === 'windows' ? '.ps1' : '.sh';
        const fileName = taskName.replace(/\s+/g, '_').toLowerCase() + fileExtension;
        if (scriptNameInput) {
            // 태스크명을 파일명으로 변환 (공백 제거, 소문자 변환)
            scriptNameInput.value = fileName;
            console.log("스크립트명이 설정되었습니다:", fileName);
        }

        // 3. 실행자 설정 (root)
        const scriptAccountInput = document.getElementById('script_account');
        if (scriptAccountInput) {
            scriptAccountInput.value = 'root';
            console.log("실행자가 설정되었습니다: root");
        }

        // 4. OS 타입에 따라 script_separator 자동 설정
        const separatorValue = osType === 'windows' ? 'CRLF' : 'LF';
        const scriptSeparatorSelect = $('#script_separator');
        if (scriptSeparatorSelect.length > 0) {
            scriptSeparatorSelect.val(separatorValue).trigger('change');
            console.log("파일 유형(개행)이 설정되었습니다:", separatorValue);
        }

        // 5. OS 타입에 따라 인코딩 자동 설정
        const encodingValue = osType === 'windows' ? 'cp949' : 'utf-8';
        const scriptEncodingSelect = $('#script_encoding');
        if (scriptEncodingSelect.length > 0) {
            scriptEncodingSelect.val(encodingValue).trigger('change');
            console.log("스크립트 인코딩이 설정되었습니다:", encodingValue);
        }

        // 6. 설명 설정
        const descriptionTextarea = document.getElementById('description');
        console.log("description 요소 찾기:", descriptionTextarea);
        console.log("script_description 값:", scriptDescription);

        if (descriptionTextarea) {
            descriptionTextarea.value = scriptDescription;
            console.log("설명이 설정되었습니다:", scriptDescription);
            console.log("설정 후 description.value:", descriptionTextarea.value);
        } else {
            console.error("description 요소를 찾을 수 없습니다!");
        }

        // 7. CodeMirror 에디터에 스크립트 내용 설정
        if (typeof g_editor !== 'undefined' && g_editor) {
            g_editor.setValue(scriptContent);
            g_editor.refresh();

            // 스크립트명을 기반으로 Syntax Mode 적용 (DOM에서 현재 값 가져오기)
            const scriptNameValue = fileName;
            if (scriptNameValue && typeof changeSyntaxMode === 'function') {
                console.log("CodeMirror 문법 하이라이팅 적용 중... 파일명:", scriptNameValue);
                changeSyntaxMode(g_editor, scriptNameValue);
                
                // changeSyntaxMode는 비동기이므로 약간의 지연 후 다시 refresh
                setTimeout(function() {
                    g_editor.refresh();
                    console.log("CodeMirror 문법 하이라이팅 적용 완료");
                }, 200);
            }
            console.log("스크립트가 CodeMirror에 설정되었습니다");
        } else {
            // CodeMirror가 없으면 textarea에 직접 설정
            const scriptTextarea = document.getElementById('script_content');
            if (scriptTextarea) {
                scriptTextarea.value = scriptContent;
                console.log("스크립트가 textarea에 설정되었습니다");
            }
        }

        // 8. 세션 데이터에 노드 정보가 있으면 자동으로 노드 추가
        if (window.taskWorkflowSession && window.taskWorkflowSession.selected_nodes && window.taskWorkflowSession.selected_nodes.length > 0) {
            console.log(`[프론트엔드] register_task 처리 중 세션에 노드 정보 발견: ${window.taskWorkflowSession.selected_nodes.length}개`);

            const nodes = window.taskWorkflowSession.selected_nodes;

            // search_params에서 customer와 operator를 추출하여 tag 생성
            let customer = '';
            let operator = '';
            if (window.currentSearchParams) {
                customer = window.currentSearchParams.customer || '';
                operator = window.currentSearchParams.operator || '';
                console.log(`[프론트엔드] search_params에서 추출: customer=${customer}, operator=${operator}`);
            }

            // tag 생성 (customer와 operator가 있을 경우만 추가)
            const tagParts = [];
            if (customer) {
                tagParts.push(`WP.customer_nm=${customer}`);
            }
            if (operator) {
                tagParts.push(`WP.sys_operator1_nm=${operator}`);
            }
            const tag = tagParts.join(',');

            // 노드가 존재할 경우 실행 대상 그리드에 추가
            let addedCount = 0;
            let skippedCount = 0;

            if (nodes && nodes.length > 0) {

                // search_params가 있으면 매핑된 값 사용, 없으면 기존 노드 값 사용
                const nodeSetInfo = {
                    hostname: (window.currentSearchParams && window.currentSearchParams.hostname) ? window.currentSearchParams.hostname : '',
                    osType: (window.currentSearchParams && window.currentSearchParams.os_type) ? window.currentSearchParams.os_type : '',
                    osName: (window.currentSearchParams && window.currentSearchParams.os_name) ? window.currentSearchParams.os_name : '',
                    osVersion: (window.currentSearchParams && window.currentSearchParams.os_version) ? window.currentSearchParams.os_version : '',
                    tag: tag || '',
                    account: '',
                    description: ''
                };

                console.log(`[프론트엔드] 노드 추가 시도:`, nodeSetInfo);

                if (typeof addTargetGrid === 'function') {
                    const result = addTargetGrid(nodeSetInfo);
                    if (result) {
                        addedCount++;
                    } else {
                        skippedCount++;
                    }
                } else {
                    console.error("addTargetGrid 함수를 찾을 수 없습니다.");
                }
            }

            // Grid 편집 모드 시작
            if (typeof $("#target_grid") !== 'undefined' && typeof addedCount !== 'undefined') {
                $("#target_grid").alopexGrid('startEdit');

                // Grid 데이터가 증가하면, height 를 고정시키고, Scroll 처리.
                let pageInfo = $('#target_grid').alopexGrid('pageInfo');
                if (pageInfo['dataLength'] > 10) {
                    $("#target_grid").alopexGrid('updateOption', {height: '500px'});
                }

                // Grid 편집 모드 종료
                $("#target_grid").alopexGrid('endEdit');
            }

            console.log(`[프론트엔드] ${addedCount}개 노드 추가 완료`);
        }

        // 9. 사용자에게 알림
        if (!hasShownRegisterTaskAlert) {
            const fileExtension = osType === 'windows' ? '.ps1' : '.sh';
            const osDisplay = osType === 'windows' ? '윈도우 (PowerShell)' : '리눅스 (Shell)';
            alert(`태스크 정보가 자동으로 입력되었습니다.\n\n` +
                  `📋 태스크명: ${taskName}\n` +
                  `💻 운영체제: ${osDisplay}\n` +
                  `📝 스크립트명: ${taskName.replace(/\s+/g, '_').toLowerCase()}${fileExtension}\n` +
                  `👤 실행자: root\n` +
                  `📄 설명: ${scriptDescription}\n\n` +
                  `추가 설정(실행 대상, 스케줄 등)을 완료한 후 저장해주세요.`);
            hasShownRegisterTaskAlert = true;
        }

        // 10. 실행 대상 정보 확인 및 워크플로우 세션 상태 업데이트
        if (typeof window.taskWorkflowSession !== 'object' || window.taskWorkflowSession === null) {
            window.taskWorkflowSession = {};
        }

        // 실행 대상 정보가 있는지 확인
        let hasTargetInfo = false;
        try {
            if (typeof $("#target_grid") !== 'undefined' && $("#target_grid").length > 0) {
                let targetList = AlopexGrid.trimData($('#target_grid').alopexGrid('dataGet', {_state: {deleted: false}}));
                hasTargetInfo = targetList && targetList.length > 0;
                console.log("실행 대상 정보 확인:", hasTargetInfo, "개수:", targetList ? targetList.length : 0);
            }
        } catch (error) {
            console.error("실행 대상 정보 확인 중 오류:", error);
            hasTargetInfo = false;
        }

        // 실행 대상 정보 유무에 따라 다음 단계 설정
        if (hasTargetInfo) {
            window.taskWorkflowSession.workflow_step = 'ask_schedule';
        } else {
            window.taskWorkflowSession.workflow_step = 'ask_target';
        }

        window.taskWorkflowSession.task_name = taskName;
        window.taskWorkflowSession.os_type = osType;
        window.taskWorkflowSession.script_content = scriptContent;
        window.taskWorkflowSession.script_description = scriptDescription;
        if (window.taskWorkflowSession.selected_nodes) {
            delete window.taskWorkflowSession.selected_nodes;
        }
        if (window.taskWorkflowSession.search_results) {
            delete window.taskWorkflowSession.search_results;
        }
        if (window.taskWorkflowSession.search_result_nodes) {
            delete window.taskWorkflowSession.search_result_nodes;
        }
    } catch (error) {
        console.error("register_task 처리 오류:", error);
        alert('태스크 등록 중 오류가 발생했습니다: ' + error.message);
    }
}

// CodeMirror 안전성을 위한 전역 변수 초기화 체크
if (typeof g_editor === 'undefined') {
    var g_editor = null;
}

// AI 응답에서 코드 블록을 파싱하고 CodeMirror에 적용하는 함수
function parseAndApplyCodeBlock(content) {
    if (!content || typeof content !== 'string') {
        return false;
    }
    
    // 코드 블록 패턴 매칭 (bash, powershell, shell, cmd, bat 등)
    const codeBlockRegex = /```(?:bash|shell|sh|powershell|ps1|cmd|bat)\s*\n([\s\S]*?)```/gi;
    const matches = content.match(codeBlockRegex);
    
    if (!matches || matches.length === 0) {
        console.log('AI 응답에 코드 블록이 없습니다.');
        return false;
    }
    
    try {
        // 첫 번째 코드 블록 추출
        const firstMatch = matches[0];
        const codeContent = firstMatch.replace(/```(?:bash|shell|sh|powershell|ps1|cmd|bat)\s*\n/i, '').replace(/```$/, '').trim();
        
        if (!codeContent) {
            console.log('코드 블록 내용이 비어있습니다.');
            return false;
        }
        
        // 언어 타입 감지
        const languageMatch = firstMatch.match(/```(bash|shell|sh|powershell|ps1|cmd|bat)/i);
        const detectedLanguage = languageMatch ? languageMatch[1].toLowerCase() : 'bash';
        
        // OS 타입과 파일 확장자 결정
        let osType = 'linux';
        let fileExtension = '.sh';
        
        if (['powershell', 'ps1'].includes(detectedLanguage)) {
            osType = 'windows';
            fileExtension = '.ps1';
        } else if (['cmd', 'bat'].includes(detectedLanguage)) {
            osType = 'windows';
            fileExtension = '.bat';
        }
        
        console.log('AI 응답에서 스크립트 감지:', {
            language: detectedLanguage,
            osType: osType,
            extension: fileExtension,
            contentLength: codeContent.length
        });
        
        // CodeMirror에 적용
        if (typeof g_editor !== 'undefined' && g_editor) {
            g_editor.setValue(codeContent);
            g_editor.refresh();
            
            // 스크립트명 자동 생성 및 설정
            const timestamp = new Date().toISOString().replace(/[-:]/g, '').substring(0, 15);
            const fileName = `ai_generated_${timestamp}${fileExtension}`;
            
        
            // CodeMirror 문법 하이라이팅 적용
            if (typeof changeSyntaxMode === 'function') {
                console.log('CodeMirror 문법 하이라이팅 적용 중... 파일명:', fileName);
                changeSyntaxMode(g_editor, fileName);
                
                // changeSyntaxMode는 비동기이므로 약간의 지연 후 다시 refresh
                setTimeout(function() {
                    g_editor.refresh();
                    console.log('AI 응답 - CodeMirror 문법 하이라이팅 적용 완료');
                }, 200);
            }
            
            console.log('AI 응답에서 스크립트가 CodeMirror에 적용되었습니다');
            return true;
        } else {
            // CodeMirror가 없으면 textarea에 직접 설정
            const scriptTextarea = document.getElementById('script_content');
            if (scriptTextarea) {
                scriptTextarea.value = codeContent;
                console.log('AI 응답에서 스크립트가 textarea에 적용되었습니다');
                return true;
            }
        }
        
    } catch (error) {
        console.error('AI 응답 코드 블록 파싱 중 오류:', error);
        return false;
    }
    
    return false;
}


// AI Chat 기능 초기화
$(document).ready(function() {
    initAiChat();
    initDiffToggle();
});

// 태스크 비교와 Task Wizard 토글 기능 초기화
function initDiffToggle() {
    // 기존 태스크 비교 버튼 이벤트 오버라이드
    $('#btn_diff').off('click').on('click', function(e) {
        // Task Wizard 버튼 숨기기
        $('#btn_ai_chat').hide();
        $('#btn_ai_chat_close').hide();

        // 기존 selectTaskForDiff 함수 호출
        if (typeof selectTaskForDiff === 'function') {
            selectTaskForDiff();
        }
    });

    // 기존 태스크 비교 닫기 버튼 이벤트 오버라이드
    $('#btn_diff_close').off('click').on('click', function(e) {
        // 기존 closeDiffData 함수 호출
        if (typeof closeDiffData === 'function') {
            closeDiffData();
        }

        // Task Wizard 버튼 보이기 (closeDiffData 실행 후)
        setTimeout(function() {
            $('#btn_ai_chat').show();
            $('#btn_diff').show();
        }, 100);
    });
}



// 백엔드 API 호출 헬퍼 함수
async function callBackendAPI(url, data) {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: url,
            type: "POST",
            async: true,
            dataType: "json",
            data: JSON.stringify(data),
            contentType: "application/json",
            timeout: 300000,  // 5분 타임아웃
            success: function(result) {
                resolve(result);
            },
            error: function(xhr, status, error) {
                console.error('API call failed:', status, error);
                if (status === 'timeout') {
                    reject(new Error('요청 시간이 초과되었습니다 (5분). AI 응답 생성에 시간이 걸릴 수 있습니다. 잠시 후 다시 시도해주세요.'));
                } else if (xhr.status === 500) {
                    reject(new Error('서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'));
                } else if (xhr.status === 404) {
                    reject(new Error('요청한 서비스를 찾을 수 없습니다.'));
                } else if (xhr.status === 0) {
                    reject(new Error('네트워크 연결을 확인해주세요.'));
                } else {
                    reject(new Error(`네트워크 오류가 발생했습니다. (${xhr.status}) 잠시 후 다시 시도해주세요.`));
                }
            }
        });
    });
}

function initAiChat() {
    // AI 채팅 버튼 이벤트 연결
    $('#btn_ai_chat').on('click', function() {
        toggleAiChat(true);
    });

    $('#btn_ai_chat_close').on('click', function() {
        toggleAiChat(false);
    });

    // 채팅창 닫기 버튼 이벤트
    $('#btn_chat_close').on('click', function() {
        toggleAiChat(false);
    });

    // 채팅창 리사이즈 기능 초기화
    initChatResize();

    // 모드 선택 버튼 이벤트
    $('.mode-btn').on('click', function() {
        var previousMode = chatMode;
        var newMode = $(this).data('mode');

        $('.mode-btn').removeClass('active');
        $(this).addClass('active');
        chatMode = newMode;

        console.log('Chat mode changed from', previousMode, 'to:', chatMode);
        console.log('Active button data-mode:', $(this).data('mode'));
        console.log('hasSearchedInAskMode:', hasSearchedInAskMode);

        // Ask 모드에서 Agent 모드로 전환될 때 (검색을 진행한 경우에만)
        if (previousMode === 'ask' && newMode === 'agent' && hasSearchedInAskMode) {
            showAgentModeGuide();
            // 플래그 초기화
            hasSearchedInAskMode = false;
        }

        // Agent 모드에서 Ask 모드로 전환될 때 플래그 초기화
        if (previousMode === 'agent' && newMode === 'ask') {
            hasSearchedInAskMode = false;
        }
    });

    // 메시지 전송 버튼 이벤트
    $('#btn_send_message').on('click', function() {
        sendMessage();
    });

    // 입력창 이벤트
    $('#chat_input').on('input', function() {
        updateSendButton();
    });

    $('#chat_input').on('keydown', function(e) {
        handleKeyPress(e);
    });

    // IME 조합 상태 처리를 위한 compositionend 이벤트 추가
    $('#chat_input').on('compositionend', function(e) {
        // IME 조합이 끝난 후 엔터 키 처리
        setTimeout(function() {
            if (e.originalEvent && e.originalEvent.inputType === 'insertCompositionText') {
                // 조합 완료 후 약간의 지연을 두어 안정적으로 처리
            }
        }, 10);
    });

    // 제안 버튼 이벤트
    $('.suggestion-btn').on('click', async function() {
        var suggestion = $(this).data('suggestion');
        taskact = suggestion;

        if(suggestion == 'create'){
            var message = $('#chat_input').val().trim();
            if (message.length === 0) {
                addAiMessage(getWorkflowSystemMessage('script_description_prompt') ||
                    '태스크 작성을 위해 스크립트에 대한 설명을 입력해 주세요');
                return;
            }

            updateSendButton();
            await sendMessage();
            return;
        } else if(suggestion == 'manual'){
            $('#chat_input').val('태스크의 스크립트를 리뷰해주세요');
            updateSendButton();
            await sendMessage();
            return;
        } else if(suggestion == 'review'){
            $('#chat_input').val('태스크의 스크립트를 리뷰해주세요');
            updateSendButton();
            await sendMessage();
            return;
        }
    });

    // 대화 기록 삭제 버튼
    $('#btn_clear_chat').on('click', function() {
        clearChatHistory();
    });

    // 환영 메시지 초기화
    applyExistingTaskChatRestrictions();
    initWelcomeMessage();
    ensureExistingTaskWorkflowDefaults();
}

function toggleAiChat(show) {
    aiChatOpen = show;

    if (show) {
        ensureExistingTaskWorkflowDefaults();
        // 사이드 패널 표시
        $('#ai_chat_area').addClass('active');
        $('#main_content_area').addClass('chat-open');

        $('#btn_ai_chat').hide();
        $('#btn_ai_chat_close').show();

        // Task Wizard가 열리면 태스크 비교 버튼 숨기기
        $('#btn_diff').hide();
        $('#btn_diff_close').hide();

        // 채팅창 스크롤을 하단으로
        setTimeout(() => {
            scrollChatToBottom();
        }, 100);

        // ESC 키로 닫기
        $(document).on('keydown.aiChat', function(e) {
            if (e.key === 'Escape') {
                toggleAiChat(false);
            }
        });

    } else {
        // 사이드 패널 숨기기
        $('#ai_chat_area').removeClass('active');
        $('#main_content_area').removeClass('chat-open');

        $('#btn_ai_chat').show();
        $('#btn_ai_chat_close').hide();

        // Task Wizard가 닫히면 태스크 비교 버튼 보이기
        $('#btn_diff').show();

        // 이벤트 리스너 제거
        $(document).off('keydown.aiChat');

        // Grid 크기 조정 및 refresh (transition 완료 후 실행)
        setTimeout(function() {
            // 모든 그리드 resize
            try {
                $('#target_grid').alopexGrid('updateOption', { width: "parent" });
                $('#schedule_grid').alopexGrid('updateOption', { width: "parent" });
                $('#runnable_time_grid').alopexGrid('updateOption', { width: "parent" });
                $('#trigger_grid').alopexGrid('updateOption', { width: "parent" });
                $('#permission_grid').alopexGrid('updateOption', { width: "parent" });
                $('#notilist_grid').alopexGrid('updateOption', { width: "parent" });

                // window resize 이벤트 트리거하여 grid 자동 resize
                $(window).trigger('resize');
            } catch (error) {
                console.error('Grid resize 오류:', error);
            }

        }, 350); // CSS transition 0.3s + 여유시간

    }
}

function updateSendButton() {
    var input = $('#chat_input').val().trim();
    var isSending = $('#btn_send_message').hasClass('sending');
    $('#btn_send_message').prop('disabled', input.length === 0 || isSending);
}

async function sendMessage() {
    var message = $('#chat_input').val().trim();
    if (message.length === 0) return;

    ensureExistingTaskWorkflowDefaults();

    if (isAwaitingTaskRegisterConfirm) {
        addUserMessage(message);
        $('#chat_input').val('');
        updateSendButton();
        handleRegisterTaskConfirmation(message);
        return;
    }

    if (isAwaitingTargetInfo) {
        addUserMessage(message);
        $('#chat_input').val('');
        updateSendButton();
        handleTargetInfoInput(message);
        return;
    }

    // 현재 선택된 모드 확인
    var activeMode = $('.mode-btn.active').data('mode');
    if (activeMode) {
        chatMode = activeMode;
    }
    console.log('sendMessage - chatMode:', chatMode);

    if (isExistingTaskContext && chatMode === 'agent' && !isAgentMessageAllowed(message)) {
        notifyAgentRestriction();
        updateSendButton();
        $('#chat_input').focus();
        return;
    }

    // 전송 버튼 상태 변경
    $('#btn_send_message').addClass('sending').prop('disabled', true);

    // 사용자 메시지 추가
    addUserMessage(message);

    // 입력창 초기화
    $('#chat_input').val('');
    updateSendButton();

    // 워크플로우 상태 인디케이터 추가
    var workflowId = addWorkflowStatus();
    workflowStatusId = workflowId;

    try {
        // AI 응답 요청 (스트리밍 방식)
        var aiResponse = await generateAiResponse(message);

        // 스트리밍 메시지 완료 처리
        finalizeStreamingMessage();

        // 스트리밍 응답이 없는 경우에만 새 메시지 추가
        if (!aiResponse || aiResponse.trim() === '') {
            addAiMessage(getWorkflowSystemMessage('ai_response_generation_error') ||
                '죄송합니다. 응답을 생성하는 중 문제가 발생했습니다. 다시 시도해주세요.');
        }

        taskact = '';
    } catch (error) {
        console.error('Chat error:', error);

        // 상태 인디케이터 제거
        if (workflowId) {
            removeWorkflowStatus();
        }

        // 스트리밍 메시지 정리
        finalizeStreamingMessage();

        // 진행률 인디케이터 제거
        removeProgressIndicator();

        // 오류 메시지 표시 (재시도 버튼 포함)
        var errorMessage = getWorkflowSystemMessage('network_error_guidance', {
            error_detail: error.message
        }) || (`죄송합니다. 서버 연결에 문제가 발생했습니다: ${error.message}

**해결 방법:**
- 잠시 후 다시 시도해주세요
- 네트워크 연결을 확인해주세요
- 문제가 지속되면 관리자에게 문의해주세요`);

        addAiMessage(errorMessage);
        addRetryButton(message);
        taskact = '';
    } finally {
        // 전송 버튼 상태 복원
        $('#btn_send_message').removeClass('sending').prop('disabled', false);
        updateSendButton();
    }
}

function addUserMessage(message) {
    var timestamp = getCurrentTime();
    var messageHtml = `
        <div class="user-message">
            <div class="message-content">${escapeHtml(message)}</div>
            <div class="message-time">${timestamp}</div>
        </div>
    `;

    $('#chat_messages').append(messageHtml);
    scrollChatToBottom();

    // 채팅 기록 저장
    chatHistory.push({
        type: 'user',
        message: message,
        timestamp: timestamp
    });
}

function addAiMessage(message) {
    var timestamp = getCurrentTime();

    if (isExistingTaskContext && typeof message === 'string') {
        var nextStepIndex = message.indexOf('## 🚀 다음 단계 선택');
        if (nextStepIndex !== -1) {
            message = message.substring(0, nextStepIndex).trimEnd();
        }
    }

    // AI 응답에서 코드 블록을 파싱하고 CodeMirror에 적용 시도
    try {
       // parseAndApplyCodeBlock(message);
    } catch (e) {
        console.warn('코드 블록 파싱 중 오류 (무시함):', e);
    }

    // Markdown을 HTML로 변환
    var htmlContent = '';
    try {
        // marked 라이브러리가 로드되어 있는지 확인
        if (typeof marked !== 'undefined') {
            // marked 옵션 설정 (일관성 있게 동일한 옵션 사용)
            marked.setOptions({
                breaks: true,        // 줄바꿈을 <br>로 변환
                gfm: true,          // GitHub Flavored Markdown 사용
                sanitize: false,    // HTML 태그 허용
                smartLists: true,   // 스마트 리스트 처리
                smartypants: false, // 스마트 따옴표 비활성화
                headerIds: false,   // 헤더 ID 생성 비활성화
                mangle: false       // 이메일 주소 난독화 비활성화
            });
            htmlContent = marked.parse(message);
        } else {
            // marked가 로드되지 않은 경우 기본 HTML 이스케이프 처리
            htmlContent = escapeHtml(message).replace(/\n/g, '<br>');
        }
    } catch (e) {
        console.error('Markdown parsing error in addAiMessage:', e);
        // 오류 발생 시 기본 HTML 이스케이프 처리
        htmlContent = escapeHtml(message).replace(/\n/g, '<br>');
    }

    var messageHtml = `
        <div class="ai-message">
            <div class="message-content">${htmlContent}</div>
            <div class="message-time">${timestamp}</div>
        </div>
    `;

    $('#chat_messages').append(messageHtml);

    // URL 링크에 클릭 이벤트 추가
    attachUrlClickHandlers();

    // 코드 블록에 복사 버튼 추가
    addCopyButtonsToCodeBlocks();

    scrollChatToBottom();

    // 채팅 기록 저장 (원본 마크다운 텍스트로 저장)
    chatHistory.push({
        type: 'ai',
        message: message,
        timestamp: timestamp
    });
}

// URL 링크에 클릭 이벤트 핸들러 추가
function attachUrlClickHandlers() {
    // 마지막으로 추가된 메시지의 링크들만 처리
    $('#chat_messages .ai-message:last .message-content a').each(function() {
        var $link = $(this);
        var href = $link.attr('href');

        // 이미 이벤트가 추가되었으면 건너뛰기
        if ($link.data('event-attached')) {
            return;
        }

        // href가 있는 경우 처리
        if (href) {
            $link.on('click', function(e) {
                e.preventDefault();

                var finalUrl = "/"+href+"/";

                // 프로토콜이 없는 localhost URL 처리
                if (href.startsWith('localhost:') || href.startsWith('localhost/')) {
                    finalUrl = 'http://' + href;
                }

                console.log('URL 링크 클릭:', finalUrl);

                // file:// URL인 경우 로컬 파일이므로 알림
                if (finalUrl.startsWith('file://')) {
                    alert('로컬 파일 경로입니다:\n' + finalUrl.replace('file://', ''));
                    //return;
                }

                // opme_popupHelp 함수 호출 (도움말 팝업)
                if (typeof opme_popupHelp === 'function') {
                    opme_popupHelp(finalUrl);
                } else {
                    // opme_popupHelp 함수가 없으면 새 창으로 열기
                    window.open(finalUrl, '_blank', 'width=1450,height=800,scrollbars=yes,resizable=yes');
                }
            });

            // 이벤트 추가 표시
            $link.data('event-attached', true);
        }
    });
}

// 특정 메시지의 URL 링크에 클릭 이벤트 핸들러 추가
function attachUrlClickHandlersForMessage(messageId) {
    // 특정 메시지의 링크들만 처리
    $('#' + messageId + ' .message-content a').each(function() {
        var $link = $(this);
        var href = $link.attr('href');

        // 이미 이벤트가 추가되었으면 이전 이벤트 제거 후 재등록
        $link.off('click');

        // href가 있는 경우 처리
        if (href) {
            $link.on('click', function(e) {
                e.preventDefault();

                var finalUrl = "/"+href+"/";

                // 프로토콜이 없는 localhost URL 처리
                if (href.startsWith('localhost:') || href.startsWith('localhost/')) {
                    finalUrl = 'http://' + href;
                }

                console.log('URL 링크 클릭:', finalUrl);

                // file:// URL인 경우 로컬 파일이므로 알림
                if (finalUrl.startsWith('file://')) {
                    alert('로컬 파일 경로입니다:\n' + finalUrl.replace('file://', ''));
                    //return;
                }

                // opme_popupHelp 함수 호출 (도움말 팝업)
                if (typeof opme_popupHelp === 'function') {
                    opme_popupHelp(finalUrl);
                } else {
                    // opme_popupHelp 함수가 없으면 새 창으로 열기
                    window.open(finalUrl, '_blank', 'width=1450,height=800,scrollbars=yes,resizable=yes');
                }
            });

            // 이벤트 추가 표시
            $link.data('event-attached', true);
        }
    });
}

// AI 응답 생성 함수 (비동기 스트리밍)
async function generateAiResponse(userMessage) {
    try {
        // 진행률 인디케이터 표시
        addProgressIndicator();

        // 비동기 스트리밍 방식 시도
        console.log('Using async streaming for AI response');
        const streamingResult = await generateStreamingAiResponse(userMessage);

        console.log('taskact:', taskact);
        console.log('g_task_id:', g_task_id);

        // 성공 시 진행률 인디케이터 제거
        removeProgressIndicator();
        return streamingResult;

    } catch (error) {
        console.error('Streaming failed, falling back to legacy AJAX method:', error);

        // 스트리밍 실패 시 기존 AJAX 방식 사용
        try {
            const legacyResult = await generateLegacyAiResponse(userMessage);

            // 성공 시 진행률 인디케이터 제거
            removeProgressIndicator();
            return legacyResult;
        } catch (legacyError) {
            console.error('All methods failed:', legacyError);
            throw legacyError;
        }
    }
}

// 비동기 스트리밍 AI 응답 생성 함수
async function generateStreamingAiResponse(userMessage) {
    return new Promise(async (resolve, reject) => {
        const sessionId = generateSessionId();
        const url = '/task/chat/stream';

        // 스크립트 내용 안전하게 가져오기
        let scriptContent = '';
        try {
            if (typeof g_editor !== 'undefined' && g_editor && typeof g_editor.getValue === 'function') {
                scriptContent = btoa(unescape(encodeURIComponent(g_editor.getValue())));
                console.log('Script content retrieved and encoded:', scriptContent.substring(0, 50) + '...');
            } else {
                console.warn('g_editor is not available or getValue function is not accessible');
            }
        } catch (e) {
            console.warn('스크립트 내용을 가져오는 중 오류 발생:', e);
            scriptContent = '';
        }

        // 세션 데이터 가져오기 (태스크 생성 워크플로우 상태 유지)
        const sessionData = window.taskWorkflowSession || {};

        // 로컬에 저장된 검색 결과가 있으면 포함
        if (window.currentSearchResults && window.currentSearchResults.length > 0) {
            sessionData.search_results = window.currentSearchResults;
            console.log(`[프론트엔드] 로컬 검색 결과 ${window.currentSearchResults.length}개를 sessionData에 포함`);
        }

        console.log('[프론트엔드] 보낼 sessionData:', sessionData);
        console.log('[프론트엔드] window.taskWorkflowSession:', window.taskWorkflowSession);

        // POST 방식으로 데이터 전송
        const requestData = {
            taskact: taskact,
            message: userMessage,
            session_id: sessionId,
            script_content: scriptContent,
            session_data: sessionData,
            chat_mode: chatMode
        };

        console.log('=== Request data being sent ===');
        console.log('taskact:', taskact);
        console.log('message:', userMessage);
        console.log('session_id:', sessionId);
        console.log('script_content_length:', scriptContent.length);
        console.log('chat_mode:', chatMode);
        console.log('chat_mode type:', typeof chatMode);
        console.log('================================');
        try {
            // fetch API를 사용한 스트리밍 연결
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream',
                    'Cache-Control': 'no-cache'
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let finalContent = '';
            let contentChunks = [];
            let isCompleted = false;
            let buffer = '';
            hasShownRegisterTaskAlert = false;
            let processedEventIds = new Set(); // 중복 실행 방지를 위한 처리된 이벤트 ID 추적

            console.log('Fetch streaming connection opened');

            // 스트리밍 데이터 읽기
            const processStream = async () => {
                try {
                    while (true) {
                        const { done, value } = await reader.read();

                        if (done) {
                            console.log('Stream completed');
                            if (!isCompleted) {
                                isCompleted = true;
                                resolve(finalContent);
                            }
                            break;
                        }

                        // 텍스트 디코딩
                        const chunk = decoder.decode(value, { stream: true });
                        buffer += chunk;

                        // SSE 형식 파싱 (data: 로 시작하는 라인들)
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || ''; // 마지막 불완전한 라인은 버퍼에 보관

                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                const dataStr = line.substring(6);
                                if (dataStr.trim() === '') continue;

                                try {
                                    const data = JSON.parse(dataStr);
                                    console.log('Stream received:', data);

                                    // 중복 실행 방지: 같은 이벤트 ID가 이미 처리되었는지 확인
                                    if (data.event_id) {
                                        if (processedEventIds.has(data.event_id)) {
                                            console.log('이미 처리된 이벤트 ID:', data.event_id, '- 건너뜀');
                                            continue;
                                        }
                                        processedEventIds.add(data.event_id);
                                    }

                                    // 기존 EventSource 로직과 동일하게 처리
                                    await handleStreamData(data);

                                } catch (parseError) {
                                    console.error('Error parsing stream data:', parseError, dataStr);
                                }
                            }
                        }
                    }
                } catch (streamError) {
                    console.error('Stream processing error:', streamError);
                    if (!isCompleted) {
                        isCompleted = true;
                        reject(new Error('스트리밍 처리 중 오류가 발생했습니다: ' + streamError.message));
                    }
                }
            };

            // 스트리밍 데이터 처리 함수
            const handleStreamData = async (data) => {
                switch(data.type) {
                    case 'connected':
                        console.log('Stream connected with session:', data.session_id);
                        break;

                    case 'workflow_start':
                        updateWorkflowStatus(data.step, data.message);
                        break;

                    case 'workflow_progress':
                        console.log("workflowStatusId::", workflowStatusId);
                        console.log("data.step::", data.step);
                        console.log("data.message::", data.message);
                        updateWorkflowStatus(data.step, data.message);
                        break;

                    case 'content_chunk':
                        contentChunks.push(data.content);
                        finalContent += data.content;
                        updateStreamingMessage(finalContent);

                        // 세션 데이터 업데이트 (태스크 생성 워크플로우 상태 유지)
                        if (data.session_data) {
                            console.log('[프론트엔드] 받은 session_data:', JSON.stringify(data.session_data, null, 2));
                            console.log('[프론트엔드] 받은 session_data의 keys:', Object.keys(data.session_data));
                            window.taskWorkflowSession = data.session_data;
                            console.log('[프론트엔드] 업데이트된 window.taskWorkflowSession:', window.taskWorkflowSession);
                        }
                        break;

                    case 'search_results_ready':
                        console.log("[프론트엔드] search_results_ready 이벤트 수신:", data);

                        // 검색 결과를 로컬 변수에 저장
                        if (data.nodes && data.nodes.length > 0) {
                            window.currentSearchResults = data.nodes;
                            console.log(`[프론트엔드] 검색 결과 ${data.nodes.length}개를 로컬에 저장`);
                        }

                        // 검색 파라미터를 로컬 변수에 저장
                        if (data.search_params) {
                            window.currentSearchParams = data.search_params;
                            console.log(`[프론트엔드] 검색 파라미터 저장:`, data.search_params);
                        }
                        break;

                    case 'register_task':
                        if (isAwaitingTaskRegisterConfirm) {
                            console.warn('register_task 이벤트가 중복으로 수신되어 무시합니다.');
                            break;
                        }

                        console.log("register_task 이벤트 수신 - 전체 데이터:", data);
                        console.log("register_task 이벤트 수신 - JSON:", JSON.stringify(data, null, 2));

                        var registerScheduleGuide = getScheduleGuideContent(window.taskWorkflowSession && window.taskWorkflowSession.task_name);
                        pendingSchedulePromptMessage = getWorkflowSystemMessage(
                            'task_registration_completed_with_schedule',
                            { schedule_guide: registerScheduleGuide || '' }
                        ) || ('태스크 등록이 완료되었습니다! ✅\n\n' + (registerScheduleGuide || ''));

                        pendingRegisterTaskData = data;
                        isAwaitingTaskRegisterConfirm = true;
                        hasShownRegisterTaskAlert = false;
                        console.log("register_task: 사용자 확인 대기");
                        showRegisterTaskConfirmationMessage();
                        break;

                    case 'register_task_confirmed':
                        console.log("register_task_confirmed 이벤트 수신 - 태스크와 노드를 함께 등록");
                        console.log("register_task_confirmed 이벤트 수신 - 전체 데이터:", data);

                        // 확인 메시지 없이 바로 태스크 등록 수행
                        // 태스크와 노드를 함께 등록했음을 표시하는 플래그 설정
                        isTaskWithNodesRegistration = true;  // 전역 플래그 설정
                        console.log("[register_task_confirmed] isTaskWithNodesRegistration 플래그 설정됨:", isTaskWithNodesRegistration);

                        if (data) {
                            performTaskRegistration(data);
                        } else {
                            console.error("register_task_confirmed: 데이터가 없습니다.");
                        }
                        break;

                    case 'schedule_info_ready':
                        console.log("===== schedule_info_ready 이벤트 수신 =====");
                        console.log("전체 데이터:", data);
                        console.log("data keys:", Object.keys(data));

                        try {
                            const scheduleInfo = data.schedule_info || {};
                            console.log("schedule_info:", scheduleInfo);
                            console.log("schedule_info type:", typeof scheduleInfo);
                            console.log("schedule_info keys:", Object.keys(scheduleInfo));

                            const mode = scheduleInfo.mode || '';
                            const timePoint = scheduleInfo.timePoint || '';
                            const timeZone = scheduleInfo.timeZone || '+09:00';

                            console.log("===== schedule_info_ready 이벤트 처리 시작 =====");
                            console.log("스케줄 모드:", mode);
                            console.log("시간:", timePoint);
                            console.log("타임존:", timeZone);

                            // 스케줄 정보를 팝업 형식으로 변환
                            const scheduleData = {
                                mode: mode,
                                timePoint: timePoint,
                                timeZone: timeZone
                            };

                            console.log("스케줄 그리드에 추가할 데이터:", scheduleData);

                            // 스케줄 정보 유효성 검사
                            if (!mode || !timePoint) {
                                console.error("스케줄 정보가 완전하지 않습니다. mode:", mode, "timePoint:", timePoint);
                                alert('스케줄 정보가 완전하지 않습니다. 다시 시도해주세요.');
                                break;
                            }

                            // 스케줄 그리드에 추가 (중복 체크는 내부에서 처리)
                            if (typeof $('#schedule_grid').alopexGrid === 'function') {
                                const existingSchedule = $('#schedule_grid').alopexGrid('dataGet', {
                                    'timePoint': timePoint,
                                    'timeZone': timeZone
                                });

                                console.log("기존 스케줄 확인:", existingSchedule);

                                if ($.isEmptyObject(existingSchedule)) {
                                    // Grid에 없으면 추가
                                    console.log("스케줄 그리드에 추가 시도...");
                                    $("#schedule_grid").alopexGrid('dataAdd', scheduleData);
                                    console.log("✅ 스케줄 정보가 그리드에 추가되었습니다.");

                                    // Grid 데이터가 증가하면, height를 고정시키고, Scroll 처리
                                    let pageInfo = $('#schedule_grid').alopexGrid('pageInfo');
                                    console.log("스케줄 그리드 데이터 개수:", pageInfo['dataLength']);
                                    if (pageInfo['dataLength'] > 10) {
                                        $("#schedule_grid").alopexGrid('updateOption', {height: '500px'});
                                    }

                                    // Grid 편집 모드 종료
                                    $("#schedule_grid").alopexGrid('endEdit');
                                    console.log("✅ schedule_grid endEdit 완료");
                                } else {
                                    // Grid에 있으면 복원 (삭제된 경우, 복원됨)
                                    console.log("스케줄 그리드에서 복원 시도...");
                                    $('#schedule_grid').alopexGrid('dataUndelete', scheduleData);
                                    console.log("✅ 스케줄 정보가 그리드에서 복원되었습니다.");

                                    // Grid 편집 모드 종료
                                    $("#schedule_grid").alopexGrid('endEdit');
                                    console.log("✅ schedule_grid endEdit 완료");
                                }
                            } else {
                                console.error("❌ schedule_grid를 찾을 수 없습니다.");
                                alert('스케줄 그리드를 찾을 수 없습니다.');
                            }

                        } catch (error) {
                            console.error("schedule_info_ready 처리 오류:", error);
                            alert('스케줄 정보 처리 중 오류가 발생했습니다: ' + error.message);
                        }
                        break;

                    case 'save_task':
                        console.log("===== save_task 이벤트 수신 =====");
                        console.log("태스크 저장 요청 수신");

                        try {
                            // task_dtl.js 526라인 참조: 저장 버튼 로직 실행
                            // Grid 편집 모드 종료
                            $('#target_grid').alopexGrid('endEdit');
                            $('#trigger_grid').alopexGrid('endEdit');
                            $('#notilist_grid').alopexGrid('endEdit');

                            // Grid 편집 모드 다시 시작
                            $('#target_grid').alopexGrid('startEdit');
                            $('#trigger_grid').alopexGrid('startEdit');
                            $('#notilist_grid').alopexGrid('startEdit');

                            console.log("is_change 값:", is_change);
                            console.log("g_task_id 값:", g_task_id);

                            // Task Wizard에서 생성한 태스크는 항상 변경사항이 있는 것으로 처리
                            // (is_change 플래그가 false일 수 있지만, 실제로는 저장해야 할 데이터가 있음)

                            // 유효성 검사 (선택적)
                            // Task Wizard로 생성한 태스크는 기본 필드만 검사
                            console.log("유효성 검사 시작...");

                            // 필수 필드만 간단히 체크
                            let taskId = $("#id").val();
                            let scriptName = $('#script_name').val();

                            console.log("taskId:", taskId);
                            console.log("scriptName:", scriptName);

                            if (!taskId || taskId.trim() === '') {
                                addAiMessage(getWorkflowSystemMessage('task_id_required') ||
                                    '❌ 태스크 ID를 입력해주세요.');
                                console.error("유효성 검사 실패: 태스크 ID 없음");
                                break;
                            }

                            if (!scriptName || scriptName.trim() === '') {
                                addAiMessage(getWorkflowSystemMessage('script_name_required') ||
                                    '❌ 스크립트 파일명을 입력해주세요.');
                                console.error("유효성 검사 실패: 스크립트 파일명 없음");
                                break;
                            }

                            console.log("✅ 기본 유효성 검사 통과");

                            // 태스크 저장 실행 (페이지 리로드 없이)
                            console.log("✅ 유효성 검사 통과 - 태스크 저장 시작");

                            // saveData() 함수 내용을 직접 실행하되, 페이지 리로드는 하지 않음
                            let base_info = {
                                task_id     : $("#id").val(),
                                owner_id    : $("#owner_id").val(),
                                publish_id  : $("#publish_id").val(),
                                description : $("#description").val(),
                                cutoffperiod: $("#cutoffperiod").val(),
                            };

                            let script_info = {
                                script_name   : $('#script_name').val(),
                                script_account: $('#script_account').val(),
                                script_description : $("#script_description").val(),
                                script_content: btoa(unescape(encodeURIComponent(g_editor.getValue()))),
                                script_encode : $('#script_encoding').val(),
                            };

                            let target_list = AlopexGrid.trimData($('#target_grid').alopexGrid('dataGet', {_state: {deleted: false}}));
                            for (let i=0; i < target_list.length; i++) {
                                if (target_list[i]['tag'] == null || target_list[i]['tag'] == "") {
                                    continue;
                                }
                                target_list[i]['tag'] = opme_strToDict(target_list[i]['tag']);
                            }

                            let schedule_list = $('#schedule_grid').alopexGrid('dataGet', {_state: {deleted: false}}).map(function(o) {
                                return { 'timePoint': o.timePoint, 'timeZone': o.timeZone };
                            });

                            let runnable_time_list = $('#runnable_time_grid').alopexGrid('dataGet', {_state: {deleted: false}}).map(function(o) {
                                return { 'timeRange': o.start + ' ~ ' + o.range, 'timeZone': o.timeZone };
                            });

                            let trigger_list = AlopexGrid.trimData($('#trigger_grid').alopexGrid('dataGet', {_state: {deleted: false}}));

                            let permission_list = $('#permission_grid').alopexGrid('dataGet', {_state: {deleted: false}}).map(function(o) {
                                return { 'entityType': o.entityType, 'entityId': o.entityId, 'mode': o.read + o.write + o.execute };
                            });

                            let notilist_list = AlopexGrid.trimData($('#notilist_grid').alopexGrid('dataGet', {_state: {deleted: false}}));

                            let saveRequestData = {
                                id                : g_task_id,
                                base_info         : base_info,
                                script_info       : script_info,
                                target_list       : target_list,
                                schedule_list     : schedule_list,
                                runnable_time_list: runnable_time_list,
                                trigger_list      : trigger_list,
                                permission_list   : permission_list,
                                notilist_list     : notilist_list,
                            };

                            console.log("저장 요청 데이터:", saveRequestData);
                            console.log("AJAX 요청 시작...");

                            $.ajax({
                                url        : "/task/save",
                                type       : "POST",
                                dataType   : "json",
                                data       : JSON.stringify(saveRequestData),
                                contentType: "application/json",
                                sse_enable : "no",  // BlockUI 로딩 메시지 표시 안함
                                beforeSend : function() {
                                    console.log("AJAX beforeSend - 요청 전송 중...");
                                },
                                success    : function(result) {
                                    console.log("✅ 태스크 저장 AJAX 성공:", result);
                                    if (result["resultCode"] == "EM0000") {
                                        // 태스크 ID 업데이트 (저장 응답에서 받은 ID 사용)
                                        if (result["id"]) {
                                            g_task_id = result["id"];
                                            console.log("g_task_id 업데이트됨 (응답 id 필드):", g_task_id);
                                            syncExistingTaskContext();
                                        } else if (result["resultMsg"]) {
                                            // resultMsg에서 태스크 ID 파싱 (예: "Task1_GeneratedB has been created successfully.")
                                            const match = result["resultMsg"].match(/^(\S+)\s+has been created successfully/);
                                            if (match && match[1]) {
                                                g_task_id = match[1];
                                                console.log("g_task_id 업데이트됨 (resultMsg 파싱):", g_task_id);
                                                syncExistingTaskContext();
                                            }
                                        }

                                        var saveSuccessMessage = getWorkflowSystemMessage('task_save_success', {
                                            result_detail: result["resultMsg"] || ''
                                        }) || ('✅ 태스크가 성공적으로 저장되었습니다!\n\n저장된 태스크 정보: ' + (result["resultMsg"] || ''));
                                        addAiMessage(saveSuccessMessage);
                                        is_change = false; // 변경사항 플래그 초기화

                                        // 저장 성공 후 발행 자동 실행 (task_dtl.js 563라인 참조)
                                        console.log("📤 태스크 발행 시작...");
                                        console.log("g_task_id 값:", g_task_id);
                                        console.log("tcs_verify_enable 값:", tcs_verify_enable, "타입:", typeof tcs_verify_enable);

                                        // g_task_id가 없으면 발행 불가
                                        if (!g_task_id || g_task_id === '') {
                                            console.error("❌ g_task_id가 설정되지 않음");
                                            addAiMessage(getWorkflowSystemMessage('task_publish_missing_id') ||
                                                '❌ 태스크 ID가 설정되지 않아 발행할 수 없습니다.\n\n저장 응답을 확인하고 다시 시도해주세요.');
                                            return;
                                        }

                                        addAiMessage(getWorkflowSystemMessage('task_publish_started') ||
                                            '📤 태스크 발행을 시작합니다...');

                                        // TCS OTP 확인이 필요한지 체크
                                        if (tcs_verify_enable === 'yes') {
                                            console.log("TCS OTP 인증 필요");
                                            addAiMessage(getWorkflowSystemMessage('task_publish_requires_otp') ||
                                                '🔐 TCS OTP 인증이 필요합니다. OTP 팝업을 확인해주세요.');
                                            // AI 채팅창을 통한 발행임을 표시
                                            window.isAiChatPublish = true;
                                            popupTcsOtp();
                                        } else {
                                            console.log("TCS OTP 인증 불필요 - 직접 발행 진행");
                                            // AI 채팅창을 통한 발행임을 표시
                                            window.isAiChatPublish = true;
                                            // 발행 함수 직접 호출
                                            publishTask().done(function(publishResult) {
                                                console.log("✅ 태스크 발행 완료:", publishResult);
                                                if (publishResult["resultCode"] == "EM0000") {
                                                    addAiMessage(
                                                        getWorkflowSystemMessage('task_publish_success', {
                                                            result_detail: publishResult["resultMsg"] || ''
                                                        }) || ('✅ 태스크가 성공적으로 발행되었습니다!\n\n' + (publishResult["resultMsg"] || ''))
                                                    );

                                                    // 태스크 저장 및 발행 완료 후 세션 데이터 초기화 및 환영 메시지 표시
                                                    console.log("🔄 세션 데이터 초기화 시작...");

                                                    // 세션 데이터 초기화 API 호출
                                                    $.ajax({
                                                        url: "/task/ai_chat",
                                                        type: "POST",
                                                        dataType: "json",
                                                        data: JSON.stringify({
                                                            message: "__CLEAR_SESSION__",
                                                            chat_mode: chatMode,
                                                            task_id: g_task_id
                                                        }),
                                                        contentType: "application/json",
                                                        sse_enable: "no",  // BlockUI 로딩 메시지 표시 안함
                                                        success: function(result) {
                                                            console.log("✅ 세션 초기화 완료:", result);

                                                            syncExistingTaskContext();

                                                            // 채팅 기록 초기화 (환영 메시지만 남기고)
                                                            clearChatHistory();

                                                            // 환영 메시지 다시 표시
                                                            initWelcomeMessage();

                                                            addAiMessage(getWorkflowSystemMessage('task_followup_after_publish') ||
                                                                '🎉 모든 작업이 완료되었습니다!\n\n생성된 태스크에서 **스크립트 수정** 또는 **스크립트 리뷰**를 이어서 진행해 주세요.\n\n\'스크립트 수정\' 혹은 \'스크립트 리뷰\'라고 입력하면 다음 단계를 안내해 드릴게요.');

                                                            console.log("✅ 화면 초기화 완료");
                                                        },
                                                        error: function(xhr, status, error) {
                                                            console.error("⚠️ 세션 초기화 실패 (계속 진행):", error);
                                                            // 실패해도 환영 메시지는 표시
                                                            syncExistingTaskContext();
                                                            clearChatHistory();
                                                            initWelcomeMessage();
                                                            addAiMessage(getWorkflowSystemMessage('task_followup_after_publish') ||
                                                                '🎉 모든 작업이 완료되었습니다!\n\n생성된 태스크에서 **스크립트 수정** 또는 **스크립트 리뷰**를 이어서 진행해 주세요.\n\n\'스크립트 수정\' 혹은 \'스크립트 리뷰\'라고 입력하면 다음 단계를 안내해 드릴게요.');
                                                        }
                                                    });
                                                } else {
                                                    addAiMessage(getWorkflowSystemMessage('task_publish_failure', {
                                                        result_detail: publishResult["resultMsg"] || ''
                                                    }) || ('⚠️ 태스크 발행 실패: ' + (publishResult["resultMsg"] || '')));
                                                }
                                                // 플래그 초기화는 publishTask 내부에서 처리됨
                                            }).fail(function(xhr, status, error) {
                                                console.error("❌ 태스크 발행 AJAX 실패:", xhr, status, error);
                                                addAiMessage(getWorkflowSystemMessage('task_publish_error', {
                                                    error_detail: xhr.responseText || error
                                                }) || ('❌ 태스크 발행 중 오류가 발생했습니다.\n\n오류: ' + (xhr.responseText || error)));
                                                window.isAiChatPublish = false;
                                            });
                                        }
                                    } else {
                                        addAiMessage(getWorkflowSystemMessage('task_save_warning', {
                                            result_detail: result["resultMsg"] || ''
                                        }) || ('⚠️ 태스크 저장: ' + (result["resultMsg"] || '')));
                                    }
                                },
                                error: function(xhr, status, error) {
                                    console.error("❌ 태스크 저장 AJAX 실패");
                                    console.error("xhr:", xhr);
                                    console.error("status:", status);
                                    console.error("error:", error);
                                    console.error("responseText:", xhr.responseText);
                                    addAiMessage(getWorkflowSystemMessage('task_save_error', {
                                        error_detail: xhr.responseText || error
                                    }) || ('❌ 태스크 저장 중 오류가 발생했습니다.\n\n오류: ' + (xhr.responseText || error)));
                                }
                            });

                            console.log("AJAX 호출 완료 (비동기)");
                            addAiMessage(getWorkflowSystemMessage('task_save_request_sent') ||
                                '💾 태스크 저장 요청을 전송했습니다...');

                        } catch (error) {
                            console.error("save_task 처리 오류:", error);
                            addAiMessage(getWorkflowSystemMessage('task_save_processing_error', {
                                error_detail: error.message
                            }) || ('❌ 태스크 저장 처리 중 오류가 발생했습니다: ' + error.message));
                        }
                        break;

                    case 'add_nodes':
                        console.log("add_nodes 이벤트 수신:", data);
                        console.log("isTaskWithNodesRegistration 플래그:", isTaskWithNodesRegistration);

                        try {
                            // 백엔드에서 search_params를 노드로 변환한 데이터 사용
                            const nodes = data.nodes || [];

                            console.log(`[프론트엔드] 받은 노드 개수: ${nodes.length}`);
                            if (nodes.length > 0) {
                                console.log(`[프론트엔드] 첫 번째 노드 샘플:`, nodes[0]);
                                console.log(`[프론트엔드] 노드 필드명:`, Object.keys(nodes[0]));
                            }

                            if (nodes.length === 0) {
                                console.log("추가할 노드가 없습니다.");
                                break;
                            }

                            // 중복 실행 방지: 노드 데이터를 기반으로 체크
                            const nodesKey = nodes.map(n => n.hostname || n.hostnames || '').join(',');
                            if (window.lastAddNodesKey === nodesKey) {
                                console.log('중복된 add_nodes 이벤트 감지 (같은 노드들) - 건너뜀');
                                break;
                            }
                            window.lastAddNodesKey = nodesKey;

                            // 검색 파라미터를 로컬 변수에 저장
                            if (data.search_params) {
                                window.currentSearchParams = data.search_params;
                                console.log(`[프론트엔드] 노드 추가 시 검색 파라미터 저장:`, data.search_params);
                            }

                            console.log(`추가할 노드 개수: ${nodes.length}`);

                            // 각 노드를 실행 대상 그리드에 추가
                            let addedCount = 0;
                            let skippedCount = 0;

                            for (const node of nodes) {
                                // 노드 정보를 target_grid에 추가할 형식으로 변환
                                // 백엔드에서 hostname으로 전달되므로 hostname으로 매핑
                                const nodeSetInfo = {
                                    hostname: node.hostname || node.hostnames || '',
                                    osType: node.osType || '',
                                    osName: node.osName || '',
                                    osVersion: node.osVersion || '',
                                    tag: node.tag || '',
                                    account: node.account || '',
                                    description: node.description || ''
                                };

                                console.log(`[프론트엔드] 노드 매핑 결과:`, nodeSetInfo);

                                // addTargetGrid 함수를 사용하여 노드 추가
                                if (typeof addTargetGrid === 'function') {
                                    const result = addTargetGrid(nodeSetInfo);
                                    if (result) {
                                        addedCount++;
                                    } else {
                                        skippedCount++;
                                    }
                                } else {
                                    console.error("addTargetGrid 함수를 ��을 수 없습니다.");
                                }
                            }

                            // Grid 편집 모드 시작
                            if (typeof $("#target_grid") !== 'undefined' && typeof addedCount !== 'undefined') {
                                $("#target_grid").alopexGrid('startEdit');

                                // Grid 데이터가 증가하면, height 를 고정시키고, Scroll 처리.
                                let pageInfo = $('#target_grid').alopexGrid('pageInfo');
                                if (pageInfo['dataLength'] > 10) {
                                    $("#target_grid").alopexGrid('updateOption', {height: '500px'});
                                }

                                // Grid 편집 모드 종료
                                $("#target_grid").alopexGrid('endEdit');
                            }
                            console.log("[add_nodes] 노드 추가 결과 - added:", addedCount, "skipped:", skippedCount);
                            if (isTaskWithNodesRegistration) {
                                // 태스크와 노드 동시 등록 플래그는 백엔드 메시지를 기다린 후 리셋
                                isTaskWithNodesRegistration = false;
                            }

                        } catch (error) {
                            console.error("add_nodes 처리 오류:", error);
                            alert('노드 추가 중 오류가 발생했습니다: ' + error.message);
                        }
                        break;

                    case 'task_created':
                        console.log("task_created::", data);
                        g_ai = true;

                        try {
                            let parsedResponse;

                            if (data.structuredContent) {
                                if (data.structuredContent.result) {
                                    parsedResponse = data.structuredContent.result;
                                } else {
                                    parsedResponse = data.structuredContent;
                                }
                            } else if (typeof data.content === 'object' && data.content !== null) {
                                parsedResponse = data.content;
                            } else if (typeof data.content === 'string') {
                                if (data.content.trim().startsWith('{') || data.content.trim().startsWith('[')) {
                                    try {
                                        parsedResponse = JSON.parse(data.content);
                                    } catch (parseError) {
                                        parsedResponse = {
                                            message: '태스크가 생성되었습니다.',
                                            content: data.content
                                        };
                                    }
                                } else {
                                    parsedResponse = {
                                        message: '태스크가 생성되었습니다.',
                                        content: data.content
                                    };
                                }
                            } else {
                                throw new Error('Invalid content type: ' + typeof data.content);
                            }

                            // 전역 response 변수에 할당 (window.response 사용)
                            window.response = parsedResponse;
                            console.log("task_created:response:", window.response);

                            if (window.response && window.response.hasOwnProperty('id') && window.response.id) {
                                g_task_id = window.response.id;
                                syncExistingTaskContext();

                                try {
                                    initData(false);
                                } catch (error) {
                                    console.warn('initData 호출 중 오류:', error);
                                }

                                isCompleted = true;
                                resolve('태스크가 성공적으로 생성되었습니다.');
                                is_change = true;
                            }
                        } catch (error) {
                            console.error("task_created: 응답 처리 오류:", error);
                            reject('태스크 생성 응답 처리 중 오류가 발생했습니다: ' + error.message);
                        }
                        break;

                    case 'schedule_info_ready':
                        console.log("schedule_info_ready 이벤트 수신:", data);

                        try {
                            const scheduleInfo = data.schedule_info || {};

                            console.log("스케줄 정보:", scheduleInfo);

                            // TODO: 스케줄 정보를 프론트엔드에 반영
                            // 현재는 로그만 출력
                            console.log("스케줄 타입:", scheduleInfo.type);
                            console.log("스케줄 설명:", scheduleInfo.description);

                        } catch (error) {
                            console.error("schedule_info_ready 처리 오류:", error);
                        }
                        break;

                    case 'workflow_complete':
                        // Don't update streaming message - content was already sent via content_chunk
                        // Just mark as completed
                        if (data.final_content) {
                            finalContent = data.final_content;
                        }

                        // 세션 데이터 업데이트 (workflow_complete에서도 session_data 받음)
                        if (data.session_data) {
                            console.log('[프론트엔드] workflow_complete에서 받은 session_data:', JSON.stringify(data.session_data, null, 2));
                            console.log('[프론트엔드] workflow_complete에서 받은 session_data의 keys:', Object.keys(data.session_data));
                            window.taskWorkflowSession = data.session_data;
                            console.log('[프론트엔드] 업데이트된 window.taskWorkflowSession:', window.taskWorkflowSession);
                            console.log('[프론트엔드] workflow_step 값:', window.taskWorkflowSession.workflow_step);
                        }

                        // Ask 모드에서 검색이 완료된 경우 플래그 설정
                        if (chatMode === 'ask') {
                            hasSearchedInAskMode = true;
                            console.log('[프론트엔드] Ask 모드에서 검색 완료, hasSearchedInAskMode 설정됨');
                        }

                        // 모드 전환 정보 확인
                        console.log('Workflow complete - chat_mode:', data.chat_mode);
                        console.log('Workflow complete - previous_chat_mode:', data.previous_chat_mode);
                        console.log('Workflow complete - is_mode_changed:', data.is_mode_changed);

                        // 모드가 변경되었고 이전 모드의 상태를 복원할 수 있는 경우
                        if (data.can_restore_previous_mode && data.previous_mode) {
                            console.log('Previous mode can be restored:', data.previous_mode);
                            // 이전 모드로 자동 전환하지 않고, 사용자가 수동으로 전환할 수 있도록 정보만 전달
                            // 필요시 여기서 모드 버튼 상태를 업데이트할 수 있음
                        }

                        // 워크플로우 완료 시 세션 초기화는 하지 않음 (workflow_step이 'done'일 때 태스크 저장을 위해 세션 유지 필요)
                        // 세션 초기화는 실제 태스크 저장 완료 후에만 수행

                        // 스트리밍 메시지 완료 처리 및 코드 블록 복사 버튼 추가
                        console.log('workflow_complete: finalizeStreamingMessage 호출');
                        finalizeStreamingMessage();

                        isCompleted = true;
                        resolve(finalContent);
                        break;

                    case 'error':
                        console.error('Stream error:', data.message);
                        isCompleted = true;
                        reject(new Error(data.message));
                        break;

                    case 'warning':
                        console.warn('Stream warning:', data.message);
                        finalContent = data.content || data.message;
                        break;
                }
            };

            // 스트리밍 시작
            processStream();

            // 타임아웃 설정 (10분)
            setTimeout(() => {
                if (!isCompleted) {
                    reader.cancel();
                    reject(new Error('AI 응답 시간이 초과되었습니다 (10분). 복잡한 요청의 경우 시간이 오래 걸릴 수 있습니다. 잠시 후 다시 시도해주세요.'));
                }
            }, 600000);

        } catch (fetchError) {
            console.error('Fetch streaming error:', fetchError);
            reject(new Error('스트리밍 연결에 오류가 발생했습니다: ' + fetchError.message));
        }
    });
}

// 스트리밍 메시지 업데이트 (기존 메시지를 업데이트하거나 새로 생성)
let streamingMessageId = null;
let streamingMessageContent = null; // 스트리밍 메시지의 최종 내용을 저장

function updateStreamingMessage(content) {
    // 스트리밍 중 완성된 코드 블록이 있으면 CodeMirror에 적용 시도
    try {
        // 코드 블록이 완성되었는지 확인 (```로 시작하고 ```로 끝나는지)
        if (content.includes('```') && content.match(/```[\s\S]*?```/g)) {
            //parseAndApplyCodeBlock(content);
        }
    } catch (e) {
        console.warn('스트리밍 중 코드 블록 파싱 오류 (무시함):', e);
    }

    // 마크다운 처리
    var htmlContent = '';
    try {
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                breaks: true,        // 줄바꿈을 <br>로 변환
                gfm: true,          // GitHub Flavored Markdown 사용
                sanitize: false,    // HTML 태그 허용
                smartLists: true,   // 스마트 리스트 처리
                smartypants: false, // 스마트 따옴표 비활성화
                headerIds: false,   // 헤더 ID 생성 비활성화
                mangle: false       // 이메일 주소 난독화 비활성화
            });
            htmlContent = marked.parse(content);
        } else {
            htmlContent = escapeHtml(content).replace(/\n/g, '<br>');
        }
    } catch (e) {
        htmlContent = escapeHtml(content).replace(/\n/g, '<br>');
    }

    // 최종 내용 저장 (chatHistory에 추가할 때 사용)
    streamingMessageContent = content;

    // 기존 메시지가 있는지 확인
    if (streamingMessageId && $('#' + streamingMessageId).length > 0) {
        // 기존 메시지의 내용만 업데이트
        $('#' + streamingMessageId + ' .message-content').html(htmlContent);

        // 업데이트된 메시지의 URL 링크에 이벤트 핸들러 추가
        attachUrlClickHandlersForMessage(streamingMessageId);
    } else {
        // 새로운 메시지 생성
        var messageId = 'message_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        var timestamp = getCurrentTime();
        streamingMessageId = messageId;

        var messageHtml = `
            <div class="ai-message" id="${messageId}">
                <div class="message-content">${htmlContent}</div>
                <div class="message-time">${timestamp}</div>
            </div>
        `;

        $('#chat_messages').append(messageHtml);

        // 새로 생성된 메시지의 URL 링크에 이벤트 핸들러 추가
        attachUrlClickHandlersForMessage(messageId);
    }

    scrollChatToBottom();
}

function finalizeStreamingMessage() {
    // 스트리밍이 완료되었을 때만 채팅 기록에 추가
    if (streamingMessageContent && streamingMessageId) {
        var timestamp = $('#' + streamingMessageId + ' .message-time').text() || getCurrentTime();

        chatHistory.push({
            type: 'ai',
            message: streamingMessageContent,
            timestamp: timestamp
        });

        // 스트리밍 메시지의 코드 블록에 복사 버튼 추가
        console.log('finalizeStreamingMessage: 코드 블록 복사 버튼 추가 시작');
        $('#' + streamingMessageId + ' .message-content pre').each(function(index) {
            var $pre = $(this);
            console.log('스트리밍 메시지 코드 블록 #' + index + ' 발견');

            // 이미 wrapper로 감싸져 있고 복사 버튼이 있으면 건너뛰기
            var $wrapper = $pre.parent('.code-block-wrapper');
            if ($wrapper.length > 0 && $wrapper.find('.code-copy-btn').length > 0) {
                console.log('이미 복사 버튼이 있음 - 건너뛰기');
                return;
            }

            // 복사 버튼 생성 및 추가
            createCopyButton($pre);
            console.log('복사 버튼 추가 완료');
        });
    }

    // 스트리밍 메시지 관련 변수 초기화
    streamingMessageId = null;
    streamingMessageContent = null;
}

// 기존 AJAX 방식의 AI 응답 생성 (폴백용)
async function generateLegacyAiResponse(userMessage) {
    return new Promise((resolve, reject) => {
        $.ajax({
            url        : "/task/chat/stream",
            type       : "POST",
            async      : true,
            dataType   : "json",
            data       : JSON.stringify({
                'taskact': taskact,
                'message': userMessage,
                'session_id': generateSessionId(),
                'script_content': (() => {
                    try {
                        if (typeof g_editor !== 'undefined' && g_editor && typeof g_editor.getValue === 'function') {
                            return btoa(unescape(encodeURIComponent(g_editor.getValue())));
                        }
                        return '';
                    } catch (e) {
                        console.warn('레거시 AJAX 스크립트 인코딩 오류:', e);
                        return '';
                    }
                })(),
                'chat_mode': chatMode
            }),
            contentType: "application/json",
            timeout    : 300000,  // 5분 타임아웃
            success    : function(result) {
                try {
                    if(taskact != ""){
                        g_ai = true;
                        window.response = result;
                        g_task_id = result['id'];
                        syncExistingTaskContext();

                        // CodeMirror 중복 생성 방지를 위한 안전한 initData 호출
                        try {
                            initData(false);
                        } catch (error) {
                            console.warn('Legacy AJAX initData 호출 중 오류:', error);
                        }

                        resolve('태스크가 성공적으로 생성되었습니다.');
                    } else {
                        if (result && result['messages'] && result['messages'][1] && result['messages'][1]['content']) {
                            resolve(result['messages'][1]['content']);
                        } else {
                            resolve('응답을 받았지만 내용을 파싱할 수 없습니다.');
                        }
                    }
                } catch (error) {
                    console.error('Response parsing error:', error);
                    reject(new Error('응답 처리 중 오류가 발생했습니다.'));
                }
            },
            error: function(xhr, status, error) {
                console.error('AJAX error:', status, error);
                if (status === 'timeout') {
                    reject(new Error('요청 시간이 초과되었습니다 (5분). AI 응답 생성에 시간이 걸릴 수 있습니다. 잠시 후 다시 시도해주세요.'));
                } else if (xhr.status === 500) {
                    reject(new Error('서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'));
                } else if (xhr.status === 404) {
                    reject(new Error('요청한 서비스를 찾을 수 없습니다.'));
                } else if (xhr.status === 0) {
                    reject(new Error('네트워크 연결을 확인해주세요.'));
                } else {
                    reject(new Error(`네트워크 오류가 발생했습니다. (${xhr.status}) 잠시 후 다시 시도해주세요.`));
                }
            }
        });
    });
}

// 유틸리티 함수들
function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function getCurrentUserInfo() {
    return {
        userId: typeof login_id !== 'undefined' ? login_id : 'anonymous',
        timestamp: new Date().toISOString()
    };
}

function getCurrentTaskInfo() {
    return {
        taskId: typeof g_task_id !== 'undefined' ? g_task_id : null,
        scriptContent: $('#script_content').val() || '',
        taskDescription: $('#description').val() || '',
        ownerId: $('#owner_id').val() || ''
    };
}

function clearChatHistory() {
    if (confirm('대화 기록을 모두 삭제하시겠습니까?')) {
        chatHistory = [];

        // 워크플로우 세션 상태 초기화 (서버의 workflow 상태도 초기화)
        window.taskWorkflowSession = {};
        console.log('Chat history cleared and workflow session reset');

        var welcomeMessage = getWelcomeMarkdown();
        var htmlContent = '';
        try {
            htmlContent = parseMarkdown(welcomeMessage);
        } catch (e) {
            console.error('Markdown parsing error in clearChatHistory:', e);
            htmlContent = escapeHtml(welcomeMessage).replace(/\n/g, '<br>');
        }

        $('#chat_messages').html(`
            <div class="welcome-message">
                <div class="ai-message">
                    <div class="message-content">${htmlContent}</div>
                    <div class="message-time">${getCurrentTime()}</div>
                </div>
            </div>
        `);

        // 환영 메시지의 코드 블록에 복사 버튼 추가
        addCopyButtonsToWelcomeMessage();
        ensureExistingTaskWorkflowDefaults();
    }
}

function scrollChatToBottom() {
    var chatMessages = $('#chat_messages')[0];
    if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// Ask 모드에서 Agent 모드로 전환 시 가이드 메시지 표시
function showAgentModeGuide() {
    console.log('[showAgentModeGuide] Agent 모드로 전환됨');
    console.log('[showAgentModeGuide] taskWorkflowSession:', window.taskWorkflowSession);

    if (isExistingTaskContext) {
        addAiMessage(getWorkflowSystemMessage('existing_task_agent_mode_guide') ||
            `현재 선택한 태스크에서는 Agent 모드로 **스크립트 수정** 또는 **스크립트 리뷰**만 요청할 수 있습니다.\n\n` +
            `**예시 문장**\n` +
            `- "스크립트를 수정해줘"\n` +
            `- "스크립트 리뷰 부탁해"\n` +
            `- "스크립트 분석해줘"`);
        return;
    }

    // 워크플로우 세션 상태 확인
    var session = window.taskWorkflowSession || {};
    var workflowStep = session.workflow_step || '';
    var taskName = session.task_name || '';
    var osType = session.os_type || '';
    var scriptContent = session.script_content || '';

    console.log('[showAgentModeGuide] workflow_step:', workflowStep);
    console.log('[showAgentModeGuide] task_name:', taskName);

    var context = {
        task_name: taskName || '',
        os_display: osType === 'windows' ? '윈도우 (PowerShell)' : (osType === 'linux' ? '리눅스 (Shell)' : '')
    };
    var normalizedStep = workflowStep || 'ask_name';
    var prefixKey = normalizedStep === 'ask_name'
        ? 'agent_mode_switch_initial'
        : 'agent_mode_switch_resume';
    var prefix = getWorkflowSystemMessage(prefixKey) || (
        normalizedStep === 'ask_name'
            ? '🤖 **Agent 모드로 전환되었습니다**\n\n'
            : '🤖 **Agent 모드로 돌아왔습니다**\n\n'
    );
    var guideBody = getWorkflowSystemMessage(normalizedStep, context);

    if (!guideBody) {
        guideBody = getWorkflowSystemMessage('default_resume', context);
    }

    if (!guideBody) {
        guideBody = '이전 작업을 이어서 진행할 수 있습니다.\n\n무엇을 도와드릴까요?';
    }

    addAiMessage(prefix + guideBody);
}

function getCurrentTime() {
    var now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' +
           now.getMinutes().toString().padStart(2, '0');
}

function initWelcomeMessage() {
    var welcomeMessage = getWelcomeMarkdown();
    var htmlContent = '';

    try {
        htmlContent = parseMarkdown(welcomeMessage);
    } catch (e) {
        console.error('Markdown parsing error in initWelcomeMessage:', e);
        htmlContent = escapeHtml(welcomeMessage).replace(/\n/g, '<br>');
    }

    $('.welcome-message .message-content').html(htmlContent);
    $('.welcome-message .message-time').text(getCurrentTime());

    // 환영 메시지의 코드 블록에도 복사 버튼 추가
    addCopyButtonsToWelcomeMessage();
}

function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 마크다운을 HTML로 변환하는 공통 함수
function parseMarkdown(markdownText) {
    var htmlContent = '';
    try {
        if (typeof marked !== 'undefined') {
            // 모든 마크다운 처리에서 일관된 옵션 사용
            marked.setOptions({
                breaks: true,        // 줄바꿈을 <br>로 변환
                gfm: true,          // GitHub Flavored Markdown 사용
                sanitize: false,    // HTML 태그 허용
                smartLists: true,   // 스마트 리스트 처리
                smartypants: false, // 스마트 따옴표 비활성화
                headerIds: false,   // 헤더 ID 생성 비활성화
                mangle: false       // 이메일 주소 난독화 비활성화
            });
            htmlContent = marked.parse(markdownText);
        } else {
            // marked가 로드되지 않은 경우 기본 처리
            htmlContent = escapeHtml(markdownText).replace(/\n/g, '<br>');
        }
    } catch (e) {
        console.error('Markdown parsing error:', e);
        // 오류 발생 시 기본 HTML 이스케이프 처리
        htmlContent = escapeHtml(markdownText).replace(/\n/g, '<br>');
    }
    return htmlContent;
}

// 로딩 메시지 관련 함수들
var loadingCounter = 0;

function addLoadingMessage() {
    loadingCounter++;
    var loadingId = 'loading_' + loadingCounter;
    var timestamp = getCurrentTime();

    var loadingHtml = `
        <div class="loading-message" id="${loadingId}">
            <div class="loading-content">
                <span>AI가 응답을 생성하고 있습니다</span>
                <span class="loading-dots"></span>
            </div>
            <div class="message-time">${timestamp}</div>
        </div>
    `;

    $('#chat_messages').append(loadingHtml);
    scrollChatToBottom();

    return loadingId;
}

function removeLoadingMessage(loadingId) {
    $('#' + loadingId).remove();
}

// 워크플로우 상태 표시 함수들
var workflowStatusId = null;

function addWorkflowStatus(step, message = null) {
    // 워크플로우 상태 ID만 생성하고 실제 메시지는 표시하지 않음
    workflowStatusId = 'workflow_status_' + Date.now();

    // 콘솔에만 로그 출력 (디버깅용)
    if (step && message) {
        console.log(`Workflow Status: ${step} - ${message}`);
    } else if (step) {
        console.log(`Workflow Status: ${step}`);
    }

    return workflowStatusId;
}

function updateWorkflowStatus(step, message = null) {
    if (!workflowStatusId) return;

    // 워크플로우 상태 업데이트를 콘솔에만 로그 출력
    var stepMessages = {
        'analyze_request': '🔍 요청 분석 중...',
        'process_task_creation': '📝 태스크 생성 처리 중...',
        'process_script_review': '📋 스크립트 리뷰 처리 중...',
        'process_general_query': '💬 일반 질문 처리 중...',
        'format_response': '✨ 응답 형식화 중...',
        'completed': '✅ 워크플로우 완료'
    };

    var displayMessage = message || stepMessages[step] || `🔄 ${step} 처리 중...`;
    console.log("Workflow Status Update:", displayMessage);

    // 실제 DOM 업데이트는 하지 않고 콘솔 로그만 출력
}

function removeWorkflowStatus() {
    if (workflowStatusId) {
        console.log("Workflow Status Removed:", workflowStatusId);
        workflowStatusId = null;
    }
}

// 재시도 버튼 추가 함수
function addRetryButton(originalMessage) {
    var retryId = 'retry_' + Date.now();
    var retryHtml = `
        <div class="ai-message">
            <div class="message-content">
                <button id="${retryId}" class="retry-btn" onclick="retryMessage('${originalMessage.replace(/'/g, "\\'")}')">
                    🔄 다시 시도
                </button>
            </div>
            <div class="message-time">${getCurrentTime()}</div>
        </div>
    `;

    $('#chat_messages').append(retryHtml);
    scrollChatToBottom();
}

// 메시지 재시도 함수
async function retryMessage(message) {
    // 재시도 버튼 제거
    $('.retry-btn').closest('.ai-message').remove();

    // 메시지를 다시 입력창에 넣고 전송
    $('#chat_input').val(message);
    updateSendButton();
    await sendMessage();
}

// 진행률 인디케이터 추가
function addProgressIndicator() {
    var progressHtml = `
        <div class="ai-message" id="progress_indicator">
            <div class="message-content">
                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill"></div>
                    </div>
                    <div class="progress-text">
                        <span id="progress_status">AI가 응답을 생성하고 있습니다...</span>
                        <span id="progress_time">(소요 시간: <span id="elapsed_time">0</span>초)</span>
                    </div>
                </div>
            </div>
            <div class="message-time">${getCurrentTime()}</div>
        </div>
    `;

    $('#chat_messages').append(progressHtml);
    scrollChatToBottom();

    // 시간 추적 시작
    startTimeTracking();
}

// 진행률 인디케이터 제거
function removeProgressIndicator() {
    $('#progress_indicator').remove();
    stopTimeTracking();
}

// 시간 추적 변수
let timeTrackingInterval = null;
let startTime = null;

// 시간 추적 시작
function startTimeTracking() {
    startTime = Date.now();
    timeTrackingInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        $('#elapsed_time').text(elapsed);

        // 진행 상태 메시지 업데이트
        if (elapsed > 60) {
            $('#progress_status').text('복잡한 요청을 처리 중입니다. 잠시만 기다려주세요...');
        } else if (elapsed > 30) {
            $('#progress_status').text('AI가 응답을 분석하고 있습니다...');
        }
    }, 1000);
}

// 시간 추적 중지
function stopTimeTracking() {
    if (timeTrackingInterval) {
        clearInterval(timeTrackingInterval);
        timeTrackingInterval = null;
    }
    startTime = null;
}

// 입력창에서 Enter 키 처리
function handleKeyPress(event) {
    if (event.key === 'Enter') {
        // IME 조합 중인지 확인 (한글 입력 등)
        if (event.isComposing || event.keyCode === 229) {
            // IME 조합 중이면 기본 동작 허용 (조합 완료)
            return true;
        }

        if (event.ctrlKey) {
            // Ctrl+Enter: 줄바꿈을 위해 수동으로 처리
            event.preventDefault();
            var textarea = event.target;
            var start = textarea.selectionStart;
            var end = textarea.selectionEnd;
            var value = textarea.value;

            // 커서 위치에 줄바꿈 삽입
            textarea.value = value.substring(0, start) + '\n' + value.substring(end);

            // 커서를 줄바꿈 다음 위치로 이동
            textarea.selectionStart = textarea.selectionEnd = start + 1;

            // 전송 버튼 상태 업데이트
            updateSendButton();
            return false;
        } else {
            // Enter: 메시지 전송
            event.preventDefault();
            sendMessage();
        }
    }
}

// 코드 블록에 복사 버튼 추가
function addCopyButtonsToCodeBlocks() {
    console.log('addCopyButtonsToCodeBlocks 호출됨');

    // 마지막으로 추가된 메시지의 코드 블록들만 처리
    var $codeBlocks = $('#chat_messages .ai-message:last .message-content pre');
    console.log('발견된 코드 블록 수:', $codeBlocks.length);

    $codeBlocks.each(function(index) {
        var $pre = $(this);
        console.log('코드 블록 #' + index + ' 처리 중');

        // 이미 wrapper로 감싸져 있고 복사 버튼이 있으면 건너뛰기
        var $wrapper = $pre.parent('.code-block-wrapper');
        if ($wrapper.length > 0 && $wrapper.find('.code-copy-btn').length > 0) {
            console.log('이미 복사 버튼이 있음 - 건너뛰기');
            return;
        }

        // 복사 버튼 생성 및 추가
        createCopyButton($pre);
        console.log('복사 버튼 추가 완료');
    });
}

// 환영 메시지의 코드 블록에 복사 버튼 추가
function addCopyButtonsToWelcomeMessage() {
    console.log('addCopyButtonsToWelcomeMessage 호출됨');

    var $codeBlocks = $('.welcome-message .message-content pre');
    console.log('환영 메시지 코드 블록 수:', $codeBlocks.length);

    $codeBlocks.each(function(index) {
        var $pre = $(this);
        console.log('환영 메시지 코드 블록 #' + index + ' 처리 중');

        // 이미 wrapper로 감싸져 있고 복사 버튼이 있으면 건너뛰기
        var $wrapper = $pre.parent('.code-block-wrapper');
        if ($wrapper.length > 0 && $wrapper.find('.code-copy-btn').length > 0) {
            console.log('이미 복사 버튼이 있음 - 건너뛰기');
            return;
        }

        // 복사 버튼 생성 및 추가
        createCopyButton($pre);
    });
}

// 복사 버튼 생성 (공통 함수)
function createCopyButton($pre) {
    console.log('createCopyButton 호출됨');

    // pre 태그를 감싸는 wrapper가 있는지 확인
    var $wrapper = $pre.parent('.code-block-wrapper');

    if ($wrapper.length === 0) {
        // wrapper가 없으면 생성
        console.log('wrapper 생성 중...');
        $pre.wrap('<div class="code-block-wrapper"></div>');
        $wrapper = $pre.parent('.code-block-wrapper');
        console.log('wrapper 생성 완료');
    }

    // 기존 버튼이 있는지 다시 확인
    if ($wrapper.find('.code-copy-btn').length > 0) {
        console.log('이미 버튼이 존재함');
        return;
    }

    // 복사 버튼 생성
    var $copyBtn = $('<button>')
        .addClass('code-copy-btn')
        .attr('title', '코드 복사')
        .attr('type', 'button')
        .text('Copy');

    console.log('복사 버튼 생성됨');

    // 버튼 클릭 이벤트
    $copyBtn.on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('복사 버튼 클릭됨');

        // 코드 내용 추출 (code 태그 내용 또는 pre 태그 텍스트)
        var $code = $pre.find('code');
        var codeText = $code.length > 0 ? $code.text() : $pre.text();

        // 클립보드에 복사
        copyToClipboard(codeText, $copyBtn);
    });

    // wrapper에 버튼 추가 (pre 태그 앞에)
    $wrapper.prepend($copyBtn);
    console.log('버튼이 wrapper에 추가됨');
}

// 클립보드에 텍스트 복사
function copyToClipboard(text, $button) {
    // Clipboard API 사용
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
            showCopySuccess($button);
        }).catch(function(err) {
            console.error('클립보드 복사 실패:', err);
            // 대체 방법 시도
            fallbackCopyToClipboard(text, $button);
        });
    } else {
        // 대체 방법 사용
        fallbackCopyToClipboard(text, $button);
    }
}

// 대체 클립보드 복사 방법 (구형 브라우저 지원)
function fallbackCopyToClipboard(text, $button) {
    var $textarea = $('<textarea>')
        .val(text)
        .css({
            position: 'fixed',
            top: 0,
            left: 0,
            width: '2em',
            height: '2em',
            padding: 0,
            border: 'none',
            outline: 'none',
            boxShadow: 'none',
            background: 'transparent'
        })
        .appendTo('body');

    $textarea[0].select();

    try {
        var successful = document.execCommand('copy');
        if (successful) {
            showCopySuccess($button);
        } else {
            console.error('클립보드 복사 실패');
            showCopyError($button);
        }
    } catch (err) {
        console.error('클립보드 복사 오류:', err);
        showCopyError($button);
    }

    $textarea.remove();
}

// 복사 성공 피드백 표시
function showCopySuccess($button) {
    var originalText = $button.text();
    $button.addClass('copied')
        .text('Copied!');

    setTimeout(function() {
        $button.removeClass('copied')
            .text(originalText);
    }, 2000);
}

// 복사 실패 피드백 표시
function showCopyError($button) {
    var originalText = $button.text();
    $button.css('background', '#f44336')
        .text('Failed');

    setTimeout(function() {
        $button.css('background', '')
            .text(originalText);
    }, 2000);
}

// 채팅창 리사이즈 기능 초기화
function initChatResize() {
    var isResizing = false;
    var startY = 0;
    var startHeight = 0;
    var chatArea = document.getElementById('ai_chat_area');
    var resizeHandle = document.getElementById('chat_resize_handle');

    if (!chatArea || !resizeHandle) {
        return;
    }

    // 마우스 다운 이벤트
    resizeHandle.addEventListener('mousedown', function(e) {
        e.preventDefault();
        isResizing = true;
        startY = e.clientY;
        startHeight = chatArea.offsetHeight;

        chatArea.classList.add('resizing');
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';
    });

    // 마우스 이동 이벤트
    document.addEventListener('mousemove', function(e) {
        if (!isResizing) return;

        e.preventDefault();
        var deltaY = e.clientY - startY;
        var newHeight = startHeight + deltaY;

        // 최소 높이와 최대 높이 제한
        var minHeight = 400;
        var maxHeight = window.innerHeight - 100;

        if (newHeight < minHeight) {
            newHeight = minHeight;
        } else if (newHeight > maxHeight) {
            newHeight = maxHeight;
        }

        chatArea.style.height = newHeight + 'px';
    });

    // 마우스 업 이벤트
    document.addEventListener('mouseup', function(e) {
        if (!isResizing) return;

        isResizing = false;
        chatArea.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    });

    // 터치 이벤트 지원 (모바일)
    resizeHandle.addEventListener('touchstart', function(e) {
        e.preventDefault();
        isResizing = true;
        startY = e.touches[0].clientY;
        startHeight = chatArea.offsetHeight;

        chatArea.classList.add('resizing');
    });

    document.addEventListener('touchmove', function(e) {
        if (!isResizing) return;

        e.preventDefault();
        var deltaY = e.touches[0].clientY - startY;
        var newHeight = startHeight + deltaY;

        var minHeight = 400;
        var maxHeight = window.innerHeight - 100;

        if (newHeight < minHeight) {
            newHeight = minHeight;
        } else if (newHeight > maxHeight) {
            newHeight = maxHeight;
        }

        chatArea.style.height = newHeight + 'px';
    });

    document.addEventListener('touchend', function(e) {
        if (!isResizing) return;

        isResizing = false;
        chatArea.classList.remove('resizing');
    });
}
