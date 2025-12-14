import base64
import os
from datetime import datetime
from queue import Queue

from flask import Blueprint, request, jsonify, current_app, send_file, Response, stream_with_context
from werkzeug.exceptions import abort

from app.common.render import Render
from app.interface.constants import OpmmResultCode
from app.interface.restclient import RestClient
from app.user import login_required

bp = Blueprint('file', __name__)
sse_dict = {}


@bp.route('/', methods=['GET'])
@login_required
def render_page():
    """
    파일 목록 화면
    :return:
    """
    return Render.render_template('file/file_lst.html')


@bp.route('/', methods=['POST'])
@login_required
def render_page_with_param():
    """
    파일 목록 화면
    :return:
    """
    return Render.render_template('file/file_lst.html', request_params=request.form)


@bp.route('/list', methods=['POST'])
@login_required
def request_file_list():
    """
    파일 목록 요청
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()

    filehub_id = req['filehub_id']
    path = req['path']
    offset = (req['page'] - 1) * req['perPage']
    limit = req['perPage']

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call
    rest_file = RestClient()

    # Step 3-1. REST Call : Input Binding.
    if path.strip("/") == '':
        tmp_path = 'master:/' + filehub_id
    else:
        tmp_path = 'master:/' + filehub_id + '/' + path.strip("/")
    b_path = tmp_path.encode("UTF-8")
    e_path = base64.urlsafe_b64encode(b_path)
    base64path = e_path.decode("UTF-8")
    url = '/files/' + base64path + '/subfiles'

    # print(f'{url=}')

    rest_file.req = {'limit': limit,
                     'offset': offset}

    # Step 3-2. REST Call : get
    if not rest_file.get(url):
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    # NOT_FOUND
    if rest_file.res['resultCode'] == OpmmResultCode.EM1002:
        rest_file.res['subFileList'] = []
        rest_file.res['totalCnt'] = 0

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return jsonify(rest_file.res)


@bp.route('/upload', methods=['POST'])
@login_required
def upload_file():
    """
    파일 업로드
    :return:
    """
    # Step 1. Request Data Parsing.
    data = request.files['uploadFiles']
    filehub_id = request.form.get('filehub_id')
    path = request.form.get('path')
    overwrite = request.form.get('overwrite')
    # get File Size
    data.stream.seek(0, os.SEEK_END)
    file_size = data.stream.tell()  # find the size of file
    data.stream.seek(0, os.SEEK_SET)

    trans_unit = current_app.config['OPMM_FILE_TRANSFORM_UNIT']
    total_cnt = int((file_size + trans_unit - 1) / trans_unit)
    current_cnt = 0
    data_block = data.stream.read(trans_unit)

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call
    rest_upload = RestClient()

    # Step 3-1. REST Call : Input Binding.
    # if necessary - secure_filename(data.filename)
    # master:/ + id12 + / + path + / + filename
    # master:/ + id12 + // + filename
    # master:/ + id12 + a/b/ + / + filename

    if path.strip("/") == '':
        tmp_path = 'master:/{0}/{1}'.format(filehub_id, data.filename)
    else:
        tmp_path = 'master:/{0}/{1}/{2}'.format(filehub_id, path.strip("/"), data.filename)
    b_path = tmp_path.encode("UTF-8")
    e_path = base64.urlsafe_b64encode(b_path)
    base64path = e_path.decode("UTF-8")
    url = '/files'

    rest_upload.req = {
        'base64Path': base64path,
        'overwrite': overwrite,
        'totalCnt': total_cnt,
        'currentCnt': current_cnt,
        'base64Content': None
    }

    # 0 Byte File.
    if data_block == b'':
        rest_upload.req['currentCnt'] = 1
        rest_upload.req['base64Content'] = ''
        if not rest_upload.post(url):
            return jsonify({'result': 'Fail'}), 500

        res = rest_upload.res
        res['name'] = data.filename

        return jsonify(res)

    while data_block:
        current_cnt = current_cnt + 1
        rest_upload.req['currentCnt'] = current_cnt
        rest_upload.req['base64Content'] = base64.b64encode(data_block).decode('ascii')

        # Step 3-2. REST Call : get
        if not rest_upload.post(url):
            return jsonify({'result': 'Fail'}), 500

        # Step 3-3. REST Call : Check Biz. Exception
        if rest_upload.res['resultCode'] == OpmmResultCode.EM0999:
            res = rest_upload.res
            res['name'] = data.filename

            return jsonify(res), "999 Already exists in server."

        data_block = data.stream.read(trans_unit)

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    res = rest_upload.res
    res['name'] = data.filename

    return jsonify(res)


@bp.route('/p_upload', methods=['GET'])
@login_required
def render_upload_file_page():
    """
    파일 업로드 Popup 화면
    :return:
    """
    return Render.render_template('file/popup/popup_file_upload.html')


@bp.route('/download', methods=['POST'])
@login_required
def download_file():
    """
    파일 다운로드
    :return:
    """
    current_date = datetime.now().strftime("%Y%m%d")
    download_path = current_app.config['OPMM_FILE_DOWNLOAD_PATH'] + "/" + current_date

    # Create File Download Directory(from OPMM)
    if os.path.isdir(download_path) is False:
        os.mkdir(download_path)

    # Step 1. Request Data Parsing.
    filehub_id = request.form.get('filehub_id')
    path = request.form.get('path')
    name = request.form.get('name')
    save_filename = request.form.get('uuid')

    # Initialized
    current_cnt = 0  # File 의 첫번째 블럭부터 요청.
    total_cnt = 1  # Master 에 응답 받기전 임의값.(current_cnt != total_cnt)

    # Step 2. Request Data Validation.
    #   - None.

    # Step 3. REST Call
    rest_file = RestClient()

    # Step 3-1. REST Call : Input Binding.
    tmp_path = 'master:/' + filehub_id + path + name
    b_path = tmp_path.encode("UTF-8")
    e_path = base64.urlsafe_b64encode(b_path)
    base64path = e_path.decode("UTF-8")
    url = '/files/' + base64path

    rest_file.req = {
        'mode': 'download',
        'currentCnt': current_cnt  # currentCnt 는 1부터 시작해서, 증가
    }

    with open(os.path.join(download_path, save_filename), 'wb') as save_file:

        # Step 3-2. REST Call : get
        # totalCnt == currentCnt 일 때까지 반복 호출
        while total_cnt > current_cnt:
            current_cnt += 1
            rest_file.req['currentCnt'] = current_cnt

            if not rest_file.get(url):
                current_app.logger.error("[{0}] {1}".format(rest_file.res['resultCode'], rest_file.res['resultMsg']))
                abort(500)

            # Step 3-3. REST Call : Check Biz. Exception
            # NOT_FOUND
            if rest_file.res['resultCode'] != OpmmResultCode.EM0000:
                current_app.logger.error("[{0}] {1}".format(rest_file.res['resultCode'], rest_file.res['resultMsg']))
                abort(500)

            total_cnt = rest_file.res['totalCnt']
            current_cnt = rest_file.res['currentCnt']
            content = base64.b64decode(rest_file.res['base64Content'])
            save_file.write(content)

            if sse_dict.get(save_filename) is None:
                current_app.logger.error("Aborted file download.")
                delete_file = os.path.join(download_path, save_filename)
                try:
                    if os.path.isfile(delete_file):
                        os.remove(delete_file)
                except OSError:
                    abort(500)
                abort(500)

            sse_dict[save_filename].put(u'%s' % int(current_cnt / total_cnt * 100))

    # Step 3-4. REST Call : Output Process
    # attachment_filename : 임시 파일 정보. 다운로드 완료 후, 임시 파일 삭제를 위함.
    return send_file(os.path.join(download_path, save_filename),
                     download_name=current_date + '/' + save_filename,
                     as_attachment=True)


@bp.route('/del_tmp_file', methods=['POST'])
@login_required
def delete_tmp_file():
    """
    파일 다운로드 완료 후, 호출하여 임시 파일 삭제.
    :return:
    """
    req = request.get_json()
    date = req['date']
    file_name = req['file_name']
    download_path = current_app.config['OPMM_FILE_DOWNLOAD_PATH'] + "/" + date
    delete_file = os.path.join(download_path, file_name)

    try:
        if os.path.isfile(delete_file):
            os.remove(delete_file)

    except OSError:
        return jsonify({'result': 'Fail'}), 500

    return jsonify({'result': 'Success'})


@bp.route('/del', methods=['POST'])
@login_required
def del_file_list():
    """
    파일 삭제 요청
    :return:
    """
    # Step 1. Request Data Parsing.
    req = request.get_json()
    filehub_id = req['filehub_id']
    path = req['path']
    file_list = req['file_list']

    result = []
    for name in file_list:
        result.append(del_file(filehub_id, path, name))

    return jsonify(result)


def del_file(filehub_id, path, name):
    """
    파일 목록에서 name 해당하는 파일 삭제
    :param filehub_id:
    :param path:
    :param name: File Name
    :return:
    """
    # Step 3. REST Call
    rest_file = RestClient()

    # Step 3-1. REST Call : Input Binding.
    str_path = 'master:/' + filehub_id + path + name
    b_path = str_path.encode("UTF-8")
    e_path = base64.urlsafe_b64encode(b_path)
    base64path = e_path.decode("UTF-8")
    url = '/files/' + base64path

    # Step 3-2. REST Call : delete
    if not rest_file.delete(url):
        return jsonify({'result': 'Fail'}), 500

    # Step 3-3. REST Call : Check Biz. Exception
    if rest_file.res['resultCode'] != OpmmResultCode.EM0000:
        msg = "Failed to delete file.({0}) : {1} - {2}".format(str_path,
                                                               rest_file.res['resultCode'],
                                                               rest_file.res['resultMsg'])
        current_app.logger.error(msg)
    else:
        current_app.logger.info(str_path)

    # Step 3-4. REST Call : Output Process

    # Step 99. Response Data Formatting
    return {'name': name,
            'resultCode': rest_file.res['resultCode'],
            'resultMsg': rest_file.res['resultMsg']}


@bp.route('/sse/<uuid>', methods=['GET'])
@login_required
def download_sse(uuid):
    if not sse_dict.get(uuid) is None:
        return None
    return Response(stream_with_context(event_stream(uuid)), mimetype="text/event-stream", headers={"X-Accel-Buffering": "no"})


def event_stream(uuid):
    try:
        sse_dict[uuid] = Queue()
        progress_percent = 0

        while int(progress_percent) < 100:
            progress_percent = sse_dict[uuid].get()
            yield 'data: %s\n\n' % progress_percent
    finally:
        if not sse_dict.get(uuid) is None:
            sse_dict.pop(uuid)


@bp.route('/predownload', methods=['GET'])
@login_required
def pre_download():
    return jsonify({'result': 'Success'})