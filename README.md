# 🌎 TerraPulse
### La Tierra en movimiento, vista desde el espacio.

**Plataforma de monitoreo y análisis satelital de cambios ambientales mediante datos abiertos, tecnología SAR e inteligencia artificial.**

[![NASA Space Apps Challenge 2026](https://img.shields.io/badge/NASA-Space%20Apps%20Challenge%202026-0B3D91?logo=nasa)](https://www.spaceappschallenge.org/)
![Status](https://img.shields.io/badge/Estado-Prototipo%20funcional-success)
![License](https://img.shields.io/badge/Licencia-Por%20definir-lightgrey)

**NASA Space Apps Challenge 2026 · Sede Durango · Reto 5: Dancing with the SARs**

---

## Descripción

TerraPulse es una plataforma web interactiva de observación de la Tierra que permite analizar cualquier región del planeta mediante datos satelitales abiertos, imágenes ópticas, información térmica y tecnología de radar de apertura sintética (SAR), especialmente del satélite NISAR.

La plataforma permite seleccionar una zona geográfica mediante un polígono, identificar cambios ambientales y visualizar posibles anomalías relacionadas con vegetación, humedad, temperatura superficial, incendios y condiciones del suelo.

Además, incorpora a **Terra**, una asistente virtual de voz en español que facilita la interpretación de los datos y permite realizar consultas sobre las regiones seleccionadas sin necesidad de conocimientos técnicos especializados.

El objetivo de TerraPulse es transformar la información científica obtenida desde el espacio en conocimiento accesible, comprensible y útil para la toma de decisiones ambientales.

## Reto seleccionado

**Reto 5: Dancing with the SARs**

NASA Space Apps Challenge 2026.

TerraPulse se desarrolla en respuesta al desafío Dancing with the SARs, cuyo enfoque es aprovechar la tecnología de radar de apertura sintética (SAR) para comprender mejor los procesos y cambios que ocurren en la superficie terrestre.

El radar SAR permite observar la Tierra mediante señales de microondas, ofreciendo ventajas frente a los sensores ópticos tradicionales, como la capacidad de obtener información durante la noche y una menor dependencia de las condiciones atmosféricas.

### Relación con el desafío

- **Radar como elemento central:** incorporación de información de las observaciones de radar NISAR.
- **Integración de múltiples fuentes:** combinación de información SAR con imágenes ópticas y térmicas.
- **Interpretación accesible:** presentación de resultados mediante mapas, indicadores y explicaciones en lenguaje natural.
- **Aplicación ambiental:** exploración de cambios relacionados con incendios forestales, vegetación, humedad y condiciones del terreno.

## Problemática

Las agencias espaciales generan grandes cantidades de información satelital que permiten estudiar los cambios ambientales del planeta. Sin embargo, estos datos se encuentran distribuidos en diferentes plataformas y requieren conocimientos especializados para descargarlos, procesarlos e interpretarlos.

Esto representa una barrera para agricultores, brigadistas forestales, autoridades, estudiantes y ciudadanos que necesitan comprender qué está ocurriendo en una zona determinada.

TerraPulse busca facilitar el acceso a esta información mediante una plataforma que integra diferentes fuentes satelitales y presenta sus resultados de manera visual e interactiva.

## Solución propuesta

TerraPulse permite seleccionar cualquier zona del planeta, consultar sus condiciones ambientales y explorar posibles anomalías mediante datos satelitales abiertos y observaciones de radar NISAR.

El sistema integra:

- Visualización geográfica en un globo 3D.
- Selección de regiones mediante polígonos.
- Análisis de indicadores ambientales.
- Comparación de imágenes satelitales históricas.
- Consulta de observaciones de radar SAR.
- Identificación de focos de calor y eventos naturales.
- Asistente virtual de voz en español.
- Generación de reportes en PDF.

## Funcionamiento

El análisis de TerraPulse se desarrolla mediante las siguientes etapas:

1. **Selección de una zona:** el usuario dibuja un polígono sobre el globo 3D o solicita una ubicación mediante comandos de voz. El sistema contempla zonas de hasta 1,500 km².
2. **Selección del análisis:** se elige entre vegetación, humedad, temperatura superficial, incendios, condiciones del suelo, radar NISAR o anomalías ambientales.
3. **Obtención de datos:** la plataforma consulta catálogos satelitales abiertos y obtiene las observaciones disponibles para la región.
4. **Procesamiento:** se calculan estadísticas zonales e indicadores ambientales a partir de las imágenes disponibles.
5. **Comparación histórica:** se comparan los valores actuales con registros de hasta cuatro años anteriores, considerando periodos similares del año.
6. **Análisis SAR:** se exploran variaciones de señal radar entre adquisiciones disponibles y comparables.
7. **Visualización e interpretación:** los resultados se muestran mediante mapas interactivos, indicadores, sectores coloreados y explicaciones de Terra.

La zona seleccionada puede dividirse en nueve sectores para facilitar la identificación visual de variaciones ambientales.

## Indicadores ambientales

| Área | Indicadores | Aplicación |
|---|---|---|
| Vegetación | NDVI, EVI, SAVI | Evaluación del vigor y densidad de la vegetación. |
| Humedad | NDMI, NDWI | Identificación de cambios relacionados con humedad vegetal y agua superficial. |
| Incendios | NBR, variación del NBR y focos de calor | Exploración de posibles señales de quema y severidad. |
| Suelos | BSI | Identificación de variaciones en la exposición de suelo desnudo. |
| Temperatura | Temperatura superficial (°C) | Análisis de cambios térmicos del terreno. |
| Radar | Variaciones de señal SAR de banda L | Exploración de cambios en las condiciones y estructura del terreno. |

Los indicadores se interpretan en conjunto, ya que una variación individual no confirma por sí misma la presencia de un fenómeno ambiental.

## Fuentes de datos satelitales

TerraPulse integra información procedente de diferentes agencias y plataformas de observación de la Tierra.

| Fuente | Agencia | Uso |
|---|---|---|
| NISAR GCOV mediante ASF DAAC | NASA / ISRO | Observaciones de radar de banda L y análisis de cambios en la señal. |
| Sentinel-1 | ESA | Información complementaria de radar SAR. |
| ALOS PALSAR | JAXA | Observaciones complementarias de radar. |
| Sentinel-2 L2A | ESA | Análisis de vegetación, humedad, incendios y suelo. |
| Landsat 8 y 9 | NASA / USGS | Información óptica y temperatura superficial. |
| HLS | NASA | Imágenes armonizadas de Landsat y Sentinel-2. |
| OPERA DIST-ALERT y DSWx | NASA JPL | Información sobre alteraciones de vegetación y agua superficial. |
| FIRMS | NASA | Identificación de focos de calor activos. |
| GIBS: MODIS, VIIRS, SMAP y GOES | NASA / NOAA | Visualización de capas globales e información histórica. |
| EONET | NASA | Consulta de eventos naturales registrados. |
| GDACS | ONU / Comisión Europea | Información sobre alertas de desastres. |
| Sentinel-2 Cloudless y Esri World Imagery | ESA / Esri | Visualización cartográfica del territorio. |

## Asistente virtual Terra

Terra es la asistente virtual integrada en la plataforma. Permite interactuar mediante voz en español para facilitar la consulta de información geográfica y ambiental.

### Funcionalidades

- Interpretación de preguntas en español.
- Selección de ubicaciones mediante comandos de voz.
- Activación de análisis ambientales.
- Explicación de resultados satelitales.
- Navegación entre herramientas de la plataforma.
- Consulta de indicadores ambientales.

La asistente utiliza una lista controlada de acciones disponibles dentro del sistema. Las acciones que impliquen borrar, enviar o compartir información requieren confirmación del usuario.

### Tecnología de voz

- Gemini Live API con token temporal.
- Voz del navegador como mecanismo de respaldo.

## ✨ Funcionalidades principales

- 🌐 Globo terrestre interactivo en 3D.
- 🛰️ Visualización de diferentes capas satelitales.
- 📍 Selección de regiones mediante polígonos.
- 🌱 Análisis de vegetación y humedad.
- 🔥 Consulta de focos de calor y eventos naturales.
- 🌡️ Análisis de temperatura superficial.
- 📡 Exploración de observaciones de radar NISAR.
- 🕒 Comparador de imágenes antes y después.
- 🎞️ Animaciones temporales.
- 🤖 Asistente virtual de voz en español.
- 📄 Generación de reportes en PDF.
- 📈 Visualización de anomalías ambientales.
- 🌎 Consulta de información de diferentes regiones del planeta.

## Tecnologías utilizadas

| Componente | Tecnología |
|---|---|
| Interfaz web | HTML, CSS y JavaScript |
| Herramienta de desarrollo web | Vite |
| Globo 3D | CesiumJS |
| Backend | Python y FastAPI |
| Base de datos | Supabase con PostgreSQL |
| Procesamiento de imágenes | Catálogos STAC y Microsoft Planetary Computer |
| Consulta de radar | API de ASF y biblioteca asf_search |
| Inteligencia artificial | Gemini Live API |
| Voz de respaldo | Web Speech API / voz del navegador |
| Generación de reportes | jsPDF |
| Visualización | Mapas interactivos y comparador temporal |

## Arquitectura del proyecto

TerraPulse utiliza una arquitectura web con separación entre la interfaz de usuario y el backend encargado de consultar y procesar información satelital.

```text
TerraPulse/
│
├── backend/
│   ├── API FastAPI
│   ├── Consulta de eventos naturales
│   ├── Consulta de escenas SAR
│   ├── Integración con ASF
│   ├── NASA GIBS
│   └── Proyección de riesgo ambiental
│
├── src/
│   ├── Interfaz web
│   ├── CesiumJS
│   ├── Visualización geográfica
│   ├── Análisis ambiental
│   ├── Asistente Terra
│   └── Reportes PDF
│
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

## Instalación y ejecución

### Requisitos

- Node.js y npm.
- Python 3.
- Dependencias de Python especificadas en `backend/requirements.txt`.
- Acceso a internet para consultar los servicios satelitales.

### 1. Clonar el repositorio

```bash
git clone https://github.com/eduardo24-max/TerraPulse.git
cd TerraPulse
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar el entorno

Si el proyecto requiere variables de entorno, configura los archivos `.env` correspondientes en el backend.

Para preparar el entorno de Python cuando no exista:

```bash
npm run setup
```

Este comando crea el entorno virtual `backend/.venv` e instala las dependencias especificadas en `backend/requirements.txt`.

### 4. Ejecutar el proyecto

```bash
npm run dev
```

Este comando inicia el backend FastAPI y el servidor de desarrollo Vite.

La interfaz web estará disponible normalmente en:

```text
http://localhost:5173
```

La API local utiliza:

```text
http://127.0.0.1:8000
```

La configuración de Vite permite redirigir las solicitudes `/api/...` hacia el backend local mediante el proxy definido en `vite.config.js`.

## Impacto ambiental y social

TerraPulse busca facilitar el acceso a información satelital para diferentes sectores de la sociedad.

| Beneficiarios | Aplicación |
|---|---|
| Agricultores y ejidos | Identificación de cambios en vegetación y posibles variaciones de humedad. |
| Brigadas forestales | Consulta de focos de calor y posibles señales de quema. |
| Protección Civil | Identificación preliminar de áreas que requieren inspección. |
| Autoridades municipales y estatales | Consulta de información geoespacial para apoyar decisiones territoriales. |
| Científicos y estudiantes | Exploración de información de radar, sensores ópticos y térmicos. |
| Ciudadanía | Comprensión de los cambios ambientales de su entorno. |

### Objetivos de impacto

- Apoyar la detección temprana de cambios ambientales.
- Contribuir al seguimiento de incendios forestales.
- Promover la conservación de los ecosistemas.
- Facilitar el acceso a datos satelitales abiertos.
- Impulsar la divulgación científica.
- Apoyar la toma de decisiones basada en información geoespacial.

## Demostración y estado del proyecto

**Prototipo web:** [Abrir TerraPulse](https://eduardo24-max.github.io/TerraPulse/)

**Repositorio:** [GitHub - TerraPulse](https://github.com/eduardo24-max/TerraPulse)

El prototipo permite acceder a la interfaz web desde un navegador compatible y explorar las herramientas de visualización y análisis ambiental disponibles.

### Estado de los componentes

| Componente | Estado |
|---|---|
| Prototipo web | Publicado en GitHub Pages. |
| Interfaz interactiva | Implementada. |
| Visualización geográfica 3D | Implementada mediante CesiumJS. |
| Análisis ambiental por zona | Disponible en el prototipo. |
| Asistente Terra | Integrado; activación de Gemini Live pendiente de configuración de clave en servidor. |
| Repositorio GitHub | Disponible. |

## Caso de prueba

Como prueba de funcionamiento se utilizó un polígono de 12.5 km² correspondiente a una zona afectada por un incendio forestal en Serbia durante agosto de 2026.

Los resultados obtenidos por el prototipo fueron:

| Indicador | Resultado |
|---|---|
| NDVI | 0.34 frente a un valor de referencia de 0.62. |
| Variación del NDVI | Aproximadamente 45 % inferior al valor de referencia. |
| NBR | -0.13 frente a un valor de referencia de 0.21. |
| Interpretación del NBR | Posible quema de severidad moderada. |
| Sectores bajo lo normal | 9 de 9 sectores. |
| Señal radar NISAR | Estimación de una reducción del 38 % entre observaciones de junio y noviembre de 2026. |

Estos resultados corresponden a una demostración del prototipo y no constituyen una validación científica definitiva. La interpretación del radar se encuentra limitada por la resolución y calibración de las imágenes utilizadas.

## ⚠️ Limitaciones técnicas

- El análisis radar se estima a partir de imágenes de vista previa de aproximadamente 120 metros por píxel, sin calibración completa. Por ello, se considera un indicio de cambio y no una medición definitiva.
- Las variaciones radar pueden deberse a factores estacionales, humedad, geometría de observación y características de la superficie.
- La temperatura corresponde a la superficie terrestre, no a la temperatura del aire.
- Los indicadores de humedad y suelo se obtienen principalmente mediante índices ópticos y no representan una medición directa de humedad del suelo por polígono.
- La proyección de riesgo ambiental utiliza actualmente un enfoque paramétrico, no un modelo predictivo entrenado y validado.
- Los focos de calor detectados mediante FIRMS no confirman por sí mismos la existencia de un incendio.
- Los resultados dependen de la disponibilidad, calidad, resolución y fecha de las observaciones satelitales.

TerraPulse es una herramienta de exploración y apoyo al análisis ambiental. No sustituye las inspecciones de campo ni los sistemas oficiales de emergencia.

## Futuras mejoras

- Calibración y procesamiento avanzado de productos GCOV de NISAR.
- Incorporación de análisis de deformación del terreno mediante interferometría, cuando sea técnicamente viable.
- Implementación de alertas automáticas para zonas de interés.
- Integración de productos especializados de humedad del suelo.
- Desarrollo y validación de modelos de riesgo ambiental.
- Incorporación de cuentas de usuario y zonas compartidas.
- Pruebas piloto con brigadas forestales, instituciones académicas y comunidades rurales.
- Expansión de las capacidades de análisis a diferentes regiones del planeta.

## Conclusión

TerraPulse propone una nueva forma de acercar la observación de la Tierra a las personas. A través de la integración de datos satelitales abiertos, tecnología de radar NISAR, análisis ambiental e inteligencia artificial conversacional, el proyecto transforma información científica compleja en una experiencia interactiva y accesible.

Su principal propuesta consiste en combinar la capacidad de observación del radar con sensores ópticos y térmicos, ofreciendo una interpretación ambiental mediante mapas, indicadores y explicaciones en español.

**TerraPulse: comprender los cambios de nuestro planeta para actuar mejor en la Tierra.**

---

## 🔗 Enlaces del proyecto

- **Prototipo web:** https://eduardo24-max.github.io/TerraPulse/
- **Repositorio GitHub:** https://github.com/eduardo24-max/TerraPulse

## Autoría

Proyecto desarrollado para el **NASA Space Apps Challenge 2026**, sede Durango, en el marco del reto **Dancing with the SARs**.