# 실시간 전력 예측·가격 결정 시스템 (LLM + Agent-to-Agent)

실시간 전력 생산 데이터를 활용해 **전력 예측**과 **P2P 가격 결정**을 수행하는 Agent-to-Agent 파이프라인입니다.

## 구성

| 역할 | 모듈 | 설명 |
|------|------|------|
| **전력 예측** | `forecast/forecast.py` | CommunityEnergyForecastAgent (OpenWeather + LLM 보정) |
| **가격 결정** | `price/predict_price.py` | P2PPricingEngine (수급 기반 P2P 가격) |
| **거래 참여자** | `data` 내 agent/action | prosumers(agent) + timeseries(action) |

- **Agent**: data 내 `prosumers` 테이블의 버스별 프로슈머(agent)
- **Action**: data 내 `timeseries`의 `bess_ref_power_kw`, `controllable_load_kw` 등

## 실행

```bash
# 프로젝트 루트에서 (데모는 demos/ 디렉터리에 있음)
python demos/run_realtime_system.py

# 옵션
python demos/run_realtime_system.py --pkl data/paper_reproduction_dataset_from_screenshot_schema.pkl
python demos/run_realtime_system.py --steps 192          # 실시간 구간 192스텝(15분 단위)
python demos/run_realtime_system.py --no-forecast        # 전력 예측 단계 생략
python demos/run_realtime_system.py --quiet              # 상세 시장 결과 출력 생략
python demos/run_realtime_system.py --no-ctde           # CTDE 비활성화(전역 예측 방식)
```

**로그**: `logs/` 디렉터리에 저장됩니다.

## 데이터

- **pkl 있음**: `data/paper_reproduction_dataset_from_screenshot_schema.pkl` 사용  
  - `prosumers` → agent, `timeseries` → action(실시간 구간)
- **pkl 없음**: 합성 데이터로 자동 실행 (테스트용)

## 환경 변수 (선택)

- `OPENWEATHER_API_KEY`: 전력 예측용 OpenWeather 5day/3h 예보
- `LLM_API_KEY`, `LLM_ENDPOINT`: forecast LLM 보정 (미설정 시 규칙 기반 fallback)
- `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`: 실시간 데모 LLM 연동 시 사용

## 실시간 10 에이전트 데모 (15분 간격 + LLM)

10개 Agent에 15분 간격 데이터가 발생했을 때, 데이터 확인 후 LLM으로 전력사용량 예측·가격 예측·거래 실행 계획을 수립하고 실제 시장 실행:

```bash
python demos/run_realtime_demo_10agents.py
python demos/run_realtime_demo_10agents.py --steps 6
```

단계: [1] 데이터 확인 → [2] LLM 전력예측 → [3] LLM 가격예측 → [4] LLM 거래계획 → [5] 실제 실행. 로그: `logs/run_realtime_demo_10agents.log`, LLM 호출 시 `logs/use_llm.log` 및 콘솔.

## 10개 원천 실시간 데모 데이터 데모 (태양광·ESS·부하 각기 다른 원천)

**10개 각기 다른 원천**에서 발생하는 태양광·ESS·부하 실시간 데모 데이터로 동작하는 데모:

- **데이터 원천**: `realtime/demo_sources.py` — 원천 1~10 (주거 아침형, 주거 저녁형, 상가, 소규모 공장, 태양광 중심, ESS 중심, 부하 중심, 평형형, 야간 부하형, 피크 커팅형)
- **실행**:
  ```bash
  python demos/run_realtime_demo_10sources.py
  python demos/run_realtime_demo_10sources.py --steps 6
  python demos/run_realtime_demo_10sources.py --realtime   # 15분 간격 실제 대기
  ```
- API 키 미설정 시 규칙 기반으로 자동 폴백 (LLM 전용 옵션 없음). CTDE 방식은 `demos/run_realtime_system.py`(use_ctde) 또는 `demos/run_realtime_ctde.py` 사용.
- 로그: `logs/run_realtime_demo_10sources.log`, 원천별 `logs/run_realtime_demo_10sources_bus_1.log` ~ `_bus_10.log`

## 파이프라인 흐름

1. **데이터 로드**: pkl 또는 합성 데이터 → prosumers(agent) + timeseries(action)
2. **이력 집계**: 최근 구간 시계열 → 3시간 단위 community 이력
3. **ForecastAgent**: 전력 예측 (forecast.py) → 부하/PV 예측치
4. **ProsumerAgent**: 시점별 timeseries → ParticipantForecast (참여자별 load, PV, ESS)
5. **PriceAgent**: P2P 가격 결정 (predict_price.py) → 시점별 P2P 가격·잉여/부족

## 디렉터리

- `realtime/config.py` — 설정
- `realtime/data_loader.py` — pkl/합성 데이터 로드, 3H 집계
- `realtime/agents.py` — ForecastAgent, PriceAgent, ProsumerAgent
- `realtime/orchestrator.py` — 한 사이클 오케스트레이션
- `demos/run_realtime_system.py` — 실시간 시스템 실행 진입점
- `realtime/llm_realtime.py` — 15분 데이터 시 LLM 연동(전력/가격/거래계획·실행)
- `demos/run_realtime_demo_10agents.py` — 10 에이전트 실시간 데모 (단계별 로그)
- `realtime/demo_sources.py` — 10개 원천별 태양광·ESS·부하 데모 데이터 생성
- `demos/run_realtime_demo_10sources.py` — 10개 원천 데모 데이터 기반 실시간 데모
- `logs/` — 데모·실시간 실행 로그 저장 디렉터리
