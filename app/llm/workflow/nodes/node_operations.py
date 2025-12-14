"""
노드 검색 및 선택 작업 처리 모듈

노드 검색, 검색 결과 선택, 수동 노드 입력 등 노드와 관련된 모든 작업을 처리합니다.
"""

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from ..models import AgentState
from ..agents.node_agent import create_node_search_agent
from ..workflow_messages import get_workflow_system_message

REGISTERED_WORKFLOW_STEPS = {
    "register_task",
    "register_task_confirmed",
    "ask_schedule",
    "done",
}


def _ensure_session_data(state: AgentState) -> dict:
    """state에 session_data dict가 있도록 보장"""
    session_data = state.get("session_data")
    if not isinstance(session_data, dict):
        session_data = {}
        state["session_data"] = session_data
    return session_data


def _normalize_task_id(value) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def _is_task_already_registered(state: AgentState) -> bool:
    """
    기존 태스크 여부 또는 직전에 등록이 완료된 상태인지 판단
    """
    session_data = _ensure_session_data(state)
    candidates = [
        state.get("task_id", ""),
        session_data.get("existing_task_id", ""),
        session_data.get("task_id", ""),
    ]

    normalized_id = ""
    for candidate in candidates:
        candidate_str = _normalize_task_id(candidate)
        if candidate_str:
            normalized_id = candidate_str
            break

    has_existing_id = bool(normalized_id)
    task_registered_flag = bool(session_data.get("task_registered"))
    is_existing_task_flag = bool(session_data.get("is_existing_task"))

    already_registered = has_existing_id or task_registered_flag or is_existing_task_flag

    if already_registered:
        if normalized_id:
            session_data["existing_task_id"] = normalized_id
            state["task_id"] = normalized_id
        session_data["task_registered"] = True

    return already_registered


def handle_node_search(state: AgentState) -> AgentState:
    """
    노드 검색을 처리하는 함수 - LLM Agent가 직접 도구를 호출
    """
    # 처리 순서:
    # 1) 사용자의 자연어 검색어를 node_search_agent에 전달하여 파라미터 추출 및 도구 실행을 위임한다.
    # 2) Agent 응답에서 실제 호출된 검색 파라미터와 결과 JSON을 복원한다.
    # 3) 검색 결과를 정제하여 사용자에게 보여주고, 상태/session_data에 결과를 저장한다.

    new_state = state.copy()
    user_message = new_state.get("user_message", "").strip()

    try:
        # --- 검색 Agent 초기화 ---
        # 현재 로그인 사용자 정보를 포함한 agent를 동적으로 생성
        current_node_search_agent = create_node_search_agent()

        # node_search_agent를 사용하여 LLM이 직접 파라미터를 추출하고 도구 호출
        agent_input = {
            "messages": [HumanMessage(content=user_message)]
        }

        # Agent 실행
        print(f"[handle_node_search] Agent 실행 시작 - 사용자 메시지: {user_message}")
        agent_response = current_node_search_agent.invoke(agent_input)
        print(f"[handle_node_search] Agent 실행 완료")
        print(f"[handle_node_search] agent_response 타입: {type(agent_response)}")
        print(f"[handle_node_search] agent_response keys: {agent_response.keys() if isinstance(agent_response, dict) else 'not dict'}")

        # --- Agent 응답 파싱 ---
        # LangChain 메시지 배열에서 tool 호출 이력과 마지막 안내 메시지를 추출한다.
        search_params = {}  # 검색 파라미터 저장용
        search_result = ""

        if "messages" in agent_response and len(agent_response["messages"]) > 0:
            print(f"[handle_node_search] agent_response에 {len(agent_response['messages'])}개의 메시지 발견")
            tool_result_found = False
            # tool_calls에서 실제 호출된 파라미터 추출
            for message in agent_response["messages"]:
                if hasattr(message, 'tool_calls') and message.tool_calls:
                    for tool_call in message.tool_calls:
                        if tool_call.get('name') == 'search_nodes':
                            # tool_call args에서 파라미터 추출
                            tool_args = tool_call.get('args', {})
                            search_params = {
                                'operator': tool_args.get('operator', ''),
                                'os_type': tool_args.get('os_type', ''),
                                'hostname': tool_args.get('hostname', ''),
                                'status': tool_args.get('status', ''),
                                'customer': tool_args.get('customer', ''),
                                'os_name': tool_args.get('os_name', ''),
                                'os_version': tool_args.get('os_version', ''),
                                'use_regexp': tool_args.get('use_regexp', False),
                                'page': tool_args.get('page', 1),
                                'per_page': tool_args.get('per_page', 20)
                            }
                            print(f"[handle_node_search] 추출된 검색 파라미터: {search_params}")
                            break
                # ToolMessage에서 실제 검색 결과 JSON 추출
                if isinstance(message, ToolMessage) and getattr(message, "name", "") == "search_nodes":
                    tool_content = message.content
                    if isinstance(tool_content, list):
                        extracted_parts = []
                        for part in tool_content:
                            if isinstance(part, dict) and "text" in part:
                                extracted_parts.append(part["text"])
                            else:
                                extracted_parts.append(str(part))
                        tool_content = "".join(extracted_parts)
                    if isinstance(tool_content, str):
                        search_result = tool_content.strip()
                    else:
                        # JSON 또는 기타 타입인 경우 문자열로 직렬화
                        import json as _json
                        search_result = _json.dumps(tool_content, ensure_ascii=False)
                    tool_result_found = True
                    print("[handle_node_search] ToolMessage에서 search_nodes 결과를 추출했습니다.")

            # ToolMessage에서 결과를 찾지 못한 경우 마지막 메시지로 대체
            if not tool_result_found:
                last_message = agent_response["messages"][-1]
                if hasattr(last_message, 'content'):
                    search_result = last_message.content
                else:
                    search_result = str(last_message)
        else:
            search_result = str(agent_response)

        # --- 검색 결과 JSON 추출 ---
        # 일부 응답은 서술형 텍스트와 JSON이 섞여있으므로 정규식으로 JSON 부분을 추출한다.
        import json
        import re

        # JSON 부분 추출 시도
        json_match = re.search(r'\{.*\}', search_result, re.DOTALL)
        if json_match:
            search_result = json_match.group()

        print(f"[handle_node_search] JSON 추출 후 search_result: {search_result[:200] if search_result else 'None'}")
        print(f"[handle_node_search] 최종 search_params: {search_params}")

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"[handle_node_search] Agent 실행 중 오류 발생:")
        print(error_details)

        error_content = get_workflow_system_message(
            "node_search_generic_error",
            {"error_detail": str(e)}
        ) or (
            f"노드 검색 중 오류가 발생했습니다: {str(e)}\n\n"
            "다시 시도해주시거나 다른 방법을 선택해주세요."
        )
        error_message = AIMessage(content=error_content)
        new_state["messages"].append(error_message)
        new_state["next"] = "FINISH"
        new_state["workflow_step"] = "ask_target"
        new_state["awaiting_user_response"] = True
        return new_state

    try:

        # --- 검색 결과 파싱 및 사용자 응답 구성 ---
        import json
        try:
            print(f"[handle_node_search] search_result 타입: {type(search_result)}")
            print(f"[handle_node_search] search_result 길이: {len(search_result) if search_result else 0}")
            print(f"[handle_node_search] search_result 내용: {search_result[:500] if search_result else 'None'}")

            # search_result가 비어있는 경우 처리
            if not search_result or search_result.strip() == "":
                print(f"[handle_node_search] search_result가 비어있음")
                error_content = get_workflow_system_message("node_search_result_missing") or (
                    "노드 검색 결과를 가져올 수 없습니다.\n\n"
                    "검색 조건을 다시 입력해주세요."
                )
                error_message = AIMessage(content=error_content)
                new_state["messages"].append(error_message)
                new_state["next"] = "FINISH"
                new_state["workflow_step"] = "search_nodes"
                new_state["awaiting_user_response"] = True
                return new_state

            result_data = json.loads(search_result)
            nodes = result_data.get("nodeList", [])

            if not nodes:
                no_result_content = get_workflow_system_message(
                    "node_search_no_match_options",
                    {"user_request": user_message}
                ) or (
                    f"검색 조건에 맞는 노드가 없습니다.\n\n"
                    f"**사용자 요청:** {user_message}\n\n"
                    "다음 중 하나를 선택해주세요:\n\n"
                    "1. **1 다시 검색** - 다른 검색 조건으로 노드 검색\n"
                    "2. **2 태스크 등록** - 현재 스크립트로 태스크 등록 (노드는 나중에 설정)\n"
                    "3. **3 스크립트 수정** - 스크립트 내용 수정\n\n"
                    "선택하시거나 새로운 검색 조건을 바로 입력해주세요."
                )
                no_result_message = AIMessage(content=no_result_content)
                new_state["messages"].append(no_result_message)
                new_state["next"] = "FINISH"
                new_state["workflow_step"] = "search_nodes_or_other"  # 다시 검색 또는 다른 작업 선택
                new_state["awaiting_user_response"] = True

                # session_data에 워크플로우 상태 동기화
                if "session_data" not in new_state:
                    new_state["session_data"] = {}
                new_state["session_data"]["workflow_step"] = "search_nodes_or_other"

                return new_state

            # 검색 결과 표시
            node_list = []
            for i, node in enumerate(nodes[:10], 1):  # 최대 10개만 표시
                node_info = (
                    f"{i}. Hostname: **{node.get('hostname', 'Unknown')}**"
                    f" , OS 종류: {node.get('osType', 'N/A')}"
                    f" , IP 주소: {node.get('remoteAddr', 'N/A')}"
                )
                node_list.append(node_info)

            node_list_text = "\n\n".join(node_list)
            result_content = get_workflow_system_message(
                "node_search_results_summary",
                {
                    "node_count": len(nodes),
                    "node_list": node_list_text,
                },
            ) or (
                f"**검색 결과** ({len(nodes)}개 노드 발견)\n\n"
                + "\n\n".join(node_list)
                + "\n\n"
                "실행 대상 정보를 추가해 드릴까요? 예 또는 추가를 입력해 주세요.\n\n"
                "실행 대상 정보 추가를 원치 않으시면 아니오 또는 취소를 입력해 주세요.\n\n"
                "💡 **참고**: 실행 대상 추가 시 태스크가 등록되어 있지 않으면 태스크도 함께 등록됩니다.\n"
            )
            result_message = AIMessage(content=result_content)

            new_state["messages"].append(result_message)
            new_state["search_results"] = search_params  # 검색 파라미터 저장 (변경됨)

            # session_data에 명시적으로 저장 (체크포인트 복원 시 대비)
            if "session_data" not in new_state:
                new_state["session_data"] = {}
            if not isinstance(new_state["session_data"], dict):
                new_state["session_data"] = {}
            new_state["session_data"]["search_results"] = search_params  # 검색 파라미터 저장 (변경됨)
            new_state["session_data"]["search_result_nodes"] = nodes  # 실제 노드 데이터 저장 (추가됨)
            new_state["session_data"]["last_search_query"] = user_message

            # 프론트엔드에 검색 결과를 직접 전달하기 위한 플래그 설정
            new_state["result_msg"] = "SEARCH_RESULTS_READY"
            new_state["nodes_to_add"] = nodes  # 프론트엔드로 직접 전달 (노드 데이터는 유지)

            print(f"[handle_node_search] search_results 저장 완료: 검색 파라미터 {search_params}")
            print(f"[handle_node_search] session_data 저장: {list(new_state['session_data'].keys())}")
            print(f"[handle_node_search] result_msg=SEARCH_RESULTS_READY 설정")

            new_state["next"] = "FINISH"
            new_state["workflow_step"] = "select_from_search"
            new_state["awaiting_user_response"] = True

            # session_data에 워크플로우 상태 동기화
            if "session_data" not in new_state:
                new_state["session_data"] = {}
            new_state["session_data"]["workflow_step"] = "select_from_search"

            return new_state

        except json.JSONDecodeError as je:
            import traceback
            error_details = traceback.format_exc()
            print(f"[handle_node_search] JSON 파싱 오류 발생:")
            print(error_details)
            print(f"[handle_node_search] search_result 내용: {search_result}")

            error_content = get_workflow_system_message(
                "node_search_parse_error",
                {"error_detail": str(je)}
            ) or (
                f"노드 검색 중 오류가 발생했습니다.\n\n"
                f"검색 결과를 파싱할 수 없습니다: {str(je)}\n\n"
                "다시 시도해주시거나 다른 방법을 선택해주세요."
            )
            error_message = AIMessage(content=error_content)
            new_state["messages"].append(error_message)
            new_state["next"] = "FINISH"
            new_state["workflow_step"] = "ask_target"
            new_state["awaiting_user_response"] = True
            return new_state

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"[handle_node_search] 결과 처리 중 오류 발생:")
        print(error_details)

        error_content = get_workflow_system_message(
            "node_search_generic_error",
            {"error_detail": str(e)}
        ) or (
            f"노드 검색 중 오류가 발생했습니다: {str(e)}\n\n"
            "다시 시도해주시거나 다른 방법을 선택해주세요."
        )
        error_message = AIMessage(content=error_content)
        new_state["messages"].append(error_message)
        new_state["next"] = "FINISH"
        new_state["workflow_step"] = "ask_target"
        new_state["awaiting_user_response"] = True
        return new_state


def handle_node_selection_from_search(state: AgentState) -> AgentState:
    """
    검색 결과에서 노드 선택을 처리하는 함수
    """
    # 처리 순서:
    # 1) session_data, 메시지 히스토리 등에서 최신 검색 결과를 복원한다.
    # 2) 사용자 입력(예/전체/번호/새 검색)에 따라 실행 대상 노드를 결정하거나 재검색으로 분기한다.
    # 3) 선택된 노드가 있으면 태스크 등록 및 스케줄 단계로 이어지도록 상태를 조정한다.

    # 이 함수는 task_registration 모듈의 함수를 import해야 하므로
    # 순환 참조를 피하기 위해 함수 내에서 import합니다.
    from .task_registration import finalize_task_registration

    new_state = state.copy()

    # workflow_step이 이미 다른 단계로 진행된 경우 이 함수를 실행하지 않음
    current_workflow_step = new_state.get("workflow_step", "")
    if current_workflow_step not in ["select_from_search", ""]:
        print(f"[handle_node_selection_from_search] workflow_step이 {current_workflow_step}이므로 건너뜀")
        return new_state

    user_message = new_state.get("user_message", "").strip().lower()

    def _build_schedule_message(count: int) -> AIMessage:
        schedule_prompt = get_workflow_system_message(
            "ask_schedule",
            {"task_name": new_state.get("task_name", "")},
        ) or get_workflow_system_message("schedule_prompt_fallback") or (
            "이제 **스케줄 정보를 설정**해보겠습니다.\n\n"
            "원하는 실행 주기와 시간을 입력해주세요.\n"
            "- 매일 오전 9시에 실행: \"매일 09:00\"\n"
            "- 매주 월요일 오전 10시에 실행: \"매주 월요일 10:00\"\n"
            "- 일회성 실행: \"2025-01-15 18:30\"\n"
            "- 스케줄 없이 진행: \"스케줄 없음\" 또는 \"skip\""
        )
        message_content = get_workflow_system_message(
            "nodes_added_schedule_prompt",
            {"selected_count": count, "schedule_prompt": schedule_prompt},
        ) or (
            "실행 대상이 설정되었습니다! ✅\n\n"
            f"**{count}개 노드**를 실행 대상에 반영했습니다.\n\n"
            f"{schedule_prompt}"
        )
        return AIMessage(content=message_content)

    # search_results는 이제 검색 파라미터를 저장하므로, 실제 노드 데이터는 session_data에서 가져옴
    search_results = []  # 실제 노드 데이터를 저장할 변수
    search_params = new_state.get("search_results", {})  # 검색 파라미터

    print(f"[handle_node_selection_from_search] user_message: {user_message}")
    print(f"[handle_node_selection_from_search] search_params: {search_params}")
    print(f"[handle_node_selection_from_search] state keys: {list(state.keys())}")

    # session_data에서 실제 노드 데이터를 가져오는 시도
    session_data = new_state.get("session_data", {})
    print(f"[handle_node_selection_from_search] session_data 타입: {type(session_data)}")
    print(f"[handle_node_selection_from_search] session_data keys: {list(session_data.keys()) if isinstance(session_data, dict) else 'not dict'}")

    # --- session_data 기반 검색 결과 복원 ---
    if isinstance(session_data, dict) and "search_result_nodes" in session_data:
        search_results = session_data["search_result_nodes"]
        print(f"[handle_node_selection_from_search] session_data에서 search_result_nodes 복원: {len(search_results)}개")
    elif isinstance(session_data, dict) and "search_results" in session_data:
        # 하위 호환성: 이전 버전에서는 search_results에 노드 데이터가 저장되어 있을 수 있음
        temp_data = session_data["search_results"]
        if isinstance(temp_data, list) and len(temp_data) > 0 and isinstance(temp_data[0], dict) and 'hostname' in temp_data[0]:
            # 노드 데이터인 경우
            search_results = temp_data
            print(f"[handle_node_selection_from_search] session_data의 search_results에서 노드 데이터 복원: {len(search_results)}개")

    # 메시지 히스토리에서 검색 결과를 찾는 시도
    # --- 검색 결과 유실 시 재검색 유도 ---
    if not search_results:
        messages = new_state.get("messages", [])
        # 최근 메시지들에서 검색 결과를 찾음
        for msg in reversed(messages):
            if hasattr(msg, 'tool_calls') and msg.tool_calls:
                for tool_call in msg.tool_calls:
                    if tool_call.get('name') == 'search_nodes':
                        # tool_call 결과를 확인
                        if 'result' in tool_call:
                            import json
                            try:
                                result_data = json.loads(tool_call['result'])
                                search_results = result_data.get("nodeList", [])
                                if search_results:
                                    new_state["search_results"] = search_results
                                    print(f"[handle_node_selection_from_search] tool_calls에서 search_results 복원: {len(search_results)}개")
                                    break
                            except:
                                pass
            if search_results:
                break

    # 여전히 없으면 사용자에게 다시 검색 요청
    if not search_results:
        print(f"[handle_node_selection_from_search] search_results 없음, 검색 결과가 없습니다")

        error_content = get_workflow_system_message("node_selection_missing_results") or (
            "검색 결과를 찾을 수 없습니다.\n\n"
            "노드를 다시 검색해주세요. 예를 들어:\n"
            "- 내가 관리하는 리눅스 노드 검색\n"
            "- 윈도우 서버 검색\n"
            "- 특정 IP로 시작하는 노드 찾기\n\n"
            "검색 조건을 입력해주시면 다시 검색하겠습니다."
        )
        error_message = AIMessage(content=error_content)
        new_state["messages"].append(error_message)
        new_state["next"] = "FINISH"
        new_state["workflow_step"] = "search_nodes"  # 다시 검색 모드로 전환
        new_state["awaiting_user_response"] = True
        return new_state

    # "예", "추가" 키워드 확인 - 모든 검색 결과를 실행 대상에 추가
    # --- 전체 추가 처리 ---
    affirmative_keywords = ["예", "추가", "yes", "y", "ok", "확인"]
    negative_keywords = ["아니오", "아니요", "no", "n", "취소", "cancel"]

    if any(keyword in user_message for keyword in affirmative_keywords):
        new_state["selected_nodes"] = search_results
        selected_count = len(search_results)

        # session_data에도 명시적으로 저장
        if "session_data" not in new_state:
            new_state["session_data"] = {}
        new_state["session_data"]["selected_nodes"] = search_results

        # search_results는 검색 파라미터를 유지 (변경하지 않음)
        # selected_nodes에만 노드 데이터 저장

        print(f"[handle_node_selection_from_search] {selected_count}개 노드 선택, result_msg=ADD_NODES 설정")

        # 현재 workflow_step 확인
        current_workflow_step = new_state.get("workflow_step", "")
        # 태스크가 등록되어 있는지 확인
        task_already_registered = _is_task_already_registered(new_state)
        if not task_already_registered and current_workflow_step in REGISTERED_WORKFLOW_STEPS:
            task_already_registered = True
            _ensure_session_data(new_state)["task_registered"] = True

        print(
            "[handle_node_selection_from_search] task_id: "
            f"{new_state.get('task_id', '')}, task_already_registered: {task_already_registered}"
        )

        if not task_already_registered:
            # 태스크가 등록되어 있지 않으면 사용자에게 확인 요청
            print(f"[handle_node_selection_from_search] 태스크가 등록되어 있지 않아 사용자 확인 요청")

            # finalize_task_registration 호출하여 태스크 등록 준비
            new_state = finalize_task_registration(new_state)

            # 노드 정보도 함께 추가되도록 설정
            new_state["result_msg"] = "REGISTER_TASK_WITH_NODES"  # 태스크와 노드 함께 등록 플래그
            new_state["nodes_to_add"] = search_results  # 프론트엔드로 노드 전달

            # 워크플로우 상태를 "대기 중"으로 설정 (사용자 확인 필요)
            new_state["workflow_step"] = "confirm_task_and_nodes"
            new_state["awaiting_user_response"] = True
            new_state["next"] = "FINISH"

            # session_data에 노드 정보와 워크플로우 상태 저장
            if "session_data" not in new_state:
                new_state["session_data"] = {}
            new_state["session_data"]["workflow_step"] = "confirm_task_and_nodes"
            new_state["session_data"]["selected_nodes"] = search_results
            new_state["session_data"]["nodes_to_add"] = search_results
            new_state["session_data"]["pending_node_count"] = selected_count

            print(f"[handle_node_selection_from_search] 태스크 및 노드 등록 확인 대기 중: {selected_count}개 노드")

            return new_state

        # 노드 추가 메시지 - 제거됨 (중복 메시지 방지)

        # workflow_step이 ask_target인 경우 스케줄 등록으로 자동 진행
        if current_workflow_step == "ask_target":
            print(f"[handle_node_selection_from_search] workflow_step이 ask_target이므로 스케줄 등록으로 이동")

            # 스케줄 등록 안내 메시지
            schedule_message = _build_schedule_message(selected_count)
            new_state["messages"].append(schedule_message)

            new_state["workflow_step"] = "ask_schedule"
            new_state["awaiting_user_response"] = True

            # session_data에 워크플로우 상태 동기화
            if "session_data" not in new_state:
                new_state["session_data"] = {}
            new_state["session_data"]["workflow_step"] = "ask_schedule"
        else:
            # ask_target가 아닌 경우에도 스케줄 단계로 이동
            print(f"[handle_node_selection_from_search] workflow_step이 {current_workflow_step}이므로 ask_schedule로 이동")
            new_state["workflow_step"] = "ask_schedule"
            new_state["awaiting_user_response"] = True

            # 스케줄 등록 안내 메시지 추가
            schedule_message = _build_schedule_message(selected_count)
            new_state["messages"].append(schedule_message)

            # session_data에 워크플로우 상태 동기화
            if "session_data" not in new_state:
                new_state["session_data"] = {}
            new_state["session_data"]["workflow_step"] = "ask_schedule"

        new_state["next"] = "FINISH"
        new_state["result_msg"] = "ADD_NODES"  # 프론트엔드에 노드 추가 이벤트 전송을 위한 플래그
        new_state["nodes_to_add"] = search_results  # 프론트엔드로 노드 전달

        # session_data에도 selected_nodes 저장
        if "session_data" not in new_state:
            new_state["session_data"] = {}
        new_state["session_data"]["selected_nodes"] = search_results

        print(f"[handle_node_selection_from_search] 노드 추가 완료: {selected_count}개")

        return new_state

    if any(keyword in user_message for keyword in negative_keywords):
        print("[handle_node_selection_from_search] 사용자 입력으로 노드 추가 거절 - 재검색 단계로 이동")
        search_prompt = get_workflow_system_message(
            "search_nodes",
            {"task_name": new_state.get("task_name", "")},
        ) or get_workflow_system_message("node_search_prompt_fallback") or (
            "실행할 노드 검색 조건을 입력해주세요:\n\n"
            "- 내가 관리하는 리눅스 노드\n"
            "- 운영중인 웹서버 노드\n"
            "- 전체 노드"
        )
        decline_content = get_workflow_system_message(
            "node_selection_decline",
            {"search_prompt": search_prompt},
        ) or (
            "실행 대상 정보 추가를 취소했습니다.\n\n"
            f"{search_prompt}"
        )
        decline_message = AIMessage(content=decline_content)
        new_state["messages"].append(decline_message)
        new_state["next"] = "FINISH"
        new_state["workflow_step"] = "search_nodes"
        new_state["awaiting_user_response"] = True

        if "session_data" not in new_state:
            new_state["session_data"] = {}
        new_state["session_data"]["workflow_step"] = "search_nodes"

        return new_state

    new_state["workflow_step"] = "search_nodes"
    return handle_node_search(new_state)



def handle_manual_node_input(state: AgentState) -> AgentState:
    """
    수동 노드 입력을 처리하는 함수
    """
    # 처리 순서:
    # 1) 사용자가 직접 입력한 노드 식별자를 파싱하여 간단한 노드 객체로 변환한다.
    # 2) 입력이 유효하면 선택된 노드 목록과 다음 단계 안내 메시지를 구성한다.
    # 3) 잘못된 입력에는 가이드 메시지를 제공하고 동일 단계로 유지한다.

    new_state = state.copy()
    user_message = new_state.get("user_message", "").strip()

    if not user_message:
        prompt_content = get_workflow_system_message("manual_node_input_prompt") or (
            "노드 정보를 입력해주세요.\n\n"
            "**입력 형식:**\n"
            "- 노드 ID: NODE001, NODE002\n"
            "- IP 주소: 192.168.1.10, 192.168.1.20\n"
            "- 혼합: NODE001, 192.168.1.20"
        )
        error_message = AIMessage(content=prompt_content)
        new_state["messages"].append(error_message)
        new_state["next"] = "FINISH"
        new_state["awaiting_user_response"] = True
        return new_state

    # 입력 파싱
    node_inputs = [item.strip() for item in user_message.split(',')]
    selected_nodes = []

    for node_input in node_inputs:
        if node_input:
            # 간단한 노드 정보 객체 생성
            node_info = {
                "node_id": node_input,
                "node_name": node_input,
                "ip_address": node_input if '.' in node_input else "N/A",
                "node_type": "manual",
                "status": "manual"
            }
            selected_nodes.append(node_info)

    if selected_nodes:
        new_state["selected_nodes"] = selected_nodes

        node_list_text = "\n".join([f"- {node['node_name']}" for node in selected_nodes])
        confirm_content = get_workflow_system_message(
            "manual_node_input_confirmation",
            {"node_count": len(selected_nodes), "node_list": node_list_text},
        ) or (
            f"**수동 입력된 노드** ({len(selected_nodes)}개):\n\n"
            f"{node_list_text}\n\n"
            "태스크 등록을 진행하시겠습니까?\n"
            "**태스크 등록**을 입력해주세요."
        )
        confirm_message = AIMessage(content=confirm_content)
        new_state["messages"].append(confirm_message)
        new_state["next"] = "FINISH"
        new_state["workflow_step"] = "ready_to_register"
        new_state["awaiting_user_response"] = True

        # session_data에 워크플로우 상태 동기화
        if "session_data" not in new_state:
            new_state["session_data"] = {}
        new_state["session_data"]["workflow_step"] = "ready_to_register"

        return new_state
    else:
        error_content = get_workflow_system_message("manual_node_input_invalid") or (
            "올바른 노드 정보를 입력해주세요.\n\n"
            "쉼표(,)로 구분하여 노드 ID나 IP 주소를 입력해주세요."
        )
        error_message = AIMessage(content=error_content)
        new_state["messages"].append(error_message)
        new_state["next"] = "FINISH"
        new_state["awaiting_user_response"] = True
        return new_state
