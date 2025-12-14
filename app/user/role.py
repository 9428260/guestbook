from flask import Blueprint, request, jsonify, current_app

from app.common.render import Render
from app.interface.constants import OpmmResultCode
from app.interface.restclient import RestClient
from app.user import login_required

bp = Blueprint('role', __name__)


@bp.route('/', methods=['GET'])
@login_required
def render_page():
    """
    역할 목록 화면
    :return:
    """
    return Render.render_template('user/role_lst.html')


@bp.route('/', methods=['POST'])
@login_required
def render_page_with_param():
    """
    역할 목록 화면
    :return:
    """
    return Render.render_template('user/role_lst.html',
                                  request_params=request.form)


@bp.route('/list', methods=['POST'])
@login_required
def request_role_list():
    """
    역할 목록 요청
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()

    role_id = req['role_id']
    role_nm = req['role_nm']
    offset = (req['page'] - 1) * req['perPage']
    limit = req['perPage']

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call
    rest_role = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/roles'
    query_string = ''

    if role_id != '':
        query_string = ',id=' + role_id
    if role_nm != '':
        query_string += ',name=' + role_nm

    rest_role.req = {'query': query_string[1:],  # 좌측 ',' 제거
                     'offset': offset,
                     'limit': limit}

    # Step 3-2. REST Call : get
    if not rest_role.get(url):
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    # NOT_FOUND
    if rest_role.res['resultCode'] == OpmmResultCode.EM1002:
        rest_role.res['roleList'] = []
        rest_role.res['totalCnt'] = 0

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return jsonify(rest_role.res)


@bp.route('/dupchk', methods=['POST'])
@login_required
def duplicate_check_id():
    """
    역할 정보를 가져온다.
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()
    role_id = req['role_id']

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call
    rest_role = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/roles/' + role_id

    # Step 3-2. REST Call : get
    if not rest_role.get(url):
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    # NOT_FOUND
    if rest_role.res['resultCode'] == OpmmResultCode.EM1002:
        current_app.logger.error("[{0}] {1}".format(rest_role.res['resultCode'], rest_role.res['resultMsg']))

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return jsonify(rest_role.res)


@bp.route('/dtl', methods=['POST'])
@login_required
def request_role():
    """
    역할 정보를 가져온다.
    :return:
    """
    # Step 1. Request Data Parsing.
    role_id = request.form.get('role_id')

    if role_id is None or role_id == '':  # create
        return Render.render_template('user/role_dtl.html',
                                      request_params=request.form)

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call
    rest_role = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/roles/' + role_id

    # Step 3-2. REST Call : get
    if not rest_role.get(url):
        error_map = {'resultCode': OpmmResultCode.EM0999,
                     'resultMsg': 'Internal Error'}
        return Render.render_template('user/role_lst.html',
                                      request_params=request.form,
                                      response=error_map)

    # Step 3-3. REST Call : Check Biz. Exception
    # NOT NORMAL
    if rest_role.res['resultCode'] != OpmmResultCode.EM0000:
        current_app.logger.error("[{0}] {1}".format(rest_role.res['resultCode'], rest_role.res['resultMsg']))
        return Render.render_template('user/role_lst.html',
                                      request_params=request.form,
                                      response=rest_role.res)

    # Step 3-4. REST Call : Output Process
    for idx, node_set in enumerate(rest_role.res['nodeSetAccountList']):
        rest_role.res['nodeSetAccountList'][idx]['hostname'] = ""
        rest_role.res['nodeSetAccountList'][idx]['osType'] = ""
        rest_role.res['nodeSetAccountList'][idx]['osName'] = ""
        rest_role.res['nodeSetAccountList'][idx]['osVersion'] = ""
        rest_role.res['nodeSetAccountList'][idx]['tag'] = {}

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
                return Render.render_template('user/role_lst.html',
                                              request_params=request.form,
                                              response=error_map)

            # parse value
            node_set_str = node_set_str[1:]  # skip character string start double quote.
            e_idx = node_set_str.find('"')  # find character string end double quote.
            value = node_set_str[:e_idx]
            node_set_str = node_set_str[e_idx + 1:]

            # assign new key
            if key == 'HOSTNAME':
                rest_role.res['nodeSetAccountList'][idx]['hostname'] = value
            elif key == "OS-TYPE":
                rest_role.res['nodeSetAccountList'][idx]['osType'] = value
            elif key == "OS-NAME":
                rest_role.res['nodeSetAccountList'][idx]['osName'] = value
            elif key == "OS-VER":
                rest_role.res['nodeSetAccountList'][idx]['osVersion'] = value
            else:  # Tag
                rest_role.res['nodeSetAccountList'][idx]['tag'][key] = value

            # string end
            if len(node_set_str) == 0:
                break

            # key:"value" parsing error
            if node_set_str.startswith(',') is False:
                error_map = {'resultCode': OpmmResultCode.EM0999,
                             'resultMsg': 'Internal Error'}
                current_app.logger.error("[{0}] {1}".format(error_map['resultCode'],
                                                            "Parse error.(" + node_set['nodeSet'] + ")"))
                return Render.render_template('user/role_lst.html',
                                              request_params=request.form,
                                              response=error_map)

            node_set_str = node_set_str[1:]  # skip character ','

        del rest_role.res['nodeSetAccountList'][idx]['nodeSet']

    # Step 99. Response Data Formatting
    return Render.render_template('user/role_dtl.html',
                                  request_params=request.form,
                                  response=rest_role.res)


@bp.route('/save', methods=['POST'])
@login_required
def request_role_save():
    """
    역할 저장
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()

    role_id = req['role_id']
    base_info = req['base_info']
    member_list = req['member_list']
    nodeset_list = req['nodeset_list']
    rest_mode = 'POST'  # CREATE
    if role_id != '':
        rest_mode = 'PUT'  # EDIT

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call(Create&Edit Usergrp)
    rest_role = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/roles'
    if rest_mode == 'PUT':
        url = '/roles/' + role_id

    if base_info['role_id'] != '':
        rest_role.req['id'] = base_info['role_id']
    if base_info['role_nm'] != '':
        rest_role.req['name'] = base_info['role_nm']

    rest_role.req['userIdList'] = member_list
    rest_role.req['nodeSetAccountList'] = []

    for idx, node_set in enumerate(nodeset_list):
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
                    node_set_str += ',' + key + ':\"' + val + '\"'

        rest_role.req['nodeSetAccountList'].append({'nodeSet': node_set_str[1:],  # 좌측 , 제거
                                                    'account': node_set['account'],
                                                    'description': node_set['description']})
    # Step 3-2. REST Call : get
    if rest_mode == 'POST':  # POST
        result = rest_role.post(url)
    else:  # PUT
        result = rest_role.put(url)

    if not result:
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    if rest_role.res['resultCode'] != OpmmResultCode.EM0000:
        current_app.logger.error("[{0}] {1}".format(rest_role.res['resultCode'], rest_role.res['resultMsg']))

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return jsonify(rest_role.res)


@bp.route('/del', methods=['POST'])
@login_required
def del_user_list():
    """
    역할 정보 삭제 요청
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()
    id_list = req['id_list']

    result = []
    for role_id in id_list:
        result.append(del_role(role_id))

    return jsonify(result)


def del_role(role_id):
    """
    역할 목록에서 role_id에 해당하는 항목 삭제
    :param role_id:
    :return:
    """
    # Step 3. REST Call
    rest_role = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/roles/' + role_id

    # Step 3-2. REST Call : delete
    if not rest_role.delete(url):
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    if rest_role.res['resultCode'] != OpmmResultCode.EM0000:
        msg = "Failed to delete user.({0}) : {1} - {2}".format(role_id,
                                                               rest_role.res['resultCode'],
                                                               rest_role.res['resultMsg'])
        current_app.logger.error(msg)
    else:
        current_app.logger.info(role_id)

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return {'role_id': role_id,
            'resultCode': rest_role.res['resultCode'],
            'resultMsg': rest_role.res['resultMsg']}
