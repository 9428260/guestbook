from flask import Blueprint, jsonify, session, request

from app.common.code_ext import CommonCodeExt
from app.common.menu import Menu
from app.user import login_required

bp = Blueprint('common_menu', __name__)


@bp.route('/info', methods=['GET'])
def render_page():
    """
    REST API call test
    :return:
    """
    login_id = None
    privilege_dict = None

    if 'login_info' in session and 'user_id' in session['login_info']:
        login_id = session['login_info']['user_id']
        for privilege in getattr(CommonCodeExt, 'user_privilege'):
            if privilege['value'] == str(session['login_info']['privilege']):
                privilege_dict = {'value': str(session['login_info']['privilege']),
                                  'text': privilege['text']}
                break

    result = {'login_id': login_id,
              'privilege': privilege_dict,
              'menu_list': Menu.menu_list}

    return jsonify(result)


@bp.route('/comm_code', methods=['POST'])
@login_required
def comm_code_list():
    """
    사용자 정보 상세 초기화
    :return:
    """
    req = request.get_json()
    req_code_list = req['code_list']
    result = {}

    for key in req_code_list:
        if hasattr(CommonCodeExt, key):
            result[key] = getattr(CommonCodeExt, key)

    return jsonify(result)
