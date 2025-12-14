---
title: 매뉴얼 개요
---

# Markdown 문서 작성 및 MkDocs 사용법

MkDocs는 Markdown 기반의 문서를 정적 사이트로 빌드할 수 있는 도구입니다. 프로젝트의 `manual/mkdocs.yml` 파일을 이용해 문서 구조와 테마(Material)를 정의하고 있으며, 모든 문서는 `manual/docs` 디렉터리에 Markdown 파일로 저장되어 있습니다.

## Markdown 기본 규칙

- 제목: `#`, `##` 등 샤프(`#`) 기호를 사용합니다.
- 목록: `-` 또는 `1.`을 이용해 순서 없는/있는 목록을 작성합니다.
- 코드 블록: 백틱 세 개(<code>```</code>)로 감싸고 언어 이름을 지정하면 강조 표시가 적용됩니다.
- 링크: `[표시 텍스트](URL)` 형태로 작성합니다.
- 이미지: `![대체 텍스트](이미지 경로)`를 사용합니다.

```markdown
## 예시

- 기본 목록 항목
- **굵은 텍스트**와 _이탤릭_을 함께 사용할 수 있습니다.

```python
print("코드 블록 예시")
```

자세한 문법은 [MkDocs](https://www.mkdocs.org/)와 [Markdown 가이드](https://www.markdownguide.org/basic-syntax/)를 참고하세요.
```

## MkDocs로 문서 미리보기

문서를 작성한 뒤 `manual` 디렉터리에서 다음 명령을 실행하면 로컬 서버에서 변경 사항을 확인할 수 있습니다.

```bash
cd manual
mkdocs serve
```

정적 사이트를 빌드하려면 `mkdocs build`를 실행합니다. 생성된 파일은 `manual/site`(또는 `mkdocs.yml`에서 설정한 `site_dir`)에 저장됩니다.

# MarkdownRagManager 사용법

`app/llm/retrieval/markdown_rag.py`는 `manual/docs`에 있는 모든 Markdown 파일을 Qdrant 백터 데이터베이스에 적재해 검색용 인덱스를 구축합니다.

## 기본 실행

```bash
python app/llm/retrieval/markdown_rag.py
```

환경 변수를 지정하지 않으면 `manual/docs` 디렉터리의 모든 `.md` 파일이 자동으로 처리됩니다.

## 실행 옵션

- `MARKDOWN_DIR`: 기본 디렉터리(`manual/docs`) 아래의 하위 폴더만 처리합니다.
  ```bash
  MARKDOWN_DIR=subfolder python app/llm/retrieval/markdown_rag.py
  ```
- `MARKDOWN_PATH`: 개별 Markdown 파일만 인덱싱하고 싶을 때 사용합니다.
  ```bash
  MARKDOWN_PATH=manual/docs/example.md python app/llm/retrieval/markdown_rag.py
  ```

실행 시 `.env`에 설정된 `QDRANT_CLIENT_URL`, `COLLECTION_MARKDOWN` 값을 사용하며, 없을 경우 `COLLECTION_MANUAL` 또는 기본 컬렉션 이름이 사용됩니다. 의존성은 `pip install -r requirements.txt`로 설치하세요.

# Whitenoise 소개

Whitenoise는 정적 파일을 WSGI 애플리케이션과 함께 서빙하기 위한 파이썬 라이브러리입니다. 이 프로젝트에서는 Flask 애플리케이션 초기화 시 `WhiteNoise`를 통해 `opmedocs/` 디렉터리의 정적 자산을 공급하도록 구성되어 있습니다(`app/__init__.py` 참고). Whitenoise를 사용하면 별도의 프록시 서버 없이도 정적 파일을 효율적으로 제공할 수 있어 배포 구성이 단순해집니다.
