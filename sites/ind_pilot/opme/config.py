import os
import logging

basedir = os.path.abspath(os.path.dirname(__file__))


class Config(object):
    SITE_NAME = 'SKCC'
    OPME_VERSION = 'v20220321'
    OPMM_MIN_VERSION = 'OPMM Version 2.0.20211222'
    OPMM_MAX_VERSION = 'OPMM Version 2.0.20211222'
    DEBUG = False
    # JSON_AS_ASCII = False
    OPMM_FILE_TRANSFORM_UNIT = 1024 * 1024 * 10  # 10 MB
    OPMM_PUBLISHER_SEPARATE_ENABLE = 'no'  # OPMM master.conf - yes : owner != publisher, no : owner == publisher


class DevelopmentConfig(Config):
    DEBUG = True

    # OPME Logging
    OPME_LOG_LOCATION = 'D:/PythonProject/opme/logs'
    OPME_LOG_FORMAT = '[%(levelname)s][%(asctime)s][%(filename)s:%(funcName)s(%(lineno)d)] - %(message)s'
    OPME_LOG_LEVEL = logging.DEBUG  # DEBUG, INFO, WARNING, ERROR, CRITICAL
    OPME_LOG_FILENAME = 'opme.log'
    OPME_LOG_MAX_BYTES = 1024 * 1024 * 10  # 10M
    OPME_LOG_BACKUP_COUNT = 10

    # Interface Logging
    INTERFACE_LOG_LOCATION = 'D:/PythonProject/opme/logs'
    INTERFACE_LOG_FORMAT = '[%(levelname)s][%(asctime)s]%(message)s'
    INTERFACE_LOG_LEVEL = logging.INFO  # DEBUG, INFO, WARNING, ERROR, CRITICAL
    INTERFACE_LOG_FILENAME = 'interface.log'
    INTERFACE_LOG_MAX_BYTES = 1024 * 1024 * 10  # 10M
    INTERFACE_LOG_BACKUP_COUNT = 10

    # Session
    OPME_SESSION_TIME_OUT = 180  # minutes

    # OPMM REST API URL
    OPMM_REST_API_URL = 'https://192.168.56.81:8443/opmate/v2.0'
    # File Download(from OPMM)
    OPMM_FILE_DOWNLOAD_PATH = 'D:/PythonProject/opmm/download'


class ProductionConfig(Config):
    DEBUG = False

    # OPME Logging
    OPME_LOG_LOCATION = '/home/opme/logs/opme'
    OPME_LOG_FORMAT = '[%(levelname)s][%(asctime)s][%(process)d][%(thread)d][%(filename)s:%(funcName)s(%(lineno)d)] - %(message)s'
    OPME_LOG_LEVEL = logging.ERROR  # DEBUG, INFO, WARNING, ERROR, CRITICAL
    OPME_LOG_FILENAME = 'opme.log'
    OPME_LOG_MAX_BYTES = 1024 * 1024 * 10  # 10M
    OPME_LOG_BACKUP_COUNT = 10

    # Interface Logging
    INTERFACE_LOG_LOCATION = '/home/opme/logs/opme'
    INTERFACE_LOG_FORMAT = '[%(levelname)s][%(asctime)s]%(message)s'
    INTERFACE_LOG_LEVEL = logging.INFO  # DEBUG, INFO, WARNING, ERROR, CRITICAL
    INTERFACE_LOG_FILENAME = 'interface.log'
    INTERFACE_LOG_MAX_BYTES = 1024 * 1024 * 10  # 10M
    INTERFACE_LOG_BACKUP_COUNT = 10

    # Session
    OPME_SESSION_TIME_OUT = 60  # minutes

    # OPMM REST API URL
    OPMM_REST_API_URL = 'https://127.0.0.1:8443/opmate/v2.0'
    # File Download(from OPMM)
    OPMM_FILE_DOWNLOAD_PATH = '/home/opme/downloads/opmm'


config_by_name = dict(
    dev=DevelopmentConfig,
    prod=ProductionConfig,
)
