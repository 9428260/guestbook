# paper_reproduction_dataset_from_screenshot_schema.pkl — 지역·내용 설명

## 1. 지역(Region)

이 pkl은 **두 가지 지역/출처**가 결합된 형태입니다.

| 구분 | 지역/출처 | 설명 |
|------|-----------|------|
| **시계열·가격의 원천** | **벨기에 (Belgium)** | **ELIA**는 벨기에의 TSO(송전계통운영자). 원시 입력(`elia_raw`)은 ELIA가 공개하는 **밸런싱 활성화량**(aFRR, mFRR 등) 시계열입니다. 이 데이터를 UTC 15분으로 리샘플한 뒤, converter가 태양광/풍력/부하 **프록시**와 **price_buy, price_sell**을 만들어 냅니다. 즉 “시간·가격·수급 감”은 **벨기에 전력계통**에서 나옵니다. |
| **그리드·버스 구조** | **카라카스, 베네수엘라 (Caracas, Venezuela)** | 그리드는 **IEEE 141버스 배전계통**(MATPOWER `case141`)을 사용합니다. 이 계통은 논문(Khodr et al., Electric Power Systems Research, 2008)에 기반한 **카라카스 배전계통** 모델입니다. 141개 버스, 140개 브랜치, 1개 발전기(슬랙)로 구성됩니다. |
| **프로슈머가 매핑된 버스** | **동일 그리드(141버스) 내 20개 버스** | 프로슈머 20개는 위 IEEE141 그리드의 **버스 번호**(48, 78, 102, 127, 59, 109, 130, 140, 67, 95, 133, 136, 62, 86, 106, 138, 74, 100, 116, 134)에 붙어 있습니다. 즉 **지역적으로는 카라카스 배전계통 위의 20개 노드**로 정의된 것입니다. |

정리하면:

- **시간·가격·수급 패턴**: 벨기에 ELIA 데이터에서 유도한 **프록시 시계열**.
- **계통·지역 구조**: 카라카스(IEEE 141버스) **배전계통**과 그 위의 **20개 프로슈머 버스**.

---

## 2. 내용(데이터 구성)

pkl은 **하나의 dict**이고, 그 안에 아래 키들이 들어 있습니다.

### 2.1 `metadata` (dict)

- 데이터셋 이름, 주의사항, **시간 해상도(15분)**, ELIA 원시 컬럼 목록 등 메타 정보.

### 2.2 `elia_raw` (DataFrame)

- **ELIA 원시** 시계열을 스크린샷 스키마에 맞게 읽고 **15분 리샘플**한 결과.
- 컬럼 예: `timestamp`, `afrr_up_mw`, `mfrr_*_mw` 등 (밸런싱 활성화량).
- **지역**: 벨기에 ELIA 공개 데이터.

### 2.3 `elia_internal` (DataFrame)

- `elia_raw`에서 만든 **내부용 프록시** 시계열.
- 컬럼: `timestamp`, `solar_proxy`, `wind_proxy`, `load_proxy`, `price_buy`, `price_sell`.
- 태양광/풍력/부하 곡선이 아니라, ELIA 밸런싱량으로부터 **유도된 프록시**입니다.

### 2.4 `grid` (dict)

- **IEEE 141버스 계통** 구조 (카라카스 배전계통).
- 포함 예:
  - **buses**: 141개 버스 (bus_id, type, pd_mw, qd_mvar, base_kv, vm, va 등).
  - **branches**: 140개 선로 (from_bus, to_bus, r, x, b, status).
  - **generators**: 1개 (슬랙 버스 등).

### 2.5 `prosumers` (DataFrame)

- **20개 프로슈머** 정의. 그리드의 20개 버스에 대응.
- 컬럼 예: `bus`, `prosumer_type`, `pv_kw_cap`, `wt_kw_cap`, `bess_kwh_cap`, `bess_kw_cap`, `cl_kw_cap`, `cdg_kw_cap`, `load_scale` 등.
- **프로슈머 타입**과 용량 예:

| 타입 | 개수 | PV(kW) | 풍력(kW) | BESS(kWh/kW) | 부하 스케일 등 |
|------|------|--------|----------|--------------|----------------|
| Commercial | 4 | 60 | 0 | 80/30 | 1.3 |
| Rural | 4 | 25 | 35 | 50/20 | 0.8 |
| Industrial | 4 | 0 | 50 | 0/0 | 1.8 |
| Residential | 4 | 6 | 0 | 13.5/5 | 0.6 |
| EnergyHub | 4 | 120 | 60 | 200/80 | 2.0 |

### 2.6 `timeseries` (DataFrame)

- **버스·타임스탬프별** 15분 시계열. 학습/예측에서 직접 쓰는 핵심 테이블.
- **행 수**: (15분 구간 수) × 20버스 (예: 구간 약 62,691개면 약 125만 행).
- **컬럼 예**:
  - `timestamp` — 15분 단위 시각 (UTC).
  - `bus` — 버스 번호 (위 20개 중 하나).
  - `prosumer_type` — Residential / Commercial / Rural / Industrial / EnergyHub.
  - `load_kw` — 부하 (kW).
  - `pv_kw` — 태양광 발전 (kW).
  - `wt_kw` — 풍력 발전 (kW).
  - `bess_soc_kwh` — BESS 충전량 (kWh).
  - `bess_ref_power_kw` — BESS 기준 출력 (kW, 부호: 충전/방전).
  - `controllable_load_kw` — 제어 가능 부하 (kW).
  - `cdg_kw_cap` — 분산발전 용량 (kW).
  - `price_buy`, `price_sell`, `price_p2p` — 구매/판매/P2P 가격.
  - `split` — `train` / `val` / `test` (월 1일=val, 말 7일=test, 나머지=train).

---

## 3. 요약

| 항목 | 설명 |
|------|------|
| **지역(시계열·가격)** | 벨기에 ELIA 공개 데이터에서 유도한 15분 시계열·가격 프록시. |
| **지역(그리드·버스)** | 카라카스(베네수엘라) IEEE 141버스 배전계통; 프로슈머 20개는 이 그리드의 20개 버스. |
| **내용** | `metadata`, `elia_raw`, `elia_internal`, `grid`(buses/branches/generators), `prosumers`, `timeseries`(버스별 부하·PV·풍력·BESS·가격·split). |
| **시간 해상도** | 15분. |
| **참고** | ELIA 원시는 "태양광/풍력/부하 곡선"이 아니라 **밸런싱 활성화량**이라, converter가 내부적으로 solar/wind/load **프록시**를 만들어 논문 재현 파이프라인에 사용합니다. |

이렇게 **지역**은 "벨기에(시계열·가격) + 카라카스(그리드·버스)", **내용**은 위 표의 메타·원시·프록시·그리드·프로슈머·버스별 시계열로 구성되어 있습니다.
