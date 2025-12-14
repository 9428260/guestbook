"""
Supervisor 에이전트 - 다음 실행할 agent를 결정
"""
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from ...common.config import get_llm
from ..models import AgentState

# 에이전트 멤버 및 옵션 정의
members = ["opmate", "task", "review", "edit"]
options = members + ["FINISH"]
options_for_next = ["FINISH"] + members

# Supervisor 시스템 프롬프트
sys_prompt = (
    "당신은 다음 작업자들 {members} 사이의 대화를 관리하는 Supervisor입니다. "
    "사용자의 요청이 들어오면 아래 규칙에 따라 적절한 Worker를 선택하세요. "
    "OPMATE 문서 검색이 필요한 경우 opmate를 사용하세요. "
    "태스크 실행/작성(태스크 실행, 태스크 작성, 태스크실행, 태스크작성) 요청 시 task를 사용하세요. "
    "노드 검색(노드 검색, 노드 찾기, 관리하는 노드, 담당 노드, 리눅스, 윈도우) 요청 시 task를 사용하세요. "
    "스크립트 리뷰(스크립트 리뷰, 스크립트리뷰) 요청 시 review를 사용하세요. "
    "스크립트 수정(스크립트 수정, 스크립트수정) 요청 시 edit을 사용하세요. "
    "각 Worker는 작업을 수행하고 결과(JSON)와 상태를 반환합니다. "
    "결과를 바탕으로 불명확한 부분이 있다면 반드시 명시하세요. "
    "그 다음 어떤 Worker가 실행해야 하는지 응답하세요. "
    "Worker 중복으로 호출하지 마세요. "
    "모든 작업이 완료되면 FINISH로 응답하세요."
)

# Supervisor 프롬프트 템플릿
supervisor_prompt = ChatPromptTemplate.from_messages(
    [
        ("system", sys_prompt),
        MessagesPlaceholder(variable_name="messages"),
        (
            "human",
            "Given the conversation above, who should act next? "
            "Or should we FINISH? Select one of: {options}",
        ),
    ]
).partial(options=str(options_for_next), members=", ".join(members))


def supervisor_node(state: AgentState):
    """Supervisor가 다음 실행할 agent를 결정"""
    messages = state["messages"]
    workflow_step = state.get("workflow_step", "")
    chat_mode = state.get("chat_mode", "agent")  # 기본값은 "agent"
    is_mode_changed = state.get("is_mode_changed", False)  # 모드 변경 여부
    llm = get_llm()

    print(f"supervisor - chat_mode: {chat_mode}, is_mode_changed: {is_mode_changed}, workflow_step: {workflow_step}")

    # 모드가 변경된 경우 Ask 모드로 검색을 진행하도록 우선 처리
    if is_mode_changed and chat_mode == "ask":
        print(f"supervisor - Mode changed to ASK, routing to search (bypassing workflow_step check)")
        # Ask 모드이므로 검색 에이전트로 라우팅
        # opmate가 OPMATE 문서 검색이므로 기본적으로 opmate로 라우팅
        return {"next": "opmate"}

    # 태스크 생성 워크플로우 중이면 무조건 task 에이전트로 라우팅
    # search_nodes, search_nodes_or_other, select_from_search도 포함 (노드 검색 처리)
    # ask_schedule, ask_save_task 단계도 포함 (스케줄 및 저장 여부 처리)
    if workflow_step in ["ask_name", "ask_os_type", "ask_requirements", "generate_script", "ask_modification", "waiting_for_modification_request", "search_nodes", "search_nodes_or_other", "select_from_search", "ask_schedule", "ask_save_task", "register_task", "ready_to_register"]:
        print(f"supervisor next : TASK (workflow_step={workflow_step})")
        return {"next": "task"}

    # 마지막 메시지를 기반으로 결정
    response = llm.invoke(supervisor_prompt.format_messages(messages=messages))

    # response.content에서 다음 agent 결정
    content = response.content.strip().upper()

    print("supervisor next :", content)
    print(f"chat_mode: {chat_mode}")

    # chat_mode에 따라 선택 가능한 노드가 다름
    if chat_mode == "agent":
        # Agent 모드: task, review, edit 노드만 선택 가능
        if "TASK" in content:
            next_agent = "task"
        elif "REVIEW" in content:
            next_agent = "review"
        elif "EDIT" in content:
            next_agent = "edit"
        else:
            next_agent = "FINISH"
    else:  # chat_mode == "ask"
        # Ask 모드: opmate 노드만 선택 가능
        # FINISH가 아니면 기본적으로 opmate로 라우팅
        if "FINISH" in content:
            next_agent = "FINISH"
        else:
            next_agent = "opmate"

    return {"next": next_agent}
