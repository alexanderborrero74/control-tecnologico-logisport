@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
node check_reset.js > reset_log.txt 2>&1
type reset_log.txt
pause
