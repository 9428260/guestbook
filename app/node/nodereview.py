from flask import Blueprint, request, jsonify

from app.common.render import Render
from app.interface.constants import OpmmResultCode
from app.interface.restclient import RestClient
from app.user import login_required

bp = Blueprint('nodereview', __name__)


@bp.route('/', methods=['GET'])
@login_required
def render_page():
    """
    노드 목록 화면
    :return:
    """
    return Render.render_template('node/node_review.html')


@bp.route('/', methods=['POST'])
@login_required
def render_page_with_param():
    """
    노드 목록 화면
    :return:
    """
    return Render.render_template('node/node_review.html',
                                  request_params=request.form)


@bp.route('/exact_list', methods=['POST'])
@login_required
def request_exact_node_list():
    """
    Hostname 목록 노드 조회
    :return:
    """

    # Step 1. Request Data Parsing.
    req = request.get_json()
    case_include = req.get('case_include')
    req_host_list = req.get('hostname_list')
    # 팝업창 호출시 parent 창 정보 전달
    parent = req.get('parent')

    # Step 2. Request Data Validation.
    #   - None.
    # Step 3. REST Call
    rest_node = RestClient()
    # Step 3-1. REST Call : Input Binding.
    url = '/nodes'

    # Hostname 비교를 위한 전체 node list 조회
    offset = 0
    limit = 1000
    node_list = []
    rest_node.req = {'limit': limit,
                     'offset': offset,
                     'field': "CT.Name,CT.cz-project,CT.cz-stage,CT.cz-org,CT.cz-owner,CT.cz-appl,WP.customer_nm,WP.sys_operator1_nm,WP.service_nm,WP.env"}

    # Step 3-2. REST Call : get
    if not rest_node.get(url):
        rest_node.res['nodeList'] = []
        rest_node.res['totalCnt'] = 0
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    # NOT_FOUND
    if rest_node.res['resultCode'] == OpmmResultCode.EM1002:
        return jsonify(rest_node.res)

    rest_res = rest_node.res
    total_cnt = rest_node.res['totalCnt']
    node_list += rest_node.res['nodeList']

    while total_cnt > offset:

        offset += limit
        rest_node.req['offset'] = offset

        # Step 3-2. REST Call : get
        if not rest_node.get(url):
            return jsonify({'result': 'Fail'}), 500

        # Step 3-3. REST Call : Check Biz. Exception
        # NOT_FOUND
        if rest_node.res['resultCode'] == OpmmResultCode.EM1002:
            break

        rest_res = rest_node.res
        node_list += rest_node.res['nodeList']

    # node_dict = {node['hostname']: node for node in node_list}
    # 마스터에서 조회된 전체 node 를 hostname 기준으로 dictionary 로 변환
    # hostname 이 중복될수 있음, (key)hostname[string] : (value)node[List]
    node_dict = {}
    for node in node_list:  # 마스터에서 조회된 node_list
        if node['hostname'] not in node_dict:  # node 에 있는 hostname key 값이 dict 에 존재하지 않는 경우
            node_hostname_list = list()
            node_hostname_list.append(node)
            node_dict[node['hostname']] = node_hostname_list  # hostname 이 동일한 node 를 hostname(key) : node List(value)
        else:
            node_hostname_list = node_dict[node['hostname']]  # 이미 hostname 이 있으면 node List(value) 에 추가
            node_hostname_list.append(node)

    # Hostname 입력 (TextArea) 목록을 기준으로 조회한 node 목록과 포함 여부를 체크하여 node List 를 새로 생성
    res_host_list = []  # 마스터에서 조회한 node list 포함 여부 판단후 재 생성한 리스트
    selected_set = set()  # 기 조회된 key 로 다시 조회하여 결과에 데이터 중복이 되지 않도록 조회 Key 를 저장. (ex sktvm, SKTVM)
    """
    empty_node = {'hostname': '', 'status': 'disable', 'account': ''}
    """
    for hostname in req_host_list:
        host = hostname
        account = ""

        # 팝업창 호출시 parent가 role, task 중 role일 경우 OS계정 * default 로 넣어줌
        if parent == "role":
            account = "*"

        if hostname.find('|') != -1:
            host_split = hostname.split(sep='|')
            host = host_split[0]
            account = host_split[1]

        # 조회 Key 생성
        host_set = {host}
        if case_include:
            host_set.update([host.upper(), host.lower()])  # host(입력내용), 대문자, 소문자 3가지 hostname 확인

        # 조회
        for item in host_set:
            # 기 조회된 내역이 있는 경우.
            if item in selected_set:
                continue

            if item in node_dict:
                # hostname 이 중복가능 하므로 같은 hostname 의 node List 를 모두 추가
                for item_node in node_dict[item]:  # node_dict 에서 value 는 node List
                    item_node['account'] = account
                    res_host_list.append(item_node)
            else:
                empty_node = {'hostname': item, 'status': 'disable', 'account': account}
                res_host_list.append(empty_node)

            selected_set.add(item)

    # Step 3-4. REST Call : Output Process
    # 포함 여부를 확인한 res_host_list 로 치환
    rest_res['nodeList'] = res_host_list

    # Step 99. Response Data Formatting
    return jsonify(rest_res)
