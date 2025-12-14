#!/bin/sh

PID_FILE=${OPME_HOME}/bin/opme.pid

ps -ef | grep opme | grep gunicorn | grep -v grep;

if ! [ -f ${PID_FILE} ]
then
    echo "Can't stop gunicorn.";
    exit 1;
fi;

echo "Stopping gunicorn($(cat ${PID_FILE}))";
kill $(cat ${PID_FILE});

exit 0;
