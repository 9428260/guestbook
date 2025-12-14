"""
OPMATE 매뉴얼 검색 에이전트
"""
from langgraph.prebuilt import create_react_agent
from ...common.config import get_llm
from ..tools.qdrant_tools import qdrant_tool, OPMATE_SYSTEM_PROMPT


# Opmate 어시스턴트 (지연 초기화)
_opmate_assistant = None

def _get_opmate_assistant():
    """Opmate 어시스턴트를 지연 초기화하여 반환"""
    global _opmate_assistant
    if _opmate_assistant is None:
        llm = get_llm()
        if llm is None:
            raise RuntimeError("LLM을 초기화할 수 없습니다. AWS 자격증명을 확인해주세요.")
        _opmate_assistant = create_react_agent(
            model=llm,
            tools=[qdrant_tool],
            prompt=OPMATE_SYSTEM_PROMPT,
            name="search_assistant"
        )
    return _opmate_assistant

def opmate_assistant(state):
    """Opmate 어시스턴트 노드 함수"""
    agent = _get_opmate_assistant()
    result = agent.invoke(state)
    return result
