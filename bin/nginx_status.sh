#!/bin/sh

ps -ef | grep opme | grep nginx | grep -v grep | grep -v $0;
exit 0;
