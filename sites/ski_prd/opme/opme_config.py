import os
import logging

basedir = os.path.abspath(os.path.dirname(__file__))


class Config(object):
    SITE_NAME = '[PRD] SK Innovation'
    OPME_VERSION = 'v20241206'
    OPMM_MIN_VERSION = 'OPMM Version 2.0.301'
    OPMM_MAX_VERSION = 'OPMM Version 2.0.320'
    DEBUG = False
    JSON_SORT_KEYS = False  # json auto sort
    # JSON_AS_ASCII = False
    OPMM_FILE_TRANSFORM_UNIT = 1024 * 1024 * 10  # 10 MB
    OPMM_PUBLISHER_SEPARATE_ENABLE = 'no'  # OPMM master.conf - yes : owner != publisher, no : owner == publisher
    OPMM_TCS_VERIFY_ENABLE = 'yes'  # OPMM TCS 활성화 여부 yes : 활성화, no : 비활성화
    SESSION_COOKIE_NAME = 'opme'  # 다른 이름 필요한 경우 DevelopmentConfig/ProductionConfig 에 각각 선언
    SSE_ENABLE = 'yes'


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

    NOTILIST_CONDITION = [{'value': 'all', 'text': '항상'},
                          {'value': 'success', 'text': '성공'},
                          {'value': 'fail', 'text': '실패'}]

    NOTILIST_EVENT = [{'value': 'ES', 'text': '실행 알림'},
                      {'value': 'ET', 'text': '종료 알림'}]

    NOTILIST_METHOD = [{'value': 'mail', 'text': '메일'}]


class ProductionConfig(Config):
    DEBUG = False

    # OPME Logging
    OPME_LOG_LOCATION = '/home/opme/opme/logs/opme'
    OPME_LOG_FORMAT = '[%(levelname)s][%(asctime)s][%(process)d][%(thread)d][%(filename)s:%(funcName)s(%(lineno)d)] - %(message)s'
    OPME_LOG_LEVEL = logging.ERROR  # DEBUG, INFO, WARNING, ERROR, CRITICAL
    OPME_LOG_FILENAME = 'opme.log'
    OPME_LOG_MAX_BYTES = 1024 * 1024 * 10  # 10M
    OPME_LOG_BACKUP_COUNT = 10

    # Interface Logging
    INTERFACE_LOG_LOCATION = '/home/opme/opme/logs/opme'
    INTERFACE_LOG_FORMAT = '[%(levelname)s][%(asctime)s]%(message)s'
    INTERFACE_LOG_LEVEL = logging.INFO  # DEBUG, INFO, WARNING, ERROR, CRITICAL
    INTERFACE_LOG_FILENAME = 'interface.log'
    INTERFACE_LOG_MAX_BYTES = 1024 * 1024 * 10  # 10M
    INTERFACE_LOG_BACKUP_COUNT = 10

    # Session
    OPME_SESSION_TIME_OUT = 60  # minutes

    # OPMM REST API URL
    OPMM_REST_API_URL = 'https://10.90.80.203:8443/opmate/v2.0'
    # File Download(from OPMM)
    OPMM_FILE_DOWNLOAD_PATH = '/home/opme/downloads/opmm/downloads'
    OPME_FILE_EXPORT_PATH = '/home/opme/opme/files/opme/export'

    NOTILIST_CONDITION = [{'value': '', 'text': '항상'},
                          {'value': 'success', 'text': '성공'},
                          {'value': 'fail', 'text': '실패'}]

    NOTILIST_EVENT = [{'value': 'ES', 'text': '실행 알림'},
                      {'value': 'ET', 'text': '종료 알림'}]

    NOTILIST_METHOD = [{'value': 'mail', 'text': '메일'}]


config_by_name = dict(
    dev=DevelopmentConfig,
    prod=ProductionConfig,
)
