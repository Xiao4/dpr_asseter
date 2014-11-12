#!/bin/sh

#
#chkconfig: 35 99 99
# description: Node.js /home/nodejs/sample/app.js
#

# . /etc/rc.d/init.d/functions

USER="web"
PNAME="dpr_asseter"
DAEMON="node"
ROOT_DIR="$HOME/prog.d/$PNAME"

WORKING_BASE="$HOME/work/$PNAME"
LOG_FILE="$WORKING_BASE/logs/dpr.log"
LOCK_FILE="$WORKING_BASE/$PNAME-lock"

SERVER="$ROOT_DIR/cluster.js -d $WORKING_BASE"
export NODE_ENV=production
echo_success() {
  echo -n "["
  echo -en '\033[0;32m'
  echo -n $"  OK  "
  echo -en '\033[0;39m'
  echo -n "]"
  echo -ne "\r"
  return 0
}

echo_failure() {
  echo -n "["
  echo -en '\033[0;31m'
  echo -n $"FAILED"
  echo -en '\033[0;39m'
  echo -n "]"
  echo -ne "\r"
  return 1
}

do_start()
{
        if [ ! -f "$LOCK_FILE" ] ; then
                echo -n $"Starting $PNAME: $SERVER"
                if [ ! -d "$LOG_FILE" ] ; then
                        touch $LOG_FILE
                fi 
                `nohup $DAEMON $SERVER >> $LOG_FILE 2>&1 &` && echo_success || echo_failure
                # runuser -l "$USER" -c "$DAEMON $SERVER >> $LOG_FILE &" && echo_success || echo_failure
                RETVAL=$?
                echo
                [ $RETVAL -eq 0 ] && touch $LOCK_FILE
        else
                echo "$PNAME is locked."
                RETVAL=1
        fi
}
do_stop()
{
        echo -n $"Stopping $PNAME: "
        pid=`ps -aefw | grep "$DAEMON $SERVER" | grep -v " grep " | head -n 1 | awk '{print $2}'`
        kill -2 $pid > /dev/null 2>&1 && echo_success || echo_failure
        RETVAL=$?
        echo
        [ $RETVAL -eq 0 ] && rm -f $LOCK_FILE
}

case "$1" in
        start)
                do_start
                ;;
        stop)
                do_stop
                ;;
        restart)
                rm -f $LOCK_FILE
                do_stop
                do_start
                ;;
        *)
                echo "Usage: $0 {start|stop|restart}"
                RETVAL=1
esac

# exit $RETVAL