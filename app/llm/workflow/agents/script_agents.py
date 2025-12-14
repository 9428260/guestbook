"""
스크립트 편집 및 리뷰 에이전트
"""
from langchain_core.messages import AIMessage
from langgraph.prebuilt import create_react_agent
from ...common.config import get_llm
from ..models import AgentState
from ..tools.script_tools import edit_script, review_script, edit_script_tool, review_script_tool


def state_aware_edit_assistant(state: AgentState) -> AgentState:
    """
    AgentState의 script_content를 사용하여 스크립트 수정을 수행하는 노드 함수
    """
    script_content = state.get('script_content', '')

    # script_content가 비어있으면 메시지에서 찾기
    if not script_content or not script_content.strip():
        messages = state.get("messages", [])
        if messages:
            # 최근 메시지에서 스크립트 찾기
            for message in reversed(messages):
                content = ""
                if hasattr(message, 'content'):
                    content = message.content
                elif isinstance(message, dict):
                    content = message.get('content', '')

                # 스크립트로 보이는 내용 확인 (#!/bin/bash 또는 스크립트 키워드 포함)
                if content and ('#!/' in content or 'bash' in content.lower() or 'script' in content.lower()):
                    script_content = content
                    break

    # 사용자 메시지에서 수정 요청사항 추출
    modification_request = ""
    user_message = state.get('user_message', '')

    if user_message:
        # 수정 관련 키워드가 있으면 modification_request로 사용
        edit_keywords = ['수정', '개선', '보안', '최적화', '리팩토링', '에러', '처리']
        if any(keyword in user_message for keyword in edit_keywords):
            modification_request = user_message

    # 스크립트가 있으면 수정 수행
    if script_content and script_content.strip():
        edit_result = edit_script(script_content, modification_request)

        # 상태 복사 및 업데이트
        new_state = state.copy()

        # 메시지에 수정 결과 추가
        if "messages" not in new_state:
            new_state["messages"] = []

        edit_message = AIMessage(content=f"🔧 **스크립트 수정 결과**\n\n{edit_result}")
        new_state["messages"].append(edit_message)
        new_state["next"] = "FINISH"

        return new_state
    else:
        # 스크립트가 없으면 안내 메시지
        new_state = state.copy()

        if "messages" not in new_state:
            new_state["messages"] = []

        guide_message = AIMessage(content=(
            "수정할 스크립트를 찾을 수 없습니다. "
            "다음 중 하나의 방법으로 스크립트를 제공해주세요:\n\n"
            "1. script_content 필드에 직접 설정\n"
            "2. 메시지로 스크립트 내용 전달\n"
            "3. '#!/bin/bash'로 시작하는 스크립트 코드 제공\n\n"
            "수정 요청 예시:\n"
            "- '보안 취약점을 해결해주세요'\n"
            "- '에러 처리를 추가해주세요'\n"
            "- '성능을 최적화해주세요'"
        ))
        new_state["messages"].append(guide_message)
        new_state["next"] = "FINISH"

        return new_state


def state_aware_review_assistant(state: AgentState) -> AgentState:
    """
    AgentState의 script_content를 사용하여 스크립트 리뷰를 수행하는 노드 함수
    """
    script_content = state.get('script_content', '')

    # script_content가 비어있으면 메시지에서 찾기
    if not script_content or not script_content.strip():
        messages = state.get("messages", [])
        if messages:
            # 최근 메시지에서 스크립트 찾기
            for message in reversed(messages):
                content = ""
                if hasattr(message, 'content'):
                    content = message.content
                elif isinstance(message, dict):
                    content = message.get('content', '')

                # 스크립트로 보이는 내용 확인
                if content and ('#!/' in content or 'bash' in content.lower() or 'script' in content.lower()):
                    script_content = content
                    break

    # 스크립트가 있으면 리뷰 수행
    if script_content and script_content.strip():
        review_result = review_script(script_content)

        # 상태 복사 및 업데이트
        new_state = state.copy()

        # 메시지에 리뷰 결과 추가
        if "messages" not in new_state:
            new_state["messages"] = []

        review_message = AIMessage(content=f"📋 **스크립트 리뷰 결과**\n\n{review_result}")
        new_state["messages"].append(review_message)
        new_state["next"] = "FINISH"

        return new_state
    else:
        # 스크립트가 없으면 안내 메시지
        new_state = state.copy()

        if "messages" not in new_state:
            new_state["messages"] = []

        guide_message = AIMessage(content=(
            "리뷰할 스크립트를 찾을 수 없습니다. "
            "다음 중 하나의 방법으로 스크립트를 제공해주세요:\n\n"
            "1. script_content 필드에 직접 설정\n"
            "2. 메시지로 스크립트 내용 전달\n"
            "3. '#!/bin/bash'로 시작하는 스크립트 코드 제공"
        ))
        new_state["messages"].append(guide_message)

        return new_state


# 도구 기반 에이전트들 (지연 초기화)
_edit_assistant_with_tools = None
_review_assistant_with_tools = None

def _get_edit_assistant_with_tools():
    """Edit 어시스턴트를 지연 초기화하여 반환"""
    global _edit_assistant_with_tools
    if _edit_assistant_with_tools is None:
        llm = get_llm()
        if llm is None:
            raise RuntimeError("LLM을 초기화할 수 없습니다. AWS 자격증명을 확인해주세요.")
        _edit_assistant_with_tools = create_react_agent(
            model=llm,
            tools=[edit_script_tool],
            prompt=(
                "당신은 스크립트 수정 전문가입니다. "
                "사용자가 스크립트를 제공하면 edit_script 도구를 사용하여 "
                "보안성, 안정성, 효율성을 높인 개선된 버전을 제공해주세요."
            ),
            name="edit_assistant_tools"
        )
    return _edit_assistant_with_tools

def _get_review_assistant_with_tools():
    """Review 어시스턴트를 지연 초기화하여 반환"""
    global _review_assistant_with_tools
    if _review_assistant_with_tools is None:
        llm = get_llm()
        if llm is None:
            raise RuntimeError("LLM을 초기화할 수 없습니다. AWS 자격증명을 확인해주세요.")
        _review_assistant_with_tools = create_react_agent(
            model=llm,
            tools=[review_script_tool],
            prompt=(
                "당신은 스크립트 리뷰 전문가입니다. "
                "사용자가 스크립트를 제공하면 review_script 도구를 사용하여 "
                "종합적인 분석과 개선사항을 제공해주세요."
            ),
            name="review_assistant_tools"
        )
    return _review_assistant_with_tools

edit_assistant_with_tools = _get_edit_assistant_with_tools
review_assistant_with_tools = _get_review_assistant_with_tools

# 상태 기반 에이전트 (실제로 사용되는 것들)
edit_assistant = state_aware_edit_assistant
review_assistant = state_aware_review_assistant
