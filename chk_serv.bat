@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
node check_serv.js > serv_log.txt 2>&1
type serv_log.txt
pause
