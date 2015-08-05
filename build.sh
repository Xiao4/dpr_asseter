#!/bin/bash

PNAME=dpr_asseter
VERSION=0.4.2

REPO_VERSION=`yum list $PNAME | grep $PNAME | awk '{print $2}' | awk -F ":|-" '{print $2}'`

if [[ -z ${REPO_VERSION} ]]
then
        echo "not found in repository, skip version checking"
else

        CURRENT_VERSION_VAL=`echo $VERSION | sed 's/\./\n/g' | awk -F "." '{cc=cc*100+$0}END{print cc}'`
        REPO_VERSION_VAL=`echo $REPO_VERSION | sed 's/\./\n/g' | awk -F "." '{cc=cc*100+$0}END{print cc}'`

        if [[ $REPO_VERSION_VAL -ge $CURRENT_VERSION_VAL ]]
        then
                echo "repository version $REPO_VERSION existed, build version $VERSION is not allowed!"
                exit 1
        fi
fi

rm -rf target
mkdir target

SCRATCH_DIR=$PNAME-$VERSION

mkdir target/$SCRATCH_DIR

cp -r ./*.j* lib node_modules views site target/$SCRATCH_DIR
cd target/$SCRATCH_DIR

rm -rf logs config.jso* components.jso*

# mkdir logs
# touch logs/dpr.log
# cp config.json.dist config.json
find . -name "*.ejs"|xargs sed -i -e "s/__BUILD_VERSION__/$VERSION/"

cd ../
# fpm -s dir -t rpm -n $PNAME -v $VERSION --rpm-defattrfile=0775 --prefix=/usr/local/domob/prog.d $SCRATCH_DIR
fpm -n $PNAME -v $VERSION -s "dir" -t "rpm" --epoch=`date +%s` --rpm-user web --rpm-group deploy --prefix=/usr/local/domob/prog.d $SCRATCH_DIR
rm -rf $SCRATCH_DIR
