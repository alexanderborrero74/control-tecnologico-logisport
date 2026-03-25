# 🔐 VARIABLES DE ENTORNO - LOGISPORT

## 📍 DÓNDE CONFIGURAR

### **Vercel (Producción)**
https://vercel.com/soporteias-projects/control-tecnologico-logisport/settings/environment-variables

### **Local (.env.local)**
Crea un archivo `.env.local` en la raíz del proyecto con estas variables:

---

## 🔥 FIREBASE - FRONTEND (NEXT_PUBLIC_*)

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=logisport-xxxxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=logisport-xxxxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=logisport-xxxxx.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdefghijklmnop123456
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

**¿Dónde obtener estos valores?**
1. Ve a: https://console.firebase.google.com/
2. Selecciona tu proyecto LOGISPORT
3. Project Settings (⚙️) → General
4. En "Your apps" → Web app → SDK setup and configuration
5. Copia los valores del objeto `firebaseConfig`

---

## 🔥 FIREBASE - BACKEND (Admin SDK)

```env
FIREBASE_SERVICE_ACCOUNT_BASE64=eyJ0eXBlIjoic2VydmljZV9hY2NvdW50IiwicHJvamVjdF9pZCI6InNpZGVjb21leC1hODJkMCI...
```

**¿Cómo generar el Base64?**

### **Paso 1: Descargar Service Account**
1. Ve a: https://console.firebase.google.com/
2. Selecciona tu proyecto LOGISPORT
3. Project Settings (⚙️) → Service accounts
4. Click en "Generate new private key"
5. Guarda el archivo JSON (ejemplo: `logisport-service-account.json`)

### **Paso 2: Convertir a Base64**

#### **En Windows (PowerShell):**
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\ruta\al\logisport-service-account.json"))
```

#### **En Linux/Mac:**
```bash
cat logisport-service-account.json | base64 -w 0
```

#### **Online (usar con precaución):**
https://www.base64encode.org/
⚠️ Solo usa herramientas online si es un proyecto de prueba

### **Paso 3: Copiar el resultado completo**
Copia TODO el texto base64 generado (puede ser muy largo, 2000+ caracteres)

---

## 📧 GMAIL / NODEMAILER

```env
GMAIL_USER=sistema@logisport.com
GMAIL_PASS=abcd efgh ijkl mnop
```

### **IMPORTANTE: App Password requerido**

Si usas Gmail o Google Workspace, DEBES usar un **App Password** (no tu contraseña normal).

**¿Cómo generar un App Password?**

1. **Activa la verificación en 2 pasos:**
   - Ve a: https://myaccount.google.com/security
   - En "Verificación en 2 pasos" → Activar

2. **Genera un App Password:**
   - Ve a: https://myaccount.google.com/apppasswords
   - Selecciona "Mail" como app
   - Selecciona "Other" como dispositivo
   - Nombre: "LOGISPORT Vercel"
   - Click en "Generate"

3. **Copia el password de 16 caracteres:**
   - Ejemplo: `abcd efgh ijkl mnop`
   - Pégalo en `GMAIL_PASS`
   - ⚠️ **SIN espacios** cuando lo pegues en Vercel

### **Formato del correo emisor:**

```env
# Opción 1: Solo email
GMAIL_USER=sistema@logisport.com

# Opción 2: Con nombre (opcional)
GMAIL_USER="LOGISPORT Sistema" <sistema@logisport.com>
```

---

## 🌐 CLOUD URL (Opcional)

```env
NEXT_PUBLIC_CLOUD_URL=https://logisportsas.ddns.net:5001/
```

Esta variable se usa para el botón "Acceso a nube" en el header.

---

## ✅ CHECKLIST DE CONFIGURACIÓN

### **En Vercel:**
- [ ] Todas las variables `NEXT_PUBLIC_FIREBASE_*` configuradas
- [ ] `FIREBASE_SERVICE_ACCOUNT_BASE64` configurada
- [ ] `GMAIL_USER` configurada
- [ ] `GMAIL_PASS` configurada (App Password de 16 caracteres)
- [ ] `NEXT_PUBLIC_CLOUD_URL` configurada (opcional)
- [ ] Todas las variables marcadas para: Production, Preview, Development
- [ ] Redesplegar después de agregar variables: `vercel --prod`

### **En Firebase Console:**
- [ ] Reglas de Firestore publicadas (copiar de `firestore.rules`)
- [ ] Authentication habilitado (Email/Password)
- [ ] Firestore Database creado
- [ ] Usuario admin creado con campo `rol: "admin"`

### **Local (.env.local):**
- [ ] Archivo `.env.local` creado en la raíz
- [ ] Todas las variables copiadas
- [ ] Verificar que funciona: `npm run dev`

---

## 🧪 VERIFICAR QUE FUNCIONA

### **1. Test de Firebase:**
```javascript
// En la consola del navegador:
firebase.auth().currentUser
// Debe mostrar tu usuario autenticado
```

### **2. Test de envío de correos:**
```
1. Inicia sesión en la app
2. Ve a "Solicitud de servicio técnico"
3. Crea una solicitud de prueba
4. Verifica que llegue el correo a GMAIL_USER
```

### **3. Test de permisos:**
```
1. Ve a "Admin Usuarios"
2. Crea un nuevo usuario
3. Si no hay errores → Permisos OK
```

---

## 🚨 ERRORES COMUNES

### **Error: "Missing or insufficient permissions"**
- ✅ Verifica que las reglas de Firebase estén publicadas
- ✅ Verifica que tu usuario tenga el campo `rol: "admin"` en Firestore

### **Error: "Invalid login: 535-5.7.8 Username and Password not accepted"**
- ✅ Estás usando tu contraseña normal en vez de App Password
- ✅ Genera un nuevo App Password
- ✅ Copia los 16 caracteres SIN espacios

### **Error: "ENOTFOUND smtp.gmail.com"**
- ✅ Verifica tu conexión a internet
- ✅ Verifica que no haya firewall bloqueando puertos 465/587

### **Error: "Firebase: Error (auth/configuration-not-found)"**
- ✅ Falta alguna variable `NEXT_PUBLIC_FIREBASE_*`
- ✅ Verifica que TODAS estén configuradas en Vercel
- ✅ Redespliega después de agregar variables

---

## 📞 SOPORTE

Si tienes problemas:
1. Verifica cada variable una por una
2. Asegúrate de redesplegar después de cambiar variables en Vercel
3. Revisa los logs de Vercel: https://vercel.com/soporteias-projects/control-tecnologico-logisport
4. Revisa la consola del navegador (F12) para errores de Firebase

---

**Última actualización: Enero 2025**
**Desarrollado por: Alexander Borrero - SoporteIA.net**
