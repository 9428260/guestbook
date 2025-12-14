from flask import Blueprint, request, jsonify, current_app

from app.common.render import Render
from app.interface.constants import OpmmResultCode
from app.interface.restclient import RestClient
from app.user import login_required

bp = Blueprint('dctnry', __name__)


@bp.route('/', methods=['GET'])
@login_required
def render_page():
    """
    단어사전 목록 화면
    :return:
    """
    return Render.render_template('task/dctnry_lst.html')


@bp.route('/', methods=['POST'])
@login_required
def render_page_with_param():
    """
    단어사전 목록 화면
    :return:
    """
    return Render.render_template('task/dctnry_lst.html', request_params=request.form)


@bp.route('/list', methods=['POST'])
@login_required
def request_dctnry_list():
    """
    단어사전 목록 요청
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()

    dctnry_voca_no = req['dctnry_voca_no']
    dctnry_word = req['dctnry_word']
    dctnry_type = None
    offset = (req['page'] - 1) * req['perPage']
    limit = req['perPage']

    if req['dctnry_type'] != 'all':
        dctnry_type = req['dctnry_type']

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call
    rest_dctnry = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/vocas'
    query_string = ''

    if dctnry_voca_no != '':
        query_string = ',vocaNo=' + dctnry_voca_no
    if dctnry_word != '':
        query_string += ',word=' + dctnry_word
    if dctnry_type is not None:
        query_string += ',type=' + dctnry_type

    rest_dctnry.req = {'query': query_string[1:],  # 좌측 ',' 제거
                       'offset': offset,
                       'limit': limit}

    # Step 3-2. REST Call : get
    if not rest_dctnry.get(url):
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    # NOT_FOUND
    if rest_dctnry.res['resultCode'] == OpmmResultCode.EM1002:
        rest_dctnry.res['vocaList'] = []
        rest_dctnry.res['totalCnt'] = 0

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return jsonify(rest_dctnry.res)


@bp.route('/dupchk', methods=['POST'])
@login_required
def duplicate_check_id():
    """
    단어명 정보를 가져온다.
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()
    dctnry_word = req['dctnry_word']
    offset = 0
    limit = 100

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call
    rest_dctnry = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/vocas'
    query_string = ''

    if dctnry_word != '':
        query_string += ',word=' + dctnry_word

    rest_dctnry.req = {'query': query_string[1:],  # 좌측 ',' 제거
                       'offset': offset,
                       'limit': limit}

    # Step 3-2. REST Call : get
    if not rest_dctnry.get(url):
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    # NOT_FOUND
    if rest_dctnry.res['resultCode'] == OpmmResultCode.EM1002:
        return jsonify(rest_dctnry.res)

    if rest_dctnry.res['resultCode'] != OpmmResultCode.EM0000:
        current_app.logger.error("[{0}] {1}".format(rest_dctnry.res['resultCode'], rest_dctnry.res['resultMsg']))
        return jsonify(rest_dctnry.res)

    # Step 3-4. REST Call : Output Process
    for voca_info in rest_dctnry.res['vocaList']:
        if dctnry_word == voca_info['word']:  # duplication : EM0000
            return jsonify(rest_dctnry.res)

    # Step 99. Response Data Formatting
    rest_dctnry.res['resultCode'] = OpmmResultCode.EM1002  # Available Word
    return jsonify(rest_dctnry.res)


@bp.route('/dtl', methods=['POST'])
@login_required
def request_dctnry():
    """
    단어사전 정보를 가져온다.
    :return:
    """
    # Step 1. Request Data Parsing.
    dctnry_voca_no = request.form.get('dctnry_voca_no')

    if dctnry_voca_no is None or dctnry_voca_no == '':  # create
        return Render.render_template('task/dctnry_dtl.html', request_params=request.form)

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call
    rest_dctnry = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/vocas/' + dctnry_voca_no

    # Step 3-2. REST Call : get
    if not rest_dctnry.get(url):
        error_map = {'resultCode': OpmmResultCode.EM0999,
                     'resultMsg': 'Internal Error'}
        return Render.render_template('task/dctnry_lst.html',
                                      request_params=request.form,
                                      response=error_map)

    # Step 3-3. REST Call : Check Biz. Exception
    # NOT NORMAL
    if rest_dctnry.res['resultCode'] != OpmmResultCode.EM0000:
        current_app.logger.error("[{0}] {1}".format(rest_dctnry.res['resultCode'], rest_dctnry.res['resultMsg']))
        return Render.render_template('task/dctnry_lst.html',
                                      request_params=request.form,
                                      response=rest_dctnry.res)

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return Render.render_template('task/dctnry_dtl.html',
                                  request_params=request.form,
                                  response=rest_dctnry.res)


@bp.route('/save', methods=['POST'])
@login_required
def request_dctnry_save():
    """
    단어사전 저장
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()

    dctnry_voca_no = req['dctnry_voca_no']
    base_info = req['base_info']
    rest_mode = 'POST'  # CREATE
    if base_info['dctnry_voca_no'] != '':
        rest_mode = 'PUT'  # EDIT

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call(Edit Usergrp)
    rest_dctnry = RestClient()
    # Step 3-1. REST Call : Input Binding.
    url = '/vocas'
    if rest_mode == 'PUT':
        url = '/vocas/' + dctnry_voca_no

    if base_info['dctnry_voca_no'] != '' and dctnry_voca_no != base_info['dctnry_voca_no']:
        rest_dctnry.req['vocaNo'] = base_info['dctnry_voca_no']
    if base_info['dctnry_word'] != '':
        rest_dctnry.req['word'] = base_info['dctnry_word']
    if base_info['dctnry_type'] != '':
        rest_dctnry.req['type'] = base_info['dctnry_type']

    # Step 3-2. REST Call : get
    if rest_mode == 'POST':  # POST
        result = rest_dctnry.post(url)
    else:  # PUT
        result = rest_dctnry.put(url)

    if not result:
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    if rest_dctnry.res['resultCode'] != OpmmResultCode.EM0000:
        current_app.logger.error("[{0}] {1}".format(rest_dctnry.res['resultCode'], rest_dctnry.res['resultMsg']))

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return jsonify(rest_dctnry.res)


@bp.route('/del', methods=['POST'])
@login_required
def del_dctnry_list():
    """
    단어사전 정보 삭제 요청
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()
    id_list = req['id_list']
    result = []

    for dctnry_voca_no in id_list:
        result.append(del_dctnry(dctnry_voca_no))

    return jsonify(result)


def del_dctnry(dctnry_voca_no):
    """
    단어사전 목록에서 dctnry_voca_no에 해당하는 항목 삭제
    :param dctnry_voca_no:
    :return:
    """
    # Step 3. REST Call
    rest_dctnry = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/vocas/' + str(dctnry_voca_no)

    # Step 3-2. REST Call : delete
    if not rest_dctnry.delete(url):
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    if rest_dctnry.res['resultCode'] != OpmmResultCode.EM0000:
        msg = "Failed to delete word.({0}) : {1} - {2}".format(dctnry_voca_no,
                                                               rest_dctnry.res['resultCode'],
                                                               rest_dctnry.res['resultMsg'])
        current_app.logger.error(msg)
    else:
        current_app.logger.info(dctnry_voca_no)

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return {'dctnry_voca_no': dctnry_voca_no,
            'resultCode': rest_dctnry.res['resultCode'],
            'resultMsg': rest_dctnry.res['resultMsg']}
