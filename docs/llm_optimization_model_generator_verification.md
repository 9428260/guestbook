# LLM 역할 검증: Optimization Model Generator (CVXPY) 여부

## 결론: **아니오**

현재 전체 시스템에서는 **LLM이 Optimization Model Generator로 CVXPY 코드를 생성해 모방학습에 쓰이는 구조가 아닙니다.**

---

## 1. 현재 LLM 사용 방식 (두 가지 경로)

설정(`marl/config.py`)에 따라 다음 중 하나만 사용됩니다.

### (1) ExpertStrategy (`use_expert_strategy_json=True`, 현재 retrain 스크립트 사용)

- **역할**: **Direct Action Generator**
- **동작**: LLM에 prosumer 상태·가격·예측을 넣고, **JSON으로 행동 벡터만** 받음.
- **출력 형식**: `{"actions": [[a1,a2,a3,a4,a5], ...]}` (에이전트별 5차원)
- **코드 생성 여부**: 없음. CVXPY/최적화 코드 없음.
- **참고**: `marl/expert_strategy.py` — `_build_json_prompt`, `_parse_llm_actions_json`

### (2) ExpertWorkflow4Step (`use_4step_workflow=True`)

- **역할**: **Strategy Code Generator** (최적화 솔버 생성 아님)
- **동작**: 4단계 — (1) 전략 모델 생성 (2) 도구 검색 (3) **Python 코드 생성** (4) 코드 수정 후 실행.
- **생성 코드 제약**:
  - 사용 가능한 것: `obs`, `profiles`, `np`, `get_price_buy`, `get_load`, `get_pv`, `get_soc`, `get_profile`, `clip`
  - **"Use np.array and np.clip. No print, no import."** 로만 코드 생성 유도
  - 실행 네임스페이스(`_make_tool_namespace`)에 **cvxpy(`cp`) 없음**
- **결과**: numpy 기반 규칙/휴리스틱 코드만 생성 가능. CVXPY 최적화 모델은 생성·실행되지 않음.
- **참고**: `marl/expert_workflow.py` — `_step3_code_generation`, `_make_tool_namespace`, `_execute_strategy_code`

---

## 2. CVXPY 사용 여부

- **코드베이스 검색**: `cvxpy`, `cp.Variable`, `cp.Problem` **0건**
- **의존성**: `requirements*.txt` 등에 cvxpy 없음.

따라서 **현재 구조에서는 사용자가 예시한 CVXPY 최적화 코드가 생성되거나 실행되지 않습니다.**

---

## 3. 사용자 예시 코드와의 대비

사용자 예시 (Optimization Model Generator 스타일):

```python
import cvxpy as cp
P_p2p = cp.Variable()
P_battery = cp.Variable()
cost = P_p2p * price_p2p - battery_cost * abs(P_battery)
constraints = [
    P_p2p + P_battery == surplus_power,
    battery_soc <= 1.0,
    battery_soc >= 0.2
]
problem = cp.Problem(cp.Maximize(cost), constraints)
problem.solve()
```

| 항목           | 현재 시스템                         | 사용자 예시 (원하는 형태)     |
|----------------|-------------------------------------|-----------------------------|
| LLM 출력       | JSON 행동 또는 numpy용 Python 코드 | CVXPY 최적화 모델 코드      |
| 실행 환경      | `np`, obs, get_* 등만 제공         | `cp`, 변수·제약·목적함수    |
| 최적화 솔버   | 없음                                | `cp.Problem(...).solve()`   |
| 모방학습 입력  | 전문가 행동 = LLM/휴리스틱 출력     | (구현 시) 최적화 결과 행동 |

---

## 4. 모방학습과의 연결

- **현재**: 전문가 지침 = `expert.generate_actions(obs, ...)` 반환값 (전부 **행동 벡터**).
  - ExpertStrategy → LLM JSON에서 파싱한 `actions`
  - ExpertWorkflow4Step → LLM이 생성한 Python 코드를 `exec()` 한 뒤 나온 `actions`
- 이 행동이 replay에 `expert_actions`로 저장되고, `agent.update(batch)`에서 모방학습에 사용됩니다.
- **CVXPY 최적화**를 거친 행동은 어디에서도 생성·저장되지 않습니다.

---

## 5. 요약

| 질문 | 답 |
|------|---|
| LLM이 Optimization Model Generator로 동작하는가? | **아니오** |
| CVXPY 같은 최적화 코드가 생성·실행되는가? | **아니오** |
| 그런 코드로 모방학습이 되도록 되어 있는가? | **아니오** |
| 현재 모방학습에 쓰이는 전문가 지침은? | JSON 직접 행동 또는 numpy 기반 생성 코드 실행 결과 |

CVXPY 기반 Optimization Model Generator를 도입하려면,  
(1) 실행 네임스페이스에 `cvxpy` 제공, (2) LLM 프롬프트에서 CVXPY 코드 생성 유도, (3) 생성 코드 실행 후 `actions`를 추출해 기존 `expert_actions` 파이프라인에 넣는 식의 **추가 구현**이 필요합니다.
