"""
Multi-Agent 워크플로우 진입점

이 파일은 리팩토링된 모듈식 구조의 진입점입니다.
기능별로 분리된 모듈들을 import하여 사용합니다.

디렉토리 구조:
- models.py: 데이터 모델 (AgentState, Input 클래스들)
- context.py: Flask 컨텍스트 관리
- tools/: 도구 함수들
  - qdrant_tools.py: Qdrant 검색
  - script_tools.py: 스크립트 편집/리뷰
  - node_tools.py: 노드 검색 및 관리
- agents/: 에이전트들
  - opmate_agent.py: OPMATE 매뉴얼 검색
  - script_agents.py: 스크립트 편집/리뷰 에이전트
  - node_agent.py: 노드 검색 에이전트
  - supervisor.py: Supervisor 에이전트
- nodes/: 워크플로우 노드들
  - conversation_nodes.py: 대화 입출력
  - task_nodes.py: 태스크 생성 워크플로우
- graph.py: LangGraph 그래프 빌더
"""
import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(os.path.dirname(__file__))))

import urllib3

# SSL 검증 비활성화 경고 억제
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 모듈 imports
from .context import set_flask_context_info, get_flask_context_info
from .models import AgentState
from .graph import build_graph


# 이전 버전과의 호환성을 위한 exports
__all__ = [
    'AgentState',
    'build_graph',
    'set_flask_context_info',
    'get_flask_context_info',
]


if __name__ == "__main__":
    # 그래프 시각화 테스트
    graph = build_graph()

    graph_image = graph.get_graph().draw_mermaid_png()

    output_path = "task_graph.png"
    with open(output_path, "wb") as f:
        f.write(graph_image)

    import subprocess
    subprocess.run(["open", output_path])
