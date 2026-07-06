@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
node check_mini.js > mini_log.txt 2>&1
type mini_log.txt
pause
