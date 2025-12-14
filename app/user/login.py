import pyotp
from flask import render_template, Blueprint, session, redirect, url_for, request, jsonify

from app.interface.constants import OpmmResultCode
from app.user import opme_login, opme_logout, login_required

bp = Blueprint('user_login', __name__)


@bp.route('/login', methods=['GET'])
def render_login():
    """
    로그인 화면
    :return:
    """
    if 'login_info' in session and 'user_id' in session['login_info']:
        if session['login_info'].get('loginYn') == 'Y':
            # return redirect(url_for('dashboard.render_dashboard'))
            return redirect(url_for('index'))

    return render_template('user/login.html')


@bp.route('/login', methods=['POST'])
def login():
    """
    로그인
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()

    login_info = {
        'user_id': req['user_id'],
        'password': req['password']
    }

    result, res = opme_login(login_info)

    # Login Fail (Unknown Id, Password)
    if not result:
        return jsonify(res)

    # Login Success
    res['existMfaKeyYn'] = 'N'
    if res.get('mfaKey') is not None and res.get('mfaKey') != '':
        res['existMfaKeyYn'] = 'Y'
        # del res['mfaKey']

    # del res['userSessionId']
    return jsonify(res)


@bp.route('/logout', methods=['GET', 'POST'])
@login_required
def logout():
    """
    로그아웃
    :return:
    """
    if 'login_info' not in session:
        return render_template('user/login.html')

    result, res = opme_logout()

    # Logout Fail (Unknown Id, Password)
    if not result:
        return render_template('user/login.html', msg="[{0}] {1}".format(res['resultCode'], res['resultMsg']))

    # Logout Success
    return render_template('user/login.html', )


@bp.route('/verify', methods=['POST'])
def verify():
    """
    인증번호 확인
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()
    verification_code = req['verification_code']

    # Step 2. Get mfa_key(secret_key) from session.
    mfa_key = session['login_info']['mfaKey']
    totp = pyotp.TOTP(mfa_key)

    # Step 3. Verify
    if not totp.verify(verification_code):  # Returns True or False
        return jsonify({'resultCode': OpmmResultCode.EM1001, 'resultMsg': 'Invalid verification code.'})

    # Step4. Edit session.
    # verify 성공하면 session 의 loginYn Flag 를 'Y'로 설정.
    session['login_info']['loginYn'] = 'Y'
    session.modified = True

    return jsonify({'resultCode': OpmmResultCode.EM0000,
                    'resultMsg': session['login_info']['user_id'] + ' has been logged in successfully.'})


@bp.route('/p_login', methods=['GET'])
@login_required
def p_login():
    """
    [2023.11.04] SKT-PRD 보안인증 심사 보완사항
    마스킹 해제를 위한 패스워드
    OR 2차 인증 코드 입력을 받는 팝업창
    user/popup/popup_login.html 페이지 표시
    """

    # 2차 인증 코드 사용 여부
    mfa_key_yn = 'N'
    # 세션에 저장된 2차 인증 코드
    mfa_key = session['login_info']['mfaKey']
    # 세션에 저장된 사용자 아이디
    user_id = session['login_info']['user_id']

    # 세션에 2차 인증 코드가 존재 하면 사용여부를 Y로 설정
    if mfa_key is not None and mfa_key != '':
        mfa_key_yn = 'Y'

    return render_template('user/popup/popup_login.html',
                           mfa_key_yn=mfa_key_yn,
                           user_id=user_id)
