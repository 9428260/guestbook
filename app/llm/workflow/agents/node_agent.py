"""
노드 검색 에이전트
"""
from langgraph.prebuilt import create_react_agent
from ...common.config import get_llm
from ..tools.node_tools import node_search_tool, get_node_search_system_prompt


def create_node_search_agent():
    """
    노드 검색 Agent를 동적으로 생성합니다 (로그인 사용자 정보 포함).
    """
    llm = get_llm()
    if llm is None:
        raise RuntimeError("LLM을 초기화할 수 없습니다. AWS 자격증명을 확인해주세요.")
    prompt = get_node_search_system_prompt()
    return create_react_agent(
        model=llm,
        tools=[node_search_tool],
        prompt=prompt,
        name="node_search_agent"
    )


# 노드 검색 전용 Agent (지연 초기화)
_node_search_agent = None

def get_node_search_agent():
    """노드 검색 에이전트를 지연 초기화하여 반환"""
    global _node_search_agent
    if _node_search_agent is None:
        _node_search_agent = create_node_search_agent()
    return _node_search_agent

node_search_agent = get_node_search_agent
