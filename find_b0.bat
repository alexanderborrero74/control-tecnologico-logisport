@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
node find_b0.js > b0_context.txt 2>&1
type b0_context.txt
pause
