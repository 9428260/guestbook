#!/bin/sh

cd ${OPME_HOME}/apps;
# nohup gunicorn --bind 0.0.0.0:5000 --workers 2 --pid ${OPME_HOME}/logs/opme.pid manage:app &

# (from Nginx)
# gunicorn --bind unix:${OPME_HOME}/logs/opme.sock --workers 2 --timeout 180 --daemon --pid ${OPME_HOME}/logs/opme.pid manage:app
# gunicorn --bind 0.0.0.0:5000 --workers 2 --timeout 180 --daemon --access-logfile ${OPME_HOME}/logs/gunicorn/access.log --error-logfile ${OPME_HOME}/logs/gunicorn/error.log --pid ${OPME_HOME}/bin/opme.pid manage:app -k gevent;
# gunicorn --bind 0.0.0.0:5000 --workers 1 --timeout 180 --daemon --access-logfile ${OPME_HOME}/logs/gunicorn/access.log --error-logfile ${OPME_HOME}/logs/gunicorn/error.log --pid ${OPME_HOME}/bin/opme.pid manage:app -k gevent;
# gunicorn --bind 0.0.0.0:5000 --workers 1 --threads 3 --timeout 180 --daemon --access-logfile ${OPME_HOME}/logs/gunicorn/access.log --error-logfile ${OPME_HOME}/logs/gunicorn/error.log --pid ${OPME_HOME}/bin/opme.pid manage:app;
gunicorn --config ./app/conf/gunicorn_config.py manage:app;

exit 0;
