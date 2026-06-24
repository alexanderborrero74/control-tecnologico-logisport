@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
node check_edit.js > edit_log.txt 2>&1
type edit_log.txt
pause
