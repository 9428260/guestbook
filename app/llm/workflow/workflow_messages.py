from __future__ import annotations

from typing import Dict, Mapping


class _SafeFormatDict(dict):
    """Dictionary that safely returns an empty string for missing keys."""

    def __missing__(self, key: str) -> str:
        return ""


# 공통 시스템 메시지 원본
WORKFLOW_SYSTEM_MESSAGES: Dict[str, str] = {
    "ask_name": (
        "태스크를 생성하기 위해 **태스크명**을 입력해주세요.\n\n"
        "##### Rule : [Master Prefix]_[TOWER]_[목적]_[자유롭게] \n"
        "##### Master Prefix (필수) : OPMATE Master별로 prefix를 붙여 구분한다 \n"
        " Master : SKT / prefix : WP_ \n"
        " Master : AWS / prefix : COM_ \n"
        " Master : SKPC / prefix : SKPC_ \n"
        " Master : Innovation / prefix : INO_ \n"
        "##### TOWER (필수): Linux, Windows, MW 등 사용하는 담당자의 운영 구분을 표시 구분이 어렵다면 Linux/Windows \n"
        "##### 목적 (선택): 목적에 맞게 작성 \n"
        " DCHK : 일일점검 Task의 경우 중복 수행시 수집에 영향이 있어 배치성으로만 수행 \n"
        " CHK : 배치가 아닌 개별 수행(ondemand성 Task)의 경우에 구분자 추가 \n"
        " AI : ai에게 parameter를 전달받아 수행하는 Task는 추가 \n"
        "##### 자유롭게 (필수): \n"
        " 마지막에는 사용자가 내 Task임을 구분할수 있게 자유롭게 표시 \n"
        " 가급적이면 용도가 무엇인지 작성 \n"
        " 다만 가능하면 대문자로 표시 \n"
        "##### 예시:\n"
        "WP_LIN_DCHK_ALL : SKT 환경에 리눅스 일일점검 Task\n"
        "SKPC_K8S_DCHK : SKPC 환경에 K8s 일일점검 Task\n"
        "COM_LIN_CHK_UPT : AWS 환경에 Linux Uptime 체크 ondemand 수행 Task\n"
        "INO_ORA_CHK_APCO : Innovation 환경에 oracle apico timeout 체크 ondemand 수행 Task\n"
    ),
    "ask_os_type": (
        "✅ 태스크명: **{task_name}**\n\n"
        "**운영체제 타입**을 선택해주세요.\n\n"
        "다음 중 하나를 입력해주세요:\n"
        "- **리눅스** 또는 **Linux** (Shell 스크립트)\n"
        "- **윈도우** 또는 **Windows** (PowerShell 스크립트)"
    ),
    "ask_requirements": (
        "✅ 태스크명: **{task_name}**\n"
        "✅ 운영체제: **{os_display}**\n\n"
        "이제 **스크립트 요건**을 입력해주세요.\n\n"
        "**예시:**\n"
        "- 리눅스에서 특정 디렉토리 밑에 있는 전체 로그를 읽어서 해당 로그 내에 특정 키워드 \"reboot\", \"stop\" 등이 있는지 체크해서 찾은 결과(로그명, 라인위치)를 JSON 포맷으로 출력할 수 있도록 해주세요.\n"
        "- 디스크 사용량 80% 이상 확인\n"
        "- CPU 사용률 모니터링\n"
        "- 로그 파일 정리"
    ),
    "script_generated": (
        "✅ 태스크명: **{task_name}**\n\n"
        "생성된 스크립트를 확인하셨나요?\n\n"
        "**다음 작업을 선택해주세요:**\n"
        "- **스크립트 수정**: 스크립트를 개선하거나 수정\n"
        "- **스크립트 리뷰**: 스크립트 분석 및 리뷰\n"
        "- **태스크 등록**: 태스크를 등록하고 실행 대상 설정\n"
        "- **완료**: 작업 종료"
    ),
    "search_nodes": (
        "✅ 태스크명: **{task_name}**\n\n"
        "노드 검색 단계에서 진행 중입니다.\n\n"
        "**실행할 노드 검색 조건**을 입력해주세요:\n\n"
        "**예시:**\n"
        "- 내가 관리하는 리눅스 노드\n"
        "- 운영중인 웹서버 노드\n"
        "- 전체 노드"
    ),
    "ask_schedule": (
        "✅ 태스크명: **{task_name}**\n\n"
        "스케줄 설정 단계입니다.\n\n"
        "이제 **스케줄 정보를 설정**해보겠습니다.\n\n"
        "원하는 실행 주기와 시간을 입력해주세요.\n"
        "- 매일 오전 9시에 실행: \"매일 09:00\"\n"
        "- 매주 월요일 오전 10시에 실행: \"매주 월요일 10:00\"\n"
        "- 일회성 실행: \"2025-01-15 18:30\"\n"
        "- 스케줄 없이 진행: \"스케줄 없음\" 또는 \"skip\""
    ),
    "ask_save_task": (
        "✅ 태스크명: **{task_name}**\n\n"
        "태스크 저장 단계입니다.\n\n"
        "💾 **태스크를 저장 및 발행하시겠습니까?**\n\n"
        "- 저장 및 발행하려면: **\"예\"**, **\"저장\"**, **\"태스크 저장\"**\n"
        "- 취소하려면: **\"아니오\"**, **\"취소\"**"
    ),
    "default_resume": (
        "이전 작업을 이어서 진행할 수 있습니다.\n\n"
        "무엇을 도와드릴까요?"
    ),
    "agent_restriction_notice": (
        "현재 선택한 태스크에서는 Agent 모드로 **스크립트 수정** 또는 "
        "**스크립트 리뷰** 요청만 수행할 수 있습니다."
    ),
    "welcome_existing_task": (
        "안녕하세요! **OPMATE AI 어시스턴트**입니다.\n"
        "현재 편집 중인 태스크에 대해 도움이 필요하시면 말씀해주세요.\n"
        "##### 🤖 **Agent 모드** (편집 지원)\n"
        "- ⚙️ **스크립트 수정**: \"스크립트 수정\", \"스크립트 개선\", \"스크립트 업데이트\" 등으로 요청\n"
        "- 📋 **스크립트 리뷰**: \"스크립트 리뷰\", \"스크립트 검토\", \"스크립트 분석\" 등으로 요청\n"
        "##### 💬 **Ask 모드** (정보 검색)\n"
        "- 📚 **OPMATE 매뉴얼 검색**: \"태스크에 대해 알려줘\", \"노드에 대해 알려줘\" 등으로 요청"
    ),
    "welcome_new_task": (
        "안녕하세요! **OPMATE 태스크 작성**에 도움을 드리는 AI 어시스턴트입니다.\n"
        "##### 🤖 **Agent 모드** (태스크 생성)\n"
        "- 📝 **태스크 작성**: \"태스크 작업\", \"태스크 작성\" 등으로 요청\n"
        "- 📝 태스크명 입력 -> OS Type(Linux, Window) -> 스크립트 작성 -> 실행 노드 등록 순으로 진행합니다.\n"
        "##### 💬 **Ask 모드** (정보 검색)\n"
        "- 📚 **OPMATE 매뉴얼 검색**: \"태스크에 대해 알려줘\", \"노드에 대해 알려줘\" 등으로 요청"
    ),
    "register_task_confirmation_notice": (
        '<div style="border-left: 4px solid #f44336; padding: 16px; background-color: #ffebee; '
        'color: #b71c1c; border-radius: 6px;">\n'
        "<strong>⚠️ 중요 안내</strong><br>\n"
        "작성된 스크립트가 서버에서 실행되도록 반영되므로 각별한 주의가 필요합니다!<br>\n"
        '등록을 계속하려면 채팅창에 <strong style="color:#d32f2f;">예</strong> 라고 입력해주세요.<br>\n'
        '취소하려면 다른 내용을 입력하거나 "아니오"라고 입력하면 스크립트 생성 단계로 돌아갑니다.\n'
        "</div>"
    ),
    "task_registration_cancelled_redirect": (
        "태스크 등록을 취소하고 **스크립트 생성 단계**로 이동합니다.\n\n"
        "{task_name_line}"
        "{os_display_line}"
        "스크립트에 포함할 요건을 다시 입력해주세요.\n"
        "**예시:**\n"
        "- 리눅스에서 특정 디렉토리 밑에 있는 전체 로그를 읽어서 해당 로그 내에 특정 키워드 "
        "\"reboot\", \"stop\" 등이 있는지 체크해서 찾은 결과(로그명, 라인위치)를 JSON 포맷으로 출력할 수 있도록 해주세요.\n"
        "- 디스크 사용량 80% 이상 확인\n"
        "- CPU 사용률 모니터링\n"
        "- 로그 파일 정리"
    ),
    "target_input_empty_error": (
        "입력이 비어있습니다. 다시 입력해주세요."
    ),
    "ai_response_generation_error": (
        "죄송합니다. 응답을 생성하는 중 문제가 발생했습니다. 다시 시도해주세요."
    ),
    "target_search_error": (
        "실행 대상 검색 중 오류가 발생했습니다: {error_detail}\n\n"
        "다시 시도해주세요."
    ),
    "task_registration_completed_with_schedule": (
        "태스크 등록이 완료되었습니다! ✅\n\n"
        "{schedule_guide}"
    ),
    "task_registration_completed_need_targets": (
        "태스크 등록이 완료되었습니다! ✅\n\n"
        "이제 **실행 대상 정보를 설정**해보겠습니다.\n\n"
        "실행할 서버의 호스트명이나 조건을 입력해주세요.\n"
        "- 특정 호스트명: \"hostname=server01\"\n"
        "- OS 타입으로 검색: \"os_type=linux\"\n"
        "- 여러 조건: \"hostname=web*, os_type=linux\"\n\n"
        "또는 **노드 검색**이라고 입력하여 노드를 검색할 수 있습니다."
    ),
    "task_registration_missing_data": (
        "등록할 태스크 정보가 존재하지 않습니다. 다시 시도해주세요."
    ),
    "task_registration_cancelled": (
        "태스크 등록을 취소했습니다. 필요하시면 다시 요청해주세요."
    ),
    "task_registration_data_absent": (
        "등록할 태스크 데이터가 없습니다. 다시 시도해주세요."
    ),
    "script_description_prompt": (
        "태스크 작성을 위해 스크립트에 대한 설명을 입력해 주세요."
    ),
    "network_error_guidance": (
        "죄송합니다. 서버 연결에 문제가 발생했습니다: {error_detail}\n\n"
        "**해결 방법:**\n"
        "- 잠시 후 다시 시도해주세요\n"
        "- 네트워크 연결을 확인해주세요\n"
        "- 문제가 지속되면 관리자에게 문의해주세요"
    ),
    "task_id_required": (
        "❌ 태스크 ID를 입력해주세요."
    ),
    "script_name_required": (
        "❌ 스크립트 파일명을 입력해주세요."
    ),
    "task_save_success": (
        "✅ 태스크가 성공적으로 저장되었습니다!\n\n"
        "저장된 태스크 정보: {result_detail}"
    ),
    "task_publish_missing_id": (
        "❌ 태스크 ID가 설정되지 않아 발행할 수 없습니다.\n\n"
        "저장 응답을 확인하고 다시 시도해주세요."
    ),
    "task_publish_started": (
        "📤 태스크 발행을 시작합니다..."
    ),
    "task_publish_requires_otp": (
        "🔐 TCS OTP 인증이 필요합니다. OTP 팝업을 확인해주세요."
    ),
    "task_publish_success": (
        "✅ 태스크가 성공적으로 발행되었습니다!\n\n"
        "{result_detail}"
    ),
    "task_followup_after_publish": (
        "🎉 모든 작업이 완료되었습니다!\n\n"
        "생성된 태스크에서 **스크립트 수정** 또는 **스크립트 리뷰**를 이어서 진행해 주세요.\n\n"
        "'스크립트 수정' 혹은 '스크립트 리뷰'라고 입력하면 다음 단계를 안내해 드릴게요."
    ),
    "task_publish_failure": (
        "⚠️ 태스크 발행 실패: {result_detail}"
    ),
    "task_publish_error": (
        "❌ 태스크 발행 중 오류가 발생했습니다.\n\n"
        "오류: {error_detail}"
    ),
    "task_save_warning": (
        "⚠️ 태스크 저장: {result_detail}"
    ),
    "task_save_error": (
        "❌ 태스크 저장 중 오류가 발생했습니다.\n\n"
        "오류: {error_detail}"
    ),
    "task_save_request_sent": (
        "💾 태스크 저장 요청을 전송했습니다..."
    ),
    "task_save_processing_error": (
        "❌ 태스크 저장 처리 중 오류가 발생했습니다: {error_detail}"
    ),
    "existing_task_agent_mode_guide": (
        "현재 선택한 태스크에서는 Agent 모드로 **스크립트 수정** 또는 "
        "**스크립트 리뷰**만 요청할 수 있습니다.\n\n"
        "**예시 문장**\n"
        "- \"스크립트를 수정해줘\"\n"
        "- \"스크립트 리뷰 부탁해\"\n"
        "- \"스크립트 분석해줘\""
    ),
    "agent_mode_switch_initial": (
        "🤖 **Agent 모드로 전환되었습니다**\n\n"
    ),
    "agent_mode_switch_resume": (
        "🤖 **Agent 모드로 돌아왔습니다**\n\n"
    ),
    "node_search_generic_error": (
        "노드 검색 중 오류가 발생했습니다: {error_detail}\n\n"
        "다시 시도해주시거나 다른 방법을 선택해주세요."
    ),
    "node_search_result_missing": (
        "노드 검색 결과를 가져올 수 없습니다.\n\n"
        "검색 조건을 다시 입력해주세요."
    ),
    "node_search_no_match_options": (
        "검색 조건에 맞는 노드가 없습니다.\n\n"
        "**사용자 요청:** {user_request}\n\n"
        "다음 중 하나를 선택해주세요:\n\n"
        "1. **1 다시 검색** - 다른 검색 조건으로 노드 검색\n"
        "2. **2 태스크 등록** - 현재 스크립트로 태스크 등록 (노드는 나중에 설정)\n"
        "3. **3 스크립트 수정** - 스크립트 내용 수정\n\n"
        "선택하시거나 새로운 검색 조건을 바로 입력해주세요."
    ),
    "node_search_results_summary": (
        "**검색 결과** ({node_count}개 노드 발견)\n\n"
        "{node_list}\n\n"
        "실행 대상 정보를 추가해 드릴까요? 예 또는 추가를 입력해 주세요.\n\n"
        "실행 대상 정보 추가를 원치 않으시면 아니오 또는 취소를 입력해 주세요.\n\n"
        "💡 **참고**: 실행 대상 추가 시 태스크가 등록되어 있지 않으면 태스크도 함께 등록됩니다.\n"
    ),
    "node_search_parse_error": (
        "노드 검색 중 오류가 발생했습니다.\n\n"
        "검색 결과를 파싱할 수 없습니다: {error_detail}\n\n"
        "다시 시도해주시거나 다른 방법을 선택해주세요."
    ),
    "node_selection_missing_results": (
        "검색 결과를 찾을 수 없습니다.\n\n"
        "노드를 다시 검색해주세요. 예를 들어:\n"
        "- 내가 관리하는 리눅스 노드 검색\n"
        "- 윈도우 서버 검색\n"
        "- 특정 IP로 시작하는 노드 찾기\n\n"
        "검색 조건을 입력해주시면 다시 검색하겠습니다."
    ),
    "nodes_added_schedule_prompt": (
        "실행 대상이 설정되었습니다! ✅\n\n"
        "**{selected_count}개 노드**를 실행 대상에 반영했습니다.\n\n"
        "{schedule_prompt}"
    ),
    "node_selection_decline": (
        "실행 대상 정보 추가를 취소했습니다.\n\n"
        "{search_prompt}"
    ),
    "node_search_prompt_fallback": (
        "실행할 노드 검색 조건을 입력해주세요:\n\n"
        "- 내가 관리하는 리눅스 노드\n"
        "- 운영중인 웹서버 노드\n"
        "- 전체 노드"
    ),
    "manual_node_input_prompt": (
        "노드 정보를 입력해주세요.\n\n"
        "**입력 형식:**\n"
        "- 노드 ID: NODE001, NODE002\n"
        "- IP 주소: 192.168.1.10, 192.168.1.20\n"
        "- 혼합: NODE001, 192.168.1.20"
    ),
    "manual_node_input_confirmation": (
        "**수동 입력된 노드** ({node_count}개):\n\n"
        "{node_list}\n\n"
        "태스크 등록을 진행하시겠습니까?\n"
        "**태스크 등록**을 입력해주세요."
    ),
    "manual_node_input_invalid": (
        "올바른 노드 정보를 입력해주세요.\n\n"
        "쉼표(,)로 구분하여 노드 ID나 IP 주소를 입력해주세요."
    ),
    "schedule_prompt_fallback": (
        "이제 **스케줄 정보를 설정**해보겠습니다.\n\n"
        "원하는 실행 주기와 시간을 입력해주세요.\n"
        "- 매일 오전 9시에 실행: \"매일 09:00\"\n"
        "- 매주 월요일 오전 10시에 실행: \"매주 월요일 10:00\"\n"
        "- 일회성 실행: \"2025-01-15 18:30\"\n"
        "- 스케줄 없이 진행: \"스케줄 없음\" 또는 \"skip\""
    ),
}

# 동일한 워크플로우 단계에서 재사용되는 메시지 매핑
WORKFLOW_SYSTEM_MESSAGES["ask_modification"] = WORKFLOW_SYSTEM_MESSAGES["script_generated"]
WORKFLOW_SYSTEM_MESSAGES["select_nodes"] = WORKFLOW_SYSTEM_MESSAGES["search_nodes"]


def get_workflow_system_message(step: str, context: Mapping[str, object] | None = None) -> str:
    """
    워크플로우 단계별 시스템 메시지를 반환한다.
    context에 전달된 값을 기반으로 포맷팅하며, 누락된 키는 빈 문자열로 대체한다.
    """
    if not step:
        return ""

    template = WORKFLOW_SYSTEM_MESSAGES.get(step)
    if not template:
        return ""

    safe_context = _SafeFormatDict()
    if context:
        for key, value in context.items():
            safe_context[key] = "" if value is None else str(value)

    return template.format_map(safe_context)
