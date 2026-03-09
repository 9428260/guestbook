# 전력사용량 예측 Agent — CTDE / LLM enhanced MARL 적용 여부

## 요약

| 구분 | CTDE 패러다임 | LLM enhanced | MARL |
|------|----------------|-------------|------|
| **전력예측(CTDE 예측)** (realtime) | ✅ 적용 | ✅ 적용 (전문가 모방) | ✅ 적용 |
| **CommunityEnergyForecastAgent** (forecast.py) | ❌ 미적용 | ✅ 보정용만 | ❌ 미적용 |
| **llm_power_forecast** (llm_realtime.py) | ❌ 미적용 | ✅ 예측 직접 출력 | ❌ 미적용 |
| **MARL 학습 루프의 “예측”** | — | 컨텍스트만 제공 | 예측 에이전트 없음 |

---

## 1. 전력예측(CTDE 예측) — 실시간 파이프라인

**위치:** `realtime/llm_master_agent.py` (`ForecastSubAgent`), `realtime/agents.py`, `forecast/ctde_forecast.py`

### CTDE 패러다임: ✅ 적용

- **Centralized Training**
  - `LocalProsumerForecaster.fit_central(timeseries, bus_col)`에서 전역 시계열로 학습.
  - 현재 구현은 `pass`라서 별도 파라미터 학습은 없고, “전역 데이터로 한 번 설정”하는 구조만 갖춤.
- **Decentralized Execution**
  - `predict_local(bus_id, local_slice)`: **해당 버스의 로컬 시계열만** 사용해 (load_kw_pred, pv_kw_pred) 반환.
  - `ctde_participant_forecasts_from_timeslice()`에서 프로슈머별로 로컬 데이터만 넣어 예측 후, 결과를 모아 가격결정 등 중앙 단계에 넘김.

```1:16:forecast/ctde_forecast.py
# forecast/ctde_forecast.py — CTDE: Centralized Training / Decentralized Execution 전력 예측
...
class LocalProsumerForecaster:
    """
    CTDE — Decentralized Execution: 각 프로슈머가 자기 로컬 시계열만으로 예측.
    - Centralized Training: fit_central()에서 전역 데이터로 각 로컬 모델 학습 가능.
    - Decentralized Execution: predict_local()은 해당 버스의 local_slice만 사용.
    """
```

### LLM enhanced: ❌ 미적용

- 이 경로에는 LLM 호출이 없음.  
- 예측은 `LocalProsumerForecaster`의 롤링 윈도우 평균(통계)만 사용.

### MARL: ❌ 미적용

- 강화학습·보상·정책 학습 없음.  
- 다중 에이전트가 “행동”을 학습하는 구조가 아님.

---

## 2. CommunityEnergyForecastAgent (forecast/forecast.py)

**역할:** 공동체 단위 부하·PV 예측 (RandomForest + 반복 예측).

### CTDE: ❌ 미적용

- **단일 공동체 모델** 하나만 사용 (프로슈머별 분산 실행 없음).  
- `CommunityEnergyForecastAgent`는 community_load_kw, pv_gen_kw 등 **집계 시계열**을 예측.

### LLM enhanced: ✅ 보정용만

- **LLMPredictorAdjuster**: 기본 예측(load, pv)에 대해 LLM이 `adjustment_factor_load`, `adjustment_factor_pv`를 제안.
- `llm_enabled=True`이고 API 설정이 있으면 LLM 호출, 실패 시 규칙 기반 fallback으로 보정.
- “예측 자체”는 ML 모델이 하고, LLM은 **보정 계수**만 제공 → “LLM enhanced”이지만 “LLM이 예측을 직접 내는 에이전트”는 아님.

### MARL: ❌ 미적용

- 단일 에이전트(공동체 1개) 지도학습 예측. 강화학습/다중 에이전트 정책 없음.

---

## 3. llm_power_forecast (realtime/llm_realtime.py)

**역할:** 현재 구간 요약을 LLM에 주고, 다음 구간 전력 사용량/발전 예측을 JSON으로 받음.

### CTDE: ❌ 미적용

- 전체 합산 요약만 LLM에 전달. 프로슈머별 로컬만 쓰는 분산 실행 구조가 아님.

### LLM enhanced: ✅ 적용 (예측 직접 출력)

- LLM이 `load_kw_total_forecast`, `pv_kw_total_forecast`를 직접 출력.  
- 이 경로는 “전력사용량 예측을 LLM이 하는” 형태이나, **실시간 파이프라인 UI의 “전력예측(CTDE 예측)”과는 별도**이며, CTDE나 MARL과 결합되어 있지 않음.

### MARL: ❌ 미적용

- 단일 LLM 호출 한 번으로 예측만 받는 구조. 강화학습/다중 에이전트 없음.

---

## 4. MARL 학습 루프(marl/)에서의 “전력 예측”

- **marl** 쪽에서는 “전력 사용량 예측을 하는 에이전트”를 학습하지 않음.
- `env.get_forecast_context()`는 **데이터셋에서 가져온 현재/다음 스텝 요약**을 넘길 뿐, 학습 가능한 예측기나 CTDE 예측 에이전트가 아님.
- 이 컨텍스트는 **Expert(LLM/휴리스틱)가 행동을 만들 때 참고**하는 용도로만 사용됨.  
- 따라서 **전력사용량 예측 Agent에 대한 MARL 또는 LLM enhanced MARL은 적용되어 있지 않음.**

---

## 5. 결론 표

| 전력사용량 예측 관련 구현 | CTDE | LLM enhanced | MARL |
|---------------------------|------|---------------|------|
| 전력예측(CTDE 예측) — DecentralForecastAgent / LocalProsumerForecaster | ✅ | ❌ | ❌ |
| CommunityEnergyForecastAgent (forecast.py) | ❌ | ✅ (보정만) | ❌ |
| llm_power_forecast (llm_realtime.py) | ❌ | ✅ (직접 예측) | ❌ |
| marl 학습 루프 내 예측 역할 | — | 컨텍스트만 | 예측 에이전트 없음 |

- **CTDE가 적용된 전력사용량 예측 에이전트**는 **“전력예측(CTDE 예측)”** 하나뿐이며, 여기에는 **LLM enhanced**나 **MARL**이 없음.
- **LLM이 관여하는 전력 예측**은 (1) forecast.py의 **보정용**과 (2) llm_realtime의 **직접 예측** 두 가지인데, 둘 다 **MARL/CTDE와 결합된 “LLM enhanced MARL” 전력 예측 에이전트는 아님.**
---

## 6. CTDE + LLM-enhanced MARL 전력사용량 예측 (추가 구현)

전력사용량 예측 에이전트를 **CTDE 패러다임**과 **LLM-enhanced MARL** 형태로 확장한 구현이 추가되었습니다.

| 구성 요소 | 위치 | 설명 |
|-----------|------|------|
| **LLMEnhancedForecastCTDE** | forecast/forecast_marl.py | Centralized Training / Decentralized Execution, 전문가 모방 W2 제약 |
| **ForecastActor** | forecast/forecast_marl.py | 로컬 관측 → (load_pred_norm, pv_pred_norm) |
| **LLMExpertForecastProvider** | forecast/ctde_forecast.py | LLM 또는 휴리스틱 전문가 예측 |
| **LLMMARLForecastWrapper** | forecast/ctde_forecast.py | MARL 정책 또는 롤링 평균 |
| **DecentralForecastAgent** | realtime/agents.py | policy_path 로 CTDE+MARL 예측 사용 |

**학습:** 전력 예측 MARL 학습: n_agents=20, max_episodes=200, device=cpu
ep 20 reward=-19.8053
ep 40 reward=-13.2195
ep 60 reward=-9.3610
ep 80 reward=-8.0382
ep 100 reward=-7.5146
ep 120 reward=-7.3921
ep 140 reward=-7.3083
ep 160 reward=-7.2742
ep 180 reward=-7.3121
정책 저장: checkpoints/forecast_marl_policy.pt → checkpoints/forecast_marl_policy.pt  
**실시간:** DecentralForecastAgent(policy_path="checkpoints/forecast_marl_policy.pt")
