@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
node check_reset2.js > reset2_log.txt 2>&1
type reset2_log.txt
pause
