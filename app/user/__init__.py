from functools import wraps
from flask import session, current_app
from werkzeug.exceptions import abort

from app.interface.restclient import opmm_login, opmm_logout


def login_required(f):
    @wraps(f)
    def wrap(*args, **kwargs):
        # Print Http Request Information.
        # current_app.logger.debug("---------- Http Request Information. ----------")
        # current_app.logger.debug("request.url_rule=<%r>" % request.url_rule.rule)
        # current_app.logger.debug("request.remote_addr=<%r>" % request.remote_addr)
        # current_app.logger.debug("request.endpoint=<%r>" % request.endpoint)
        # current_app.logger.debug("request.user_agent=<%r>" % request.user_agent)
        # current_app.logger.debug("request.args=<%s>" % str(request.args))
        # current_app.logger.debug("kwargs=<%r>" % kwargs)
        # current_app.logger.debug("f=<%r>" % f)
        # current_app.logger.debug("-----------------------------------------------")

        if 'login_info' not in session:
            abort(401)

        if 'user_id' not in session['login_info']:
            abort(401)

        if 'password' not in session['login_info']:
            abort(401)

        if 'userSessionId' not in session['login_info']:
            abort(401)

        if 'loginYn' not in session['login_info']:
            abort(401)

        if session['login_info']['loginYn'] == 'N':
            abort(401)

        return f(*args, **kwargs)

    return wrap


def opme_login(login_info):

    # opmm_login 호출 결과
    # - result=True 이면, msg 는 userSessionId
    # - result=False 이면, msg 는 Fail Message
    result, res = opmm_login(login_info)

    # OPMM Login Success
    if result:
        current_app.logger.info("login =<%r>" % login_info['user_id'])

        # session 생성
        session['login_info'] = {}
        session['login_info']['user_id'] = login_info['user_id']
        session['login_info']['password'] = login_info['password']
        session['login_info']['userSessionId'] = res['userSessionId']
        session['login_info']['privilege'] = res['privilege']

        # mfaKey 가 없는 경우, 2차인증 없이 로그인 완료.
        if res.get('mfaKey') is None or res.get('mfaKey') == '':
            session['login_info']['mfaKey'] = ''
            session['login_info']['loginYn'] = 'Y'
        else:  # mfaKey 가 존재하는 경우, 2차인증 후에 로그인 완료.
            session['login_info']['mfaKey'] = res['mfaKey']
            session['login_info']['loginYn'] = 'N'

        session.permanent = True
        # for Debug
        current_app.logger.debug("[SESSION][LOGIN][{0}]".format(session['login_info']['userSessionId']))
        current_app.logger.debug(session)

    return result, res


def opme_logout():

    result, res = opmm_logout()

    # OPMM Logout Success
    if result:
        current_app.logger.info("logout =<%r>" % session['login_info']['user_id'])

    # for Debug
    current_app.logger.debug("[SESSION][LOGOUT][{0}]".format(session['login_info']['userSessionId']))

    # session 삭제 - 성공/실패 모두 session 삭제
    session.pop('login_info', None)
    session.clear()

    return result, res
