# LLM Master Agent — 실시간 전력 관리 시스템

Azure OpenAI(gpt-4o) + Agent-to-Agent(A2A) 프로토콜 기반으로 Master Agent가
실시간 전력 데이터를 수신하여 **전력 예측 → 가격 결정 → Prosumer 실행계획**을 자동 오케스트레이션합니다.

---

## 파일 구성

```
realtime/
  llm_master_agent.py      # Master Agent 핵심 구현 (신규)
  agents.py                # 기존 하위 에이전트 (ForecastAgent, PriceAgent 등)
  orchestrator.py          # 기존 실시간 사이클 오케스트레이터
  config.py                # RealtimeConfig
  __init__.py              # MasterAgent 등 신규 심볼 export 추가

demos/
  run_master_agent_demo.py # Master Agent 실행 진입점 (신규)
```

---

## 아키텍처

### Agent-to-Agent (A2A) 프로토콜 흐름

```
MasterAgent (Azure OpenAI gpt-4o — function calling)
  │
  ├─[A2A Tool #1]─→ DataLoaderSubAgent  : fetch_realtime_data
  │                  └─ pkl 파일 또는 합성 데이터에서 프로슈머·시계열 로드
  │
  ├─[A2A Tool #2]─→ ForecastSubAgent    : run_energy_forecast
  │                  └─ CTDE(Centralized Training, Decentralized Execution)
  │                     각 프로슈머가 로컬 데이터만으로 전력 소비량·발전량 예측
  │
  ├─[A2A Tool #3]─→ PriceSubAgent       : run_price_market
  │                  └─ 전체 수급 집계 → P2P 동적 가격 결정
  │                     (grid_sell_price < P2P price < grid_buy_price)
  │
  └─[A2A Tool #4]─→ PlannerSubAgent     : generate_prosumer_plan
                     └─ 프로슈머별 ESS 충방전 · P2P 거래 · 계통 연계 실행계획
                        LLM이 결과를 종합하여 한국어 운영 전략 생성
```

- LLM이 각 툴 호출 순서·파라미터를 자율 결정 (`tool_choice="auto"`)
- Azure OpenAI API 키가 없으면 순차 실행 fallback 자동 적용

### 주요 클래스

| 클래스 | 위치 | 역할 |
|---|---|---|
| `MasterAgent` | `realtime/llm_master_agent.py` | LLM 기반 오케스트레이터 |
| `DataLoaderSubAgent` | 동일 | 실시간 데이터 로드 |
| `ForecastSubAgent` | 동일 | CTDE 전력 예측 |
| `PriceSubAgent` | 동일 | P2P 가격 결정 |
| `PlannerSubAgent` | 동일 | 프로슈머 실행계획 생성 |
| `ProsumerAction` | 동일 | 프로슈머 1개 시점 행동 (ESS·P2P·계통) |
| `ProsumerExecutionPlan` | 동일 | 전체 실행계획 + LLM 전략 텍스트 |

---

## 환경 설정

### 1. 패키지 설치

```bash
pip install openai python-dotenv pandas numpy scikit-learn
```

### 2. `.env` 파일 설정 (프로젝트 루트)

```env
AZURE_OPENAI_ENDPOINT=https://<your-resource>.openai.azure.com/
AZURE_OPENAI_API_KEY=<your-api-key>
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-08-01-preview
```

> API 키 없이도 실행 가능 — 하위 에이전트 순차 실행(fallback)으로 동작합니다.

---

## 실행 방법

### 기본 실행 (합성 데이터, 24시간 구간)

```bash
python demos/run_master_agent_demo.py
```

### pkl 데이터 + 구간 지정

```bash
python demos/run_master_agent_demo.py \
  --pkl data/paper_reproduction_dataset_from_screenshot_schema.pkl \
  --steps 96
```

### 복수 사이클 반복 실행

```bash
python demos/run_master_agent_demo.py --cycles 3
```

### 전체 실행계획 상세 출력

```bash
python demos/run_master_agent_demo.py --show-plans
```

### 전략 선택

```bash
# 비용 최소화 (기본)
python demos/run_master_agent_demo.py --strategy cost_minimize

# P2P 거래 극대화
python demos/run_master_agent_demo.py --strategy p2p_maximize

# ESS 우선 충전
python demos/run_master_agent_demo.py --strategy ess_priority
```

### 출력 간소화

```bash
python demos/run_master_agent_demo.py --quiet
```

### 전체 옵션 보기

```bash
python demos/run_master_agent_demo.py --help
```

---

## 실행 결과 예시

```
======================================================================
[Master Agent] 사이클 #0 시작 — 2026-03-08 02:50
[Master Agent] 분석 구간: 48 스텝 (12시간)
======================================================================

[A2A] MasterAgent → fetch_realtime_data({"n_history_steps":48})
[A2A] MasterAgent → run_energy_forecast({"rolling_window":4})
[A2A] MasterAgent → run_price_market({...})
[A2A] MasterAgent → generate_prosumer_plan({"strategy":"cost_minimize",...})

[Master Agent] 실시간 전력 관리 전략 요약 (LLM 생성):
  - 잉여 전력 프로슈머: P2P 판매 우선 (122.6원 > 계통판매 90원)
  - 부족 전력 프로슈머: ESS 방전으로 수요 충족
  - ESS SOC < 20% 프로슈머: 방전 억제, idle 유지

======================================================================
[Master Agent] 사이클 #0 완료
  프로슈머 수    : 10
  시장 사이클 수 : 48
  마지막 P2P 가격: 122.61 원/kWh
  잉여/부족/매칭 : 0.936 / 2.476 / 2.476 kWh

  [실행계획 — 2026-03-04 17:45:00] P2P: 122.6 원/kWh
  ID       역할     ESS                P2P거래(kWh)  계통      비용(원)
  -----------------------------------------------------------------------
  bus_1    buyer    discharge(-2.48kW)        0.000  none         0.0
  bus_6    seller   idle(+0.00kW)            -0.156  none       -19.2
  bus_9    seller   idle(+0.00kW)            -0.467  none       -57.2
  ...
======================================================================
```

---

## Prosumer 실행계획 로직

| 상황 | 전략 (cost_minimize 기준) |
|---|---|
| 잉여 전력, P2P 가격 유리 | P2P 판매 우선 |
| 잉여 전력, P2P 마진 부족 | ESS 충전 → 나머지 계통 판매 |
| 잉여 전력, ESS 우선 전략 | ESS 충전 |
| 부족 전력, ESS 충분 | ESS 방전으로 수요 충족 |
| 부족 전력, P2P 가격 유리 | P2P 구매 |
| 부족 전력, P2P 가격 불리 | 계통 구매 |
| ESS SOC < 20% | 방전 억제 (idle) |

### 가격 결정 범위

```
계통 판매 단가 (90원) < P2P 가격 < 계통 구매 단가 (180원)
                        ↑ 수급 불균형에 따라 동적 조정
```

---

## 코드에서 직접 사용

```python
from dotenv import load_dotenv
load_dotenv(".env")

from realtime.config import RealtimeConfig
from realtime.llm_master_agent import MasterAgent, print_execution_plan

config = RealtimeConfig()
config.pkl_path = None  # None이면 합성 데이터 사용

master = MasterAgent(config=config)
result = master.run_cycle(n_history_steps=96, verbose=True, cycle_id=0)

# 마지막 실행계획 출력
if result["execution_plans"]:
    print_execution_plan(result["execution_plans"][-1])

# 결과 구조
# result["summary"]          - 사이클 요약 dict
# result["execution_plans"]  - List[ProsumerExecutionPlan]
# result["market_results"]   - List[MarketResult]
# result["llm_strategy"]     - LLM이 생성한 운영 전략 텍스트
```
