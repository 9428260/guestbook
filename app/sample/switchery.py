from flask import Blueprint, render_template

bp = Blueprint('sample_switchery', __name__)


@bp.route('/switchery', methods=['GET'])
def render_page():
    """
    REST API call test
    :return:
    """
    return render_template('sample/switchery.html')
