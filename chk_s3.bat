@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
node check_serv3.js > serv3_log.txt 2>&1
type serv3_log.txt
pause
