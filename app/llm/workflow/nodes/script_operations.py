"""
스크립트 관련 작업 처리 모듈

스크립트 생성, 수정, 리뷰 등 스크립트와 관련된 모든 작업을 처리합니다.
"""

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from ..models import AgentState
from ...common.config import get_llm


def generate_task_script(state: AgentState) -> AgentState:
    """
    태스크명과 요건을 기반으로 스크립트를 생성하는 함수
    """
    # 처리 순서:
    # 1) 입력 상태에서 태스크 메타데이터와 OS 정보를 읽어 LLM 프롬프트를 준비한다.
    # 2) 운영체제별 시스템 프롬프트·예제를 구성하여 원하는 스크립트 스타일을 고정한다.
    # 3) LLM 호출 결과를 코드 블록 형태로 정리하고 상태에 저장하여 후속 단계가 활용하도록 한다.

    new_state = state.copy()
    task_name = new_state.get("task_name", "")
    task_requirements = new_state.get("task_requirements", "")
    os_type = new_state.get("os_type", "linux")  # 기본값은 linux

    # OS 타입에 따른 시스템 프롬프트 및 예제
    if os_type == "windows":
        system_prompt = """당신은 경험이 풍부한 Windows PowerShell 스크립트 작성 전문가입니다.

Important rules:
- 개행 문자는 '\r\n' 으로 표시해 주세요.
- 주석을 포함하여 스크립트를 작성해주세요.
- 에러 처리를 포함해주세요 (Try-Catch 사용).
- 실행 권한과 실행 방법을 주석으로 설명해주세요.
- PowerShell 5.1 이상과 호환되도록 작성해주세요.

Examples:

User input: "디스크 사용량 체크 - 80% 이상이면 경고"
# 디스크 사용량 체크 스크립트\r\n# 실행 방법: powershell -ExecutionPolicy Bypass -File script.ps1\r\n\r\ntry {\r\n    $drive = Get-PSDrive C\r\n    $usedPercent = [math]::Round(($drive.Used / ($drive.Used + $drive.Free)) * 100, 2)\r\n    \r\n    if ($usedPercent -ge 80) {\r\n        Write-Host \"경고: 디스크 사용량이 $usedPercent% 입니다.\" -ForegroundColor Red\r\n    } else {\r\n        Write-Host \"디스크 사용량: $usedPercent%\" -ForegroundColor Green\r\n    }\r\n} catch {\r\n    Write-Error \"디스크 사용량 체크 중 오류 발생: $_\"\r\n    exit 1\r\n}\r\n
        """
        script_type = "PowerShell"
        prompt = f"""
태스크명: {task_name}
스크립트 요건: {task_requirements}

위 요건에 맞는 Windows PowerShell 스크립트를 작성해주세요.
- 주석을 포함하여 이해하기 쉽게 작성
- Try-Catch를 사용한 에러 처리 포함
- 실행 방법 주석으로 설명
- PowerShell 5.1 이상과 호환
        """
    else:  # linux
        system_prompt = """당신은 경험이 풍부한 리눅스 쉘 스크립트 작성 전문가입니다.

Important rules:
- 개행 문자는 '\r\n' 으로 표시해 주세요.
- 주석을 포함하여 스크립트를 작성해주세요.
- 에러 처리를 포함해주세요.
- 실행 권한과 실행 방법을 주석으로 설명해주세요.

Examples:

User input: "디스크 사용량 체크 - 80% 이상이면 경고"
#!/bin/bash\r\n# 디스크 사용량 체크 스크립트\r\n# 실행 방법: chmod +x script.sh && ./script.sh\r\n\r\nUSAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')\r\n\r\nif [ $USAGE -ge 80 ]; then\r\n    echo \"경고: 디스크 사용량이 ${USAGE}% 입니다.\"\r\nelse\r\n    echo \"디스크 사용량: ${USAGE}%\"\r\nfi\r\n
        """
        script_type = "Shell"
        prompt = f"""
태스크명: {task_name}
스크립트 요건: {task_requirements}

위 요건에 맞는 리눅스 shell 스크립트를 작성해주세요.
- 주석을 포함하여 이해하기 쉽게 작성
- 에러 처리 포함
- 실행 방법 주석으로 설명
        """

    # --- LLM 호출 준비 및 실행 ---
    messages = [SystemMessage(content=system_prompt)]
    messages.append(HumanMessage(content=prompt))
    response = get_llm().invoke(messages)

    # 생성된 스크립트 저장
    generated_script = response.content.strip()

    # 디버깅 로그
    print(f"[generate_task_script] OS Type: {os_type}")
    print(f"[generate_task_script] Generated script length: {len(generated_script)}")
    print(f"[generate_task_script] Script preview: {generated_script[:200]}...")

    # 코드 블록 언어 설정
    code_block_lang = "powershell" if os_type == "windows" else "bash"
    os_display = "윈도우 (PowerShell)" if os_type == "windows" else "리눅스 (Shell)"

    # generated_script에 이미 코드 블록이 포함되어 있는지 확인
    if "```" in generated_script:
        # 이미 코드 블록이 있으면 그대로 사용
        script_display = generated_script
    else:
        # 코드 블록이 없으면 추가
        script_display = f"```{code_block_lang}\n{generated_script}\n```"

    # --- 사용자 안내 메시지 구성 ---
    result_message = AIMessage(content=(
        f"**태스크명:** {task_name}\n\n"
        f"**운영체제:** {os_display}\n\n"
        f"**요건:** {task_requirements}\n\n"
        f"**생성된 스크립트:**\n\n{script_display}\n\n"
        "✅ **스크립트 생성이 완료되었습니다!**\n\n"
        "요구사항에 맞는 스크립트가 성공적으로 생성되었습니다.\n\n"
        "## 🚀 다음 단계 선택:\n\n"
        "### 📋 **스크립트 리뷰:**\n"
        "- **\"스크립트 리뷰\"** 또는 **\"리뷰 요청\"** - 스크립트 품질 검토 및 분석\n"
        "- 구체적인 리뷰 요구사항을 바로 입력해도 됩니다\n\n"
        "### ✏️ **스크립트 수정:**\n"
        "- **\"수정 요청\"** 또는 **\"스크립트 개선\"** - 스크립트 개선 및 수정\n"
        "- 구체적인 수정 요구사항을 바로 입력해도 됩니다\n\n"
        "### 🎯 **실행 대상 설정:**\n"
        "- **\"다음 단계\"** 또는 **\"실행 대상\"** - 노드 검색 및 선택\n\n"
        "### 💾 **태스크 등록:**\n"
        "- **\"태스크 등록\"** 또는 **\"태스크 저장\"** - 현재 스크립트로 태스크 생성\n\n"
        "원하시는 작업을 선택하거나 직접 명령을 입력해주세요."
    ))

    new_state["messages"].append(result_message)
    new_state["script_content"] = generated_script
    new_state["next"] = "FINISH"
    new_state["workflow_step"] = "ask_modification"
    new_state["awaiting_user_response"] = True

    # session_data에 워크플로우 상태 동기화
    if "session_data" not in new_state:
        new_state["session_data"] = {}
    new_state["session_data"]["workflow_step"] = "ask_modification"
    new_state["session_data"]["script_content"] = generated_script
    new_state["session_data"]["task_name"] = new_state.get("task_name", "")
    new_state["session_data"]["os_type"] = new_state.get("os_type", "")
    new_state["session_data"]["task_requirements"] = new_state.get("task_requirements", "")

    print(f"[generate_task_script] Saved to state - script_content length: {len(new_state['script_content'])}")

    return new_state


def modify_task_script(state: AgentState) -> AgentState:
    """
    생성된 스크립트를 사용자 요청에 따라 수정하는 함수
    """
    # 처리 순서:
    # 1) 상태에 저장된 스크립트를 확보하고, 없을 경우 메시지 히스토리에서 복원한다.
    # 2) 수정 의도를 LLM에 전달하여 기존 스크립트를 개선된 버전으로 재생성한다.
    # 3) 응답을 사용자 메시지와 상태에 반영하여 다음 수정 또는 다른 단계로 이어지게 한다.

    new_state = state.copy()
    script_content = new_state.get("script_content", "")
    modification_request = new_state.get("modification_request", "")
    task_name = new_state.get("task_name", "")
    session_data = new_state.get("session_data", {}) if isinstance(new_state.get("session_data"), dict) else {}
    is_existing_task = bool(
        session_data.get("is_existing_task")
        or session_data.get("existing_task_id")
        or new_state.get("task_id")
    )

    # 디버깅 로그
    print(f"[modify_task_script] Initial script_content: {script_content[:100] if script_content else 'None'}")
    print(f"[modify_task_script] task_name: {task_name}")
    print(f"[modify_task_script] modification_request: {modification_request}")

    # script_content가 ```bash로 감싸져 있으면 추출
    import re
    # --- 기존 스크립트 복원 ---
    if script_content and '```bash' in script_content:
        match = re.search(r'```bash\s*\n(.*?)```', script_content, re.DOTALL)
        if match:
            script_content = match.group(1).strip()
            print(f"[modify_task_script] Extracted script from markdown: {script_content[:100]}...")

    # script_content가 없으면 메시지에서 찾기
    if not script_content or not script_content.strip():
        messages = new_state.get("messages", [])
        print(f"[modify_task_script] Searching in {len(messages)} messages...")

        if messages:
            # 최근 메시지에서 스크립트 찾기 (```bash로 감싸진 부분)
            for idx, message in enumerate(reversed(messages)):
                content = ""
                if hasattr(message, 'content'):
                    content = message.content
                elif isinstance(message, dict):
                    content = message.get('content', '')

                # ```bash ... ``` 패턴에서 스크립트 추출
                if '```bash' in content:
                    match = re.search(r'```bash\s*\n(.*?)```', content, re.DOTALL)
                    if match:
                        script_content = match.group(1).strip()
                        print(f"[modify_task_script] Found script in message {len(messages)-idx-1}: {script_content[:100]}...")
                        break

    if not script_content or not script_content.strip():
        error_message = AIMessage(content=(
            "수정할 스크립트가 없습니다.\n\n"
            f"현재 상태:\n"
            f"- task_name: {task_name}\n"
            f"- script_content: {script_content[:50] if script_content else 'None'}...\n"
            f"- modification_request: {modification_request}\n\n"
            "먼저 스크립트를 생성해주세요."
        ))
        new_state["messages"].append(error_message)
        new_state["next"] = "FINISH"
        new_state["workflow_step"] = "done"

        # session_data에 워크플로우 상태 동기화
        if "session_data" not in new_state:
            new_state["session_data"] = {}
        new_state["session_data"]["workflow_step"] = "done"

        return new_state

    # OS 타입에 따라 코드 블록 언어 설정
    os_type = new_state.get("os_type", "linux")
    code_block_lang = "powershell" if os_type == "windows" else "bash"

    system_prompt = """당신은 경험이 풍부한 시스템 관리자이자 스크립트 개발 전문가입니다.

🔧 **중요: 이것은 스크립트 수정(MODIFICATION) 작업입니다.**

사용자의 수정 요청을 정확히 분석하고, 구체적인 코드 변경을 통해 스크립트를 개선해주세요.

**수정 접근 방법:**
1. **정확한 코드 수정**: 사용자 요구사항을 코드로 구현
2. **기능 개선**: 요청된 기능을 실제로 추가/변경
3. **실행 가능한 코드**: 바로 실행할 수 있는 완전한 스크립트 제공
4. **보완 및 최적화**: 보안, 안정성, 효율성 향상

**반드시 제공해야 할 내용:**
1. **🔧 수정된 전체 스크립트 코드** (```bash 또는 ```powershell로 감싸기)
2. **📝 주요 수정사항 요약** (어떤 부분이 어떻게 변경되었는지)
3. **✅ 개선 효과** (수정으로 달성된 목표)

**응답 형식 예시:**
```bash
#!/bin/bash
# 수정된 스크립트 코드
echo "Hello World"
```

📝 **주요 수정사항:**
- 에러 처리 로직 추가
- 보안 검증 강화

✅ **개선 효과:**
- 안정성 향상
- 보안 취약점 해결
    """

    # --- LLM 수정 요청 구성 ---
    messages = [SystemMessage(content=system_prompt)]

    prompt = f"""
다음 스크립트를 수정해주세요:

```{code_block_lang}
{script_content}
```

**수정 요청사항:** {modification_request}

위 요청사항을 반영하여 스크립트를 개선해주세요.
    """

    messages.append(HumanMessage(content=prompt))
    response = get_llm().invoke(messages)

    # OS 정보 표시
    os_display = "윈도우 (PowerShell)" if os_type == "windows" else "리눅스 (Shell)"

    # response.content에 이미 코드 블록이 있는지 확인
    if "```" in response.content:
        # 이미 코드 블록이 있으면 그대로 사용
        script_display = response.content
    else:
        # 코드 블록이 없으면 추가
        script_display = f"```{code_block_lang}\n{response.content}\n```"

    # --- 사용자에게 변경 결과 안내 ---
    next_steps_sections = [
        "### 📋 **스크립트 리뷰** 요청\n"
        "수정된 스크립트를 검토하여 품질, 보안, 성능을 분석\n"
        "- **\"스크립트 리뷰\"** 또는 **\"리뷰 요청\"**\n"
        "- 구체적인 리뷰 관점 (예: \"보안 취약점 검사\")",
        "### ✏️ **추가 수정** 요청\n"
        "다른 부분을 더 개선하거나 기능을 추가\n"
        "- **\"추가 수정\"** 또는 **\"수정 요청\"**\n"
        "- 구체적인 수정 요구사항 (예: \"에러 처리 추가\")",
    ]

    if not is_existing_task:
        next_steps_sections.extend([
            "### 🎯 **실행 대상 설정**\n"
            "스크립트를 실행할 서버/노드 검색 및 선택\n"
            "- **\"다음 단계\"** 또는 **\"실행 대상\"**",
            "### 💾 **태스크 등록**\n"
            "현재 스크립트로 실행 가능한 태스크를 생성\n"
            "- **\"태스크 등록\"** 또는 **\"태스크 저장\"**",
        ])
    else:
        next_steps_sections.append(
            "⚠️ **안내**\n"
            "현재 편집 중인 태스크는 이미 등록된 상태입니다.\n"
            "실행 대상 설정이나 태스크 등록은 태스크 상세 화면의 기본 기능을 이용해주세요."
        )

    next_steps_text = "\n\n".join(next_steps_sections)

    result_message = AIMessage(content=(
        f"# 🔧 스크립트 수정 완료\n\n"
        f"**📝 태스크명:** {task_name}\n"
        f"**💻 운영체제:** {os_display}\n"
        f"**🔧 수정 요청:** {modification_request}\n\n"
        f"---\n\n"
        f"## 📄 수정된 스크립트\n\n"
        f"{script_display}\n\n"
        f"---\n\n"
        "✅ **스크립트 수정이 성공적으로 완료되었습니다!**\n\n"
        "요청하신 수정사항이 반영된 새로운 스크립트가 생성되었습니다. "
        "위의 코드를 복사하여 사용하거나, 추가 수정이 필요한 경우 아래 옵션을 선택해주세요.\n\n"
        "## 🚀 다음 단계 선택\n\n"
            f"{next_steps_text}\n\n"
        "원하는 작업을 선택하거나 직접 요청사항을 입력해주세요."
    ))

    new_state["messages"].append(result_message)

    # script_content에는 순수한 스크립트만 저장 (코드 블록 제거)
    script_content_for_state = response.content
    if "```" in script_content_for_state:
        # 코드 블록 제거
        match = re.search(r'```(?:bash|powershell)?\s*\n(.*?)```', script_content_for_state, re.DOTALL)
        if match:
            script_content_for_state = match.group(1).strip()

    new_state["script_content"] = script_content_for_state
    new_state["next"] = "FINISH"
    new_state["workflow_step"] = "ask_modification"
    new_state["awaiting_user_response"] = True

    # session_data에 워크플로우 상태 동기화
    if "session_data" not in new_state:
        new_state["session_data"] = {}
    new_state["session_data"]["workflow_step"] = "ask_modification"
    new_state["session_data"]["script_content"] = script_content_for_state
    new_state["session_data"]["task_name"] = new_state.get("task_name", "")
    new_state["session_data"]["os_type"] = new_state.get("os_type", "")
    new_state["session_data"]["task_requirements"] = new_state.get("task_requirements", "")

    return new_state


def perform_script_review(state: AgentState) -> AgentState:
    """
    사용자의 리뷰 요청에 따라 스크립트를 리뷰하는 함수
    """
    new_state = state.copy()
    script_content = new_state.get("script_content", "")
    review_request = new_state.get("review_request", "")
    task_name = new_state.get("task_name", "")
    session_data = new_state.get("session_data", {}) if isinstance(new_state.get("session_data"), dict) else {}
    is_existing_task = bool(
        session_data.get("is_existing_task")
        or session_data.get("existing_task_id")
        or new_state.get("task_id")
    )

    # 디버깅 로그
    print(f"[perform_script_review] Initial script_content: {script_content[:100] if script_content else 'None'}")
    print(f"[perform_script_review] task_name: {task_name}")
    print(f"[perform_script_review] review_request: {review_request}")

    # script_content가 ```bash로 감싸져 있으면 추출
    import re
    if script_content and '```bash' in script_content:
        match = re.search(r'```bash\s*\n(.*?)```', script_content, re.DOTALL)
        if match:
            script_content = match.group(1).strip()
            print(f"[perform_script_review] Extracted script from markdown: {script_content[:100]}...")

    # script_content가 없으면 메시지에서 찾기
    if not script_content or not script_content.strip():
        messages = new_state.get("messages", [])
        print(f"[perform_script_review] Searching in {len(messages)} messages...")

        if messages:
            # 최근 메시지에서 스크립트 찾기 (```bash로 감싸진 부분)
            for idx, message in enumerate(reversed(messages)):
                content = ""
                if hasattr(message, 'content'):
                    content = message.content
                elif isinstance(message, dict):
                    content = message.get('content', '')

                # ```bash ... ``` 패턴에서 스크립트 추출
                if '```bash' in content or '```powershell' in content:
                    match = re.search(r'```(?:bash|powershell)\s*\n(.*?)```', content, re.DOTALL)
                    if match:
                        script_content = match.group(1).strip()
                        print(f"[perform_script_review] Found script in message {len(messages)-idx-1}: {script_content[:100]}...")
                        break

    if not script_content or not script_content.strip():
        error_message = AIMessage(content=(
            "리뷰할 스크립트가 없습니다.\n\n"
            f"현재 상태:\n"
            f"- task_name: {task_name}\n"
            f"- script_content: {script_content[:50] if script_content else 'None'}...\n"
            f"- review_request: {review_request}\n\n"
            "먼저 스크립트를 생성해주세요."
        ))
        new_state["messages"].append(error_message)
        new_state["next"] = "FINISH"
        new_state["workflow_step"] = "done"

        # session_data에 워크플로우 상태 동기화
        if "session_data" not in new_state:
            new_state["session_data"] = {}
        new_state["session_data"]["workflow_step"] = "done"

        return new_state

    # OS 타입에 따라 코드 블록 언어 설정
    os_type = new_state.get("os_type", "linux")
    code_block_lang = "powershell" if os_type == "windows" else "bash"

    system_prompt = """당신은 경험이 풍부한 시스템 관리자이자 스크립트 리뷰 전문가입니다.

📋 **중요: 이것은 스크립트 리뷰(REVIEW) 작업입니다.**

코드를 수정하지 말고, 분석과 평가만 수행해주세요. 스크립트를 검토하고 문제점을 찾아 개선 방안을 제안하세요.

**리뷰 접근 방법:**
1. **현재 코드 분석**: 스크립트의 구조, 로직, 기능 평가
2. **문제점 발견**: 보안, 성능, 안정성, 가독성 측면의 이슈 식별
3. **위험도 평가**: 발견된 문제의 심각도와 영향도 분석
4. **개선 방향 제시**: 구체적이고 실행 가능한 개선 방안 제안

**절대 하지 말아야 할 것:**
- ❌ 새로운 스크립트 작성

**반드시 제공해야 할 내용:**
1. **📊 전체 평가** (우수/양호/보통/개선필요)
2. **✅ 잘된 점** (현재 스크립트의 장점)
3. **⚠️ 문제점** (발견된 이슈와 위험도)
4. **💡 개선 제안** (구체적인 개선 방향)
5. **🏃‍♂️ 우선순위** (즉시/단기/장기 개선 사항 구분)
6. 코드 블록 (```bash, ```powershell) 제공

**응답 형식 예시:**
📊 **전체 평가:** 보통

✅ **잘된 점:**
- 기본적인 로직이 명확함
- 주요 기능 구현이 완료됨

⚠️ **문제점:**
- [높음] 입력값 검증 누락으로 보안 취약점 존재
- [중간] 에러 처리 로직 부족

💡 **개선 제안:**
- 입력값 유효성 검사 추가 필요
- try-catch 구문으로 예외 처리 강화

🏃‍♂️ **우선순위:**
- 즉시: 보안 취약점 해결
- 단기: 에러 처리 로직 추가
    """

    messages = [SystemMessage(content=system_prompt)]

    prompt = f"""
다음 스크립트를 리뷰해주세요:

```{code_block_lang}
{script_content}
```

**리뷰 요청사항:** {review_request}

위 요청사항에 맞춰 스크립트를 분석하고, 발견된 문제점과 개선사항을 상세히 제공해주세요.
    """

    messages.append(HumanMessage(content=prompt))
    response = get_llm().invoke(messages)

    # OS 정보 표시
    os_display = "윈도우 (PowerShell)" if os_type == "windows" else "리눅스 (Shell)"

    # --- 리뷰 결과 메시지 구성 및 출력 보장 ---
    # messages 컨테이너가 누락되었거나 list가 아닌 경우를 대비해 정규화한다.
    if "messages" not in new_state or not isinstance(new_state["messages"], list):
        existing_messages = new_state.get("messages", [])
        new_state["messages"] = list(existing_messages) if existing_messages else []

    next_steps_sections = [
        "### ✏️ **스크립트 수정** 요청\n"
        "리뷰에서 발견된 문제점들을 실제로 수정\n"
        "- **\"수정 요청\"** 또는 **\"스크립트 개선\"**\n"
        "- 구체적인 수정 요구사항 (예: \"보안 취약점 해결\")",
        "### 📋 **추가 리뷰** 요청\n"
        "다른 관점에서 추가적인 분석 수행\n"
        "- **\"추가 리뷰\"** 또는 **\"다른 관점 리뷰\"**\n"
        "- 구체적인 리뷰 관점 (예: \"성능 최적화 검토\")",
    ]

    if not is_existing_task:
        next_steps_sections.extend([
            "### 🎯 **실행 대상 설정**\n"
            "현재 스크립트로 실행할 서버/노드 검색\n"
            "- **\"다음 단계\"** 또는 **\"실행 대상\"**",
            "### 💾 **태스크 등록**\n"
            "현재 스크립트를 그대로 태스크로 등록\n"
            "- **\"태스크 등록\"** 또는 **\"태스크 저장\"**",
        ])
    else:
        next_steps_sections.append(
            "⚠️ **안내**\n"
            "현재 편집 중인 태스크는 이미 등록된 상태입니다.\n"
            "실행 대상 설정이나 태스크 등록은 태스크 상세 화면의 기본 기능을 이용해주세요."
        )

    next_steps_text = "\n\n".join(next_steps_sections)

    result_message = AIMessage(content=(
        f"# 📋 스크립트 리뷰 완료\n\n"
        f"**📝 태스크명:** {task_name}\n"
        f"**💻 운영체제:** {os_display}\n"
        f"**🔍 리뷰 요청:** {review_request}\n\n"
        f"---\n\n"
        f"## 📊 리뷰 분석 결과\n\n"
        f"{response.content}\n\n"
        f"---\n\n"
        "✅ **스크립트 리뷰 분석이 완료되었습니다!**\n\n"
        "위의 분석 결과를 바탕으로 스크립트 개선을 진행하거나, "
        "추가 검토가 필요한 부분에 대해 더 자세한 리뷰를 요청하실 수 있습니다.\n\n"
        "## 🚀 다음 단계 선택\n\n"
            f"{next_steps_text}\n\n"
        "원하는 작업을 선택하거나 직접 요청사항을 입력해주세요."
    ))

    new_state["messages"].append(result_message)
    new_state["next"] = "FINISH"
    new_state["workflow_step"] = "ask_modification"  # 리뷰 후에는 수정 단계로 이동
    new_state["awaiting_user_response"] = True

    # session_data에 워크플로우 상태 동기화
    if "session_data" not in new_state:
        new_state["session_data"] = {}
    new_state["session_data"]["workflow_step"] = "ask_modification"
    new_state["session_data"]["script_content"] = script_content
    new_state["session_data"]["task_name"] = new_state.get("task_name", "")
    new_state["session_data"]["os_type"] = new_state.get("os_type", "")
    new_state["session_data"]["task_requirements"] = new_state.get("task_requirements", "")

    return new_state
