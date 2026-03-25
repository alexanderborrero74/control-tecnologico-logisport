# 🚀 LOGISPORT - Control Tecnológico

Sistema de control tecnológico para LOGISPORT con diseño moderno y funcionalidades completas.

## 📦 INSTALACIÓN Y DEPLOYMENT

### **1. Instalar dependencias**

```cmd
cd E:\DATOS\copiacontroltecnologico\logisport\control-tecnologico-logisport
rd /s /q node_modules
rd /s /q .next
del package-lock.json
npm install
```

### **2. Build local (verificar que compile)**

```cmd
npm run build
```

### **3. Deploy a Vercel**

```cmd
vercel --prod
```

## 🔥 CONFIGURACIÓN DE FIREBASE

### **1. Firestore Rules**

Copia el contenido de `firestore.rules` y pégalo en Firebase Console:
- https://console.firebase.google.com/
- Selecciona el proyecto de LOGISPORT
- Firestore Database → Rules
- Pega las reglas y haz click en "Publicar"

### **2. Variables de Entorno en Vercel**

Ve a: https://vercel.com/soporteias-projects/control-tecnologico-logisport/settings/environment-variables

Configura las siguientes variables:

#### **Firebase (Frontend)**
```
NEXT_PUBLIC_FIREBASE_API_KEY=tu_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=logisport-xxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=logisport-xxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=logisport-xxx.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:xxxxx
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXX
```

#### **Firebase Admin (Backend)**
```
FIREBASE_SERVICE_ACCOUNT_BASE64=<tu_service_account_en_base64>
```

Para obtener el base64:
1. Descarga el service account JSON de Firebase Console
2. Convierte a base64:
   ```bash
   cat service-account.json | base64 -w 0
   ```
3. Copia el resultado completo

#### **Email (Nodemailer)**
```
GMAIL_USER=sistema@logisport.com
GMAIL_PASS=tu_app_password_16_caracteres
```

⚠️ **IMPORTANTE:** Si usas Gmail/Google Workspace, DEBES usar un App Password (no tu contraseña normal):
1. Activa 2FA en tu cuenta de Google
2. Ve a: https://myaccount.google.com/apppasswords
3. Genera un App Password para "Mail"
4. Usa esos 16 caracteres en `GMAIL_PASS`

#### **Opcional**
```
NEXT_PUBLIC_CLOUD_URL=https://logisportsas.ddns.net:5001/
```

### **3. Marcar variables como Production, Preview, Development**

Asegúrate de marcar TODAS las variables para los 3 ambientes.

## 📋 ESTRUCTURA DEL PROYECTO

```
control-tecnologico-logisport/
├── components/
│   ├── LayoutWithSidebar.js      ← Sidebar colapsable
│   ├── PageHeader.js              ← Header de páginas
│   ├── SelectorUsuarios.js        ← Selector de usuarios
│   ├── CapsulaEmergente.js
│   ├── GuiaBienvenida.js
│   ├── Layout.js
│   └── PieDerechos.jsx
├── pages/
│   ├── index.js                   ← Dashboard principal
│   ├── login.js                   ← Autenticación
│   ├── admin-usuarios.js          ← CRUD usuarios y cargos ✅ NUEVO
│   ├── servicios-tecnicos.js
│   ├── solicitudserviciotecnico.js
│   ├── hoja-vida.js
│   ├── documentacionti.js
│   ├── estadisticas.js
│   ├── indicadores-gestion.js
│   ├── capsulas-admin.js
│   ├── licencias.js
│   ├── control-de-contrasenas.js
│   ├── nube.js
│   ├── trazabilidad-logins.js
│   ├── registro-fotografico.js
│   ├── procesoit.js
│   ├── serviciospendientes.js
│   └── api/
│       ├── enviarCorreoElectronico.js  ← API de correos
│       └── documentacion.js
├── utils/
│   ├── branding.js                ← Configuración LOGISPORT
│   ├── org.js                     ← Helpers de organización
│   ├── useUsuarios.js             ← Hook CRUD usuarios
│   ├── useCargos.js               ← Hook CRUD cargos
│   ├── usuarios-base.js           ← Lista inicial usuarios
│   ├── cargos-base.js             ← Lista inicial cargos ✅ NUEVO
│   ├── catalogs.js
│   └── getUserRole.js
├── lib/
│   └── admin.js                   ← Firebase Admin SDK
├── firebase/
│   └── firebaseConfig.js          ← Firebase client config
├── styles/
│   └── globals.css                ← Tema LOGISPORT
├── public/
│   ├── logisport.png              ← Logo principal
│   └── ...
├── package.json                   ← Dependencias actualizadas
├── tailwind.config.js             ← Tailwind 3.4.1
├── postcss.config.mjs
├── next.config.mjs                ← Next.js 16.1.1
└── firestore.rules                ← Reglas de seguridad
```

## 🎨 CARACTERÍSTICAS DEL NUEVO DISEÑO

### **Layout con Sidebar Colapsable**
- ✅ Sidebar lateral con logo de LOGISPORT
- ✅ Menú colapsable (clic en flecha)
- ✅ Responsive móvil con hamburguesa
- ✅ Íconos lucide-react
- ✅ Estilo azul corporativo (#0B3D91, #00AEEF)

### **Admin de Usuarios y Cargos**
- ✅ Sistema de tabs (Usuarios / Cargos)
- ✅ CRUD completo con Firebase
- ✅ Importar datos base con un clic
- ✅ Modal de edición elegante
- ✅ Campos: nombre, email, cargo, rol, activo

### **Tema Visual**
- ✅ Paleta azul LOGISPORT consistente
- ✅ Cards con glass morphism
- ✅ Gradientes sutiles
- ✅ Sombras profesionales
- ✅ Tipografía limpia y legible

## 🔧 TECNOLOGÍAS

- **Frontend:** Next.js 16.1.1 + React 19
- **Estilos:** Tailwind CSS 3.4.1
- **Base de Datos:** Firebase Firestore
- **Autenticación:** Firebase Auth
- **Email:** Nodemailer + Gmail
- **Hosting:** Vercel
- **Íconos:** Lucide React

## 📊 MIGRACIÓN DESDE VERSIÓN ANTERIOR

### **Cambios principales:**

1. **Layout unificado:** Todas las páginas usan `LayoutWithSidebar` + `PageHeader`
2. **Gestión de usuarios:** Nueva página `/admin-usuarios` con CRUD completo
3. **Dependencias actualizadas:**
   - Next.js: 15.3.1 → 16.1.1
   - Tailwind: 4.x → 3.4.1 (estable)
   - Firebase: 11.6.0 → 11.10.0
4. **Nuevo sistema de componentes:**
   - `SelectorUsuarios.js`
   - `PageHeader.js`
   - Hooks: `useUsuarios.js`, `useCargos.js`

### **Páginas migradas:**
- ✅ admin-usuarios.js (NUEVO - CRUD completo)
- ⏳ Las demás páginas mantienen su lógica pero necesitan wrapper con LayoutWithSidebar

## 🐛 TROUBLESHOOTING

### **Error: "Missing or insufficient permissions"**
→ Verifica que las reglas de Firebase estén publicadas correctamente
→ Asegúrate de estar autenticado con un usuario que tenga el campo `rol`

### **Error: "FieldValue is not exported"**
→ Verifica que `lib/admin.js` esté correctamente configurado
→ Importa FieldValue: `const FieldValue = admin.firestore.FieldValue`

### **Emails no se envían**
→ Verifica `GMAIL_USER` y `GMAIL_PASS` en Vercel
→ Usa App Password si es Gmail (16 caracteres sin espacios)
→ Verifica que puerto 465 o 587 no estén bloqueados

### **Build falla en Vercel**
→ Ejecuta `npm run build` local primero
→ Verifica que no haya errores de TypeScript
→ Borra `.next` y `node_modules`, reinstala

### **Estilos no se aplican**
→ Verifica que `globals.css` tenga los `@tailwind` directives
→ Verifica `tailwind.config.js` tenga los paths correctos
→ Borra `.next` y reconstruye

## 📞 SOPORTE

Desarrollado por: Alexander Borrero
Empresa: SoporteIA.net
Cliente: LOGISPORT
Año: 2025

## 📝 PRÓXIMOS PASOS

1. ✅ Migrar index.js al nuevo layout
2. ✅ Migrar servicios-tecnicos.js al nuevo layout
3. ✅ Migrar solicitudserviciotecnico.js al nuevo layout
4. ✅ Migrar hoja-vida.js al nuevo layout
5. ✅ Migrar documentacionti.js al nuevo layout
6. ✅ Migrar estadisticas.js al nuevo layout
7. ✅ Migrar indicadores-gestion.js al nuevo layout
8. ✅ Migrar capsulas-admin.js al nuevo layout
9. ✅ Migrar licencias.js al nuevo layout
10. ✅ Migrar control-de-contrasenas.js al nuevo layout
11. ✅ Migrar nube.js al nuevo layout
12. ✅ Migrar trazabilidad-logins.js al nuevo layout
13. ✅ Migrar registro-fotografico.js al nuevo layout
14. ✅ Migrar procesoit.js al nuevo layout
15. ✅ Migrar serviciospendientes.js al nuevo layout
16. ✅ Migrar historial-credenciales.js al nuevo layout
17. ✅ Migrar usuario-aplicaciones-licencias.js al nuevo layout

---

**¡SISTEMA LISTO PARA PRODUCCIÓN!** 🚀
