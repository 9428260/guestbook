# 전체 시스템 검증: LLM·CTDE·재학습·모델 교체

요청 사항:
- **전체 시스템**이 **LLM**으로 전력 사용량 예측, 가격 결정, Prosumer를 통한 거래 등을 **CTDE 방식**으로 실행 계획 수립 후 실행하고,
- **LLM 판단**으로 전력 예측·가격·Prosumer에 **재학습이 필요할 때** 재학습 실행 + **모방실행**으로 **모델을 교체**하도록 작성되어 있는지 확인.

---

## 1. 현재 구현된 것

### 1.1 LLM이 관여하는 실행 경로

| 구분 | 스크립트/모듈 | 전력 예측 | 가격 결정 | Prosumer/거래 | CTDE |
|------|----------------|-----------|-----------|----------------|------|
| 실시간 시스템 | `run_realtime_system.py` + `realtime/orchestrator.py` | ForecastAgent 또는 DecentralForecastAgent(CTDE) | PriceAgent(P2PPricingEngine) | timeseries → ParticipantForecast | use_ctde 시 로컬 예측기로 ParticipantForecast 생성 |
| 실시간 데모 | `run_realtime_demo_10agents.py`, `realtime/llm_realtime.py` | **LLM** 전력예측 제안 | **LLM** 가격 제안 | **LLM** 거래계획 제안, 시장 실행은 P2P 엔진 | ParticipantForecast는 **관측 기반** 생성(CTDE 정책 미사용) |
| CTDE 실행 | `run_realtime_ctde.py` | 없음(env 데이터) | env 내부 | **학습된 CTDE 정책**이 행동 선택 | ✅ 정책만 사용, LLM 미사용 |

- **실시간 시스템**: 전력 예측은 규칙/통계(또는 CTDE 로컬 예측기), 가격은 수식. **실행 계획 수립이 LLM에 의해 이루어지지 않음**.
- **실시간 데모**: LLM이 전력/가격/거래계획을 **제안**하지만, 실제 **실행** 시 ParticipantForecast는 timeseries 관측에서 만들어지며, **CTDE 정책 네트워크를 사용하지 않음**.
- **CTDE 실행**: 학습된 정책만 사용하며, 전력 예측·가격·Prosumer가 **한 파이프라인에서 LLM으로 계획 수립**되는 구조가 아님.

### 1.2 재학습·모방학습

| 구분 | 구현 위치 | 설명 |
|------|-----------|------|
| 모방학습 | `marl/train.py`, `marl/agent.py` | Expert(LLM/Heuristic) 정답 행동 → replay → W2 제약 imitation으로 CTDE 정책 학습 |
| 재학습 케이스 | `run_retrain_llm_expert_full.py` | 전력 예측·가격·Prosumer 맥락을 LLM(ExpertStrategy)에 넣어 재학습 **수동 실행** |
| 학습 후 저장 | `marl/train.py` | `checkpoint_final.pt`, `policy_for_inference.pt` 저장 |

- 재학습은 **사용자가** `run_retrain_llm_expert_full.py` 또는 `run_train_llm_expert.py` 등을 **직접 실행**해야 함.
- **"LLM이 재학습이 필요하다고 판단하여 재학습을 트리거"**하는 로직은 **없음**.

### 1.3 모델 교체

| 구분 | 구현 | 설명 |
|------|------|------|
| 학습 종료 시 | `train.py` | `policy_for_inference.pt` 저장 |
| 실행 시 로드 | `run_realtime_ctde.py` | 시작 시 `--policy`로 지정한 파일 한 번 로드 |
| **실행 중 자동 교체** | **미구현** | 재학습으로 새 정책이 저장되어도, **동작 중인 프로세스가 새 모델을 감지해 재로드하는 흐름 없음** |

---

## 2. 미구현·불일치 사항

요청하신 “전체 시스템이 아래처럼 작성되어 있는지”에 대해:

1. **"LLM이 전력 예측·가격·Prosumer를 CTDE 방식으로 실행 계획 수립 후 실행"**  
   - **부분만 구현**:  
     - 데모에서 LLM이 전력/가격/거래계획을 **제안**하지만, 실제 실행은 관측 기반 ParticipantForecast + P2P 엔진이며, **CTDE 정책**을 사용하지 않음.  
     - `run_realtime_system.py`의 CTDE 모드는 **로컬 예측기**로 ParticipantForecast를 만들 뿐, **LLM이 계획을 수립**하지 않음.

2. **"LLM 판단으로 재학습이 필요한 경우 재학습 실행"**  
   - **미구현**:  
   - LLM(또는 다른 모듈)이 **“지금 재학습이 필요하다”**고 판단하고 재학습을 **자동 트리거**하는 코드가 없음.  
   - 재학습은 전부 **사용자/스크립트 수동 실행**에 의존.

3. **"재학습 + 모방실행으로 모델 교체"**  
   - **일부만 구현**:  
   - 재학습 후 **모방학습**으로 새 정책을 만들고 `policy_for_inference.pt`로 저장하는 것은 **구현됨**.  
   - 다만 **실행 중인 시스템**이 이 새 파일을 감지해 **자동으로 로드·교체**하는 부분은 **없음**.  
   - 새 모델을 쓰려면 `run_realtime_ctde.py` 등을 **재시작**하고 `--policy`로 새 파일을 지정해야 함.

---

## 3. 요약

| 항목 | 상태 | 비고 |
|------|------|------|
| LLM이 전력 예측·가격·Prosumer 관여 | ⚠ 부분 | 데모에서 LLM 제안만, 실행은 관측+P2P 엔진 |
| CTDE 방식 실행 계획 수립·실행 | ⚠ 부분 | CTDE 로컬 예측으로 ParticipantForecast 생성은 있으나, LLM이 “계획 수립”하는 통합 경로는 없음 |
| LLM 판단에 의한 재학습 트리거 | ❌ 미구현 | 수동 실행만 존재 |
| 재학습 + 모방학습으로 정책 갱신 | ✅ 구현 | `run_retrain_llm_expert_full.py` 등 |
| 실행 중 모델 자동 교체 | ❌ 미구현 | 재시작 후 `--policy`로 새 파일 지정 필요 |

**결론**:  
**아니요.** 현재 코드베이스는 “LLM이 전력 예측·가격·Prosumer를 CTDE로 실행 계획 수립 후 실행”하고, “LLM 판단으로 재학습 필요 시 재학습 실행 + 모방실행으로 모델 교체”까지 **한 흐름으로** 작성되어 있지 않습니다.  
재학습·모방학습·정책 저장은 구현되어 있으나, **LLM에 의한 재학습 트리거**와 **실행 중 정책 자동 교체**는 없습니다.

---

## 4. 보완 시 제안 사항

요청하신 동작에 맞추려면 다음을 추가하는 것이 필요합니다.

1. **재학습 필요 여부 판단 (LLM 또는 규칙)**  
   - 주기적/이벤트 기반으로 지표(오차, 보상, 위반률 등)를 LLM 또는 규칙에 넘기고,  
     “재학습 필요” 플래그를 반환하는 모듈.

2. **재학습 트리거**  
   - 위 플래그가 True일 때 `run_retrain_llm_expert_full.py`에 해당하는 로직(또는 `train(cfg, dataset)`)을 **자동 호출** (별도 프로세스/스케줄러 또는 같은 프로세스 내 백그라운드).

3. **실행 중 모델 교체**  
   - 재학습이 끝나면 새 `policy_for_inference.pt`가 쓰여졌을 때,  
     실행 중인 실시간/CTDE 루프가 **해당 파일을 주기적으로 확인**하거나 **시그널/이벤트**를 받아  
     `LLMGuidedCTDE.load_policy(...)`로 다시 로드하고, 이후 스텝부터 새 정책을 사용하도록 하는 **핫 스왑** 로직.

원하시면 위 1~3에 대한 구체적인 API 설계나 스크립트 초안도 작성해 드리겠습니다.

---

## 5. 구현 완료 (2025): LLM 판단 → 재학습 트리거 → 모델 자동 교체

- **marl/retrain_trigger.py**: `llm_should_retrain(metrics)` 로 LLM(또는 규칙) 재학습 필요 여부 판단.
- **run_realtime_ctde_with_retrain.py**: CTDE 실행 + 주기적 재학습 판단 + 재학습 서브프로세스 실행 + 정책 파일 갱신 시 재로드(핫 스왑).
- 실행: `python run_realtime_ctde_with_retrain.py` (옵션: `--retrain-check-every 96 --retrain-episodes 30`, `--no-llm-trigger`). 로그: `run_realtime_ctde_with_retrain.log`
