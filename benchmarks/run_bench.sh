#!/bin/sh
node ./baseNextTick.js
node ./zonedNextTick.js
node ./createZone.js

node ./basicServer.js &
sleep 1
gobench -c=200 -k=true -r=501 -u="http://127.0.0.1:3001" 2>/dev/null 1>/dev/null
sleep 1
node ./basicServerWithZones.js &
sleep 1
gobench -c=200 -k=true -r=501 -u="http://127.0.0.1:3001" 2>/dev/null 1>/dev/null
sleep 1
node ./zonedServer.js &
sleep 1
gobench -c=200 -k=true -r=501 -u="http://127.0.0.1:3001" 2>/dev/null 1>/dev/null
