"""
LangGraph 그래프 빌더
"""
from langgraph.graph import START, StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from .models import AgentState
from .agents.supervisor import supervisor_node, members
from .agents.opmate_agent import opmate_assistant
from .agents.script_agents import edit_assistant, review_assistant
from .nodes.conversation_nodes import conversation_input_node, conversation_output_node
from .nodes.task_nodes import task_creation_wrapper


def build_graph():
    """LangGraph만 사용하는 간소화된 그래프 빌더"""
    builder = StateGraph(AgentState)

    # 노드 추가
    builder.add_node("supervisor", supervisor_node)
    builder.add_node("opmate", opmate_assistant)
    builder.add_node("task", task_creation_wrapper)
    builder.add_node("review", review_assistant)
    builder.add_node("edit", edit_assistant)
    builder.add_node("conversation_input", conversation_input_node)
    builder.add_node("conversation_output", conversation_output_node)

    # 에이전트들은 대화 출력으로 연결
    for member in members:
        builder.add_edge(member, "conversation_output")

    # 대화 출력은 종료로 연결
    builder.add_edge("conversation_output", END)

    # 조건부 라우팅 설정
    conditional_map = {k: k for k in members}
    conditional_map["FINISH"] = "conversation_output"

    def get_next(state):
        next_node = state.get("next", "FINISH")
        return next_node

    def get_conversation_next(state):
        next_node = state.get("next", "supervisor")
        return next_node

    # 라우팅 설정
    builder.add_conditional_edges("supervisor", get_next, conditional_map)
    builder.add_conditional_edges("conversation_input", get_conversation_next, {
        "supervisor": "supervisor"
    })

    # 진입점을 대화 입력으로 설정
    builder.add_edge(START, "conversation_input")

    graph = builder.compile(checkpointer=MemorySaver())
    return graph
