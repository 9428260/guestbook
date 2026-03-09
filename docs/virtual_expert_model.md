# Expert 전략 및 가상 Actor 10개 모델

## Expert 전략 (ExpertStrategy)

- **입력**: prosumer profile + 현재 상태 + 가격 + (선택) 예측치
- **출력**: LLM이 **JSON** 형태로 action 반환  
  `{"actions": [[P_CDG, P_RDG, Q_RDG, P_BESS, P_CL], ...]}`
- **실패 시**: fallback으로 **heuristic** 또는 **solver** 사용
  - `heuristic`: 프로필 기반 휴리스틱 (HeuristicLLMExpert)
  - `solver`: 가격·잔여량 기반 규칙 solver (FallbackSolver)

구현: `marl/expert_strategy.py` — `ExpertStrategy`, `FallbackSolver`

## 가상 Actor 10개 (VirtualExpertModel)

- **프로필**: Residential×2, Commercial×2, Rural×2, Industrial×2, EnergyHub×2 (총 10종)
- 각 프로필은 `type`, `risk_aversion`, `ess_preference`, `comfort_preference` 포함
- 시스템에서 **로드하여 추론**에 사용 가능

### 모델 생성 및 저장

```bash
python run_virtual_expert.py
```

저장 위치: `checkpoints/virtual_expert_model/`  
- `virtual_expert_config.json`: act_dim, n_actors, profiles, use_llm, fallback

### 시스템에서 로드 후 사용

```python
from pathlib import Path
from marl.virtual_actors import VirtualExpertModel
import numpy as np

# 저장된 가상 Expert 모델 로드
model = VirtualExpertModel.load("checkpoints/virtual_expert_model")

# 관측 (n_agents, obs_dim) — prosumer_meta 없으면 내부 10개 프로필 순환 사용
obs = np.random.randn(20, 10).astype(np.float32)  # 예: 20 agents
actions = model.generate_actions(obs)
# 선택: forecast 전달
# actions = model.generate_actions(obs, forecast={"load_next": [...], "pv_next": [...]})
```

### 학습에서 Expert 전략(JSON) 사용

`marl/config.py`에서:

- `use_expert_strategy_json = True` → ExpertStrategy(JSON + fallback) 사용
- `use_llm_expert = True` → 기존 LLMExpert(텍스트 응답) 사용
- 둘 다 False → HeuristicLLMExpert만 사용
