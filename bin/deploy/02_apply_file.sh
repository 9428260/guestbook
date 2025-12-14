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

cd ${OPME_DEPLOY_HOME};
#docs external_pkg opme.tgz

# deploy 파일 일괄 교체 후 불필요 삭제

echo ${DASHES};
sleep 1 && echo "Step 2.1 Make As-Is to origin.. ";
echo ${DASHES};

#rm -f ${HOME}/patch/origin/*;

# mv 는 목적지가 비어있지 않으면 실패함. --> cp로 변경
mv ${OPME_HOME}/apps ${OPME_DEPLOY_HOME}/origin/apps_${BASE_DTM};
if [ $? -ne 0 ]
then
    echo "[Check] ${OPME_HOME}/apps";
    exit 1;
fi;

echo ${DASHES};
sleep 1 && echo "Step 2.2 Apply patch file.. ";
echo ${DASHES};

cp -f  ${OPME_DEPLOY_HOME}/new/bin/*.sh ${OPME_HOME}/bin/;
if [ $? -ne 0 ]
then
    echo "[Check] ${OPME_DEPLOY_HOME}/new/bin/*.sh";
    exit 1;
fi;

# cp -rf  ${OPME_DEPLOY_HOME}/new/bin/deploy ${OPME_HOME}/bin/;
# if [ $? -ne 0 ]
# then
#     echo "[Check] ${OPME_DEPLOY_HOME}/new/bin/deploy";
#     exit 1;
# fi;

if [ ! -d ${OPME_HOME}/apps ]
then
    mkdir ${OPME_HOME}/apps;
fi;

cp -rf ${OPME_DEPLOY_HOME}/new/app ${OPME_HOME}/apps/;
if [ $? -ne 0 ]
then
    echo "[Check] ${OPME_DEPLOY_HOME}/new/app";
    exit 1;
fi;

cp -rf ${OPME_DEPLOY_HOME}/new/requirements.txt ${OPME_HOME}/apps/requirements.txt;
if [ $? -ne 0 ]
then
    echo "[Check] ${OPME_DEPLOY_HOME}/new/requirements.txt";
    exit 1;
fi;

cp -rf ${OPME_DEPLOY_HOME}/new/favicon.ico ${OPME_HOME}/apps/favicon.ico;
if [ $? -ne 0 ]
then
    echo "[Check] ${OPME_DEPLOY_HOME}/new/favicon.ico";
    exit 1;
fi;

cp -rf ${OPME_DEPLOY_HOME}/new/manage.py ${OPME_HOME}/apps/manage.py;
if [ $? -ne 0 ]
then
    echo "[Check] ${OPME_DEPLOY_HOME}/new/manage.py";
    exit 1;
fi;


# 적용 후 파일 삭제 - if문 추가
echo ${DASHES};
sleep 1 && echo "Step 2.3 Clear some files.. ";
echo ${DASHES};

# opmedoc re-copy (cp option -a = -rp )
#cp -af ${OPME_DEPLOY_HOME}/origin/opmedocs ${OPME_HOME}/apps/opmedocs;

if [ -f ${OPME_DEPLOY_HOME}/new/opmedocs.zip ]
then
    mkdir ${OPME_HOME}/apps/opmedocs/;
    cp -rf ${OPME_DEPLOY_HOME}/new/opmedocs.zip ${OPME_HOME}/apps/opmedocs/opmedocs.zip;
fi;

if [ -f ${OPME_HOME}/apps/opmedocs/opmedocs.zip ]
then
    unzip ${OPME_HOME}/apps/opmedocs/opmedocs.zip -d ${OPME_HOME}/apps/opmedocs/;
    rm -f ${OPME_HOME}/apps/opmedocs/opmedocs.zip
fi;

echo ${DASHES};
echo "Next Step: Service Start.";
echo "1. run ${OPME_HOME}/bin/opme_start.sh.";
echo "2. run ${OPME_HOME}/bin/nginx_start.sh.";
echo ${DASHES};
#===========================
# opme -nginx 를 내린다.
# opme 를 내린다.
# 파일을 반영한다.
# conf 확인 후 반영한다.
# opme 를 올린다.
# opme -nginx 를 올린다.
#===========================

exit 0;
