# Ayni Cusco — React + Node.js + MongoDB

Migración del proyecto PHP/MySQL proporcionado. Esta versión se ejecuta sin PHP ni MySQL.

## Inicio en Windows

Requisitos: Node.js **22.12 o posterior** (recomendado 24 LTS) y MongoDB local o MongoDB Atlas. Para descargar dependencias, imágenes externas y mapas necesitas internet.

1. Extrae el ZIP y abre una terminal en la carpeta `ayni-cusco-node`.
2. Inicia MongoDB. Si usas Docker Desktop: `docker compose up -d`. Si usas Atlas, copia tu cadena de conexión a `server/.env`.
3. Ejecuta `powershell -File .\INICIAR.ps1`. El script crea los `.env` si faltan, genera un secreto de sesión aleatorio, instala dependencias, carga datos de ejemplo e inicia ambos servicios.
4. Abre **http://localhost:5173**. Servidor API: **http://localhost:3001/api/categories**.

Si PowerShell impide ejecutar el archivo, usa los comandos manuales siguientes. No necesitas cambiar la política del sistema.

### Instalación manual

```powershell
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
npm.cmd install
```

Edita `server/.env`: configura `MONGODB_URI` y reemplaza `SESSION_SECRET` por un secreto aleatorio de al menos 32 caracteres. Puedes generar uno con:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
npm.cmd run seed
npm.cmd run dev
```

No compartas el secreto de sesión ni la URI de Atlas. Si tu contraseña de Atlas contiene caracteres especiales, usa su codificación URL.

## Google Maps: ubicación de eventos

1. Crea o selecciona un proyecto en Google Cloud Console y configura su facturación.
2. Habilita **Maps JavaScript API** y **Places API (New)**.
3. Crea una clave y limita sus APIs a esas dos. En restricciones de sitios web añade `http://localhost:5173/*` y, si lo usas, `http://127.0.0.1:5173/*`. Añade tu dominio HTTPS al desplegar.
4. En `client/.env` configura:

```dotenv
VITE_GOOGLE_MAPS_API_KEY=tu_clave
VITE_GOOGLE_MAP_ID=DEMO_MAP_ID
```

5. Reinicia `npm run dev` tras modificar el `.env`. Para producción utiliza tu propio Map ID.

Al publicar o editar puedes buscar lugares en Perú mediante el autocompletado de Google, seleccionar un resultado, tocar el mapa o arrastrar el marcador. Se guardan la dirección, latitud, longitud y Place ID en MongoDB. La ficha muestra el mapa y un enlace para obtener indicaciones. No se inventan coordenadas para los eventos originales: hasta que selecciones su punto exacto, el mapa muestra Cusco como referencia y el enlace usa la dirección escrita.

La clave del navegador es visible en el cliente: protege su uso con las restricciones de Google Cloud. Sin clave puedes usar el resto de la aplicación y abrir indicaciones mediante un enlace de Google Maps, pero no se activa el mapa interactivo ni el autocompletado. No necesitas habilitar Geolocation API: esta integración ubica los eventos y no solicita la ubicación del dispositivo.

Documentación utilizada: https://developers.google.com/maps/documentation/javascript/place-autocomplete-new

## Funciones migradas

- Inicio, catálogo con búsqueda, 14 categorías y subcategorías, filtro de entrada libre.
- 42 eventos/servicios/tradiciones de ejemplo, galerías de imágenes y fichas de detalle.
- Registro, inicio y cierre de sesión de organizadores; sesiones persistidas en MongoDB.
- Publicar, editar y eliminar eventos propios; subir fotos JPG, PNG o WEBP de hasta 5 MB o usar URLs HTTPS.
- Panel con visitas y clics de WhatsApp; contacto y compartir enlace.
- Perfil público del organizador y edición del perfil y redes.
- Favoritos por visitante del navegador y comentarios con limitación de frecuencia.
- Recuperación de contraseña mediante token de un solo uso de una hora. En desarrollo sin SMTP aparece un enlace de demostración; en producción debes configurar SMTP.
- Páginas de presentación e historia del Cusco.
- Temperatura actual de Open-Meteo cuando hay coordenadas; se identifica como referencia de hoy, no como pronóstico para la fecha del evento.

Se conserva la identidad visual oscura y dorada, las fotos y el contenido de muestra. Las páginas se reconstruyeron como componentes React adaptables a móvil; los estilos originales se incluyen en `client/public/assets` como referencia, sin ejecutar su antiguo JavaScript.

## Datos de ejemplo y migración

`server/seed-data.json` contiene los datos exportados del SQL original. `npm run seed` crea registros faltantes sin borrar los existentes ni restablecer contraseñas. Relaciona documentos mediante ObjectId y conserva los IDs antiguos como `legacyId`. No hace falta importar SQL.

Cuenta demo: **demo@aynicusco.pe**, contraseña **Ayni2026!**. También: `imperiales@aynicusco.pe`, `celebra@aynicusco.pe` y `cultura@aynicusco.pe`, con la misma contraseña. Son cuentas públicas de demostración: cambia sus contraseñas o retíralas antes de publicar.

No se importan sesiones PHP, favoritos de cookies antiguas ni enlaces de recuperación anteriores. La base proporcionada contiene datos de ejemplo, no una conexión a tu base MySQL en funcionamiento.

## Estructura

```text
client/src/main.jsx           Rutas y pantallas React
client/src/GoogleLocation.jsx Google Maps y Places
client/src/api.js             Cliente HTTP y CSRF
client/src/style.css          Diseño adaptable
server/app.js                API Express y controles de acceso
server/models.js             Modelos Mongoose
server/validation.js         Validación de entradas
server/seed.js               Carga no destructiva de ejemplos
server/seed-data.json         Datos originales convertidos
server/uploads/              Imágenes subidas (persistir en despliegue)
server/app.test.js           Pruebas de integración con MongoDB temporal
```

Los endpoints principales son `/api/session`, `/api/register`, `/api/login`, `/api/logout`, `/api/recover`, `/api/reset`, `/api/categories`, `/api/events`, `/api/mine`, `/api/profile`, `/api/organizers/:id`, `/api/favorites` y `/api/uploads`. Las peticiones de escritura requieren el encabezado `X-CSRF-Token` obtenido de `/api/session`; el frontend lo maneja automáticamente.

## Compilar y comprobar

```powershell
npm.cmd test
npm.cmd run build
npm.cmd start
```

Las pruebas descargan un MongoDB temporal la primera vez; no usan ni borran tu MongoDB configurado. Después de compilar, Express sirve React y la API en el puerto 3001. Para ese modo local cambia `APP_ORIGIN=http://localhost:3001` en `server/.env` y añade ese origen a la clave de Google.

## Despliegue

Configura `NODE_ENV=production`, un `SESSION_SECRET` propio, `MONGODB_URI`, `APP_ORIGIN` con tu dominio HTTPS y SMTP. Compila React con sus variables de Google ya configuradas. Sirve la aplicación detrás de HTTPS; si hay exactamente un proxy de confianza delante de Express, configura `TRUST_PROXY=1` para las cookies seguras y el límite de solicitudes. Conserva `server/uploads` en un volumen persistente. Las imágenes eliminadas de eventos no se borran automáticamente del disco para evitar afectar referencias compartidas; su limpieza queda a la administración del almacenamiento.

Las contraseñas se guardan con bcrypt, los campos privilegiados no son editables desde los formularios y el servidor comprueba la propiedad de los eventos. Los favoritos permanecen ligados a una sesión de visitante de siete días; al borrar cookies o cerrar sesión se crea una nueva identidad de visitante.

## Solución de problemas

- `ECONNREFUSED 127.0.0.1:27017`: MongoDB no está iniciado; arranca el servicio, Docker o configura Atlas.
- `Configura MONGODB_URI y SESSION_SECRET`: revisa `server/.env`, no el archivo `.env.example`.
- Pantalla de conexión: inicia ambos servicios con `npm run dev` y revisa la terminal del servidor.
- Google muestra error: revisa clave, facturación, APIs habilitadas y restricciones del sitio; reinicia Vite después de cambiar variables.
- No llega el correo: configura SMTP; el enlace visible sin correo es únicamente para desarrollo.
