# Wasserstein 거리 기반 Agent vs LLM Expert 학습 검증

## 논문 설명

- **Wasserstein distance**로 **Agent Policy**와 **LLM Expert Policy** 차이를 계산한다.
- 예: Agent 행동 (Sell P2P = 0.5 kW, Battery charge = 1.5 kW) vs Expert 행동 (Sell P2P = 2 kW, Battery charge = 0)  
  → **distance = 큰 값** → 에이전트 정책 수정(모방 학습).

---

## 구현 확인 결과: **반영됨**

### 1. Expert 행동 수집 및 저장

| 단계 | 구현 위치 | 내용 |
|------|-----------|------|
| Expert 행동 생성 | `marl/train.py` 139–141행 | 매 스텝 `expert_actions = expert.generate_actions(obs, env.prosumer_meta, forecast)` (LLM/Heuristic/CVXPY 등) |
| Replay 저장 | `marl/train.py` 145–156행 | `replay.add(..., actions=actions, expert_actions=expert_actions)` — **Agent 행동(actions)**과 **Expert 행동(expert_actions)** 쌍으로 저장 |
| 버퍼 구조 | `marl/replay.py` | `PrioritizedReplayBuffer`에 `self.expert_actions` 배열 존재, `sample()` 시 `batch["expert_actions"]` 포함 |

### 2. Wasserstein 거리 계산

| 항목 | 구현 위치 | 수식/의미 |
|------|-----------|-----------|
| W2 근사 | `marl/agent.py` 92–94행 | `wasserstein2_diag(mu, std, expert_action)` → `sqrt((mu - expert_action)^2 + std^2)` 합 (대각 공분산 가정) |
| 비교 대상 | `marl/agent.py` 234–236행 | 에이전트별 **정책 분포 (μ, σ)** vs **같은 obs에서의 expert_actions** (배치 차원으로 일괄 계산) |

```python
# agent.py 92-94
def wasserstein2_diag(self, mu, std, expert_action):
    w = torch.sqrt((mu - expert_action) ** 2 + std ** 2 + 1e-8).sum(dim=-1)
    return w
```

- **Agent**: 각 에이전트가 Gaussian 정책 π(·|obs) → (μ, σ).  
- **Expert**: 해당 obs에 대한 LLM/Expert가 준 행동 벡터 (동일하게 `act_dim=5`: P_CDG, P_RDG, Q_RDG, P_BESS, P_CL).  
- **행동 공간**: 모두 **정규화 구간 [-1, 1]** 이며, `env.step()`에서 kW 등 물리량으로 변환됨.

### 3. Actor 손실 및 정책 수정

| 항목 | 구현 위치 | 내용 |
|------|-----------|------|
| Actor loss | `marl/agent.py` 247–252행 | `loss_i = (-q_for_actor.mean()) + self.lagrange[i] * (w2.mean() - epsilon)` |
| 의미 | - | **W2가 크면** (Agent가 Expert와 다르면) **두 번째 항이 커짐** → 총 actor loss 증가 → gradient descent로 **정책이 Expert에 가까워지도록** 수정됨. |
| ε 스케줄 | `marl/agent.py` 96–102행, `config.py` | `get_epsilon(episode)`: epsilon_start → epsilon_mid → epsilon_late (에피소드 비율에 따라 증가). W2 &lt; ε이면 제약 만족으로 간주. |
| Lagrange λ | `marl/agent.py` 262–268행 | W2 &gt; ε일 때 λ 증가(제약 위반), W2 &lt; ε일 때 λ 감소. 셀프 튜닝으로 모방 강도 조절. |

즉, **“차이(distance) = 큰 값 → 에이전트 정책 수정”** 이 **λ·(W2 − ε)** 항을 통해 구현되어 있음.

### 4. 사용자 예시와의 대응

- **예시**: Agent (Sell P2P = 0.5 kW, Battery charge = 1.5 kW) vs Expert (Sell P2P = 2 kW, Battery charge = 0).
- **구현**:  
  - Agent의 **actions** = `agent.select_actions(obs)` (정책에서 샘플링).  
  - Expert의 **expert_actions** = `expert.generate_actions(obs, ...)`.  
  - 둘 다 **같은 obs**에 대해 저장되며, 학습 시 **W2(π(·|obs), expert_action)** 로 거리 계산.  
  - P2P 판매량·배터리 충전량은 `env.step(actions)`에서 `P_RDG`, `P_BESS` 등 5차원 행동으로부터 유도되므로, “Sell P2P 0.5 vs 2 kW”, “Battery 1.5 vs 0” 같은 차이는 **행동 벡터 차이**로 나타나고, W2가 커지면 **정책이 Expert 쪽(2 kW P2P, 0 kW charge)으로 수정**되도록 되어 있음.

---

## 요약 표

| 논문 요소 | 구현 여부 | 코드 위치 |
|-----------|-----------|-----------|
| Agent Policy vs LLM Expert Policy | ✅ | `agent.update(batch)` 내 `batch["actions"]`(정책 샘플) vs `batch["expert_actions"]` |
| Wasserstein distance 계산 | ✅ | `marl/agent.py` `wasserstein2_diag(mu, std, expert_actions[:, i, :])` |
| 차이 큼 → 정책 수정 | ✅ | Actor loss에 `λ·(W2 − ε)` 포함, W2 클수록 loss 증가 → gradient로 Expert 방향 유도 |
| Expert 행동이 LLM에서 옴 | ✅ | `train.py`에서 `expert.generate_actions(...)` → `replay.add(..., expert_actions=...)` |

**결론**: 논문에서 말한 “Wasserstein distance로 Agent Policy vs LLM Expert Policy 차이를 계산하고, 그 차이가 크면 에이전트 정책을 수정한다”는 방식이 현재 시스템에 구현되어 있음.
