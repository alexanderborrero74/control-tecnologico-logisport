@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
vercel --prod > vercel_out2.txt 2>&1
findstr /i "ready\|error\|compiled" vercel_out2.txt
pause
