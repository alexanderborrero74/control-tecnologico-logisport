@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
node check_g2.js > g2_log.txt 2>&1
type g2_log.txt
pause
