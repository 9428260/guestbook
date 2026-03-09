# 학습 요약 및 실행 방법 (run_train)

## 디렉터리 구조

```
marl_260306/
├── train.py              # 진입점 (프로젝트 루트에서 python train.py 실행)
├── run_llm_expert.py     # LLM Expert 단계만 별도 실행 (학습 없음)
├── .env.example          # LLM 연결용 환경변수 예시
├── .env                  # API 키 등 (git 제외, 직접 생성)
├── run_train.md
├── train.md
├── etc.py                # 참고용 통합 스크립트 (과거 버전)
├── data/                 # pkl 데이터 (선택)
│   └── paper_reproduction_dataset_from_screenshot_schema.pkl
└── marl/                 # 학습 패키지
    ├── __init__.py
    ├── config.py         # TrainConfig
    ├── utils.py          # set_seed, soft_update, mlp
    ├── data_loader.py    # pkl 로드, 합성 데이터, build_episode_arrays
    ├── replay.py        # PrioritizedReplayBuffer, DualReplay
    ├── expert.py        # BaseExpert, LLMExpert, HeuristicLLMExpert
    ├── networks.py      # GaussianActor, CentralizedCritic, ValueNet 등
    ├── agent.py         # LLMGuidedCTDE
    ├── env.py           # P2PEnergyEnv
    └── train.py         # train(cfg, dataset) 함수
```

실행은 **프로젝트 루트(marl_260306)**에서 `python3 train.py` 로 하면 됩니다.

---

## 사용방법

### 기본 학습 실행

```bash
# 프로젝트 루트에서
python train.py
```

- 데이터: `data/paper_reproduction_dataset_from_screenshot_schema.pkl` 이 있으면 자동 사용, 없으면 합성 데이터로 학습
- 체크포인트: `checkpoints/` 에 저장 (경로는 `marl/config.py` 의 `checkpoint_dir` 로 변경 가능)
- Expert: 기본값은 **HeuristicLLMExpert** (휴리스틱만 사용, API 호출 없음)
- **에이전트 수**: 기본 20명. **10명으로 실행**하려면 환경변수로 지정:
  ```bash
  N_AGENTS=10 python train.py
  ```
  (동일하게 `run_llm_expert.py` 에서는 `N_AGENTS=10 python run_llm_expert.py`)

### LLM Expert 로 학습하기

1. **환경 변수 설정**
   - `.env.example` 을 복사해 `.env` 생성 후 API 키 설정
   - **Azure OpenAI**: `AZURE_OPENAI_API_KEY=...` (필요 시 `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION`)
   - **OpenAI 직접**: `OPENAI_API_KEY=...`

2. **실행**
   ```bash
   USE_LLM_EXPERT=1 python train.py
   ```
   또는 `marl/config.py` 에서 `use_llm_expert: bool = True` 로 변경 후 `python train.py`

3. **확인**
   - 시작 시 `Expert: LLMExpert (API)` 또는 `Expert: HeuristicLLMExpert` 출력
   - API 키가 없거나 호출 실패 시 자동으로 HeuristicLLMExpert 로 폴백

4. **train.py 실행 시 LLM 사용량**

   `USE_LLM_EXPERT=1 python train.py` 로 학습할 때, LLM은 **매 환경 스텝마다 1회** 호출됩니다.

   | 항목 | 기본값 | 계산 | 비고 |
   |------|--------|------|------|
   | **호출 횟수** | — | `max_episodes × steps_per_episode` | config 기본: 1000 × 96 = **96,000 회** |
   | **에피소드당 호출** | 96 | `steps_per_episode` (하루 15분×96) | 에피소드 1개 = 96 스텝 |
   | **입력(프롬프트)** | — | 약 400~700 tokens/회 | 프로슈머 수·obs 10차원에 따라 변동 (n_agents=20 기준) |
   | **출력(max)** | 800 tokens/회 | LLMExpert `max_tokens=800` | 20행×5열 행동 + 여유분 |
   | **ExpertStrategy** | — | `max_tokens=1200`/회 | JSON 응답 사용 시 |

   **대략 규모 (기본 설정, LLMExpert 기준)**  
   - 총 **API 호출**: 96,000 회  
   - **입력 토큰**: 약 96,000 × 500 ≈ **4,800만 tokens** (추정)  
   - **출력 토큰**: 최대 96,000 × 800 ≈ **7,680만 tokens** (실제는 응답 길이에 따라 더 적을 수 있음)

   **사용량 줄이는 방법**  
   - **에피소드 수 감소**: `marl/config.py`에서 `max_episodes`를 줄이거나, 학습 초기 검증만 할 경우 소수(예: 100)로 설정 후 실행.  
   - **스텝당 호출 유지**: 현재 구조상 스텝마다 Expert 정답이 필요하므로, 호출 횟수를 줄이려면 에피소드 수를 줄이는 것이 유일한 방법입니다.  
   - **휴리스틱만 사용**: `USE_LLM_EXPERT=0`(기본)이면 LLM 호출 없음.

### 기타 Expert 모드

- **ExpertStrategy (JSON 응답)**: `marl/config.py` 에서 `use_expert_strategy_json = True` 로 설정
- **4단계 워크플로**: `use_4step_workflow = True` 로 설정

### 전력 예측·가격 결정·Prosumer 모두 LLM 전문가 지침 재학습 케이스

**전력 사용량 예측**, **가격 결정**, **Prosumer** 행동을 모두 LLM 전문가 지침으로 사용해 재학습하려면:

```bash
python run_retrain_llm_expert_full.py
python run_retrain_llm_expert_full.py --episodes 100
python run_retrain_llm_expert_full.py --pkl data/paper_reproduction_dataset_from_screenshot_schema.pkl
python run_retrain_llm_expert_full.py --expert-only   # 학습 없이 Expert만 롤아웃
```

- **전문가**: ExpertStrategy (프로슈머 프로파일 + 현재 상태 + **가격** + **다음 스텝 전력/가격 예측 맥락** → LLM이 JSON으로 최적 행동 생성)
- **전력 예측**: 환경의 `get_forecast_context()`로 다음 스텝 부하/PV/가격 맥락을 전문가 프롬프트에 포함
- **가격 결정**: obs의 구매/판매 가격 및 forecast의 다음 시점 가격을 전문가가 참고
- **Prosumer**: LLM이 각 프로슈머별 P_CDG, P_RDG, Q_RDG, P_BESS, P_CL 생성
- 로그: `train_retrain_llm_expert_full.log`

### 학습 후 추론

- 정책 로드: `LLMGuidedCTDE.load_policy("checkpoints/policy_for_inference.pt")`
- 행동 선택: `agent.select_actions(obs, deterministic=True)` (obs shape: `(n_agents, 10)`)
- **10개 에이전트 중 한 에이전트만 실행(CTDE)**: `agent.select_action_single(obs_i, agent_id=i)` — 실생활 데이터를 한 에이전트에만 적용할 때 사용. 자세한 내용은 "3-5. CTDE: 10개 에이전트 중 하나만 실생활 데이터로 실행" 참고.

### 실생활 파이프라인 데모

학습된 정책을 **한 날짜(96스텝)** 시뮬레이션하고, 추론된 행동을 **물리량(setpoint)으로 변환해 CSV**로 저장하는 데모 프로그램입니다.

**전제**: `python train.py` 또는 `N_AGENTS=10 python train.py` 로 학습을 끝낸 뒤 `checkpoints/policy_for_inference.pt` 가 있어야 합니다.

**실행**

```bash
python demo_realtime_pipeline.py
```

**옵션**

- `--policy PATH`: 추론용 정책 파일 (기본: `checkpoints/policy_for_inference.pt`)
- `--data PATH`: pkl 데이터 경로 (기본: `data/paper_reproduction_dataset_from_screenshot_schema.pkl` 또는 합성 데이터)
- `--output-dir DIR`: 결과 CSV 저장 디렉터리 (기본: `demo_output`)
- `--day-offset N`: 에피소드(날짜) 오프셋 (기본: 0)

**출력**

- **demo_actions.csv**: 스텝·에이전트별 행동(a0~a4)과 변환된 setpoint (`p_cdg_kw`, `p_rdg_kw`, `q_rdg_kvar`, `p_bess_kw`, `p_cl_cut_kw`)
- **demo_system.csv**: 스텝별 시스템 지표 (`operational_cost`, `grid_import_kw`, `grid_export_kw`, `p2p_volume_kw`, `cost_grid`, `cost_p2p`)
- 콘솔에 스텝 수·총 비용·평균 비용 요약 출력

**실생활 연동**: `demo_actions.csv`의 setpoint를 설비 제어·SCADA·시뮬레이터 입력으로 사용하거나, 동일 파이프라인을 실측 obs를 넣는 루프로 교체하면 됩니다.

#### 데모 결과 파일의 의미

- **demo_actions.csv**: 스텝(0~95)·에이전트(agent_id)별 한 행. **step**=시간 인덱스(15분 단위), **agent_id**=프로슈머 번호, **a0~a4**=정책의 정규화 출력 [-1,1] (순서대로 P_CDG, P_RDG, Q_RDG, P_BESS, P_CL), **p_cdg_kw**, **p_rdg_kw**, **q_rdg_kvar**, **p_bess_kw**, **p_cl_cut_kw**=위를 실물리량(kW·kVAr)으로 변환한 setpoint. 행 수 = 96×n_agents. 설비 제어·시뮬레이터 입력용.
- **demo_system.csv**: 스텝(0~95)별 한 행. **operational_cost**=해당 15분 구간 운영 비용, **grid_import_kw**/**grid_export_kw**=계통 수전/판매량, **p2p_volume_kw**=P2P 거래량, **cost_grid**/**cost_p2p**=계통·P2P 비용. 행 수 = 96. 시스템 성과·비용 분석용.

**컬럼 요약**: demo_actions — step(0~95), agent_id(프로슈머), a0~a4(정규화 행동), p_cdg_kw·p_rdg_kw·q_rdg_kvar·p_bess_kw·p_cl_cut_kw(setpoint). demo_system — step, operational_cost, grid_import_kw, grid_export_kw, p2p_volume_kw, cost_grid, cost_p2p.

### LLM Expert 단계만 별도 실행

**학습(pkl 데이터로 train.py 실행)은 이미 완료한 상태에서**, LLM Expert만 동작을 확인하고 싶을 때 사용합니다. 에이전트 학습 없이 동일 pkl 데이터·동일 환경에서 **Expert 행동만**으로 에피소드를 진행하고, 에피소드별 reward / cost / viol 을 출력합니다.

#### LLM Expert만 실행할 때 LLM이 사용되는 방식

`run_llm_expert.py`는 **LLMExpert**를 사용합니다. API 키가 설정되어 있으면 매 스텝마다 아래처럼 **LLM이 실제로 호출**됩니다.

1. **매 스텝(15분 단위)마다**
   - 현재 **obs**(20개 프로슈머 × 10차원)와 **prosumer_meta**(타입 등)로 프롬프트 생성  
     → "P2P energy system operator" 역할, 프로슈머별 상태 요약, **20행×5열** (P_CDG, P_RDG, Q_RDG, P_BESS, P_CL) 형식으로 출력하라고 지시.

2. **LLM API 호출**
   - Azure OpenAI 또는 OpenAI `chat.completions.create` 호출 (모델·배포는 config/환경변수).
   - 응답 텍스트에서 숫자만 파싱해 `(20, 5)` 행동 배열로 변환, `[-1, 1]` 클리핑.

3. **환경에 반영**
   - 이 행동으로 `env.step(actions)` 한 번 수행 → reward, cost, viol 누적 후 다음 스텝으로 이동.

4. **폴백**
   - API 키가 없거나, 호출 실패·파싱 실패 시 해당 스텝은 **HeuristicLLMExpert**와 동일한 휴리스틱 행동으로 대체 (LLM 호출 없음).

따라서 **LLM Expert만 실행**할 때는 “환경이 나에게 준 obs만 보고, LLM이 매 스텝 행동을 결정하고, 그 행동으로 환경이 진행된다”는 흐름으로 **LLM이 직접 사용**됩니다. 에피소드당 96스텝이면 스텝당 1회 API 호출이 발생합니다.

#### 전체 실행(train.py)과의 차이

| 구분 | 전체 실행 (`train.py`, `USE_LLM_EXPERT=1`) | LLM Expert만 실행 (`run_llm_expert.py`) |
|------|--------------------------------------------|----------------------------------------|
| **목적** | pkl 데이터로 **에이전트(정책) 학습** | Expert만으로 **롤아웃·성능 확인** (학습 없음) |
| **LLM 역할** | 매 스텝 **Expert 정답(행동)** 생성 → 에이전트가 이 정답에 맞추어 **Imitation(W2 제약)** 학습 | 매 스텝 **행동을 직접 결정** → 그 행동으로 `env.step()` 한 번만 수행 |
| **에이전트** | **LLMGuidedCTDE** 사용. `select_actions`로 행동 선택 후 replay에 저장, `update`로 Q·Actor·λ 학습 | **에이전트 없음**. Expert 행동만으로 환경 진행 |
| **리플레이/학습** | DualReplay에 (state, obs, actions, expert_actions 등) 저장 후 배치 샘플링, `agent.update()` | 없음. 저장·업데이트 없음 |
| **체크포인트** | 주기/최종 저장, `policy_for_inference.pt` 등 | 저장 안 함 |
| **에피소드 수** | `config.max_episodes` (예: 1000) | 기본 5, `LLM_EXPERT_EPISODES`로 변경 가능 |
| **출력** | reward/cost/viol + q1/actor/w2/lambda 등 학습 지표 | reward/cost/viol 만 (Expert Episode 단위) |

요약하면, **전체 실행**은 “LLM Expert가 만든 정답을 참고해서 에이전트를 학습”하는 단계이고, **LLM Expert만 실행**은 “에이전트 없이 LLM이 만든 행동만으로 시뮬레이션을 돌려서 Expert 성능을 보는” 단계입니다.

#### 실행 과정

`python run_llm_expert.py` 를 실행했을 때 코드가 진행되는 순서는 다음과 같습니다.

1. **초기화**
   - 프로젝트 루트의 `.env` 로드 (API 키 등).
   - `TrainConfig()` 생성 후 `use_llm_expert = True` 로 고정.
   - 데이터 경로 탐색: `data/paper_reproduction_dataset_from_screenshot_schema.pkl` (또는 루트의 동일 파일명)이 있으면 해당 pkl 로드, 없으면 합성 데이터 생성.
   - `get_dataset(pkl_path)` 로 **dataset** 딕셔너리 확보 (timeseries, prosumers 등).
   - 에피소드 수 결정: 환경변수 `LLM_EXPERT_EPISODES` 가 있으면 그 값, 없으면 **5**.

2. **Expert·환경 생성** (`run_expert_only` 내부)
   - `set_seed(cfg.seed)` 로 난수 시드 고정.
   - **P2PEnergyEnv(cfg, dataset)** 로 P2P 에너지 환경 생성 (프로슈머 메타, 일별 96스텝 시계열 준비).
   - **LLMExpert(cfg.act_dim, cfg)** 생성. API 키가 있으면 Azure/OpenAI 클라이언트 연결, 없으면 `_use_llm = False` 로 두고 이후 스텝마다 Heuristic 폴백.

3. **에피소드 루프** (기본 5회)
   - **에피소드 시작**: `env.reset()` → 그날(하루)에 해당하는 **state**, **obs** (20×10) 생성.
   - **스텝 루프** (96스텝 = 24시간, 15분 간격):
     - `actions = expert.generate_actions(obs, env.prosumer_meta)`  
       → API 사용 시: 프롬프트 생성 → LLM 호출 → 응답 파싱 → (20, 5) 행동; 실패 시 휴리스틱.
     - `next_state, next_obs, reward, done, info = env.step(actions)`  
       → 전력수지·P2P·계통 거래·전압 위반·운영 비용 계산 후 reward/cost/viol 누적.
     - `state, obs` 갱신 후 다음 스텝으로.
   - **에피소드 종료**: 96스텝이 끝나면 해당 에피소드의 **reward 합**, **cost 평균**, **viol 평균**을 한 줄로 출력하고 다음 에피소드로.

4. **종료**
   - 설정한 에피소드 수만큼 끝나면 `Expert-only run finished: N episodes in ... s` 출력.
   - 스크립트에서 **총 소요 시간** 출력 후 종료. **파일 저장 없음** (체크포인트·로그 파일·replay 등 없음).

#### 결과물

실행이 끝난 뒤 **생기는 것은 터미널에 찍힌 로그뿐**입니다. 디스크에는 새 파일이 저장되지 않습니다.

- **시작 시 출력**
  - `Run: LLM Expert only (no agent training)` — 학습 없이 Expert만 돌린다는 안내.
  - `Expert: LLMExpert (API)` 또는 `Expert: HeuristicLLMExpert` — 실제 사용 Expert (API 키 유무에 따라 결정).
  - `Using dataset: <경로>` 또는 `No pkl found; using synthetic ...` — 사용한 데이터 소스.
  - `Episodes: N` — 이번에 돌릴 에피소드 수.

- **에피소드별 한 줄** (매 에피소드 끝날 때마다)
  - 예: `[Expert Episode 0000] reward=-235191.81 cost=2449.9147 viol=0.013303 | elapsed=20.6s`
  - **reward**: 그 에피소드(하루) 동안 받은 **보상의 합**. 정의상 `reward = -operational_cost` 이므로, **음수일수록 그날 운영 비용이 큼** (수전·판매·P2P·전압 페널티 포함).
  - **cost**: 그 에피소드에서 스텝별 **operational_cost**의 **평균** (한 15분 구간당 비용).
  - **viol**: 그 에피소드에서 스텝별 **voltage_violation_rate**의 **평균** (전압 위반률, 0에 가까울수록 양호).
  - **elapsed**: 첫 에피소드 시작부터 현재 에피소드 종료까지 경과 시간(초).

- **종료 시 출력**
  - `Expert-only run finished: 5 episodes in 98.50 s` — Expert만으로 N에피소드 롤아웃이 끝났고 그 구간 소요 시간.
  - `Total time: 98.50 s` — 스크립트 전체 실행 시간 (데이터 로드 + 에피소드 루프 포함).

**정리**: 실행 과정은 “데이터 로드 → Expert·환경 생성 → 에피소드마다 Expert 행동으로 96스텝 진행 → 에피소드별 reward/cost/viol 출력”이고, **결과물은 위와 같은 콘솔 로그만** 있으며, 체크포인트·정책 파일·학습 로그 파일 등은 생성되지 않습니다.

---

1. **실행**
   ```bash
   python run_llm_expert.py
   ```
   - 데이터: `data/paper_reproduction_dataset_from_screenshot_schema.pkl` 자동 사용 (train.py와 동일 후보 경로)
   - Expert: **LLMExpert** 고정 (API 키 없으면 Heuristic으로 자동 폴백)
   - 기본 에피소드 수: **5** (빠른 확인용)

2. **에피소드 수 변경**
   ```bash
   LLM_EXPERT_EPISODES=10 python run_llm_expert.py
   ```

3. **에이전트 수 변경 (예: 10명)**
   ```bash
   N_AGENTS=10 python run_llm_expert.py
   ```
   (학습 시에도 `N_AGENTS=10 python train.py` 로 동일하게 지정 가능)

4. **출력 예**
   ```
   Run: LLM Expert only (no agent training)
   Expert: LLMExpert (API)
   Using dataset: .../data/paper_reproduction_dataset_from_screenshot_schema.pkl
   Episodes: 5
   [Expert Episode 0000] reward=-... cost=... viol=... | elapsed=...s
   [Expert Episode 0001] ...
   ...
   Expert-only run finished: 5 episodes in ... s
   Total time: ... s
   ```

5. **정리**
   - **train.py**: pkl 데이터로 **에이전트 학습** (Expert는 보조 정답으로만 사용)
   - **run_llm_expert.py**: **Expert만** 사용해 환경 롤아웃, 학습·체크포인트 저장 없음

### LLM-MARL 통합: 진행 상황과 추가 진행 사항

아래 세 가지 목표를 기준으로 **지금까지 진행한 것**과 **추가로 진행할 것**을 정리합니다.

| 목표 | 내용 | 현재 상태 | 비고 |
|------|------|-----------|------|
| **LLM 전문가 활용** | LLMExpert / ExpertStrategy가 action 생성 (`marl/expert.py`, `marl/expert_strategy.py`) | ✅ 구현·연결됨 | train.py에서 cfg에 따라 선택, run_llm_expert.py로 Expert만 단독 실행 가능 |
| **MARL 학습 지도** | replay에 expert_actions, actor loss에서 W2(π, expert) 제약 (`marl/train.py`, `marl/agent.py`) | ✅ 구현됨 | replay.add(…, expert_actions), agent.update()에서 W2·λ 사용 |
| **인간 전문가 대체** | 휴리스틱·LLM·fallback으로 참조 정책 제공 | ✅ 구현됨 | HeuristicLLMExpert / LLMExpert(실패 시 휴리스틱), ExpertStrategy(JSON+fallback) |

#### 지금까지 진행한 것 (LLM Expert 실행 기준)

- **LLM Expert 단독 실행** (`run_llm_expert.py`)까지 진행한 상태입니다.
  - **한 것**: pkl 데이터 로드 → **LLMExpert**로 매 스텝 **action 생성** → `env.step(actions)` 로만 진행 → 에피소드별 reward/cost/viol 출력.
  - **의미**: “LLM이 참조 정책(Expert)으로서 행동을 생성하는지” **동작 확인**까지 완료. 학습·replay·체크포인트는 사용하지 않음.

코드 상으로는 **LLM-MARL 통합** 세 가지 목표가 모두 구현되어 있습니다.

- **LLM 전문가 활용**: `marl/expert.py`의 LLMExpert, `marl/expert_strategy.py`의 ExpertStrategy가 `generate_actions(obs, prosumer_meta)` 로 (n_agents, act_dim) 행동 생성. `marl/train.py`에서 `use_llm_expert` / `use_expert_strategy_json` / `use_4step_workflow` 에 따라 하나를 선택해 사용.
- **MARL 학습 지도**: `marl/train.py`에서 매 스텝 `expert_actions = expert.generate_actions(...)` 후 `replay.add(..., expert_actions=expert_actions)`. `marl/replay.py`의 DualReplay가 expert_actions 저장·샘플링. `marl/agent.py`의 `update()`에서 배치의 `expert_actions`로 W2(π, expert) 계산, actor loss에 **λ·(W2 − ε)** 제약 및 Lagrange λ 셀프 튜닝.
- **인간 전문가 대체**: 휴리스틱(HeuristicLLMExpert), LLM(LLMExpert·ExpertStrategy), fallback(LLM 실패 시 HeuristicLLMExpert 또는 FallbackSolver)이 모두 참조 정책으로 사용 가능.

#### 추가로 진행할 것

목표를 “달성”으로 보려면 **전체 파이프라인을 한 번 끝까지 실행**하는 단계가 필요합니다.

1. **전체 학습 실행 (LLM Expert를 참조 정책으로 사용)**
   - **실행**: `.env`에 API 키 설정 후 `USE_LLM_EXPERT=1 python train.py` (또는 `marl/config.py`에서 `use_llm_expert = True` 로 두고 `python train.py`).
   - **의미**: pkl 데이터로 **에이전트를 학습**하면서, 매 스텝의 **expert_actions**가 **LLM**에서 오도록 함. replay에 (state, obs, actions, expert_actions)가 쌓이고, actor는 **W2(π, expert)** 제약으로 LLM Expert에 맞추어 학습됨.
   - **결과물**: `checkpoints/` 에 checkpoint_final.pt, policy_for_inference.pt 등 저장. 학습 로그에서 reward/cost/viol 및 q1/actor/w2/lambda 확인.

2. **(선택) 다른 Expert 모드로 학습**
   - **ExpertStrategy (JSON 응답)**: `use_expert_strategy_json = True` 로 설정 후 `python train.py`.
   - **4단계 워크플로**: `use_4step_workflow = True` 로 설정 후 동일하게 학습.

3. **(선택) 실험·평가**
   - 학습된 정책으로 롤아웃해 reward/cost/viol을 LLM Expert만 실행 결과와 비교.
   - 에피소드 수·ε 스케줄·초기 λ 등 하이퍼파라미터 조정 후 재학습.

**요약**: LLM Expert 실행은 **“Expert만 단독 롤아웃”**까지 진행한 상태. **추가로 할 일**은 **`USE_LLM_EXPERT=1 python train.py` 로 전체 학습을 돌려**, LLM Expert를 참조 정책으로 둔 MARL 학습을 한 번 완료하고, 필요 시 ExpertStrategy/4step 실행 및 성능 비교까지 진행하는 것.

---

## 1. P2PEnergyEnv + pkl 샘플 데이터

- **`marl/data_loader.py`**
  - `paper_reproduction_dataset_from_screenshot_schema.pkl` 로드
  - pkl이 없으면 동일 스키마의 **합성 데이터** 생성 (`build_synthetic_paper_dataset`)
  - `build_episode_arrays()`: 한 에피소드(하루 96스텝) 분량을 `(max_steps, n_agents)` numpy 배열로 제공

- **`marl/env.py`**
  - **obs/state**: 논문 형식  
    `[시각_norm, TOU_구매가, TOU_판매가, P_RDG_max, P_Load, Q_Load, prev_CDG, prev_SOC, prev_P2P, prev_V]` (10차원)
  - **`step()`**에서 실제 수식 사용:
    - **전력수지**: `P_net_i = P_CDG + P_RDG + P_BESS - (P_load - P_CL_cut)` (에이전트별)
    - **P2P 거래량**: `min(총 surplus, 총 deficit)` (내부 거래량)
    - **grid import/export**: P2P 후 잔여로 `grid_import_kw`, `grid_export_kw`
    - **voltage violation**: `V_i = 1 + k·(P_net_i/P_ref)` 프록시, `violation = max(0, |V_i - 1| - 0.05)`
    - **global reward**:  
      `reward = -(grid_import·price_buy·Δt - grid_export·price_sell·Δt + P2P·price_p2p·Δt + violation_penalty)`

---

## 2. HeuristicLLMExpert → LLM 워크플로

- **`marl/expert.py`**에 **`LLMExpert`** 추가:
  - 프로슈머별/시점별로 `_build_prompt_for_timestep(obs, prosumer_meta)`로 프롬프트 생성
  - **OpenAI API** (`OPENAI_API_KEY` 설정 시) 호출 후, 응답에서 `[P_CDG, P_RDG, Q_RDG, P_BESS, P_CL]` (20행×5열) 파싱
  - API 키 없거나 실패 시 **HeuristicLLMExpert**와 동일한 휴리스틱으로 자동 폴백

- **`config.use_llm_expert`**: `True`면 `LLMExpert`, `False`면 `HeuristicLLMExpert` 사용

### LLM Expert 실행 방법

1. **환경 변수 설정** (Azure OpenAI 사용 시)
   - 프로젝트 루트에 `.env` 파일 생성 (`.env.example` 복사 후 수정)
   - `AZURE_OPENAI_API_KEY=your_api_key_here` (또는 `OPENAI_API_KEY` 로 OpenAI 직접 사용)
   - 필요 시 `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION` 설정

2. **실행**
   - **방법 A**: 환경 변수로 LLM Expert 사용  
     `USE_LLM_EXPERT=1 python train.py`
   - **방법 B**: `marl/config.py`에서 `use_llm_expert: bool = True` 로 변경 후  
     `python train.py`

3. **동작**
   - API 키가 있으면 매 스텝마다 LLM이 프로슈머별 행동 `[P_CDG, P_RDG, Q_RDG, P_BESS, P_CL]` 을 생성하고, 이를 Expert 정답으로 Imitation 학습에 사용
   - API 키가 없거나 호출 실패 시 자동으로 **HeuristicLLMExpert**로 폴백 (휴리스틱만 사용)
   - 실행 시 `Expert: LLMExpert (API)` 또는 `Expert: HeuristicLLMExpert` 로 현재 모드 확인 가능

---

## 3. obs/state 정의 (논문 형식)

- **obs**: `[시각_norm, lambda_B, lambda_S, P_RDG_max, P_Load, Q_Load, prev_CDG, prev_SOC, prev_P2P, prev_V]`  
  가격·출력은 스케일링 후 사용 (예: 가격/300, 전력/200).

---

## 4. 실행 결과 지표 설명 (실생활 연계)

학습 시 로그에 나오는 **episode**, **reward**, **cost**, **viol**, **q1**, **actor**, **w2**, **lambda**의 의미를 실제 P2P 에너지 시스템에 빗대어 정리합니다.

### episode (에피소드)

- **의미**: 강화학습에서 **한 번의 시뮬레이션 구간**을 뜻합니다.  
  이 프로젝트에서는 **하루(24시간)** 를 하나의 에피소드로 둡니다.
- **구성**:
  - **시작**: `env.reset()` — 그날 0시(첫 15분 구간) 상태로 초기화.
  - **진행**: `steps_per_episode = 96` 번의 **step** — 15분 간격으로 96번 진행하면 24시간(0:00~24:00).
  - **종료**: 96스텝이 끝나면 `done = True`, 그다음 에피소드는 **다른 날**의 데이터로 새로 `reset()`.
- **실생활 연계**:
  - **1 episode = “마이크로그리드가 하루 동안 20개 프로슈머를 어떻게 운전했는지” 한 번 시뮬레이션한 것**과 같습니다.
  - 아침·낮·저녁 등 **TOU 단가 변화**, **태양광·부하 패턴**이 하루 단위로 반복되므로, “하루”를 단위로 두고 비용·전압을 평가하는 것이 자연스럽습니다.
  - **Episode 0000, 0010, …** 은 **0일차, 10일차, …** 처럼 “몇 번째로 시뮬레이션한 하루인지”를 나타냅니다.
- **학습에서의 역할**:
  - 매 에피소드마다 **reward, cost, viol**은 “그날 하루”의 합·평균입니다.
  - 에피소드가 진행될수록(**max_episodes**까지) 정책이 업데이트되며, **여러 날(여러 에피소드)** 을 겪으면서 “비용을 줄이고 전압을 지키는” 운전을 배웁니다.

- **에피소드 개수**:  
  기본값은 **5,000개** (`marl/config.py`의 `max_episodes = 5000`).  
  즉, 학습 한 번에 **5,000일 분량**의 시뮬레이션을 돌립니다.  
  변경하려면 `marl/config.py`에서 `max_episodes` 값을 수정하면 됩니다.

---

### reward (에피소드 누적 보상)

- **의미**: 한 에피소드(예: 하루 96스텝) 동안 받은 보상의 합.
- **계산**: 매 15분 구간마다 `reward = -operational_cost` 이고, 에피소드 reward는 이 값들을 모두 더한 것.
- **실생활 연계**:  
  “전체 마이크로그리드가 그날 얼마나 **비용을 줄였는지**”를 음수 비용으로 보상으로 둔 것입니다.  
  - **reward가 높을수록(덜 마이너스)** → 그날 운영 비용이 적게 든 것 → 수전 비용·판매 손실·P2P 비용·전압 위반 페널티를 잘 줄인 운영.
  - **reward가 낮을수록(많이 마이너스)** → 비용·페널티가 큰 운영.

정리하면, **reward = −(그날 총 운영 비용)** 이라 보면 됩니다.

---

### cost (운영 비용)

- **의미**: 한 스텝(15분)의 **operational_cost**를 에피소드 전체에 대해 평균한 값.  
  로그에는 `ep_cost / steps_per_episode` 로 표시됩니다.
- **계산**:  
  `operational_cost = cost_grid + cost_p2p + penalty_v`  
  - **cost_grid**: 계통에서 사서 쓴 비용 − 계통으로 판매한 수입  
    - 실생활: 전력회사에서 전기 사오는 비용(TOU 단가×사용량)에서, 남는 전기 판매 수입을 뺀 것.  
  - **cost_p2p**: P2P 거래 비용  
    - 실생활: 이웃끼리 전기 거래할 때 지불하는 대금(거래량×P2P 단가).  
  - **penalty_v**: 전압 위반 페널티  
    - 실생활: 전압이 규정 범위를 벗어나면 부과하는 벌금·리스크 비용에 해당.
- **실생활 연계**:  
  “**15분당 평균 운영 비용(원)**”에 해당합니다.  
  - **cost가 작을수록** → 수전·P2P·전압 위반을 잘 관리한 운영.  
  - **cost가 클수록** → 비싼 시간대 수전, 과도한 P2P 비용, 전압 문제가 많은 운영.

---

### viol (전압 위반률)

- **의미**: 한 스텝에서 **전압 위반 정도**를 프로슈머별로 평균한 값(`voltage_violation_rate`)을, 에피소드 전체 스텝에 대해 다시 평균한 것.
- **계산**:  
  각 버스(프로슈머)에서 전압을 `V_i = 1 + k·(P_net_i / P_ref)` 로 근사하고,  
  `violation = max(0, |V_i − 1.0| − 0.05)` 로 “허용 구간(0.95~1.05 p.u.) 밖으로 나간 양”을 쌓아 평균.
- **실생활 연계**:  
  - **viol ≈ 0** → 전압이 허용 범위 안에 있어 **계통 품질·안전**이 유지됨.  
  - **viol이 클수록** → 전압 이탈이 잦거나 크다는 뜻으로,  
    실무에서는 **전압 규제 위반**, **설비 보호**, **품질 저하** 등으로 이어질 수 있는 지표.  
  학습에서는 이 값을 페널티(penalty_v)로 넣어 “전압을 지키는 정책”을 유도합니다.

---

### q1 (Q 네트워크 손실)

- **의미**: **Centralized Critic** Q1이 예측한 “상태·행동의 가치”와 TD 타깃(실제 보상 기반) 사이의 **MSE 손실**.
- **계산**: `q1_loss = MSE(Q1(state, obs, actions), y)`  
  `y = reward + γ·(1−done)·V_target(next_state)`.
- **실생활 연계**:  
  - Q는 “지금 이 20명이 이렇게 행동했을 때, 앞으로 받을 **총 비용 감소(보상)** 를 얼마로 보는가”를 학습합니다.  
  - **q1이 줄어들수록** → “비용·보상 예측이 실제에 가까워진다”는 뜻으로,  
    수전·P2P·전압을 반영한 **가치 예측**이 정확해지는 방향.  
  - 학습이 잘 되면 q1, q2 모두 안정적으로 작은 값으로 수렴합니다.

---

### actor (액터 손실)

- **의미**: 20명의 **Actor(정책)** 를 한꺼번에 업데이트할 때 쓰는 **총 actor loss**.
- **계산**:  
  각 프로슈머 \(i\)에 대해  
  `loss_i = −Q(state, obs, 새 행동) + λ_i · (W2(π_i, expert) − ε)`  
  이걸 모두 더한 값.  
  - 앞쪽: “Q가 높다고 평가하는 행동(비용을 줄이는 쪽)을 더 하도록” 유도.  
  - 뒤쪽: “Expert(LLM/휴리스틱)와 너무 달라지지 않게” W2 거리로 제약.
- **실생활 연계**:  
  - **Actor**는 “각 프로슈머가 CDG·RDG·BESS·부하를 **어떤 출력/절감으로 조절할지**” 결정합니다.  
  - **actor loss가 줄어든다** →  
    (1) 비용을 줄이는 방향으로 행동을 고르고(**−Q**),  
    (2) 동시에 Expert 정책과 지나치게 어긋나지 않게(**W2 제약**) 학습한다는 뜻.  
  - 즉, “**비용 절감 + 안전한 참고 정책(Expert) 준수**” 사이의 균형을 배우는 지표입니다.

---

### w2 (Wasserstein-2 거리, 평균)

- **의미**: 각 프로슈머의 **Actor가 내는 행동 분포**와 **Expert가 제안한 행동** 사이의 **W2 거리**를 프로슈머·배치에 대해 평균한 값.
- **계산**:  
  Actor 출력은 가우시안(μ, σ), Expert는 “권장 행동” 하나로 보고,  
  `W2 ≈ sqrt((μ − a_expert)² + σ²)` 를 차원별로 더한 뒤 평균.
- **실생활 연계**:  
  - **Expert**는 LLM/휴리스틱으로 “이 상황에서 이렇게 운전하는 게 좋다”는 **참고 전략**을 줍니다.  
  - **w2가 작을수록** → Actor가 **Expert와 비슷한 행동**을 한다는 뜻.  
    즉, “전문가/LLM이 제안한 운전 방식에 가깝게” 학습 중.  
  - **w2가 크면** → 아직 Expert와 많이 다르게 행동한다는 뜻이고,  
    학습 설정에 따라 **ε(epsilon)** 까지는 허용하고, 그 이상이면 Lagrange 항으로 당깁니다.

---

### lambda (라그랑주 승수, 평균)

- **의미**: “**Imitation 제약**(W2 ≤ ε)을 얼마나 강하게 지킬지”를 조절하는 **라그랑주 승수**를, 20명 프로슈머에 대해 평균한 값.
- **계산**:  
  각 프로슈머마다 `λ_i`가 하나씩 있고,  
  `actor loss`에 `λ_i · (W2_i − ε)` 가 들어가며,  
  `λ_i`는 “W2가 ε보다 크면 커지고, 작으면 줄어들도록” 별도로 업데이트됩니다.
- **실생활 연계**:  
  - **lambda가 크다** → “Expert를 꽤 따르라”는 제약이 **강한** 상태.  
    W2 > ε 이면 페널티가 커서, 정책이 Expert 쪽으로 더 당겨짐.  
  - **lambda가 작다** → 제약이 **약한** 상태.  
    비용(Q)을 줄이는 쪽으로 더 자유롭게 움직일 수 있음.  
  - 학습이 진행되면서 **W2 ≈ ε** 근처에서 균형이 잡히면, lambda도 안정되는 경향이 있습니다.

---

### 요약 표

| 지표     | 실생활 의미                          | 좋은 방향        |
|----------|--------------------------------------|------------------|
| episode  | 몇 번째 “하루” 시뮬레이션인지        | 학습 진행에 따라 증가 |
| reward   | 그날 총 비용의 음수(비용 절감 정도)  | 높을수록(0에 가까울수록) |
| cost     | 15분당 평균 운영 비용                | 낮을수록         |
| viol     | 전압 규정 이탈 정도                  | 0에 가까울수록   |
| q1       | 비용/보상 예측 정확도                | 낮을수록(수렴)   |
| actor    | 비용 절감 + Expert 준수 균형 학습    | 수렴하면 적당한 값 |
| w2       | Expert 정책과의 행동 유사도          | ε 근처로 수렴   |
| lambda   | Expert 따르기 제약의 강도           | 균형 잡힐 때 안정 |

---

## 5. 결과물은 어떻게 생성되나요?

학습을 실행했을 때 **어떤 결과가 어디에** 만들어지는지 정리합니다.

### 현재 자동으로 생성되는 결과물

| 결과물 | 위치 | 생성 시점 | 내용 |
|--------|------|-----------|------|
| **콘솔 로그** | 표준 출력(stdout) | 실행 내내 | 10 에피소드마다 reward, cost, viol, q1, actor, w2, lambda, elapsed 출력. 마지막에 "Training finished in X s", "Total execution time: X s" |
| **train_log.txt** | 프로젝트 루트 | 학습 종료 직후 | 실행 시각, 총 실행 시간, max_episodes 가 한 줄씩 **추가(append)** 됨. 실행할 때마다 한 줄이 쌓임 |

- **콘솔 로그**: 터미널에 바로 보이는 메시지. 리다이렉트로 파일에 남기려면  
  `python3 train.py > run_stdout.txt 2>&1`  
  처럼 실행하면 됩니다.
- **train_log.txt**: `marl_260306/train_log.txt` 에 생성·추가됩니다. 수동으로 지우지 않으면 이전 실행 기록이 계속 남습니다.

### 현재 저장되지 않는 것

- **학습된 모델(가중치)**: 학습 종료 시 **체크포인트**와 **추론용 정책**이 자동 저장됩니다 (아래 "저장 결과물을 실생활에서 사용하기" 참고).
- **에피소드별 지표 파일**: reward, cost, viol 등을 CSV 등으로 저장하는 코드는 **없습니다**.  
  그래프나 나중 분석을 하려면 로그를 파일로 리다이렉트하거나, train 루프 안에서 리스트에 쌓았다가 학습 끝에 CSV로 저장하는 코드를 넣어야 합니다.

### 결과물 요약

- **지금 만들어지는 것**: **실행 시간 로그** (`train_log.txt`) + **콘솔 로그** + **체크포인트** (`checkpoints/checkpoint_final.pt`) + **추론용 정책** (`checkpoints/policy_for_inference.pt`).
- **추가하고 싶다면**: `config.save_every`으로 N 에피소드마다 체크포인트 저장. 지표는 매 에피소드 리스트에 쌓았다가 `pd.DataFrame(...).to_csv("metrics.csv")` 등.

---

## 저장 결과물을 실생활에서 사용하기

학습이 끝나면 `checkpoints/` 에 다음 파일이 생성됩니다.

| 파일 | 용도 |
|------|------|
| `checkpoint_final.pt` | 학습 재개용 전체 체크포인트 |
| `policy_for_inference.pt` | **배포/실생활용** — 추론 전용 (actors + 최소 config) |

추론 시에는 `LLMGuidedCTDE.load_policy("checkpoints/policy_for_inference.pt")` 로 로드한 뒤, `agent.select_actions(obs, deterministic=True)` 로 행동을 선택하면 됩니다. 저장 경로는 `marl/config.py`의 `checkpoint_dir`로 변경할 수 있습니다.

---

## 실행 방법

### pkl 사용 시

`data/paper_reproduction_dataset_from_screenshot_schema.pkl` 에 두고:

```bash
python3 train.py
```

코드에서 `data/`, `./data/`, 현재 디렉터리 순으로 pkl을 찾습니다.

### pkl 없을 때

pkl 파일이 없으면 자동으로 **합성 데이터**로 학습합니다.

### LLM Expert 사용 시 (Azure OpenAI gpt-5)

1. `marl/config.py`에서 `use_llm_expert = True` 로 설정
2. 프로젝트 루트에 `.env` 파일 생성 후 아래 내용 설정 (API 키는 본인 키로 교체):
   ```
   AZURE_OPENAI_ENDPOINT=https://skcc-atl-master-openai-01.openai.azure.com/
   AZURE_OPENAI_API_KEY=your_api_key_here
   AZURE_OPENAI_DEPLOYMENT=gpt-5
   ```
   또는 `.env.example`을 복사해 `.env`로 저장한 뒤 `AZURE_OPENAI_API_KEY`만 입력
3. 실행:
   ```bash
   python3 train.py
   ```
4. Azure 연결 정보는 `marl/config.py`의 `llm_endpoint`, `llm_deployment`(기본 gpt-5)로 설정됨. API 키는 반드시 환경변수 또는 `.env`에만 두세요.

### 의존성

- **pandas**: pkl/합성 데이터 처리
- **openai**: LLM Expert 사용 시 (`pip install openai`)
- **python-dotenv**: `.env`에서 API 키 로드 시 (`pip install python-dotenv`)

---

## Expert 전략 및 가상 Actor 10개 모델

### Expert 전략 (ExpertStrategy)

- **입력**: prosumer profile + 현재 상태 + 가격 + (선택) 예측치
- **출력**: LLM이 **JSON** 형태로 action 반환  
  `{"actions": [[P_CDG, P_RDG, Q_RDG, P_BESS, P_CL], ...]}`
- **실패 시**: fallback으로 **heuristic** 또는 **solver** 사용
  - `heuristic`: 프로필 기반 휴리스틱 (HeuristicLLMExpert)
  - `solver`: 가격·잔여량 기반 규칙 solver (FallbackSolver)

구현: `marl/expert_strategy.py` — `ExpertStrategy`, `FallbackSolver`

### 가상 Actor 10개 (VirtualExpertModel)

- **프로필**: Residential×2, Commercial×2, Rural×2, Industrial×2, EnergyHub×2 (총 10종)
- 각 프로필은 `type`, `risk_aversion`, `ess_preference`, `comfort_preference` 포함
- 시스템에서 **로드하여 추론**에 사용 가능

#### 모델 생성 및 저장

```bash
python run_virtual_expert.py
```

저장 위치: `checkpoints/virtual_expert_model/`  
- `virtual_expert_config.json`: act_dim, n_actors, profiles, use_llm, fallback

#### 시스템에서 로드 후 사용

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

#### 학습에서 Expert 전략(JSON) 사용

`marl/config.py`에서:

- `use_expert_strategy_json = True` → ExpertStrategy(JSON + fallback) 사용
- `use_llm_expert = True` → 기존 LLMExpert(텍스트 응답) 사용
- 둘 다 False → HeuristicLLMExpert만 사용

#### 4단계 워크플로우 사용 (모델 생성 → 도구 검색 → 코드 생성 → 코드 수정)

`marl/config.py`에서 `use_4step_workflow = True` 로 설정하면 다음 순서로 실행됩니다.

1. **모델 생성**: LLM이 상황에 맞는 전략 모델(타입/스펙) 생성  
2. **도구 검색**: 전략에 필요한 도구 목록 검색 (obs, get_price_buy, get_load, np, clip 등)  
3. **코드 생성**: 해당 도구로 `actions` 배열을 계산하는 Python 코드 생성  
4. **코드 수정**: 실행 실패 시 오류 메시지로 코드 수정 후 1회 재실행  

실패 시 휴리스틱 Expert로 자동 fallback. 구현: `marl/expert_workflow.py` (`ExpertWorkflow4Step`, `run_4step_workflow`).

---

## LLM + MARL 통합 프레임워크 요구사항 검증

목표·요구사항 대비 현재 코드 충족 여부입니다.

### 목표

- **실시간 P2P 전력 시장**: `marl/env.py` — 15분 스텝, P2P 거래량·가격 반영 ✓
- **프로슈머 협력**: CTDE, 전역 state·보상 (`marl/agent.py`, `marl/env.py`) ✓
- **사회적 후생 최대화**: `reward = -operational_cost` (env.py L165-166) ✓

### 1️⃣ LLM-MARL 통합

- **LLM 전문가 활용**: LLMExpert / ExpertStrategy가 action 생성 (`marl/expert.py`, `marl/expert_strategy.py`) ✓
- **MARL 학습 지도**: replay에 expert_actions, actor loss에서 W2(π, expert) 제약 (`marl/train.py`, `marl/agent.py`) ✓
- **인간 전문가 대체**: 휴리스틱·LLM·fallback으로 참조 정책 제공 ✓

### 2️⃣ 프로슈머 맞춤 LLM 워크플로우

요구: 자연어 → 1.모델 생성 2.도구 검색 3.코드 생성 4.코드 수정 → 실행 가능한 전략.

- **충족**: `marl/expert_workflow.py`에서 4단계 구현  
  - **1. 모델 생성**: 상황·선택적 자연어에 맞는 전략 모델(타입/스펙) 생성  
  - **2. 도구 검색**: 전략에 필요한 도구 목록 검색 (obs, get_price_buy, get_load, np, clip 등)  
  - **3. 코드 생성**: 선택 도구로 `actions` (n_agents×act_dim)를 계산하는 Python 코드 생성  
  - **4. 코드 수정**: 실행 실패 시 오류 메시지로 코드 수정 후 재실행 (1회)  
- 사용: `marl/config.py`에서 `use_4step_workflow = True` 로 설정 후 학습. 실패 시 휴리스틱 fallback.

### 3️⃣ 모방 전문가 MARL + Differential Multi-Head Attention Critic

- **Wasserstein 거리**: `marl/agent.py` — `wasserstein2_diag`, actor loss에 λ·(W2−ε) ✓
- **Lagrange**: 에이전트별 λ_i 학습 (`agent.py` log_lagrange, lambda_loss) ✓
- **Differential Multi-Head Attention Critic**: `marl/networks.py` — `DifferentialAttentionBlock`(attn1−ξ·attn2), `CentralizedCritic`에서 사용 ✓

### 요약

| 구분 | 상태 |
|------|------|
| 목표(실시간 P2P, 협력, 사회적 후생) | 충족 |
| 1️⃣ LLM-MARL 통합 | 충족 |
| 2️⃣ 4단계 워크플로우(모델/도구/코드 생성·수정) | 충족 (`expert_workflow.py`, `use_4step_workflow`) |
| 3️⃣ W2 모방 학습 + Differential Attention Critic | 충족 |

---

## 요구사항 충족 확인 및 학습 → 실사용 가이드

아래 요구사항은 현재 코드베이스에서 **모두 충족**됩니다. 이어서 **pkl로 학습**부터 **실생활 데이터로 추론**까지 순서대로 정리합니다.

### 요구사항별 충족 여부

| # | 요구사항 | 충족 | 코드/설정 |
|---|----------|:---:|-----------|
| 1 | paper_reproduction_dataset_from_screenshot_schema.pkl 파일로 학습 진행 후, LLM+MARL 통합 프레임워크로 실생활 데이터 추론 | ✓ | `train.py`(pkl 경로 탐색·로드), `marl/agent.py` `load_policy`, `policy_for_inference.pt` |
| 2 | 목표: 실시간 P2P 전력 시장, 프로슈머 협력, 사회적 후생(social welfare) 최대화 | ✓ | `marl/env.py` P2P 거래·가격 반영, `reward = -operational_cost` |
| 3 | LLM-MARL 통합: LLM 전문가 활용, MARL 학습 지도, 인간 전문가 대체 | ✓ | `marl/expert.py`, `marl/expert_strategy.py`, `marl/expert_workflow.py`, `marl/train.py`(expert_actions→replay→agent.update) |
| 4 | 프로슈머 맞춤 LLM 워크플로우: 모델 생성→도구 검색→코드 생성→코드 수정→실행 가능한 전략 | ✓ | `marl/expert_workflow.py`, `use_4step_workflow=True` |
| 5 | 모방 전문가 MARL: Wasserstein distance로 전문가 전략과 에이전트 정책 유사도 측정 | ✓ | `marl/agent.py` `wasserstein2_diag`, actor loss에 λ·(W2−ε) |
| 6 | Differential Multi-Head Attention Critic Network | ✓ | `marl/networks.py` `DifferentialAttentionBlock`, `CentralizedCritic` |

---

### 1단계: 학습용 pkl 준비

1. **pkl 파일 위치**  
   다음 중 한 곳에 `paper_reproduction_dataset_from_screenshot_schema.pkl`을 둡니다.  
   - `marl_260306/data/paper_reproduction_dataset_from_screenshot_schema.pkl`  
   - `marl_260306/paper_reproduction_dataset_from_screenshot_schema.pkl`  

2. **pkl이 없을 때**  
   프로젝트는 동일 스키마의 **합성 데이터**로 학습을 진행합니다.  
   (`train.py`에서 후보 경로 탐색 후 없으면 `get_dataset(pkl_path=None, ...)` 호출)

3. **pkl 직접 지정**  
   `marl/config.py`에서 `pkl_path = "절대경로/paper_reproduction_dataset_from_screenshot_schema.pkl"` 로 설정해도 됩니다.

---

### 2단계: 학습 실행 (LLM + MARL 통합)

1. **설정** (`marl/config.py`)  
   - Expert 방식(하나만 True 권장):  
     - `use_4step_workflow = True` → 4단계 워크플로우  
     - `use_expert_strategy_json = True` → JSON Expert  
     - `use_llm_expert = True` → 기존 LLM Expert  
   - LLM 사용 시: 프로젝트 루트 `.env`에 `AZURE_OPENAI_API_KEY` 또는 `OPENAI_API_KEY` 설정  

2. **실행**  
   프로젝트 루트에서:
   ```bash
   python train.py
   ```
   - pkl이 있으면 해당 pkl로, 없으면 합성 데이터로 학습합니다.  
   - 학습이 끝나면 `checkpoints/` 아래에 다음이 저장됩니다.  
     - `checkpoint_final.pt` (학습 재개용)  
     - `policy_for_inference.pt` (실사용·추론용)

3. **저장 경로 변경**  
   `marl/config.py`의 `checkpoint_dir`을 수정하면 저장 디렉터리를 바꿀 수 있습니다.

---

### 3단계: 실생활 데이터로 추론

학습으로 만든 **LLM+MARL 통합 모델**을 실생활(실시간 또는 배치) 데이터에 적용하는 방법입니다.

#### 3-1. 추론에 쓸 정책 로드

```python
from marl.agent import LLMGuidedCTDE
import numpy as np

# 학습 시 저장한 추론용 정책 로드 (실생활 배포 시 이 파일만 있으면 됨)
agent = LLMGuidedCTDE.load_policy("checkpoints/policy_for_inference.pt")
n_agents = agent.cfg.n_agents   # 학습 시와 동일한 에이전트 수
obs_dim = agent.cfg.obs_dim     # 10
act_dim = agent.cfg.act_dim     # 5
```

#### 3-2. 실생활 관측(obs) 형식

실제 계측/예측 데이터를 아래 **10차원 obs** 형식으로 맞춥니다.  
(학습 시 `marl/env.py`의 `_build_obs`와 동일한 스케일 권장)

- `obs[i]`: i번째 프로슈머의 길이 10 벡터  
  - `[0]` time_norm: 0~1 (예: 현재 시각/96 또는 t/max_steps)  
  - `[1]` buy_price_norm: 구매가/300 등 (0~2 권장)  
  - `[2]` sell_price_norm: 판매가/300 등  
  - `[3]` P_RDG_max_norm: 재생에너지(태양광·풍력 등) 최대/200 등  
  - `[4]` P_load_norm: 부하/200 등  
  - `[5]` Q_load_norm: 무효부하/200 등 (예: 0.3*P_load)  
  - `[6]` prev_CDG_norm: 이전 CDG 출력 비율 0~1  
  - `[7]` prev_SOC: ESS SOC 0~1  
  - `[8]` prev_P2P_norm: 이전 P2P 관련 값 정규화 (예: -1~1)  
  - `[9]` prev_V_norm: 이전 전압 관련 (예: (V-0.9)/0.2)  

실제 데이터가 kW·가격 등이면 위와 동일한 방식으로 나눈 뒤 `np.clip(..., 0, 2)` 또는 해당 범위로 정규화하면 됩니다.

#### 3-3. 한 번에 한 스텝 추론 (실시간/배치 공통)

```python
# 실생활에서 한 시점의 obs: (n_agents, 10), float32
obs = np.array([...], dtype=np.float32)   # shape (n_agents, 10)

# 결정적 행동(실운영 권장)
actions = agent.select_actions(obs, deterministic=True)
# actions shape: (n_agents, 5) — [P_CDG, P_RDG, Q_RDG, P_BESS, P_CL] in [-1, 1]
```

#### 3-4. 실생활 시계열로 반복 추론 예시

```python
# 예: 96스텝(하루 15분 단위) 실데이터가 있을 때
for t in range(96):
    obs_t = build_obs_from_real_data(t, real_prices, real_loads, real_pv, ...)  # (n_agents, 10)
    actions_t = agent.select_actions(obs_t, deterministic=True)
    # actions_t를 실제 설비 제어/시뮬레이션에 사용
```

`build_obs_from_real_data`는 실측·예측 데이터를 위 10차원 obs 형식으로 변환하는 함수로, 사용처 데이터 스키마에 맞게 구현하면 됩니다.

#### 3-5. CTDE: 10개 에이전트 중 하나만 실생활 데이터로 실행

**Centralized Training, Decentralized Execution** 에서는 실행 시 각 에이전트가 **자기 관측만**으로 행동합니다. 10명 중 한 에이전트(한 프로슈머)에만 실생활 데이터가 있을 때, **그 에이전트의 obs만** 넣어 해당 에이전트의 행동만 얻을 수 있습니다.

**절차**

1. **학습**: `N_AGENTS=10 python train.py` → `checkpoints/policy_for_inference.pt`
2. **로드**: `agent = LLMGuidedCTDE.load_policy("checkpoints/policy_for_inference.pt")`
3. **한 에이전트만 실행**: 해당 에이전트의 실생활 obs (길이 10)로 `select_action_single(obs_i, agent_id)` 호출 → shape (5,) 행동

**예시 코드**

```python
from marl.agent import LLMGuidedCTDE
import numpy as np

agent = LLMGuidedCTDE.load_policy("checkpoints/policy_for_inference.pt")
# 실생활 데이터로 한 에이전트(0번)의 obs 구성 — shape (10,) 또는 (1, 10)
obs_i = np.array([time_norm, buy_price_norm, sell_price_norm, P_RDG_max_norm,
                  P_load_norm, Q_load_norm, prev_CDG, prev_SOC, prev_P2P, prev_V], dtype=np.float32)
agent_id = 0   # 0 ~ 9 (학습 시와 동일한 순서)
action_i = agent.select_action_single(obs_i, agent_id=agent_id, deterministic=True)
# action_i shape: (5,) — [P_CDG, P_RDG, Q_RDG, P_BESS, P_CL] in [-1, 1]
```

**시계열**: 한 에이전트만 반복할 때는 매 시점 `obs_t_i` (10,)로 `select_action_single(obs_t_i, agent_id=0)` 호출.

**정리**: 전체 10명은 `select_actions(obs (10,10))` → (10,5). 10명 중 한 명만 실행할 때는 해당 에이전트 obs (10,)만으로 `select_action_single(obs_i, agent_id=i)` → (5,) (CTDE 분산 실행).

#### 3-6. 추론된 actions 사용 방법

추론 결과 `actions`는 **에이전트별 5차원 벡터**이며, 각 원소는 **[-1, 1]** 구간의 정규화 값입니다. 실설비 제어·P2P 시뮬레이션에 쓰려면 **실제 물리량(kW·kVAr)으로 변환**한 뒤 사용합니다.

**1. actions 각 차원의 의미**

| 인덱스 | 이름 | 의미 | 정규화 범위 |
|--------|------|------|-------------|
| 0 | P_CDG | 분산형 발전(CDG) 출력 지령 비율 | [-1, 1] → 0~100% 용량 |
| 1 | P_RDG | 재생에너지(PV·풍력) 이용 비율 | [-1, 1] → 0~100% 가용량 |
| 2 | Q_RDG | 재생에너지 무효전력(Q) 지령 | [-1, 1] → -20 ~ +20 kVAr |
| 3 | P_BESS | ESS 충·방전 (양수=방전, 음수=충전) | [-1, 1] → -100% ~ +100% 용량 [kW] |
| 4 | P_CL | 제어가능 부하(CL) 절감 비율 | [-1, 1] → 0~100% 가용 부하 컷 |

**2. [-1, 1] → 실제 setpoint 변환**

`marl/env.py`의 `step()`과 동일한 스케일 사용. 프로슈머 `i`의 용량·가용량을 알 때:

```python
# action_i: (5,) in [-1, 1]
a0, a1, a2, a3, a4 = action_i
p_cdg_kw = (0.5 + 0.5 * a0) * cdg_kw_cap
p_rdg_kw = (0.5 + 0.5 * a1) * (pv_kw_available + wt_kw_available)
q_rdg_kvar = np.clip(a2, -1.0, 1.0) * 20.0
p_bess_kw = a3 * bess_kw_cap
p_cl_cut_kw = (0.5 + 0.5 * a4) * cl_kw_available
```

**3. 사용처**: 위 값들을 CDG·인버터·BESS·부하 제어 setpoint로 사용. `p_net = p_cdg + p_rdg + p_bess - (p_load - p_cl_cut)` 로 P2P·계통 연계·시뮬레이션에 사용. 용량·가용량은 실측·프로필과 연동 권장.

---

### 요약: 학습 → 실사용 흐름

1. **데이터**: `data/paper_reproduction_dataset_from_screenshot_schema.pkl` 준비(또는 합성 데이터 사용).  
2. **학습**: `python train.py` → `checkpoints/policy_for_inference.pt` 생성.  
3. **추론**: `LLMGuidedCTDE.load_policy("checkpoints/policy_for_inference.pt")` 로드 후, 실생활 obs (n_agents, 10)에 대해 `agent.select_actions(obs, deterministic=True)` 로 행동 추론.  
4. **실사용**: 추론된 actions를 실제 P2P/설비 제어·시뮬레이션 파이프라인에 연결하면, 실시간 P2P 전력 시장에서 프로슈머 협력을 통한 사회적 후생 극대화 목표에 맞게 사용할 수 있습니다.
