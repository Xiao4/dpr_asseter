#!/bin/bash

PNAME=dpr_asseter
VERSION=0.1.0
SKIP=$@

SCRATCH_DIR=$PNAME-$VERSION

rm -f target/${SCRATCH_DIR}-*.rpm 2>/dev/null
mkdir target/$SCRATCH_DIR
cp -r ./*.j* dpr.sh lib node_modules views target/$SCRATCH_DIR
cd target/$SCRATCH_DIR
rm -rf logs config.jso*
# mkdir logs
# touch logs/dpr.log
# cp config.json.dist config.json
# sed -i -e "s/__BUILD_VERSION__/$VERSION/"

cd ../
fpm -s dir -t rpm -n $PNAME -v $VERSION --rpm-defattrfile=0775 --prefix=/usr/local/domob/prog.d $SCRATCH_DIR

rm -rf $SCRATCH_DIR
