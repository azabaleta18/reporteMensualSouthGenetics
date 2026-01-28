# 🚀 Guía Completa: Probar y Desplegar en Vercel

## 📋 Pasos para Probar ANTES de Subir a Vercel

### 1. **Probar el Build Localmente** (RECOMENDADO)

Antes de subir a Vercel, es importante verificar que el proyecto compile correctamente:

```bash
# Navegar al directorio del proyecto
cd reporteMensualSouthGenetics

# Ejecutar el build de producción (simula lo que hará Vercel)
npm run build

# Si el build es exitoso, probar el servidor de producción localmente
npm start
```

**Qué verificar:**
- ✅ El build debe completarse sin errores
- ✅ No debe haber errores de TypeScript
- ✅ El servidor debe iniciar en `http://localhost:3000`
- ✅ La aplicación debe funcionar correctamente

**Si hay errores:**
- Revisa los mensajes de error en la consola
- Verifica que todas las dependencias estén instaladas (`npm install`)
- Asegúrate de que no haya errores de sintaxis o TypeScript

### 2. **Verificar Variables de Entorno**

Asegúrate de que tu archivo `.env.local` tenga las variables correctas:
```env
NEXT_PUBLIC_SUPABASE_URL=https://flretkpedckirupwuhcy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase
```

**Nota:** El proyecto tiene valores por defecto en `lib/supabase.ts`, pero es mejor usar variables de entorno en producción.

---

## 🌐 Pasos para Desplegar en Vercel

### Opción A: Si ya tienes el proyecto en Vercel (Actualizar)

1. **Hacer commit y push de tus cambios:**
   ```bash
   git add .
   git commit -m "Actualización: correcciones de paginación y selección"
   git push origin main
   ```

2. **Vercel desplegará automáticamente** si tienes auto-deploy activado
   - Ve a tu dashboard de Vercel: https://vercel.com/dashboard
   - Verás el nuevo deployment en progreso
   - Espera a que termine (2-5 minutos)

3. **Verificar el deployment:**
   - Revisa los logs en Vercel Dashboard > Deployments
   - Si hay errores, aparecerán en los logs
   - Si todo está bien, tu sitio estará actualizado

### Opción B: Si es la primera vez o quieres crear un nuevo proyecto

1. **Preparar el código en GitHub:**
   ```bash
   # Asegúrate de estar en la rama main
   git checkout main
   
   # Agregar todos los cambios
   git add .
   
   # Hacer commit
   git commit -m "Preparar para deploy en Vercel"
   
   # Push a GitHub
   git push origin main
   ```

2. **Conectar con Vercel:**
   - Ve a [Vercel Dashboard](https://vercel.com/dashboard)
   - Haz clic en **"Add New Project"** o **"Import Project"**
   - Selecciona tu repositorio de GitHub
   - Vercel detectará automáticamente que es Next.js

3. **Configurar Variables de Entorno:**
   
   En la página de configuración del proyecto:
   - Ve a **Settings** > **Environment Variables**
   - Agrega estas variables:
     ```
     NEXT_PUBLIC_SUPABASE_URL=https://flretkpedckirupwuhcy.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZscmV0a3BlZGNraXJ1cHd1aGN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5OTY0NTMsImV4cCI6MjA3OTU3MjQ1M30.plNXjOdR10vW0MKdP5eXUivDb-YbG27ELchbAIuHT0g
     ```
   - Marca las casillas para:
     - ✅ Production
     - ✅ Preview  
     - ✅ Development

4. **Configuración del Build (Verificar):**
   
   Vercel debería detectar automáticamente:
   - **Framework Preset:** Next.js
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`
   - **Install Command:** `npm install`
   
   Si no está correcto, puedes ajustarlo en **Settings** > **General**

5. **Desplegar:**
   - Haz clic en **"Deploy"**
   - Espera 2-5 minutos mientras Vercel construye y despliega
   - Obtendrás una URL como: `tu-proyecto.vercel.app`

---

## ✅ Checklist Antes de Desplegar

- [ ] El build local funciona sin errores (`npm run build`)
- [ ] El servidor de producción local funciona (`npm start`)
- [ ] Las variables de entorno están configuradas en Vercel
- [ ] Los cambios están commiteados y pusheados a GitHub
- [ ] No hay errores de TypeScript o linting

---

## 🔍 Verificar el Deployment

1. **Revisar los Logs:**
   - Ve a Vercel Dashboard > Tu Proyecto > Deployments
   - Haz clic en el deployment más reciente
   - Revisa la pestaña "Build Logs" para ver si hubo errores

2. **Probar la Aplicación:**
   - Visita la URL de producción
   - Verifica que la página de login cargue
   - Prueba iniciar sesión
   - Verifica que las tablas funcionen correctamente

3. **Errores Comunes:**

   **Error: "supabaseUrl is required"**
   - ✅ Verifica que las variables de entorno estén configuradas en Vercel
   - ✅ Asegúrate de que tengan el prefijo `NEXT_PUBLIC_`

   **Error de Build**
   - ✅ Revisa los logs de build en Vercel
   - ✅ Ejecuta `npm run build` localmente para ver el error
   - ✅ Verifica que todas las dependencias estén en `package.json`

   **La aplicación no carga**
   - ✅ Revisa la consola del navegador (F12)
   - ✅ Verifica los logs de Vercel en tiempo real
   - ✅ Asegúrate de que las variables de entorno estén correctas

---

## 🎯 Comandos Rápidos

```bash
# Probar build localmente
npm run build

# Probar servidor de producción localmente
npm start

# Verificar errores de TypeScript
npm run lint

# Desarrollo local
npm run dev
```

---

## 📝 Notas Importantes

- ✅ **Auto-deploy:** Si tienes auto-deploy activado, cada push a `main` desplegará automáticamente
- ✅ **Preview deployments:** Cada Pull Request genera una URL de preview única
- ✅ **Variables de entorno:** Las variables con prefijo `NEXT_PUBLIC_` son accesibles en el cliente
- ✅ **No subir `.env.local`:** Ya está en `.gitignore`, no lo subas a GitHub
- ✅ **El proyecto tiene valores por defecto:** Si las variables de entorno fallan, usará los valores hardcodeados en `lib/supabase.ts`

---

## 🆘 Si Necesitas Ayuda

1. Revisa los logs de Vercel en tiempo real
2. Compara con el build local (`npm run build`)
3. Verifica que las variables de entorno estén correctas
4. Revisa la consola del navegador para errores del cliente
