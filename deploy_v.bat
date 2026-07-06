@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
vercel --prod > vercel_out.txt 2>&1
type vercel_out.txt
pause
