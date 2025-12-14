"""
노드 검색 및 관리 도구
"""
import os
import json
import re
from typing import Optional, Dict, Any
from langchain_core.tools import StructuredTool
from ...common.config import get_llm
from ..models import NodeSearchInput
from ..context import get_flask_context_info


def get_task_detail(task_id: str) -> dict:
    """
    노드 상세 정보를 조회합니다.

    Args:
        task_id: 태스크 ID

    Returns:
        dict: 노드 상세 정보 또는 오류 정보
    """
    try:
        from flask import Flask, session
        from app.interface.restclient import RestClient
        from app.interface.constants import OpmmResultCode

        # 전역 변수에서 Flask 컨텍스트 정보 가져오기
        context_info = get_flask_context_info()

        # Flask 앱 생성
        app = Flask(__name__)

        # 저장된 config 적용
        if context_info['config']:
            for key, value in context_info['config'].items():
                app.config[key] = value
        else:
            app.config['OPMM_REST_API_URL'] = os.getenv('OPMM_REST_API_URL', 'https://localhost:8443')
            app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')

        # 앱 컨텍스트와 request 컨텍스트 생성
        with app.app_context():
            with app.test_request_context():
                # 저장된 세션 정보 복원
                if context_info['session']:
                    for key, value in context_info['session'].items():
                        session[key] = value
                # RestClient를 사용하여 노드 상세 정보 조회
                rest_task = RestClient()
                url = f'/tasks/{task_id}'

                if not rest_task.get(url):
                    return {'error': '노드 조회 실패', 'resultCode': 'FAIL'}

                # NOT_FOUND 처리
                if rest_task.res.get('resultCode') == OpmmResultCode.EM1002:
                    return {'error': '노드를 찾을 수 없습니다', 'resultCode': 'EM1002'}

                return rest_task.res

    except Exception as e:
        print(f"[get_task_detail] Error: {e}")
        import traceback
        traceback.print_exc()
        return {'error': str(e), 'resultCode': 'ERROR'}


def check_task_name_conflict(task_name: str) -> dict:
    """
    태스크명이 기존 노드 ID와 중복되는지 확인합니다.

    Args:
        task_name: 확인할 태스크명

    Returns:
        dict: {'exists': bool, 'task_info': dict or None, 'message': str}
    """
    try:
        # 태스크명을 task_id로 태스크 상세 정보 조회
        task_detail = get_task_detail(task_name)

        print(f"[check_task_name_conflict] task_detail: {task_detail}")

        # 태스크가 존재하는지 확인
        if 'error' not in task_detail and task_detail.get('resultCode') == 'EM0000':
            # 태스크가 존재함
            return {
                'exists': True,
                'task_info': task_detail,
                'message': f"입력하신 태스크명 '{task_name}'은 이미 태스크 ID로 사용되고 있습니다."
            }
        else:
            # 태스크가 존재하지 않음 (태스크명 사용 가능)
            return {
                'exists': False,
                'task_info': None,
                'message': f"태스크명 '{task_name}'은 사용 가능합니다."
            }

    except Exception as e:
        print(f"[check_task_name_conflict] Error: {e}")
        return {
            'exists': False,
            'task_info': None,
            'message': f"태스크명 중복 확인 중 오류가 발생했습니다: {str(e)}"
        }


def node_search_direct(operator: str = "",
                       os_type: str = "",
                       hostname: str = "",
                       status: str = "",
                       customer: str = "",
                       os_name: str = "",
                       os_version: str = "",
                       use_regexp: bool = False,
                       page: int = 1,
                       per_page: int = 20) -> str:
    """
    노드를 검색합니다 (node.py의 get_node_list_data 함수 사용).

    전역 변수에 저장된 Flask 컨텍스트 정보를 사용합니다.
    task.py에서 set_flask_context_info()를 먼저 호출해야 합니다.

    Args:
        operator: 노드 관리자
        os_type: 운영체제 타입, 첫문자를 대문자로 변환
        hostname: 호스트명 (검색어 또는 정규표현식)
        status: 노드 상태
        customer: 고객사
        os_name: 운영체제 이름
        os_version: 운영체제 버전
        use_regexp: 정규표현식 사용 여부
        page: 페이지 번호
        per_page: 페이지당 항목 수

    Returns:
        str: JSON 형태의 검색 결과
    """
    try:
        from flask import Flask, session
        from app.node.node import get_node_list_data

        # 전역 변수에서 Flask 컨텍스트 정보 가져오기
        context_info = get_flask_context_info()

        print(f"[node_search_direct] 저장된 컨텍스트 정보 사용")
        print(f"  - config keys: {list(context_info['config'].keys())}")
        print(f"  - session keys: {list(context_info['session'].keys())}")

        # regexp_string 구성
        conditions = []
        if os_type:
            conditions.append(f'OS-TYPE:"{os_type}"')
        if operator:
            conditions.append(f'WP.sys_operator1_nm:"{operator}"')
        if customer:
            conditions.append(f'WP.customer_nm:"{customer}"')
        if os_name:
            conditions.append(f'OS-NAME::"{os_name}"')
        if os_version:
            conditions.append(f'OS-VER:"{os_version}"')

        # hostname 처리
        if hostname:
            if use_regexp:
                # 정규표현식으로 검색 (hostname이 이미 정규표현식 형태로 전달됨)
                print(f"[node_search_direct] 정규표현식 검색 모드: {hostname}")
                conditions.append(f'HOSTNAME:"{hostname}"')
            else:
                # 일반 검색어로 검색
                print(f"[node_search_direct] 일반 검색 모드: {hostname}")
                conditions.append(f'HOSTNAME:"{hostname}"')

        regexp_string = ','.join(conditions) if conditions else ''
        print(f"[node_search_direct] 최종 검색 조건: {regexp_string}")

        # 페이지네이션 계산
        offset = (page - 1) * per_page
        limit = per_page

        # Flask 앱 생성 (저장된 설정 사용)
        app = Flask(__name__)

        # 저장된 config 적용
        if context_info['config']:
            for key, value in context_info['config'].items():
                app.config[key] = value
            print(f"[node_search_direct] Flask 설정 적용 완료 - {len(context_info['config'])}개 항목")
        else:
            # 컨텍스트 정보가 없으면 환경 변수 사용
            app.config['OPMM_REST_API_URL'] = os.getenv('OPMM_REST_API_URL', 'https://localhost:8443')
            app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')
            print(f"[node_search_direct] 환경 변수로 Flask 설정")

        # 앱 컨텍스트와 request 컨텍스트 생성
        with app.app_context():
            with app.test_request_context():
                # 저장된 세션 정보 복원
                if context_info['session']:
                    for key, value in context_info['session'].items():
                        session[key] = value
                    print(f"[node_search_direct] 세션 정보 복원 완료 - {list(context_info['session'].keys())}")

                print(f"[node_search_direct] 노드 검색 시작 - regexp_string: {regexp_string}")

                # node.py의 공통 함수 호출
                result = get_node_list_data(
                    query_string='',
                    regexp_string=regexp_string,
                    limit=limit,
                    offset=offset,
                    field_string=''
                )

                print(f"[node_search_direct] 검색 완료 - 노드 수: {len(result.get('nodeList', []))}")

                return json.dumps(result, ensure_ascii=False, indent=2)

    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"[node_search_direct] Error: {e}")
        print(f"[node_search_direct] Traceback: {error_detail}")
        error_result = {"error": str(e), "nodeList": [], "totalCnt": 0}
        return json.dumps(error_result, ensure_ascii=False, indent=2)


def build_node_search_tool() -> StructuredTool:
    """Node 검색 도구 생성 (직접 호출 방식)"""
    return StructuredTool.from_function(
        name="search_nodes",
        description=(
            "OPME 시스템에서 실행 대상 노드를 검색합니다. "
            "파라미터: "
            "operator(노드 담당자/관리자명), "
            "os_type(운영체제: 'linux' 또는 'windows'), "
            "hostname(호스트명, IP 주소, 검색 키워드 또는 정규표현식), "
            "customer(고객사명), "
            "os_name(운영체제 이름: 'CentOS', 'Ubuntu', 'Windows Server' 등), "
            "os_version(운영체제 버전), "
            "use_regexp(정규표현식 사용 여부, 기본값 false). "
            "결과는 JSON 형태로 반환되며, 노드 ID, 이름, IP, 타입, 상태 등의 정보를 포함합니다."
        ),
        func=node_search_direct,
        args_schema=NodeSearchInput,
        return_direct=False,
    )


def get_node_search_system_prompt() -> str:
    """
    현재 로그인 사용자 정보를 포함한 노드 검색 시스템 프롬프트를 동적으로 생성합니다.
    """
    # 전역 변수에서 Flask 컨텍스트 정보 가져오기
    context_info = get_flask_context_info()

    # 로그인 사용자 정보 추출
    login_user = "알 수 없음"
    if context_info and context_info.get('session'):
        login_info = context_info['session'].get('login_info', {})
        login_user = login_info.get('user_id', '알 수 없음')

    print(f"[get_node_search_system_prompt] 현재 로그인 사용자: {login_user}")

    prompt = f"""당신은 OPME 시스템의 노드 검색 전문 어시스턴트입니다.

사용자의 요청을 분석하여 적절한 검색 파라미터를 추출하고 search_nodes 도구를 호출합니다.

**현재 로그인 사용자: {login_user}**

**파라미터 설명:**
- operator: 노드 담당자명 또는 관리자명 (예: "김철수", "admin", "홍길동")
- os_type: 운영체제 타입 ("Linux" 또는 "Windows")
- hostname: 호스트명, IP 주소, 또는 검색 키워드
- customer: 고객사명 (예: "SKT", "KT", "LG U+")
- os_name: 운영체제 이름 (예: "CentOS", "Ubuntu", "Windows Server")
- os_version: 운영체제 버전 (예: "7", "20.04", "2019")
- use_regexp: 정규표현식 사용 여부 (기본값: false)

**사용자 표현 매핑 규칙:**
- "내가 관리하는", "내 노드", "나의 노드" → operator="{login_user}"
- "나", "내" 같은 1인칭 표현 → 현재 로그인 사용자({login_user})를 의미

**정규표현식 패턴 인식:**
사용자가 검색 조건을 특정 패턴으로 설명하면 정규표현식으로 변환합니다:
- "dev로 시작하고 숫자로 끝나는" → hostname="^dev.*\\d+$", use_regexp=true
- "web으로 시작하는" → hostname="^web.*", use_regexp=true
- "숫자로 끝나는" → hostname=".*\\d+$", use_regexp=true
- "test를 포함하고 숫자가 3자리인" → hostname=".*test.*\\d{{3}}.*", use_regexp=true

**예시:**
1. "김철수가 관리하는 리눅스 노드 검색해줘"
   → operator="김철수", os_type="Linux", hostname=""

2. "내가 관리하는 노드 찾아줘"
   → operator="{login_user}", os_type="", hostname=""

3. "192.168.1.100 노드 찾아줘"
   → operator="", os_type="", hostname="192.168.1.100"

4. "윈도우 서버 검색"
   → operator="", os_type="Windows", hostname="서버"

5. "내 담당 리눅스 서버 검색"
   → operator="{login_user}", os_type="Linux", hostname="서버"

6. "SKT 고객사의 CentOS 7 노드 검색"
   → customer="SKT", os_name="CentOS", os_version="7"

7. "dev로 시작하고 숫자로 끝나는 호스트명 검색"
   → hostname="^dev.*\\d+$", use_regexp=true

8. "Ubuntu 20.04 운영체제의 노드 찾기"
   → os_name="Ubuntu", os_version="20.04"

**중요 규칙:**
- 명시되지 않은 파라미터는 빈 문자열("")로 전달
- use_regexp는 기본값 false, 정규표현식 패턴이 인식되면 true로 설정
- "내", "나", "내가" 같은 1인칭 표현은 반드시 현재 로그인 사용자({login_user})로 매핑
- 반드시 search_nodes 도구를 호출해야 합니다
- 도구 호출 결과를 JSON 그대로 반환하세요 (추가 설명 없이)
"""
    return prompt


def parse_schedule_input(user_input: str) -> Optional[Dict[str, Any]]:
    """
    사용자 입력에서 스케줄 정보를 파싱하여 팝업 형식으로 변환합니다.
    opme_formatDatetimeString 함수를 참조하여 mode와 timePoint 형식을 설정합니다.

    Args:
        user_input: 사용자가 입력한 스케줄 정보

    Returns:
        Dict: 팝업 형식의 스케줄 정보 {'mode': str, 'timePoint': str, 'timeZone': str} 또는 None

    TimePoint 형식 (popup_task_schedule.js 참조):
        - Daily: "00:00" - 매일 시:분
        - Weekly: "SUN 00:00" - 매주 요일 시:분 (요일은 대문자)
        - Monthly: "01 00:00" - 매월 일 시:분
        - Yearly: "01-01 00:00" - 매년 월-일 시:분
        - Hourly: "00" - 매시 분
        - Once: "2022-01-01 00:00" - 일회성 년-월-일 시:분

    사용 예시:
        - "매일 09:00" -> mode="Daily", timePoint="09:00"
        - "매주 월요일 10:00" -> mode="Weekly", timePoint="MON 10:00"
        - "매월 1일 08:00" -> mode="Monthly", timePoint="01 08:00"
        - "매년 1월 1일 12:00" -> mode="Yearly", timePoint="01-01 12:00"
        - "매시 30분" -> mode="Hourly", timePoint="30"
        - "2022년 12월 25일 14:00" -> mode="Once", timePoint="2022-12-25 14:00"
    """
    user_input_lower = user_input.lower().strip()

    # 기본값
    hour = 0
    minute = 0
    day_of_week = None
    day_of_month = None

    # 시간 추출 (HH:MM 형식)
    time_match = re.search(r'(\d{1,2})\s*[:：]\s*(\d{2})', user_input)
    if time_match:
        hour = int(time_match.group(1))
        minute = int(time_match.group(2))
    else:
        # HH시 형식
        hour_match = re.search(r'(\d{1,2})\s*시', user_input)
        if hour_match:
            hour = int(hour_match.group(1))

    # 매일 (Daily)
    if "매일" in user_input or "daily" in user_input_lower:
        schedule_info = {
            "mode": "Daily",
            "timePoint": f"{hour:02d}:{minute:02d}",
            "timeZone": "+09:00"
        }
        return schedule_info

    # 매주 (Weekly)
    elif "매주" in user_input or "weekly" in user_input_lower:
        # 요일 추출
        weekdays_ko = {
            "월요일": "MON", "화요일": "TUE", "수요일": "WED", "목요일": "THU",
            "금요일": "FRI", "토요일": "SAT", "일요일": "SUN"
        }

        for day_name, day_code in weekdays_ko.items():
            if day_name in user_input:
                day_of_week = day_code
                break

        if day_of_week:
            schedule_info = {
                "mode": "Weekly",
                "timePoint": f"{day_of_week} {hour:02d}:{minute:02d}",
                "timeZone": "+09:00"
            }
            return schedule_info

    # 매월 (Monthly)
    elif "매월" in user_input or "monthly" in user_input_lower:
        # 일자 추출
        day_match = re.search(r'(\d{1,2})\s*일', user_input)
        if day_match:
            day_of_month = int(day_match.group(1))
            schedule_info = {
                "mode": "Monthly",
                "timePoint": f"{day_of_month:02d} {hour:02d}:{minute:02d}",
                "timeZone": "+09:00"
            }
            return schedule_info

    # 매년 (Yearly)
    elif "매년" in user_input or "yearly" in user_input_lower:
        month_match = re.search(r'(\d{1,2})\s*월', user_input)
        day_match = re.search(r'(\d{1,2})\s*일', user_input)
        if month_match and day_match:
            month = int(month_match.group(1))
            day = int(day_match.group(1))
            schedule_info = {
                "mode": "Yearly",
                "timePoint": f"{month:02d}-{day:02d} {hour:02d}:{minute:02d}",
                "timeZone": "+09:00"
            }
            return schedule_info

    # 매시간 (Hourly)
    elif "매시간" in user_input or "매시" in user_input or "hourly" in user_input_lower:
        minute_match = re.search(r'(\d{1,2})\s*분', user_input)
        if minute_match:
            minute = int(minute_match.group(1))
        schedule_info = {
            "mode": "Hourly",
            "timePoint": f"{minute:02d}",
            "timeZone": "+09:00"
        }
        return schedule_info

    # 일회성 (Once)
    elif "일회성" in user_input or "once" in user_input_lower:
        # 년도 추출
        year_match = re.search(r'(\d{4})\s*년', user_input)
        month_match = re.search(r'(\d{1,2})\s*월', user_input)
        day_match = re.search(r'(\d{1,2})\s*일', user_input)

        if year_match and month_match and day_match:
            year = int(year_match.group(1))
            month = int(month_match.group(1))
            day = int(day_match.group(1))
            schedule_info = {
                "mode": "Once",
                "timePoint": f"{year:04d}-{month:02d}-{day:02d} {hour:02d}:{minute:02d}",
                "timeZone": "+09:00"
            }
            return schedule_info

    # 기본값: 매일로 처리
    if time_match:
        schedule_info = {
            "mode": "Daily",
            "timePoint": f"{hour:02d}:{minute:02d}",
            "timeZone": "+09:00"
        }
        return schedule_info

    return None


# 노드 검색 도구 인스턴스 생성
node_search_tool = build_node_search_tool()
