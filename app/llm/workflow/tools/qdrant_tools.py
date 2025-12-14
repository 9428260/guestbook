"""
Qdrant 검색 도구
"""
import os
import json
from langchain_core.tools import StructuredTool
from ...common.config import get_embeddings
from ..models import QdrantSearchInput


def qdrant_search_direct(query: str) -> str:
    """
    Qdrant를 직접 호출하여 OPMATE 매뉴얼을 검색합니다.

    Args:
        query: 검색어

    Returns:
        str: JSON 형태의 검색 결과
    """
    try:
        print(f"\n[Qdrant 검색] 시작 - query: {query}")

        from qdrant_client import QdrantClient

        # Qdrant 클라이언트 설정
        qdrant_url = os.getenv("QDRANT_CLIENT_URL", "http://localhost:6333")
        qdrant_api_key = os.getenv("QDRANT_API_KEY", "")
        collection_name = os.getenv("COLLECTION_MANUAL", "stories")

        print(f"[Qdrant 설정] URL: {qdrant_url}, Collection: {collection_name}")

        # Qdrant 클라이언트 생성
        try:
            client = QdrantClient(url=qdrant_url, api_key=qdrant_api_key)
            print(f"[Qdrant 연결] 성공")

            # 컬렉션 정보 확인
            try:
                collection_info = client.get_collection(collection_name=collection_name)
                print(f"[컬렉션 정보] 이름: {collection_name}")
                print(f"[컬렉션 정보] 벡터 차원: {collection_info.config.params.vectors.size}")
                print(f"[컬렉션 정보] 포인트 수: {collection_info.points_count}")
            except Exception as e:
                print(f"[컬렉션 정보] 조회 실패: {str(e)}")
                # 컬렉션 목록 확인
                collections = client.get_collections()
                print(f"[사용 가능한 컬렉션] {[c.name for c in collections.collections]}")

        except Exception as e:
            print(f"[Qdrant 연결] 실패: {str(e)}")
            raise Exception(f"Qdrant 서버 연결 실패: {str(e)}")

        # 임베딩 생성 (get_embeddings 함수 사용)
        try:
            embeddings = get_embeddings()
            print(f"[임베딩 클라이언트] 생성 성공")
        except Exception as e:
            print(f"[임베딩 클라이언트] 생성 실패: {str(e)}")
            raise Exception(f"임베딩 클라이언트 생성 실패: {str(e)}")

        # 쿼리 벡터 생성
        try:
            query_vector = embeddings.embed_query(query)
            print(f"[임베딩 생성] 성공 - 벡터 크기: {len(query_vector)}")
        except Exception as e:
            print(f"[임베딩 생성] 실패: {str(e)}")
            raise Exception(f"쿼리 임베딩 생성 실패: {str(e)}")

        # Qdrant 검색 - 필터 없이 먼저 시도
        try:
            # 먼저 필터 없이 검색
            search_result = client.search(
                collection_name=collection_name,
                query_vector=query_vector,
                limit=5,
                with_payload=True
            )
            print(f"[Qdrant 검색] 필터 없이 검색 성공 - 결과 수: {len(search_result)}")

            # 결과가 있으면 payload 구조 확인
            if search_result:
                print(f"[검색 결과 샘플] payload keys: {list(search_result[0].payload.keys())}")

                # lang 필드가 있는지 확인하고 한국어 필터링 시도
                if any('lang' in hit.payload for hit in search_result):
                    print(f"[필터링] lang 필드 발견, 한국어 필터링 재시도")
                    search_result = client.search(
                        collection_name=collection_name,
                        query_vector=query_vector,
                        limit=5,
                        with_payload=True,
                        query_filter={"must": [{"key": "lang", "match": {"value": "ko"}}]}
                    )
                    print(f"[Qdrant 검색] 한국어 필터링 후 - 결과 수: {len(search_result)}")
            else:
                print(f"[Qdrant 검색] 결과 없음 - 컬렉션에 데이터가 없거나 벡터 차원 불일치 가능")

        except Exception as e:
            print(f"[Qdrant 검색] 실패: {str(e)}")
            raise Exception(f"Qdrant 검색 실패: {str(e)}")

        # 결과 포맷팅
        results = []
        for hit in search_result:
            results.append({
                "score": hit.score,
                "text": hit.payload.get("text", ""),
                "url": hit.payload.get("url", ""),
                "filename": hit.payload.get("filename", ""),
                "page": hit.payload.get("page", ""),
                "metadata": hit.payload
            })

        # 검색 결과가 없는 경우에도 성공으로 처리
        if not results:
            print(f"[검색 결과] 없음")
            return json.dumps({
                "results": [],
                "message": f"'{query}'에 대한 검색 결과가 없습니다. 다른 키워드로 검색해보시기 바랍니다."
            }, ensure_ascii=False, indent=2)

        print(f"[검색 완료] 결과 수: {len(results)}")
        return json.dumps({"results": results, "message": "검색 성공"}, ensure_ascii=False, indent=2)

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"\n[Qdrant 검색 오류]\n오류 메시지: {str(e)}\n상세 스택:\n{error_trace}")

        # 에러가 발생해도 빈 결과로 반환하여 LLM이 적절히 응답할 수 있도록 함
        error_result = {
            "results": [],
            "message": f"검색 중 오류가 발생했습니다: {str(e)}",
            "error": str(e)
        }
        return json.dumps(error_result, ensure_ascii=False, indent=2)


def build_qdrant_tool() -> StructuredTool:
    """Qdrant 검색 도구 생성 (직접 호출 방식)"""
    return StructuredTool.from_function(
        name="qdrant_search",
        description=(
            "OPMATE 매뉴얼 검색용 Qdrant 의미검색. "
            "입력은 검색어(query) 하나만 받습니다. 결과는 JSON으로 반환됩니다."
        ),
        func=qdrant_search_direct,
        args_schema=QdrantSearchInput,
        return_direct=False,
    )


# Qdrant 검색 도구 인스턴스 생성
qdrant_tool = build_qdrant_tool()


# Opmate 어시스턴트 시스템 프롬프트
OPMATE_SYSTEM_PROMPT = (
    "당신은 OPMATE 매뉴얼을 검색하여 사용자의 질문에 답변하는 전문 도우미입니다. "
    "사용자의 질문에 대해 반드시 qdrant_search 툴을 사용하여 OPMATE 문서를 검색하세요. "
    "검색 결과(JSON)를 바탕으로 한국어로 자세하고 친절하게 답변해주세요. "
    "\n\n"
    "**중요: 답변 작성 규칙**\n"
    "1. 아래에 참고 자료 항목이 있으므로 링크를 포함하지 말아주세요\n"
    "2. 답변 마지막에 참고 자료 섹션을 추가하고 다음 형식으로 출처를 표시하세요:\n"
    "   **참고 자료:**\n"
    "   - [파일명](URL)\n"
    "   예시: [task](task)\n"
    "   파일명에 확장자가 존재하는 경우 파일명만 표시하세요.\n"
    "   예시: task.md, task.pdf -> task\n"
    "   URL은 검색 결과의 url 필드를 사용하세요.\n"
    "   URL에서 마지막 경로명(파일명)만 추출하여 링크 텍스트로 사용하세요.\n"
    "   URL에서 확장자 예: .pdf, .html 등이 존재하는 경우 파일명만 표시해 주세요 예:task.pdf -> task\n"
    "   페이지 정보는 표시하지 마세요\n"
    "2. URL이 비어있는 경우 해당 항목은 참고 자료에 포함하지 마세요.\n"
    "3. 중복 제거: 같은 파일명(URL)과 페이지 번호 조합이 여러 번 나오는 경우 한 번만 표시하세요.\n"
    "   예시: task 여러 검색 결과에 있어도 참고 자료에는 한 번만 표시\n"
    "\n"
    "검색 결과가 충분하지 않거나 관련 정보가 없는 경우에도 최선을 다해 답변하고, "
    "추가 질문을 유도하는 방식으로 응답하세요. "
    "불확실한 부분이 있다면 명시하되, 항상 긍정적이고 도움이 되는 톤으로 답변하세요."
)
