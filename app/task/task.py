import base64
import json
import asyncio
import os
from datetime import datetime


def safe_json_dumps(obj, **kwargs):
    """
    안전한 JSON 직렬화 함수
    직렬화할 수 없는 객체는 문자열로 변환
    """
    def default_serializer(obj):
        # LangChain 객체들과 기타 직렬화 불가능한 객체들을 문자열로 변환
        if hasattr(obj, '__dict__'):
            # 객체의 딕셔너리 표현이 있으면 시도
            try:
                return obj.__dict__
            except:
                return str(obj)
        return str(obj)

    try:
        return json.dumps(obj, default=default_serializer, **kwargs)
    except (TypeError, ValueError):
        # 모든 직렬화가 실패하면 문자열로 변환
        return json.dumps(str(obj), **kwargs)


def save_chat_log(session_id, user_message, system_response, chat_mode="agent"):
    """
    채팅 내용을 파일로 저장
    :param session_id: 세션 ID
    :param user_message: 사용자 메시지
    :param system_response: 시스템 응답 메시지
    :param chat_mode: 채팅 모드 (agent, simple 등)
    """
    try:
        now = datetime.now()

        # 로그 디렉토리 설정: logs/chat/YYYY/MM/
        base_log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'logs', 'chat')
        year_month_dir = os.path.join(base_log_dir, now.strftime('%Y'), now.strftime('%m'))
        os.makedirs(year_month_dir, exist_ok=True)

        # 파일명: chat_log_YYYYMMDD.jsonl (일자별 파일)
        log_file = os.path.join(year_month_dir, f'chat_log_{now.strftime("%Y%m%d")}.jsonl')

        # 로그 엔트리 생성
        log_entry = {
            'timestamp': now.isoformat(),
            'session_id': session_id,
            'chat_mode': chat_mode,
            'user_message': user_message,
            'system_response': system_response
        }

        # JSONL 형식으로 파일에 추가 (각 줄이 독립적인 JSON 객체)
        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps(log_entry, ensure_ascii=False) + '\n')

        print(f"[save_chat_log] 채팅 로그 저장 완료: {log_file}")

    except Exception as e:
        print(f"[save_chat_log] 채팅 로그 저장 실패: {str(e)}")
        traceback.print_exc()


from app.common.chardecode import convert

from flask import render_template, Blueprint, request, jsonify, current_app, session, Response

from app.common.render import Render
from app.interface.constants import OpmmResultCode
from app.interface.restclient import RestClient
from app.user import login_required

from ..llm.workflow.multi_agent import build_graph, AgentState, set_flask_context_info
from ..llm.common.async_helpers import setup_nested_event_loop, SafeAsyncGenerator
from ..llm.workflow.workflow_messages import WORKFLOW_SYSTEM_MESSAGES
from langchain_core.messages import ToolMessage
from langchain_core.runnables import RunnableConfig
import uuid
import traceback


bp = Blueprint('task', __name__)


@bp.route('/chat_ui', methods=['GET'])
@login_required
def render_chat_ui():
    return Render.render_template('task/task_dtl_chat.html',
                                  opmm_publisher_separate_enable=current_app.config['OPMM_PUBLISHER_SEPARATE_ENABLE'],
                                  opmm_tcs_verify_enable=current_app.config['OPMM_TCS_VERIFY_ENABLE'])


@bp.route('/', methods=['GET'])
@login_required
def render_page():
    """
    태스크 목록 화면
    :return:
    """
    return Render.render_template('task/task_lst.html')


@bp.route('/', methods=['POST'])
@login_required
def render_page_with_param():
    """
    태스크 목록 화면
    :return:
    """
    return Render.render_template('task/task_lst.html', request_params=request.form)


@bp.route('/list', methods=['POST'])
@login_required
def request_task_list():
    """
    태스크 목록 요청
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()

    task_id = req.get('id', '')
    owner_id = req.get('owner_id', '')
    publisher_id = req.get('publish_id', '')
    permitted_id = req.get('permitted_id', '')
    rev_no = req.get('rev_zero', '')
    page = 1
    per_page = 10

    if req.get('page') is not None:
        page = req['page']

    if req.get('perPage') is not None:
        per_page = req['perPage']

    offset = (page - 1) * per_page
    limit = per_page

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call
    rest_task = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/tasks'
    query_string = ''

    if task_id != '':
        query_string = ',id=' + task_id
    if owner_id != '':
        query_string += ',owner=' + owner_id
    if publisher_id != '':
        query_string += ',publishableUser=' + publisher_id
    if permitted_id != '':
        query_string += ',permittedUser=' + permitted_id
    if rev_no != '':
        query_string += ',revNo=' + rev_no

    rest_task.req = {'query': query_string[1:],  # 좌측 ',' 제거
                     'field': 'permMode',
                     'limit': limit,
                     'offset': offset}

    # Step 3-2. REST Call : get
    if not rest_task.get(url):
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    # NOT_FOUND
    if rest_task.res['resultCode'] == OpmmResultCode.EM1002:
        rest_task.res['taskList'] = []
        rest_task.res['totalCnt'] = 0

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return jsonify(rest_task.res)


@bp.route('/dupchk', methods=['POST'])
@login_required
def duplicate_check_id():
    """
    사용자그룹 정보를 가져온다.
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()
    task_id = req['id']

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call
    rest_task = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/tasks/' + task_id

    # Step 3-2. REST Call : get
    if not rest_task.get(url):
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    # NOT_FOUND
    if rest_task.res['resultCode'] == OpmmResultCode.EM1002:
        current_app.logger.error("[{0}] {1}".format(rest_task.res['resultCode'], rest_task.res['resultMsg']))

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return jsonify(rest_task.res)


@bp.route('/check_zero_rev', methods=['POST'])
@login_required
def check_zero_rev():
    """
    태스크 Revision 0. 존재 여부를 확인한다.
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()
    task_id = req['id']

    # Step 3. REST Call
    rest_task = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/tasks/' + task_id + '?revNo=0'

    # Step 3-2. REST Call : get
    if not rest_task.get(url):
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    # NOT_FOUND
    if rest_task.res['resultCode'] != OpmmResultCode.EM0000:
        return jsonify({'revision_zero_yn': False})

    return jsonify({'revision_zero_yn': True})


@bp.route('/dtl', methods=['POST'])
@login_required
def request_task():
    """
    태스크 정보를 가져온다.
    :return:
    """
    is_ajax = True  # True: Ajax Call, False: Normal POST Call
    is_read_only = False  # True: Available write task, False: Not Available

    # Step 1. Request Data Parsing.
    if request.form.get('task_id') is None:  # Ajax Request
        req = request.get_json()

        task_id = req['task_id']
        rev_no = req['rev_no']

        if task_id is None or task_id == '':
            current_app.logger.error("[{0}] {1}".format(OpmmResultCode.EM0999, "Task ID not found."))
            return jsonify({'result': 'Fail'}), 500
    else:  # Post Request
        is_ajax = False

        task_id = request.form.get('task_id')
        rev_no = request.form.get('rev_no')

        if task_id is None or task_id == '':  # create
            return Render.render_template('task/task_dtl.html',
                                          request_params=request.form,
                                          opmm_publisher_separate_enable=current_app.config[
                                              'OPMM_PUBLISHER_SEPARATE_ENABLE'],
                                          opmm_tcs_verify_enable=current_app.config['OPMM_TCS_VERIFY_ENABLE'],
                                          workflow_system_messages=WORKFLOW_SYSTEM_MESSAGES,
                                          response=json.dumps({'is_read_only': is_read_only}))

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call
    rest_task = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/tasks/' + task_id
    if rev_no is not None and rev_no != '':
        url += '?revNo=' + rev_no

    # Step 3-2. REST Call : get
    if not rest_task.get(url):
        error_map = {'resultCode': OpmmResultCode.EM0999,
                     'resultMsg': 'Internal Error'}

        if is_ajax is True:
            return jsonify(error_map)

        return Render.render_template('task/task_lst.html',
                                      request_params=request.form,
                                      response=error_map)

    # Step 3-3. REST Call : Check Biz. Exception
    # NOT NORMAL
    if rest_task.res['resultCode'] != OpmmResultCode.EM0000:
        current_app.logger.error("[{0}] {1}".format(rest_task.res['resultCode'], rest_task.res['resultMsg']))

        if is_ajax is True:
            return jsonify(rest_task.res)

        return Render.render_template('task/task_lst.html',
                                      request_params=request.form,
                                      response=rest_task.res)

    # Step 3-4. REST Call : Output Process
    # Step 3-4-1. scriptContent
    ## 수정 - chardet 관련 내용 시작
    # Decode Base64
    converttext = convert(rest_task.res['base64ScriptContent'])

    rest_task.res['script_encode'] = converttext[1]
    # Detect Line Separator
    line_separator_type = 'LF'
    if "\r\n" in converttext[0]:
        line_separator_type = 'CRLF'
    rest_task.res['script_line_separator'] = line_separator_type

    # Bind base64 encoded string
    rest_task.res['base64ScriptContent'] = base64.b64encode(converttext[0].encode()).decode()

    # Step 3-4-1. targetList
    for idx, node_set in enumerate(rest_task.res['targetList']):
        rest_task.res['targetList'][idx]['hostname'] = ""
        rest_task.res['targetList'][idx]['osType'] = ""
        rest_task.res['targetList'][idx]['osName'] = ""
        rest_task.res['targetList'][idx]['osVersion'] = ""
        rest_task.res['targetList'][idx]['tag'] = {}

        node_set_str = node_set['nodeSet']

        while True:
            # parse key
            e_idx = node_set_str.find(':')  # find character ':'
            key = node_set_str[:e_idx]
            key = key.strip()
            node_set_str = node_set_str[e_idx + 1:]

            # error : value parsing
            if node_set_str.startswith('"') is False:
                error_map = {'resultCode': OpmmResultCode.EM0999,
                             'resultMsg': 'Internal Error'}
                current_app.logger.error("[{0}] {1}".format(error_map['resultCode'],
                                                            "Parse error.(" + node_set['nodeSet'] + ")"))
                return Render.render_template('task/task_lst.html',
                                              request_params=request.form,
                                              response=error_map)

            # parse value
            node_set_str = node_set_str[1:]  # skip character string start double quote.
            e_idx = node_set_str.find('"')  # find character string end double quote.
            value = node_set_str[:e_idx]
            node_set_str = node_set_str[e_idx + 1:]

            # assign new key
            if key == 'HOSTNAME':
                rest_task.res['targetList'][idx]['hostname'] = value
            elif key == "OS-TYPE":
                rest_task.res['targetList'][idx]['osType'] = value
            elif key == "OS-NAME":
                rest_task.res['targetList'][idx]['osName'] = value
            elif key == "OS-VER":
                rest_task.res['targetList'][idx]['osVersion'] = value
            else:  # Tag
                rest_task.res['targetList'][idx]['tag'][key] = value

            # string end
            if len(node_set_str) == 0:
                break

            # key:"value" parsing error
            if node_set_str.startswith(',') is False:
                error_map = {'resultCode': OpmmResultCode.EM0999,
                             'resultMsg': 'Internal Error'}
                current_app.logger.error("[{0}] {1}".format(error_map['resultCode'],
                                                            "Parse error.(" + node_set['nodeSet'] + ")"))
                return Render.render_template('task/task_lst.html',
                                              request_params=request.form,
                                              response=error_map)

            node_set_str = node_set_str[1:]  # skip character ','

        del rest_task.res['targetList'][idx]['nodeSet']

    # Step 3-4-2. scheduleList
    schedule_list = []
    for idx, schedule in enumerate(rest_task.res['scheduleList']):
        schedule_list.append({'mode': get_time_mode(schedule['timePoint']),
                              'timePoint': schedule['timePoint'],
                              'timeZone': schedule['timeZone']})

    del rest_task.res['scheduleList']
    rest_task.res['scheduleList'] = schedule_list

    # Step 3-4-3. runnableTimeList
    runnable_time_list = []
    for idx, runnableTime in enumerate(rest_task.res['runnableTimeList']):
        time_idx = runnableTime['timeRange'].rindex('~')

        runnable_time_list.append({'mode': get_time_mode(runnableTime['timeRange'][0:time_idx - 1]),
                                   'start': runnableTime['timeRange'][0:time_idx - 1],
                                   'range': runnableTime['timeRange'][time_idx + 2:],
                                   'timeZone': runnableTime['timeZone']})
    del rest_task.res['runnableTimeList']
    rest_task.res['runnableTimeList'] = runnable_time_list

    # Step 3-4-4. trigList
    trigger_list = []
    for idx, trigger in enumerate(rest_task.res['trigList']):
        # Sample Data
        # - result="success"
        # - result="success" after="5m"
        task_time = ''
        task_time_unit = ''

        split_data = trigger['condition'].split()
        task_result = split_data[0].split('\"')[1]
        if len(split_data) > 1:
            task_time = split_data[1].split('\"')[1][0:-1]
            task_time_unit = split_data[1].split('\"')[1][-1]

        trigger_list.append({'taskId': trigger['taskId'],
                             'taskResult': task_result,
                             'time': task_time,
                             'timeUnit': task_time_unit})

    del rest_task.res['trigList']
    rest_task.res['trigList'] = trigger_list

    # Step 3-4-5. permissionList
    for idx, permission in enumerate(rest_task.res['permissionList']):
        rest_task.res['permissionList'][idx]['read'] = permission['mode'][0:1]
        rest_task.res['permissionList'][idx]['write'] = permission['mode'][1:2]
        rest_task.res['permissionList'][idx]['execute'] = permission['mode'][2:3]

    # Step 99. Response Data Formatting
    if is_ajax is True:
        return jsonify(rest_task.res)

    result, task_mode = get_task_mode(task_id)
    if result and task_mode[1] != 'w':
        is_read_only = True

    #print(rest_task.res)
    rest_task.res['is_read_only'] = is_read_only
    # opmm_tcs_verify_enable OPMM TCS 활성화 여부 yes : 활성화, no : 비활성화 추가
    return Render.render_template('task/task_dtl.html',
                                  request_params=request.form,
                                  opmm_publisher_separate_enable=current_app.config['OPMM_PUBLISHER_SEPARATE_ENABLE'],
                                  opmm_tcs_verify_enable=current_app.config['OPMM_TCS_VERIFY_ENABLE'],
                                  workflow_system_messages=WORKFLOW_SYSTEM_MESSAGES,
                                  response=json.dumps(rest_task.res, ensure_ascii=False))


@bp.route('/p_task', methods=['GET'])
@login_required
def render_search_task_page():
    """
    태스크 조회 Popup 화면
    :return:
    """
    return Render.render_template('task/popup/popup_task_lst.html')


@bp.route('/p_task_hst', methods=['GET'])
@login_required
def render_search_task_hst_page():
    """
    태스크 리비전 조회 Popup 화면(태스크 비교를 위한 조회 팝업)
    :return:
    """
    return Render.render_template('task/popup/popup_task_hst_lst.html')


@bp.route('/p_schedule', methods=['GET'])
@login_required
def render_schedule_page():
    """
    스케줄 추가 Popup 화면
    :return:
    """
    return Render.render_template('task/popup/popup_task_schedule.html')


@bp.route('/p_runnable_time', methods=['GET'])
@login_required
def render_runnable_time_page():
    """
    실행가능시간 추가 Popup 화면
    :return:
    """
    return Render.render_template('task/popup/popup_task_runnable_time.html')


@bp.route('/p_notilist', methods=['GET'])
@login_required
def render_notilist_page():
    """
    알림목록 Popup 화면
    :return:
    """

    return Render.render_template('task/popup/popup_task_notilist.html',
                                  notilist_condition=json.dumps(current_app.config['NOTILIST_CONDITION']),
                                  notilist_event=json.dumps(current_app.config['NOTILIST_EVENT']),
                                  notilist_method=json.dumps(current_app.config['NOTILIST_METHOD']))


@bp.route('/p_select', methods=['GET'])
@login_required
def render_select_page():
    """
    태스크 Revision 선택 Popup 화면
    :return:
    """
    return Render.render_template('task/popup/popup_task_select.html')


@bp.route('/save', methods=['POST'])
@login_required
def request_task_save():
    """
    태스크 저장
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()

    task_id = req['id']
    base_info = req['base_info']
    script_info = req['script_info']
    target_list = req['target_list']
    schedule_list = req['schedule_list']
    runnable_time_list = req['runnable_time_list']
    trigger_list = req['trigger_list']
    permission_list = req['permission_list']
    notilist_list = req['notilist_list']

    rest_mode = 'POST'  # CREATE
    if task_id != '':
        rest_mode = 'PUT'  # EDIT

    # Step 2. Request Data Validation.
    if current_app.config['OPMM_PUBLISHER_SEPARATE_ENABLE'] == 'yes' \
            and base_info['publish_id'] == session['login_info']['user_id'] \
            and session['login_info']['privilege'] != '9':
        return jsonify({'resultCode': 'EM0999', 'resultMsg': '본인 외 다른 사용자를 발행자로 지정해야 합니다.'})

    # Step 3. REST Call(Create&Edit Usergrp)
    rest_task = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/tasks'
    if rest_mode == 'PUT':
        url = '/tasks/' + task_id + '?mode=edit'

    if base_info['task_id'] != '':
        rest_task.req['id'] = base_info['task_id']
    if base_info['owner_id'] != '':
        rest_task.req['ownerUserId'] = base_info['owner_id']
    if base_info['cutoffperiod'] != '':
        rest_task.req['cutOffPeriod'] = base_info['cutoffperiod'] #+ "m"
    if script_info['script_name'] != '':
        rest_task.req['scriptName'] = script_info['script_name']
    if script_info['script_account'] != '':
        rest_task.req['scriptAccount'] = script_info['script_account']
    if script_info['script_content'] != '':

        # Decode base64
        # script_content = base64.b64decode(script_info['script_content'].encode()).decode()
        script_content = convert(script_info['script_content'])
        # Change Encoding
        # b_content = script_content.encode(script_info['script_encode'])
        b_content = script_content[0].encode(script_content[1])

        # Detect Encoding
        #text_encode_dict = chardet.detect(b_content)
        #normal_encode_dict = from_bytes(b_content).best()

        # Encode base64
        e_content = base64.b64encode(b_content)

        rest_task.req['base64ScriptContent'] = e_content.decode(script_info['script_encode'])

    if base_info['publish_id'] != '':
        rest_task.req['publishableUserId'] = base_info['publish_id']
    if base_info['description'] != '':
        rest_task.req['description'] = base_info['description']

    if len(target_list) != 0:
        rest_task.req['targetList'] = []

    for idx, node_set in enumerate(target_list):
        node_set_str = ''
        if node_set.get('hostname') != '':
            node_set_str += ',HOSTNAME:\"' + node_set['hostname'] + '\"'
        if node_set.get('osType') != '':
            node_set_str += ',OS-TYPE:\"' + node_set['osType'] + '\"'
        if node_set.get('osName') != '':
            node_set_str += ',OS-NAME:\"' + node_set['osName'] + '\"'
        if node_set.get('osVersion') != '':
            node_set_str += ',OS-VER:\"' + node_set['osVersion'] + '\"'
        if not (node_set.get('tag') is None or node_set.get('tag') == ""):
            for key, val in node_set.get('tag').items():
                if not (val is None or val == ""):
                    node_set_str += ',' + key + ':\"' + val + '\"'  ## 맨 앞 CT. 걷어낸 곳

        rest_task.req['targetList'].append({'nodeSet': node_set_str[1:],  # 좌측 , 제거
                                            'account': node_set.get('account'),
                                            'description': node_set.get('description')})

    if len(schedule_list) != 0:
        rest_task.req['scheduleList'] = schedule_list
    if len(runnable_time_list) != 0:
        rest_task.req['runnableTimeList'] = runnable_time_list

    if len(trigger_list) != 0:
        rest_task.req['trigList'] = []

    for idx, trigger in enumerate(trigger_list):
        # Sample Data
        # - result="success"
        # - result="success" after="5m"
        condition_str = ''
        if trigger.get('taskResult') is not None:
            condition_str += 'result=\"' + trigger['taskResult'] + '\"'
        if not (trigger.get('time') is None or trigger.get('time') == ''):
            if trigger.get('timeUnit') is None or trigger.get('timeUnit') == '':
                current_app.logger.error("[{0}] {1}".format(OpmmResultCode.EM1003, "time or timeUnit is None"))
                return jsonify({'result': 'Fail'}), 500

            condition_str += ' after=\"' + trigger['time'] + trigger['timeUnit'] + '\"'
        rest_task.req['trigList'].append({'taskId': trigger['taskId'], 'condition': condition_str})

    if len(permission_list) != 0:
        rest_task.req['permissionList'] = permission_list
    if len(notilist_list) != 0:
        rest_task.req['notiList'] = notilist_list

    # Step 3-2. REST Call : get
    if rest_mode == 'POST':  # POST
        result = rest_task.post(url)
    else:  # PUT
        result = rest_task.put(url)

    if not result:
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    if rest_task.res['resultCode'] != OpmmResultCode.EM0000:
        current_app.logger.error("[{0}] {1}".format(rest_task.res['resultCode'], rest_task.res['resultMsg']))

    # Step 3-4. REST Call : Output Process
    # 저장된 태스크 ID를 응답에 추가 (발행을 위해 필요)
    if 'id' in rest_task.res:
        task_id = rest_task.res['id']
    elif rest_mode == 'PUT' and task_id:
        # 수정 모드인 경우 요청의 task_id 사용
        rest_task.res['id'] = task_id
    elif 'id' in rest_task.req:
        # 생성 모드인 경우 요청의 id 사용
        rest_task.res['id'] = rest_task.req['id']

    # Step 99. Response Data Formatting
    return jsonify(rest_task.res)


@bp.route('/del', methods=['POST'])
@login_required
def del_task_list():
    """
    태스크 정보 삭제 요청
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()
    id_list = req['id_list']

    result = []
    for task_id in id_list:
        result.append(del_task(task_id))

    return jsonify(result)


def del_task(task_id):
    """
    태스크 목록에서 task_id에 해당하는 항목 삭제
    :param task_id:
    :return:
    """
    # Step 3. REST Call
    rest_task = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/tasks/' + task_id

    # Step 3-2. REST Call : delete
    if not rest_task.delete(url):
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    if rest_task.res['resultCode'] != OpmmResultCode.EM0000:
        msg = "Failed to delete task.({0}) : {1} - {2}".format(task_id,
                                                               rest_task.res['resultCode'],
                                                               rest_task.res['resultMsg'])
        current_app.logger.error(msg)
    else:
        current_app.logger.info(task_id)

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return {'id': task_id,
            'resultCode': rest_task.res['resultCode'],
            'resultMsg': rest_task.res['resultMsg']}


@bp.route('/publish', methods=['POST'])
@login_required
def request_task_publish():
    """
    태스크 발행
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()
    task_id = req['id']
    # OPMM TCS 활성화 여부 yes : 활성화, no : 비활성화 추가
    tcsOtpPassCode = ''
    if 'tcsOtpPassCode' in req:
        tcsOtpPassCode = req['tcsOtpPassCode']

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call(Create&Edit Usergrp)
    rest_task = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/tasks/' + task_id + '?mode=publish'
    # OPMM TCS 활성화 여부 yes : 활성화, no : 비활성화 추가
    opmm_tcs_verify_enable = current_app.config[
        'OPMM_TCS_VERIFY_ENABLE']

    if  opmm_tcs_verify_enable == 'yes':
        rest_task.req = {'tcsOtpPassCode': tcsOtpPassCode}

    # Step 3-2. REST Call : get
    result = rest_task.put(url)

    if not result:
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    if rest_task.res['resultCode'] != OpmmResultCode.EM0000:
        current_app.logger.error("[{0}] {1}".format(rest_task.res['resultCode'], rest_task.res['resultMsg']))

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return jsonify(rest_task.res)


@bp.route('/discard', methods=['POST'])
@login_required
def request_task_discard():
    """
    태스크 폐기
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()
    task_id = req['id']

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call(Create&Edit Usergrp)
    rest_task = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/tasks/' + task_id + '?mode=discard'

    # Step 3-2. REST Call : get
    result = rest_task.put(url)

    if not result:
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    if rest_task.res['resultCode'] != OpmmResultCode.EM0000:
        current_app.logger.error("[{0}] {1}".format(rest_task.res['resultCode'], rest_task.res['resultMsg']))

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return jsonify(rest_task.res)

# OPMM TCS 활성화 여부 yes : 활성화, no : 비활성화 추가
@bp.route('/p_tcsotp', methods=['GET'])
@login_required
def p_login():

    return render_template('task/popup/popup_otp.html')


# @bp.route('/get_mode', methods=['POST'])
# @login_required
def get_task_mode(task_id):
    """
    태스크 모드(권한) 조회.
    :return: string ('rwx', '---')
    """
    # Step 1. Request Data Parsing.

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call(Create&Edit Usergrp)
    rest_task = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/tasks/' + task_id
    rest_task.req = {'mode': 'perm', 'userId': session['login_info']['user_id']}

    # Step 3-2. REST Call : get
    result = rest_task.get(url)

    if not result:
        return False

    # Step 3-3. REST Call : Check Biz. Exception
    if rest_task.res['resultCode'] != OpmmResultCode.EM0000:
        current_app.logger.error("[{0}] {1}".format(rest_task.res['resultCode'], rest_task.res['resultMsg']))
        return False

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return True, rest_task.res['mode']


def get_time_mode(time_str):
    """
    시간 정보 문자열을 통해서 mode 값을 return.
    :param time_str:
    :return: mode
    """
    data1 = time_str.split(" ")

    if len(data1) == 2:
        if len(data1[0]) == 5:
            return 'Yearly'
        elif len(data1[0]) == 2:
            return 'Monthly'
        elif len(data1[0]) == 3:
            return 'Weekly'
        elif len(data1[0]) == 10:
            return 'Once'
        else:
            return
    elif len(data1) == 1:
        if len(data1[0]) == 5:
            return 'Daily'
        elif len(data1[0]) == 2:
            return 'Hourly'
        else:
            return
    else:
        return


loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)

@bp.route('/chat/stream', methods=['GET', 'POST'])
@login_required
def request_task_chat_async():
    """
    태스크 채팅 (비동기 스트리밍)
    LangGraph.js와 연동되는 실시간 응답 스트리밍
    :return: Server-Sent Events stream
    """
   
    # Step 1. Request Data Parsing
    if request.method == 'GET':
        taskact = request.args.get("taskact", "")
        user_message = request.args.get("message", "")
        session_id = request.args.get("session_id", "")
        convert_script = convert(request.args.get("script_content", ""))
        script_content = convert_script[0]
        session_data = {}  # GET 요청에서는 세션 데이터 없음
        chat_mode = request.args.get("chat_mode", "agent")  # 기본값은 "agent"
    else:  # POST
        req = request.get_json()
        print("POST request received:", req)
        taskact = req.get("taskact", "")
        user_message = req.get("message", "")
        session_id = req.get("session_id", "")
        convert_script = convert(req.get("script_content", ""))
        script_content = convert_script[0]

        # 세션 데이터 (태스크 생성 워크플로우 상태 유지)
        session_data = req.get("session_data", {})
        
        # 채팅 모드 받기
        chat_mode = req.get("chat_mode", "agent")  # 기본값은 "agent"
        print(f"chat_mode: {chat_mode}")
    
    
    if not user_message:
        return Response(
            "data: " + json.dumps({
                "type": "error", 
                "message": "메시지가 필요합니다.",
                "timestamp": asyncio.get_event_loop().time() if asyncio._get_running_loop() else 0
            }) + "\n\n",
            mimetype='text/event-stream'
        )
    
    # Flask 컨텍스트 정보를 제너레이터 실행 전에 저장
    # (제너레이터 내부에서는 current_app에 접근할 수 없음)
    set_flask_context_info(
        config=dict(current_app.config),
        session_info=dict(session)
    )
    print(f"[request_task_chat_async] Flask 컨텍스트 저장 완료")
    
    def generate_async_stream():
        """비동기 스트리밍 응답 생성기"""
        # 외부 변수를 함수 시작 부분에서 명시적으로 참조
        nonlocal taskact, user_message, session_id, script_content, session_data

        # 채팅 로그 저장을 위한 응답 수집 변수
        collected_responses = []

        # Step 2. 초기 연결 확인 신호
        yield "data: " + json.dumps({
            "type": "connected",
            "session_id": session_id,
            "timestamp": asyncio.get_event_loop().time() if asyncio._get_running_loop() else 0
        }) + "\n\n"

        # Step 3. 워크플로우 시작 신호
        yield "data: " + json.dumps({
            "type": "workflow_start",
            "step": "analyze_request",
            "progress": 10,
            "message": "요청 분석 중...",
            "timestamp": asyncio.get_event_loop().time() if asyncio._get_running_loop() else 0
        }) + "\n\n"

        # Step 4. Initialize workflow state
        info = []
        info.append({"taskact": taskact})

        # 세션 초기화 요청 확인
        if user_message == "__CLEAR_SESSION__":
            print(f"[task.py] 세션 초기화 요청 수신")

            # 세션 데이터 초기화
            session_data.clear()
            session_data["chat_mode"] = chat_mode  # 현재 모드는 유지

            # 성공 응답
            yield "data: " + json.dumps({
                "type": "session_cleared",
                "message": "세션이 초기화되었습니다.",
                "timestamp": asyncio.get_event_loop().time() if asyncio._get_running_loop() else 0
            }) + "\n\n"

            # 완료 신호
            yield "data: " + json.dumps({
                "type": "done",
                "timestamp": asyncio.get_event_loop().time() if asyncio._get_running_loop() else 0
            }) + "\n\n"

            print(f"[task.py] 세션 초기화 완료")
            return

        messages = [user_message]

        # 세션 데이터의 script_content를 우선 사용 (워크플로우 상태 유지를 위해)
        effective_script_content = session_data.get("script_content", "") or script_content

        # 이전 모드와 현재 모드 확인
        previous_chat_mode = session_data.get("chat_mode", "")
        is_mode_changed = previous_chat_mode and previous_chat_mode != chat_mode
        
        print(f"[Mode Change Detection] Previous mode: {previous_chat_mode}, Current mode: {chat_mode}, Changed: {is_mode_changed}")
        
        # 모드가 변경된 경우 원래 모드의 워크플로우 상태를 저장
        if is_mode_changed:
            print(f"[Mode Change] Saving previous workflow state for mode: {previous_chat_mode}")
            # 이전 모드의 워크플로우 상태를 별도로 저장
            session_data[f"previous_{previous_chat_mode}_state"] = {
                "task_name": session_data.get("task_name", ""),
                "task_requirements": session_data.get("task_requirements", ""),
                "os_type": session_data.get("os_type", "linux"),
                "workflow_step": session_data.get("workflow_step", ""),
                "modification_request": session_data.get("modification_request", ""),
                "script_content": session_data.get("script_content", ""),
                "script_description": session_data.get("script_description", ""),
                "target_nodes": session_data.get("target_nodes", {}),
                "search_results": session_data.get("search_results", []),
                "selected_nodes": session_data.get("selected_nodes", [])
            }

        # 디버깅: session_data에서 search_results 확인
        search_results_from_session = session_data.get("search_results", [])
        print(f"[task.py] session_data에서 search_results 받음: {len(search_results_from_session)}개")
        
        existing_task_id = session_data.get("existing_task_id") or session_data.get("task_id", "")

        initial_state: AgentState = {
            "messages": messages,
            "user_message": user_message,
            "script_content": effective_script_content,
            "next": "FINISH",
            "search_count": 0,
            "node_count": 0,
            "task_id": existing_task_id,
            "result_msg": "",
            # 태스크 생성 워크플로우 상태
            "task_name": session_data.get("task_name", ""),
            "task_requirements": session_data.get("task_requirements", ""),
            "os_type": session_data.get("os_type", "linux"),
            "workflow_step": session_data.get("workflow_step", ""),
            "modification_request": session_data.get("modification_request", ""),
            # 노드 검색 결과
            "search_results": search_results_from_session,
            "selected_nodes": session_data.get("selected_nodes", []),
            # 세션 데이터 (검색 결과 노드 데이터 등 포함)
            "session_data": session_data.copy(),
            # 채팅 모드
            "chat_mode": chat_mode,
            # 모드 변경 정보
            "previous_chat_mode": previous_chat_mode,
            "is_mode_changed": is_mode_changed
        }
        
        print(f"[task.py] initial_state에 search_results 설정: {len(initial_state['search_results'])}개")
        
        # Step 5. Select appropriate graph
        task_graph = build_graph()
        
        # Step 6. 워크플로우 실행 진행률 업데이트
        yield "data: " + json.dumps({
            "type": "workflow_progress",
            "step": "executing",
            "progress": 50,
            "message": "AI 모델 처리 중...",
            "timestamp": asyncio.get_event_loop().time() if asyncio._get_running_loop() else 0
        }) + "\n\n"
        
        config=RunnableConfig(
                recursion_limit= 10,
                thread_id=uuid.uuid4(),
            )
        
        # Step 7. async generator를 동기적으로 처리  
        # 안전한 이벤트 루프 설정
        
        loop = setup_nested_event_loop()
        
        async_gen = None
        try:
            """
            async_gen = task_graph.astream(
                {"messages": [HumanMessage(content=user_message)]}, 
                config, 
                stream_mode="updates"
            )
            """
            # SafeAsyncGenerator로 래핑
            raw_async_gen = task_graph.astream(
                initial_state, 
                config, 
                stream_mode="updates"
            )
            async_gen = SafeAsyncGenerator(raw_async_gen)
            
            final_content = ""
            sent_messages = set()  # 이미 전송된 메시지 내용을 추적
            current_session_data = {"chat_mode": chat_mode}  # 현재 세션 데이터 추적 (chat_mode 포함)


            while True:
                try:
                    chunk = loop.run_until_complete(async_gen.__anext__())

                    if isinstance(chunk, dict):
                        for node_name, node_chunk in chunk.items():
                            # Extract content from node_chunk if it's a dict
                            if isinstance(node_chunk, dict):
                                # Try to get content from various possible keys
                            
                                if 'messages' in node_chunk and node_chunk['messages']:
                                    for msg in node_chunk['messages']:
                                        if isinstance(msg, ToolMessage):
                                            
                                            # ToolMessage의 content를 안전하게 추출
                                            tool_content = ""
                                            structured_content = None
                                            
                                            if hasattr(msg, 'content'):
                                                msg_content = msg.content
                                                if isinstance(msg_content, (dict, list)):
                                                    # 구조화된 데이터인 경우 JSON으로 처리
                                                    tool_content = safe_json_dumps(msg_content)
                                                    structured_content = msg_content
                                                else:
                                                    tool_content = str(msg_content)
                                            elif hasattr(msg, 'artifact'):
                                                artifact = msg.artifact
                                                if isinstance(artifact, (dict, list)):
                                                    tool_content = safe_json_dumps(artifact)
                                                    structured_content = artifact
                                                else:
                                                    tool_content = str(artifact)
                                            else:
                                                tool_content = str(msg)
                                            
                                            # task_created 이벤트 전송
                                            if node_name == "task":
                                                event_data = {
                                                    "type": "task_created",
                                                    "content": tool_content,
                                                    "timestamp": asyncio.get_event_loop().time() if asyncio._get_running_loop() else 0
                                                }
                                                
                                                # 구조화된 데이터가 있으면 추가
                                                if structured_content:
                                                    event_data["structuredContent"] = structured_content
                                                
                                                yield "data: " + safe_json_dumps(event_data) + "\n\n"
                                                
                                content = ""
                                if 'messages' in node_chunk and node_chunk['messages']:
                                    last_message = node_chunk['messages'][-1]
                                    if hasattr(last_message, 'content'):
                                        content = last_message.content
                                    elif isinstance(last_message, dict) and 'content' in last_message:
                                        content = last_message['content']
                                       
                                elif 'content' in node_chunk:
                                    content = node_chunk['content']
                                else:
                                    # 안전한 JSON 직렬화 사용
                                    content = safe_json_dumps(node_chunk, ensure_ascii=False)
                            else:
                                content = str(node_chunk)
                            

                            # 세션 데이터 업데이트 (태스크 생성 워크플로우 상태)
                            if 'task_name' in node_chunk:
                                current_session_data['task_name'] = node_chunk['task_name']
                            if 'task_requirements' in node_chunk:
                                current_session_data['task_requirements'] = node_chunk['task_requirements']
                            if 'os_type' in node_chunk:
                                current_session_data['os_type'] = node_chunk['os_type']
                            if 'workflow_step' in node_chunk:
                                current_session_data['workflow_step'] = node_chunk['workflow_step']
                            if 'modification_request' in node_chunk:
                                current_session_data['modification_request'] = node_chunk['modification_request']
                            if 'script_content' in node_chunk:
                                current_session_data['script_content'] = node_chunk['script_content']
                            if 'script_description' in node_chunk:
                                current_session_data['script_description'] = node_chunk['script_description']
                            if 'target_nodes' in node_chunk:
                                current_session_data['target_nodes'] = node_chunk['target_nodes']
                            if 'search_results' in node_chunk:
                                current_session_data['search_results'] = node_chunk['search_results']
                                print(f"[task.py] search_results를 session_data에 추가: {len(node_chunk['search_results'])}개")
                            if 'selected_nodes' in node_chunk:
                                current_session_data['selected_nodes'] = node_chunk['selected_nodes']
                                print(f"[task.py] selected_nodes를 session_data에 추가: {len(node_chunk['selected_nodes'])}개")
                            
                            # session_data가 있는 경우 모든 키를 복사
                            if 'session_data' in node_chunk and isinstance(node_chunk['session_data'], dict):
                                for key, value in node_chunk['session_data'].items():
                                    current_session_data[key] = value
                                    if key == 'search_result_nodes':
                                        print(f"[task.py] search_result_nodes를 session_data에 추가: {len(value)}개")
                            
                            print(f"[task.py] current_session_data keys: {list(current_session_data.keys())}")
                            
                            # result_msg 디버깅
                            result_msg = node_chunk.get('result_msg', '')
                            print(f"[task.py] 현재 result_msg: {result_msg}")
                            print(f"[task.py] nodes_to_add 존재 여부: {'nodes_to_add' in node_chunk}")
                            if 'nodes_to_add' in node_chunk:
                                print(f"[task.py] nodes_to_add 개수: {len(node_chunk.get('nodes_to_add', []))}")

                            # 태스크 저장 요청 처리
                            if node_chunk.get('result_msg') == 'SAVE_TASK':
                                print(f"[task.py] SAVE_TASK 이벤트 생성")

                                # 태스크 저장 이벤트 전송
                                save_event = {
                                    "type": "save_task",
                                    "timestamp": asyncio.get_event_loop().time() if asyncio._get_running_loop() else 0
                                }

                                print(f"[task.py] 전송할 save_event: {safe_json_dumps(save_event)}")
                                yield "data: " + safe_json_dumps(save_event) + "\n\n"

                            # 태스크 등록 요청 처리
                            if node_chunk.get('result_msg') == 'REGISTER_TASK':
                                task_name = node_chunk.get('task_name', '')
                                script_content = node_chunk.get('script_content', '')
                                script_description = node_chunk.get('script_description', '')
                                os_type = node_chunk.get('os_type', 'linux')
                                target_nodes = node_chunk.get('target_nodes', {})

                                print(f"[task.py] REGISTER_TASK 이벤트 생성")
                                print(f"[task.py] task_name: {task_name}")
                                print(f"[task.py] script_description: {script_description}")
                                print(f"[task.py] os_type: {os_type}")
                                print(f"[task.py] script_content 길이: {len(script_content)}")
                                print(f"[task.py] target_nodes: {target_nodes}")

                                # script_content가 ```bash 또는 ```powershell로 감싸져 있으면 추출
                                import re
                                if script_content:
                                    if '```bash' in script_content:
                                        match = re.search(r'```bash\s*\n(.*?)```', script_content, re.DOTALL)
                                        if match:
                                            script_content = match.group(1).strip()
                                    elif '```powershell' in script_content:
                                        match = re.search(r'```powershell\s*\n(.*?)```', script_content, re.DOTALL)
                                        if match:
                                            script_content = match.group(1).strip()

                                # 태스크 등록 이벤트 전송
                                register_event = {
                                    "type": "register_task",
                                    "task_name": task_name,
                                    "script_content": script_content,
                                    "script_description": script_description,
                                    "os_type": os_type,
                                    "target_nodes": target_nodes,
                                    "timestamp": asyncio.get_event_loop().time() if asyncio._get_running_loop() else 0
                                }

                                print(f"[task.py] 전송할 이벤트: {safe_json_dumps(register_event)[:200]}...")
                                yield "data: " + safe_json_dumps(register_event) + "\n\n"
                            
                            # 태스크 등록과 노드 추가 함께 처리
                            if node_chunk.get('result_msg') == 'REGISTER_TASK_WITH_NODES':
                                task_name = node_chunk.get('task_name', '')
                                script_content = node_chunk.get('script_content', '')
                                script_description = node_chunk.get('script_description', '')
                                os_type = node_chunk.get('os_type', 'linux')
                                target_nodes = node_chunk.get('target_nodes', {})
                                nodes_to_add = node_chunk.get('nodes_to_add', [])

                                print(f"[task.py] REGISTER_TASK_WITH_NODES 이벤트 생성")
                                print(f"[task.py] task_name: {task_name}")
                                print(f"[task.py] script_description: {script_description}")
                                print(f"[task.py] os_type: {os_type}")
                                print(f"[task.py] script_content 길이: {len(script_content)}")
                                print(f"[task.py] nodes_to_add 개수: {len(nodes_to_add)}")

                                # script_content가 ```bash 또는 ```powershell로 감싸져 있으면 추출
                                import re
                                if script_content:
                                    if '```bash' in script_content:
                                        match = re.search(r'```bash\s*\n(.*?)```', script_content, re.DOTALL)
                                        if match:
                                            script_content = match.group(1).strip()
                                    elif '```powershell' in script_content:
                                        match = re.search(r'```powershell\s*\n(.*?)```', script_content, re.DOTALL)
                                        if match:
                                            script_content = match.group(1).strip()

                                # 태스크 등록 이벤트 전송
                                register_event = {
                                    "type": "register_task",
                                    "task_name": task_name,
                                    "script_content": script_content,
                                    "script_description": script_description,
                                    "os_type": os_type,
                                    "target_nodes": target_nodes,
                                    "timestamp": asyncio.get_event_loop().time() if asyncio._get_running_loop() else 0
                                }

                                print(f"[task.py] 전송할 register_event: {safe_json_dumps(register_event)[:200]}...")
                                yield "data: " + safe_json_dumps(register_event) + "\n\n"
                                
                                # 노드 추가 이벤트 전송
                                if nodes_to_add:
                                    # 노드 데이터 디버깅
                                    if len(nodes_to_add) > 0:
                                        print(f"[task.py] 첫 번째 노드 샘플: {nodes_to_add[0]}")
                                        print(f"[task.py] 노드 필드명: {list(nodes_to_add[0].keys()) if isinstance(nodes_to_add[0], dict) else 'not dict'}")
                                    
                                    add_nodes_event = {
                                        "type": "add_nodes",
                                        "nodes": nodes_to_add,
                                        "timestamp": asyncio.get_event_loop().time() if asyncio._get_running_loop() else 0
                                    }
                                    
                                    print(f"[task.py] 전송할 add_nodes_event: {len(nodes_to_add)}개 노드")
                                    yield "data: " + safe_json_dumps(add_nodes_event) + "\n\n"

                            # 태스크 등록과 노드 추가 확인 완료 처리
                            if node_chunk.get('result_msg') == 'REGISTER_TASK_WITH_NODES_CONFIRMED':
                                task_name = node_chunk.get('task_name', '')
                                script_content = node_chunk.get('script_content', '')
                                script_description = node_chunk.get('script_description', '')
                                os_type = node_chunk.get('os_type', 'linux')
                                target_nodes = node_chunk.get('target_nodes', {})
                                nodes_to_add = node_chunk.get('nodes_to_add', [])

                                print(f"[task.py] REGISTER_TASK_WITH_NODES_CONFIRMED 이벤트 생성")
                                print(f"[task.py] task_name: {task_name}")
                                print(f"[task.py] nodes_to_add 개수: {len(nodes_to_add)}")

                                # script_content가 ```bash 또는 ```powershell로 감싸져 있으면 추출
                                import re
                                if script_content:
                                    if '```bash' in script_content:
                                        match = re.search(r'```bash\s*\n(.*?)```', script_content, re.DOTALL)
                                        if match:
                                            script_content = match.group(1).strip()
                                    elif '```powershell' in script_content:
                                        match = re.search(r'```powershell\s*\n(.*?)```', script_content, re.DOTALL)
                                        if match:
                                            script_content = match.group(1).strip()

                                # 태스크 등록 이벤트 전송 (확인 메시지 없이)
                                register_event = {
                                    "type": "register_task_confirmed",
                                    "task_name": task_name,
                                    "script_content": script_content,
                                    "script_description": script_description,
                                    "os_type": os_type,
                                    "target_nodes": target_nodes,
                                    "timestamp": asyncio.get_event_loop().time() if asyncio._get_running_loop() else 0
                                }

                                print(f"[task.py] 전송할 register_task_confirmed 이벤트")
                                yield "data: " + safe_json_dumps(register_event) + "\n\n"

                                # 노드 추가 이벤트 전송
                                if nodes_to_add:
                                    add_nodes_event = {
                                        "type": "add_nodes",
                                        "nodes": nodes_to_add,
                                        "timestamp": asyncio.get_event_loop().time() if asyncio._get_running_loop() else 0
                                    }

                                    print(f"[task.py] 전송할 add_nodes_event: {len(nodes_to_add)}개 노드")
                                    yield "data: " + safe_json_dumps(add_nodes_event) + "\n\n"

                            # 스케줄 정보 준비 완료 처리
                            if node_chunk.get('result_msg') == 'SCHEDULE_INFO_READY':
                                schedule_info = node_chunk.get('schedule_info', {})
                                
                                print(f"[task.py] ===== SCHEDULE_INFO_READY 이벤트 생성 =====")
                                print(f"[task.py] schedule_info: {schedule_info}")
                                print(f"[task.py] schedule_info type: {type(schedule_info)}")
                                print(f"[task.py] schedule_info keys: {schedule_info.keys() if isinstance(schedule_info, dict) else 'not dict'}")
                                
                                # 스케줄 정보 저장 이벤트 전송
                                schedule_event = {
                                    "type": "schedule_info_ready",
                                    "schedule_info": schedule_info,
                                    "timestamp": asyncio.get_event_loop().time() if asyncio._get_running_loop() else 0
                                }
                                
                                print(f"[task.py] 전송할 schedule_info_ready 이벤트: {safe_json_dumps(schedule_event)}")
                                yield "data: " + safe_json_dumps(schedule_event) + "\n\n"
                                print(f"[task.py] ===== SCHEDULE_INFO_READY 이벤트 전송 완료 =====")

                            # 검색 결과 준비 완료 처리
                            if node_chunk.get('result_msg') == 'SEARCH_RESULTS_READY':
                                nodes_to_add = node_chunk.get('nodes_to_add', [])
                                search_params = node_chunk.get('search_results', {})  # 검색 파라미터 가져오기
                                
                                print(f"[task.py] SEARCH_RESULTS_READY 이벤트 생성")
                                print(f"[task.py] nodes_to_add 개수: {len(nodes_to_add)}")
                                print(f"[task.py] search_params: {search_params}")
                                
                                # 검색 결과 저장 이벤트 전송 (프론트엔드 로컬 저장용)
                                search_results_event = {
                                    "type": "search_results_ready",
                                    "nodes": nodes_to_add,
                                    "search_params": search_params,  # 검색 파라미터 추가
                                    "timestamp": asyncio.get_event_loop().time() if asyncio._get_running_loop() else 0
                                }
                                
                                print(f"[task.py] 전송할 search_results_ready 이벤트")
                                yield "data: " + safe_json_dumps(search_results_event) + "\n\n"
                            
                            # 노드 추가 요청 처리
                            if node_chunk.get('result_msg') == 'ADD_NODES':
                                selected_nodes = node_chunk.get('selected_nodes', [])
                                search_params = node_chunk.get('search_results', {})  # 검색 파라미터 가져오기
                                
                                print(f"[task.py] ADD_NODES 이벤트 생성")
                                print(f"[task.py] selected_nodes 개수: {len(selected_nodes)}")
                                print(f"[task.py] search_params: {search_params}")
                                
                                # search_params를 노드 객체로 변환
                                # tag는 customer와 operator 값이 있을 경우만 추가
                                tag_parts = []
                                customer = search_params.get('customer', '')
                                operator = search_params.get('operator', '')
                                if customer:
                                    tag_parts.append(f"WP.customer_nm={customer}")
                                if operator:
                                    tag_parts.append(f"WP.sys_operator1_nm={operator}")
                                
                                node_from_params = {
                                    "hostnames": search_params.get('hostname', ''),
                                    "osType": search_params.get('os_type', ''),
                                    "osName": search_params.get('os_name', ''),
                                    "osVersion": search_params.get('os_version', ''),
                                    "tag": ",".join(tag_parts),
                                    "account": "",
                                    "description": ""
                                }
                                
                                # 노드 추가 이벤트 전송
                                add_nodes_event = {
                                    "type": "add_nodes",
                                    "nodes": [node_from_params],  # search_params를 노드로 변환한 값 전달
                                    "search_params": search_params,  # 원본 검색 파라미터도 함께 전달
                                    "selected_nodes": selected_nodes,  # 실제 선택된 노드 데이터도 함께 전달
                                    "timestamp": asyncio.get_event_loop().time() if asyncio._get_running_loop() else 0
                                }
                                
                                print(f"[task.py] 전송할 이벤트: {safe_json_dumps(add_nodes_event)[:200]}...")
                                yield "data: " + safe_json_dumps(add_nodes_event) + "\n\n"

                            # supervisor는 content_chunk를 보내지 않음 (라우팅만 수행)
                            # 중복 메시지 방지: 이미 전송한 메시지는 다시 보내지 않음
                            if node_name != "supervisor" and content and content.strip():
                                # 메시지 내용의 해시를 만들어서 중복 확인
                                content_hash = hash(content.strip())
                                if content_hash not in sent_messages:
                                    sent_messages.add(content_hash)

                                    # 응답 수집 (채팅 로그 저장용)
                                    collected_responses.append(content)

                                    yield "data: " + json.dumps({
                                        "type": "content_chunk",
                                        "content": content + "\n\n",
                                        "session_data": current_session_data,  # 세션 데이터 포함
                                        "timestamp": asyncio.get_event_loop().time() if asyncio._get_running_loop() else 0
                                    }) + "\n\n"
                            
                            print("chat stream result node: ", node_name)
                            #print("node_chunk", node_chunk)
                            
                            
                    # 각 청크 처리
                    """
                    if chunk and 'messages' in chunk and len(chunk['messages']) > 0:
                        last_message = chunk['messages'][-1]
                        if hasattr(last_message, 'content') and last_message.content:
                            final_content = last_message.content
                            
                            # 콘텐츠 청크 전송
                            yield "data: " + json.dumps({
                                "type": "content_chunk",
                                "content": last_message.content,
                                "timestamp": asyncio.get_event_loop().time() if asyncio._get_running_loop() else 0
                            }) + "\n\n"
                    """
                except StopAsyncIteration:
                    break
                    
        except Exception as e:
            print(f"Error in generate_async_stream: {e}")
            traceback.print_exc()
            yield "data: " + json.dumps({
                "type": "error",
                "message": f"처리 중 오류가 발생했습니다: {str(e)}"
            }) + "\n\n"
        finally:
            # async generator 정리
            if async_gen is not None:
                try:
                    # async generator가 아직 활성화된 경우에만 닫기
                    if hasattr(async_gen, 'aclose') and not loop.is_closed():
                        loop.run_until_complete(async_gen.aclose())
                except Exception as e:
                    print(f"Error closing async generator: {e}")
            
            # event loop 정리
            try:
                # 루프가 실행 중이고 닫히지 않은 경우에만 정리
                if not loop.is_closed():
                    # 실행 중인 태스크들 확인
                    try:
                        pending = asyncio.all_tasks(loop)
                        if pending:
                            # 태스크들을 취소하고 정리
                            for task in pending:
                                task.cancel()
                            # 취소된 태스크들이 완료될 때까지 대기
                            loop.run_until_complete(
                                asyncio.gather(*pending, return_exceptions=True)
                            )
                    except Exception as e:
                        print(f"Error cancelling tasks: {e}")
                    
                    # 루프 닫기
                    if not loop.is_running():
                        loop.close()
            except Exception as e:
                print(f"Error closing event loop: {e}")
        
        # Step 8. 워크플로우 완료
        # 채팅 로그 저장 (세션 초기화 요청이 아닌 경우에만)
        if user_message != "__CLEAR_SESSION__":
            # 수집된 응답을 하나의 문자열로 결합
            system_response = "\n\n".join(collected_responses) if collected_responses else final_content or "처리가 완료되었습니다."

            # 채팅 로그 저장
            save_chat_log(
                session_id=session_id,
                user_message=user_message,
                system_response=system_response,
                chat_mode=chat_mode
            )

        # 모드 변경 정보 포함
        complete_event = {
            "type": "workflow_complete",
            "step": "completed",
            "progress": 100,
            "message": "처리 완료",
            "final_content": final_content or "처리가 완료되었습니다.",
            "chat_mode": chat_mode,
            "previous_chat_mode": previous_chat_mode if 'previous_chat_mode' in locals() else "",
            "is_mode_changed": is_mode_changed if 'is_mode_changed' in locals() else False,
            "session_data": current_session_data,  # 세션 데이터 포함
            "timestamp": asyncio.get_event_loop().time() if asyncio._get_running_loop() else 0
        }

        # 모드가 변경되었고 이전 모드의 상태가 저장되어 있으면 복원 정보 포함
        if is_mode_changed and previous_chat_mode:
            previous_state_key = f"previous_{previous_chat_mode}_state"
            if previous_state_key in session_data:
                complete_event["can_restore_previous_mode"] = True
                complete_event["previous_mode"] = previous_chat_mode
                print(f"[Workflow Complete] Previous mode state exists: {previous_chat_mode}")

        yield "data: " + json.dumps(complete_event) + "\n\n"
            
    
    # Step 13. Server-Sent Events 응답 반환
    return Response(
        generate_async_stream(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'X-Accel-Buffering': 'no'  # Nginx buffering 비활성화
        }
    )
