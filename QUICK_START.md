# ⚡ QUICK START - LOGISPORT

## 🚀 DEPLOYMENT EN 5 PASOS (15 MINUTOS)

### **PASO 1: Ejecutar Script de Deployment**

Haz **doble clic** en:
```
DEPLOY.bat
```

O ejecuta manualmente:
```cmd
cd E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
rd /s /q node_modules .next
del package-lock.json
npm install
npm run build
vercel --prod
```

---

### **PASO 2: Configurar Variables en Vercel (10 min)**

Ve a: https://vercel.com/soporteias-projects/control-tecnologico-logisport/settings/environment-variables

Agrega estas variables (ver `VARIABLES.md` para valores):

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
FIREBASE_SERVICE_ACCOUNT_BASE64=...
GMAIL_USER=sistema@logisport.com
GMAIL_PASS=xxxx xxxx xxxx xxxx
```

**⚠️ IMPORTANTE:** Marca para Production, Preview, Development

---

### **PASO 3: Publicar Reglas Firebase (2 min)**

1. Abre: https://console.firebase.google.com/
2. Selecciona proyecto LOGISPORT
3. Firestore → Rules
4. Copia contenido de `firestore.rules`
5. Pegar y **Publicar**

---

### **PASO 4: Redeploy (1 min)**

```cmd
vercel --prod
```

---

### **PASO 5: Verificar (2 min)**

1. Abre: https://control-tecnologico-logisport.vercel.app
2. Login con tu usuario
3. Ve a "Admin Usuarios" (si eres admin)
4. Prueba crear un usuario
5. ✅ **LISTO!**

---

## 🎯 COMANDOS MÁS USADOS

### **Desarrollo Local:**
```cmd
npm run dev
# Abre: http://localhost:3000
```

### **Build Local:**
```cmd
npm run build
```

### **Deploy:**
```cmd
vercel --prod
```

### **Ver Logs:**
```cmd
vercel logs
```

### **Limpiar Cache:**
```cmd
rd /s /q node_modules .next
del package-lock.json
npm install
```

---

## 📱 URLS IMPORTANTES

| Recurso | URL |
|---------|-----|
| **App en Producción** | https://control-tecnologico-logisport.vercel.app |
| **Vercel Dashboard** | https://vercel.com/soporteias-projects/control-tecnologico-logisport |
| **Variables de Entorno** | https://vercel.com/soporteias-projects/control-tecnologico-logisport/settings/environment-variables |
| **Firebase Console** | https://console.firebase.google.com/ |
| **Firestore Rules** | https://console.firebase.google.com/project/LOGISPORT-PROJECT-ID/firestore/rules |
| **Firebase Auth** | https://console.firebase.google.com/project/LOGISPORT-PROJECT-ID/authentication/users |

---

## 🐛 PROBLEMAS COMUNES

### **Error: Module not found**
```cmd
npm install
```

### **Error: Build failed**
```cmd
rd /s /q .next
npm run build
```

### **Error: Permission denied en Firebase**
```
1. Verifica firestore.rules publicado
2. Verifica usuario con rol: "admin"
```

### **Error: Emails no llegan**
```
1. Verifica GMAIL_USER y GMAIL_PASS en Vercel
2. Usa App Password (16 caracteres)
3. Redeploy: vercel --prod
```

---

## ✅ CHECKLIST RÁPIDO

### **Antes del Deploy:**
- [ ] `npm install` sin errores
- [ ] `npm run build` completado
- [ ] Archivos creados están en el proyecto

### **Después del Deploy:**
- [ ] Variables de entorno configuradas
- [ ] Reglas Firebase publicadas
- [ ] Redesplegar ejecutado
- [ ] App funciona en producción
- [ ] Login funciona
- [ ] Admin Usuarios accesible

---

## 📞 AYUDA

**¿Algo no funciona?**

1. Lee `README.md` - Documentación completa
2. Lee `VARIABLES.md` - Guía de variables
3. Lee `MIGRACION_COMPLETADA.md` - Resumen técnico

**¿Necesitas soporte?**

Contacta a: Alexander Borrero - SoporteIA.net  
Email: soportesistemas@soporteia.net

---

**🚀 ¡LISTO EN 15 MINUTOS! 🚀**
