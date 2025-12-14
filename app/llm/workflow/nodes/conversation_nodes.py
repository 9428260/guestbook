"""
대화 입출력 노드
"""
from langchain_core.messages import AIMessage
from ..models import AgentState


def conversation_input_node(state: AgentState) -> AgentState:
    """사용자 입력을 처리하는 노드 - Supervisor로 라우팅"""
    new_state = state.copy()
    new_state["next"] = "supervisor"
    new_state["conversation_state"] = "active"
    return new_state


def conversation_output_node(state: AgentState) -> AgentState:
    """대화 결과를 포맷팅하고 출력하는 노드"""
    new_state = state.copy()

    # 응답이 없는 경우 기본 메시지
    if not new_state.get("result_msg") and not new_state.get("messages"):
        new_state["messages"] = [AIMessage(content="죄송합니다. 적절한 응답을 생성할 수 없었습니다.")]

    new_state["next"] = "FINISH"
    new_state["conversation_state"] = "completed"
    return new_state
