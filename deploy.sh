#!/bin/bash

if  [[ $1 == "REMOTE" ]]; then
    echo $1
    #BASE_PORT=6000
    BASE_PORT=$2
    PLATFORM_PORT=$((BASE_PORT + 1))
    PONG_PORT=$((BASE_PORT + 2))
    TRIVIA_PORT=$((BASE_PORT + 3))
    AWARDS_PORT=$((BASE_PORT + 4))
    MMAIN_PORT=$((BASE_PORT + 5))

    #killall node
    cd deployment
    forever stopall
    forever start -m 1 Platform/main.js $PLATFORM_PORT
    forever start -m 1 Games/Pong/main.js $PONG_PORT
    forever start -m 1 Games/Trivia/main.js $TRIVIA_PORT
    forever start -m 1 AwardsBackend/app.js $AWARDS_PORT
    forever start -m 1 Platform/mmain.js $MMAIN_PORT
    exit 0

fi


rsync -avziur --delete * dev5.tudalex.com:deployment/
ssh dev5.tudalex.com ./deployment/deploy.sh REMOTE $1



