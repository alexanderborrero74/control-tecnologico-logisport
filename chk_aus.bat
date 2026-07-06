@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
node check_ausentes.js > ausentes_log.txt 2>&1
type ausentes_log.txt
pause
