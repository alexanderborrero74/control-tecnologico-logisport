@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
node check_mini2.js > mini2_log.txt 2>&1
type mini2_log.txt
pause
