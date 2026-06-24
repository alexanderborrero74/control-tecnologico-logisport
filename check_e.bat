@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
node check_estado.js > estado_log.txt 2>&1
type estado_log.txt
pause
