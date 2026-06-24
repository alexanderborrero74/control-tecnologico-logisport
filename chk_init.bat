@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
node check_init.js > init_log.txt 2>&1
type init_log.txt
pause
