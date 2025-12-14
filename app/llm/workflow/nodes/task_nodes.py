"""
태스크 생성 워크플로우 노드 - 통합 모듈

태스크 생성 워크플로우의 각 단계를 처리하는 노드 함수들을 정의합니다.
이 모듈은 분리된 기능 모듈들을 통합하여 외부에 단일 인터페이스를 제공합니다.

이 파일은 하위 호환성을 위해 존재하며, 실제 구현은 다음 모듈들로 분리되어 있습니다:
- script_operations: 스크립트 생성, 수정, 리뷰
- node_operations: 노드 검색, 선택
- task_registration: 태스크 등록
- task_workflow: 메인 워크플로우 조정
"""

# 기존 함수들을 새로운 모듈에서 import
from .script_operations import (
    generate_task_script,
    modify_task_script,
    perform_script_review
)

from .node_operations import (
    handle_node_search,
    handle_node_selection_from_search,
    handle_manual_node_input
)

from .task_registration import (
    finalize_task_registration
)

# task_workflow에서 메인 wrapper import (아직 생성 안됨)
# from .task_workflow import task_creation_wrapper

# 임시로 여기에 task_creation_wrapper를 정의합니다
from langchain_core.messages import AIMessage, HumanMessage
from ..models import AgentState
from ..tools.node_tools import parse_schedule_input, check_task_name_conflict
from ..workflow_messages import get_workflow_system_message


def _get_task_name_request_message() -> str:
    """태스크명 입력 요청 메시지를 반환하는 헬퍼 함수"""
    return get_workflow_system_message("ask_name")


def task_creation_wrapper(state: AgentState) -> AgentState:
    """
    태스크 작성 에이전트 래퍼 - 확장된 워크플로우
    1단계: 태스크명 입력 요청
    2단계: 운영체제 타입 선택
    3단계: 스크립트 요건 입력 요청
    4단계: 스크립트 생성
    5단계: 스크립트 수정 (선택적)
    6단계: 노드 검색
    7단계: 검색 결과에서 노드 선택
    8단계: 태스크 등록
    """
    # 전체 흐름 개요:
    # 1) 현재 사용자 입력과 세션 상태를 복원한 뒤 워크플로우 진행 위치를 확정한다.
    # 2) 모드 전환, 저장·취소 등 최우선 명령을 선처리하여 예외 흐름을 빠르게 종료한다.
    # 3) 워크플로우 단계에 따라 태스크명→OS→요건→스크립트 생성·수정→노드 검색·선택→스케줄→저장 순으로 분기한다.
    # 4) 각 단계 완료 시 session_data에 즉시 동기화하여 중간 이탈 후에도 재진입이 가능하도록 한다.

    # --- 기본 상태 복사 및 주요 플래그 정리 ---
    new_state = state.copy()
    user_message = new_state.get("user_message", "")
    task_name = new_state.get("task_name", "")
    workflow_step = new_state.get("workflow_step", "")
    chat_mode = new_state.get("chat_mode", "agent")
    is_mode_changed = new_state.get("is_mode_changed", False)

    # --- 검색/선택된 노드 상태 복원 ---
    # 중첩 구조를 유지해야 하므로 얕은 복사가 아닌 원본 참조를 그대로 전달한다.
    if "search_results" in state:
        new_state["search_results"] = state["search_results"]
    if "selected_nodes" in state:
        new_state["selected_nodes"] = state["selected_nodes"]

    # --- 세션 기반 상태 복구 ---
    # 대화 도중 스토리지가 초기화되더라도 session_data에 남은 값을 기반으로 재동기화한다.
    print(f"[task_creation_wrapper] 초기 state.session_data: {state.get('session_data', '없음')}")
    print(f"[task_creation_wrapper] 초기 state.session_data 타입: {type(state.get('session_data', {}))}")

    if "session_data" not in new_state:
        new_state["session_data"] = {}
    elif not isinstance(new_state["session_data"], dict):
        new_state["session_data"] = {}

    # state에서 session_data가 있으면 병합
    if "session_data" in state and isinstance(state["session_data"], dict):
        new_state["session_data"].update(state["session_data"])
        print(f"[task_creation_wrapper] 병합 후 session_data keys: {list(new_state['session_data'].keys())}")

    # session_data에서 search_results를 state로 복원
    if "search_results" in new_state["session_data"]:
        new_state["search_results"] = new_state["session_data"]["search_results"]
        print(f"[task_creation_wrapper] session_data에서 search_results 복원: {new_state['search_results']}")

    # session_data에서 search_result_nodes를 state로 복원 (실제 노드 데이터)
    if "search_result_nodes" in new_state["session_data"]:
        new_state["search_result_nodes"] = new_state["session_data"]["search_result_nodes"]
        print(f"[task_creation_wrapper] session_data에서 search_result_nodes 복원: {len(new_state['search_result_nodes'])}개")

    # session_data에서 워크플로우 관련 필드들을 state로 복원
    if "workflow_step" in new_state["session_data"]:
        new_state["workflow_step"] = new_state["session_data"]["workflow_step"]
        workflow_step = new_state["workflow_step"]
        print(f"[task_creation_wrapper] session_data에서 workflow_step 복원: {workflow_step}")
    if "task_name" in new_state["session_data"]:
        new_state["task_name"] = new_state["session_data"]["task_name"]
        task_name = new_state["task_name"]
        print(f"[task_creation_wrapper] session_data에서 task_name 복원: {task_name}")
    if "os_type" in new_state["session_data"]:
        new_state["os_type"] = new_state["session_data"]["os_type"]
        print(f"[task_creation_wrapper] session_data에서 os_type 복원: {new_state['os_type']}")
    if "task_requirements" in new_state["session_data"]:
        new_state["task_requirements"] = new_state["session_data"]["task_requirements"]
        print(f"[task_creation_wrapper] session_data에서 task_requirements 복원")
    if "script_content" in new_state["session_data"]:
        new_state["script_content"] = new_state["session_data"]["script_content"]
        print(f"[task_creation_wrapper] session_data에서 script_content 복원")
    if "script_description" in new_state["session_data"]:
        new_state["script_description"] = new_state["session_data"]["script_description"]
        print(f"[task_creation_wrapper] session_data에서 script_description 복원")

    existing_task_id = new_state["session_data"].get("existing_task_id", "") or new_state.get("task_id", "")
    if existing_task_id:
        new_state["task_id"] = existing_task_id
        new_state["session_data"]["existing_task_id"] = existing_task_id
    is_existing_task = bool(existing_task_id)
    new_state["session_data"]["is_existing_task"] = is_existing_task
    if is_existing_task:
        new_state["session_data"]["task_registered"] = True
        print(f"[task_creation_wrapper] 기존 태스크 컨텍스트 감지: task_id={existing_task_id}")

    # --- 모드 전환 예외 처리 ---
    # 사용자가 ask 모드로 강제 전환하면 워크플로우를 종료하고 검색 에이전트로 넘긴다.
    if is_mode_changed and chat_mode == "ask":
        print(f"[task_creation_wrapper] Mode changed to ASK, redirecting to search")
        # 검색 에이전트로 라우팅
        new_state["next"] = "opmate"
        return new_state

    # --- 사용자 의도 선처리 ---
    # 저장·취소 등 전역 명령은 언제든 입력될 수 있으므로 단계 분기 전에 우선 검사한다.
    # 태스크 저장 및 발행 요청 키워드 확인 (최우선 체크)
    save_keywords = ["태스크 저장", "태스크저장", "저장", "save", "save task"]
    is_save_request = any(keyword in user_message.lower() for keyword in save_keywords)

    print(f"[task_creation_wrapper] is_save_request: {is_save_request}, workflow_step: '{workflow_step}'")

    # 태스크 저장 및 발행 요청이 있으면 즉시 처리
    if is_save_request:
        if workflow_step == "done":
            print(f"[task_creation_wrapper] 태스크 저장 및 발행 요청 감지 (workflow_step=done)")

            # 태스크 저장 및 발행 이벤트 전송
            new_state["result_msg"] = "SAVE_TASK"

            save_message = AIMessage(content=(
                "💾 **태스크 저장 및 발행을 시작합니다...**\n\n"
                "태스크 상세 화면의 저장 및 발행 버튼을 자동으로 실행합니다.\n"
            ))
            new_state["messages"].append(save_message)
            new_state["next"] = "FINISH"
            new_state["awaiting_user_response"] = False

            return new_state
        else:
            print(f"[task_creation_wrapper] 태스크 저장 요청이 있지만 workflow_step이 'done'이 아님: '{workflow_step}'")

    # 메시지에서 태스크 작성 의도인지 확인
    creation_keywords = ["태스크 작성", "태스크작성", "태스크 생성", "태스크생성", "새 태스크", "새태스크"]
    is_creation_request = any(keyword in user_message for keyword in creation_keywords)

    # 워크플로우 중단/초기화 키워드 확인 (최우선 처리)
    cancel_keywords = ["종료", "완료", "취소", "중단", "그만", "초기화", "reset"]
    is_cancel_request = any(keyword in user_message.lower() for keyword in cancel_keywords)

    # 워크플로우가 진행 중인 상태에서 취소 요청이 있으면 초기화
    # 단, ask_save_task와 done 단계는 제외 (저장 여부 확인 단계이므로)
    if is_cancel_request and workflow_step and workflow_step not in ["", "done", "ask_save_task"]:
        print(f"[task_creation_wrapper] 워크플로우 취소/초기화 요청 감지: workflow_step={workflow_step}")

        cancel_message = AIMessage(content=(
            "🔄 **태스크 작성을 종료합니다.**\n\n"
            "모든 작업이 초기화되었습니다.\n"
            "새로운 태스크를 작성하시려면 **태스크 작성**을 입력해주세요."
        ))
        new_state["messages"].append(cancel_message)
        new_state["next"] = "FINISH"
        new_state["awaiting_user_response"] = False

        # 워크플로우 상태 초기화
        new_state["workflow_step"] = ""
        new_state["task_name"] = ""
        new_state["os_type"] = ""
        new_state["task_requirements"] = ""
        new_state["script_content"] = ""
        new_state["script_description"] = ""
        new_state["search_results"] = []
        new_state["selected_nodes"] = []

        # session_data도 초기화
        if "session_data" in new_state:
            new_state["session_data"] = {}

        return new_state

    # 수정 완료 키워드 확인 (ask_modification 단계에서만 사용) - 더 명확한 완료 의도만 처리
    completion_keywords = ["작업 완료", "스크립트 완료", "완료됨", "끝", "종료하기", "더 이상 수정 안함"]
    is_completion_request = any(keyword in user_message for keyword in completion_keywords)

    # 태스크 등록 요청 키워드 확인
    register_keywords = ["태스크로 등록", "태스크 등록", "등록해줘", "등록해주세요"]
    is_register_request = any(keyword in user_message for keyword in register_keywords)

    # 초기 상태에서 태스크명 추출 시도 ("태스크명: xxx" 형식)
    if not task_name and not workflow_step:
        import re
        task_name_match = re.search(r'태스크명\s*[:：]\s*(.+)', user_message)
        if task_name_match:
            potential_task_name = task_name_match.group(1).strip()
            # OS 타입 키워드가 포함된 경우는 건너뜀
            if not any(keyword in potential_task_name.lower() for keyword in ["리눅스", "linux", "윈도우", "windows"]):
                new_state["task_name"] = potential_task_name
                task_name = potential_task_name
                workflow_step = ""  # 다음 단계로 진행
                print(f"[task_creation_wrapper] 초기 상태에서 태스크명 추출: {task_name}")

    # 1단계: 태스크명이 없으면 입력 요청
    if is_creation_request and not task_name:
        request_message = AIMessage(content=_get_task_name_request_message())
        new_state["messages"].append(request_message)
        new_state["next"] = "FINISH"
        new_state["awaiting_user_response"] = True
        new_state["workflow_step"] = "ask_name"

        # session_data에 워크플로우 상태 동기화
        if "session_data" not in new_state:
            new_state["session_data"] = {}
        new_state["session_data"]["workflow_step"] = "ask_name"

        return new_state

    # 2단계: 태스크명 입력 단계 - 사용자가 태스크명을 입력함
    if workflow_step == "ask_name":
        # 사용자가 입력한 메시지를 태스크명으로 저장
        task_name_input = user_message.strip()

        # 태스크명 중복 확인
        conflict_check = check_task_name_conflict(task_name_input)

        if conflict_check['exists']:
            # 노드가 존재하는 경우 - 다른 태스크명 입력 요청
            task_info = conflict_check['task_info']
            conflict_message = AIMessage(content=(
                f"⚠️ **태스크명 중복 확인**\n\n"
                f"입력하신 태스크명 **{task_name_input}**은 이미 태스크 ID로 사용되고 있습니다.\n\n"
                f"**기존 노드 정보:**\n"
                f"- 태스크 명: {task_info.get('name', 'N/A')}\n"
                f"**다른 태스크명을 입력해주세요.**\n\n"
                f"**예시:**\n"
                f"- {task_name_input}_Task\n"
                f"- {task_name_input}_Script\n"
                f"- {task_name_input}_Auto\n"
                f"- {task_name_input}_Generated"
            ))
            new_state["messages"].append(conflict_message)
            new_state["next"] = "FINISH"
            new_state["awaiting_user_response"] = True
            new_state["workflow_step"] = "ask_name"  # 같은 단계 유지
            return new_state

        # 태스크명이 사용 가능한 경우 - 다음 단계로 진행
        new_state["task_name"] = task_name_input

        request_message = AIMessage(content=get_workflow_system_message(
            "ask_os_type",
            {"task_name": task_name_input}
        ))
        new_state["messages"].append(request_message)
        new_state["next"] = "FINISH"
        new_state["awaiting_user_response"] = True
        new_state["workflow_step"] = "ask_os_type"

        # session_data에 워크플로우 상태 동기화
        if "session_data" not in new_state:
            new_state["session_data"] = {}
        new_state["session_data"]["workflow_step"] = "ask_os_type"
        new_state["session_data"]["task_name"] = task_name_input

        return new_state

    # 3단계: OS 타입 입력 단계
    if workflow_step == "ask_os_type":
        # OS 타입 감지
        user_input_lower = user_message.lower().strip()
        if "리눅스" in user_input_lower or "linux" in user_input_lower:
            os_type = "Linux"
            os_display = "리눅스 (Shell 스크립트)"
        elif "윈도우" in user_input_lower or "windows" in user_input_lower:
            os_type = "windows"
            os_display = "윈도우 (PowerShell 스크립트)"
        else:
            # 잘못된 입력
            error_message = AIMessage(content=(
                "올바른 운영체제 타입을 입력해주세요.\n\n"
                "다음 중 하나를 입력해주세요:\n"
                "- **리눅스** 또는 **Linux** (Shell 스크립트)\n"
                "- **윈도우** 또는 **Windows** (PowerShell 스크립트)"
            ))
            new_state["messages"].append(error_message)
            new_state["next"] = "FINISH"
            new_state["awaiting_user_response"] = True
            # workflow_step은 그대로 유지
            return new_state

        new_state["os_type"] = os_type

        request_message = AIMessage(content=get_workflow_system_message(
            "ask_requirements",
            {
                "task_name": new_state.get("task_name", task_name),
                "os_display": os_display
            }
        ))
        new_state["messages"].append(request_message)
        new_state["next"] = "FINISH"
        new_state["awaiting_user_response"] = True
        new_state["workflow_step"] = "ask_requirements"

        # session_data에 워크플로우 상태 동기화
        if "session_data" not in new_state:
            new_state["session_data"] = {}
        new_state["session_data"]["workflow_step"] = "ask_requirements"
        new_state["session_data"]["os_type"] = os_type
        new_state["session_data"]["task_name"] = new_state.get("task_name", "")

        return new_state

    # 4단계: 태스크명과 요건이 모두 있는 경우 - 스크립트 생성
    if workflow_step == "ask_requirements" and task_name and user_message:
        # 사용자가 입력한 메시지를 요건으로 저장
        new_state["task_requirements"] = user_message.strip()
        new_state["workflow_step"] = "generate_script"

        # 스크립트 생성을 위해 task_script_agent 호출
        return generate_task_script(new_state)

    # 5-0단계: 리뷰 요청 입력 대기 단계
    if workflow_step == "waiting_for_review_request":
        # 사용자 입력을 리뷰 요청으로 처리
        if user_message and user_message.strip():
            new_state["review_request"] = user_message.strip()
            return perform_script_review(new_state)
        else:
            # 입력이 없으면 다시 요청
            request_message = AIMessage(content=(
                "스크립트 리뷰 요건을 구체적으로 입력해주세요.\n\n"
                "**📋 리뷰 관점별 예시:**\n\n"
                "**🔒 보안 관점:**\n"
                "- 위험한 명령어가 있는지 확인해주세요\n"
                "- 보안 취약점을 찾아주세요\n"
                "- 권한 상승 위험 요소를 분석해주세요\n\n"
                "**⚡ 성능 관점:**\n"
                "- 성능 저하 요인을 찾아주세요\n"
                "- 메모리 사용량을 검토해주세요\n"
                "- 병목 구간을 분석해주세요\n\n"
                "**⚠️ 안정성 관점:**\n"
                "- 에러 처리가 충분한지 확인해주세요\n"
                "- 예외 상황 대응을 검토해주세요\n"
                "- 복구 메커니즘을 점검해주세요\n\n"
                "위 관점 중 하나를 선택하거나, 구체적인 리뷰 요구사항을 상세히 입력해주세요."
            ))
            new_state["messages"].append(request_message)
            new_state["next"] = "FINISH"
            new_state["awaiting_user_response"] = True
            return new_state

    # 5-1단계: 수정 요청 입력 대기 단계
    if workflow_step == "waiting_for_modification_request":
        # 사용자 입력을 수정 요청으로 처리
        if user_message and user_message.strip():
            new_state["modification_request"] = user_message.strip()
            return modify_task_script(new_state)
        else:
            # 입력이 없으면 다시 요청
            request_message = AIMessage(content=(
                "스크립트 수정 요건을 구체적으로 입력해주세요.\n\n"
                "**📝 수정 카테고리별 예시:**\n\n"
                "**🔒 보안 강화:**\n"
                "- 입력 값 검증 로직 추가\n"
                "- 권한 체크 로직 강화\n"
                "- 취약한 명령어 보완\n\n"
                "위 카테고리 중 하나를 선택하거나, 구체적인 수정 요구사항을 상세히 입력해주세요."
            ))
            new_state["messages"].append(request_message)
            new_state["next"] = "FINISH"
            new_state["awaiting_user_response"] = True
            return new_state

    # 5단계: 스크립트 수정 단계
    if workflow_step == "ask_modification":
        # 리뷰 요청 키워드 확인 (새로운 단계로 진입)
        review_keywords = ["리뷰", "review", "스크립트 리뷰", "리뷰 요청", "분석", "검토", "점검", "확인해", "확인해주", "확인해달라", "확인부탁", "검사", "체크"]
        is_review_request_intent = any(keyword in user_message for keyword in review_keywords)

        # 수정 요청 키워드 확인 (새로운 단계로 진입)
        modification_keywords = [
            "수정 요청",
            "수정요청",
            "스크립트 개선",
            "스크립트개선",
            "스크립트 수정",
            "스크립트수정",
            "스크립트 업데이트",
            "스크립트업데이트",
            "업데이트",
            "수정",
            "개선",
            "2"
        ]
        is_modification_request_intent = any(keyword in user_message for keyword in modification_keywords)

        # 리뷰 요청 의도만 있고 구체적인 요청이 없으면 리뷰 요청 입력 단계로 이동
        if is_review_request_intent and len(user_message.strip()) < 20:
            new_state["workflow_step"] = "waiting_for_review_request"
            # session_data에 워크플로우 상태 동기화 (리뷰 요건 입력 단계 유지)
            if "session_data" not in new_state or not isinstance(new_state["session_data"], dict):
                new_state["session_data"] = {}
            new_state["session_data"]["workflow_step"] = "waiting_for_review_request"

            request_message = AIMessage(content=(
                "📋 **스크립트 리뷰를 진행하겠습니다.**\n\n"
                "어떤 관점에서 리뷰하시겠습니까?\n\n"
                "아래 가이드를 참고해 원하는 리뷰 관점을 구체적으로 알려주세요.\n\n"
                "**예시 관점**\n"
                "- 보안 취약점/권한 검증\n"
                "- 성능 및 리소스 최적화\n"
                "- 에러 처리/예외 흐름 점검\n"
                "- 운영 표준/코딩 스타일 적합성\n"
                "- 로그 및 모니터링/감사 항목 확인\n"
                "- 실행 안정성 및 복구 전략"
            ))
            new_state["messages"].append(request_message)
            new_state["next"] = "FINISH"
            new_state["awaiting_user_response"] = True
            return new_state

        # 수정 요청 의도만 있고 구체적인 요청이 없으면 수정 요청 입력 단계로 이동
        if is_modification_request_intent and len(user_message.strip()) < 20:
            new_state["workflow_step"] = "waiting_for_modification_request"

            if "session_data" not in new_state or not isinstance(new_state["session_data"], dict):
                new_state["session_data"] = {}
            new_state["session_data"]["workflow_step"] = "waiting_for_modification_request"

            request_message = AIMessage(content=(
                "✏️ **스크립트 수정을 진행하겠습니다.**\n\n"
                "어떤 부분을 수정하시겠습니까?\n\n"
                "아래 가이드를 참고해 수정하고 싶은 내용을 구체적으로 알려주세요.\n\n"
                "**예시 가이드**\n"
                "- 특정 명령/로직을 추가하거나 제거해 주세요.\n"
                "- 출력 형식을 JSON/CSV 등으로 바꿔주세요.\n"
                "- 에러 처리(예: 실패 시 재시도, 로그 추가)를 강화해 주세요.\n"
                "- 변수/경로/계정을 다른 값으로 변경해 주세요."
            ))
            new_state["messages"].append(request_message)
            new_state["next"] = "FINISH"
            new_state["awaiting_user_response"] = True
            return new_state

        allow_next_step_navigation = not is_existing_task

        # 실행 대상 설정 요청 키워드 확인
        target_keywords = ["실행 대상", "실행대상", "노드 설정", "노드설정", "대상 설정", "대상설정", "다음 단계", "다음단계"]
        is_target_request = any(keyword in user_message for keyword in target_keywords)

        if not allow_next_step_navigation and (is_target_request or is_register_request):
            restriction_message = AIMessage(content=(
                "현재 선택한 태스크는 이미 등록된 상태입니다.\n\n"
                "Agent 모드에서는 **스크립트 수정** 또는 **스크립트 리뷰**만 요청할 수 있습니다.\n"
                "실행 대상 설정이나 태스크 등록은 태스크 상세 화면의 기본 기능을 이용해주세요."
            ))
            new_state["messages"].append(restriction_message)
            new_state["next"] = "FINISH"
            new_state["awaiting_user_response"] = True

            if "session_data" not in new_state:
                new_state["session_data"] = {}
            new_state["session_data"]["workflow_step"] = "ask_modification"

            return new_state

        # 노드 검색 단계로 바로 이동
        if allow_next_step_navigation and is_target_request:
            new_state["workflow_step"] = "search_nodes"

            request_message = AIMessage(content=get_workflow_system_message(
                "search_nodes",
                {"task_name": new_state.get("task_name", task_name)}
            ))
            new_state["messages"].append(request_message)
            new_state["next"] = "FINISH"
            new_state["awaiting_user_response"] = True

            # session_data에 워크플로우 상태 동기화
            if "session_data" not in new_state:
                new_state["session_data"] = {}
            new_state["session_data"]["workflow_step"] = "search_nodes"

            return new_state

        # 태스크 등록 요청이 있으면 태스크 등록 정보 반환
        if allow_next_step_navigation and is_register_request:
            return finalize_task_registration(new_state)

        # 구체적인 리뷰 요청이 있으면 스크립트 리뷰 수행 (완료 키워드보다 우선 처리)
        if is_review_request_intent and user_message and user_message.strip():
            new_state["review_request"] = user_message.strip()
            return perform_script_review(new_state)

        # 수정 요청이 있으면 스크립트 수정 (완료 키워드보다 우선 처리)
        if is_modification_request_intent and user_message and user_message.strip():
            new_state["modification_request"] = user_message.strip()
            if "session_data" not in new_state or not isinstance(new_state["session_data"], dict):
                new_state["session_data"] = {}
            new_state["session_data"]["modification_request"] = new_state["modification_request"]
            return modify_task_script(new_state)

        # 완료 키워드가 있으면 워크플로우 종료 (리뷰/수정 요청 후 처리)
        if is_completion_request:
            complete_message = AIMessage(content=(
                "스크립트 작성이 완료되었습니다.\n\n"
                "생성된 스크립트를 태스크 설정에 사용하실 수 있습니다."
            ))
            new_state["messages"].append(complete_message)
            new_state["next"] = "FINISH"
            new_state["workflow_step"] = "done"
            new_state["awaiting_user_response"] = False

            # session_data에 워크플로우 상태 동기화
            if "session_data" not in new_state:
                new_state["session_data"] = {}
            new_state["session_data"]["workflow_step"] = "done"

            return new_state

        # 일반적인 사용자 입력을 수정 요청으로 처리 (키워드가 없는 경우)
        if user_message and user_message.strip():
            new_state["modification_request"] = user_message.strip()
            if "session_data" not in new_state or not isinstance(new_state["session_data"], dict):
                new_state["session_data"] = {}
            new_state["session_data"]["modification_request"] = new_state["modification_request"]
            return modify_task_script(new_state)

    # 6단계: 노드 검색 단계
    if workflow_step == "search_nodes":
        return handle_node_search(new_state)

    # 6-1단계: 노드 검색 결과 없을 때 - 다시 검색 또는 다른 작업 선택
    if workflow_step == "search_nodes_or_other":
        # 사용자 입력 확인
        user_message_lower = user_message.lower()

        # 다시 검색
        search_keywords = ["다시 검색", "다시검색", "재검색", "검색", "1"]
        if any(keyword in user_message_lower for keyword in search_keywords):
            new_state["workflow_step"] = "search_nodes"
            return handle_node_search(new_state)

        # 태스크 등록
        register_keywords = ["태스크 등록", "태스크등록", "등록", "2"]
        if any(keyword in user_message_lower for keyword in register_keywords):
            return finalize_task_registration(new_state)

        # 스크립트 수정
        modify_keywords = [
            "스크립트 수정",
            "스크립트수정",
            "스크립트 업데이트",
            "스크립트업데이트",
            "수정",
            "수정 요청",
            "업데이트",
            "3"
        ]
        if any(keyword in user_message_lower for keyword in modify_keywords):
            new_state["workflow_step"] = "ask_modification"
            request_message = AIMessage(content=(
                "✏️ **스크립트 수정을 진행하겠습니다.**\n\n"
                "어떤 부분을 수정하시겠습니까?\n\n"
                "아래 가이드를 참고해 수정하고 싶은 내용을 구체적으로 알려주세요.\n\n"
                "**예시 가이드**\n"
                "- 특정 명령/로직을 추가하거나 제거해 주세요.\n"
                "- 출력 형식을 JSON/CSV 등으로 바꿔주세요.\n"
                "- 에러 처리(예: 실패 시 재시도, 로그 추가)를 강화해 주세요.\n"
                "- 변수/경로/계정을 다른 값으로 변경해 주세요."
            ))
            new_state["messages"].append(request_message)
            new_state["next"] = "FINISH"
            new_state["awaiting_user_response"] = True
            return new_state

        # 키워드가 아닌 일반 텍스트면 다시 검색으로 처리
        new_state["workflow_step"] = "search_nodes"
        return handle_node_search(new_state)

    # 9단계: 스케줄 정보 입력 단계 (우선 처리)
    print(f"[task_creation_wrapper] 현재 workflow_step: {workflow_step}")
    print(f"[task_creation_wrapper] 사용자 메시지: {user_message}")

    # workflow_step이 ask_schedule일 때만 스케줄 처리 - 다른 단계보다 먼저 확인
    if workflow_step == "ask_schedule":
        print(f"[task_creation_wrapper] ask_schedule 단계 처리 시작")
        user_input_lower = user_message.lower().strip()

        # 스케줄 없음 키워드 확인 (ask_schedule 단계에서만)
        skip_keywords = ["스케줄 없음", "스케줄없음", "skip", "생략", "안함", "없음"]
        is_skip_schedule = any(keyword in user_input_lower for keyword in skip_keywords)

        print(f"[task_creation_wrapper] 사용자 입력: {user_input_lower}")
        print(f"[task_creation_wrapper] 스케줄 없음 여부: {is_skip_schedule}")

        # 스케줄 없음 키워드 확인
        if is_skip_schedule:
            print(f"[task_creation_wrapper] 스케줄 없음 선택됨 - ask_save_task 단계로 이동")
            # 스케줄 없이 진행하는 경우 태스크 저장 여부를 묻는 단계로 이동
            ask_save_text = get_workflow_system_message(
                "ask_save_task",
                {"task_name": new_state.get("task_name", task_name)}
            )
            fallback_save_text = (
                "💾 **태스크를 저장 및 발행하시겠습니까?**\n\n"
                "- 저장 및 발행하려면: **\"예\"**, **\"저장\"**, **\"태스크 저장\"**\n"
                "- 저장하지 않으려면: **\"아니오\"**, **\"취소\"**\n"
            )
            ask_save_message = AIMessage(content=(
                "스케줄 없이 진행합니다.\n\n"
                "태스크 상세 화면에서 필요한 경우 추가 설정을 입력해 주세요.\n\n"
                f"{ask_save_text or fallback_save_text}"
            ))
            new_state["messages"].append(ask_save_message)
            new_state["next"] = "FINISH"
            new_state["workflow_step"] = "ask_save_task"
            new_state["awaiting_user_response"] = True

            # session_data에 워크플로우 상태 동기화
            if "session_data" not in new_state:
                new_state["session_data"] = {}
            new_state["session_data"]["workflow_step"] = "ask_save_task"

            print(f"[task_creation_wrapper] ask_save_task 단계 설정 완료")
            return new_state

        # 스케줄 정보 파싱
        schedule_info = parse_schedule_input(user_message)

        if schedule_info:
            print(f"[task_creation_wrapper] 스케줄 정보 파싱 성공: {schedule_info}")

            # 스케줄 정보를 프론트엔드로 전달
            new_state["schedule_info"] = schedule_info
            new_state["result_msg"] = "SCHEDULE_INFO_READY"

            # 스케줄 모드에 따른 설명 생성
            mode_descriptions = {
                "Daily": "매일",
                "Weekly": "매주",
                "Monthly": "매월",
                "Yearly": "매년",
                "Hourly": "매시간",
                "Once": "일회성"
            }
            mode_desc = mode_descriptions.get(schedule_info.get("mode", "Daily"), "매일")

            schedule_confirmed_message = AIMessage(content=(
                f"✅ **스케줄 정보가 설정되었습니다**\n\n"
                f"📅 **형식**: {mode_desc}\n"
                f"⏰ **시간**: {schedule_info.get('timePoint', 'N/A')}\n"
                f"🌍 **타임존**: {schedule_info.get('timeZone', 'N/A')}\n\n"
                f"모든 설정이 완료되었습니다! ✅\n\n"
                f"태스크 상세 화면의 스케줄 그리드에 자동으로 추가되었습니다.\n"
                f"💾 태스크를 저장 및 발행하시려면 **\"태스크 저장\"** 을 입력해주세요.\n"
            ))
            new_state["messages"].append(schedule_confirmed_message)
            new_state["next"] = "FINISH"
            new_state["workflow_step"] = "done"
            new_state["awaiting_user_response"] = True

            # session_data에 워크플로우 상태 동기화
            if "session_data" not in new_state:
                new_state["session_data"] = {}

            if "session_data" in state and isinstance(state["session_data"], dict):
                new_state["session_data"].update(state["session_data"])

            new_state["session_data"]["workflow_step"] = "done"
            new_state["session_data"]["schedule_info"] = schedule_info

            print(f"[task_creation_wrapper] 스케줄 정보 처리 완료, result_msg: SCHEDULE_INFO_READY")

            return new_state
        else:
            # 스케줄 파싱 실패
            error_message = AIMessage(content=(
                "스케줄 정보를 이해하지 못했습니다.\n\n"
                "다시 입력해주시거나 **스케줄 없음**을 선택해주세요.\n\n"
                "**예시:**\n"
                "- 매일 오전 9시: \"매일 09:00\"\n"
                "- 스케줄 없음: \"스케줄 없음\""
            ))
            new_state["messages"].append(error_message)
            new_state["next"] = "FINISH"
            new_state["awaiting_user_response"] = True
            return new_state

    # 7단계: 검색 결과에서 선택 단계
    if workflow_step == "select_from_search":
        return handle_node_selection_from_search(new_state)

    # 8단계: 태스크 등록 준비 완료 단계
    if workflow_step == "ready_to_register":
        # 태스크 등록 요청 확인
        if is_register_request:
            return finalize_task_registration(new_state)
        else:
            # 다시 안내
            request_message = AIMessage(content=(
                "태스크 등록을 진행하시겠습니까?\n\n"
                "**태스크 등록**을 입력해주세요."
            ))
            new_state["messages"].append(request_message)
            new_state["next"] = "FINISH"
            new_state["awaiting_user_response"] = True
            return new_state

    # 9-1단계: 태스크 및 노드 등록 확인 단계
    if workflow_step == "confirm_task_and_nodes":
        print(f"[task_creation_wrapper] confirm_task_and_nodes 단계 처리 시작")
        user_input_lower = user_message.lower().strip()

        # 확인 키워드
        confirm_keywords = ["예", "yes", "y", "확인", "ok"]
        cancel_keywords = ["아니오", "no", "n", "취소", "cancel"]

        if any(keyword in user_input_lower for keyword in confirm_keywords):
            print(f"[task_creation_wrapper] 태스크 및 노드 등록 확인됨")

            # session_data에서 노드 정보 가져오기
            nodes_to_add = new_state.get("session_data", {}).get("nodes_to_add", [])
            pending_node_count = new_state.get("session_data", {}).get("pending_node_count", 0)
            task_name = new_state.get("task_name", "")

            # result_msg를 REGISTER_TASK_WITH_NODES_CONFIRMED로 변경하여 실제 등록 진행
            new_state["result_msg"] = "REGISTER_TASK_WITH_NODES_CONFIRMED"
            new_state["nodes_to_add"] = nodes_to_add

            # 성공 메시지
            confirm_message = AIMessage(content=(
                f"✅ **태스크 등록이 완료되었습니다!**\n\n"
                f"📋 **태스크명**: {task_name}\n\n"
                f"**{pending_node_count}개 노드**를 실행 대상에 추가했습니다.\n\n"
                "이제 **스케줄 정보**를 설정하시겠습니까?\n\n"
                "**예시:**\n"
                "- 매일 오전 9시 실행: \"매일 09:00\"\n"
                "- 매주 월요일 오전 10시: \"매주 월요일 10:00\"\n"
                "- 매월 1일 오전 8시: \"매월 1일 08:00\"\n"
                "- 스케줄 없음: \"스케줄 없음\" 또는 \"skip\"\n\n"
                "스케줄을 입력해주시거나 스케줄 없음을 선택해주세요."
            ))
            new_state["messages"].append(confirm_message)

            # 스케줄 설정 단계로 이동
            new_state["workflow_step"] = "ask_schedule"
            new_state["awaiting_user_response"] = True
            new_state["next"] = "FINISH"

            # session_data에 워크플로우 상태 동기화
            if "session_data" not in new_state:
                new_state["session_data"] = {}
            new_state["session_data"]["workflow_step"] = "ask_schedule"

            print(f"[task_creation_wrapper] 태스크 및 노드 등록 완료, ask_schedule 단계로 이동")
            return new_state

        elif any(keyword in user_input_lower for keyword in cancel_keywords):
            # 취소
            cancel_message = AIMessage(content=(
                "태스크 및 노드 등록을 취소했습니다.\n\n"
                "필요하시면 다시 요청해주세요."
            ))
            new_state["messages"].append(cancel_message)
            new_state["next"] = "FINISH"
            new_state["workflow_step"] = "done"
            new_state["awaiting_user_response"] = False

            # session_data에 워크플로우 상태 동기화
            if "session_data" not in new_state:
                new_state["session_data"] = {}
            new_state["session_data"]["workflow_step"] = "done"

            return new_state

        else:
            # 올바르지 않은 입력
            retry_message = AIMessage(content=(
                "올바른 응답을 입력해주세요.\n\n"
                "태스크 및 노드 등록을 진행하시겠습니까?\n\n"
                "- 진행하려면: **\"예\"**\n"
                "- 취소하려면: **\"아니오\"**, **\"취소\"**\n"
            ))
            new_state["messages"].append(retry_message)
            new_state["next"] = "FINISH"
            new_state["awaiting_user_response"] = True
            return new_state

    # 10단계: 태스크 저장 여부 확인 단계 (스케줄 없음 선택 후)
    if workflow_step == "ask_save_task":
        print(f"[task_creation_wrapper] ask_save_task 단계 처리 시작")
        user_input_lower = user_message.lower().strip()

        # 저장 확인 키워드
        save_keywords = ["예", "yes", "y", "저장", "save", "태스크 저장", "태스크저장", "태스크 저장 및 발행"]
        cancel_keywords = ["아니오", "no", "n", "취소", "cancel"]

        if any(keyword in user_input_lower for keyword in save_keywords):
            print(f"[task_creation_wrapper] 태스크 저장 및 발행 선택됨 - workflow_step을 done으로 설정")

            # workflow_step을 "done"으로 변경하고 session_data에 저장
            new_state["workflow_step"] = "done"

            # session_data에 워크플로우 상태 동기화
            if "session_data" not in new_state:
                new_state["session_data"] = {}
            new_state["session_data"]["workflow_step"] = "done"

            # 태스크 저장 및 발행 이벤트 전송
            new_state["result_msg"] = "SAVE_TASK"

            save_message = AIMessage(content=(
                "💾 **태스크 저장 및 발행을 시작합니다...**\n\n"
                "태스크 상세 화면의 저장 및 발행 버튼을 자동으로 실행합니다.\n"
            ))
            new_state["messages"].append(save_message)
            new_state["next"] = "FINISH"
            new_state["awaiting_user_response"] = False

            print(f"[task_creation_wrapper] SAVE_TASK 이벤트 전송 완료")
            return new_state

        elif any(keyword in user_input_lower for keyword in cancel_keywords):
            # 저장하지 않고 종료
            cancel_message = AIMessage(content=(
                "태스크 저장을 취소했습니다.\n\n"
                "필요하신 경우 나중에 태스크 상세 화면에서 저장하실 수 있습니다.\n"
            ))
            new_state["messages"].append(cancel_message)
            new_state["next"] = "FINISH"
            new_state["workflow_step"] = "done"
            new_state["awaiting_user_response"] = False

            # session_data에 워크플로우 상태 동기화
            if "session_data" not in new_state:
                new_state["session_data"] = {}
            new_state["session_data"]["workflow_step"] = "done"

            return new_state

        else:
            # 올바르지 않은 입력
            retry_message = AIMessage(content=(
                "올바른 응답을 입력해주세요.\n\n"
                "💾 **태스크를 저장 및 발행하시겠습니까?**\n\n"
                "- 저장 및 발행하려면: **\"예\"**, **\"저장\"**\n"
                "- 저장하지 않으려면: **\"아니오\"**, **\"취소\"**\n"
            ))
            new_state["messages"].append(retry_message)
            new_state["next"] = "FINISH"
            new_state["awaiting_user_response"] = True
            return new_state

    # Fallback: task_name이 없으면 먼저 태스크명 요청
    if not task_name and not workflow_step:
        request_message = AIMessage(content=_get_task_name_request_message())
        new_state["messages"].append(request_message)
        new_state["next"] = "FINISH"
        new_state["awaiting_user_response"] = True
        new_state["workflow_step"] = "ask_name"

        # session_data에 워크플로우 상태 동기화
        if "session_data" not in new_state:
            new_state["session_data"] = {}
        new_state["session_data"]["workflow_step"] = "ask_name"

        return new_state

    # 그 외의 경우는 기존 상태 그대로 반환
    return new_state


# 모든 함수를 외부에 노출
__all__ = [
    'task_creation_wrapper',
    'generate_task_script',
    'modify_task_script',
    'perform_script_review',
    'handle_node_search',
    'handle_node_selection_from_search',
    'handle_manual_node_input',
    'finalize_task_registration'
]
