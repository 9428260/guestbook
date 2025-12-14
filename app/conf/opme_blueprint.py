def register_bp(app):

    # Common
    from app.common.common import bp as menu
    app.register_blueprint(menu, url_prefix='/common')

    # Sample
    from app.sample.rest import bp as rest
    app.register_blueprint(rest, url_prefix='/sample')

    from app.sample.color import bp as color
    app.register_blueprint(color, url_prefix='/sample')

    from app.sample.switchery import bp as switchery
    app.register_blueprint(switchery, url_prefix='/sample')

    from app.sample.select_multi import bp as select_multi
    app.register_blueprint(select_multi, url_prefix='/sample')

    # Welcome Page (Dashboard)
    from app.common.dashboard import bp as dashboard
    app.register_blueprint(dashboard, url_prefix='/dashboard')

    # User
    from app.user.login import bp as login
    app.register_blueprint(login, url_prefix='/user')

    from app.user.user import bp as user
    app.register_blueprint(user, url_prefix='/user')

    from app.user.usergrp import bp as usergrp
    app.register_blueprint(usergrp, url_prefix='/usergroup')

    from app.user.role import bp as role
    app.register_blueprint(role, url_prefix='/role')

    # Node
    from app.node.node import bp as node
    app.register_blueprint(node, url_prefix='/node')

    # Nodereview
    from app.node.nodereview import bp as nodereview
    app.register_blueprint(nodereview, url_prefix='/nodereview')

    # Task
    from app.task.task import bp as task
    app.register_blueprint(task, url_prefix='/task')

    # Task Publish List
    from app.task.publist import bp as publist
    app.register_blueprint(publist, url_prefix='/publist')

    # Task Execution
    from app.task.execution import bp as execution
    app.register_blueprint(execution, url_prefix='/execution')

    # Dictionary
    from app.task.dctnry import bp as dctnry
    app.register_blueprint(dctnry, url_prefix='/dctnry')

    # File
    from app.file.file import bp as file
    app.register_blueprint(file, url_prefix='/file')

    from app.file.filehub import bp as filehub
    app.register_blueprint(filehub, url_prefix='/filehub')

    # System
    from app.system.acckey import bp as acckey
    app.register_blueprint(acckey, url_prefix='/acckey')

    from app.system.system import bp as system
    app.register_blueprint(system, url_prefix='/system')
