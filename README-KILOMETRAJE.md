# Portal de kilometraje OA Import

Este proyecto es una version demo/local del portal de control de kilometraje para choferes y supervisores.

## Archivos principales

- `index.html`: acceso al portal
- `supervisor.html`: panel de asignacion, monitoreo y historial
- `chofer.html`: vista basica del chofer con solo sus rutas asignadas
- `route.html`: visor web del recorrido guardado por viaje
- `mileage.css`: estilo visual
- `mileage-app.js`: logica local con `localStorage`, geolocalizacion del navegador y exportacion de rutas
- `route-viewer.js`: lector de rutas para mostrar recorrido, puntos y kilometraje
- `mileage-config.js`: configuracion local de URLs y Google Maps
- `mileage-config.example.js`: ejemplo de configuracion para despliegue
- `estructura-hoja-calculo.md`: propuesta de como caeran luego los datos en una hoja de calculo
- `GOOGLE APPS SCRIPT/`: scaffold para sincronizar viajes terminados con Google Sheets

## Accesos demo

- Supervisor: `supervisor.oa / Supervisor2026!`
- Chofer 1: `chofer.raul / Chofer2026!`
- Chofer 2: `chofer.miguel / Chofer2026!`

## Lo que ya hace

- Asigna viajes a choferes
- Muestra viajes pendientes
- Permite iniciar y finalizar viajes
- Usa geolocalizacion del navegador para guardar el recorrido mientras el viaje esta activo
- Calcula kilometraje acumulado
- Permite descargar una ruta en formato `GeoJSON`
- Genera un enlace `Ver ruta` por cada viaje con trazado disponible
- Puede quedar listo para sincronizar viajes terminados a Google Sheets mediante Apps Script
- Puede validar usuarios desde la hoja `USUARIOS` en Google Sheets
- Sincroniza avances de viaje y puntos GPS hacia Google Sheets cuando `appsScriptUrl` esta configurado
- Genera una exportacion demo en `CSV` para simular la futura hoja de calculo

## Lo que queda para enlazar despues

- Autenticacion real
- Escritura directa en Google Sheets
- Carga definitiva de URL de Apps Script y API key de Google Maps
- Persistencia de tracking en segundo plano mas alla del navegador

## Nota importante del tracking

Mientras no se conecte a servicios externos, el seguimiento en tiempo real depende de que el navegador del chofer siga abierto y con permisos de ubicacion activos.

## Configuracion minima para la ruta

En `mileage-config.js` vas a completar despues:

- `appsScriptUrl`: URL de la Web App de Google Apps Script
- `routeViewerBaseUrl`: URL publica de `route.html`
- `googleMapsApiKey`: API key para dibujar la ruta en Google Maps

## Hoja de usuarios

El login remoto puede tomar usuarios desde la hoja `USUARIOS` con estas columnas:

- `Nombre`
- `Usuario`
- `Contrasena`
- `Tipo Usuario`
