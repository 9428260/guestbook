# 실시간 입력 데이터로 Action 사용하기

## 1. 준비

### 1.1 추론용 정책 로드

학습으로 만든 **추론용 체크포인트**만 있으면 됩니다.

```python
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))

from marl.agent import LLMGuidedCTDE

# 추론 전용 정책 로드 (학습 시 n_agents, obs_dim 등이 저장됨)
agent = LLMGuidedCTDE.load_policy("checkpoints/policy_for_inference.pt")
n_agents = agent.cfg.n_agents   # 기본 20
obs_dim = agent.cfg.obs_dim    # 10
act_dim = agent.cfg.act_dim    # 5
```

### 1.2 실시간 obs 형식 (에이전트당 10차원)

실시간 계측/예측 데이터를 **에이전트당 10차원 벡터**로 맞춥니다.  
`marl/env.py`의 `_build_obs()`와 동일한 스케일을 사용하는 것이 좋습니다.

| 인덱스 | 이름 | 의미 | 정규화 방법 |
|--------|------|------|-------------|
| 0 | time_norm | 현재 시각(15분 인덱스) | 0~1 (예: step_index / 95) |
| 1 | buy_price_norm | 구매 단가 | price_buy / 300, clip 0~2 |
| 2 | sell_price_norm | 판매 단가 | price_sell / 300, clip 0~2 |
| 3 | P_RDG_max_norm | 재생에너지(PV·풍력) 가용량 | (pv_kw + wt_kw) / 200, clip 0~2 |
| 4 | P_load_norm | 유효 부하 | load_kw / 200, clip 0~2 |
| 5 | Q_load_norm | 무효 부하 | (0.3 * load_kw) / 200 등 |
| 6 | prev_CDG_norm | 이전 CDG 출력 비율 | 0~1 |
| 7 | prev_SOC | ESS SOC | 0~1 |
| 8 | prev_P2P_norm | 이전 P2P/순출력 정규화 | 예: p_net/100, clip -1~1 |
| 9 | prev_V_norm | 이전 전압 정규화 | (V - 0.9) / 0.2 |

정규화 예시 (가격 300, 전력 200 스케일):

```python
import numpy as np

def normalize_price(p, scale=300.0):
    return np.clip(p / scale, 0.0, 2.0).astype(np.float32)

def normalize_power(p, scale=200.0):
    return np.clip(p / scale, 0.0, 2.0).astype(np.float32)
```

---

## 2. 실시간 한 시점에서 action 얻기

### 2.1 전체 프로슈머(20명) 한 번에

실시간으로 받은 15분 데이터로 **obs 한 세트**를 만든 뒤, 한 번만 추론하면 됩니다.

```python
# 실시간 한 시점 obs: shape (n_agents, 10), float32
obs = np.array([...], dtype=np.float32)  # 각 행이 한 프로슈머의 10차원

# 실운영에서는 결정적 행동 권장
actions = agent.select_actions(obs, deterministic=True)
# actions shape: (n_agents, 5) — [P_CDG, P_RDG, Q_RDG, P_BESS, P_CL] in [-1, 1]
```

- **입력**: `obs` — shape `(n_agents, 10)`
- **출력**: `actions` — shape `(n_agents, 5)`, 각 차원 [-1, 1]

### 2.2 한 프로슈머만 실시간 데이터로 (CTDE)

한 에이전트(한 프로슈머)에만 실시간 데이터가 있을 때는, 그 에이전트의 obs만 넣어 행동만 받습니다.

```python
# 해당 프로슈머의 10차원만 — shape (10,) 또는 (1, 10)
obs_i = np.array([
    time_norm, buy_price_norm, sell_price_norm, P_RDG_max_norm,
    P_load_norm, Q_load_norm, prev_CDG_norm, prev_SOC, prev_P2P_norm, prev_V_norm
], dtype=np.float32)

agent_id = 0  # 0 ~ n_agents-1 (학습 시와 동일한 순서)
action_i = agent.select_action_single(obs_i, agent_id=agent_id, deterministic=True)
# action_i shape: (5,) — 해당 프로슈머만의 행동
```

---

## 3. Action → 실물리량(setpoint) 변환

추론된 action은 **[-1, 1]** 정규화 값이므로, 설비 제어·시뮬레이터에 넣으려면 **kW·kVAr**로 변환해야 합니다.  
`demo_realtime_pipeline.py` / `marl/env.py`와 동일한 규칙입니다.

```python
def actions_to_setpoints(actions, cap, arr, t):
    """actions (n_agents, 5) → 실물리량. cap=용량, arr=해당 시점 가용량 등."""
    p_cdg_kw   = (0.5 + 0.5 * actions[:, 0]) * cap["cdg_kw"]
    pv_wt      = arr["pv_kw"][t] + arr["wt_kw"][t] + 1e-6
    p_rdg_kw   = (0.5 + 0.5 * actions[:, 1]) * pv_wt
    q_rdg_kvar = np.clip(actions[:, 2], -1.0, 1.0) * 20.0
    p_bess_kw  = actions[:, 3] * cap["bess_kw"]
    p_cl_cut_kw = (0.5 + 0.5 * actions[:, 4]) * arr["controllable_load_kw"][t]
    return p_cdg_kw, p_rdg_kw, q_rdg_kvar, p_bess_kw, p_cl_cut_kw
```

**실시간 1스텝만** 있을 때는 `arr`에 해당 15분 한 시점만 있으면 되고, `t=0`처럼 한 인덱스만 사용하면 됩니다.  
한 에이전트만 쓸 때는 `action_i` 하나에 대해 위 공식을 해당 에이전트 용량/가용량에 적용하면 됩니다.

| action 차원 | 의미 | 변환 공식 |
|-------------|------|-----------|
| a0 (P_CDG) | CDG 출력 비율 | (0.5+0.5*a0) × cdg_kw_cap |
| a1 (P_RDG) | RDG 이용 비율 | (0.5+0.5*a1) × (pv_kw + wt_kw) |
| a2 (Q_RDG) | 무효전력 | clip(a2,-1,1) × 20 kVAr |
| a3 (P_BESS) | ESS 충·방전 | a3 × bess_kw_cap (양=방전) |
| a4 (P_CL) | 부하 절감 비율 | (0.5+0.5*a4) × controllable_load_kw |

---

## 4. 실시간 15분마다 반복 (시계열)

15분마다 들어오는 데이터에 대해 같은 방식으로 반복하면 됩니다.

```python
# 예: 매 15분마다 실시간 데이터 수신
for t in range(96):  # 또는 무한 루프 + 수신 대기
    # 실시간/예측으로 해당 시점 obs 구성
    obs_t = build_obs_from_real_data(t, real_prices, real_loads, real_pv, ...)
    # shape (n_agents, 10)

    actions_t = agent.select_actions(obs_t, deterministic=True)

    # 설비 setpoint로 사용
    p_cdg, p_rdg, q_rdg, p_bess, p_cl_cut = actions_to_setpoints(
        actions_t, cap, arr_t, t=0
    )
    # cap: 프로슈머별 용량, arr_t: 해당 15분의 가용량 등
```

`build_obs_from_real_data`는 실제 데이터 스키마에 맞게 위 10차원 표를 이용해 구현하면 됩니다.

---

## 5. 전체 흐름 요약

1. **정책 로드**: `LLMGuidedCTDE.load_policy("checkpoints/policy_for_inference.pt")`
2. **실시간 데이터 → obs**: 10차원 규칙으로 정규화해 `(n_agents, 10)` 또는 한 에이전트면 `(10,)` 구성.
3. **Action 추론**:
   - 전체: `agent.select_actions(obs, deterministic=True)`
   - 한 명: `agent.select_action_single(obs_i, agent_id=i, deterministic=True)`
4. **실사용**: `actions_to_setpoints()`로 kW·kVAr setpoint로 변환 후 설비 제어·시뮬레이션에 입력.

이 순서대로 사용하면 실시간 입력 데이터만으로 매 15분마다 action을 받아 설비에 반영할 수 있습니다.
