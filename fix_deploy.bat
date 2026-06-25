@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
node fix_dup_todos.js
echo.
echo Desplegando...
vercel --prod
pause
