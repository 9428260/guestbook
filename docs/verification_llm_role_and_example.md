# LLM 역할 및 실제 예시 대비 구현 검증

## 1. LLM 역할 구현 여부

| LLM 역할 | 구현 여부 | 구현 위치 및 내용 |
|----------|-----------|-------------------|
| **전력사용량·가격결정·프로슈머 상황 이해** | ✅ | **obs**: `env._build_obs()` → [time_norm, buy_price_norm, sell_price_norm, P_RDG_max_norm, P_load_norm, Q_load_norm, prev_CDG, prev_SOC, prev_P2P, prev_V]. **prosumer_meta**: 타입(Residential 등), risk_aversion, ess_preference, comfort_preference. **forecast**: load_kw_current/next, pv_kw_current/next, price_buy/sell/p2p current/next (`env.get_forecast_context()`). ExpertStrategy는 위를 JSON으로 LLM에 전달. CVXPY 워크플로우는 `surplus_power`, `price_p2p`, `battery_soc`, `get_pv(obs)`, `get_load(obs)` 등으로 동일 정보 제공. |
| **에너지 운영 모델 생성** | ✅ | `_step1_model_generation()` (expert_workflow.py / expert_workflow_cvxpy.py): context(에이전트 수, 예측 유무 등)와 자연어 선호를 받아 "전략 모델 타입/스펙" 생성 (예: price_following, conservative_bess, cost_minimization_p2p_battery). |
| **최적화 코드 생성** | ✅ | **ExpertWorkflowCVXPY**: `_step3_code_generation_cvxpy()` — CVXPY로 변수·목적함수·제약 정의 후 `actions (n_agents, act_dim)` 할당하는 Python 코드 생성. **ExpertWorkflow4Step**: `_step3_code_generation()` — numpy 기반 전략 코드 생성. |
| **오류 수정** | ✅ | `_step4_code_modification()` / `_step4_code_modification_cvxpy()`: 실행 실패 시 에러 메시지를 LLM에 전달해 수정된 코드 재생성. |
| **P2P 거래 전략 생성** | ✅ | 생성된 코드 또는 JSON 응답이 **actions** (에이전트별 [P_CDG, P_RDG, Q_RDG, P_BESS, P_CL])를 반환. env.step()에서 이 행동이 P_rdg(재생에너지), P_bess(ESS), P_cl(부하조절) 등으로 반영되고, 잉여/부족이 P2P·계통 거래로 연결됨. 즉 “P2P 거래 전략” = 위 actions로 표현되는 운영 전략. |
| **전략이 MARL 전문가 행동 데이터로 사용** | ✅ | `train.py`: 매 스텝 `expert_actions = expert.generate_actions(obs, env.prosumer_meta, forecast)` → `replay.add(..., expert_actions=expert_actions)` → `agent.update(batch)` 에서 `batch["expert_actions"]` 사용. `agent.py`: actor loss에 `λ·(W2(π, expert_actions) − ε)` 로 전문가 행동을 타깃으로 모방학습. |

---

## 2. 실제 예시(한 아파트 커뮤니티, Prosumer A) 대비

### 예시 정리
- **Prosumer A (가정)**  
  - 장치: PV 5kW, ESS 10kWh, 가정 부하  
  - 오후 2시: PV 4kW, 가정 소비 2kW, 배터리 SOC 70%, P2P 110원/kWh, Grid 판매 80원/kWh  
  - **잉여 전력 = 2kW**  
  - 선택지: 1) 이웃 P2P 판매, 2) 배터리 저장, 3) Grid 판매  

### 구현과의 매핑

| 예시 항목 | 구현 내 대응 | 비고 |
|-----------|--------------|------|
| PV 발전 4kW | `obs[:, 3]` (P_RDG_max_norm) × power_scale 200 → `get_pv(obs)` | ✅ |
| 가정 소비 2kW | `obs[:, 4]` (P_load_norm) × power_scale 200 → `get_load(obs)` | ✅ |
| 배터리 SOC 70% | `obs[:, 7]` (prev_SOC), `get_soc(obs)` | ✅ |
| P2P 가격 110원/kWh | `forecast["price_p2p_current"]` (env에 price_p2p 있을 때). CVXPY 네임스페이스 `price_p2p` | ✅ (env.get_forecast_context()에 price_p2p_current 추가 반영됨) |
| Grid 판매 80원/kWh | `obs[:, 2]` (sell_price_norm) × 300 → `get_price_sell(obs)`, `forecast["price_sell_current"]` | ✅ |
| 잉여 전력 2kW | `surplus_per_agent = get_pv(obs) - get_load(obs)`, `surplus_power = sum(surplus_per_agent)` (CVXPY용) | ✅ |
| 선택지 1: P2P 판매 | 생성된 전략의 P_BESS·P_RDG 등 조합으로 잉여를 “P2P로 나가는 흐름”으로 사용 (env에서 surplus/deficit → P2P 볼륨) | ✅ |
| 선택지 2: 배터리 저장 | actions의 P_BESS(ESS 충전) 차원 | ✅ |
| 선택지 3: Grid 판매 | 잉여 중 P2P 미매칭분이 env에서 grid_export로 처리 | ✅ |

- **프로슈머 프로필(가정형)**  
  - `prosumer_meta[i]["type"]` = "Residential" 등으로 데이터셋/ env에서 제공되며, ExpertStrategy/CVXPY 워크플로우의 context·도구로 전달됨. ✅  

### 결론
- “전력사용량·가격·프로슈머 상황 이해”, “에너지 운영 모델 생성”, “최적화 코드 생성”, “오류 수정”, “P2P 거래 전략 생성”이 위와 같이 구현되어 있음.
- 예시의 **PV 4kW, 소비 2kW, SOC 70%, P2P 110원, Grid 판매 80원, 잉여 2kW** 및 **P2P/배터리/Grid** 선택지는 현재 obs·forecast·CVXPY 네임스페이스와 env.step() 구조로 표현 가능하며, 생성된 전략(actions)이 MARL의 **전문가 행동 데이터**로 replay → W2 모방학습에 사용됨.

---

## 3. LLM 입력 형식 및 에너지 전문가 reasoning (반영됨)

### 요구 형식
- **State**: `state = { PV_generation = 4kW, Load = 2kW, Battery_SOC = 70%, P2P_price = 110, Grid_price = 80 }` 형태로 LLM에 전달.
- **Reasoning**: 에너지 전문가처럼 단계별 추론 유도. 예: 1) PV > 부하 2) 배터리 70% 3) P2P가 > Grid 4) 따라서 P2P 거래가 경제적.

### 구현 상태
- **state 블록**: `env.get_forecast_context()`에 `battery_soc_percent` 추가. `expert_strategy._build_json_prompt()`에서 forecast 시 `state = { PV_generation = X kW, Load = X kW, Battery_SOC = X%, P2P_price = X, Grid_price = X }` 포함.
- **reasoning 지시**: 프롬프트에 "Reason like an energy expert" 문단 추가 (PV vs Load, Battery_SOC, P2P vs Grid 비교 후 Expert Strategy + actions 출력).
- **코드**: `marl/env.py` (get_forecast_context), `marl/expert_strategy.py` (_build_json_prompt).

---

## 4. 참고 코드 위치

- 관측·가격·forecast: `marl/env.py` (`_build_obs`, `get_forecast_context`)
- 프로슈머 메타: `marl/env.py` (`_build_prosumer_meta`), 데이터셋 prosumers
- 모델 생성: `marl/expert_workflow.py` (`_step1_model_generation`)
- 최적화 코드 생성/수정: `marl/expert_workflow_cvxpy.py` (`_step3_code_generation_cvxpy`, `_step4_code_modification_cvxpy`)
- CVXPY 네임스페이스(잉여, P2P 가격 등): `marl/expert_workflow_cvxpy.py` (`_make_tool_namespace_cvxpy`)
- 전문가 → replay → agent: `marl/train.py` (expert_actions, replay.add, agent.update), `marl/agent.py` (expert_actions, wasserstein2_diag)
