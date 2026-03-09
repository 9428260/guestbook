# 가격결정 Agent MARL 전환 검토

## 구현 완료 (방식 B — CTDE 확장)

다음이 구현되어 있습니다.

- **Config** (`marl/config.py`): `use_price_agent`, `price_min`, `price_max`, `price_actor_hidden_dim`
- **Env** (`marl/env.py`): `step(actions, price_override=None)` — `price_override`가 있으면 해당 P2P 가격 사용
- **Replay** (`marl/replay.py`): `use_price_agent`일 때 `price` 필드 저장/샘플
- **Networks** (`marl/networks.py`): `PriceActor` (state → 가격 1개), `CentralizedCritic(state_dim=...)`, `ValueNet(state_dim=...)`
- **Agent** (`marl/agent.py`): `select_actions(obs, state_np=...)` → `(actions, price)`, 가격 액터 손실 반영, 체크포인트/정책 저장·로드 시 `price_actor` 포함
- **Train** (`marl/train.py`): `(actions, price) = agent.select_actions(obs, state_np=state)`, `env.step(actions, price_override=price)`, `replay.add(..., price=price)`

`use_price_agent=False`면 기존과 동일하게 동작합니다.

---

## 1. 현재 구조 요약

### 1.1 가격결정 Agent (규칙 기반)

- **위치:** `price/predict_price.py` — `P2PPricingEngine`
- **입력:** `(timestamp, forecasts: List[ParticipantForecast])`
- **출력:** `MarketResult` (단일 스칼라 `p2p_price` [원/kWh], 수급·매칭량 등)
- **로직:**  
  `effective_supply`, `effective_demand` → `imbalance_ratio` →  
  `raw_price = base_p2p_price + sensitivity * imbalance_ratio` →  
  `grid_sell + min_margin ≤ final_price ≤ grid_buy - max_discount` 클리핑

### 1.2 MARL 학습 환경에서의 가격

- **`marl/env.py` (P2PEnergyEnv):**  
  P2P 가격은 **데이터셋 시계열** `arr["price_p2p"][t]`에서 읽음.  
  즉, **가격결정 Agent는 학습 루프에 관여하지 않음.**
- **실시간 파이프라인:**  
  전력예측(CTDE) → `ParticipantForecast` 생성 → **P2PPricingEngine.run_market()** 호출 → `p2p_price` 사용.

---

## 2. MARL 전환 가능성 결론

**가능함.** 다만 “가격결정”을 MARL로 만드는 방식은 여러 가지가 있고, 각각 **에이전트 정의·보상·데이터**가 달라짐.

| 방식 | 에이전트 수/역할 | MARL 여부 | 구현 난이도 | 비고 |
|------|------------------|-----------|-------------|------|
| A. 단일 가격 정책 (RL) | 1 (중앙 가격 결정자) | ❌ 단일 에이전트 RL | 중 | 가장 직관적, 기존 엔진 대체 용이 |
| B. CTDE 확장 (가격 에이전트 1개 추가) | n_prosumer + 1 (가격 1) | ✅ CTDE 내 “가격 액터” 1개 | 중상 | 기존 `LLMGuidedCTDE` 확장 |
| C. 다중 에이전트 가격 (진짜 MARL) | 여러 “가격 제안” 에이전트 | ✅ MARL | 상 | 설계·검증 부담 큼 |

---

## 3. 방식별 설계 요약

### 3.1 방식 A: 단일 에이전트 RL (가격 정책 1개)

- **에이전트:** 1개. “중앙 시장 운영자”가 **상태**를 보고 **P2P 가격(또는 가격 조정치)** 한 개 출력.
- **상태 (s):**  
  `(total_surplus, total_deficit, ess_supply, grid_buy, grid_sell, base_p2p, time_norm, 이전 가격, …)`  
  → 필요 시 `ParticipantForecast` 요약 통계만 사용해도 됨.
- **행동 (a):**  
  - 연속: 스칼라 `Δp` → `p2p_price = base + scale * tanh(Δp)`  
  - 또는 연속 스칼라를 `[min_price, max_price]` 구간으로 스케일.
- **보상 (r):**  
  - 예: `-total_system_cost` (전체 비용 최소화),  
  - 또는 `matched_energy - α * price_volatility`,  
  - 또는 `social_welfare` 형태 (구매자/판매자 잉여 합).
- **환경:**  
  - `run_market()` 대신 “가격 정책 π(a|s)” 호출 → `p2p_price` 결정 → 기존처럼 `MarketResult` 생성 후 하류(실행계획·거래중개)에서 사용.
- **장점:**  
  - 설계 단순, 기존 `P2PPricingEngine`을 “규칙 대신 정책”으로만 바꾸면 됨.  
  - 실시간 연동 시 `PriceSubAgent`에서 `engine.run_market()` 대신 학습된 정책 추론만 넣으면 됨.
- **단점:**  
  - MARL이 아니라 **단일 에이전트 RL**임.

---

### 3.2 방식 B: CTDE 확장 — 프로슈머 N명 + 가격 에이전트 1명

- **에이전트:**  
  - 기존: n_agents = 프로슈머 수 (각자 `[P_CDG, P_RDG, Q_RDG, P_BESS, P_CL]`).  
  - 추가: **가격 에이전트 1명** — 전역 상태만 보고 **P2P 가격 1개** 출력.
- **구조:**  
  - **Centralized Critic:**  
    기존처럼 `(state, obs_all, actions_all)` 사용.  
    단, `state`에 “현재 수급 요약(total_surplus, total_deficit 등)” 포함,  
    `actions_all`에 “가격 에이전트의 행동(스칼라)” 포함.  
  - **Actor:**  
    - 프로슈머: 기존과 동일 (자기 obs만 사용).  
    - 가격: 전역 `state`만 입력으로 하는 정책 1개 → 출력 1차원 (가격 또는 조정치).
- **환경 변경:**  
  - `marl/env.py`의 `step()`에서 `price_p2p`를 **데이터셋이 아니라 “가격 에이전트 행동”**으로 채움.  
  - 즉, 매 step에서 (프로슈머 행동 선택 후) 수급이 정해지면, 가격 에이전트가 그 시점의 state를 보고 가격을 내고, 그 가격으로 비용/보상 계산.
- **보상:**  
  - 기존과 동일한 팀 보상 `r = -total_cost - penalty` 사용 가능.  
  - 가격 에이전트도 동일 보상을 쓰면 “시스템 비용을 줄이는 가격”을 학습.
- **장점:**  
  - 기존 `LLMGuidedCTDE`와 동일한 CTDE 프레임워크 재사용.  
  - “가격 결정”이 명시적으로 하나의 에이전트로 구분됨.  
  - 실시간에서는 “가격 에이전트” 정책만 로드해 `run_market()` 대체 가능.
- **단점:**  
  - env 수정량이 있음 (가격을 데이터가 아닌 에이전트 출력으로 사용).  
  - 전역 state에 수급 요약을 넣고, 가격 액터용 네트워크/입출력 차원을 추가해야 함.

---

### 3.3 방식 C: 다중 에이전트 가격 (진짜 MARL)

- **에이전트:**  
  - 예: M명의 “가격 제안자” (리전/존별 시장 운영자, 또는 매수/매도 호가 제출자).  
  - 각 에이전트가 “내가 제안하는 가격” 또는 “매수/매도 호가”를 내고, 이들을 **시장 메커니즘**으로 집계해 하나의 `p2p_price` (또는 매칭 결과)를 만듦.
- **상태/행동/보상:**  
  - 에이전트별 관측(자기 구역 수급, 전역 요약 등), 행동(가격/호가), 보상(자기 수익, 또는 팀 보상)을 설계해야 함.  
  - 집계 규칙(예: 경매 클리어링, 중앙 평균, 이중 경매 등)이 필요.
- **장점:**  
  - 분산된 가격 결정, 다수 주체 간 경쟁/협력 모델링 가능.
- **단점:**  
  - 설계·균형·검증이 복잡하고, 현재 규칙 기반 단일 가격과 목적이 다름.  
  - 실시간 파이프라인과의 연동도 단순 치환이 아님.

---

## 4. 데이터·학습·실시간 연동

### 4.1 데이터

- **방식 A/B:**  
  - 학습 시: 기존 `marl` 데이터셋에서 `price_buy`, `price_sell`, 수급·부하 등은 그대로 사용 가능.  
  - “가격”만 데이터셋 대신 **정책 출력**으로 넣으면 됨.  
  - 옵션: 규칙 엔진으로 생성한 `p2p_price` 시계열을 **Expert**로 두고 Imitation 보조하면 수렴 안정화에 도움될 수 있음 (현재 프로슈머 MARL의 LLM Expert와 유사한 역할).
- **방식 C:**  
  - 여러 “가격 제안자”의 행동·결과를 정의해야 하므로, 시뮬레이션 또는 별도 데이터 설계가 필요.

### 4.2 학습

- **방식 A:**  
  - 별도 env (또는 현재 env에서 `price_p2p`만 정책에서 나오도록 고정) + 단일 에이전트 PPO/SAC 등.  
  - 기존 MARL 학습 루프와 분리 가능.
- **방식 B:**  
  - `marl/env.py`에서 `price_p2p`를 에이전트 출력으로 연결하고,  
  - `marl/agent.py`에서 “가격 액터” 1개 추가, CentralizedCritic 입력에 가격 행동 포함.  
  - 기존 `train.py`와 동일한 루프에서 한 번에 학습 가능 (에이전트 수만 n+1로 확장).

### 4.3 실시간 연동

- **공통:**  
  - `realtime/llm_master_agent.py`의 `PriceSubAgent.run()`에서  
    `price_agent.run_market(ts_dt, forecasts)` 호출 부분을  
    “학습된 가격 정책에 state(수급 요약 등) 넣어서 `p2p_price` 받기”로 교체.  
  - `MarketResult`는 그대로 유지하면 하류(실행계획·거래중개) 수정 최소화 가능.
- **방식 A:**  
  - 가격 정책 1개만 로드해 두고, `forecasts` → state 벡터 → 정책 추론 → `p2p_price` 반환.
- **방식 B:**  
  - “가격 에이전트” actor만 로드해 두고, 동일하게 state 넣어서 가격 스칼라 받아 사용.

---

## 5. 리스크·제약

- **정책 규제:**  
  - 현재 규칙은 `grid_sell + margin ≤ p2p ≤ grid_buy - discount`로 상한/하한이 명확함.  
  - RL/MARL 정책은 학습 구간을 이 범위로 클리핑하거나, 보상에 “범위 위반 페널티”를 넣어야 함.  
  - 실시간에서는 `PolicyRuleEngine`으로 이미 가격을 필터링하고 있으므로, 정책 출력 후 동일 엔진 통과만 유지하면 됨.
- **안정성·해석성:**  
  - 규칙 기반은 수식으로 설명 가능.  
  - 학습 정책은 초기에는 규칙과 비슷하게 두고(Imitation/Expert 보조), 점차 보상만으로 조정하는 방식이 안전함.
- **평가:**  
  - 동일 수급/수요 시나리오에 대해 “규칙 가격 vs 정책 가격”으로 비용·매칭량·전압 위반을 비교하는 벤치마크를 두는 것이 좋음.

---

## 6. 권장 방향

- **목표가 “가격결정을 학습 가능하게 만드는 것”이라면:**  
  - **방식 A(단일 에이전트 RL)**로 가격 정책 1개를 두고,  
    상태 = 수급·계통가격·기준가 등, 행동 = 가격(또는 조정치), 보상 = -비용(또는 사회후생)으로 설계하는 것을 권장.  
  - MARL이 꼭 필요하지 않다면 구현·검증 부담이 가장 작음.
- **목표가 “기존 MARL(CTDE) 안에 가격 결정을 통합”이라면:**  
  - **방식 B(CTDE 확장)**를 권장.  
  - 프로슈머 N명 + 가격 에이전트 1명, Centralized Critic이 전역 state와 모든 행동(가격 포함)을 보는 구조로 확장하면,  
    하나의 학습 루프에서 “가격까지 포함한 시스템”을 같이 학습할 수 있음.

요약하면, **가격결정 Agent를 MARL(또는 RL) 방식으로 변경하는 것은 가능**하며,  
- **단순 대체**면 방식 A(단일 RL),  
- **현재 CTDE와의 일체화**면 방식 B(CTDE 확장)가 적합합니다.
