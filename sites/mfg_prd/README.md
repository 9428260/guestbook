# 제조공용(on AWS) 구성정보

## 구성 서버

| 호스트명          | OS                | IP             |  용도                   | 기타             |
| -                 | -                 | -              | -                       | -                |
| OPMATE-BASTION    | Amazon Linux 2023 | 3.39.26.246    | Bastion                 | ssh port = 30022 |
| OPMATE-MASTER     | RHEL 8.9          | 10.1.4.164     | OPMATE v2.0 Master 서버 |                  |
| OPMATE-WEB        | RHEL 8.9          | 10.1.8.194     | OPMATE v2.0 Web Console |                  |

## 구성 소프트웨어

| 호스트명           | 계정   | S/W                     | 버전         | 경로                        |
| -                  | -      | -                       | -            | -                           |
| OPMATE-BASTION     | opmate | N/A                     |              |                             |
| OPMATE-MASTER      | opmate | OPMATE v2.0 Master      | v2.0.327     | /opmate_data/opmate/opmnsm  |
|                    |        | OPMATE v2.0 CLI         | v2.0.316     | /opmate_data/opmate/opmnsc  |
|                    |        | OPMATE v2.0 TCS         | v2.0.304     | /opmate_data/opmate/opmtcs  |
|                    |        | EXT-MFG TagSync         |              | /opmate_data/opmate/tagsync |
| OPMATE-WEB         | opme   | OPMATE v2.0 Web Console |              |                             |
| (AWS SERVICE)      |        | Aurora MySQL            | v3.05.2      |                             |

### OPMATE v2.0 WebConsole
#### SK AX VDI 에서 접속
- VDI 내에 hosts 파일에 아래 내용을 등록하고 접속함
- 10.237.243.43 https://opmate-aws.cloudz.co.kr
- 

#### SK AX AWS 터미널 접속 방법
- 로컬 -> Bastion 접속 (vm 이나 putty 에서 연결)

- ssh -p 30022 opme@3.39.26.246
- sftp (파일 전송)
- sftp -oPort=30022 opme@3.39.26.246
- Bastion -> web console 서버 접속
- ssh opme@10.1.8.194
- sftp opme@10.1.8.194
- pw 는 임시!00
- 설치 디렉토리 /opme_data/home/opme/opme_mfg
- nginx 포트 : nginx 는 사용하지 않고 gunicorn 만 실행해 놓음
- gunicorn 포트 : 5050

# Non - SKI (SK관계사)
* SKI 아닌 관계사

## History
* 2024-08-13 : Install (v20240720)

## Environment
* AWS 환경 
  * 계정 : 
  * 서브넷 : 
  * EC2
    * Name : OPMATE-WEB
    * IP : 10.1.8.194
    * 보안그룹 (인바운드)
      * TCP: 5000 (webconsole 관리자)
        * 내 IP
      * TCP: 8080/7443 
        * 223.39.99.0/24 (for 판교 사무실)

* URL
  * https://10.1.8.194:7443
  * http://10.1.8.194:8080

* 참고사항
  * 접속 환경에 따라 IP를 보안그룹에 추가해야 할 수 있습니다.
  * make 가 없어서 yum install 로 설치
  * 현재 외부망 접속 불가 (24.08.13)

## 인프라 담당자

- SYS
  - 박수민
- DB
  - ~~이승아~~ 이현민