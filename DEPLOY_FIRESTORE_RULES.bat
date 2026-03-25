@echo off
REM ====================================
REM Despliegue de Reglas de Firestore
REM Fix: Auditor sin datos
REM ====================================

echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║   LOGISPORT - Despliegue de Reglas Firestore         ║
echo ║   Fix: Rol Auditor - Indicadores sin datos           ║
echo ╚════════════════════════════════════════════════════════╝
echo.

REM Verificar que Firebase CLI esté instalado
where firebase >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Firebase CLI no está instalado.
    echo.
    echo Instala Firebase CLI con:
    echo   npm install -g firebase-tools
    echo.
    pause
    exit /b 1
)

echo [OK] Firebase CLI detectado
echo.

REM Verificar que el usuario esté logueado
echo Verificando autenticación con Firebase...
firebase login:list >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [INFO] No hay sesión activa. Iniciando login...
    firebase login
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Falló el login a Firebase
        pause
        exit /b 1
    )
)

echo [OK] Usuario autenticado
echo.

REM Mostrar información del proyecto
echo ════════════════════════════════════════════════════════
echo   INFORMACIÓN DEL PROYECTO
echo ════════════════════════════════════════════════════════
firebase use
echo.

REM Confirmación antes de desplegar
echo ════════════════════════════════════════════════════════
echo   CAMBIOS A DESPLEGAR
echo ════════════════════════════════════════════════════════
echo.
echo [+] Nueva función: isAuditor()
echo [+] Permisos de lectura para Auditor en serviciosTecnicos
echo [+] Permisos de lectura para Auditor en licencias
echo.
echo Esto permitirá que los usuarios con rol "auditor" puedan:
echo   - Ver indicadores de gestión
echo   - Ver estadísticas
echo   - Ver licencias (solo lectura)
echo.

set /p confirmar="¿Deseas continuar con el despliegue? (S/N): "
if /i not "%confirmar%"=="S" (
    echo.
    echo [CANCELADO] Despliegue cancelado por el usuario
    pause
    exit /b 0
)

echo.
echo ════════════════════════════════════════════════════════
echo   DESPLEGANDO REGLAS DE FIRESTORE...
echo ════════════════════════════════════════════════════════
echo.

REM Desplegar solo las reglas de Firestore
firebase deploy --only firestore:rules

if %errorlevel% equ 0 (
    echo.
    echo ╔════════════════════════════════════════════════════════╗
    echo ║   ✅ DESPLIEGUE EXITOSO                              ║
    echo ╚════════════════════════════════════════════════════════╝
    echo.
    echo Las reglas de Firestore se han actualizado correctamente.
    echo.
    echo PRÓXIMOS PASOS:
    echo   1. Pide al usuario con rol auditor que cierre sesión
    echo   2. Que vuelva a iniciar sesión
    echo   3. Verificar que ahora vea datos en indicadores y estadísticas
    echo.
    echo VERIFICACIÓN:
    echo   - Ve a Firebase Console ^> Firestore ^> Reglas
    echo   - Confirma que aparezca la función isAuditor()
    echo   - Revisa que serviciosTecnicos tenga: isAdmin() ^|^| isAuditor() ^|^| isOwner()
    echo.
) else (
    echo.
    echo ╔════════════════════════════════════════════════════════╗
    echo ║   ❌ ERROR EN EL DESPLIEGUE                          ║
    echo ╚════════════════════════════════════════════════════════╝
    echo.
    echo Verifica:
    echo   1. Que tengas permisos en el proyecto de Firebase
    echo   2. Que el archivo firestore.rules no tenga errores de sintaxis
    echo   3. La conexión a internet
    echo.
    echo Revisa el archivo FIX_AUDITOR_SIN_DATOS.md para más información
    echo.
)

echo.
pause
