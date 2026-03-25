# 🔐 CONFIGURACIÓN DE ROLES EN FIREBASE

## 📋 RESUMEN DE ROLES

El sistema LOGISPORT ahora soporta 4 roles con diferentes niveles de acceso:

### 1. **ADMIN** 🔑
- **Acceso:** TOTAL a todas las páginas y funcionalidades
- **Valor en Firebase:** `admin`, `administracion`, `administración`, `administrator`, `adm`

### 2. **TÉCNICO** 🔧
- **Acceso limitado a:**
  - Inicio (Dashboard)
  - Servicios técnicos
  - Solicitud de servicio
  - Seguimiento códigos asociados
- **Valor en Firebase:** `tecnico`, `técnico`, `technician`, `tech`

### 3. **AUDITOR** 📊
- **Acceso limitado a:**
  - Inicio (Dashboard)
  - Indicadores de gestión
  - Estadísticas
  - Documentación TI
  - Cápsulas
  - Licencias
  - Procesos IT
- **Valor en Firebase:** `auditor`, `audit`, `revisor`

### 4. **USUARIO** 👤
- **Acceso limitado a:**
  - Inicio (Dashboard)
  - Solicitud de servicio
  - Seguimiento códigos asociados
- **Valor en Firebase:** `usuario` (o cualquier otro valor no reconocido)
- **Descripción:** Usuario final que solo puede crear solicitudes de servicio y hacer seguimiento

---

## 🛠️ CÓMO CONFIGURAR ROLES EN FIREBASE

### **PASO 1: Acceder a Firestore**
1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto LOGISPORT
3. En el menú lateral, haz clic en **"Firestore Database"**

### **PASO 2: Navegar a la colección de usuarios**
1. En la lista de colecciones, busca `usuarios`
2. Haz clic en la colección para ver los documentos

### **PASO 3: Asignar rol a un usuario**

#### **Para un usuario EXISTENTE:**
1. Busca el documento del usuario por su UID o email
2. Haz clic en el documento
3. Si NO existe el campo `rol`:
   - Haz clic en **"Agregar campo"**
   - Campo: `rol`
   - Tipo: `string`
   - Valor: Escribe uno de estos valores:
     - `admin` (para administrador)
     - `tecnico` (para técnico)
     - `auditor` (para auditor)
     - `usuario` (para usuario regular)
4. Si ya existe el campo `rol`:
   - Haz clic en el valor actual
   - Cámbialo a uno de los valores mencionados arriba
5. Guarda los cambios

#### **Para un usuario NUEVO:**
1. Primero, el usuario debe registrarse en la aplicación
2. Una vez registrado, su UID aparecerá en Firestore
3. Sigue los pasos del apartado anterior para asignarle un rol

---

## 📝 EJEMPLO PRÁCTICO

### Estructura de documento en Firestore:

```
Collection: usuarios
  ├─ Document: abc123xyz (UID del usuario)
      ├─ email: "juan.perez@logisport.com"
      ├─ nombre: "Juan Pérez"
      └─ rol: "tecnico"   ← ESTE ES EL CAMPO IMPORTANTE
```

---

## ✅ VERIFICAR QUE FUNCIONÓ

1. El usuario debe **cerrar sesión** y **volver a iniciar sesión**
2. Al entrar, verá en el sidebar (menú lateral) su badge de rol:
   - 🔑 Admin (rojo)
   - 🔧 Técnico (azul)
   - 📊 Auditor (naranja)
   - 👤 Usuario (gris)
3. Solo verá las opciones del menú correspondientes a su rol

---

## 🚨 IMPORTANTE

- El campo `rol` NO distingue entre mayúsculas y minúsculas
- Si un usuario no tiene el campo `rol`, se le asignará automáticamente el rol `usuario`
- Los cambios de rol requieren que el usuario cierre sesión y vuelva a iniciar

---

## 📊 TABLA DE ACCESOS POR ROL

| Página                      | Admin | Técnico | Auditor | Usuario |
|-----------------------------|-------|---------|---------|---------|
| Inicio (Dashboard)          | ✅    | ✅      | ✅      | ✅      |
| Servicios técnicos          | ✅    | ✅      | ❌      | ❌      |
| Solicitud de servicio       | ✅    | ✅      | ❌      | ✅      |
| Seguimiento códigos         | ✅    | ✅      | ❌      | ✅      |
| Hoja de vida equipos        | ✅    | ❌      | ❌      | ❌      |
| Documentación TI            | ✅    | ❌      | ✅      | ❌      |
| Estadísticas                | ✅    | ❌      | ✅      | ❌      |
| Indicadores                 | ✅    | ❌      | ✅      | ❌      |
| Cápsulas                    | ✅    | ❌      | ✅      | ❌      |
| Licencias                   | ✅    | ❌      | ✅      | ❌      |
| Contraseñas                 | ✅    | ❌      | ❌      | ❌      |
| Acceso a nube               | ✅    | ❌      | ❌      | ❌      |
| Trazabilidad logins         | ✅    | ❌      | ❌      | ❌      |
| Registro fotográfico        | ✅    | ❌      | ❌      | ❌      |
| Admin Usuarios              | ✅    | ❌      | ❌      | ❌      |
| Procesos IT                 | ✅    | ❌      | ✅      | ❌      |
| Servicios pendientes        | ✅    | ❌      | ❌      | ❌      |

---

## 🎯 EJEMPLOS DE USO

### Caso 1: Crear un técnico de campo
```
rol: "tecnico"
```
→ Solo verá y podrá acceder a servicios técnicos y solicitudes

### Caso 2: Crear un auditor externo
```
rol: "auditor"
```
→ Solo verá indicadores, estadísticas y documentación (solo lectura)

### Caso 3: Promover a usuario a admin
```
rol: "admin"
```
→ Tendrá acceso completo a todo el sistema

---

## 📞 SOPORTE

Si tienes problemas configurando los roles, verifica:
1. ✅ Que el campo se llame exactamente `rol` (minúsculas)
2. ✅ Que el valor sea un string (texto)
3. ✅ Que el usuario haya cerrado sesión y vuelto a entrar
4. ✅ Que no haya espacios antes o después del valor

---

**Fecha de creación:** 22 de enero de 2026
**Proyecto:** LOGISPORT Control Tecnológico
**Versión:** 1.0
