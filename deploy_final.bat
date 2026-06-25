@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
node fix_dup_todos.js
node fix_json_fetch.js
echo.
echo Desplegando a produccion...
vercel --prod
pause
