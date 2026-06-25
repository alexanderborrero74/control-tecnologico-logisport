@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
node check_cg.js > cg_log.txt 2>&1
type cg_log.txt
pause
