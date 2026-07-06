@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
node fix_nov_anuladas.js
vercel --prod
pause
