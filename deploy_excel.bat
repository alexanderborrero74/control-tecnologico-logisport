@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
node fix_dup_todos.js
node fix_excel_fetch.js
echo.
vercel --prod
pause
