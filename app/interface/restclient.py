import logging
import requests
import urllib3
from flask import json, current_app, session
from urllib3.exceptions import InsecureRequestWarning

from app.interface.constants import OpmmResultCode


class RestClient:

    def __init__(self):
        self.__target = current_app.config['OPMM_REST_API_URL']
        self.__timeout = 3.0
        self.__verify = False

        self.__user_id = None

        self.__mask_yn = True
        self.__mask_field = {'password', 'curPassword', 'newPassword', 'secret', 'notiAddr', 'contact'}
        self.__skip_field = {'base64Content', 'base64ScriptContent', 'base64Tdf', 'base64Stdout', 'base64Stderr'}

        # Dictionary
        self.__headers = {}

        # Dictionary
        self.req = {}
        self.res = {}

    def __check_session(self, required_login='Y'):
        r"""Check Session.
            1. check required login
            2. check exist session
            3. set userSessionId in http header
        :param required_login: 'Y' is Required Login(default), 'N' is Not Required Login
        :return: True or False
        """
        # for Interface Log
        if 'login_info' in session and 'user_id' in session.get('login_info'):
            self.__user_id = session['login_info']['user_id']

        # 'Y' : Required Login, 'N' : Not Required Login
        if required_login == 'N':
            return True

        if 'login_info' not in session or 'userSessionId' not in session.get('login_info'):
            current_app.logger.error("Do not found session.")
            return False

        # self.__headers['Content-type'] = 'application/json;charset=UTF-8'
        self.__headers['Authorization'] = 'Bearer ' + session['login_info']['userSessionId']
        return True

    def __login(self):
        # Login
        url = '/user-sessions'
        req_bak = self.req
        self.req = {'id': session['login_info']['user_id'], 'password': session['login_info']['password']}

        result = self.__rest_call(url, 'POST', 'N')
        if not result:
            return False

        # Login Fail (Unknown Id, Password)
        if self.res['resultCode'] != OpmmResultCode.EM0000:
            msg = "[{0}] {1}".format(self.res['resultCode'], self.res['resultMsg'])
            current_app.logger.error(msg)
            return False

        # Login Success
        # session 생성
        session['login_info']['userSessionId'] = self.res['userSessionId']
        session['login_info']['privilege'] = self.res['privilege']
        session.modified = True

        self.req = req_bak
        return True

    def __rest_call(self, url, method, required_login):
        if not self.__check_session(required_login):
            return False

        # private ssl warning disable
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

        # Request Logging
        interface_logger = logging.getLogger('interface')

        field_dict = {}
        for key, value in self.req.items():
            if self.__mask_yn and key in self.__mask_field:  # masking data
                field_dict[key + "_mask"] = '*' * 10  # **********
                continue

            if key in self.__skip_field:  # skip data
                field_dict[key] = "[LOB]"  # Large Object Block (Too Long)
                continue

            field_dict[key] = value

        interface_logger.info('[OPMM][REQ][{0}][{1}] - {2}:{3}'.format(
            method, self.__user_id, url, json.dumps(field_dict, ensure_ascii=False)
        ))

        # for Debug
        # current_app.logger.error("[SESSION][REST][{0}]".format(self.__headers))

        try:
            if method == 'GET':
                response = requests.get(self.__target + url, params=self.req, headers=self.__headers,
                                        verify=self.__verify, timeout=self.__timeout)
            elif method == 'POST':
                response = requests.post(self.__target + url, data=json.dumps(self.req), headers=self.__headers,
                                         verify=self.__verify, timeout=self.__timeout)
            elif method == 'PUT':
                response = requests.put(self.__target + url, data=json.dumps(self.req), headers=self.__headers,
                                        verify=self.__verify, timeout=self.__timeout)
            elif method == 'DELETE':
                response = requests.delete(self.__target + url, params=self.req, headers=self.__headers,
                                           verify=self.__verify, timeout=self.__timeout)
            else:
                msg = 'Unknown method.({0})'.format(method)
                current_app.logger.error(msg)
                raise Exception(msg)
            # print('[baba] url : ', response.request.url)
            # print('[baba] body : ', response.request.body)

        except requests.exceptions.ConnectionError as ce:
            msg = 'OPMM connection error : {0}'.format(self.__target + url)
            current_app.logger.error(msg)
            current_app.logger.error("Details : {0}".format(ce))
            return False

        except Exception as e:
            msg = 'Unknown Error : {0}'.format(e)
            current_app.logger.error(msg)
            raise e

        # Binding Response
        self.res = json.loads(response.text)

        # Response Logging
        # print('[baba] status code : ', response.status_code)
        # interface_logger.info('[OPMM][RES] - {0}:{1}'.format(url, response.json()))
        field_dict = {}
        for key, value in self.res.items():
            if self.__mask_yn and key in self.__mask_field:  # masking data
                field_dict[key + "_mask"] = '*' * 10  # **********
                continue

            if key in self.__skip_field:  # skip data
                field_dict[key] = "[LOB]"  # Large Object Block (Too Long)
                continue

            field_dict[key] = value

        interface_logger.info('[OPMM][RES][{0}][{1}] - {2}:{3}'.format(
            method, self.__user_id, url, json.dumps(field_dict, ensure_ascii=False)
        ))

        # check http response code
        if response.status_code not in [200, 400, 401]:
            msg = '{0} : {1} - {2}'.format(response.status_code, self.res['resultCode'], self.res['resultMsg'])
            current_app.logger.error(msg)
            return False

        return True

    def get(self, url, required_login='Y'):
        result = self.__rest_call(url, 'GET', required_login)
        # False
        if not result:
            return False

        # Check Login session. & Retry
        if self.res['resultCode'] == OpmmResultCode.EM1001:
            result = self.__login()
            if not result:
                current_app.logger.error("Failed to login retry.")
                return False

            # Retry rest call
            if not self.__rest_call(url, 'GET', required_login):
                return False

        return True

    def post(self, url, required_login='Y'):
        # False
        if not self.__rest_call(url, 'POST', required_login):
            return False

        # Check Login session. & Retry
        if self.res['resultCode'] == OpmmResultCode.EM1001 and not url.endswith('/user-sessions'):
            result = self.__login()
            if not result:
                current_app.logger.error("Failed to login retry.")
                return False

            # Retry rest call
            if not self.__rest_call(url, 'POST', required_login):
                return False

        return True

    def put(self, url, required_login='Y'):
        # False
        if not self.__rest_call(url, 'PUT', required_login):
            return False

        # Check Login session. & Retry
        # - Result code EM1001 that Change user password. (/users/user_id?mode=passwd)
        if self.res['resultCode'] == OpmmResultCode.EM1001 and not url.endswith('?mode=passwd'):
            result = self.__login()
            if not result:
                current_app.logger.error("Failed to login retry.")
                return False

            # Retry rest call
            if not self.__rest_call(url, 'PUT', required_login):
                return False

        return True

    def delete(self, url, required_login='Y'):
        # False
        if not self.__rest_call(url, 'DELETE', required_login):
            return False

        # Check Login session. & Retry
        if self.res['resultCode'] == OpmmResultCode.EM1001:
            result = self.__login()
            if not result:
                current_app.logger.error("Failed to login retry.")
                return False

            # Retry rest call
            if not self.__rest_call(url, 'DELETE', required_login):
                return False

        return True


def opmm_login(login_info):
    """
    로그인
    :return: True/False, res
    """
    rest_login = RestClient()
    url = '/user-sessions'
    rest_login.req = {'id': login_info['user_id'], 'password': login_info['password']}

    if not rest_login.post(url, required_login='N'):
        rest_login.res['resultCode'] = OpmmResultCode.EM0999
        rest_login.res['resultMsg'] = "OPMATE Master 서버에 접속할 수 없습니다. 관리자에게 문의하세요."

        msg = "[{0}] {1}".format(rest_login.res['resultCode'], rest_login.res['resultMsg'])
        current_app.logger.error(msg)

        return False, rest_login.res

    # Login Fail (Unknown Id, Password)
    if rest_login.res['resultCode'] != OpmmResultCode.EM0000:
        msg = "[{0}] {1}".format(rest_login.res['resultCode'], rest_login.res['resultMsg'])
        current_app.logger.error(msg)

        return False, rest_login.res

    return True, rest_login.res


def opmm_logout():
    """
    로그아웃
    :return: True/False, res
    """
    rest_logout = RestClient()
    url = '/user-sessions'

    if not rest_logout.delete(url):
        rest_logout.res['resultCode'] = OpmmResultCode.EM0999
        rest_logout.res['resultMsg'] = "OPMATE Master 서버에 접속할 수 없습니다. 관리자에게 문의하세요."

        msg = "[{0}] {1}".format(rest_logout.res['resultCode'], rest_logout.res['resultMsg'])
        current_app.logger.error(msg)

        return False, rest_logout.res

    # Logout Fail (Unknown Id, Password)
    if rest_logout.res['resultCode'] != OpmmResultCode.EM0000:
        msg = "[{0}] {1}".format(rest_logout.res['resultCode'], rest_logout.res['resultMsg'])
        current_app.logger.error(msg)

        return False, rest_logout.res

    return True, rest_logout.res
