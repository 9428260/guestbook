import os
import sys

import boto3
from botocore.exceptions import NoCredentialsError, ClientError

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


CROSS_ACCOUNT_ENABLED = True
CROSS_ACCOUNT_ROLE_ARN = "arn:aws:iam::046492796127:role/opmate-prd-bedrock-assume-role"
CROSS_ACCOUNT_SESSION_NAME = "opmate-prd-bedrock-cross-account"

def check_aws_credentials():
    """
    AWS 자격증명 가용성을 확인합니다.
    EKS ServiceAccount 기반 인증, 환경변수 기반 인증, 그리고 Cross-Account assume role을 지원합니다.

    Returns:
        tuple: (has_credentials: bool, region: str or None, auth_method: str, cross_account_session: boto3.Session or None)
    """
    try:
        # AWS 세션 생성 (기본 자격증명 체인 사용)
        session = boto3.Session()

        # 자격증명 확인
        credentials = session.get_credentials()
        if credentials is None:
            return False, None, "no_credentials", None

        # 리전 확인
        region = session.region_name or os.environ.get("BEDROCK_REGION", "ap-northeast-2")

        # STS를 사용하여 자격증명 유효성 검증
        sts_client = session.client('sts', region_name=region)
        caller_identity = sts_client.get_caller_identity()

        # 인증 방법 확인
        if credentials.access_key and credentials.secret_key:
            if credentials.token:
                # ServiceAccount 기반 (임시 자격증명)
                auth_method = "serviceaccount"
            else:
                # 환경변수 기반 (영구 자격증명)
                auth_method = "environment"
        else:
            auth_method = "unknown"

        cross_account_session = None
        
        # Cross-Account 설정이 활성화된 경우 assume role 수행
        if CROSS_ACCOUNT_ENABLED and CROSS_ACCOUNT_ROLE_ARN:
            try:
                # Assume role 수행
                response = sts_client.assume_role(
                    RoleArn=CROSS_ACCOUNT_ROLE_ARN,
                    RoleSessionName=CROSS_ACCOUNT_SESSION_NAME
                )
                
                # 새로운 자격증명으로 세션 생성
                assumed_credentials = response['Credentials']
                cross_account_region = region  # 동일한 리전 사용
                
                cross_account_session = boto3.Session(
                    aws_access_key_id=assumed_credentials['AccessKeyId'],
                    aws_secret_access_key=assumed_credentials['SecretAccessKey'],
                    aws_session_token=assumed_credentials['SessionToken'],
                    region_name=cross_account_region
                )
                
                # Cross-account 자격증명 유효성 확인
                cross_sts = cross_account_session.client('sts')
                cross_caller_identity = cross_sts.get_caller_identity()
                
                auth_method = f"{auth_method}_cross_account"
                region = cross_account_region
                
            except (ClientError, Exception) as e:
                # Cross-account assume role 실패 시 기본 자격증명 사용
                cross_account_session = None

        return True, region, auth_method, cross_account_session

    except (NoCredentialsError, ClientError) as e:
        return False, None, f"error: {str(e)}", None
    except Exception as e:
        return False, None, f"error: {str(e)}", None


def make_qdrant_client() -> QdrantClient:
    
    url = os.getenv("QDRANT_CLIENT_URL", "http://localhost:6333")
    api_key = os.getenv("QDRANT_API_KEY") or None
    return QdrantClient(url=url, api_key=api_key)


def get_llm():
    """
    ChatBedrock
    """
    bedrock_chat_model = os.getenv("BEDROCK_CHAT_MODEL")
    bedrock_max_tokens_env = os.getenv("BEDROCK_MAX_TOKENS")
    bedrock_max_tokens = None
    if bedrock_max_tokens_env:
        try:
            bedrock_max_tokens = int(bedrock_max_tokens_env)
        except ValueError:
            logger.info(f"⚠️ Invalid BEDROCK_MAX_TOKENS: {bedrock_max_tokens_env}")

    # ServiceAccount 기반 인증을 위해 기본 자격증명 체인 사용
    has_credentials, region, auth_method, cross_account_session = check_aws_credentials()

    if not has_credentials:
        return None
    
    # Cross-account 세션이 있으면 사용, 없으면 기본 자격증명 사용
    if cross_account_session:
        # Cross-account 자격증명을 사용하여 Bedrock 클라이언트 생성
        bedrock_client = cross_account_session.client('bedrock-runtime')
        
        model = ChatBedrock(
            client=bedrock_client,
            model_id=bedrock_chat_model,
            model_kwargs={
                "temperature": 0.1,
                "max_tokens": bedrock_max_tokens,
            },
        )
        return model
    else:
        return None


def get_embeddings():
    """
    BedrockEmbeddings
    """
    bedrock_region = os.getenv("BEDROCK_REGION")
    bedrock_embedding_model = os.getenv("BEDROCK_EMBEDDING_MODEL")

    has_credentials, region, auth_method, cross_account_session = check_aws_credentials()

    if not has_credentials:
        return None
    
    # Cross-account 세션이 있으면 사용, 없으면 기본 자격증명 사용
    if cross_account_session:
        # Cross-account 자격증명을 사용하여 Bedrock 클라이언트 생성
        bedrock_client = cross_account_session.client('bedrock-runtime')
        
        model = BedrockEmbeddings(
            client=bedrock_client,
            model_id=bedrock_embedding_model
        )
        return model
    else:
        return None


if __name__ == "__main__":
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
