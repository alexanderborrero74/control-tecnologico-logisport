@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
node fix_servicios_rt.js
echo.
echo Verificando build...
npm run build > build_rt.txt 2>&1
findstr /i "error\|success\|compiled" build_rt.txt
pause
