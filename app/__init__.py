import datetime
import os
import logging
import logging.handlers
from logging import Formatter

from concurrent_log_handler import ConcurrentRotatingFileHandler
from flask import Flask, render_template

from app.conf.opme_config import config_by_name, Config
from whitenoise import WhiteNoise


def error_expire_session(e):
    return render_template('401.html'), 401


def create_app(config_name="prod"):
    app = Flask(__name__)

    app.wsgi_app = WhiteNoise(app.wsgi_app, root='opmedocs/', prefix='opmedocs/')
    
    # error handler
    app.register_error_handler(401, error_expire_session)

    # config
    app.config.from_object(config_by_name[config_name])

    # Session
    app.secret_key = 'fdc818ba-c738-11eb-8cdc-8c1645ffa57c'
    app.permanent_session_lifetime = datetime.timedelta(minutes=app.config['OPME_SESSION_TIME_OUT'])

    # register blueprint
    from app.conf.opme_blueprint import register_bp
    register_bp(app)

    # OPME Logging
    if os.path.isdir(app.config['OPME_LOG_LOCATION']) is False:
        os.mkdir(app.config['OPME_LOG_LOCATION'])

    log_full_path = "{}/{}".format(app.config['OPME_LOG_LOCATION'], app.config['OPME_LOG_FILENAME'])

    if config_name == 'prod':
        file_handler = logging.handlers.WatchedFileHandler(log_full_path, encoding='UTF-8')
    else:
        file_handler = ConcurrentRotatingFileHandler(log_full_path,
                                                    encoding='UTF-8',
                                                    maxBytes=app.config['OPME_LOG_MAX_BYTES'],
                                                    backupCount=app.config['OPME_LOG_BACKUP_COUNT'])

    file_handler.setFormatter(Formatter(app.config['OPME_LOG_FORMAT']))
    app.logger.setLevel(app.config['OPME_LOG_LEVEL'])
    app.logger.addHandler(file_handler)

    # Interface Logging
    interface_logger = logging.getLogger('interface')
    if os.path.isdir(app.config['INTERFACE_LOG_LOCATION']) is False:
        os.mkdir(app.config['INTERFACE_LOG_LOCATION'])

    log_full_path = "{}/{}".format(app.config['INTERFACE_LOG_LOCATION'], app.config['INTERFACE_LOG_FILENAME'])

    if config_name == 'prod':
        file_handler = logging.handlers.WatchedFileHandler(log_full_path, encoding='UTF-8')
    else:
        file_handler = ConcurrentRotatingFileHandler(log_full_path,
                                                    encoding='UTF-8',
                                                    maxBytes=app.config['INTERFACE_LOG_MAX_BYTES'],
                                                    backupCount=app.config['INTERFACE_LOG_BACKUP_COUNT'])

    file_handler.setFormatter(Formatter(app.config['INTERFACE_LOG_FORMAT']))
    interface_logger.setLevel(app.config['INTERFACE_LOG_LEVEL'])
    interface_logger.addHandler(file_handler)

    # File Download(from OPMM)
    if os.path.isdir(app.config['OPMM_FILE_DOWNLOAD_PATH']) is False:
        os.makedirs(app.config['OPMM_FILE_DOWNLOAD_PATH'])

    return app
