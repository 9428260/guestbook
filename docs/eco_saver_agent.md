# Eco Saver Agent

한 줄 정의: **세대/사용자 단위의 소비 데이터를 바탕으로 전기요금 절감, 피크 완화, 사용자 편익 유지를 동시에 달성하는 개인화 절약 추천·제어 Agent**

## 담당 범위

- 세대 소비 패턴 분석
- 절약 기회 탐지
- 피크 시간대 소비 분산
- 가전/EV/HVAC 제어 제안
- DR 참여 추천
- 개인화 절약 시나리오 생성
- 사용자 동의 기반 자동화 실행
- 절약 효과 검증 및 피드백

## 4가지 핵심 목표 (동시 달성)

| 목표 | 내용 |
|------|------|
| **2.1 요금 절감** | 고가 시간대 소비 감소, 사용 시간 이동, 누진 구간 진입 완화 |
| **2.2 피크 완화** | 단지 피크 시간에 세대별 수요 분산, EV/세탁기/건조기/HVAC 등 유연부하 이동 |
| **2.3 사용자 편의 유지** | 지나치게 공격적인 제어 회피, 불편 허용 범위 내 실행, 동의 기반 제어 |
| **2.4 참여 지속성 확보** | 절약 성과를 이해하기 쉽게 표시, 추천이 부담스럽지 않게 설계, 보상·포인트·랭킹·피드백 연계 |

## 사용

### 파이프라인 한 번에 실행

```python
from eco_saver import (
    EcoSaverAgent,
    EcoSaverAgentConfig,
    ConsentState,
    run_eco_saver_pipeline,
)
import numpy as np

agent = EcoSaverAgent(EcoSaverAgentConfig())
usage = np.random.rand(96) * 2.0 + 0.5   # 15분×96 = 24h
price = np.random.rand(96) * 100 + 80

consent = ConsentState(hvac=True, laundry=True, max_inconvenience=0.35)
pattern, scenario, actions = run_eco_saver_pipeline(
    agent, usage, price, consent_state=consent, household_id="A101"
)
print(scenario.summary_message)
print("실행 액션 수:", sum(1 for a in actions if a.consented))
```

### 단계별 실행

```python
# 1) 패턴 분석
pattern = agent.analyze_consumption_pattern(usage, price, "A101")

# 2) 절약 기회 탐지
opportunities = agent.detect_opportunities(pattern, price_schedule=None, peak_hours=None)

# 3) 제어 제안
suggestions = agent.suggest_controls(opportunities, pattern, user_prefs={})

# 4) DR 추천
dr_events = [{"event_id": "dr1", "start": "18:00", "end": "20:00", "target_reduction_kw": 2.0, "incentive_krw": 500}]
dr_recs = agent.recommend_dr(opportunities, dr_events)

# 5) 개인화 시나리오 생성
scenario = agent.generate_scenario(opportunities, consent, user_prefs=None, dr_events=dr_events, pattern=pattern)

# 6) 동의 기반 실행
actions = agent.execute_with_consent(scenario, consent)

# 7) 효과 검증
feedback = agent.verify_effect(usage_before, usage_after, scenario)
print(feedback.user_friendly_message)
```

### 동의 상태 (ConsentState)

- `hvac`, `ev`, `laundry`, `water_heater`, `dr_participation`: 카테고리별 동의
- `auto_execute`: 자동 실행 허용
- `max_inconvenience`: 허용 불편도 상한 [0, 1]

## 설정 (EcoSaverAgentConfig)

- 목표 가중치: `w_cost_reduction`, `w_peak_mitigation`, `w_user_convenience`, `w_participation_sustainability`
- 요금: `high_price_ratio_threshold`, `cheap_price_ratio_threshold`, `progressive_tier_margin_ratio`
- 피크: `peak_hour_start`, `peak_hour_end`, `flexible_load_types`, `max_shift_hours`
- 편의: `max_inconvenience_score`, `min_comfort_hours`, `consent_required_for_auto`
- 참여: `max_suggestions_per_day`, `feedback_metric_primary`, `enable_ranking`, `enable_points`

## 파일

- `eco_saver/eco_saver_agent.py`: EcoSaverAgent, Config, 데이터 구조, 파이프라인
- `eco_saver/__init__.py`: 패키지 export
