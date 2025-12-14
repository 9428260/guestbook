import os
import sys

# Add the project root and llm directory to sys.path to enable imports
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
llm_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
if llm_root not in sys.path:
    sys.path.insert(0, llm_root)

from dotenv import load_dotenv
from langchain_openai import AzureChatOpenAI, AzureOpenAIEmbeddings
from qdrant_client import QdrantClient
from app.llm.common.logger import FileLogger
from typing import List

try:
    from langchain_aws import ChatBedrock, BedrockEmbeddings
except ImportError:  # langchain_aws is optional
    ChatBedrock = None
    BedrockEmbeddings = None

# .env 파일에서 환경 변수 로드
load_dotenv()

logger = FileLogger(log_dir="llm_logs", log_file="config.log")


def make_qdrant_client() -> QdrantClient:
    
    url = os.getenv("QDRANT_CLIENT_URL", "http://localhost:6333")
    api_key = os.getenv("QDRANT_API_KEY") or None
    return QdrantClient(url=url, api_key=api_key)


def get_llm():
    """
    AzureChatOpenAI for query rewrite (optional).
    If env missing, returns None and we use raw query.
    """
    bedrock_region = os.getenv("BEDROCK_REGION")
    bedrock_chat_model = os.getenv("BEDROCK_CHAT_MODEL")
    bedrock_max_tokens_env = os.getenv("BEDROCK_MAX_TOKENS")
    bedrock_max_tokens = None
    if bedrock_max_tokens_env:
        try:
            bedrock_max_tokens = int(bedrock_max_tokens_env)
        except ValueError:
            logger.info(f"⚠️ Invalid BEDROCK_MAX_TOKENS: {bedrock_max_tokens_env}")

    if ChatBedrock and bedrock_region and bedrock_chat_model:
        try:
            bedrock_kwargs = {
                "model_id": bedrock_chat_model,
                "region_name": bedrock_region,
                "temperature": float(os.getenv("BEDROCK_TEMPERATURE", "0.2")),
            }
            if bedrock_max_tokens is not None:
                bedrock_kwargs["max_tokens"] = bedrock_max_tokens
            
            return ChatBedrock(**bedrock_kwargs)
        except Exception as e:
            logger.info(f"❌ ChatBedrock: {e}")


def get_embeddings():
    """
    BedrockEmbeddings
    """
    bedrock_region = os.getenv("BEDROCK_REGION")
    bedrock_embedding_model = os.getenv("BEDROCK_EMBEDDING_MODEL")
    if BedrockEmbeddings and bedrock_region and bedrock_embedding_model:
        try:
            bedrock_kwargs = {
                "model_id": bedrock_embedding_model,
                "region_name": bedrock_region,
            }
            
            return BedrockEmbeddings(**bedrock_kwargs)
        except Exception as e:
            logger.info(f"❌ BedrockEmbeddings: {e}")


def test_bedrock_connection(test_prompt: str = "ping") -> bool:
    """
    Attempts a lightweight Bedrock chat invocation to verify connectivity.
    Returns True on success, False otherwise.
    """
    bedrock_region = os.getenv("BEDROCK_REGION")
    bedrock_chat_model = os.getenv("BEDROCK_CHAT_MODEL")

    if not (ChatBedrock and bedrock_region and bedrock_chat_model):
        logger.info("⚠️ Bedrock test skipped (missing langchain_aws or BEDROCK_* env vars).")
        return False

    try:
        bedrock_kwargs = {
            "model_id": bedrock_chat_model,
            "region_name": bedrock_region,
            "temperature": float(os.getenv("BEDROCK_TEMPERATURE", "0.0")),
        }
        
        client = ChatBedrock(**bedrock_kwargs)
        client.invoke(test_prompt)
        logger.info("✅ Bedrock connection test succeeded.")
        return True
    except Exception as e:
        logger.info(f"❌ Bedrock connection test failed: {e}")
        return False


if __name__ == "__main__":
    # Test Bedrock connection
    success = test_bedrock_connection()
    status = "SUCCESS" if success else "FAILED"
    print(f"[Bedrock Test] {status}")

    # Test embeddings
    print("\n[Embeddings Test]")
    try:
        embeddings = get_embeddings()
        test_text = "This is a test sentence for embeddings."
        embedding_vector = embeddings.embed_query(test_text)
        print(f"✅ Embeddings initialized successfully")
        print(f"   Type: {type(embeddings).__name__}")
        print(f"   Vector dimension: {len(embedding_vector)}")
        print(f"   Sample values: {embedding_vector[:5]}")
    except Exception as e:
        print(f"❌ Embeddings test failed: {e}")

    # Test Qdrant client
    print("\n[Qdrant Client Test]")
    try:
        client = make_qdrant_client()
        collections = client.get_collections()
        print(f"✅ Qdrant client initialized successfully")
        print(f"   URL: {client._client.rest_uri if hasattr(client, '_client') else 'N/A'}")
        print(f"   Collections count: {len(collections.collections)}")
        if collections.collections:
            print(f"   Collections: {[c.name for c in collections.collections]}")
    except Exception as e:
        print(f"❌ Qdrant client test failed: {e}")

    # Test LLM
    print("\n[LLM Test]")
    try:
        llm = get_llm()
        if llm is None:
            print(f"⚠️ LLM is None (no credentials configured)")
        else:
            print(f"✅ LLM initialized successfully")
            print(f"   Type: {type(llm).__name__}")

            # Test with a simple prompt
            test_prompt = "Say 'Hello' in one word."
            response = llm.invoke(test_prompt)
            print(f"   Test prompt: {test_prompt}")
            print(f"   Response: {response.content if hasattr(response, 'content') else response}")
    except Exception as e:
        print(f"❌ LLM test failed: {e}")