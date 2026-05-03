-- Crear base de datos de n8n si no existe (necesaria para docker-compose)
SELECT 'CREATE DATABASE n8n_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'n8n_db')\gexec

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
-- Tabla de Roles
CREATE TABLE rol (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 nombre VARCHAR(50) UNIQUE NOT NULL,
 descripcion TEXT,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Tabla de Usuarios
CREATE TABLE usuario (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 email VARCHAR(255) UNIQUE NOT NULL,
 password_hash VARCHAR(255) NOT NULL,
 nombre VARCHAR(100) NOT NULL,
 apellido VARCHAR(100) NOT NULL,
 telefono VARCHAR(20),
 rol_id UUID NOT NULL REFERENCES rol(id),
 activo BOOLEAN DEFAULT true,
 ultimo_acceso TIMESTAMP,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Tabla de Fincas
CREATE TABLE finca (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 nombre VARCHAR(100) NOT NULL,
 ubicacion VARCHAR(255),
 area_hectareas DECIMAL(10,2) CHECK (area_hectareas > 0),
 coordenadas JSONB,
 usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE
CASCADE,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Tabla de Lotes
CREATE TABLE lote (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 nombre VARCHAR(100) NOT NULL,
 area_hectareas DECIMAL(10,2) CHECK (area_hectareas > 0),
 tipo_suelo VARCHAR(50) CHECK (tipo_suelo IN ('arcilloso', 'arenoso',
'limoso', 'franco', 'orgánico')),
 coordenadas_poligono JSONB,
 finca_id UUID NOT NULL REFERENCES finca(id) ON DELETE CASCADE,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Tabla de Cultivos
CREATE TABLE cultivo (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 nombre VARCHAR(100) NOT NULL,
 variedad VARCHAR(100),
 ciclo_dias INTEGER CHECK (ciclo_dias > 0),
 requerimiento_agua_mm DECIMAL(5,2),
 temperatura_optima DECIMAL(4,1),
 humedad_optima INTEGER CHECK (humedad_optima BETWEEN 0 AND
100)
);
-- Tabla de Temporadas
CREATE TABLE temporada (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 cultivo_id UUID NOT NULL REFERENCES cultivo(id),
 lote_id UUID NOT NULL REFERENCES lote(id) ON DELETE CASCADE,
 fecha_siembra DATE NOT NULL,
 fecha_cosecha_estimada DATE,
 fecha_cosecha_real DATE,
 estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('planificado',
'activo', 'cosechado', 'fallido')),
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(lote_id, fecha_siembra)
);
-- Tabla de Sensores
CREATE TABLE sensor (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 codigo VARCHAR(50) UNIQUE NOT NULL,
 tipo VARCHAR(50) CHECK (tipo IN ('clima', 'suelo', 'humedad',
'temperatura')),
 ubicacion JSONB,
 lote_id UUID REFERENCES lote(id) ON DELETE SET NULL,
 instalado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 ultimo_mantenimiento TIMESTAMP,
 activo BOOLEAN DEFAULT true
);
-- Tabla de Lecturas de Sensores
CREATE TABLE lectura_sensor (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 sensor_id UUID NOT NULL REFERENCES sensor(id) ON DELETE
CASCADE,
 timestamp TIMESTAMP NOT NULL,
 temperatura DECIMAL(4,1),
 humedad_suelo INTEGER CHECK (humedad_suelo BETWEEN 0 AND 100),
 humedad_ambiente INTEGER CHECK (humedad_ambiente BETWEEN 0
AND 100),
 precipitacion DECIMAL(5,1),
 radiacion_solar DECIMAL(7,1),
 velocidad_viento DECIMAL(5,2),
 presion_atmosferica DECIMAL(6,2),
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Tabla de Eventos de Riego
CREATE TABLE evento_riego (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 lote_id UUID NOT NULL REFERENCES lote(id) ON DELETE CASCADE,
 fecha_hora TIMESTAMP NOT NULL,
 duracion_minutos INTEGER CHECK (duracion_minutos > 0),
 volumen_m3 DECIMAL(10,2),
 tipo_riego VARCHAR(20) CHECK (tipo_riego IN ('goteo', 'aspersion',
'inundacion', 'subterraneo')),
 origen_decision VARCHAR(50) CHECK (origen_decision IN ('manual',
'automatico', 'prediccion_ml', 'programado')),
 eficiencia DECIMAL(3,2) CHECK (eficiencia BETWEEN 0 AND 1),
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Tabla de Predicciones de Rendimiento
CREATE TABLE prediccion_rendimiento (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 lote_id UUID NOT NULL REFERENCES lote(id) ON DELETE CASCADE,
 temporada_id UUID NOT NULL REFERENCES temporada(id) ON DELETE
CASCADE,
 fecha_prediccion DATE NOT NULL,
 rendimiento_estimado_kg_ha DECIMAL(10,2),
 intervalo_confianza_inf DECIMAL(10,2),
 intervalo_confianza_sup DECIMAL(10,2),
 factores_influencia JSONB,
 modelo_utilizado VARCHAR(100),
 precision_modelo DECIMAL(4,3),
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Tabla de Ejecuciones de Workflows
CREATE TABLE workflow_ejecucion (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 workflow_nombre VARCHAR(100) NOT NULL,
 inicio_ejecucion TIMESTAMP NOT NULL,
 fin_ejecucion TIMESTAMP,
 estado VARCHAR(20) DEFAULT 'ejecutando' CHECK (estado IN
('ejecutando', 'completado', 'fallido', 'cancelado')),
 parametros_entrada JSONB,
 resultado_salida JSONB,
 error_mensaje TEXT,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Tabla de Reportes
CREATE TABLE reporte (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 usuario_id UUID NOT NULL REFERENCES usuario(id),
 workflow_ejecucion_id UUID REFERENCES workflow_ejecucion(id),
 tipo VARCHAR(50) CHECK (tipo IN ('operacional', 'gestion', 'prediccion',
'riego')),
 formato VARCHAR(20) DEFAULT 'pdf' CHECK (formato IN ('pdf', 'csv',
'json')),
 url_archivo VARCHAR(500),
 parametros_filtros JSONB,
 tamanio_bytes INTEGER,
 generado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 descargado_en TIMESTAMP
);
-- Tabla de Alertas
CREATE TABLE alerta (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 usuario_id UUID NOT NULL REFERENCES usuario(id),
 lote_id UUID REFERENCES lote(id) ON DELETE CASCADE,
 tipo VARCHAR(50) CHECK (tipo IN ('riego', 'clima', 'plaga', 'rendimiento',
'sistema')),
 severidad VARCHAR(20) CHECK (severidad IN ('info', 'advertencia', 'critica',
'emergencia')),
 mensaje TEXT NOT NULL,
 datos_contexto JSONB,
 leida BOOLEAN DEFAULT false,
 creada_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 leida_en TIMESTAMP
);
-- Índices para optimización
CREATE INDEX idx_usuario_email ON usuario(email);
CREATE INDEX idx_lectura_sensor_timestamp ON lectura_sensor(timestamp);
CREATE INDEX idx_evento_riego_fecha ON evento_riego(fecha_hora);
CREATE INDEX idx_prediccion_fecha ON
prediccion_rendimiento(fecha_prediccion);
CREATE INDEX idx_alerta_usuario_leida ON alerta(usuario_id, leida);
CREATE INDEX idx_temporada_estado ON temporada(estado);
-- Comentarios en español
COMMENT ON TABLE usuario IS 'Usuarios del sistema de agricultura de
precisión';
COMMENT ON TABLE finca IS 'Fincas agrícolas pertenecientes a usuarios';
COMMENT ON TABLE lote IS 'Lotes o parcelas dentro de las fincas';
COMMENT ON TABLE lectura_sensor IS 'Lecturas históricas de sensores IoT';
COMMENT ON TABLE prediccion_rendimiento IS 'Predicciones de rendimiento
generadas por modelos ML';
COMMENT ON TABLE alerta IS 'Alertas generadas automáticamente por el
sistema';
