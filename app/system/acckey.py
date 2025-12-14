from flask import Blueprint, request, jsonify, current_app

from app.common.render import Render
from app.interface.constants import OpmmResultCode
from app.interface.restclient import RestClient
from app.user import login_required

bp = Blueprint('acckey', __name__)


@bp.route('/', methods=['GET'])
@login_required
def render_page():
    """
    액세스 키 목록 화면
    :return:
    """
    return Render.render_template('system/acckey_lst.html')


@bp.route('/', methods=['POST'])
@login_required
def render_page_with_param():
    """
    액세스 키 목록 화면
    :return:
    """
    return Render.render_template('system/acckey_lst.html', request_params=request.form)


@bp.route('/list', methods=['POST'])
@login_required
def request_acckey_list():
    """
    액세스 키 목록 요청
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()

    acckey_id = req['id']
    owner_id = req['owner_id']
    status = None
    offset = (req['page'] - 1) * req['perPage']
    limit = req['perPage']

    if req['status'] != 'all':
        status = req['status']
    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call
    rest_acckey = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/access-keys'
    query_string = ''

    if acckey_id != '':
        query_string = ',id=' + acckey_id
    if owner_id != '':
        query_string += ',owner=' + owner_id
    if status is not None:
        query_string += ',status=' + status

    rest_acckey.req = {'query': query_string[1:],  # 좌측 ',' 제거
                       'offset': offset,
                       'limit': limit}

    # Step 3-2. REST Call : get
    if not rest_acckey.get(url):
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    # NOT_FOUND
    if rest_acckey.res['resultCode'] == OpmmResultCode.EM1002:
        rest_acckey.res['accessKeyList'] = []
        rest_acckey.res['totalCnt'] = 0

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return jsonify(rest_acckey.res)


@bp.route('/dtl', methods=['POST'])
@login_required
def request_acckey():
    """
    액세스 키 정보를 가져온다.
    :return:
    """
    # Step 1. Request Data Parsing.
    acckey_id = request.form.get('acckey_id')

    if acckey_id is None or acckey_id == '':  # create
        return Render.render_template('system/acckey_dtl.html',
                                      request_params=request.form)

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call
    rest_acckey = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/access-keys/' + acckey_id

    # Step 3-2. REST Call : get
    if not rest_acckey.get(url):
        error_map = {'resultCode': OpmmResultCode.EM0999,
                     'resultMsg': 'Internal Error'}
        return Render.render_template('system/acckey_lst.html',
                                      request_params=request.form,
                                      response=error_map)

    # Step 3-3. REST Call : Check Biz. Exception
    # NOT NORMAL
    if rest_acckey.res['resultCode'] != OpmmResultCode.EM0000:
        current_app.logger.error("[{0}] {1}".format(rest_acckey.res['resultCode'], rest_acckey.res['resultMsg']))
        return Render.render_template('system/acckey_lst.html',
                                      request_params=request.form,
                                      response=rest_acckey.res)

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return Render.render_template('system/acckey_dtl.html',
                                  request_params=request.form,
                                  response=rest_acckey.res)


@bp.route('/save', methods=['POST'])
@login_required
def request_acckey_save():
    """
    액세스 키 저장
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()

    acckey_id = req['acckey_id']
    base_info = req['base_info']

    rest_mode = 'POST'  # CREATE
    if acckey_id != '':
        rest_mode = 'PUT'  # EDIT

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call(Create&Edit AccessKey)
    rest_acckey = RestClient()
    # Step 3-1. REST Call : Input Binding.
    url = '/access-keys'
    if rest_mode == 'PUT':
        url = '/access-keys/' + acckey_id

    if base_info['name'] != '':
        rest_acckey.req['name'] = base_info['name']
    if rest_mode == 'PUT' and base_info['owner_id'] != '':
        rest_acckey.req['ownerUserId'] = base_info['owner_id']
    if base_info['ip_addr'] != '':
        rest_acckey.req['ipAddr'] = base_info['ip_addr']
    if base_info['expiry_date'] != '':
        rest_acckey.req['expiryDate'] = base_info['expiry_date']
    if rest_mode == 'PUT' and base_info['status'] != '':
        rest_acckey.req['status'] = base_info['status']

    # # Step 3-2. REST Call : get
    if rest_mode == 'POST':  # POST
        result = rest_acckey.post(url)
    else:  # PUT
        result = rest_acckey.put(url)

    if not result:
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    if rest_acckey.res['resultCode'] != OpmmResultCode.EM0000:
        current_app.logger.error("[{0}] {1}".format(rest_acckey.res['resultCode'], rest_acckey.res['resultMsg']))

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return jsonify(rest_acckey.res)


@bp.route('/del', methods=['POST'])
@login_required
def del_acckey_list():
    """
    액세스 키 정보 삭제 요청
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()
    id_list = req['id_list']

    result = []
    for acckey_id in id_list:
        result.append(del_acckey(acckey_id))

    return jsonify(result)


def del_acckey(acckey_id):
    """
    액세스 키 목록에서 acckey_id에 해당하는 항목 삭제
    :param acckey_id:
    :return:
    """
    # Step 3. REST Call
    rest_acckey = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/access-keys/' + acckey_id

    # Step 3-2. REST Call : delete
    if not rest_acckey.delete(url):
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    if rest_acckey.res['resultCode'] != OpmmResultCode.EM0000:
        msg = "Failed to delete access key.({0}) : {1} - {2}".format(acckey_id,
                                                                     rest_acckey.res['resultCode'],
                                                                     rest_acckey.res['resultMsg'])
        current_app.logger.error(msg)
    else:
        current_app.logger.info(acckey_id)

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return {'user_id': acckey_id,
            'resultCode': rest_acckey.res['resultCode'],
            'resultMsg': rest_acckey.res['resultMsg']}
