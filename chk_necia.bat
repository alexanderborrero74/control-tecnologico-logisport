@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
node check_neto_cia.js > neto_cia_log.txt 2>&1
type neto_cia_log.txt
pause
