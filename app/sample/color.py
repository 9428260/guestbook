from flask import Blueprint, render_template

bp = Blueprint('sample_color', __name__)


@bp.route('/color', methods=['GET'])
def render_page():
    """
    REST API call test
    :return:
    """
    return render_template('sample/color.html')
