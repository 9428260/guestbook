import json

from flask import Blueprint, request, jsonify

from app.common.render import Render
from app.interface.constants import OpmmResultCode
from app.interface.restclient import RestClient
from app.user import login_required

bp = Blueprint('publist', __name__)


@bp.route('/', methods=['GET'])
@login_required
def render_page():
    """
    태스크 목록 리비전 화면
    :return:
    """
    return Render.render_template('task/task_hst.html')


@bp.route('/', methods=['POST'])
@login_required
def render_page_with_param():
    """
    태스크 목록 리비전 요청
    :return:
    """
    is_ajax = True  # True: Ajax Call, False: Normal POST Call

    # Step 1. Request Data Parsing.
    if request.form.get('task_id') is None:
        req = request.get_json()

        task_id = req['task_id']
        offset = (req['page'] - 1) * req['perPage']
        limit = req['perPage']
    else:
        is_ajax = False
        page = 1
        per_page = 10
        task_id = request.form.get('task_id')

        if request.form.get('page') is not None:
            page = int(request.form.get('page'))

        if request.form.get('perPage') is not None:
            per_page = int(request.form.get('perPage'))

        offset = (page - 1) * per_page
        limit = per_page

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call
    rest_task = RestClient()
    #
    # Step 3-1. REST Call : Input Binding.
    url = '/tasks/' + task_id + '/revisions'

    rest_task.req = {'limit': limit, 'offset': offset}

    # Step 3-2. REST Call : get
    if not rest_task.get(url):
        if is_ajax is True:
            return jsonify({'result': 'Fail'}), 500

        error_map = {'resultCode': OpmmResultCode.EM0999,
                     'resultMsg': 'Internal Error'}
        return Render.render_template('task/task_hst.html',
                                      request_params=request.form,
                                      response=error_map)

    # Step 3-3. REST Call : Check Biz. Exception
    # NOT_FOUND
    if rest_task.res['resultCode'] == OpmmResultCode.EM1002:
        rest_task.res['revisionList'] = []
        rest_task.res['totalCnt'] = 0

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    if is_ajax is True:
        return jsonify(rest_task.res)

    return Render.render_template('task/task_hst.html',
                                  request_params=request.form,
                                  response=json.dumps(rest_task.res, ensure_ascii=False))


@bp.route('/add_zero_rev', methods=['POST'])
@login_required
def add_zero_rev():
    """
    태스크 Revision 0 존재 시 추가 처리 - (태스크비교 대상 선택 화면 popup_task_hst_lst)
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()

    task_id = req['task_id']

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call
    # Step 3-1-1. REST Call : Input Binding.
    # rest_task2: Task 의 rev=0 확인
    rest_task2 = RestClient()
    url2 = '/tasks/' + task_id + '?revNo=0'

    # Step 3-2-1. REST Call : get
    if not rest_task2.get(url2):
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3-1. REST Call : Check Biz. Exception
    offset = (req['page'] - 1) * req['perPage']
    limit = req['perPage']

    # 미발행 있는 경우, rev0_dict 세팅
    if rest_task2.res['resultCode'] == OpmmResultCode.EM0000:
        # rev0_dict 세팅, key없을 때 터지지 않으면서 빈 값 추가 필요 -> .get으로 처리
        rev0_dict = {
            'revNo': rest_task2.res.get('revNo'),
            'id': rest_task2.res.get('id'),
            'ownerUserId': rest_task2.res.get('ownerUserId'),
            'description': rest_task2.res.get('description'),
        }

        if offset == 0:
            limit = limit - 1
        else:
            offset = offset - 1

    # Step 3-1-2. REST Call : Input Binding.
    # rest_task: Task 의 rev 목록 확인
    rest_task = RestClient()
    url = '/tasks/' + task_id + '/revisions'

    rest_task.req = {'limit': limit, 'offset': offset}

    # Step 3-2-2. REST Call : get
    # rest_task: Task 의 rev 값 목록
    if not rest_task.get(url):
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3-2. REST Call : Check Biz. Exception
    # 발행 건이 하나도 없는 경우, 빈 값 적용
    if rest_task.res['resultCode'] == OpmmResultCode.EM1002:
        rest_task.res['revisionList'] = []
        rest_task.res['currentCnt'] = 0
        rest_task.res['totalCnt'] = 0

    # 미발행 있는 경우, 첫 페이지 첫 행 추가, Count +1
    if rest_task2.res['resultCode'] == OpmmResultCode.EM0000:
        if offset == 0:
            rest_task.res['revisionList'].insert(0, rev0_dict)
        rest_task.res['currentCnt'] += 1
        rest_task.res['totalCnt'] += 1

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return jsonify(rest_task.res)

