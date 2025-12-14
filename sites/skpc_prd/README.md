# 제조공용(on SKPC) 구성정보

## NAVER Cloud Platform

- Region : SK Private Cloud
- VPC : sk-opmate-vpc
- https://www.ncloud.com/nsa/opmate


## 구성 서버 (sk-opm-p-con 은 SK AX AWS 환경으로 이전함)

| 호스트명        | OS               | IP            |  용도              | 기타 |
| -               | -                | -             | -                  | -    |
| sk-opm-p-master | Rocky Linux 8.10 | 10.192.11.135 | OPMATE Master 서버 |      |
| sk-opm-p-tcs    | Rocky Linux 8.10 | 10.192.11.136 | OPMATE TCS 서버    |      |
| sk-opm-p-con    | Rocky Linux 8.10 | 10.192.11.137 | OPMATE Web Console |      |

## 구성 소프트웨어  (sk-opm-p-con 은 SK AX AWS 환경으로 이전함)

**On SERVER**

| 호스트명           | 계정   | S/W                     | 버전         | 경로                 |
| -                  | -      | -                       | -            | -                    |
| sk-opm-p-master    | opmate | OPMATE v2.0 Master      | v2.0.327     | /home/opmate/opmnsm  |
|                    |        | EXT-MFG TagSync         |              | /home/opmate/tagsync |
|                    |        | OPMATE v2.0 CLI         | v2.0.316     | /home/opmate/opmnsc  |
|                    |        |                         |              |                      |
| sk-opm-p-tcs       | opmate | OPMATE v2.0 TCS         | v2.0.304     | /home/opmate/opmtcs  |
|                    |        |                         |              |                      |
| sk-opm-p-con       | opmate | OPMATE v2.0 Web Console | ???          | ???                  |
|                    |        | OPMATE v2.0 CLI         | v2.0.316     | /home/opmate/opmnsc  |
|                    |        |                         |              |                      |


### OPMATE v2.0 WebConsole
#### SK AX VDI 에서 접속
- https://opmate.cloudz.co.kr

#### 터미널 접속 방법
- 로컬 -> Bastion 접속 (vm 이나 putty 에서 연결)

- ssh -p 30022 opme@3.39.26.246
- sftp (파일 전송)
- sftp -oPort=30022 opme@3.39.26.246
- Bastion -> web console 서버 접속
- ssh opme@10.1.8.194
- sftp opme@10.1.8.194
- pw 는 임시!00
#### 설치 디렉토리 /opme_data/home/opme/opme_skpc
#### nginx 포트 : 5000
#### gunicorn 포트 : 5005


- 최초 설치 주소 (현재는 사용하지 않음)
  - https://10.192.11.137/
  - admin/*******

## 인프라 담당자

- SYS
  - 허창연

## 변경 내용 
최초 아래의 내용으로 설치 되었으나 인증서 갱신을 NAVER CLOUD 에서 자동으로 되지 않아서 SK AX AWS 환경으로 이전함

| 호스트명           | 계정   | S/W                     | 버전         | 경로                 |
| -                  | -      | -                       | -            | -                    |
| sk-opm-p-con       | opmate | OPMATE v2.0 Web Console | ???          | ???                  |

