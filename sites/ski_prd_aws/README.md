# SKI 구성정보 (v2.0)

## 구성 서버(인증서 자동갱신이 안되는 이유로 SK AX AWS에 webconsole 을 하나더 설치함)

| 호스트명      | OS       | IP            |  용도                   | 기타    |
| -             | -        | -             | -                       | -       |
| ski-opmpmst01 | RHEL 8.9 | 10.90.80.203  | OPMATE v2.0 Master 서버 |         |
| ski-opmpdb01  | RHEL 8.9 | 10.90.80.204  | OPMATE v2.0 DB 서버     | MariaDB |
| ski-opmpweb01 | RHEL 8.9 | 10.90.80.205  | OPMATE v2.0 Web Console |         |

## 구성 소프트웨어(인증서 자동갱신이 안되는 이유로 SK AX AWS에 webconsole 을 하나더 설치함)

| 호스트명      | 계정   | S/W                    | 버전    | 경로                |
| -             | -      | -                      | -       | -                   |
| ski-opmpmst01 | opmate | OPMATE v2.0 Master     | 2.0.327 | /home/opmate/opmnsm |
|               | opmate | OPMATE v2.0 CLI        | 2.0.316 | /home/opmate/opmnsc |
|               | opmate | OPMATE v2.0 TCS        | 2.0.304 | /home/opmate/opmtcs |
| ski-opmpdb01  | maria  | MariaDB                | 11.4.2  |                     |
| ski-opmpweb01 | opme   | OPMATE v2.0 WebConsole |         |                     |
|               | opmate | OPMATE v2.0 CLI        | 2.0.316 | /home/opmate/opmnsc |

### OPMATE v2.0 WebConsole
#### SK AX VDI 에서 접속
- VDI 내에 hosts 파일에 아래 내용을 등록하고 접속함
- 10.237.243.43 https://opmate-ski.cloudz.co.kr
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
- 설치 디렉토리 /opme_data/home/opme/opme_ski
- nginx 포트 : nginx 는 사용하지 않고 gunicorn 만 실행해 놓음
- gunicorn 포트 : 5010

#### SKI 망에 설치된 터미널 접속 방법
- Tech VDI 접속 : (윈도우) 빠른 실행 -> Remote Desktop 실행
  1. 접속후에 ivanti -> skinno vpn 연결 (pw 필요함)
  2. 접속하면 SSL 연결 시도 -> Google Authentication 번호 입력 (ivanti secure Access Client)
  3. http://covdi.skinnovation.com (ski vdi 접속)
  4. SKI VDI 내에서 DB Safer 접속 (ID/PW 필요) -> Hi OTP 입력
  5. SKI VDI 내에서 putty 접속
   10.90.80.205 opme/Dhvlapdlxm1!

| 호스트명      | 계정   | S/W                    | 버전    | 경로                |
| -             | -      | -                      | -       | -                   |
| ski-opmpweb01 | opme   | OPMATE v2.0 WebConsole |         |  /home/opme/opme                   |




## 인프라 담당자

- SYS
  - (정)박관춘 (park.kc@skcc.com)
- DB
  - (정)김성민 (ssmin@skcc.com)
  - (부)신현철 (shin421179@skcc.com)
 