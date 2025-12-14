---
title: 노드
description: 노드 목록/노드 정보
---

<link rel="stylesheet" type="text/css" href="css/opme.css">

<!-- Defined -->
[node-lst]: img/node-lst.png
[node-dtl]: img/node-dtl.png

<!-- Floating Menu -->
[prev]: role.html "역할"
[menu]: index.html "목차"
[next]: nodereview.html "태스크"
[ico-prev]: img/icon/ico-prev.png
[ico-menu]: img/icon/ico-menu.png
[ico-next]: img/icon/ico-next.png
[![이전][ico-prev]{: class="ico-prev-float" }][prev]
[![목차][ico-menu]{: class='ico-menu-float' }][menu]
[![다음][ico-next]{: class="ico-next-float" }][next]


<details>
<summary>노드(Node)</summary>
    노드는 Agent가 설치된 장비를 마스터가 인식하는 단위입니다.
</details><br>

## 노드 목록

OPMATE 에 연결된 노드를 조회합니다.   

![노드 목록][node-lst]

### **조회 조건**

조회 조건 하단의 ▼/▲ 를 Click 하면 _Advanced Search_ 기능을 사용할 수 있습니다.

**입력 항목(Basic Search)**

> **고객사** : 고객사명 선택 (복수선택 가능)  
> **Hostname** : 부분문자열 조회 가능(Like)   
> **OS 종류** : 부분문자열 조회 가능(Like)  
> **IP 주소** : 부분문자열 조회 가능(Like)   
> **서버운영자** : 서버 운영자명 조회 가능(Like)  

**입력 항목(Advanced Search - 노드집합표현식)**

> **Hostname** : 정규표현식 조회 가능(Like)  
> **OS 종류** : 정규표현식 조회 가능(Like)  
> **OS 이름** : 정규표현식 조회 가능(Like)  
> **OS 버전** : 정규표현식 조회 가능(Like)  

**버튼**

> <kbd class="btn-gray">&nbsp;초기화&nbsp;</kbd> : 조회 조건 초기화  
> <kbd class="btn-gray">&nbsp;태그찾기&nbsp;</kbd> : 태그 정보 조회 팝업  
> <kbd class="btn-red">&nbsp;조회&nbsp;</kbd> : 조회 수행  
 
### **조회 결과**

**Grid 본문영역**

> **Grid Contents** : 조회 결과 출력  
> **Double Click** : 해당 Row 의 상세 정보 화면으로 이동
 
**Grid 하단영역**

> **Left** : 조회 건수  
> **Center** : 페이지 표시/선택  
> **Right** : Grid 에 한번에 표시할 건수  


## 노드 정보

노드 정보 확인이 가능합니다. (조회 Only)

![노드 정보][node-dtl]
 
### **기본정보**
OPMATE Agent 및 설치된 서버의 기본 정보를 확인 가능합니다.

> **노드세션ID** : OPMATE Master와 연결된 Agent의 세션 ID  
> **CSP리소스ID** : Cloud VM인 경우 CSP가 부여하는 고유 ID  
> **Agent Ver.** : 설치된 OPMATE Agent 버전 정보

### **HOST정보**
OPMATE Agent가 설치된 노드의 주요 정보를 확인 가능합니다.

> **Hostname** : 서버 Hostname  
> **OS종류** : 서버 OS 유형  
> **OS이름** : 서버의 OS 상세 이름  
> **OS버전** : 서버 OS 상세 버전명
> **IP주소** : OPMATE Master가 인지한 Agent의 IP주소(NAT IP 등)

### **이력정보**
OPMATE Agent 생성/연결 관련 정보를 확인 가능합니다.

> **HeartBeat** : OPMATE Agent와 OPMATE Master 간 최종 통신 시간  
> **생성일시** : 노드와 OPMATE Master와 최초 연결된 시간  
> **Conflict 세션** : 기존 노드와 중복이 발생한 경우 중복 세션 정보  

### **태그정보**
Cloud 리소스인 경우 CSP에 등록한 태그정보 또는, Work Portal에 등록한 노드의 태그정보를 확인 가능합니다.  
특정 값을 필터링 해서 볼 수 있습니다.

> **시스템구분** : 태그의 유형 구분. CSP/WorkPortal 등 태그 부여 시스템  
> **KEY** : 태그 키  
> **VALUE** : 태그 값  

### **하단 버튼영역**

> <kbd class="btn-gray">목록</kbd> : 목록 화면으로 이동  
 
 