# etc.py 기능별 모듈 분리 설명

`etc.py`를 기능별로 나눈 파일 구성과 사용 방법입니다.

---

## 분리된 파일 구성

| 파일 | 역할 |
|------|------|
| **config.py** | `TrainConfig` — 디바이스, 에이전트/모델 크기, RL·imitation 하이퍼파라미터 등 |
| **utils.py** | `set_seed`, `soft_update`, `mlp` — 시드 고정, 타깃 네트워크 소프트 업데이트, MLP 생성 |
| **replay.py** | `PrioritizedReplayBuffer`, `DualReplay` — 우선순위 리플레이·정상/위반 이중 버퍼 |
| **expert.py** | `BaseExpert`, `HeuristicLLMExpert` — Expert 인터페이스 및 휴리스틱 Expert |
| **networks.py** | `GaussianActor`, `DifferentialAttentionBlock`, `CentralizedCritic`, `ValueNet` — Actor/Critic 네트워크 |
| **agent.py** | `LLMGuidedCTDE` — CTDE + Imitation 학습기 (W2 제약, Lagrange 등) |
| **env.py** | `P2PEnergyEnv` — P2P 에너지 환경 골격 (reset/step/obs) |
| **train.py** | `train()` + `if __name__ == "__main__"` — 학습 루프 및 실행 진입점 |

---

## 실행 방법

기존과 동일하게 실행하면 됩니다.

```bash
python train.py
```

---

## 의존 관계

- `config` ← `replay`, `networks`, `agent`, `env`, `train`
- `utils` ← `agent`, `train`
- `networks` ← `agent`
- `agent`, `env`, `expert`, `replay` ← `train`

---

## 참고

- `etc.py`는 백업용으로 남겨두거나 필요 없으면 삭제해도 됩니다.
