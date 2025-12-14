import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional

from dotenv import load_dotenv
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from qdrant_client import QdrantClient, models
from qdrant_client.models import FieldCondition, Filter, MatchValue
from langchain_qdrant import QdrantVectorStore

try:
    from app.llm.common.config import get_embeddings, get_llm
except ModuleNotFoundError:  # pragma: no cover - direct script execution
    project_root = Path(__file__).resolve().parents[3]
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))
    from app.llm.common.config import get_embeddings, get_llm


load_dotenv()


@dataclass(frozen=True)
class ChunkingConfig:
    """Holds the markdown chunking parameters in a single place."""

    # chatgpt size: int = 3072
    size: int = 1024 #bedrock
    overlap: int = 100


class MarkdownRagManager:
    """Markdown 문서를 Qdrant DB에 저장하고 검색하는 클래스."""

    def __init__(
        self,
        collection_name: Optional[str] = None,
        qdrant_url: Optional[str] = None,
        chunking: Optional[ChunkingConfig] = None,
    ):
        self.collection_name = (
            collection_name
            or os.getenv("COLLECTION_MANUAL")
        )
        self.qdrant_url = qdrant_url or os.getenv("QDRANT_CLIENT_URL")
        self.qdrant_api_key = os.getenv("QDRANT_API_KEY")
        self.embeddings = get_embeddings()
        self.model = get_llm()
        self.qdrant_client = QdrantClient(url=self.qdrant_url, api_key=self.qdrant_api_key)
        self.vector_store: Optional[QdrantVectorStore] = None
        self.chunking = chunking or ChunkingConfig()

    @staticmethod
    def markdown_path_to_document(markdown_path: str, url: Optional[str] = None) -> Document:
        """단일 Markdown 파일을 Document 객체로 변환."""
        markdown_path = os.path.abspath(markdown_path)
        with open(markdown_path, "r", encoding="utf-8") as md_file:
            content = md_file.read()

        url = url or Path(markdown_path).stem  # 확장자를 제거한 파일명
        return Document(
            page_content=content,
            metadata={
                "source": markdown_path,
                "page": 1,
                "project": "opme",
                "url": url,
                "filename": os.path.basename(markdown_path),
            },
        )

    def split_markdown(
        self,
        markdown_path: str,
        url: Optional[str] = None,
        chunking: Optional[ChunkingConfig] = None,
    ) -> List[Document]:
        """Markdown 문서를 청크 단위로 분할."""
        chunking_config = chunking or self.chunking
        base_document = self.markdown_path_to_document(markdown_path, url)
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunking_config.size,
            chunk_overlap=chunking_config.overlap,
            length_function=len,
            add_start_index=True,
        )
        return text_splitter.split_documents([base_document])

    @staticmethod
    def add_unique_id(chunks: Iterable[Document]) -> List[Document]:
        """각 청크에 고유 ID를 부여."""
        updated_chunks = []
        for chunk in chunks:
            source = chunk.metadata.get("source", "unknown_source")
            page = chunk.metadata.get("page", 0)
            start_index = chunk.metadata.get("start_index", 0)
            chunk.metadata["chunk_id"] = f"{source}_{page}_{start_index}"
            updated_chunks.append(chunk)
        return updated_chunks

    def get_or_create_collection(self) -> str:
        """Qdrant 컬렉션이 없으면 생성."""
        if self.qdrant_client.collection_exists(collection_name=self.collection_name):
            return self.collection_name

        self.qdrant_client.create_collection(
            collection_name=self.collection_name,
            vectors_config=models.VectorParams(size=1024, distance=models.Distance.COSINE),
        )
        return self.collection_name

    def get_chunk_by_chunk_id(self, chunk_id: str) -> Optional[Dict]:
        """청크 ID로 기존 데이터를 조회."""
        try:
            points, _ = self.qdrant_client.scroll(
                collection_name=self.collection_name,
                scroll_filter=Filter(must=[FieldCondition(key="chunk_id", match=MatchValue(value=chunk_id))]),
                limit=1,
                with_payload=True,
                with_vectors=False,
            )
        except Exception as exc:  # pragma: no cover - defensive logging
            print(f"Error retrieving chunk: {exc}")
            return None

        if points:
            return {"point_id": points[0].id, "payload": points[0].payload}
        return None

    def add_to_qdrant(self, chunks: List[Document]) -> QdrantVectorStore:
        """청크를 Qdrant에 저장."""
        self.get_or_create_collection()

        new_chunks = [chunk for chunk in chunks if not self.get_chunk_by_chunk_id(chunk.metadata["chunk_id"])]
        if not new_chunks:
            if not self.vector_store:
                self.vector_store = QdrantVectorStore(
                    client=self.qdrant_client,
                    collection_name=self.collection_name,
                    embedding=self.embeddings,
                )
            print("No new chunks to add to Qdrant")
            return self.vector_store

        print(f"Adding {len(new_chunks)} markdown chunks to Qdrant")
        self.vector_store = QdrantVectorStore.from_documents(
            new_chunks,
            self.embeddings,
            collection_name=self.collection_name,
            url=self.qdrant_url,
            api_key=self.qdrant_api_key,
            force_recreate=False,
        )
        return self.vector_store

    def search(self, query: str, top_k: int = 5) -> List[Dict]:
        """쿼리로 문서를 검색."""
        if not self.vector_store:
            self.vector_store = QdrantVectorStore(
                client=self.qdrant_client,
                collection_name=self.collection_name,
                embedding=self.embeddings,
            )

        results = self.vector_store.similarity_search_with_score(query, k=top_k)
        formatted_results = []
        for doc, score in results:
            formatted_results.append(
                {
                    "content": doc.page_content,
                    "url": doc.metadata.get("url", ""),
                    "filename": doc.metadata.get("filename", ""),
                    "page": doc.metadata.get("page", 0),
                    "source": doc.metadata.get("source", ""),
                    "score": float(score),
                }
            )
        return formatted_results

    def process_markdown_file(
        self,
        markdown_path: str,
        url: Optional[str] = None,
        chunking: Optional[ChunkingConfig] = None,
    ) -> QdrantVectorStore:
        """Markdown 파일 하나를 처리해 Qdrant에 저장."""
        chunking_config = chunking or self.chunking
        print(f"Processing Markdown: {markdown_path}")
        chunks = self.split_markdown(markdown_path, url, chunking_config)
        chunks = self.add_unique_id(chunks)
        vector_store = self.add_to_qdrant(chunks)
        print(f"Successfully processed Markdown: {markdown_path}")
        return vector_store

    def process_directory(
        self,
        directory: Optional[str] = None,
        pattern: str = "*.md",
        chunking: Optional[ChunkingConfig] = None,
    ) -> Dict[str, QdrantVectorStore]:
        """디렉터리 내의 모든 Markdown 파일을 처리."""
        chunking_config = chunking or self.chunking
        base_dir = Path(__file__).resolve().parents[3] / "manual" / "docs"
        path = (base_dir / directory).resolve() if directory else base_dir
        if not path.is_dir():
            raise ValueError(f"Directory not found: {path}")

        processed: Dict[str, QdrantVectorStore] = {}
        for markdown_file in sorted(path.rglob(pattern)):
            store = self.process_markdown_file(
                str(markdown_file),
                url=markdown_file.stem,
                chunking=chunking_config,
            )
            processed[str(markdown_file)] = store
        return processed


if __name__ == "__main__":
    markdown_path = os.getenv("MARKDOWN_PATH")
    markdown_dir = os.getenv("MARKDOWN_DIR")

    manager = MarkdownRagManager()

    if markdown_dir:
        cleaned_dir = markdown_dir.strip()
        print(f"Processing markdown directory: {cleaned_dir or '.'}")
        manager.process_directory(cleaned_dir or None)
    elif markdown_path:
        manager.process_markdown_file(markdown_path)
    else:
        print("No MARKDOWN_PATH or MARKDOWN_DIR provided; processing default manual/docs directory.")
        manager.process_directory()
