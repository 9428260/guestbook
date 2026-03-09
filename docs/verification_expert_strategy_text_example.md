# LM 출력 예시 형식 반영 여부 검증

## 예시 형식 (사용자 요구)

**LM 출력 예:**
```
Expert Strategy:
Sell 2 kW to P2P market
Battery charging = 0
Grid export = 0
```
또는
```
Sell 1.5 kW P2P
Charge battery 0.5 kW
```
**이 전략이 바로 expert action.**

---

## 현재 구현 상태: **부분 반영**

### 반영되지 않은 부분
- **자연어 "Expert Strategy" 문장** 형태의 LLM 출력을 요청하거나 파싱하는 코드가 **없음**.
- "Sell 2 kW to P2P market", "Battery charging = 0", "Charge battery 0.5 kW" 같은 **kW 단위 문장을 파싱해 expert action으로 변환**하는 로직 **없음**.
- 현재는 **JSON `{"actions": [[...], ...]}` 만** 요청·파싱하며, 이 배열이 그대로 expert action으로 사용됨.

### 반영된 부분
- LLM이 내놓은 **actions 배열**이 **그대로 expert_actions**로 사용됨 (`replay.add(..., expert_actions=expert_actions)`, `agent.update(batch)`).
- 즉, **“전략의 결과물인 action 벡터”가 전문가 행동 데이터**로 쓰이는 구조는 구현되어 있음. 다만 그 전략이 **자연어 문장으로 출력되는 형식**은 없음.

---

## 결론 및 반영 사항

| 항목 | 상태 |
|------|------|
| "Expert Strategy: Sell 2 kW P2P, Battery 0, Grid 0" 형식의 LM 출력 | ✅ **반영됨** (선택 출력) |
| 해당 문장을 로깅하여 해석 가능 | ✅ **반영됨** (`expert_strategy` 필드 파싱, `_last_expert_strategy`, run_retrain_1episode_logged.py에서 로그 출력) |
| **이 전략이 바로 expert action** | ✅ **반영됨**: 동일 응답의 **`actions`** 배열이 그대로 `expert_actions`로 사용됨. 자연어 "Expert Strategy"는 그 전략의 요약이며, 기계 실행은 `actions`로 함. |

### 구현 내용 (marl/expert_strategy.py)
- 프롬프트: LM에게 **선택적으로** `expert_strategy` 문자열 출력 요청 (예: "Sell 2 kW to P2P market. Battery charging = 0. Grid export = 0.").
- 응답 형식: `{"expert_strategy": "...", "actions": [[...], ...]}`. `actions` 가 필수, `expert_strategy` 는 선택.
- 파싱: `_parse_llm_actions_json` 이 `(actions 배열, expert_strategy 문자열)` 반환. **actions 가 expert action**으로 사용됨.
- 로깅: `ExpertStrategy._last_expert_strategy` 에 마지막 자연어 전략 저장. `run_retrain_1episode_logged.py` 에서 step 0 LLM 호출 후 `[Expert Strategy (LM 출력)] ...` 로 로그 출력.
