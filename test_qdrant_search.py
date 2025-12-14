"""
qdrant_search_direct 함수 테스트 스크립트
"""
import json
import sys
from pathlib import Path

# 프로젝트 루트를 sys.path에 추가
project_root = Path(__file__).resolve().parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from app.llm.workflow.tools.qdrant_tools import qdrant_search_direct

if __name__ == "__main__":
    print("=" * 60)
    print("Qdrant Search Direct Test")
    print("=" * 60)

    # 테스트 쿼리 목록
    test_queries = [
        "작업 관리",
        "사용자 권한",
        "대시보드 설정"
    ]

    for i, query in enumerate(test_queries, 1):
        print(f"\n[Test {i}/{len(test_queries)}] Query: '{query}'")
        print("-" * 60)

        try:
            result = qdrant_search_direct(query)
            result_json = json.loads(result)

            print(f"\n[결과 요약]")
            print(f"  - 메시지: {result_json.get('message', 'N/A')}")
            print(f"  - 검색 결과 수: {len(result_json.get('results', []))}")

            if result_json.get('results'):
                print(f"\n[상위 결과]")
                for idx, item in enumerate(result_json['results'][:3], 1):
                    print(f"  {idx}. Score: {item.get('score', 0):.4f}")
                    print(f"     File: {item.get('filename', 'N/A')}")
                    print(f"     Text: {item.get('text', '')[:100]}...")

            if result_json.get('error'):
                print(f"\n[오류] {result_json['error']}")

        except Exception as e:
            import traceback
            print(f"\n[테스트 실패] {str(e)}")
            traceback.print_exc()

        print("-" * 60)

    print("\n" + "=" * 60)
    print("Test Completed")
    print("=" * 60)
