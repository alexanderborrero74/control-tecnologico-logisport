@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
node check_guardar.js > guardar_log.txt 2>&1
type guardar_log.txt
pause
