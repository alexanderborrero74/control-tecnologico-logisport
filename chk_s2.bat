@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
node check_serv2.js > serv2_log.txt 2>&1
type serv2_log.txt
pause
