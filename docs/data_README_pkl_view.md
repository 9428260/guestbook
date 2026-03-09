# pkl 데이터를 사람이 보는 방법

pkl은 Python의 pickle 형식이라 **바로 텍스트/엑셀로 열 수 없습니다**. 아래 방법 중 편한 것을 쓰면 됩니다.

---

## 1. 스크립트로 요약·구조 보기 (가장 간단)

프로젝트에 포함된 `inspect_pkl.py`를 사용하면 **구조와 앞부분**을 터미널에 출력합니다.

```bash
cd /Users/a09206/work/ai_master_26/data
python3 inspect_pkl.py paper_reproduction_dataset_from_screenshot_schema.pkl
python3 inspect_pkl.py IEEE141_grid.pkl
```

- 최상위 키(예: metadata, elia_raw, grid, timeseries 등)
- 각 DataFrame의 행·열 수, 컬럼명, 상위 5행

을 한 번에 확인할 수 있습니다.

---

## 2. CSV로 저장해서 엑셀/스프레드시트에서 보기

`--export-csv` 옵션을 주면 pkl 안의 **모든 DataFrame을 CSV로 저장**합니다.  
생성된 CSV는 엑셀, Numbers, Google 스프레드시트 등에서 열 수 있습니다.

```bash
python3 inspect_pkl.py paper_reproduction_dataset_from_screenshot_schema.pkl --export-csv
```

- `paper_reproduction_dataset_from_screenshot_schema_export/` 폴더가 생기고
- 그 안에 `elia_raw.csv`, `prosumers.csv`, `timeseries.csv`, `grid_buses.csv` 등이 만들어집니다.
- `timeseries`는 행 수가 많아서 CSV 파일 크기가 클 수 있습니다. 필요하면 Python으로 기간/버스별로 잘라서 저장하면 됩니다.

---

## 3. Python 대화형/스크립트에서 직접 보기

Python에서 pkl을 읽은 뒤, 원하는 부분만 출력하거나 CSV로 저장할 수 있습니다.

```python
import pickle
import pandas as pd

# pkl 로드
with open("paper_reproduction_dataset_from_screenshot_schema.pkl", "rb") as f:
    data = pickle.load(f)

# 최상위 키 확인
print(data.keys())

# 메타데이터(설명 등) 보기
print(data["metadata"])

# 테이블 형태 데이터: 앞부분만 보기
print(data["prosumers"].head())
print(data["timeseries"].head(20))

# 특정 버스만 보기
ts = data["timeseries"]
bus48 = ts[ts["bus"] == 48]
print(bus48.head(10))

# CSV로 저장 (엑셀에서 열 때)
data["prosumers"].to_csv("prosumers.csv", index=False)
# timeseries는 크기가 크면 일부만 저장
data["timeseries"].head(10000).to_csv("timeseries_sample.csv", index=False)
```

- `data["timeseries"]` 등은 pandas DataFrame이므로 `.describe()`, `.info()`, 그래프 등도 그대로 사용할 수 있습니다.

---

## 4. Jupyter 노트북에서 보기

`IEEE141_grid_example_notebook.ipynb`처럼 노트북에서 pkl을 읽고, 셀마다 `head()`, `plot()` 등으로 보면서 분석할 수 있습니다.

```python
import pickle
with open("paper_reproduction_dataset_from_screenshot_schema.pkl", "rb") as f:
    dataset = pickle.load(f)
dataset["timeseries"].head()
```

---

## 요약

| 목적 | 방법 |
|------|------|
| 구조와 샘플만 빠르게 보기 | `python3 inspect_pkl.py <파일.pkl>` |
| 엑셀/스프레드시트에서 편집·공유 | `python3 inspect_pkl.py <파일.pkl> --export-csv` |
| 특정 키만 보거나 가공해서 보기 | Python 스크립트/노트북에서 `pickle.load()` 후 `head()`, `to_csv()` 등 사용 |

pkl은 **Python이 설치된 환경**에서만 위 방법으로 볼 수 있습니다. 다른 사람에게는 CSV로 내보낸 뒤 공유하는 것이 좋습니다.
