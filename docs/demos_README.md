# Demos — 실시간·데모 실행 스크립트

프로젝트 루트에서 실행하세요. 로그는 프로젝트 루트의 `logs/` 디렉터리에 저장됩니다.

```bash
# 프로젝트 루트로 이동
cd /path/to/marl_260306

# 10개 원천 실시간 데모
python demos/run_realtime_demo_10sources.py
python demos/run_realtime_demo_10sources.py --steps 6

# 10 에이전트 실시간 데모
python demos/run_realtime_demo_10agents.py

# 실시간 전력 예측·가격 결정 시스템
python demos/run_realtime_system.py --pkl data/paper_reproduction_dataset_from_screenshot_schema.pkl

# 실시간 CTDE (학습된 정책)
python demos/run_realtime_ctde.py --policy checkpoints/policy_for_inference.pt

# CTDE + 재학습 트리거
python demos/run_realtime_ctde_with_retrain.py

# 10개 공동체 CTDE
python demos/run_ctde_10communities.py
```

로그 파일 위치: `logs/` (예: `logs/run_realtime_demo_10sources.log`, `logs/run_realtime_ctde.log` 등).
