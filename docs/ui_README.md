# 전력 P2P 거래 관리 UI (React + FastAPI)

React(Vite) 프론트엔드는 `/api` 요청을 **백엔드 8000 포트**로 프록시합니다.  
백엔드가 떠 있지 않으면 `[vite] http proxy error: /api/run-status` / `ECONNRESET` 가 발생할 수 있습니다.

## 실행 순서

**1. 백엔드 먼저 기동 (프로젝트 루트에서)**

```bash
uvicorn ui.api:app --reload --port 8000
```

**2. 프론트엔드 기동**

```bash
cd ui/react-app
npm install
npm run dev
```

브라우저: http://localhost:5173

- 백엔드를 중단한 상태에서 프론트만 켜두면 2초마다 `/api/run-status` 호출이 실패하며 콘솔에 proxy error가 찍힐 수 있습니다.  
  이 경우 **1번 터미널에서 uvicorn을 실행**한 뒤 새로고침하면 됩니다.
