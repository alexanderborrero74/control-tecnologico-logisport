@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
node check_ctx.js > ctx_log.txt 2>&1
type ctx_log.txt
pause
