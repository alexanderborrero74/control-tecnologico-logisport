@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
node find_trash.js > trash_log.txt 2>&1
type trash_log.txt
pause
