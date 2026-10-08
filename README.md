# Mary_uwu 🐱

Bot de WhatsApp en español construido con Node.js y Baileys. Incluye comandos de utilidad, conversión de medios, búsqueda y descarga de contenido público, además de funciones opcionales de IA con OpenAI.

> **Aviso:** Baileys automatiza WhatsApp mediante una interfaz no oficial. WhatsApp puede limitar o bloquear la cuenta; consulta la advertencia de la sección [Riesgo de baneo](#riesgo-de-baneo) antes de usarlo.

## Requisitos

- Node.js 20 o posterior y npm.
- FFmpeg disponible en `PATH` para convertir videos a GIF o stickers animados.
- Conexión a Internet para WhatsApp, descargas y servicios de búsqueda/clima.
- Una cuenta/número de WhatsApp para vincular. Se recomienda un número secundario.
- (Opcional) Una clave de API de OpenAI para `.ai` y `.imagine`.

## Instalación

```sh
git clone <URL_DEL_REPOSITORIO> mary_uwu
cd mary_uwu
npm ci
```

Copia `.env.example` como `.env` (en Linux/Termux: `cp .env.example .env`; en PowerShell: `Copy-Item .env.example .env`) y configura como mínimo `OWNER_NUMBER`. No subas `.env`, `auth_info/` ni credenciales a Git. En Linux, instala FFmpeg con el gestor de paquetes de tu distribución (por ejemplo, `sudo apt install ffmpeg`).

## Configuración de `.env`

Los números deben escribirse en formato internacional, solo dígitos y sin `+`, espacios ni guiones.

| Variable | Predeterminado | Descripción |
|---|---|---|
| `OWNER_NUMBER` | vacío | Número autorizado para comandos de owner; por ejemplo, `521234567890`. |
| `PAIRING_NUMBER` | `OWNER_NUMBER` | Número al que WhatsApp enviará el código de vinculación. |
| `PREFIX` | `.` | Prefijo inicial de comandos; el owner puede cambiarlo con `.prefix`. |
| `SESSION_NAME` | `mary_uwu` | Nombre informativo de la sesión. |
| `OPENAI_API_KEY` | vacío | Clave de API necesaria para `.ai` y `.imagine`; se factura según la cuenta de OpenAI. |
| `OPENAI_MODEL` | `gpt-4o-mini` | Modelo de chat. |
| `OPENAI_IMAGE_MODEL` | `dall-e-3` | Modelo de generación de imágenes. |
| `MAX_FILE_SIZE_MB` | `100` | Tamaño máximo permitido para archivos enviados como documento. |
| `AUTH_DIR` | `auth_info/` | Directorio de credenciales de Baileys. |
| `TMP_DIR` | `tmp_downloads/` | Directorio temporal de descargas y conversiones. |
| `MARY_DB_PATH` | `data/database.json` | Archivo de estado local del bot. |
| `GALLERY_DL_PATH` | `gallery-dl` | Ruta opcional al ejecutable para Instagram; si no está disponible, se intenta yt-dlp. |
| `YTDLP_PATH` | vacío | Ruta opcional de un binario yt-dlp del sistema. |
| `LOG_LEVEL` | `info` | Nivel de logs de Pino: `silent`, `warn`, `info`, `debug` o `trace`. |

`OWNER_NUMBER` vacío deshabilita los comandos restringidos al propietario. Si hay propietario configurado, `PAIRING_NUMBER` vacío se resuelve al número de owner. Las variables de rutas son opcionales; sus valores predeterminados se usan si no se configuran.

## Arranque y vinculación de WhatsApp

Modo normal:

```sh
npm start
```

Modo de desarrollo con reinicio al cambiar archivos:

```sh
npm run dev
```

En el primer arranque, el proceso solicita vinculación. Con `PAIRING_NUMBER` (o `OWNER_NUMBER`) configurado, imprime un código de ocho caracteres: en WhatsApp abre **Dispositivos vinculados → Vincular un dispositivo → Vincular con el número de teléfono** e introduce el código. Si no hay número de emparejamiento configurado, se muestra un QR en la terminal para escanearlo. Mantén `auth_info/` en un lugar seguro: guarda la sesión y permite reconectar sin volver a vincular.

Detén el proceso con `Ctrl+C`. Para desvincular o recuperar una sesión cerrada por WhatsApp, detén el bot y elimina `auth_info/`; al arrancar de nuevo tendrás que vincularlo otra vez.

## Ejemplos de uso

El prefijo predeterminado es `.`. `.help` muestra los comandos cargados; `.ping` comprueba que el bot responde.

- **Descargas:** pega una URL compatible en el chat o usa `.ytmp3 <url>`, `.ytmp4 <url>`, `.tiktok <url>`, `.instagram <url>`, `.facebook <url>`, `.spotify <url>` o `.mediafire <url>`. La disponibilidad depende del sitio y del contenido público.
- **Stickers y medios:** envía o cita una imagen/video con `.sticker`; cita un sticker con `.toimg`; cita un video con `.gif`; envía o cita una imagen con `.topdf`.
- **Herramientas:** `.search Node.js`, `.wikipedia JavaScript`, `.ytsearch música`, `.tiny https://example.com`, `.enc texto con espacios`, `.dec texto%20codificado`, `.clima Lima` y `.lyrics Artista - Título`.
- **IA opcional:** `.ai hola` conversa con el modelo y conserva contexto por chat; `.ai reset` borra ese contexto. `.imagine un paisaje de montaña` genera una imagen. Requieren `OPENAI_API_KEY`.
- **Owner:** `.autoread on|off`, `.prefix >`, `.block <número>`, `.unblock <número>`, `.broadcast <mensaje>`, `.setpp` con imagen, `.reload` y `.eval <JavaScript>`. `.eval` ejecuta código con privilegios del proceso: úsalo únicamente como propietario y con extremo cuidado.

Los comandos de propietario se autorizan con `OWNER_NUMBER`; nunca compartas acceso a esa cuenta ni a las credenciales de sesión.

## Despliegue en Termux (Android)

1. Instala Termux desde una fuente mantenida y actualiza paquetes: `pkg update && pkg upgrade`.
2. Instala Node.js, Git y FFmpeg: `pkg install nodejs-lts git ffmpeg` (si `nodejs-lts` no existe en tu repositorio, instala `nodejs`).
3. Clona el repositorio, entra en la carpeta y ejecuta `npm ci`.
4. Crea y completa `.env`, y arranca con `npm start`.
5. Completa el emparejamiento en WhatsApp y conserva `auth_info/` y `.env`. Para una sesión prolongada, evita que Android suspenda Termux (por ejemplo, configura wakelock y optimización de batería según el dispositivo).

El sistema puede detener procesos en segundo plano para ahorrar batería; Termux no ofrece la misma disponibilidad que un servidor.

## Despliegue en VPS

Usa una distribución Linux compatible, instala Node.js 20+, npm y FFmpeg, clona el proyecto y ejecuta `npm ci`. Crea un `.env` con permisos restringidos y vincula WhatsApp desde la consola antes de dejar el servicio ejecutándose. Mantén respaldos protegidos de `auth_info/` y `data/`; no publiques las credenciales.

### Con systemd

Crea una unidad como `/etc/systemd/system/mary-uwu.service` y reemplaza `/opt/mary_uwu` por la ruta real:

```ini
[Unit]
Description=Mary_uwu WhatsApp bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=mary
WorkingDirectory=/opt/mary_uwu
EnvironmentFile=/opt/mary_uwu/.env
ExecStart=/usr/bin/node /opt/mary_uwu/src/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Asegura que el usuario del servicio pueda leer `.env` y escribir en `auth_info/`, `data/` y `tmp_downloads/`. Después recarga systemd, habilita e inicia `mary-uwu.service`, y revisa los registros con `journalctl -u mary-uwu.service -f`:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now mary-uwu.service
sudo journalctl -u mary-uwu.service -f
```

### Con PM2

Instala PM2 globalmente con npm y, desde la carpeta del proyecto, inicia el proceso. Ejecuta `pm2 startup` y sigue la instrucción que imprime para configurar el inicio automático con el usuario adecuado:

```sh
npm install --global pm2
pm2 start src/index.js --name mary-uwu --interpreter node --update-env
pm2 save
pm2 startup
pm2 logs mary-uwu
```

El bot carga `.env` desde la raíz del proyecto. No guardes secretos en scripts versionados; protege los archivos de entorno y de sesión.

## Riesgo de baneo

La automatización de WhatsApp con Baileys no es oficial ni está respaldada por WhatsApp. El uso puede incumplir sus condiciones y ocasionar restricciones o el baneo permanente del número. Utiliza un número secundario bajo tu propia responsabilidad, evita spam, envíos masivos no solicitados y comportamientos automatizados agresivos. No existe una forma de garantizar que la cuenta no será bloqueada.

## Troubleshooting

1. **No aparece el QR o no llega el código de emparejamiento.** Confirma que `OWNER_NUMBER`/`PAIRING_NUMBER` tengan solo dígitos con código de país, revisa la salida completa de la terminal y vuelve a iniciar. Si la sesión previa expiró, elimina `auth_info/` únicamente después de detener el bot y vuelve a vincular.
2. **`loggedOut` o reconexiones repetidas.** Comprueba conexión y hora del sistema. Si WhatsApp cerró la sesión, detén el proceso y vuelve a vincular eliminando la sesión local antigua. No ejecutes dos instancias con el mismo `auth_info/`.
3. **`ffmpeg` no encontrado o falla `.gif`/sticker de video.** Instala FFmpeg y confirma que `ffmpeg -version` funciona desde el mismo usuario que ejecuta Node/PM2/systemd. Reinicia el servicio después de modificar `PATH`.
4. **Descarga no soportada, contenido privado o yt-dlp no produjo archivos.** Asegúrate de que el enlace sea público y válido. Los sitios cambian sus páginas y pueden bloquear solicitudes; actualiza dependencias de forma controlada y revisa que el archivo no supere `MAX_FILE_SIZE_MB`.
5. **La IA responde que falta la clave, da error de cuota o no genera imagen.** Verifica `OPENAI_API_KEY`, reinicia el proceso para recargar `.env` y confirma que la cuenta tenga acceso y saldo/cuota para los modelos configurados. La IA es opcional; el resto del bot puede usarse sin esa clave.

## Tests y lint

```sh
npm test
npm run test:coverage
npm run lint
```

Los tests usan mocks/fixtures y el setup rechaza cualquier llamada global a `fetch` que no haya sido sustituida por un mock.
