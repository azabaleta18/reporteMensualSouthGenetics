# Guía de Deployment en Vercel

Esta guía te ayudará a desplegar la aplicación SouthGenetics en Vercel usando GitHub.

## Prerrequisitos

1. Una cuenta en [Vercel](https://vercel.com)
2. Una cuenta en [GitHub](https://github.com)
3. Un proyecto en [Supabase](https://supabase.com)

## Pasos para el Deployment

### 1. Preparar el Repositorio en GitHub

1. Crea un nuevo repositorio en GitHub
2. Sube tu código al repositorio:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/tu-usuario/tu-repositorio.git
   git push -u origin main
   ```

### 2. Conectar con Vercel

1. Ve a [Vercel Dashboard](https://vercel.com/dashboard)
2. Haz clic en "Add New Project"
3. Importa tu repositorio de GitHub
4. Vercel detectará automáticamente que es un proyecto Next.js

### 3. Configurar Variables de Entorno

**IMPORTANTE**: Debes configurar estas variables de entorno en Vercel:

1. En la página de configuración del proyecto en Vercel, ve a "Settings" > "Environment Variables"
2. Agrega las siguientes variables:

   ```
   NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase
   ```

   Puedes encontrar estos valores en tu proyecto de Supabase:
   - Ve a Settings > API
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon/public key

3. Asegúrate de que las variables estén habilitadas para:
   - ✅ Production
   - ✅ Preview
   - ✅ Development

### 4. Configuración del Build

Vercel detectará automáticamente:
- **Framework Preset**: Next.js
- **Build Command**: `npm run build` (automático)
- **Output Directory**: `.next` (automático)
- **Install Command**: `npm install` (automático)

No necesitas cambiar nada, pero puedes verificar en "Settings" > "General"

### 5. Desplegar

1. Haz clic en "Deploy"
2. Vercel construirá y desplegará tu aplicación
3. Una vez completado, obtendrás una URL como: `tu-proyecto.vercel.app`

### 6. Verificar el Deployment

1. Visita la URL proporcionada por Vercel
2. Deberías ver la página de login
3. Si hay errores, revisa los logs en Vercel Dashboard > Deployments

## Solución de Problemas

### Error: "supabaseUrl is required"

- **Causa**: Las variables de entorno no están configuradas correctamente
- **Solución**: Verifica que las variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` estén configuradas en Vercel

### Error de Build

- Revisa los logs de build en Vercel Dashboard
- Asegúrate de que todas las dependencias estén en `package.json`
- Verifica que no haya errores de TypeScript ejecutando `npm run build` localmente

### La aplicación no carga

- Verifica que las variables de entorno estén configuradas
- Revisa la consola del navegador para errores
- Verifica los logs de Vercel en tiempo real

## Actualizaciones Futuras

Cada vez que hagas push a la rama `main` de GitHub, Vercel desplegará automáticamente una nueva versión.

Para deployments de preview, cada pull request generará una URL de preview única.

## Notas Importantes

- ✅ Las variables de entorno con prefijo `NEXT_PUBLIC_` son accesibles en el cliente
- ✅ No subas archivos `.env.local` a GitHub (ya están en .gitignore)
- ✅ Vercel usa Node.js 18.x por defecto, que es compatible con Next.js 14
- ✅ El proyecto está configurado para funcionar tanto en desarrollo como en producción

