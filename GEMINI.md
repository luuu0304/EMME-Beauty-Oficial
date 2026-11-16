# Contexto y Reglas del Proyecto EMME-MVP

## Arquitectura y Producción
- **Dominio en producción**: https://emme-beauty.com.ar
- **Infraestructura**: VPS Ubuntu con Docker, Nginx (reverse proxy) y Cloudflare.
- **Contenedores principales**:
  - `servidor_sql`: Base de datos Azure SQL Edge.
  - `emme_backend`: Backend en Node.js + Express + `whatsapp-web.js`.

## Reglas Obligatorias al Editar Código

1. **Rutas relativas en el Frontend**:
   - Nunca usar URLs absolutas con `localhost` en el frontend (`frontend/app.js`, `frontend/tarjeta.html`, etc.).
   - Usar siempre rutas relativas como `/api/...` (con la única excepción del fallback condicional ya configurado en `API_BASE` de `frontend/tarjeta.html` para Live Server local).

2. **Zona Horaria (`America/Argentina/Salta`)**:
   - El servidor corre con `TZ=America/Argentina/Salta` (UTC-3).
   - No agregar conversiones manuales de `-3` horas a fechas u horas.

3. **Configuración de Docker Compose**:
   - No modificar `docker-compose.yml` pensando en producción.
   - En el VPS de producción se utiliza un archivo separado: `docker-compose.prod.yml`.

4. **Avisos de Despliegue al Finalizar Cambios**:
   - Al final de cada cambio realizado en el proyecto, indicar explícitamente los pasos necesarios en el VPS:
     - **Cambios solo en `frontend/`**: Indicar que solo requiere ejecutar `git pull` en el VPS.
     - **Cambios en `backend/`**: Indicar que requiere `git pull` y reconstruir el contenedor con `docker compose -f docker-compose.prod.yml up -d --build`.
     - **Cambios en la base de datos**: Si se modificó la estructura de alguna tabla, entregar siempre el script SQL (`ALTER TABLE ...`, `CREATE TABLE ...`, etc.) listo para ejecutar en producción.
