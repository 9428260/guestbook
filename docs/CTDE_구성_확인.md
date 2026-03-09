# Centralized Training Decentralized Execution (CTDE) 구성 확인

전체 시스템이 **Centralized Training, Decentralized Execution** 구조로 되어 있는지 정리한 문서입니다.

---

## 1. 요약

| 구분 | 내용 | 구현 위치 |
|------|------|------------|
| **Centralized Training** | 학습 시 전역 state·전체 obs/actions로 critic 학습, actor는 centralized Q로 그래디언트 | `marl/agent.py`, `marl/networks.py`, `marl/train.py` |
| **Decentralized Execution** | 실행 시 각 에이전트가 **자기 관측(obs_i)만**으로 행동 선택, critic 미사용 | `marl/agent.py` (`select_actions`, `select_action_single`, `save_policy`/`load_policy`) |

**결론: MARL 파트는 CTDE로 일관되게 구성되어 있습니다.**

---

## 2. Centralized Training (학습 단계)

### 2.1 전역 state와 전역 정보 사용

- **환경** (`marl/env.py`)
  - `state = obs.reshape(-1)`: 전체 에이전트 관측을 한 벡터로 이어붙인 **전역 state**
  - `obs`: (n_agents, obs_dim) — 에이전트별 **로컬 관측**
  - `config.global_state_dim = n_agents * obs_dim` 로 설정

- **리플레이** (`marl/replay.py`)
  - `state`, `next_state`, `obs`, `next_obs`, `actions`, `reward`, `done`, `expert_actions` 저장
  - 학습 시 **전체 에이전트의 state/obs/actions**를 배치로 사용

### 2.2 Centralized Critic

- **CentralizedCritic** (`marl/networks.py`)
  - 입력: `state` (전역), `obs` (전체 에이전트), `actions` (전체 에이전트)
  - 출력: 전역 state에 대한 Q(state, obs, actions) 스칼라
  - 학습 시 **모든 에이전트 정보**를 사용해 가치 추정

- **ValueNet**
  - 입력: `state` (전역 state만)
  - V(state), V_target(next_state)로 TD 타깃 계산

### 2.3 Actor 학습 (centralized Q 사용)

- `agent.update(batch, episode)` (`marl/agent.py`)
  - Q1/Q2: `self.q1(state, obs, actions)`, `self.q2(state, obs, actions)` — **전역 state + 전체 obs + 전체 actions**
  - Actor 손실: `current_actions`에 대해 `q_for_actor = min(Q1(state, obs, current_actions), Q2(...))` 계산 후 `-q_for_actor.mean()` 등으로 그래디언트
  - 각 actor는 **자기 로컬 obs만** 입력받지만, 그래디언트는 **centralized Q**를 통해 전달됨 → 협력/전역 정보를 반영한 학습

### 2.4 학습 루프

- `marl/train.py`의 `train()`
  - `state, obs = env.reset()` → `actions = agent.select_actions(obs)` (실행은 분산)
  - `replay.add(state=state, obs=obs, actions=actions, ...)` → 전역 정보 저장
  - `batch = replay.sample(...)` → `agent.update(batch, episode)` → 위와 같이 **centralized** 업데이트

---

## 3. Decentralized Execution (실행/배포 단계)

### 3.1 행동 선택 시 로컬 관측만 사용

- **select_actions(obs_np)** (`marl/agent.py` 50–63행)
  - 각 에이전트 `i`에 대해 `actor_i(obs[i])` 만 호출
  - **전역 state나 다른 에이전트 obs는 사용하지 않음**
  - 실행 시 통신/전역 정보 불필요

- **select_action_single(obs_i, agent_id)** (65–90행)
  - 한 에이전트만 실행할 때 (예: 한 프로슈머만 실시간 데이터 보유)
  - 해당 에이전트의 **obs_i (로컬 관측)** 만으로 `actors[agent_id](obs_i)` 호출
  - 완전 분산 실행에 부합

### 3.2 배포용 정책만 저장/로드

- **save_policy(path)** (153–165행)
  - **actors**와 추론에 필요한 최소 config만 저장
  - **Critic(Q1, Q2, V, V_target)은 저장하지 않음** → 실행 단계에서는 critic 미사용

- **load_policy(path)** (167–195행)
  - 저장된 actor 가중치만 로드하여 추론용 에이전트 복원
  - 학습용 optimizer, critic 없이 **분산 실행**만 가능

---

## 4. 구성 요약도

```
[학습 단계 — Centralized Training]
  env.reset() → state (전역), obs (n_agents, obs_dim)
       ↓
  agent.select_actions(obs)  ← 실행만 분산 (각 actor는 obs[i]만 사용)
       ↓
  env.step(actions) → next_state, next_obs, reward, ...
       ↓
  replay.add(state, obs, actions, next_state, next_obs, reward, done, expert_actions)
       ↓
  batch = replay.sample()
       ↓
  agent.update(batch):
    - V(state), V_target(next_state)     [전역 state]
    - Q1(state, obs, actions), Q2(...)   [전역 state + 전체 obs/actions]
    - Actor gradient via Q(state, obs, current_actions)  [centralized Q]

[실행/배포 단계 — Decentralized Execution]
  policy = LLMGuidedCTDE.load_policy("checkpoints/policy_for_inference.pt")
  actions = policy.select_actions(obs)           # 각 i: actor_i(obs[i]) 만 사용
  # 또는 한 에이전트만:
  a_i = policy.select_action_single(obs_i, agent_id=i)
  (Critic 미사용, 전역 state 미사용)
```

---

## 5. 실시간 시스템과의 연동

- **realtime** 파이프라인(`realtime/`, `run_realtime_system.py`)은 현재 **ForecastAgent·PriceAgent·ProsumerAgent** 기반으로 동작하며, MARL policy를 직접 호출하지 않습니다.
- CTDE 정책을 **실시간 실행**에 쓰려면:
  1. 학습 후 `LLMGuidedCTDE.save_policy(...)` 로 저장한 정책을
  2. `LLMGuidedCTDE.load_policy("checkpoints/policy_for_inference.pt")` 로 로드하고
  3. 실시간 obs에 대해 `select_actions(obs)` 또는 `select_action_single(obs_i, agent_id)` 로 행동을 얻어
  4. 해당 행동을 실시간 제어/가격 결정 파이프라인에 넣으면 됩니다.

이때 실행은 항상 **로컬 관측만** 사용하므로 CTDE의 Decentralized Execution과 일치합니다.

---

## 6. 결론

- **Centralized Training**: 전역 state, 전체 obs/actions로 critic(V, Q1, Q2) 학습, actor는 centralized Q 그래디언트로 협력적 정책 학습.
- **Decentralized Execution**: 각 에이전트가 자기 obs만으로 행동 선택, 배포 시 actor만 저장/로드하고 critic 미사용.

전체 MARL 시스템은 **Centralized Training, Decentralized Execution (CTDE)** 로 구성되어 있음을 확인할 수 있습니다.
