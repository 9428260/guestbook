"""
데이터 모델 정의
"""
from typing import Any, Dict, List, Optional
from typing import TypedDict
from pydantic import BaseModel, Field


class AgentState(TypedDict):
    """에이전트 상태를 관리하는 TypedDict"""
    # 라우팅 관련
    next: str
    search_count: int
    node_count: int

    # 메시지 및 결과
    messages: List[Any]  # BaseMessage 리스트
    user_message: str
    script_content: str
    task_id: str
    result_msg: str

    # 대화 관리 필드들
    conversation_id: str
    conversation_context: Optional[Dict[str, Any]]
    user_id: str
    session_data: Dict[str, Any]
    conversation_state: str  # active, waiting_for_input, completed, paused
    active_agents: List[str]
    user_intent: Dict[str, Any]
    conversation_turn: int
    last_user_input: str
    awaiting_user_response: bool
    conversation_history: List[Dict[str, Any]]

    # 태스크 생성 워크플로우 관련 필드
    task_name: str
    task_requirements: str
    os_type: str  # "linux" 또는 "windows"
    workflow_step: str  # "ask_name", "ask_os_type", "ask_requirements", "generate_script", "ask_modification", "done"
    modification_request: str
    script_description: str

    # 채팅 모드 필드
    chat_mode: str  # "agent" 또는 "ask"
    previous_chat_mode: str
    is_mode_changed: bool

    # 노드 검색 관련 필드
    search_results: List[Dict[str, Any]]
    selected_nodes: List[Dict[str, Any]]

    # 스케줄 정보 필드
    schedule_info: Optional[Dict[str, Any]]


class QdrantSearchInput(BaseModel):
    """Qdrant 검색 입력"""
    query: str = Field(..., description="검색어(자연어 질의)")


class EditScriptInput(BaseModel):
    """스크립트 수정 입력"""
    script_content: str = Field(..., description="수정할 스크립트 내용")
    modification_request: str = Field(..., description="수정 요청 사항")


class ScriptReviewInput(BaseModel):
    """스크립트 리뷰 입력"""
    script_content: str = Field(..., description="검토할 스크립트 내용")


class NodeSearchInput(BaseModel):
    """노드 검색 입력"""
    operator: str = Field(default="", description="노드 담당자/관리자명")
    os_type: str = Field(default="", description='운영체제 타입 (예: "Linux", "Windows")')
    hostname: str = Field(default="", description="호스트명, IP 주소 또는 검색 키워드")
    status: str = Field(default="", description="노드 상태")
    customer: str = Field(default="", description="고객사명")
    os_name: str = Field(default="", description='운영체제 이름 (예: "CentOS", "Ubuntu", "Windows Server")')
    os_version: str = Field(default="", description='운영체제 버전 (예: "7", "20.04", "2019")')
    use_regexp: bool = Field(default=False, description="정규표현식 사용 여부")
    page: int = Field(default=1, description="페이지 번호")
    per_page: int = Field(default=20, description="페이지당 항목 수")
