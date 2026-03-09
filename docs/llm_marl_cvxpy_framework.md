# LLM-MARL 통합 프레임워크 (CVXPY Optimization Model Generator)

## 목표 달성 요약

### 1. LLM-MARL 통합 프레임워크
- **LLM을 전문가로 활용**: `ExpertWorkflowCVXPY` / `ExpertStrategy` / `ExpertWorkflow4Step` 중 설정에 따라 선택. CVXPY 모드에서는 LLM이 최적화 모델(CVXPY 코드)을 생성해 전문가 행동을 냄.
- **MARL 학습 지도**: 매 스텝 `expert.generate_actions(obs, ...)` → `replay.add(..., expert_actions=...)` → `agent.update(batch)` 에서 전문가 행동을 타깃으로 사용.
- **인간 전문가 대체**: 전문가 정책 = LLM(또는 LLM이 생성한 CVXPY 코드) 출력. 휴리스틱 fallback으로 연동 실패 시에도 학습 가능.

### 2. 맞춤 LLM 전문가 워크플로우 (CVXPY)
- **자연어 입력**: `natural_language_hint` (또는 전략 모델 생성 단계에서의 사용자 선호)으로 다음 단계에 반영.
- **모델 생성**: `_step1_model_generation` — 상황/컨텍스트에 맞는 전략 모델(타입/스펙) 생성.
- **도구 검색**: `_step2_tool_retrieval_cvxpy` — `cp`, `surplus_power`, `price_p2p`, `battery_soc` 등 사용할 도구 목록 선택.
- **코드 생성**: `_step3_code_generation_cvxpy` — CVXPY로 목적함수·제약 정의, `problem.solve()`, 해를 `actions (n_agents, act_dim)` 로 매핑하는 Python 코드 생성.
- **코드 수정**: `_step4_code_modification_cvxpy` — 실행 오류 시 수정된 코드 재생성.
- **실행 가능한 전략 생성**: 생성된 코드를 제한된 네임스페이스에서 `exec()` 후 `actions` 반환 → 모방학습의 전문가 지침으로 사용.

### 3. 모방 전문가 MARL 알고리즘 (Wasserstein)
- **Wasserstein distance**: `marl/agent.py` 의 `wasserstein2_diag(mu, std, expert_action)` 로 에이전트 정책(평균 μ, 표준편차 σ)과 전문가 행동 간 W2 근사 사용.
- **전문가 전략과 에이전트 정책 유사도**: actor loss에 `λ · (W2 − ε)` 제약으로 반영. λ는 Lagrange 승수로 자동 조정.
- **로그**: 학습 시 `avg_w2`, `avg_lambda` 로 W2 및 제약 강도 확인 가능.

---

## CVXPY 워크플로우 사용 방법

### 의존성
```bash
pip install -r requirements-cvxpy.txt
# 또는: pip install cvxpy
```

### 설정
`marl/config.py` 또는 학습 스크립트에서:
```python
cfg.use_cvxpy_workflow = True   # CVXPY Optimization Model Generator 사용
cfg.use_llm_expert = True       # LLM 연동
```

### 전문가 우선순위 (train.py)
1. `use_cvxpy_workflow == True` 이고 `ExpertWorkflowCVXPY` 로드 가능 → **ExpertWorkflowCVXPY**
2. `use_4step_workflow == True` → ExpertWorkflow4Step
3. `use_expert_strategy_json == True` → ExpertStrategy
4. `use_llm_expert == True` → LLMExpert
5. 그 외 → HeuristicLLMExpert

### 생성 코드 예시 (LLM이 생성하는 스타일)
```python
import cvxpy as cp  # 네임스페이스에 cp 제공됨

P_p2p = cp.Variable()
P_battery = cp.Variable()
cost = P_p2p * price_p2p - battery_cost * cp.abs(P_battery)
constraints = [
    P_p2p + P_battery == surplus_power,
    battery_soc <= battery_soc_max,
    battery_soc >= battery_soc_min,
]
problem = cp.Problem(cp.Minimize(cost), constraints)
problem.solve()
# 해를 (n_agents, act_dim) 형태로 매핑
actions = np.zeros((n_agents, act_dim))
# ... P_p2p.value, P_battery.value 를 에이전트별로 배분 후 clip
actions = np.clip(actions, -1.0, 1.0)
```

---

## 파일 위치
- CVXPY 워크플로우: `marl/expert_workflow_cvxpy.py`
- 설정: `marl/config.py` (`use_cvxpy_workflow`)
- 학습 루프·전문가 선택: `marl/train.py`
- W2 모방학습: `marl/agent.py` (`wasserstein2_diag`, actor loss)
