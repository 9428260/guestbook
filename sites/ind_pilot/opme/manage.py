import os

from flask import url_for, session
from flask_script import Manager, Server
from werkzeug.utils import redirect

from app import create_app

# app = create_app(config_name='dev')
app = create_app(os.getenv('OPME_ENV') or 'dev')
manager = Manager(app)

# @manager.command
# def runserver():
#     app.run()


@app.route('/', methods=['GET'])
def index():
    if 'login_info' in session and 'user_id' in session['login_info']:
        # return redirect(url_for('dashboard.render_dashboard'))
        # return render_template('index.html')
        # return render_template('/task/execution_lst.html')
        return redirect(url_for('execution.render_page'))

    return redirect(url_for('user.login.render_login'))


if __name__ == "__main__":
    manager.run()
