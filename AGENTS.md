# AGENTS.md — Mary_uwu

## Stack

- Node.js 20+ con JavaScript ES Modules (`"type": "module"`).
- WhatsApp Web mediante `@whiskeysockets/baileys`.
- Vitest y cobertura V8; ESLint 9.
- `sharp`, `fluent-ffmpeg`/FFmpeg y `pdf-lib` para conversión; `youtube-dl-exec` para descargas; OpenAI SDK opcional para IA.
- Configuración local en `.env`; no exponer secretos ni credenciales de `auth_info/`.

## Estructura

- `src/index.js`: arranque, conexión y ciclo de vida del bot.
- `src/config.js`: configuración de entorno y rutas.
- `src/handler.js`: carga/registro de comandos y despacho de mensajes.
- `src/commands/`: comandos agrupados por `ai/`, `convert/`, `downloader/`, `owner/` y `tools/`.
- `src/engines/`: selección y descarga desde servicios compatibles.
- `src/converters/`: transformaciones de imágenes, stickers, PDF y video.
- `src/lib/`: Baileys, cliente de IA, persistencia y utilidades comunes.
- `src/plugins/`: comandos adicionales cargados dinámicamente (puede estar vacío).
- `tests/`: pruebas `*.test.js`, configuración común y fixtures HTML locales.

## Reglas de código

- Mantener ES Modules, indentación de dos espacios, comillas simples y estilo sin punto y coma, de acuerdo con los archivos existentes.
- Documentar con JSDoc toda función pública/exportada: propósito, parámetros, retorno y errores relevantes. Documentar también los handlers de comandos.
- Mantener comandos pequeños y delegar lógica de negocio a `engines/`, `converters/` o `lib/` según corresponda.
- Toda llamada de red de la aplicación debe ser controlable/maleable en pruebas. En tests, mockear `fetch` con rutas/respuestas deterministas o datos de `tests/fixtures/`; el `fetch` global del setup falla por defecto para impedir red real. Mockear también proveedores externos y procesos como Baileys, OpenAI, yt-dlp y ffmpeg cuando aplique.
- No añadir secretos, números reales, credenciales de WhatsApp, descargas ni datos de runtime al repositorio. Limpiar archivos temporales en rutas exitosas y de error.
- Conservar mensajes de usuario en español y validar entradas antes de iniciar operaciones costosas o externas.
- `eval` es una capacidad privilegiada existente, exclusiva del owner; no ampliarla ni exponerla a usuarios normales.

## Comandos de desarrollo y validación

Desde la raíz del proyecto:

- `npm start`: iniciar el bot.
- `npm run dev`: modo desarrollo con reinicio al modificar archivos.
- `npm test`: ejecutar la suite completa una vez.
- `npm run test:watch`: Vitest interactivo.
- `npm run test:coverage`: suite con cobertura V8. Vitest aplica umbrales de 70% en líneas, funciones y sentencias, y 60% en ramas para los archivos de `commands/`, `converters/` y `engines/`.
- `npm run lint`: ejecutar ESLint sobre el repositorio.

Antes de entregar cambios, ejecutar los tests relacionados, la suite completa y lint. No desactivar el guard de red para hacer pasar pruebas: añade mocks/fixtures explícitos.
