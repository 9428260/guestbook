from flask import Blueprint, render_template

bp = Blueprint('sample_select_multi', __name__)


@bp.route('/select_multi', methods=['GET'])
def render_page():
    """
    REST API call test
    :return:
    """
    return render_template('sample/select_multi.html')
