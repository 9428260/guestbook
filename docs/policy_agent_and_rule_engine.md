# Policy Agent & Policy Rule Engine

정책 에이전트와 정책 규칙 엔진 사용 방법입니다.

## Policy Agent (LLM 기반)

- **법/요금/규정 문서 해석**: 문서 텍스트 → 요약, 핵심 조항, 의무 사항
- **정책 변경 영향 분석**: 정책 초안 + 현재 지표 → 영향 요약, 리스크, 권고
- **새로운 룰 초안 생성**: 정책 목표/제약 → 규칙 초안(자연어 + 선택적 JSON)
- **운영자 질의응답**: 질문 + 참조 문서 → 답변
- **"왜 이런 정책이 필요한가" 설명**: 정책 ID/텍스트 → 설명문

### Python 사용 예

```python
from realtime import PolicyAgent

agent = PolicyAgent()

# 문서 해석
doc = agent.interpret_document("전력 시장 규정 문서 전문...")
print(doc.summary, doc.key_points, doc.obligations)

# 영향 분석
impact = agent.analyze_policy_impact("P2P 가격 상한 200원 적용", current_metrics={"last_p2p_price": 180})
print(impact.impact_summary, impact.risks, impact.recommendations)

# 룰 초안
draft = agent.draft_rule("피크 시간대 가격 상한 강화", context={"price_ceiling_kwh": 250})
print(draft.rule_text, draft.rule_json)

# 운영자 Q&A
answer = agent.operator_qa("계약종별 정산 방식 차이가 뭔가요?", context_docs=["문서..."])
print(answer)

# 정책 필요성 설명
explanation = agent.explain_why_policy("가격 상한 정책")
print(explanation)
```

### API (ui/api.py)

- `POST /api/policy/interpret` — body: `{"document_text": "..."}`
- `POST /api/policy/impact` — body: `{"policy_text": "...", "current_metrics": {...}}`
- `POST /api/policy/draft-rule` — body: `{"policy_goal": "...", "context": {...}}`
- `POST /api/policy/qa` — body: `{"question": "...", "context_docs": ["..."]}`
- `POST /api/policy/explain` — body: `{"policy_id_or_text": "..."}`
- `GET /api/policy/rule-config` — Policy Rule Engine 설정 조회

LLM은 `AZURE_OPENAI_*` 또는 `OPENAI_API_KEY` 환경 변수로 설정합니다.

---

## Policy Rule Engine (실시간 규칙)

- **실시간 승인/차단**: 거래·가격에 대한 허용/거부
- **가격 상한/하한 검사**: P2P 가격 범위 적용 및 조정
- **계약종별 판정**: 참여자 ID 접두사 → 계약 유형
- **정산 방식 선택**: 계약 유형 → 정산 방식
- **제어 권한 체크**: ESS 충방전, P2P 매매 등 권한 여부

### 설정 (PolicyRuleConfig)

| 항목 | 설명 | 기본값 |
|------|------|--------|
| price_ceiling_kwh | 가격 상한 (원/kWh) | 250 |
| price_floor_kwh | 가격 하한 (원/kWh) | 50 |
| max_trade_kwh_per_deal | 거래당 최대 거래량 (kWh) | 1000 |
| min_trade_kwh_per_deal | 거래당 최소 거래량 (kWh) | 0.001 |
| contract_type_by_prefix | participant_id 접두사 → 계약종별 | bus_→prosumer 등 |
| settlement_by_contract | 계약종별 → 정산 방식 | residential→monthly_billing 등 |
| control_permission | 액션별 허용 접두사 | ess_charge, p2p_sell 등 |
| blocked_participants | 차단 참여자 ID 목록 | [] |
| blocked_trade_pairs | 차단 거래쌍 (seller_id, buyer_id) | [] |

### Python 사용 예

```python
from realtime import PolicyRuleEngine, PolicyRuleConfig, load_policy_rule_config

# 기본 설정
engine = PolicyRuleEngine()

# 가격 검사 (상한/하한 적용 시 조정 가격 반환)
result = engine.check_price_bounds(300, apply_adjustment=True)
# result.approved True, result.adjusted_price 250

# 거래 승인/차단
check = engine.check_trade_approval("bus_1", "bus_2", 10.0, 130.0)
# check.approved, check.reason, check.contract_type_seller, check.settlement_method

# 계약종별·정산
contract = engine.get_contract_type("bus_1")       # "prosumer"
settlement = engine.get_settlement_method(contract)  # "real_time_settlement"

# 제어 권한
perm = engine.check_control_permission("bus_1", "ess_charge")
# perm.allowed, perm.reason
```

### JSON 설정 파일 (선택)

`RealtimeConfig.policy_rule_config_path`에 JSON 파일 경로를 지정하면 로드합니다.

```json
{
  "price_ceiling_kwh": 200,
  "price_floor_kwh": 60,
  "max_trade_kwh_per_deal": 500,
  "blocked_participants": ["blocked_bus_99"],
  "contract_type_by_prefix": {"bus_": "prosumer", "House_": "residential"},
  "settlement_by_contract": {"residential": "monthly_billing", "prosumer": "real_time_settlement"}
}
```

---

## Master Agent 연동

- **가격**: `run_price_market` 결과에 Policy Rule Engine의 가격 상한/하한이 자동 적용됩니다.
- **거래**: `broker_prosumer_trades` 시 각 체결 거래에 대해 실시간 승인/차단이 적용됩니다. 미승인 거래는 DB에 저장되지 않습니다.

정책 설정 파일을 쓰려면 `RealtimeConfig(policy_rule_config_path=Path("data/policy_rules.json"))` 처럼 지정한 뒤 `MasterAgent(config=cfg)`로 실행하면 됩니다.
