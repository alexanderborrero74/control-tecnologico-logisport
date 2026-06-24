@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
node seed_servicios.js > servicios_log.txt 2>&1
type servicios_log.txt
pause
