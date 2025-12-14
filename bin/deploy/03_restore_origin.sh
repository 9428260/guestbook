#!/bin/sh

BASE_DTM=$(date +%y%m%d%H%M);
DASHES="--------------------------------------------------";

# OPME
OPME_DEPLOY_HOME=${OPME_HOME}/deploy

# OS Account : opme
if [ $(whoami) != "opme" ]
then
    echo "Now $(whoami). Please Login opme";
    exit 1;
fi;

# 상태 점검
## nginx
if [ $(sh ${OPME_HOME}/bin/nginx_status.sh | wc -l) -eq 4 ]
then
    echo "Check Nginx Stop..";
    echo "sh ${OPME_HOME}/bin/nginx_stop.sh";
    exit 1;
fi;
## opme
if [ $(sh ${OPME_HOME}/bin/opme_status.sh | wc -l) -eq 2 ]
then
    echo "Check OPME Stop..";
    echo "sh ${OPME_HOME}/bin/opme_stop.sh";
    exit 1;
fi;

echo ${DASHES};
sleep 1 && echo "Step 3.1 Now Ready to Restore...";
echo ${DASHES};

echo ${DASHES};
sleep 1 && echo "Step 3.2 Clear Directory..";
echo ${DASHES};

rm -rf ${OPME_HOME}/apps;

echo ${DASHES};
sleep 1 && echo "Step 3.3 Unzip origin File..";
echo ${DASHES};

cd ${OPME_DEPLOY_HOME}/origin;
tar -zxf apps.tgz -C ${OPME_DEPLOY_HOME}/origin/ > /dev/null;
cd -;

echo ${DASHES};
sleep 1 && echo "Step 3.4 Restore Complete & Check Service..";
echo ${DASHES};

cp -rpf ${OPME_DEPLOY_HOME}/origin/apps ${OPME_HOME};

echo ${DASHES};
echo "Restore Step Done..";
echo ${DASHES};

exit 0;
