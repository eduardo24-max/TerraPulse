# TerraPulse

Monitoreo satelital de los cambios de la superficie terrestre: agua, bosques, agricultura, humedad del suelo, hielo y deformación.
NASA Space Apps Challenge 2026 · Reto 5 *Dancing with the SARs*.

# TERRAPULSE

*La Tierra en movimiento, vista desde el espacio*

**NASA Space Apps Challenge 2026 | Sede Durango**

Anteproyecto · 15 de noviembre de 2026

## 1. Título del proyecto

### TerraPulse — La Tierra en movimiento, vista desde el espacio

TerraPulse es una plataforma web interactiva de observación de la Tierra que permite analizar cualquier región del planeta mediante datos satelitales abiertos, imágenes ópticas, información térmica y tecnología de radar de apertura sintética (SAR), especialmente del satélite NISAR.

La plataforma permite seleccionar una zona geográfica mediante un polígono, identificar cambios ambientales y visualizar posibles anomalías relacionadas con vegetación, humedad, temperatura del terreno, incendios y condiciones del suelo.

Además, incorpora a Terra, una asistente virtual de voz en español que facilita la interpretación de los datos y permite realizar consultas sobre las regiones seleccionadas sin necesidad de conocimientos técnicos especializados.

El objetivo de TerraPulse es transformar la información científica obtenida desde el espacio en conocimiento accesible, comprensible y útil para la toma de decisiones ambientales.

## 2. El reto seleccionado

### Reto 5: Dancing with the SARs

NASA Space Apps Challenge 2026 — Sede Durango

TerraPulse se desarrolla en respuesta al desafío Dancing with the SARs, cuyo enfoque es aprovechar la tecnología de radar de apertura sintética (SAR) para comprender mejor los procesos y cambios que ocurren en la superficie terrestre.

El radar SAR permite observar la Tierra mediante señales de microondas, ofreciendo ventajas importantes frente a los sensores ópticos tradicionales. Entre ellas, la capacidad de obtener información durante la noche y atravesar determinadas condiciones atmosféricas, como la presencia de nubes.

#### Relación de TerraPulse con el desafío

- Radar como elemento central: TerraPulse incorpora información de las observaciones de radar NISAR para identificar cambios en la señal del terreno entre diferentes adquisiciones.
- Integración de múltiples fuentes: combina información de radar con imágenes ópticas y térmicas de Sentinel-2 y Landsat para comprender mejor los cambios detectados.
- Interpretación accesible: los resultados se presentan mediante mapas, indicadores visuales y explicaciones en lenguaje natural.
- Aplicación ambiental: permite estudiar posibles cambios relacionados con incendios forestales, alteraciones de vegetación, humedad y condiciones del terreno.

De esta manera, TerraPulse busca acercar las capacidades de observación SAR a usuarios que normalmente no cuentan con herramientas especializadas para interpretar estos datos.

## 3. Resumen / Elevator Pitch

### El problema

La NASA, ESA, USGS y otras instituciones generan enormes cantidades de información satelital que permiten estudiar los cambios ambientales del planeta. Sin embargo, estos datos suelen encontrarse distribuidos en diferentes plataformas y requieren conocimientos especializados para descargarlos, procesarlos e interpretarlos.

Esto representa una barrera para agricultores, brigadistas forestales, autoridades municipales, estudiantes y ciudadanos que necesitan comprender qué está ocurriendo en una zona determinada.

Preguntas como las siguientes no siempre pueden responderse fácilmente mediante las herramientas convencionales:

- ¿Mi parcela presenta menos vegetación que en años anteriores?
- ¿Una zona forestal muestra señales de posible incendio?
- ¿El terreno presenta cambios anormales de humedad?
- ¿Qué sectores de una región están experimentando mayores alteraciones?

### ¿Por qué es importante?

Comprender los cambios ambientales permite mejorar la prevención, identificar zonas que requieren atención y apoyar decisiones relacionadas con la conservación de los recursos naturales. La tecnología SAR aporta una ventaja adicional al permitir observaciones independientemente de la iluminación solar y con menor dependencia de las condiciones atmosféricas que los sensores ópticos.

### La propuesta

**TerraPulse permite seleccionar cualquier zona del planeta, consultar sus condiciones ambientales y descubrir posibles anomalías mediante datos satelitales abiertos y radar NISAR, todo explicado por una asistente de voz en español.**

### Elevator Pitch de 30 segundos

TerraPulse convierte los datos satelitales en información ambiental fácil de entender. Selecciona una zona del planeta, pregunta qué está pasando y nuestra plataforma combina imágenes de satélite, sensores térmicos y radar NISAR para identificar cambios en vegetación, humedad, temperatura e incendios. Con Terra, nuestra asistente de voz, cualquier persona puede comprender lo que ocurre en su entorno. TerraPulse: la Tierra en movimiento, vista desde el espacio.

### Guion del video de presentación (30 segundos)

| Tiempo | Imagen | Narración |
| --- | --- | --- |
| 0–5 s | Globo terrestre girando y acercándose a Durango. | «La Tierra cambia todos los días, y casi nadie puede verlo». |
| 5–12 s | Se dibuja un polígono sobre una zona forestal. | «Con TerraPulse, seleccionas cualquier zona del planeta». |
| 12–22 s | Aparecen capas de vegetación, humedad, temperatura y radar. | «Preguntas con tu voz y los satélites y el radar NISAR te ayudan a descubrir qué está cambiando». |
| 22–30 s | Comparación antes/después de un incendio y aparición del logotipo. | «Comprende los cambios de nuestro planeta. TerraPulse: la Tierra en movimiento, vista desde el espacio». |

## 4. La solución / Propuesta

### 4.1. Enfoque técnico

TerraPulse funciona mediante un proceso de selección, análisis, comparación e interpretación de información satelital.

#### Flujo de funcionamiento

**1. Selección de una zona:** El usuario puede dibujar un polígono sobre el globo 3D o solicitar a Terra una ubicación específica. Ejemplo: «Encierra dos kilómetros alrededor de Durango». El sistema permite analizar zonas de hasta 1,500 km².

**2. Selección del análisis:** El usuario puede consultar vegetación, humedad, temperatura superficial, incendios, condiciones del suelo, radar NISAR o anomalías ambientales generales.

**3. Obtención de datos satelitales:** La plataforma consulta catálogos abiertos y selecciona las observaciones disponibles para la región, considerando fecha, cobertura y calidad de los datos.

**4. Procesamiento de imágenes:** Se calculan estadísticas zonales e indicadores ambientales a partir de las imágenes satelitales disponibles. Para Sentinel-2 se utilizan índices de resolución espacial de hasta 10 metros, dependiendo de las bandas utilizadas.

**5. Comparación histórica:** Los valores actuales se comparan con registros de hasta cuatro años anteriores, considerando periodos similares del año. La zona seleccionada se divide en nueve sectores, clasificados como anomalía severa, bajo lo normal, normal o más verde de lo habitual.

**6. Análisis mediante radar:** Se identifican observaciones de NISAR sobre la región y se estima el cambio de señal entre adquisiciones comparables. Este análisis permite explorar posibles alteraciones en la estructura y condiciones del terreno, considerando que la señal radar también puede variar por humedad, vegetación, geometría de observación y otros factores.

**7. Interpretación de resultados:** Los resultados se presentan mediante mapas interactivos, sectores coloreados, indicadores ambientales, comparaciones históricas, explicaciones en lenguaje natural y respuestas de Terra mediante voz.

El sistema busca que el usuario no solamente vea un indicador, sino que comprenda qué mide, qué significa y cuáles son sus limitaciones.

### 4.2. Indicadores ambientales utilizados

| Área | Indicadores | Aplicación |
| --- | --- | --- |
| Vegetación | NDVI, EVI, SAVI | Evaluar vigor y densidad de la vegetación. |
| Humedad | NDMI, NDWI | Identificar cambios relacionados con humedad vegetal y agua superficial. |
| Incendios | NBR, variación del NBR y focos de calor | Detectar posibles señales de quema y estimar su severidad. |
| Suelos | BSI | Identificar variaciones en la exposición de suelo desnudo. |
| Temperatura | Temperatura superficial en °C | Analizar cambios térmicos del terreno. |
| Radar | Variaciones de señal SAR de banda L | Explorar cambios en las condiciones y estructura del terreno. |

Los indicadores se interpretan en conjunto, ya que una variación individual no confirma por sí misma la presencia de un fenómeno ambiental.

### 4.3. Uso de datos abiertos

| Fuente de datos | Agencia | Uso dentro de TerraPulse |
| --- | --- | --- |
| NISAR GCOV, mediante ASF DAAC | NASA / ISRO | Observaciones de radar de banda L y análisis de cambios en la señal. |
| Sentinel-1 | ESA | Información complementaria de radar SAR. |
| ALOS PALSAR | JAXA | Observaciones de radar complementarias. |
| Sentinel-2 L2A | ESA | Análisis de vegetación, humedad, incendios y suelo. |
| Landsat 8 y 9 | NASA / USGS | Análisis de temperatura superficial e información óptica. |
| HLS | NASA | Imágenes armonizadas de Landsat y Sentinel-2 para comparaciones temporales. |
| OPERA DIST-ALERT y DSWx | NASA JPL | Información sobre alteraciones de vegetación y agua superficial. |
| FIRMS | NASA | Identificación de focos de calor activos. |
| GIBS: MODIS, VIIRS, SMAP y GOES | NASA / NOAA | Visualización de capas globales e información histórica. |
| EONET | NASA | Consulta de eventos naturales registrados. |
| GDACS | ONU / Comisión Europea | Información sobre alertas de desastres. |
| Sentinel-2 Cloudless y Esri World Imagery | ESA / Esri | Capas cartográficas y visualización del territorio. |

El uso de estos datos permite construir una plataforma basada en información científica abierta, sin depender exclusivamente de fuentes comerciales.

### 4.4. Herramientas y tecnologías

| Componente | Tecnología |
| --- | --- |
| Interfaz web | HTML, CSS y JavaScript con Vite. |
| Globo 3D | CesiumJS. |
| Backend | Python y FastAPI. |
| Base de datos | Supabase con PostgreSQL. |
| Procesamiento de imágenes | Catálogos STAC y Microsoft Planetary Computer. |
| Consulta de radar | API de ASF y biblioteca asf_search. |
| Asistente de voz | Gemini Live API con token temporal. |
| Modo de respaldo de voz | Voz del navegador. |
| Generación de reportes | jsPDF. |
| Visualización | Mapas interactivos, capas satelitales y comparador temporal. |

#### Inteligencia artificial y asistente Terra

Terra es la asistente virtual integrada en la plataforma. Sus funciones principales son interpretar preguntas en español, permitir seleccionar ubicaciones mediante comandos de voz, activar análisis ambientales, explicar resultados satelitales y facilitar la navegación entre herramientas. La asistente utiliza una lista controlada de acciones disponibles dentro del sistema. Las acciones que impliquen borrar, enviar o compartir información requieren confirmación del usuario.

### 4.5. Funcionalidades adicionales

- Comparador de imágenes antes/después.
- Animaciones temporales.
- Eventos naturales filtrados según la vista del mapa.
- Proyección de riesgo ambiental.
- Generación de reportes en PDF.
- Visualización de diferentes capas satelitales.

Estas herramientas complementan el análisis y permiten explorar los cambios ambientales desde distintas perspectivas.

## 5. Impacto y aplicabilidad

### 5.1. Beneficiarios

| Usuario | Beneficio |
| --- | --- |
| Agricultores y ejidos | Identificar cambios en el vigor de la vegetación y posibles variaciones de humedad en sus parcelas. |
| Brigadas forestales | Consultar focos de calor, posibles señales de quema y sectores con anomalías ambientales. |
| Protección Civil | Obtener información preliminar para identificar áreas que requieren inspección. |
| Autoridades municipales y estatales | Disponer de evidencia satelital con fecha y fuente para apoyar decisiones territoriales. |
| Científicos y estudiantes | Explorar información de radar, sensores ópticos y térmicos desde una interfaz integrada. |
| Ciudadanía | Comprender los cambios ambientales de su entorno sin conocimientos técnicos avanzados. |

### 5.2. Impacto ambiental y social

- La detección temprana de cambios ambientales.
- La prevención y seguimiento de incendios forestales.
- La conservación de ecosistemas.
- El uso responsable de recursos naturales.
- La divulgación científica.
- La democratización del acceso a datos satelitales.
- La toma de decisiones basada en información geoespacial.

La plataforma no sustituye las inspecciones de campo ni los sistemas oficiales de emergencia, sino que funciona como una herramienta complementaria para identificar áreas de interés y apoyar su evaluación.

### 5.3. Escalabilidad y siguientes pasos

**1. Calibración del análisis radar:** Procesar productos GCOV completos de NISAR para mejorar la precisión del análisis de retrodispersión e incorporar, cuando sea técnicamente viable, estudios de deformación del terreno mediante interferometría.

**2. Alertas automáticas:** Permitir que los usuarios guarden zonas de interés y reciban notificaciones cuando se detecten cambios significativos.

**3. Medición directa de humedad del suelo:** Integrar productos especializados de humedad del suelo y mejorar la interpretación de los indicadores ópticos.

**4. Modelo de riesgo validado:** Sustituir la proyección paramétrica actual por un modelo entrenado y validado con eventos históricos.

**5. Trabajo colaborativo:** Incorporar cuentas de usuario, zonas compartidas y herramientas colaborativas para brigadas, ejidos y dependencias.

**6. Implementación piloto en Durango:** Validar la plataforma en campo con una brigada forestal, institución académica o comunidad rural de la región.

**7. Expansión internacional:** Ampliar la cobertura y las capacidades de análisis para que TerraPulse pueda utilizarse en diferentes regiones del planeta.

## 6. Demostración (MVP / Prototipo)

### 6.1. Estado actual del prototipo

TerraPulse cuenta con un prototipo web publicado mediante GitHub Pages, que permite acceder a la interfaz desde cualquier navegador compatible.

**Enlace al prototipo funcional:** https://eduardo24-max.github.io/TerraPulse/

**Repositorio GitHub:** https://github.com/eduardo24-max/TerraPulse

El prototipo también puede ejecutarse en un entorno local mediante el comando npm run dev.

| Entregable | Estado |
| --- | --- |
| Prototipo web | Publicado en GitHub Pages. |
| Interfaz interactiva | Implementada. |
| Visualización geográfica | Implementada mediante globo 3D. |
| Análisis ambiental por zona | Disponible en el prototipo. |
| Asistente Terra | Integrado; activación de Gemini Live pendiente de configuración de clave en servidor. |
| Repositorio GitHub | Disponible. |
| Video de demostración de 30 segundos | Pendiente de grabación. |

### 6.2. Demostración del funcionamiento

1. El usuario accede al prototipo mediante el enlace publicado.
2. Activa a Terra mediante el botón de voz.
3. Solicita una ubicación mediante voz.
4. Selecciona una región y delimita un polígono.
5. Pregunta: «¿Hay anomalías?».
6. TerraPulse analiza los indicadores disponibles y muestra los sectores correspondientes en el mapa.
7. Terra explica los resultados, incluyendo la información disponible del radar NISAR.
8. El usuario consulta un indicador específico, como temperatura o vegetación.
9. Finalmente, abre el comparador antes/después para explorar los cambios mediante imágenes satelitales.

### 6.3. Caso de prueba del prototipo

Como prueba de funcionamiento, se utilizó un polígono de 12.5 km² correspondiente a una zona afectada por un incendio forestal en Serbia durante agosto de 2026. Los resultados obtenidos por el prototipo fueron los siguientes:

| Indicador | Resultado |
| --- | --- |
| NDVI | 0.34 frente a un valor de referencia de 0.62. |
| Variación del NDVI | Aproximadamente 45 % inferior al valor de referencia. |
| NBR | −0.13 frente a un valor de referencia de 0.21. |
| Interpretación del NBR | Posible quema de severidad moderada. |
| Sectores bajo lo normal | 9 de 9 sectores. |
| Señal radar NISAR | Estimación de una reducción del 38 % entre observaciones de junio y noviembre de 2026. |

Estos resultados corresponden a una demostración del prototipo y no constituyen una validación científica definitiva. La interpretación del radar se encuentra limitada por la resolución y calibración de las imágenes utilizadas.

### 6.4. Limitaciones técnicas

- El análisis radar se estima a partir de imágenes de vista previa de aproximadamente 120 metros por píxel, sin calibración completa. Por ello, se considera un indicio de cambio y no una medición definitiva.
- Las variaciones radar pueden deberse a factores estacionales, humedad, geometría de observación y características de la superficie.
- La temperatura corresponde a la superficie terrestre, no a la temperatura del aire, y puede variar considerablemente según las condiciones de adquisición.
- Los indicadores de humedad y suelo se obtienen principalmente mediante índices ópticos; no representan una medición directa de humedad del suelo por polígono.
- La proyección de riesgo ambiental utiliza actualmente un enfoque paramétrico, no un modelo predictivo entrenado y validado.
- Los focos de calor detectados mediante FIRMS no confirman por sí mismos la existencia de un incendio.
- Los resultados dependen de la disponibilidad, calidad, resolución y fecha de las observaciones satelitales.

### 6.5. Enlaces y materiales de presentación

**Prototipo web:** https://eduardo24-max.github.io/TerraPulse/

**Repositorio GitHub:** https://github.com/eduardo24-max/TerraPulse

Video de demostración (máximo 30 segundos): Pendiente de grabación y publicación.

Equipo: Pendiente de agregar nombres de los integrantes.

## Conclusión

TerraPulse propone una nueva forma de acercar la observación de la Tierra a las personas. A través de la integración de datos satelitales abiertos, tecnología de radar NISAR, análisis ambiental e inteligencia artificial conversacional, el proyecto transforma información científica compleja en una experiencia interactiva y accesible.

Su principal innovación consiste en combinar la capacidad de observación del radar con sensores ópticos y térmicos, ofreciendo una interpretación ambiental mediante mapas, indicadores y explicaciones en español.

TerraPulse busca demostrar que los datos obtenidos desde el espacio pueden convertirse en herramientas útiles para agricultores, brigadas forestales, científicos, autoridades y ciudadanos.

**TerraPulse: comprender los cambios de nuestro planeta para actuar mejor en la Tierra.**



## Cómo correrlo (web + API en este equipo)

```bash
npm install          # una vez
npm run dev          # levanta la API (FastAPI, 127.0.0.1:8000) y la web (Vite)
```

Abre la dirección que muestra la terminal (normalmente http://localhost:5173).

- La web llama a `/api/...` y Vite la reenvía a la API local (ver `vite.config.js`).
- `npm run dev` usa el Python de `backend/.venv`; si no existe, el de `../backend-observatorio/.venv`.
- Si no hay ninguno con las dependencias: `npm run setup` (crea `backend/.venv` e instala `backend/requirements.txt`).
- La primera vez copia `.env` y `.events_cache.json` desde `../backend-observatorio` si faltan en `backend/`.

## Estructura

- `backend/` API FastAPI: eventos (GDACS, NASA FIRMS, EONET, ITS_LIVE), escenas SAR (ASF), máquina del tiempo (NASA GIBS) y proyección de riesgo.
- `src/` interfaz (CesiumJS): eventos en vivo, módulos, análisis por pestañas, PULSE (voz), reportes PDF.
"# TerraPulse" 
