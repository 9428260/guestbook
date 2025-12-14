"""
태스크 등록 처리 모듈

태스크 등록 완료 및 관련 작업을 처리합니다.
"""

from langchain_core.messages import AIMessage
from ..models import AgentState


def finalize_task_registration(state: AgentState) -> AgentState:
    """
    최종 태스크 등록 정보를 생성하는 함수
    """
    # 처리 순서:
    # 1) 상태에 저장된 태스크/스크립트/노드 정보를 정규화한다.
    # 2) 실행 대상 유형(선택/전체/없음)에 따라 프론트엔드에 전달할 payload를 구성한다.
    # 3) 요약 메시지와 result_msg 플래그를 설정하고, 이어질 노드 검색 단계로 워크플로우를 전환한다.

    new_state = state.copy()

    # 필요한 정보 수집
    task_name = new_state.get("task_name", "")
    task_requirements = new_state.get("task_requirements", "")
    os_type = new_state.get("os_type", "Linux")
    script_content = new_state.get("script_content", "")
    selected_nodes = new_state.get("selected_nodes", [])

    # 스크립트 내용 정리
    import re
    # --- 스크립트 내용 정규화 ---
    if script_content and '```bash' in script_content:
        match = re.search(r'```bash\s*\n(.*?)```', script_content, re.DOTALL)
        if match:
            script_content = match.group(1).strip()
    elif script_content and '```powershell' in script_content:
        match = re.search(r'```powershell\s*\n(.*?)```', script_content, re.DOTALL)
        if match:
            script_content = match.group(1).strip()

    # 스크립트가 없으면 메시지에서 찾기
    if not script_content or not script_content.strip():
        messages = new_state.get("messages", [])
        for message in reversed(messages):
            content = ""
            if hasattr(message, 'content'):
                content = message.content
            elif isinstance(message, dict):
                content = message.get('content', '')

            if '```bash' in content:
                match = re.search(r'```bash\s*\n(.*?)```', content, re.DOTALL)
                if match:
                    script_content = match.group(1).strip()
                    break
            elif '```powershell' in content:
                match = re.search(r'```powershell\s*\n(.*?)```', content, re.DOTALL)
                if match:
                    script_content = match.group(1).strip()
                    break

    # --- 메타데이터 및 실행 대상 정리 ---
    # 스크립트 설명 생성
    script_description = f"{task_name} - {task_requirements}" if task_requirements else task_name

    # OS 타입 정보
    os_display = "윈도우 (PowerShell)" if os_type == "windows" else "리눅스 (Shell)"
    code_block_lang = "powershell" if os_type == "windows" else "bash"

    # 실행 대상 정보 생성
    target_info = ""
    if selected_nodes == "all_active":
        target_info = "모든 활성 노드"
        target_nodes_data = {"type": "all_active", "nodes": []}
    elif isinstance(selected_nodes, list) and selected_nodes:
        if len(selected_nodes) == 1:
            target_info = f"선택된 노드: {selected_nodes[0].get('node_name', 'Unknown')}"
        else:
            target_info = f"선택된 {len(selected_nodes)}개 노드"
        target_nodes_data = {"type": "selected", "nodes": selected_nodes}
    else:
        target_info = "실행 대상 미설정"
        target_nodes_data = {"type": "none", "nodes": []}

    # 디버깅 로그
    print(f"[finalize_task_registration] task_name: {task_name}")
    print(f"[finalize_task_registration] task_requirements: {task_requirements}")
    print(f"[finalize_task_registration] script_description: {script_description}")
    print(f"[finalize_task_registration] os_type: {os_type}")
    print(f"[finalize_task_registration] target_info: {target_info}")
    print(f"[finalize_task_registration] selected_nodes count: {len(selected_nodes) if isinstance(selected_nodes, list) else 'all_active' if selected_nodes == 'all_active' else 0}")

    # --- 사용자 안내 메시지 및 상태 갱신 ---
    new_state["result_msg"] = "REGISTER_TASK"  # 특수 플래그
    new_state["script_description"] = script_description
    new_state["os_type"] = os_type
    new_state["target_nodes"] = target_nodes_data  # 실행 대상 정보 추가

    print(f"[finalize_task_registration] selected_nodes 값: {selected_nodes}")
    print(f"[finalize_task_registration] selected_nodes 타입: {type(selected_nodes)}")
    print(f"[finalize_task_registration] 태스크 등록 후 → 스케줄 설정 단계로 이동")

    new_state["next"] = "FINISH"

    if "session_data" not in new_state:
        new_state["session_data"] = {}
    new_state["session_data"]["workflow_step"] = "register_task_confirmed"
    new_state["session_data"]["task_registered"] = True
    new_state["workflow_step"] = "register_task_confirmed"
    new_state["awaiting_user_response"] = True

    return new_state
