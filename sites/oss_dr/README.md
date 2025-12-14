# OSS DR (과금 DR)
* 과금 DR 환경

## History
* 202124-07-03 : Setup

## Environment

## 과금 DR 환경 정보
| 구분             | IP             | Hostname          | 용도             | OS 계정                                                                                               |
|----------------|----------------|-------------------|----------------|-----------------------------------------------------------------------------------------------------|
| 자동화            | 150.24.251.172 | SKT-AUTOPAIR1     | 자동화 Airflow    | skccadm/임시!1234 (관리계정), airflow/임시!00  (WorkFlow), grafana/임시!00   (상황판), opme/임시!00   (WebConsole) |
| 자동화            | 150.24.251.173 | SKT-AUTOPOPM1     | 자동화 opmate     | skccadm/임시!1234 (관리계정), opmate/임시!00                                                                |
| DB             | 150.24.251.174 | SKT-AUTOPDB1      | 자동화 DB 1호기     |                                                                                                     |
| DB             | 150.24.251.175 | SKT-AUTOPDB2      | 자동화 DB 2호기     |                                                                                                     |
| DB             | 150.24.251.176 | SKT-AUTOPDB3      | 자동화 DB 3호기     |                                                                                                     |
| Write/Read VIP | 150.24.251.177 | SKT-AUTOPDB-W-VIP | 자동화 DB 쓰기용 VIP |                                                                                                     |
| Read VIP       | 150.24.251.178 | SKT-AUTOPDB-R-VIP | 자동화 DB 읽기용 VIP |                                                                                                     |

## 과금 DR DB 계정 정보
| application | DB명      | 계정명  | 패스워드       |
|-------------|----------|------|------------|
| opmate      | opmatedb | opmm | 1!Godqhr12 |
| airflow     | airflowdb | airflow | 1!Godqhr12 |
| grafana     | grafanadb | grafana | 1!Godqhr12 |


* URL
  ### airflow http://150.24.251.172:8080/
  #### 계정 : admin/1!Godqhr12, druser/druser
  ### opmate(webconsole) http://150.24.251.172:8083/
  #### 계정 : admin/admin00, dradmin/admin00DR!, druser/Druser123!
  ### grafana http://150.24.251.172:8085/
  #### 계정 : admin/1!gdoqhr12, oss_dr_application/oss_dr_application, oss_dr_database/oss_dr_database, oss_dr_middleware/oss_dr_middleware, oss_dr_security/oss_dr_security, oss_dr_system/oss_dr_system, payment_dr_user/payment_dr_user

