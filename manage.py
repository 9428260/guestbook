import os

from flask import Flask, url_for, session
#from flask_script import Manager, Server
from werkzeug.utils import redirect

from app import create_app

# app = create_app(config_name='dev')
app = create_app(os.getenv('OPME_ENV') or 'dev')
#manager = Manager(app)

'''
개발환경에서 flask-script 의 default command 인 runserver 로 기동하면,
Multi End Point(SessionID가 다른 Browser 의 다중 접근)에서 하나의 End Point 를 제외하고 pending 이 발생한다.
이를 해결하기 위해서는 아래처럼 threaded 또는 process 옵션을 사용하거나,
runserver 커맨드를 재정의하여 Default 커맨드를 수행하지 않도록 하면 된다.
(default Server 에는 max end point 관련 로직이 있는데, 분석하지는 않음.)
운영은 gunicorn 이 있고, 개발은 하나의 End Point 면 되기에 굳이 적용하지는 않고 사용한다.

# manager.add_command("runserver", Server(host="0.0.0.0", port=5000, threaded=True))
'''
#manager.add_command("runserver", Server(host="0.0.0.0", port=5000, threaded=True))

# @manager.command
# def runserver():
#     app.run()


@app.route('/', methods=['GET'])
def index():
    if 'login_info' in session and 'user_id' in session['login_info']:
        # return redirect(url_for('execution.render_page'))
        return redirect(url_for('common_dashboard.render_page'))

    return redirect(url_for('user_login.render_login'))


if __name__ == "__main__":
#    manager.run()
    app.run(host="0.0.0.0", port=5002, threaded=True)
