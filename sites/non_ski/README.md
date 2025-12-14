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