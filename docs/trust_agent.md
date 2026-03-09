# Trust Agent — 신뢰 보장 계층

거래·제어·정산·데이터·Agent 행동 전반에서 이상 징후와 부정 가능성을 감시하는 계층입니다.

## 5가지 역할

### 1) 이상 거래 탐지
- **비정상 가격**: 시장가 대비 과도한 고가/저가
- **편향 거래**: 특정 (seller, buyer) 쌍이 반복·집중
- **거래량 급증**: 평균 대비 N배 이상 거래량
- **결과**: 거래별 위험 점수, `trades_to_hold`(보류), `trades_to_review`(운영자 검토)

### 2) 데이터 신뢰성 검증
- 계량 데이터 누락 비율
- PV/부하 비율 이상 (흐린 날 태양광 과대 보고 의심)
- ESS SOC vs 방전량 불일치
- 결과: `data_issues` 리스트 (issue_type, description, severity)

### 3) Agent 행동 감시
- **Pricing Agent**: 가격이 하한 부근에만 있는 비율이 높으면 과도한 저가 의심
- **Prosumer**: 전체 잉여가 부족 대비 과대면 잉여 과장 의심
- **ESS Agent**: 방전 한계 근처 반복 사용 시 단기 절감·열화 무시 의심
- 결과: `agent_alerts` 리스트

### 4) 정산·분배 공정성 검증
- 세대별 수혜(판매 수익 − 구매 비용) 지니계수
- 편중 참여자 목록
- 결과: `fairness` (benefit_gini, skewed_participants, summary)

### 5) 사고 대응·감사 연결
- 이상 탐지 시 **Incident** 생성 (증거, trade_ids, playbook_triggered)
- **감사 로그** 기록 (event_type, source, message, payload)
- 선택적으로 SQLite DB에 저장 (`TrustConfig.audit_db_path`)

## 설정 (TrustConfig)

| 항목 | 설명 | 기본값 |
|------|------|--------|
| price_deviation_ratio_high | 시장가 대비 고가 편차 상한 | 0.35 |
| price_deviation_ratio_low | 시장가 대비 저가 편차 (할인) 상한 | 0.40 |
| pair_concentration_min_count | 동일 쌍 거래 편향 판정 최소 횟수 | 3 |
| pair_concentration_ratio | 편향 쌍 비율 임계 | 0.70 |
| volume_spike_ratio | 평균 대비 거래량 급증 배수 | 5.0 |
| risk_score_hold_threshold | 이 점수 이상이면 거래 보류 | 0.75 |
| risk_score_review_threshold | 이 점수 이상이면 검토 요청 | 0.50 |
| benefit_gini_threshold | 지니계수 이 값 초과 시 편중 의심 | 0.45 |
| audit_db_path | 감사/사고 DB 경로 (None이면 메모리만) | None |

## 사용

### A2A 파이프라인 내 자동 실행
Master Agent 1사이클 실행 시 `broker_prosumer_trades` 다음에 `run_trust_checks`가 자동 실행됩니다.

```bash
python demos/run_master_agent_demo.py --steps 16
```

결과 `result["trust_report"]`에 `TrustReport`가 포함됩니다.

### Python에서 직접 사용
```python
from realtime import TrustAgent, TrustConfig

trust = TrustAgent(config=TrustConfig())
report = trust.run_all_checks(context)  # MasterAgentContext 또는 유사 객체

print(report.overall_risk_level)   # "low" | "medium" | "high"
print(report.trades_to_hold)       # 보류할 거래 ID 목록
print(report.trades_to_review)     # 검토 요청 거래 ID 목록
print(report.data_issues)          # 데이터 신뢰성 이슈
print(report.agent_alerts)         # Agent 행동 알림
print(report.fairness)             # 정산 공정성 (지니계수 등)
print(report.incidents)            # 이번 점검에서 생성된 사고(티켓)
print(report.audit_log)            # 감사 로그

# 사고 목록 조회
incidents = trust.get_incidents(status="open", limit=20)
# 감사 로그 조회
log = trust.get_audit_log(limit=100)
```

### API
- `GET /api/result` — 응답에 `trust_report` 포함 (마지막 run-cycle 기준)
- `GET /api/trust/report` — 마지막 Trust 점검 결과만 반환
- `GET /api/trust/incidents` — 마지막 Trust 보고서 내 사고(티켓) 목록

## 플레이북 연동
Incident 생성 시 `playbook_triggered`로 다음 값을 넣을 수 있습니다.
- `hold_trades_notify_ops` — 이상 거래 보류 + 운영자 알림
- `data_verification` — 데이터 검증 플로우
- `fairness_review` — 정산 공정성 검토

실제 알림/티켓 시스템과 연동하려면 `TrustConfig.audit_db_path`에 DB를 지정하고, 운영 쪽에서 해당 테이블을 구독하거나 주기적으로 조회하면 됩니다.
