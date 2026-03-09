# 전력량 예측 (Forecast)

스마트 미터·태양광(PV)·ESS·OpenWeather 예보 기반 공동체 전력 사용량 예측 모듈입니다.

## 설치

```bash
pip install pandas numpy scikit-learn requests
# 선택: .env 사용 시
pip install python-dotenv
```

## 실행 파일 요약

| 파일 | 용도 |
|------|------|
| `run_demo.py` | **데모**: 기본 설정으로 한 번에 학습 → 예측 → CSV 저장 |
| `run_forecast.py` | **예측 실행**: 옵션으로 pkl 경로, 도시, 출력 파일 등 지정 |

---

## 1. 데모 실행 (`run_demo.py`)

기본 설정으로 전체 파이프라인을 실행할 때 사용합니다.

### 사용법

```bash
# 프로젝트 루트에서
python forecast/run_demo.py
```

또는

```bash
cd forecast
python run_demo.py
```

### 동작

- **학습 데이터**: `data/paper_reproduction_dataset_from_screenshot_schema.pkl` 이 있으면 사용, 없으면 합성 데이터
- **미래 입력**: 환경변수 `OPENWEATHER_API_KEY` 가 있으면 OpenWeather(서울) 사용, 없으면 합성 미래 데이터
- **결과**: `community_energy_forecast_openweather.csv` 로 저장 (프로젝트 루트 기준)

API 키 없이도 실행 가능합니다 (합성 데이터로 예측).

---

## 2. 예측 실행 (`run_forecast.py`)

학습 데이터 경로, 도시, 출력 파일 등을 지정해서 예측할 때 사용합니다.

### 기본 실행

```bash
python forecast/run_forecast.py
```

- pkl 자동 탐색 → 학습
- OpenWeather 키 있으면 서울 기준 예보, 없으면 합성 미래 데이터
- 결과: `community_energy_forecast_openweather.csv`

### 옵션

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `--pkl PATH` | 학습용 pkl 파일 경로 | 자동 탐색 또는 합성 |
| `--output`, `-o PATH` | 결과 CSV 저장 경로 | `community_energy_forecast_openweather.csv` |
| `--city NAME` | OpenWeather 도시명 | `Seoul` |
| `--country CODE` | OpenWeather 국가 코드 | `KR` |
| `--horizon N` | 예측 구간 수 (3시간 단위) | `16` (48시간) |

### 사용 예

```bash
# 결과 파일만 변경
python forecast/run_forecast.py --output result.csv

# 부산 기준 날씨 예보로 예측 (OPENWEATHER_API_KEY 필요)
python forecast/run_forecast.py --city Busan --country KR

# 학습 데이터(pkl) 경로 지정
python forecast/run_forecast.py --pkl data/paper_reproduction_dataset_from_screenshot_schema.pkl

# 72시간(24구간) 예측
python forecast/run_forecast.py --horizon 24

# 옵션 조합
python forecast/run_forecast.py --pkl data/paper_reproduction_dataset_from_screenshot_schema.pkl -o forecast_result.csv --city Seoul --horizon 16
```

### 도움말

```bash
python forecast/run_forecast.py --help
```

---

## 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `OPENWEATHER_API_KEY` | 선택 | OpenWeather API 키. 없으면 합성 미래 데이터로 예측 |

`.env` 파일에 넣거나 셸에서 설정합니다.

```bash
export OPENWEATHER_API_KEY="your_api_key"
```

---

## 데이터 준비

### 학습용 pkl (선택)

- **경로**: 다음 중 한 곳에 두면 자동 사용됩니다.
  - `data/paper_reproduction_dataset_from_screenshot_schema.pkl`
  - 프로젝트 루트의 `paper_reproduction_dataset_from_screenshot_schema.pkl`
- **없을 때**: 합성 학습 데이터로 자동 전환됩니다.

---

## 출력 CSV

결과 CSV에는 예를 들어 다음 컬럼이 포함됩니다.

- `timestamp` — 예측 시각 (3시간 단위)
- `community_load_kw_pred` — 예측 부하 (kW)
- `pv_gen_kw_pred` — 예측 태양광 발전 (kW)
- `net_grid_kw_pred` — 예측 순계통 전력 (kW)
- `llm_comment` — 보정 사유 (LLM 사용 시)
- 기타 기상·ESS·요금 등

---

## 직접 실행 (forecast.py)

모듈의 `main()` 을 그대로 쓰려면:

```bash
python -m forecast.forecast
# 또는
python forecast/forecast.py
```

동작은 데모와 동일하게, 기본 설정으로 학습 → 예측 → CSV 저장입니다.
