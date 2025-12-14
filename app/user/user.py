import base64
from io import BytesIO

import pyotp
import qrcode
from flask import Blueprint, request, jsonify, current_app, session

from app.common.render import Render
from app.interface.constants import OpmmResultCode
from app.interface.restclient import RestClient
from app.user import login_required

bp = Blueprint('user', __name__)


@bp.route('/', methods=['GET'])
@login_required
def render_page():
    """
    사용자 목록 화면
    :return:
    """
    return Render.render_template('user/user_lst.html')


@bp.route('/', methods=['POST'])
@login_required
def render_page_with_param():
    """
    사용자 목록 화면
    :return:
    """
    return Render.render_template('user/user_lst.html',
                                  request_params=request.form)


@bp.route('/chg_pw', methods=['GET'])
def render_change_pw():
    """
    사용자 패스워드 변경 화면 - nologin 화면
    :return:
    """
    return Render.render_template('user/user_pw.html')


@bp.route('/chg_pw', methods=['POST'])
@login_required
def render_change_password():
    """
    사용자 패스워드 변경 화면 - login 화면
    :return:
    """
    return Render.render_template('user/user_pw_dtl.html',
                                  request_params=request.form)


@bp.route('/list', methods=['POST'])
@login_required
def request_user_list():
    """
    사용자 목록 요청
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()

    user_id = req['user_id']
    user_nm = req['user_nm']
    user_privilege = None
    user_status = None
    offset = (req['page'] - 1) * req['perPage']
    limit = req['perPage']

    if req['user_privilege'] != 'all':
        user_privilege = req['user_privilege']

    if req['user_status'] != 'all':
        user_status = req['user_status']

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call
    rest_user = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/users'
    query_string = ''

    if user_id != '':
        query_string = ',id=' + user_id
    if user_nm != '':
        query_string += ',name=' + user_nm
    if user_privilege is not None:
        query_string += ',privilege=' + user_privilege
    if user_status is not None:
        query_string += ',status=' + user_status

    rest_user.req = {'query': query_string[1:],  # 좌측 ',' 제거
                     'offset': offset,
                     'limit': limit}

    # Step 3-2. REST Call : get
    if not rest_user.get(url):
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    # NOT_FOUND
    if rest_user.res['resultCode'] == OpmmResultCode.EM1002:
        rest_user.res['userList'] = []
        rest_user.res['totalCnt'] = 0

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return jsonify(rest_user.res)


@bp.route('/dupchk', methods=['POST'])
@login_required
def duplicate_check_id():
    """
    사용자 정보를 가져온다.
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()
    user_id = req['user_id']

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call
    rest_user = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/users/' + user_id

    # Step 3-2. REST Call : get
    if not rest_user.get(url):
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    # NOT_FOUND
    if rest_user.res['resultCode'] == OpmmResultCode.EM1002:
        current_app.logger.error("[{0}] {1}".format(rest_user.res['resultCode'], rest_user.res['resultMsg']))

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return jsonify(rest_user.res)


@bp.route('/dtl', methods=['POST'])
@login_required
def request_user():
    """
    사용자 정보를 가져온다.
    :return:
    """
    # Step 1. Request Data Parsing.
    user_id = request.form.get('user_id')

    # [2023.11.04] SKT-PRD 보안인증 심사 보완사항
    # 사용자 정보 조회시 마스킹 해제 여부
    mask_view = request.form.get('mask_view')

    if user_id is None or user_id == '':  # create
        return Render.render_template('user/user_dtl.html',
                                      request_params=request.form)

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call
    rest_user = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/users/' + user_id

    # Step 3-2. REST Call : get
    if not rest_user.get(url):
        error_map = {'resultCode': OpmmResultCode.EM0999,
                     'resultMsg': 'Internal Error'}
        return Render.render_template('user/user_lst.html',
                                      request_params=request.form,
                                      response=error_map)

    # Step 3-3. REST Call : Check Biz. Exception
    # NOT NORMAL
    if rest_user.res['resultCode'] != OpmmResultCode.EM0000:
        current_app.logger.error("[{0}] {1}".format(rest_user.res['resultCode'], rest_user.res['resultMsg']))
        return Render.render_template('user/user_lst.html',
                                      request_params=request.form,
                                      response=rest_user.res)

    # Step 3-4. REST Call : Output Process

    # [2023.11.04] SKT-PRD 보안인증 심사 보완사항
    # 로그인 세션에 저장된 user_id 와 request 의 user_id 가 같은경우
    # mask_view = 'Y' 이고 마스킹 해제 상태임
    session_user_id = session['login_info']['user_id']
    if user_id == session_user_id:
        mask_view = 'Y'

    # 마스킹 해제 여부가 'Y' 가 아닌경우(None)
    # 이메일, 연락처에 대해 글자 길이(10자리) 만큼 * 를 붙인다.
    if mask_view is None:
        for key, value in rest_user.res.items():
            if key == 'notiAddr':
                # val_length = len(value)
                val_length = 10
                rest_user.res['notiAddr'] = ''
                for i in range(val_length):
                    rest_user.res['notiAddr'] += '*'

            if key == 'contact':
                # val_length = len(value)
                val_length = 10
                rest_user.res['contact'] = ''
                for i in range(val_length):
                    rest_user.res['contact'] += '*'

    # Step 99. Response Data Formatting
    return Render.render_template('user/user_dtl.html',
                                  request_params=request.form,
                                  response=rest_user.res,
                                  mask_view=mask_view)


@bp.route('/save', methods=['POST'])
@login_required
def request_user_save():
    """
    사용자 저장
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()

    user_id = req['user_id']
    base_info = req['base_info']
    mask_view = req['mask_view']
    rest_mode = 'POST'  # CREATE
    if user_id != '':
        rest_mode = 'PUT'  # EDIT

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call(Create&Edit User)
    rest_user = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/users'
    if rest_mode == 'PUT':
        url = '/users/' + user_id + '?mode=edit'

    # Only Super-user can edit this.(id, privilege, status)
    if session['login_info']['privilege'] == 9:
        if base_info['user_id'] != '' and user_id != base_info['user_id']:
            rest_user.req['id'] = base_info['user_id']
        if base_info['user_privilege'] != '':
            rest_user.req['privilege'] = base_info['user_privilege']
        if base_info['user_status'] != '':
            rest_user.req['status'] = base_info['user_status']

    if base_info['user_nm'] != '':
        rest_user.req['name'] = base_info['user_nm']

    # 241008. mask 여부에 따른 분기 처리
    if mask_view == "Y":
        if base_info['user_notiaddr'] != '':
            rest_user.req['notiAddr'] = base_info['user_notiaddr']
        if base_info['user_contact'] != '':
            rest_user.req['contact'] = base_info['user_contact']
    if base_info['user_description'] != '':
        rest_user.req['description'] = base_info['user_description']

    # Step 3-2. REST Call : get
    if rest_mode == 'POST':  # POST
        result = rest_user.post(url)
    else:  # PUT
        result = rest_user.put(url)

    if not result:
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    if rest_user.res['resultCode'] != OpmmResultCode.EM0000:
        current_app.logger.error("[{0}] {1}".format(rest_user.res['resultCode'], rest_user.res['resultMsg']))

    # Step 3-4. REST Call : Output Process
    # 정상 저장 처리이고 내 정보를 수정한 경우, 세션을 갱신한다.
    if rest_user.res['resultCode'] == OpmmResultCode.EM0000 and user_id == session['login_info']['user_id']:
        session['login_info']['user_id'] = base_info['user_id']
        session['login_info']['privilege'] = base_info['user_privilege']
        session.modified = True

    # Step 99. Response Data Formatting
    return jsonify(rest_user.res)


@bp.route('/register_mfa', methods=['POST'])
@login_required
def request_register_mfa():
    """
    사용자 2차인증 등록
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()
    user_id = req['user_id']

    # Step 2. Request Data Validation.
    if user_id is None or user_id == '':  # Error
        return jsonify({'result': 'Fail'}), 500

    # Step 3. REST Call(Create&Edit User)
    rest_user = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/users/' + user_id + '?mode=edit'
    # pyotp.random_hex() => Invalid Key in Google OTP
    # mfa_key = pyotp.random_hex()
    mfa_key = pyotp.random_base32()  # returns a 32-character base32-encoded secret
    rest_user.req['mfaKey'] = mfa_key

    # Step 3-2. REST Call : get
    result = rest_user.put(url)

    if not result:  # Error
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    if rest_user.res['resultCode'] != OpmmResultCode.EM0000:
        current_app.logger.error("[{0}] {1}".format(rest_user.res['resultCode'], rest_user.res['resultMsg']))

    # Step 3-4. REST Call : Output Process
    issuer_name = "[OPME] " + current_app.config['SITE_NAME']
    secret_url = pyotp.totp.TOTP(mfa_key, interval=30).provisioning_uri(name=user_id, issuer_name=issuer_name)

    # Step 99. Response Data Formatting
    qr_img = qrcode.make(secret_url, box_size=7, border=3)
    buffered = BytesIO()
    qr_img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    rest_user.res['mfa_key'] = mfa_key
    rest_user.res['qr_code'] = img_str

    return jsonify(rest_user.res)


@bp.route('/init_mfa', methods=['POST'])
@login_required
def request_init_mfa():
    """
    사용자 2차인증 초기화
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()
    user_id = req['user_id']

    # Step 2. Request Data Validation.
    if user_id is None or user_id == '':  # Error
        return jsonify({'result': 'Fail'}), 500

    # Step 3. REST Call(Create&Edit User)
    rest_user = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/users/' + user_id + '?mode=edit'
    rest_user.req['mfaKey'] = ''  # Initialize

    # [2023.11.04] SKT-PRD 보안인증 심사 보완사항
    # session 에 있는 2차 인증 코드 정보 초기화
    if 'login_info' in session:
        if 'user_id' in session['login_info']:
            session_user_id = session['login_info']['user_id']
            if session_user_id == user_id and 'mfaKey' in session['login_info']:
                session['login_info']['mfaKey'] = ''

    # Step 3-2. REST Call : get
    result = rest_user.put(url)

    if not result:  # Error
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    if rest_user.res['resultCode'] != OpmmResultCode.EM0000:
        current_app.logger.error("[{0}] {1}".format(rest_user.res['resultCode'], rest_user.res['resultMsg']))

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return jsonify(rest_user.res)


@bp.route('/chg_pw_logged', methods=['POST'])
@login_required
def request_change_password_logged():
    """
    사용자 패스워드 변경 처리 - login 화면
    :return:
    """
    req = request.get_json()
    return change_password(req, 'Y')


@bp.route('/chg_pw_nologged', methods=['POST'])
def request_change_password_nologged():
    """
    사용자 패스워드 변경 처리 - nologin 화면
    :return:
    """
    req = request.get_json()
    return change_password(req, 'N')


def change_password(req, required_login):
    """
    패스워드 변경 실행
    :return:
    """
    # Step 1. Request Data Parsing.
    user_id = req['user_id']
    cur_password = req['current_pw']
    new_password = req['new_pw']

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call(Create&Edit User)
    rest_user = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/users/' + user_id + '?mode=passwd'

    rest_user.req['curPassword'] = cur_password
    rest_user.req['newPassword'] = new_password

    # Step 3-2. REST Call : get
    result = rest_user.put(url, required_login=required_login)

    if not result:
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    if rest_user.res['resultCode'] != OpmmResultCode.EM0000:
        current_app.logger.error("[{0}] {1}".format(rest_user.res['resultCode'], rest_user.res['resultMsg']))

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return jsonify(rest_user.res)


@bp.route('/reset_pw', methods=['POST'])
@login_required
def request_reset_pw():
    """
    사용자 reset
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()
    user_id = req['user_id']

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call(Create&Edit User)
    rest_user = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/users/' + user_id + '?mode=reset'

    if req['user_pw'] != '':
        rest_user.req['password'] = req['user_pw']

    # Step 3-2. REST Call : get
    result = rest_user.put(url)

    if not result:
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    if rest_user.res['resultCode'] != OpmmResultCode.EM0000:
        current_app.logger.error("[{0}] {1}".format(rest_user.res['resultCode'], rest_user.res['resultMsg']))

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return jsonify(rest_user.res)


@bp.route('/del', methods=['POST'])
@login_required
def del_user_list():
    """
    사용자 정보 삭제 요청
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()
    id_list = req['id_list']

    result = []
    for user_id in id_list:
        result.append(del_user(user_id))

    return jsonify(result)


def del_user(user_id):
    """
    사용자 목록에서 user_id에 해당하는 항목 삭제
    :param user_id:
    :return:
    """
    # Step 3. REST Call
    rest_user = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/users/' + user_id

    # Step 3-2. REST Call : delete
    if not rest_user.delete(url):
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    if rest_user.res['resultCode'] != OpmmResultCode.EM0000:
        msg = "Failed to delete user.({0}) : {1} - {2}".format(user_id,
                                                               rest_user.res['resultCode'],
                                                               rest_user.res['resultMsg'])
        current_app.logger.error(msg)
    else:
        current_app.logger.info(user_id)

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return {'user_id': user_id,
            'resultCode': rest_user.res['resultCode'],
            'resultMsg': rest_user.res['resultMsg']}


@bp.route('/p_user', methods=['GET'])
@login_required
def render_search_user_page():
    """
    사용자 조회 Popup 화면
    :return:
    """
    return Render.render_template('user/popup/popup_user_lst.html')


@bp.route('/p_reset_pw', methods=['GET'])
@login_required
def render_reset_pw_page():
    """
    사용자 패스워드 리셋 Popup 화면
    :return:
    """
    return Render.render_template('user/popup/popup_user_reset_pw.html')
