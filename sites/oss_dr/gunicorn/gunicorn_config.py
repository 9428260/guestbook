import gunicorn

gunicorn.SERVER = 'opme'
bind = '0.0.0.0:8083'
workers = 1
timeout = 180
threads = 10
# max_requests = 16
# max_requests_jitter = 16
pidfile = '/home/opme/opme/bin/opme.pid'
daemon = True
logconfig_dict = dict(
    version=1,
    loggers={
        "root": {
            "level": "INFO",
            "handlers": ["console"]
        },
        "gunicorn.error": {
            "level": "INFO",
            "handlers": ["error_file"],
            "propagate": True,
            "qualname": "gunicorn.error"
        },
        "gunicorn.access": {
            "level": "INFO",
            "handlers": ["access_file"],
            "propagate": False,
            "qualname": "gunicorn.access"
        }
    },
    handlers={
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "generic",
            "stream": "ext://sys.stdout",
        },
        "error_file": {
            "class": "logging.handlers.RotatingFileHandler",
            "level": "INFO",
            "formatter": "generic",
            "filename": "/home/opme/opme/logs/gunicorn/error.log",
            "mode": "a",
            "maxBytes": 10485760,
            "backupCount": 5,
        },
        "access_file": {
            "class": "logging.handlers.RotatingFileHandler",
            "level": "INFO",
            "formatter": "access",
            "filename": "/home/opme/opme/logs/gunicorn/access.log",
            "mode": "a",
            "maxBytes": 10485760,
            "backupCount": 5,
        },
    },
    formatters={
        "generic": {
            "format": "[%(levelname)s][%(asctime)s][%(process)d][%(thread)d][%(filename)s:%(funcName)s(%(lineno)d)] - %(message)s",
            "datefmt": "[%Y-%m-%d %H:%M:%S %z]",
            "class": "logging.Formatter"
        },
        "access": {
            "format": "%(message)s",
            "class": "logging.Formatter"
        }
    }
)
