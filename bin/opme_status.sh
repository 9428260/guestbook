#!/bin/sh

ps -ef | grep opme | grep gunicorn | grep -v grep;
exit 0;
