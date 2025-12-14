from flask import Blueprint, jsonify, request, current_app

from app.common.render import Render
from app.interface.constants import OpmmResultCode
from app.interface.restclient import RestClient
from app.user import login_required

bp = Blueprint('system', __name__)


@bp.route('/', methods=['GET'])
@login_required
def render_page():
    """
    시스템상세 목록 화면
    :return:
    """
    return Render.render_template('system/system_dtl.html')


@bp.route('/listc', methods=['POST'])
@login_required
def request_sysprop_listc():
    """
    시스템속성 정보를 가져온다. (연결정보)
    :return:
    """
    # Step 1. Request Data Parsing.

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call
    rest_syspropc = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/system/metrics'

    # Step 3-2. REST Call : get
    if not rest_syspropc.get(url):
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    # NOT_FOUND
    if rest_syspropc.res['resultCode'] == OpmmResultCode.EM1002:
        rest_syspropc.res['metricList'] = []
        rest_syspropc.res['totalCnt'] = 0

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return jsonify(rest_syspropc.res)


@bp.route('/listv', methods=['POST'])
@login_required
def request_sysprop_listv():
    """
    시스템속성 정보를 가져온다. (버전)
    :return:
    """
    # Step 1. Request Data Parsing.

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call
    rest_syspropv = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/system/versions'

    # Step 3-2. REST Call : get
    if not rest_syspropv.get(url):
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    # NOT_FOUND
    if rest_syspropv.res['resultCode'] == OpmmResultCode.EM1002:
        current_app.logger.error("[{0}] {1}".format(rest_syspropv.res['resultCode'], rest_syspropv.res['resultMsg']))

    # Step 3-4. REST Call : Output Process
    opmm_version = None
    opmm_min_version = current_app.config.get('OPMM_MIN_VERSION')
    opmm_max_version = current_app.config.get('OPMM_MAX_VERSION')
    rest_syspropv.res['versionList'].append({'name': 'MASTER-MIN-VERSION', 'value': opmm_min_version})
    rest_syspropv.res['versionList'].append({'name': 'MASTER-MAX-VERSION', 'value': opmm_max_version})

    if opmm_min_version is None or opmm_max_version is None:
        current_app.logger.error("[{0}] {1} ({2}, {3})".format(OpmmResultCode.EM0999,
                                                               'OPMM Version 호환 여부를 확인하세요.',
                                                               opmm_min_version,
                                                               opmm_max_version))
        rest_syspropv.res['resultCode'] = OpmmResultCode.EM0999
        rest_syspropv.res['resultMsg'] = 'OPMM Version 호환 여부를 확인하세요.'
        return jsonify(rest_syspropv.res)

    # prop array 에서 name 이 MASTER-VERSION 인 것을 찾아서 value 를 취해야 함.
    for prop in rest_syspropv.res.get('versionList'):
        if prop['name'] == 'MASTER-VERSION':
            opmm_version = prop['value']
            break

    if opmm_version is None:
        current_app.logger.error("[{0}] {1}".format(OpmmResultCode.EM0999, 'OPMM Version 확인이 불가합니다.'))
        rest_syspropv.res['resultCode'] = OpmmResultCode.EM0999
        rest_syspropv.res['resultMsg'] = 'OPMM Version 확인이 불가합니다.'
        return jsonify(rest_syspropv.res)

    # ver 값 split (20241206) - OPMM Version 붙은 것과 빠진 것 처리
    def extract_ver(text):
        return text.split("Version")[-1].strip() if "OPMM Version" in text else text

    opmm_min_version = extract_ver(opmm_min_version)
    opmm_max_version = extract_ver(opmm_max_version)

    if opmm_version < opmm_min_version or opmm_version > opmm_max_version:
        current_app.logger.error("[{0}] {1} ({2}, {3})".format(OpmmResultCode.EM0999,
                                                               'OPMM Version 호환 여부를 확인하세요.',
                                                               opmm_min_version,
                                                               opmm_max_version))
        rest_syspropv.res['resultCode'] = OpmmResultCode.EM0999
        rest_syspropv.res['resultMsg'] = 'OPMM Version 호환 여부를 확인하세요.'
        return jsonify(rest_syspropv.res)

    # Step 99. Response Data Formatting
    return jsonify(rest_syspropv.res)

@bp.route('/lists', methods=['POST'])
@login_required
def request_sysprop_lists():
    """
    시스템속성 정보를 가져온다. (마스터 세팅)
    :return:
    """
    # Step 1. Request Data Parsing.

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call
    rest_sysprops = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/system/settings'

    # Step 3-2. REST Call : get
    if not rest_sysprops.get(url):
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    # NOT_FOUND
    if rest_sysprops.res['resultCode'] == OpmmResultCode.EM1002:
        rest_sysprops.res['settingList'] = []
        rest_sysprops.res['totalCnt'] = 0

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return jsonify(rest_sysprops.res)


@bp.route('/nodetag', methods=['POST'])
@login_required
def request_nodetag_list():
    """
    시스템속성 정보를 가져온다. (노드 태그 정보)
    :return:
    """
    # Step 1. Request Data Parsing.

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call
    rest_nodetag = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/system/node-tags'

    # Step 3-2. REST Call : get
    if not rest_nodetag.get(url):
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    # NOT_FOUND
    if rest_nodetag.res['resultCode'] == OpmmResultCode.EM1002:
        rest_nodetag.res['settingList'] = []
        rest_nodetag.res['totalCnt'] = 0

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return jsonify(rest_nodetag.res)

@bp.route('/nodetags', methods=['POST'])
@login_required
def request_nodetag_value_list():
    """
    시스템속성 정보를 가져온다. (노드 태그 밸류 정보)
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call
    rest_nodetags = RestClient()

    # Step 3-1. REST Call : Input Binding.
    url = '/system/node-tags/' + req['nodeTagKey']

    # Step 3-2. REST Call : get
    if not rest_nodetags.get(url):
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    # NOT_FOUND
    if rest_nodetags.res['resultCode'] == OpmmResultCode.EM1002:
        rest_nodetags.res['settingList'] = []
        rest_nodetags.res['totalCnt'] = 0

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return jsonify(rest_nodetags.res)
