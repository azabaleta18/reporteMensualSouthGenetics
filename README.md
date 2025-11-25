# SouthGenetics - Gestión Financiera

Aplicación web desarrollada con Next.js para gestionar las divisas de SouthGenetics con conversión automática a dólares.

## Características

- Tabla editable para ingresar cantidades por divisa:
  - Pesos Argentinos (ARS)
  - Pesos Chilenos (CLP)
  - Pesos Colombianos (COP)
  - Euros (EUR)
  - Pesos Mexicanos (MXN)
  - Pesos Uruguayos (UYU)
  - Dólares (USD)
- Conversión automática a dólares usando tasas de cambio
- Total general en dólares que suma todas las divisas normalizadas
- Interfaz tipo tabla moderna y responsive
- Guardado individual por divisa

## Configuración

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar Supabase

1. Crea un proyecto en [Supabase](https://supabase.com)
2. Crea un archivo `.env.local` en la raíz del proyecto con las siguientes variables:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase
```

### 3. Tablas en Supabase

Las tablas ya están creadas automáticamente:
- `estado_divisa`: Almacena la cantidad actual de cada divisa
- `tasa_cambio`: Almacena las tasas de cambio de cada divisa a dólares

Las tasas de cambio iniciales son aproximadas y pueden actualizarse según sea necesario.

### 4. Ejecutar la aplicación

```bash
npm run dev
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000)

## Estructura del Proyecto

```
├── app/
│   ├── layout.tsx          # Layout principal
│   ├── page.tsx            # Página principal
│   └── globals.css         # Estilos globales
├── components/
│   └── TablaDivisas.tsx    # Tabla editable para gestionar divisas
├── lib/
│   ├── supabase.ts         # Cliente de Supabase
│   ├── types.ts            # Tipos TypeScript
│   └── divisas.ts          # Funciones para gestionar divisas y tasas
└── package.json
```

## Deployment en Vercel

Para desplegar la aplicación en Vercel, consulta la guía completa en [VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md)

### Resumen rápido:

1. Conecta tu repositorio de GitHub con Vercel
2. Configura las variables de entorno en Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Vercel desplegará automáticamente tu aplicación

## Tecnologías Utilizadas

- **Next.js 14** - Framework de React
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Estilos
- **Supabase** - Base de datos y backend
- **Lucide React** - Iconos
- **jsPDF** - Generación de PDFs
- **XLSX** - Exportación a Excel

