# Storage Master Agent (4목표 동시 처리)

Storage Master Agent는 **한 개가 아닌 최소 4개 목표를 동시에** 다루는 ESS 제어 에이전트입니다.

## 4개 목표

| 목표 | 설명 | 구현 요약 |
|------|------|------------|
| **2.1 비용 절감** | 비싼 시간대 전력 구매 감소, 경부하 저장·최대부하 방전 | TOU 기준: 저가 시 충전 선호, 고가 시 방전 선호 |
| **2.2 수익 최적화** | 태양광 잉여전력 가치 극대화, 내부거래/외부정산 가치 활용 | 잉여 시 ESS 저장 또는 P2P/수출, 부족·고가 시 방전 |
| **2.3 피크 관리** | 단지 최대수요 억제, 계약전력 초과 리스크 완화, 수요반응 대응 | 피크/DR 시 방전, 비피크 시 충전; 계약전력 근접 시 방전 강화 |
| **2.4 설비 보호** | 과충전/과방전 방지, C-rate 제한, 온도/열화, 장기 수명 | SOC [soc_min, soc_max] 하드 제약, C-rate 상한, 고온 시 출력 감소 |

## 사용

### 단일 에이전트 — context dict

```python
from storage.storage_master_agent import StorageMasterAgent, StorageMasterAgentConfig

cfg = StorageMasterAgentConfig(
    w_cost_reduction=0.30,
    w_revenue_optimization=0.25,
    w_peak_management=0.25,
    w_equipment_protection=0.20,
)
agent = StorageMasterAgent(cfg)

context = {
    "time_norm": 0.75,        # 18시대
    "price_buy": 200.0,       # KRW/kWh
    "price_sell": 90.0,
    "price_p2p": 120.0,
    "load_kw": 50.0,
    "pv_kw": 10.0,
    "soc_norm": 0.6,
    "bess_kwh": 80.0,
    "bess_kw": 30.0,
    "is_peak": True,
    "demand_response_signal": 0.8,
    "contract_kw": 100.0,
    "total_demand_kw": 95.0,
}
p_bess_kw, info = agent.compute_p_bess(context)
# p_bess_kw: kW (양수=방전, 음수=충전)
# info: goal_cost, goal_revenue, goal_peak, goal_equipment, combined_norm
```

### MARL 관측 (n_agents, obs_dim)에서 P_BESS만 계산

```python
import numpy as np
from storage import StorageMasterAgent, StorageMasterAgentConfig

agent = StorageMasterAgent(StorageMasterAgentConfig())
obs = np.random.rand(20, 10).astype(np.float32)  # (n_agents, obs_dim)
bess_kw = np.full(20, 30.0, dtype=np.float32)
bess_kwh = np.full(20, 80.0, dtype=np.float32)

p_bess_norm = agent.compute_p_bess_from_obs(obs, bess_kw, bess_kwh)
# shape (20,), 각 에이전트별 P_BESS 정규화값 [-1, 1]
```

### 기존 actions에 P_BESS 열만 채우기

```python
actions = np.zeros((20, 5), dtype=np.float32)  # [P_CDG, P_RDG, Q_RDG, P_BESS, P_CL]
actions = agent.fill_actions_p_bess(actions, obs, bess_kw, bess_kwh, forecast=forecast)
# actions[:, 3] 만 Storage Master로 갱신됨
```

## 설정 (StorageMasterAgentConfig)

- **목표 가중치**: `w_cost_reduction`, `w_revenue_optimization`, `w_peak_management`, `w_equipment_protection`
- **비용 절감**: `cheap_price_norm_high`, `expensive_price_norm_low` (정규화 가격 기준)
- **수익**: `p2p_premium_over_sell`
- **피크**: `peak_hour_start_norm`, `peak_hour_end_norm`, `contract_power_margin_ratio`, `demand_response_gain`
- **설비**: `soc_min`, `soc_max`, `c_rate_max`, `temp_derate_above_c`, `temp_derate_ratio`
- **공통**: `price_scale_krw`, `dt_hours`

## 파일

- `storage/storage_master_agent.py`: StorageMasterAgent, StorageMasterAgentConfig
- `storage/storage_master.py`: 기존 EnergyControlAgent (단일 목표형 제어)
