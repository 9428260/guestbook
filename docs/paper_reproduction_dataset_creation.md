# paper_reproduction_dataset_from_screenshot_schema.pkl 작성 과정

이 문서는 `paper_reproduction_dataset_from_screenshot_schema.pkl` 파일이 어떤 입력에서 어떤 과정을 거쳐 생성되는지 정리한 내용입니다.

---

## 1. 개요

### 1.1 파일 설명

- **파일명**: `paper_reproduction_dataset_from_screenshot_schema.pkl`
- **역할**: 논문 재현용 데이터셋. ELIA 원시 데이터(밸런싱 활성화량 등)와 IEEE141 그리드 구조를 바탕으로, 15분 해상도의 시계열(부하·태양광·풍력·BESS·가격 등)과 프로슈머·그리드 정보를 하나의 pkl로 묶은 결과물입니다.

### 1.2 pkl에 포함된 내용

| 키 | 내용 |
|----|------|
| `metadata` | 데이터셋 이름, 주의사항, 시간 해상도(15분), ELIA 원시 컬럼 목록 등 |
| `elia_raw` | ELIA 원시 데이터를 스키마에 맞게 읽고 15분 리샘플한 시계열 (timestamp, afrr_up_mw 등) |
| `elia_internal` | elia_raw에서 만든 내부 프록시 시계열 (solar_proxy, wind_proxy, load_proxy, price_buy, price_sell) |
| `grid` | IEEE141 그리드 구조 (`buses`, `branches`, `generators` DataFrame) |
| `prosumers` | 20개 프로슈머 정의 (버스, 타입, PV/풍력/BESS/부하 용량 등) |
| `timeseries` | 버스·타임스탬프별 부하·PV·풍력·BESS·가격 등 (train/val/test split 포함) |

---

## 2. 입력 데이터

pkl을 만들려면 아래 두 종류의 입력이 필요합니다.

| 입력 | 설명 | 본 프로젝트에서의 준비 방법 |
|------|------|----------------------------|
| **ELIA 원시 시계열** | 컬럼: datetime, resolutioncode, afrrbeup, mfrrbesaup, mfrrbedaup, afrrbedown, mfrrbesadown, mfrrbedadown | `ods132.csv`를 ELIA 스키마 컬럼명으로 변환해 `elia_raw.csv` 생성 |
| **IEEE141 그리드 pkl** | `grid` 안에 `buses`, `branches`, `generators` DataFrame 포함 | **실제 계통**: `build_ieee141_from_matpower.py`로 MATPOWER case141에서 `IEEE141_grid.pkl` 생성. (과거: `create_ieee141_grid_pkl.py`로 최소 구조만 생성 가능) |

---

## 3. 작성 과정 (단계별)

전체 흐름은 **① ELIA 원시 CSV 준비 → ② IEEE141 그리드 pkl 준비 → ③ converter 실행** 순서입니다.

### 3.1 Step 1: ELIA 원시 CSV 준비 (`elia_raw.csv`)

- **목적**: converter가 기대하는 컬럼명·구분자 형식으로 ELIA 데이터를 맞춤.
- **입력**: `ods132.csv` (세미콜론 구분, 컬럼명이 ELIA 스키마와 다름)
- **스크립트**: `prepare_elia_raw.py`

**ods132 → ELIA 스키마 컬럼 매핑:**

| ods132 컬럼명 | ELIA 스키마 컬럼명 |
|---------------|---------------------|
| Datetime | datetime |
| Resolution code | resolutioncode |
| aFRR BE + | afrrbeup |
| mFRR BE SA + | mfrrbesaup |
| mFRR BE DA + | mfrrbedaup |
| aFRR BE - | afrrbedown |
| mFRR BE SA - | mfrrbesadown |
| mFRR BE DA - | mfrrbedadown |

**실행:**

```bash
cd /Users/a09206/work/ai_master_26/data
python3 prepare_elia_raw.py
```

- **출력**: `elia_raw.csv` (쉼표 구분, 위 컬럼명)

---

### 3.2 Step 2: IEEE141 그리드 pkl 준비 (`IEEE141_grid.pkl`)

**권장: 실제 IEEE 141버스 계통 데이터 사용**

- **목적**: MATPOWER case141(실제 141버스 배전계통)을 파싱해 converter가 읽을 수 있는 그리드 pkl 생성.
- **입력**: `case141.m` (MATPOWER 공개 데이터, Khodr et al. – Caracas 배전계통)
- **스크립트**: `build_ieee141_from_matpower.py`

**데이터 출처:** MATPOWER case141 (https://github.com/MATPOWER/matpower/blob/master/data/case141.m), Khodr et al., Electric Power Systems Research, 2008.

**구조:** `{"grid": {"buses": df, "branches": df, "generators": df}}`  
- **buses**: 141개 (bus_id, type, pd_mw, qd_mvar, base_kv, vm, va, vmin, vmax, name). 부하 kVA→MW/MVAr(역률 0.85) 변환 적용.  
- **branches**: 140개 (from_bus, to_bus, r, x, b, status). r, x는 Ohm→p.u. 변환 적용.  
- **generators**: 1개(버스 1 슬랙) (bus, p_max, q_max 등).

**실행:** `case141.m`을 같은 폴더에 둔 뒤 `python3 build_ieee141_from_matpower.py` → 출력 `IEEE141_grid.pkl`.

**대안(최소 구조):** `create_ieee141_grid_pkl.py` – PROSUMER_TABLE 20개 버스만 포함. 실제 토폴로지 불필요할 때만 사용.

---

### 3.3 Step 3: 재현 데이터셋 pkl 생성

- **목적**: elia_raw + IEEE141 그리드를 이용해 논문 스타일 시계열·프로슈머·그리드를 하나의 pkl로 통합.
- **스크립트**: `elia_ieee141_reproduction_converter.py`

**실행 (기본 인자 사용):**

```bash
python3 elia_ieee141_reproduction_converter.py
```

- **입력**: `elia_raw.csv`, `IEEE141_grid.pkl`
- **출력**: `paper_reproduction_dataset_from_screenshot_schema.pkl`

---

## 4. converter 내부 처리 흐름

`elia_ieee141_reproduction_converter.py`의 `build_reproduction_dataset_from_screenshot_schema()` 안에서 수행되는 순서는 다음과 같습니다.

1. **load_elia_raw_from_screenshot_schema(elia_raw_path)**  
   - CSV를 읽어 ELIA 스키마 컬럼으로 매핑.  
   - timestamp를 UTC로 통일, 15분 단위 리샘플·보간 후 숫자 컬럼만 유지 (문자열 컬럼 `resolutioncode`는 resample 전에 제거).

2. **build_internal_timeseries_from_elia_raw(elia_raw)**  
   - afrr/mfrr 상·하향량으로 surplus/scarcity 프록시를 만들고,  
   - 시간대별 일조·풍력·부하 프록시와 price_buy, price_sell를 계산해 `elia_internal` 생성.

3. **load_ieee141_grid(ieee141_grid_pkl)**  
   - pkl에서 `grid` 또는 `buses`/`branches`/`generators`를 읽어 그리드 dict 반환.

4. **build_prosumer_table()**  
   - 코드 내 `PROSUMER_TABLE`과 `TYPE_SPECS`로 20개 프로슈머 테이블 생성 (버스, 타입, PV/풍력/BESS/부하 용량 등).

5. **make_paper_style_timeseries(internal, prosumers)**  
   - 내부 시계열과 프로슈머별 용량·타입을 이용해 버스·타임스탬프별 load_kw, pv_kw, wt_kw, bess_soc_kwh, bess_ref_power_kw, controllable_load_kw, 가격 등을 생성.

6. **assign_paper_split(timeseries["timestamp"])**  
   - 월별로 1일은 val, 말 7일은 test, 나머지는 train으로 split 컬럼 부여.

7. **dataset dict 구성 후 pickle.dump()**  
   - metadata, elia_raw, elia_internal, grid, prosumers, timeseries를 하나의 dict로 묶어 출력 pkl로 저장.

---

## 5. 실행 시 적용한 수정 사항

실제로 pkl을 생성할 때 아래 두 가지를 converter 코드에 반영했습니다.

### 5.1 타임존 혼합 오류 방지

- **현상**: `ods132.csv`의 datetime에 `+01:00` 등 타임존이 포함되어 있어 `pd.to_datetime()`에서 "Mixed timezones detected" 오류 발생.
- **조치**: `load_elia_raw_from_screenshot_schema()` 내에서  
  `pd.to_datetime(df[mapping.datetime], errors="coerce", utc=True)` 로 통일.

### 5.2 resample 시 문자열 컬럼 제거

- **현상**: 15분 리샘플 시 `resolutioncode`(문자열)에 `.mean()`이 적용되며 "dtype 'str' does not support operation 'mean'" 오류 발생.
- **조치**: 리샘플 직전에 `out.drop(columns=["resolutioncode"], errors="ignore")` 로 해당 컬럼 제거.

---

## 6. 출력 pkl 구조 요약

```
paper_reproduction_dataset_from_screenshot_schema.pkl
└── dict
    ├── metadata      (dict: name, warning, time_resolution_minutes, elia_raw_columns)
    ├── elia_raw      (DataFrame: timestamp, afrr_up_mw, mfrr_*_mw ...)
    ├── elia_internal (DataFrame: timestamp, solar_proxy, wind_proxy, load_proxy, price_buy, price_sell)
    ├── grid          (dict)
    │   ├── buses      (DataFrame)
    │   ├── branches  (DataFrame)
    │   └── generators (DataFrame)
    ├── prosumers     (DataFrame: bus, prosumer_type, has_*, *_cap, load_scale ...)
    └── timeseries    (DataFrame: timestamp, bus, prosumer_type, load_kw, pv_kw, wt_kw, bess_*, price_*, split ...)
```

- **timeseries** 행 수: (elia_raw 15분 구간 수) × (프로슈머 20개).  
  예: elia_raw가 약 62,691행이면 timeseries는 약 1,253,820행 수준.

---

## 7. 재현 방법 (한 번에 실행)

**실제 IEEE 141버스 계통으로 재현할 때** (권장):

```bash
cd /Users/a09206/work/ai_master_26/data

# 1) ods132 → elia_raw.csv (pandas 필요)
python3 prepare_elia_raw.py

# 2) case141.m으로 IEEE141 그리드 pkl 생성 (pandas, numpy 필요)
#    case141.m 없으면: curl -sL "https://raw.githubusercontent.com/MATPOWER/matpower/master/data/case141.m" -o case141.m
python3 build_ieee141_from_matpower.py

# 3) 재현 데이터셋 pkl 생성
python3 elia_ieee141_reproduction_converter.py
```

**최소 그리드로만 재현할 때** (실제 토폴로지 불필요):

- 2번만 `python3 create_ieee141_grid_pkl.py` 로 교체하면 됩니다.

필요 시 `pip install pandas numpy` 로 의존성을 설치한 뒤 실행하면 됩니다.

---

## 8. 참고

- ELIA 원시 스키마는 논문에서 말하는 태양광/풍력/부하 곡선이 아니라 **밸런싱 활성화량(aFRR, mFRR 등)** 입니다. converter는 이 데이터로 solar/wind/load **프록시**를 만들어 재현 파이프라인이 동작하도록 했습니다.  
  실제 태양광/풍력/부하 컬럼을 쓰려면 `build_internal_timeseries_from_elia_raw()` 내 매핑을 해당 컬럼에 맞게 바꾸면 됩니다.
- 그리드 pkl은 이제 실제 IEEE 141버스 계통(MATPOWER case141)을 `build_ieee141_from_matpower.py`로 파싱해 사용합니다. 141버스·140브랜치·1발전기, 부하·임피던스 변환까지 반영된 pkl이 생성됩니다.
