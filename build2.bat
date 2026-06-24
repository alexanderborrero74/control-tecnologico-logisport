@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
node rm_useeffect.js
node fix_neto_inline.js
echo.
echo Ejecutando build...
npm run build > build_log.txt 2>&1
echo Build terminado - leyendo resultado...
findstr /i "error\|success\|compiled\|prerender" build_log.txt
pause
