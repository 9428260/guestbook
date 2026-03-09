# 전력 P2P 거래 관리 시스템 — React UI

Streamlit 앱(`../app.py`)과 동일한 기능을 React + FastAPI로 구현한 프론트엔드입니다.

## 실행 방법

### 1. 백엔드 API (필수)

프로젝트 루트에서:

```bash
# 의존성 (최초 1회)
pip install -r ui/requirements-api.txt

# API 서버 (포트 8000)
uvicorn ui.api:app --reload --port 8000
```

### 2. React 앱

```bash
cd ui/react-app
npm install
npm run dev
```

브라우저에서 http://localhost:5173 접속.

## 기능

- **사이드바**: 분석 구간(15분 단위), Prosumer 전략, 실제 데이터(pkl) 사용 여부, Master Agent 실행 버튼, 마지막 실행 결과 메트릭
- **메트릭 바**: 사이클 #, P2P 가격, 체결 건수, 거래량, 총 거래 대금
- **탭**
  - **실행현황**: A2A 파이프라인 상태, LLM 운영 전략, Agent 실행 로그
  - **예측 & 가격**: P2P 가격 추이 차트, 수급 현황·체결량 차트, 가격·수급 테이블
  - **실행계획**: 마지막 시점 실행계획 테이블, 프로슈머 역할 파이 차트
  - **거래이력**: P2P 거래 테이블(필터/건수), 시각별 체결 건수 차트, 시장 사이클 이력
  - **통계**: DB 누적 통계, 프로슈머별 거래량 차트, 프로슈머별 거래 통계 테이블

## API 프록시

`vite.config.ts`에서 `/api` 요청을 `http://127.0.0.1:8000`으로 프록시하므로, React 앱과 API를 각각 5173, 8000에서 띄우면 됩니다.
