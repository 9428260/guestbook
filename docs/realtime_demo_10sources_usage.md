# 10개 원천 실시간 데모 — 사용 방법

10개 각기 다른 원천(태양광·ESS·부하 프로파일)에서 실시간 데모 데이터를 만들고, 전력 예측·가격 예측·거래 계획·시장 실행까지 한 번에 수행하는 데모입니다.

**실행 위치**: 프로젝트 루트. **로그**: `logs/` 디렉터리.

---

## 1. 실행 방법

프로젝트 루트에서 다음처럼 실행합니다.

```bash
# 기본 실행 (6개 15분 구간 처리)
python demos/run_realtime_demo_10sources.py

# 처리할 15분 구간 수 지정 (예: 12구간 = 3시간)
python demos/run_realtime_demo_10sources.py --steps 12

# 15분 간격으로 실제 대기하며 한 스텝씩 실행 (데모/시연용)
python demos/run_realtime_demo_10sources.py --realtime

# 콘솔 출력 최소화 (로그 파일에는 그대로 기록)
python demos/run_realtime_demo_10sources.py --quiet
```

### 옵션 요약

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `--steps` | 6 | 처리할 15분 구간 수 |
| `--realtime` | False | 켜면 15분(900초)마다 한 스텝씩 대기 후 실행 |
| `--quiet` | False | 콘솔 출력 최소화 (로그 파일은 유지) |

---

## 2. 10개 원천 정의

원천은 `realtime/demo_sources.py`의 `DEMO_SOURCE_PROFILES`에 정의되어 있습니다.

| Bus | 원천 이름 | 유형 | PV(kW) | ESS(kWh) | 부하 규모 | 비고 |
|-----|-----------|------|--------|----------|-----------|------|
| 1 | 주거_아침형 | Residential | 5 | 10 | 0.7 | 피크 7.5, 8.5시 |
| 2 | 주거_저녁형 | Residential | 8 | 15 | 0.9 | 피크 18, 21시 |
| 3 | 상가_주간 | Commercial | 12 | 20 | 1.0 | 피크 10~15시대 |
| 4 | 소규모_공장 | Industrial | 15 | 50 | 1.2 | ESS arbitrage |
| 5 | 태양광_중심 | Prosumer | 30 | 25 | 0.4 | PV 대형 |
| 6 | ESS_중심 | Prosumer | 10 | 60 | 0.8 | ESS 대형, arbitrage |
| 7 | 부하_중심 | Commercial | 3 | 15 | 1.5 | 부하 큼 |
| 8 | 평형형 | Residential | 10 | 20 | 0.85 | 균형 |
| 9 | 야간_부하형 | Industrial | 6 | 40 | 1.1 | 피크 0~2, 22~23시 |
| 10 | 피크_커팅형 | Commercial | 18 | 35 | 1.0 | ESS arbitrage |

각 원천마다 15분 간격으로 `load_kw`, `pv_kw`, `bess_soc_kwh`, `bess_ref_power_kw` 등이 생성됩니다.

---

## 3. 로그 동작 (원천별 로그)

**통합 로그**와 **원천(Bus)별 로그**가 함께 기록됩니다.

### 통합 로그 (기존과 동일)

- **파일**: `logs/run_realtime_demo_10sources.log` (프로젝트 루트의 logs 디렉터리)
- **내용**: 원천 목록, 각 15분 구간별 [1/5]~[5/5] 단계 요약, 시장 결과 요약

### 원천별 로그 (추가됨)

- **파일**: `logs/run_realtime_demo_10sources_bus_1.log` ~ `logs/run_realtime_demo_10sources_bus_10.log`
- **각 파일 구성**:
  - 1행: `# source: {원천이름}` (예: `# source: 주거_아침형`)
  - 2행: CSV 헤더 (`timestamp,step,p2p_price_krw,load_kwh,pv_gen_kwh,net_energy_kwh,surplus_kwh,deficit_kwh,ess_available_kwh,role`)
  - 3행~: 시점별 한 줄 (해당 Bus의 부하·PV·잉여·부족·역할 등)

같은 실행에서 통합 로그는 한 파일에, 원천별 상세는 Bus 번호별로 나뉜 파일에 기록됩니다.

---

## 4. 데이터 흐름

1. **데이터 생성**: `realtime/demo_sources.make_demo_dataset()` → 10개 원천 × 15분 간격 시계열
2. **에이전트 구성**: `build_prosumer_agents(prosumers_df)` → Bus 1~10에 대응하는 ProsumerAgent
3. **구간별 파이프라인**: `run_realtime_pipeline_step()` → 데이터 확인 → 전력/가격 예측 → 거래 계획 → P2PPricingEngine 시장 실행
4. **로그**: 통합 요약은 `logs/run_realtime_demo_10sources.log`, 원천별 시점 데이터는 `logs/run_realtime_demo_10sources_bus_1.log` ~ `_bus_10.log`에 기록
