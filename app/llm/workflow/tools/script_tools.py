"""
스크립트 편집 및 리뷰 도구
"""
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.tools import StructuredTool
from ...common.config import get_llm
from ..models import EditScriptInput, ScriptReviewInput


def edit_script(script_content: str, modification_request: str = "") -> str:
    """
    스크립트를 LLM에 전달하여 수정된 결과를 반환합니다.

    Args:
        script_content: 수정할 스크립트 내용
        modification_request: 수정 요청 사항 (선택적)

    Returns:
        str: LLM이 생성한 수정된 스크립트
    """
    if not script_content or not script_content.strip():
        return "수정할 스크립트가 제공되지 않았습니다. 스크립트 내용을 입력해주세요."

    system_prompt = """당신은 경험이 풍부한 시스템 관리자이자 스크립트 개발 전문가입니다.

주어진 스크립트를 다음 관점에서 개선하고 수정해주세요:

**1. 보안성 강화**
- 권한 설정 최적화
- 입력값 검증 추가
- 보안 취약점 해결

**2. 안정성 향상**
- 에러 처리 로직 추가
- 예외 상황 대응 강화
- 시스템 리소스 보호

**3. 효율성 개선**
- 성능 최적화
- 불필요한 명령어 제거
- 리소스 사용 최적화

**4. 가독성 및 유지보수성**
- 코드 구조 개선
- 주석 및 문서화 추가
- 모듈화 적용

**5. 모범 사례 적용**
- 쉘 스크립트 베스트 프랙티스 적용
- 표준 도구 활용
- 에러 핸들링 패턴 적용

**수정 결과 형식:**
1. 수정된 스크립트 코드 (```bash로 감싸기)
2. 📝 **주요 수정사항**: 변경된 내용 요약
3. ✅ **개선효과**: 수정으로 얻어지는 장점들
4. 💡 **추가 권장사항**: 향후 고려할 개선사항
    """

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"""
다음 스크립트를 개선해주세요:

```bash
{script_content}
```

{f"특별 요청사항: {modification_request}" if modification_request else ""}

위 스크립트를 보안성, 안정성, 효율성, 가독성 관점에서 개선하여 수정된 버전을 제공해주세요.
        """)
    ]

    try:
        llm = get_llm()
        response = llm.invoke(messages)
        return response.content
    except Exception as e:
        return f"스크립트 수정 중 오류가 발생했습니다: {str(e)}"


def review_script(script_content: str) -> str:
    """
    스크립트를 LLM에 전달하여 리뷰 결과를 반환합니다.

    Args:
        script_content: 리뷰할 스크립트 내용

    Returns:
        str: LLM이 생성한 스크립트 리뷰 결과
    """
    if not script_content or not script_content.strip():
        return "리뷰할 스크립트가 제공되지 않았습니다. 스크립트 내용을 입력해주세요."

    system_prompt = """당신은 경험이 풍부한 시스템 관리자이자 스크립트 리뷰 전문가입니다.

주어진 스크립트를 다음 관점에서 종합적으로 분석하고 리뷰해주세요:

**1. 보안성 검토**
- 권한 설정의 적절성
- 입력값 검증 여부
- 잠재적 보안 취약점

**2. 안정성 검토**
- 에러 처리 로직
- 예외 상황 대응
- 시스템 리소스 고려사항

**3. 효율성 검토**
- 성능 최적화 가능성
- 불필요한 명령어 사용
- 리소스 사용 효율성

**4. 가독성 및 유지보수성**
- 코드 구조와 가독성
- 주석 및 문서화
- 모듈화 가능성

**5. 모범 사례 준수**
- 쉘 스크립트 베스트 프랙티스
- 코딩 컨벤션 준수
- 표준 도구 활용

**리뷰 결과 형식:**
- 📊 **전체 평가**: (우수/양호/보통/개선필요)
- ✅ **장점**: 잘 작성된 부분들
- ⚠️ **개선사항**: 수정이 필요한 부분들
- 💡 **제안사항**: 추가 개선 아이디어
- 🔧 **수정 예시**: 구체적인 코드 수정 예시 (필요시)
    """

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"""
다음 스크립트를 리뷰해주세요:

```bash
{script_content}
```

위 스크립트에 대한 종합적인 리뷰를 제공해주세요.
        """)
    ]

    try:
        llm = get_llm()
        response = llm.invoke(messages)
        return response.content
    except Exception as e:
        return f"스크립트 리뷰 중 오류가 발생했습니다: {str(e)}"


def review_script_from_state(state) -> dict:
    """
    AgentState에서 script_content를 가져와 리뷰를 수행하고 결과를 메시지에 추가합니다.

    Args:
        state: 현재 에이전트 상태 (script_content 포함)

    Returns:
        AgentState: 리뷰 결과가 추가된 상태
    """
    # script_content 가져오기
    script_content = state.get('script_content', '')

    if not script_content or not script_content.strip():
        # 메시지에서 스크립트를 찾아보기
        messages = state.get("messages", [])
        if messages:
            last_message = messages[-1]
            if hasattr(last_message, 'content'):
                script_content = last_message.content
            elif isinstance(last_message, dict):
                script_content = last_message.get('content', '')

    # 스크립트 리뷰 수행
    review_result = review_script(script_content)

    # 상태 업데이트
    new_state = state.copy()

    # 메시지에 리뷰 결과 추가
    if "messages" not in new_state:
        new_state["messages"] = []

    review_message = AIMessage(content=review_result)
    new_state["messages"].append(review_message)

    return new_state


# StructuredTool로 edit_script 툴 생성
edit_script_tool = StructuredTool.from_function(
    name="edit_script",
    description=(
        "주어진 스크립트를 종합적으로 분석하고 개선된 버전으로 수정합니다. "
        "보안성, 안정성, 효율성, 가독성 관점에서 스크립트를 개선하고 "
        "베스트 프랙티스를 적용하여 완성도 높은 스크립트를 제공합니다."
    ),
    func=edit_script,
    args_schema=EditScriptInput,
    return_direct=False,
)


# StructuredTool로 review_script 툴 생성
review_script_tool = StructuredTool.from_function(
    name="review_script",
    description=(
        "주어진 스크립트를 종합적으로 분석하고 리뷰합니다. "
        "보안성, 안정성, 효율성, 가독성, 모범 사례 준수 관점에서 평가하고 "
        "개선사항과 제안사항을 제공합니다."
    ),
    func=review_script,
    args_schema=ScriptReviewInput,
    return_direct=False,
)
