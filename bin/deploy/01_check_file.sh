#!/bin/sh

BASE_DTM=$(date +%y%m%d%H%M);
DASHES="--------------------------------------------------";

# 유효한 git token 이 필요하다.
GITHUB_TOKEN_ENC="Z2hwX1duNmQ1ZUhVM2VFTHlCaEFiZm5GUjBzMU13QXVJSTBkckFydgo=";
GITHUB_TOKEN=$(echo ${GITHUB_TOKEN_ENC} | base64 -d);

# OPME
SITE_CD=${OPME_SITE_CD}
OPME_VERSION=
OPME_PKG_NM=
OPME_DEPLOY_HOME=${OPME_HOME}/deploy

function usage_sh()
{
    echo "[ERROR] Can't execute this script.";
    echo " 1) Check Git Token : Please edit GITHUB_TOKEN in this script.";
    echo " 2) Check Site Code : Please edit SITE_CD in this script.";
    return;
}

function usage_git()
{
    echo "[ERROR] Can't access git repository. (${OPME_VERSION})";
    echo " 1) Check Git Token..";
    echo " 2) Check Tag Number..";
    echo " 3) Check Network....";
    return;
}

# OS Account : opme
if [ $(whoami) != "opme" ]
then
    echo "Now $(whoami). Please Login opme";
    exit 1;
fi;

if [ -z ${GITHUB_TOKEN} ] || [ -z ${SITE_CD} ]
then
    usage_sh
    exit 1;
fi;

# deploy folder
if [ ! -d ${OPME_DEPLOY_HOME} ]
then
    mkdir ${OPME_DEPLOY_HOME};
fi;

# deploy path 로 이동
cd ${OPME_DEPLOY_HOME};

echo ${DASHES};
sleep 1 && echo "Step 1.1 Get patch file from Repository..";
echo ${DASHES};

# 파일을 github에서 가져온다.
echo "Please enter the version to download.";
echo " - latest    : Latest version in current repository.";
echo " - vYYYYMMDD : Tag name in current repository.";
echo -n "version : ";
read OPME_VERSION;

if [ -z ${OPME_VERSION} ]
then
    echo "-- Tag is empty. Check Tag number....";
    exit 1;
fi;

if [ ${OPME_VERSION} = "latest" ]
then
    echo "Now Get Latest Version....";
    wget --header="Authorization: token ${GITHUB_TOKEN}" https://github.com/inmoya/OpmateWeb/tarball/refs/heads/master -O opme.tgz;
else
    echo "-- Tag is ${OPME_VERSION}. Get Tag Version.";
    wget --header="Authorization: token ${GITHUB_TOKEN}" https://github.com/inmoya/opme/archive/refs/tags/${OPME_VERSION}.tar.gz -O opme.tgz;
fi;

if [ $? -ne 0 ]
then
    usage_git
    exit 1;
fi;

OPME_PKG_NM=opme.${BASE_DTM}.${OPME_VERSION}.tgz
cp opme.tgz ${OPME_HOME}/deploy/${OPME_PKG_NM};
cd -;

echo ${DASHES};
sleep 1 && echo "Step 1.2 Make Origin file..";
echo ${DASHES};

# deploy file / origin file 생성
if [ -d ${OPME_DEPLOY_HOME}/origin ]
then
    rm -rf ${OPME_DEPLOY_HOME}/origin;
fi;

mkdir ${OPME_DEPLOY_HOME}/origin;

# 기존 apps -> origin 으로 Contingency 대기
if [ ! -d ${OPME_HOME}/apps ]
then
    echo "[Check] - Directory '${OPME_HOME}/apps' ..";
    exit 1;
fi;

cd ${OPME_HOME};
tar -zcvf ${OPME_DEPLOY_HOME}/origin/apps.tgz ./apps > /dev/null;
cd -;

# opme conf 복제 : gunicorn, opme, blueprint 등
if [ ! -d ${OPME_HOME}/apps/app/conf ]
then
    echo "[Check] - Directory '${OPME_HOME}/apps/app/conf";
    exit 1;
fi;
cp -r ${OPME_HOME}/apps/app/conf ${OPME_DEPLOY_HOME}/origin/;

# opmedoc 복제 -> 디렉토리 존재 여부만 확인(2023.10.31)
if [ ! -d ${OPME_HOME}/apps/opmedocs ]
then
    echo "[Check] - Directory '${OPME_HOME}/apps/opmedocs";
    exit 1;
fi;

# 원복 복제 코드 주석 처리(2023.10.31)
# cp -r ${OPME_HOME}/apps/opmedocs ${OPME_DEPLOY_HOME}/origin/;

# bin 복제
if [ ! -d ${OPME_HOME}/bin ]
then
    echo "[Check] - Directory '${OPME_HOME}/bin";
    exit 1;
fi;
cp -r ${OPME_HOME}/bin ${OPME_DEPLOY_HOME}/origin/;

# conf 의 pycache 삭제
if [ -d ${OPME_DEPLOY_HOME}/origin/conf/__pycache__ ]
then
    rm -rf ${OPME_DEPLOY_HOME}/origin/conf/__pycache__;
fi;

echo ${DASHES};
sleep 1 && echo "Step 1.3 Unzip file.. ";
echo ${DASHES};

# gzip 파일을 푼다.
if [ -d ${OPME_DEPLOY_HOME}/new ]
then
    rm -rf ${OPME_DEPLOY_HOME}/new;
fi;
mkdir -p ${OPME_DEPLOY_HOME}/new;

tar --strip-components=1 -xvf ${OPME_DEPLOY_HOME}/opme.tgz -C ${OPME_DEPLOY_HOME}/new > /dev/null;

if [ $? -ne 0 ]
then
    echo "[Check] - File '${OPME_DEPLOY_HOME}/opme.tgz'";
    exit 1;
fi;

if [ -f ${OPME_DEPLOY_HOME}/opme.tgz ]
then
    rm -f ${OPME_DEPLOY_HOME}/opme.tgz;
fi;

# Site custom
cp -f ${OPME_DEPLOY_HOME}/new/sites/${SITE_CD}/requirements.txt ${OPME_DEPLOY_HOME}/new/requirements.txt;
if [ $? -ne 0 ]
then
    echo "[ERROR] Failed to copy files.(requirements.txt)";
    exit 1;
fi;

cp -f ${OPME_DEPLOY_HOME}/new/sites/${SITE_CD}/opme/manage.py ${OPME_DEPLOY_HOME}/new/manage.py;
if [ $? -ne 0 ]
then
    echo "[ERROR] Failed to copy files.(manage.py)";
    exit 1;
fi;

cp -f ${OPME_DEPLOY_HOME}/new/sites/${SITE_CD}/opme/opme_config.py ${OPME_DEPLOY_HOME}/new/app/conf/opme_config.py;
if [ $? -ne 0 ]
then
    echo "[ERROR] Failed to copy files.(opme_config.py)";
    exit 1;
fi;

cp -f ${OPME_DEPLOY_HOME}/new/sites/${SITE_CD}/gunicorn/gunicorn_config.py ${OPME_DEPLOY_HOME}/new/app/conf/gunicorn_config.py;
if [ $? -ne 0 ]
then
    echo "[ERROR] Failed to copy files.(gunicorn_config.py)";
    exit 1;
fi;

# unzip 된 내용을 diff 한다.
echo ${DASHES};
sleep 1 && echo "Step 1.4 Diff with Patch File..";
echo ${DASHES};

diff -urN ${OPME_HOME}/apps/requirements.txt ${OPME_DEPLOY_HOME}/new/requirements.txt | egrep '^diff' >  ${OPME_DEPLOY_HOME}/check_patch.${BASE_DTM};
diff -urN ${OPME_HOME}/apps/manage.py        ${OPME_DEPLOY_HOME}/new/manage.py        | egrep '^diff' >> ${OPME_DEPLOY_HOME}/check_patch.${BASE_DTM};
diff -urN ${OPME_HOME}/apps/app              ${OPME_DEPLOY_HOME}/new/app              | egrep '^diff' >> ${OPME_DEPLOY_HOME}/check_patch.${BASE_DTM};
diff -urN ${OPME_HOME}/bin                   ${OPME_DEPLOY_HOME}/new/bin              | egrep '^diff' >> ${OPME_DEPLOY_HOME}/check_patch.${BASE_DTM};

# 파일을 확인한다.
echo ${DASHES};
sleep 1 && echo "Step 1.5 open ${OPME_DEPLOY_HOME}/check_patch.${BASE_DTM}";
echo ${DASHES};
echo ${DASHES};
echo "Next Step: run 02.apply_file.sh.";
echo ${DASHES};

exit 0;

