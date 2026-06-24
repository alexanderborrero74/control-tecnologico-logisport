@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
node check_edit2.js > edit2_log.txt 2>&1
type edit2_log.txt
pause
