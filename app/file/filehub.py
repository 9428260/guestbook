from flask import Blueprint, request, jsonify, current_app

from app.common.render import Render
from app.interface.constants import OpmmResultCode
from app.interface.restclient import RestClient
from app.user import login_required

bp = Blueprint('filehub', __name__)


@bp.route('/', methods=['GET'])
@login_required
def render_page():
    """
    파일허브 목록 화면
    :return:
    """
    return Render.render_template('file/filehub_lst.html')


@bp.route('/', methods=['POST'])
@login_required
def render_page_with_param():
    """
    파일허브 목록 화면
    :return:
    """
    return Render.render_template('file/filehub_lst.html', request_params=request.form)


@bp.route('/list', methods=['POST'])
@login_required
def request_filehub_list():
    """
    파일허브 목록 요청
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()

    filehub_id = req['id']
    owner_id = req['owner_id']
    offset = (req['page'] - 1) * req['perPage']
    limit = req['perPage']

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call
    rest_filehub = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/file-hubs'
    query_string = ''

    if filehub_id != '':
        query_string = ',id=' + filehub_id
    if owner_id != '':
        query_string += ',owner=' + owner_id

    rest_filehub.req = {'query': query_string[1:],  # 좌측 ',' 제거
                        'limit': limit,
                        'offset': offset}

    # Step 3-2. REST Call : get
    if not rest_filehub.get(url):
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    # NOT_FOUND
    if rest_filehub.res['resultCode'] == OpmmResultCode.EM1002:
        rest_filehub.res['fileHubList'] = []
        rest_filehub.res['totalCnt'] = 0

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return jsonify(rest_filehub.res)


@bp.route('/dupchk', methods=['POST'])
@login_required
def duplicate_check_id():
    """
    파일허브 정보를 가져온다.
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()
    filehub_id = req['id']

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call
    rest_filehub = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/file-hubs/' + filehub_id

    # Step 3-2. REST Call : get
    if not rest_filehub.get(url):
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    # NOT_FOUND
    if rest_filehub.res['resultCode'] == OpmmResultCode.EM1002:
        current_app.logger.error("[{0}] {1}".format(rest_filehub.res['resultCode'], rest_filehub.res['resultMsg']))

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return jsonify(rest_filehub.res)


@bp.route('/dtl', methods=['POST'])
@login_required
def request_filehub():
    """
    파일허브 정보를 가져온다.
    :return:
    """
    # Step 1. Request Data Parsing.
    filehub_id = request.form.get('filehub_id')

    if filehub_id is None or filehub_id == '':  # create
        return Render.render_template('file/filehub_dtl.html',
                                      request_params=request.form)

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call
    rest_filehub = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/file-hubs/' + filehub_id

    # Step 3-2. REST Call : get
    if not rest_filehub.get(url):
        error_map = {'resultCode': OpmmResultCode.EM0999,
                     'resultMsg': 'Internal Error'}
        return Render.render_template('file/filehub_lst.html',
                                      request_params=request.form,
                                      response=error_map)

    # Step 3-3. REST Call : Check Biz. Exception
    # NOT NORMAL
    if rest_filehub.res['resultCode'] != OpmmResultCode.EM0000:
        current_app.logger.error("[{0}] {1}".format(rest_filehub.res['resultCode'], rest_filehub.res['resultMsg']))
        return Render.render_template('file/filehub_lst.html',
                                      request_params=request.form,
                                      response=rest_filehub.res)

    # Step 3-4. REST Call : Output Process
    for idx, permission in enumerate(rest_filehub.res['permissionList']):
        rest_filehub.res['permissionList'][idx]['read'] = permission['mode'][0:1]
        rest_filehub.res['permissionList'][idx]['write'] = permission['mode'][1:2]
        rest_filehub.res['permissionList'][idx]['execute'] = permission['mode'][2:3]

    # Step 99. Response Data Formatting
    return Render.render_template('file/filehub_dtl.html',
                                  request_params=request.form,
                                  response=rest_filehub.res)


@bp.route('/save', methods=['POST'])
@login_required
def request_filehub_save():
    """
    파일허브 저장
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()

    filehub_id = req['id']
    base_info = req['base_info']
    permission_list = req['permission_list']
    rest_mode = 'POST'  # CREATE
    if filehub_id != '':
        rest_mode = 'PUT'  # EDIT

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call(Create&Edit Usergrp)
    rest_filehub = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/file-hubs'
    if rest_mode == 'PUT':
        url = '/file-hubs/' + filehub_id

    if base_info['id'] != '':
        rest_filehub.req['id'] = base_info['id']
    if rest_mode == 'PUT' and base_info['owner_id'] != '':
        rest_filehub.req['ownerUserId'] = base_info['owner_id']
    if len(permission_list) != 0:
        rest_filehub.req['permissionList'] = permission_list

    # Step 3-2. REST Call : get
    if rest_mode == 'POST':  # POST
        result = rest_filehub.post(url)
    else:  # PUT
        result = rest_filehub.put(url)

    if not result:
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    if rest_filehub.res['resultCode'] != OpmmResultCode.EM0000:
        current_app.logger.error("[{0}] {1}".format(rest_filehub.res['resultCode'], rest_filehub.res['resultMsg']))

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return jsonify(rest_filehub.res)


@bp.route('/del', methods=['POST'])
@login_required
def del_filehub_list():
    """
    파일허브 정보 삭제 요청
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()
    id_list = req['id_list']

    result = []
    for filehub_id in id_list:
        result.append(del_filehub(filehub_id))

    return jsonify(result)


def del_filehub(filehub_id):
    """
    파일허브 목록에서 filehub_id 해당하는 항목 삭제
    :param filehub_id:
    :return:
    """
    # Step 3. REST Call
    rest_filehub = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/file-hubs/' + filehub_id

    # Step 3-2. REST Call : delete
    if not rest_filehub.delete(url):
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    if rest_filehub.res['resultCode'] != OpmmResultCode.EM0000:
        msg = "Failed to delete filehub.({0}) : {1} - {2}".format(filehub_id,
                                                                  rest_filehub.res['resultCode'],
                                                                  rest_filehub.res['resultMsg'])
        current_app.logger.error(msg)
    else:
        current_app.logger.info(filehub_id)

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return {'user_id': filehub_id,
            'resultCode': rest_filehub.res['resultCode'],
            'resultMsg': rest_filehub.res['resultMsg']}


@bp.route('/p_filehub', methods=['GET'])
@login_required
def render_search_filehub_page():
    """
    파일허브 조회 Popup 화면
    :return:
    """
    return Render.render_template('file/popup/popup_filehub_lst.html')
