from flask import Blueprint, render_template, request, jsonify, json
from werkzeug.exceptions import abort

from app.interface.restclient import RestClient
from app.sample.sample_code import UserCode
from app.user import login_required

bp = Blueprint('sample_rest', __name__)


@bp.route('/rest', methods=['GET'])
@login_required
def render_page():
    """
    REST API call test
    :return:
    """
    return render_template('sample/rest.html')


@bp.route('/rest/list', methods=['POST'])
@login_required
def request_user_list():
    """
    공통코드 목록 요청
    :return:
    """
    req = request.get_json()
    print(req['user_status'])

    user_list = RestClient()
    if not user_list.get('/users'):
        return jsonify({'result': 'Fail'}), 500

    print("####")
    print(json.dumps(user_list.res))
    print("####")

    if req['user_id'] == '1':
        result = {
            'dataLength': 2,
            'data': [{'user_id': 'a'}, {'user_id': 'b'}],
        }
    else:
        result = {'data': []}
    return jsonify(result)


@bp.route('/rest/init', methods=['POST'])
@login_required
def init_user_dtl():
    """
    사용자 정보 상세 초기화
    :return:
    """
    return jsonify(UserCode.user_status)
