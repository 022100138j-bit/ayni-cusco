# Verificación de la entrega

Comprobado el 29 de octubre de 2026 en Windows con Node.js 24.

- Instalación de dependencias completada. Se evitó el uso de workspaces para que la instalación no necesite privilegios para crear enlaces de Windows.
- `npm run build`: compilación de React completada correctamente.
- `npm test`: 4 pruebas de integración aprobadas con una instancia temporal real de MongoDB. Cubren carga de datos, consultas, CSRF, autenticación, propiedad de eventos, coordenadas, favoritos por visitante, comentarios, recuperación de contraseña y protección de campos privilegiados.
- Recorrido automatizado en Chrome: inicio con datos reales, guardar favorito, iniciar sesión, publicar con foto, editar, verificar la hora de Perú, abrir ficha, publicar comentario y navegar desde el menú móvil. Sin errores de JavaScript.
- Revisión visual de la portada a 1440 px y a 390 px; sin desbordamiento horizontal en la vista móvil comprobada.

## Configuración pendiente del propietario

No se proporcionó una clave de Google Cloud. Se verificó el mensaje cuando falta la clave y la persistencia de coordenadas en la API. El mapa y el autocompletado deben comprobarse con tu clave, APIs habilitadas y facturación configurada, siguiendo el README. No se probaron con una cuenta real de Google.

No se proporcionó un servidor SMTP ni MongoDB Atlas. La recuperación se comprobó usando el enlace de desarrollo y MongoDB temporal; configura y verifica tus credenciales para producción.

El entorno aislado de esta sesión impedía a MongoDB renombrar archivos dentro de su temporal predeterminado. Para ejecutar las pruebas aquí se usó un directorio temporal de base de datos dentro de `work/`, mediante `TEST_DB_ROOT`. No fue necesario alterar el código de almacenamiento de la aplicación.
