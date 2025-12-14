from flask import Blueprint, render_template

from app.user import login_required

bp = Blueprint('common_dashboard', __name__)


@bp.route('/', methods=['GET'])
@login_required
def render_page():
    """
    REST API call test
    :return:
    """
    return render_template('dashboard.html')
