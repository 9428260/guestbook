from flask import Blueprint, request, jsonify, current_app

from app.common.render import Render
from app.interface.constants import OpmmResultCode
from app.interface.restclient import RestClient
from app.user import login_required

bp = Blueprint('usergrp', __name__)


@bp.route('/', methods=['GET'])
@login_required
def render_page():
    """
    사용자그룹 목록 화면
    :return:
    """
    return Render.render_template('user/usergrp_lst.html')


@bp.route('/', methods=['POST'])
@login_required
def render_page_with_param():
    """
    사용자그룹 목록 화면
    :return:
    """
    return Render.render_template('user/usergrp_lst.html', request_params=request.form)


@bp.route('/list', methods=['POST'])
@login_required
def request_usergrp_list():
    """
    사용자그룹 목록 요청
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()

    usergrp_id = req['usergrp_id']
    owner_id = req['owner_id']
    offset = (req['page'] - 1) * req['perPage']
    limit = req['perPage']

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call
    rest_usergrp = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/user-groups'
    query_string = ''
    field_string = 'ownerUserName,description'

    if usergrp_id != '':
        query_string = ',id=' + usergrp_id
    if owner_id != '':
        query_string += ',owner=' + owner_id

    rest_usergrp.req = {'query': query_string[1:],  # 좌측 ',' 제거
                        'field': field_string,
                        'limit': limit,
                        'offset': offset}

    # Step 3-2. REST Call : get
    if not rest_usergrp.get(url):
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    # NOT_FOUND
    if rest_usergrp.res['resultCode'] == OpmmResultCode.EM1002:
        rest_usergrp.res['userGroupList'] = []
        rest_usergrp.res['totalCnt'] = 0

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return jsonify(rest_usergrp.res)


@bp.route('/dupchk', methods=['POST'])
@login_required
def duplicate_check_id():
    """
    사용자그룹 정보를 가져온다.
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()
    usergroup_id = req['id']

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call
    rest_usergrp = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/user-groups/' + usergroup_id

    # Step 3-2. REST Call : get
    if not rest_usergrp.get(url):
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    # NOT_FOUND
    if rest_usergrp.res['resultCode'] == OpmmResultCode.EM1002:
        current_app.logger.error("[{0}] {1}".format(rest_usergrp.res['resultCode'], rest_usergrp.res['resultMsg']))

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return jsonify(rest_usergrp.res)


@bp.route('/dtl', methods=['POST'])
@login_required
def request_usergrp():
    """
    사용자그룹 정보를 가져온다.
    :return:
    """
    is_ajax = True  # True: Ajax Call, False: Normal POST Call

    # Step 1. Request Data Parsing.
    if request.form.get('usergrp_id') is None:
        req = request.get_json()

        usergroup_id = req['usergrp_id']

        if usergroup_id is None or usergroup_id == '':
            current_app.logger.error("[{0}] {1}".format(OpmmResultCode.EM0999, "Usergroup ID not found."))
            return jsonify({'result': 'Fail'}), 500
    else:
        is_ajax = False
        usergroup_id = request.form.get('usergrp_id')

        if usergroup_id is None or usergroup_id == '':  # create
            return Render.render_template('user/usergrp_dtl.html',
                                          request_params=request.form)

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call
    rest_usergrp = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/user-groups/' + usergroup_id

    # Step 3-2. REST Call : get
    if not rest_usergrp.get(url):
        error_map = {'resultCode': OpmmResultCode.EM0999,
                     'resultMsg': 'Internal Error'}

        if is_ajax is True:
            return jsonify(error_map)

        return Render.render_template('user/usergrp_lst.html',
                                      request_params=request.form,
                                      response=error_map)

    # Step 3-3. REST Call : Check Biz. Exception
    # NOT NORMAL
    if rest_usergrp.res['resultCode'] != OpmmResultCode.EM0000:
        current_app.logger.error("[{0}] {1}".format(rest_usergrp.res['resultCode'], rest_usergrp.res['resultMsg']))

        if is_ajax is True:
            return jsonify(rest_usergrp.res)

        return Render.render_template('user/usergrp_lst.html',
                                      request_params=request.form,
                                      response=rest_usergrp.res)

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    if is_ajax is True:
        return jsonify(rest_usergrp.res)

    return Render.render_template('user/usergrp_dtl.html',
                                  request_params=request.form,
                                  response=rest_usergrp.res)


@bp.route('/save', methods=['POST'])
@login_required
def request_usergrp_save():
    """
    사용자그룹 저장
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()

    usergrp_id = req['usergrp_id']
    base_info = req['base_info']
    member_list = req['member_list']
    rest_mode = 'POST'  # CREATE
    if usergrp_id != '':
        rest_mode = 'PUT'  # EDIT

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call(Create&Edit Usergrp)
    rest_usergrp = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/user-groups'
    if rest_mode == 'PUT':
        url = '/user-groups/' + usergrp_id

    if base_info['usergrp_id'] != '':
        rest_usergrp.req['id'] = base_info['usergrp_id']
    if rest_mode == 'PUT' and base_info['owner_id'] != '':
        rest_usergrp.req['ownerUserId'] = base_info['owner_id']
    if base_info['description'] != '':
        rest_usergrp.req['description'] = base_info['description']
    if len(member_list) != 0:
        rest_usergrp.req['memberUserIdList'] = member_list

    # Step 3-2. REST Call : get
    if rest_mode == 'POST':  # POST
        result = rest_usergrp.post(url)
    else:  # PUT
        result = rest_usergrp.put(url)

    if not result:
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    if rest_usergrp.res['resultCode'] != OpmmResultCode.EM0000:
        current_app.logger.error("[{0}] {1}".format(rest_usergrp.res['resultCode'], rest_usergrp.res['resultMsg']))

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return jsonify(rest_usergrp.res)


@bp.route('/del', methods=['POST'])
@login_required
def del_usergrp_list():
    """
    사용자그룹 정보 삭제 요청
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()
    id_list = req['id_list']

    result = []
    for usergrp_id in id_list:
        result.append(del_usergrp(usergrp_id))

    return jsonify(result)


def del_usergrp(usergrp_id):
    """
    사용자그룹 목록에서 usergrp_id에 해당하는 항목 삭제
    :param usergrp_id:
    :return:
    """
    # Step 3. REST Call
    rest_usergrp = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/user-groups/' + usergrp_id

    # Step 3-2. REST Call : delete
    if not rest_usergrp.delete(url):
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    if rest_usergrp.res['resultCode'] != OpmmResultCode.EM0000:
        msg = "Failed to delete usergroup.({0}) : {1} - {2}".format(usergrp_id,
                                                                    rest_usergrp.res['resultCode'],
                                                                    rest_usergrp.res['resultMsg'])
        current_app.logger.error(msg)
    else:
        current_app.logger.info(usergrp_id)

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return {'user_id': usergrp_id,
            'resultCode': rest_usergrp.res['resultCode'],
            'resultMsg': rest_usergrp.res['resultMsg']}


@bp.route('/p_usergroup', methods=['GET'])
@login_required
def render_search_usergrp_page():
    """
    사용자그룹 조회 Popup 화면
    :return:
    """
    return Render.render_template('user/popup/popup_usergrp_lst.html')
