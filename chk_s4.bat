@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
node check_serv4.js > serv4_log.txt 2>&1
type serv4_log.txt
pause
