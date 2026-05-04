# AgriPrecision

Plataforma web de agricultura de precisión para gestionar fincas, lotes, sensores IoT, riego, predicciones de rendimiento, alertas, reportes y automatización con n8n.

## Descripción general

AgriPrecision integra una arquitectura multi-servicio para centralizar la operación agrícola:

- **Frontend web** en Next.js para la experiencia de usuario.
- **Backend API** en NestJS + tRPC para reglas de negocio y acceso a datos.
- **Base de datos PostgreSQL + PostGIS** para persistencia y soporte geoespacial.
- **Redis** como servicio auxiliar de infraestructura.
- **ML Service** en Flask para predicciones y recomendaciones.
- **n8n** para automatización de workflows de clima, reportes y predicciones.

## Características principales

- **Autenticación con JWT**
- **Gestión de fincas y lotes**
- **Sensores IoT y lecturas climáticas**
- **Programación y métricas de riego**
- **Predicciones de rendimiento**
- **Alertas operativas**
- **Reportes PDF/CSV**
- **Dashboard operativo**
- **Automatización con n8n**

## Módulos funcionales

### Frontend

Rutas principales en `frontend/app`:

- **`/login`**
  - Inicio de sesión
  - Guarda `token` y datos de usuario en `localStorage`

- **`/dashboard`**
  - Métricas generales
  - Tendencias de rendimiento y riego
  - Estado del sistema y automatización

- **`/fincas`**
  - Creación y listado de fincas

- **`/lotes`**
  - Creación, edición y eliminación de lotes
  - Asociación con finca

- **`/sensores`**
  - Alta de sensores
  - Asignación a lote
  - Actualización de lecturas
  - Integración con workflow climático en n8n

- **`/riego`**
  - Programación de eventos de riego
  - Recomendaciones automáticas
  - Métricas de eficiencia

- **`/predicciones`**
  - Gestión de temporada activa
  - Predicción de rendimiento por lote
  - Historial de predicciones

- **`/alertas`**
  - Filtros por estado y severidad
  - Marcado individual y masivo como leídas

- **`/reportes`**
  - Generación de reportes
  - Descarga e historial

### Backend

Módulos principales en `backend/src`:

- **`auth`**
  - Login y obtención del usuario autenticado

- **`farms`**
  - Gestión de fincas

- **`plots`**
  - Gestión de lotes

- **`sensors`**
  - Listado de sensores
  - Lecturas recientes
  - Creación y asignación

- **`irrigation`**
  - Historial de riego
  - Recomendaciones
  - Eficiencia

- **`predictions`**
  - Temporadas activas
  - Predicciones de rendimiento
  - Historial agrícola

- **`alerts`**
  - Listado de alertas
  - Marcado como leídas

- **`reports`**
  - Generación y descarga de reportes

- **`automation`**
  - Resumen de workflows
  - Ejecuciones recientes
  - Integración con n8n

- **`trpc`**
  - Router principal expuesto en `/trpc`

## Stack tecnológico

### Frontend

- **Next.js 14**
- **React 18**
- **TypeScript**
- **Tailwind CSS**
- **tRPC client**
- **Lucide React**

### Backend

- **NestJS 10**
- **TypeScript**
- **Prisma ORM**
- **tRPC server**
- **JWT**
- **PDFKit**
- **Axios**

### Datos e infraestructura

- **PostgreSQL 15 + PostGIS**
- **Redis 7**
- **Docker Compose**

### Automatización y ML

- **n8n**
- **Flask**
- **scikit-learn**
- **numpy / pandas / joblib**

## Arquitectura general

```mermaid
flowchart LR
    U[Usuario] --> F[Frontend Next.js]
    F -->|HTTP /trpc| B[Backend NestJS + tRPC]
    B --> DB[(PostgreSQL + PostGIS)]
    B --> R[(Redis)]
    B --> ML[ML Service Flask]
    B --> N8N[n8n Workflows]
    N8N --> B
    N8N --> DB
```

## Flujo de autenticación

```mermaid
sequenceDiagram
    participant U as Usuario
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    U->>FE: Ingresa email y contraseña
    FE->>BE: auth.login
    BE->>DB: Busca usuario y rol
    BE->>BE: Valida password con bcrypt
    BE-->>FE: JWT + datos de usuario
    FE->>FE: Guarda token en localStorage
    FE->>BE: Envía Authorization Bearer en llamadas futuras
```

## Flujo de actualización de sensores

```mermaid
sequenceDiagram
    participant U as Usuario
    participant FE as Frontend /sensores
    participant BE as Backend
    participant N8N as n8n
    participant DB as PostgreSQL

    U->>FE: Clic en Actualizar lecturas
    FE->>BE: sensors.refreshReadings
    BE->>N8N: Ejecuta climate-ingest
    N8N->>BE: Devuelve payload del workflow
    BE->>DB: Persiste lecturas nuevas
    BE-->>FE: Resumen de sensores y lecturas guardadas
    FE-->>U: Toast + resumen de sincronización
```

## Estructura del proyecto

```text
agricultura-precision/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── src/
│   │   ├── alerts/
│   │   ├── auth/
│   │   ├── automation/
│   │   ├── farms/
│   │   ├── irrigation/
│   │   ├── plots/
│   │   ├── predictions/
│   │   ├── prisma/
│   │   ├── reports/
│   │   ├── sensors/
│   │   └── trpc/
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── app/
│   │   ├── alertas/
│   │   ├── dashboard/
│   │   ├── fincas/
│   │   ├── login/
│   │   ├── lotes/
│   │   ├── predicciones/
│   │   ├── reportes/
│   │   ├── riego/
│   │   └── sensores/
│   ├── components/
│   ├── lib/
│   ├── Dockerfile
│   └── package.json
├── ml-service/
│   ├── app.py
│   ├── Dockerfile
│   └── requirements.txt
├── n8n-workflows/
│   ├── workflow-climate-ingest.json
│   ├── workflow-predictions-daily.json
│   └── workflow-reports-scheduled.json
├── docker-compose.yml
├── init.sql
└── README.md
```

## Base de datos

El archivo `init.sql` crea el esquema principal con tablas como:

- `usuario`
- `rol`
- `finca`
- `lote`
- `cultivo`
- `temporada`
- `sensor`
- `lectura_sensor`
- `evento_riego`
- `prediccion_rendimiento`
- `workflow_ejecucion`
- `reporte`
- `alerta`

También habilita:

- **`uuid-ossp`**
- **`postgis`**

## Variables y configuración relevante

### Backend

Archivo: `backend/.env`

Variables observadas en el proyecto:

```env
DATABASE_URL=postgresql://admin:secure_password@postgres:5432/agricultura_db
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
ML_SERVICE_URL=http://ml-service:5000
OPENWEATHER_API_KEY=replace-with-your-key
N8N_WEBHOOK_URL=http://n8n:5678/webhook
N8N_CLIMATE_WEBHOOK_URL=http://n8n:5678/webhook/climate-ingest
N8N_API_URL=http://n8n:5678
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=admin123
WORKFLOW_SECRET=workflow_secret_local_2026
NEXT_PUBLIC_API_URL=http://localhost:3001
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### Frontend

El cliente usa:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Docker Compose

Servicios definidos:

- **postgres** → `5432`
- **redis** → `6379`
- **n8n** → `5678`
- **backend** → `3001`
- **frontend** → `3000`
- **ml-service** → `5000`

## Credenciales y accesos de desarrollo

### Usuario demo

El seed del backend crea este usuario:

- **Email:** `admin@agricultura.com`
- **Contraseña:** `admin123`

### n8n

Según `docker-compose.yml`:

- **URL:** `http://localhost:5678`
- **Usuario:** `admin`
- **Contraseña:** `admin123`

> **Importante:** cambia estas credenciales antes de usar el proyecto en un entorno real.

## Requisitos previos externos

Antes de levantar el proyecto necesitas contar con lo siguiente:

### OpenWeather API Key

El workflow de ingestión climática en **n8n** utiliza el servicio de OpenWeatherMap. Para que funcione correctamente:

1. Crea una cuenta gratuita en [https://openweathermap.org/](https://openweathermap.org/)
2. Ve a tu perfil → **API keys**
3. Copia tu API key personal
4. Reemplázala en una de estas ubicaciones antes de levantar los servicios:
   - En `docker-compose.yml` (línea de `OPENWEATHER_API_KEY`)
   - O en un archivo `.env` local que sobreescriba la variable

> **Importante:** la API key por defecto en el repositorio es un placeholder (`your-openweather-api-key`). Sin una key válida, el workflow de clima no podrá obtener datos meteorológicos reales.

### Otros secretos recomendados a cambiar

Aunque el proyecto levanta con los valores por defecto, en un entorno real deberías cambiar:

- `JWT_SECRET` en `backend/.env`
- `WORKFLOW_SECRET` en `docker-compose.yml` o en un `.env` local
- Credenciales de PostgreSQL en `docker-compose.yml`

## Instalación recomendada con Docker

Esta es la forma más rápida y confiable para levantar el proyecto en otra computadora.

### Requisitos

- **Docker Desktop** instalado
- **Docker Compose** disponible
- Puertos libres:
  - `3000`
  - `3001`
  - `5000`
  - `5432`
  - `5678`
  - `6379`

### Pasos

#### 1. Clonar el repositorio

```bash
git clone https://github.com/Dan101111111/agricultura-precision.git
```

#### 2. Entrar a la carpeta del proyecto

```bash
cd agricultura-precision
```

#### 3. Configurar tu API key de OpenWeather (obligatorio para clima)

Edita `docker-compose.yml` o crea un archivo `.env` en la raíz:

```env
OPENWEATHER_API_KEY=tu-api-key-de-openweathermap
```

#### 4. Levantar todos los servicios

```bash
docker compose up -d --build
```

#### 5. Verificar los contenedores

```bash
docker compose ps
```

#### 6. Abrir la aplicación

- **Frontend:** `http://localhost:3000`
- **Backend:** `http://localhost:3001`
- **n8n:** `http://localhost:5678`
- **ML Service health:** `http://localhost:5000/health`

### Qué hace Docker automáticamente en este proyecto

El contenedor de backend ejecuta al iniciar:

- `npx prisma db push`
- `npm run seed`
- arranque del backend NestJS

Además, PostgreSQL carga `init.sql` en el primer arranque del volumen.

## Instalación manual sin Docker

> **Nota:** este camino requiere más configuración. Si buscas rapidez y menos fricción, usa Docker.
>
> **Recuerda:** configura tu `OPENWEATHER_API_KEY` antes de ejecutar workflows de clima en n8n.

### Requisitos

- **Node.js 20**
- **npm**
- **Python 3.10**
- **PostgreSQL 15** con extensiones:
  - `uuid-ossp`
  - `postgis`
- **Redis 7**
- **n8n**

### 0. Configurar variables de entorno

Crea `backend/.env` basado en `backend/.env.example`:

```bash
cp backend/.env.example backend/.env
```

Edita `backend/.env` y añade al menos:

- `OPENWEATHER_API_KEY` (obligatorio para clima)
- `JWT_SECRET` (cámbialo en producción)
- `WORKFLOW_SECRET` (cámbialo en producción)

### 1. Base de datos

Crea una base PostgreSQL llamada `agricultura_db` y ejecuta `init.sql`.

Si también vas a usar n8n con PostgreSQL, crea `n8n_db`.

### 2. Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run seed
npm run start:dev
```

El backend quedará en:

- `http://localhost:3001`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

El frontend quedará en:

- `http://localhost:3000`

### 4. ML Service

```bash
cd ml-service
python -m venv .venv
```

#### Windows PowerShell

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

#### Linux / macOS

```bash
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

El servicio quedará en:

- `http://localhost:5000`

### 5. n8n

Levanta n8n y configura:

- conexión a PostgreSQL si usarás persistencia
- `WORKFLOW_SECRET`
- `BACKEND_INTERNAL_URL`
- importación de workflows desde `n8n-workflows/`

> En versiones recientes de n8n, el botón principal es **Publish** (en lugar de un toggle `Active` visible).  
> Si un workflow está **Published**, queda habilitado para recibir webhooks.

Al ingresar por primera vez a `http://localhost:5678/`, n8n pedirá crear la cuenta local del administrador.

Usa estos datos por comodidad en entorno local:

- **Email:** `admin@agricultura.local`
- **First Name:** `Admin`
- **Last Name:** `AgriPrecision`
- **Password:** `AdminN8n2026!`

Después del setup inicial:

- importa los workflows desde `n8n-workflows/`
- verifica que `WORKFLOW_SECRET` y `BACKEND_INTERNAL_URL` estén configurados por Docker
- crea las credenciales de PostgreSQL para el nodo final del workflow de ingesta climática

#### Checklist recomendado (primera vez)

1. Crear o validar al menos 1 sensor en la web (`/sensores`) antes de probar ingesta.
2. Importar `workflow-climate-ingest.json` desde la carpeta `n8n-workflows/`.
3. Abrir el workflow y confirmar:
   - **Webhook Trigger**: método `POST`, path `climate-ingest`.
   - **Set Coordinates**: toma `sensor_id` desde payload, incluyendo formato plano y `body`.
   - **Transform Data**: no usa UUID hardcodeado como fallback.
   - **PostgreSQL Insert**: apunta a `agricultura_db`.
4. Presionar **Publish** en n8n.
5. Probar desde la web con **Actualizar lecturas** en `/sensores`.

#### Importante sobre el webhook de clima

- Endpoint esperado: `POST /webhook/climate-ingest`
- El backend envía por sensor: `sensor_id`, `lat`, `lon`, `sensorCode`, `sensorType`, `loteId`, `userId`.
- Si ejecutas manualmente desde n8n sin payload, puede faltar `sensor_id` y fallará la inserción en `lectura_sensor`.
- Prueba manual mínima con body:

```json
{
  "sensor_id": "56469e31-eb64-44d0-a2b4-837dbeaf8449",
  "lat": -8.1159,
  "lon": -79.03
}
```

En el workflow de ingesta climática, en el nodo PostgreSQL, crea una credencial nueva con:

- **Host:** `postgres`
- **Port:** `5432`
- **Database:** `agricultura_db`
- **User:** `admin`
- **Password:** `secure_password`

Para una prueba manual rápida:

- crea primero el sensor desde la aplicación
- vuelve a importar o actualizar el workflow de ingesta
- prueba el flujo desde la app con **Actualizar lecturas** o usa un `sensor_id` válido al ejecutar manualmente
- confirma que aparezcan filas nuevas en `lectura_sensor`

## Workflows incluidos

Archivos disponibles en `n8n-workflows/`:

- `workflow-climate-ingest.json`
- `workflow-predictions-daily.json`
- `workflow-reports-scheduled.json`

### Uso esperado

- **Climate ingest**
  - actualiza lecturas de sensores

- **Predictions daily**
  - ejecuta predicciones automatizadas

- **Reports scheduled**
  - apoya generación programada de reportes

## API y comunicación interna

### Router tRPC

El backend expone tRPC en:

- **`/trpc`**

### Patrón del frontend

El frontend utiliza un cliente HTTP simple en `frontend/lib/api-client.ts` que:

- construye URLs hacia `/trpc/...`
- agrega `Authorization: Bearer <token>`
- usa `GET` o `POST` según el procedimiento

## Rutas y puertos útiles

- **Frontend:** `http://localhost:3000`
- **Backend:** `http://localhost:3001`
- **ML Service:** `http://localhost:5000`
- **n8n:** `http://localhost:5678`
- **PostgreSQL:** `localhost:5432`
- **Redis:** `localhost:6379`

## Scripts importantes

### Backend

```bash
npm run build
npm run start
npm run start:dev
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

### Frontend

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Estado actual del proyecto

Actualmente el proyecto cuenta con:

- **Dashboard operativo**
- **CRUD básico de fincas y lotes**
- **Sensores con resumen claro de sincronización**
- **Alertas con filtros y marcado masivo**
- **Riego con recomendaciones y métricas**
- **Predicciones con integración ML**
- **Reportes con descarga e historial**
- **Automatización visible desde dashboard y sensores**

## Flujo funcional recomendado para pruebas manuales

- **Login**
- **Dashboard**
- **Fincas**
- **Lotes**
- **Sensores**
- **Alertas**
- **Riego**
- **Predicciones**
- **Reportes**
- **n8n / automatización**

## Solución de problemas

### El frontend no carga

- verifica que `frontend` esté arriba en Docker
- confirma `NEXT_PUBLIC_API_URL`
- revisa si backend responde en `3001`

### El login falla

- confirma que corrió el seed
- verifica el usuario demo `admin@agricultura.com / admin123`
- revisa que el backend tenga `JWT_SECRET`

### n8n no ejecuta workflows

- verifica `WORKFLOW_SECRET`
- revisa `N8N_WEBHOOK_URL` y `N8N_CLIMATE_WEBHOOK_URL`
- comprueba que `n8n` esté accesible en `5678`
- confirma que el workflow `workflow-climate-ingest` esté importado en n8n
- confirma que el workflow esté **Published**
- valida que el nodo PostgreSQL use la base `agricultura_db` y no otra distinta
- verifica que la credencial del nodo PostgreSQL apunte al host `postgres` (si usas Docker Compose)
- prueba primero desde la web (`/sensores` -> **Actualizar lecturas**) para enviar payload completo

### El backend no conecta a la base de datos

- valida `DATABASE_URL`
- confirma que PostgreSQL esté arriba
- revisa que las extensiones `uuid-ossp` y `postgis` existan

### Error de foreign key en `lectura_sensor`

Si aparece un error como:

- `insert or update on table "lectura_sensor" violates foreign key constraint "lectura_sensor_sensor_id_fkey"`

significa que el workflow intentó insertar una lectura con un `sensor_id` que no existe en la tabla `sensor`.

Esto suele pasar cuando:

- la base de datos fue recreada en otra máquina y cambió el conjunto de sensores disponibles
- se ejecuta el workflow manualmente sin haber creado sensores antes
- el workflow conserva un `sensor_id` viejo usado como valor por defecto en pruebas anteriores
- el workflow recibe el payload en `body` y la expresión solo intenta leer `$json.sensor_id`

Recomendación:

- crea primero el sensor desde la aplicación
- vuelve a importar o actualizar el workflow de ingesta
- prueba el flujo desde la app con **Actualizar lecturas** o usa un `sensor_id` válido al ejecutar manualmente
- evita UUID hardcodeados como fallback en `Set Coordinates` y `Transform Data`

### El ML Service falla

- confirma `ML_SERVICE_URL`
- prueba `http://localhost:5000/health`
- verifica instalación de dependencias Python

## Consideraciones de seguridad

Antes de publicar o desplegar en un entorno real, cambia:

- **JWT secret**
- **credenciales de PostgreSQL**
- **credenciales de n8n**
- **WORKFLOW_SECRET**
- **API keys externas**
- **SMTP credentials**

Además:

- no subas credenciales reales al repositorio
- usa `.env` locales o secretos del proveedor de despliegue
- limita CORS en producción

## Mejoras futuras sugeridas

- **tests automáticos reales por módulo**
- **CI/CD**
- **migraciones controladas con Prisma**
- **roles y permisos más finos**
- **observabilidad y logs centralizados**
- **despliegue en nube**

## Licencia

Agrega aquí la licencia que prefieras antes de publicar el repositorio.

---

Si vas a subir este proyecto a GitHub, este README ya te deja una base sólida para:

- presentar la solución
- explicar la arquitectura
- documentar instalación y uso
- facilitar que otra persona lo levante en otra computadora
