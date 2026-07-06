@echo off
cd /d E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
echo Paso 1: Desplegando reglas Firestore... > deploy_log.txt
firebase deploy --only firestore:rules >> deploy_log.txt 2>&1
echo. >> deploy_log.txt
echo Paso 2: Desplegando app a Vercel... >> deploy_log.txt
vercel --prod >> deploy_log.txt 2>&1
echo. >> deploy_log.txt
echo FINALIZADO >> deploy_log.txt
type deploy_log.txt
echo.
echo Resultado guardado en deploy_log.txt
pause
