---

# 🐱 Mary_uwu

<div align="center">

![Node](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Baileys](https://img.shields.io/badge/Baileys-7.0.0--rc14-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)
![Tests](https://img.shields.io/badge/tests-108%20passed-success?style=for-the-badge)
![Coverage](https://img.shields.io/badge/coverage-94.2%25-brightgreen?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)

**El bot de WhatsApp que descarga, convierte, busca e imagina. Todo en uno. Con cara de gato asustado.**

<video controls muted loop playsinline width="480">
	<source src="assets/quiet-faith.mp4" type="video/mp4">
	Tu navegador no admite vídeo HTML5.
</video>

[Reportar bug](../../issues) · [Pedir feature](../../issues) · [Ver comandos](#-comandos)

</div>

---

## 🤔 ¿Qué es Mary_uwu?

Mary_uwu es un bot de WhatsApp construido sobre **Baileys** que fusiona lo mejor de los bots más populares del ecosistema: descargas universales, conversión de medios, herramientas de búsqueda, comandos de owner e IA conversacional.

**Sin economía. Sin RPG. Sin minijuegos.** Solo lo útil, empaquetado con una personalidad caótica y una cara de gato que lo dice todo. 🐱

### ✨ Lo que hace

- 📥 **Descargas** — YouTube, TikTok, Instagram, Facebook, Spotify, Mediafire
- 🔄 **Conversión** — Sticker, imagen, GIF, PDF
- 🛠️ **Herramientas** — Búsqueda (Google, Wikipedia, YouTube, letras, clima), acortador de URL
- 👑 **Owner** — Broadcast, block, setpp, autoread, prefix, reload, eval
- 🤖 **IA** — Chat conversacional y generación de imágenes (opcional)
- 📦 **Envío como documento** — Sin compresión, hasta 100 MB

---

## 🚀 Instalación rápida

### Requisitos

- **Node.js 20+**
- **FFmpeg** en el PATH (para conversión de audio/video)
- Un **número secundario de WhatsApp** (no uses tu número principal)

### Pasos

```bash
# 1. Clona el repo
git clone https://github.com/tu-usuario/mary_uwu.git
cd mary_uwu

# 2. Instala dependencias
npm install

# 3. Configura el entorno
cp .env.example .env
# Edita .env con tus números

# 4. Arranca el bot
npm start
```

Al arrancar, la terminal mostrará un **código de emparejamiento de 8 dígitos**. En tu teléfono:

> WhatsApp → Ajustes → Dispositivos vinculados → Vincular dispositivo → Conectar con número de teléfono
Ingresa el código y listo. Mary_uwu queda conectada. 🎉

---

## ⚙️ Configuración
Crea un archivo `.env` en la raíz con:

env

```
OWNER_NUMBER=51999999999
PAIRING_NUMBER=51988888888
PREFIX=.
SESSION_NAME=mary_uwu
OPENAI_API_KEY=sk-...   # Opcional, solo si usas .ai y .imagine
```

VariableDescripciónRequerida`OWNER_NUMBER`Tu número personal (con código de país, sin `+`)✅`PAIRING_NUMBER`Número del chip secundario del bot✅`PREFIX`Prefijo de comandos (default `.`)❌`SESSION_NAME`Nombre de la sesión❌`OPENAI_API_KEY`Key de OpenAI para el módulo de IA❌

---

## 📋 Comandos

### 🐱 Básicos

ComandoDescripción`.start`Mensaje de bienvenida`.help`Lista de comandos`.ping`Verifica que el bot esté vivo

### 📥 Descargas

ComandoDescripción`.ytmp3 <url>`Audio de YouTube (MP3)`.ytmp4 <url>`Video de YouTube (MP4)`.spotify <url>`Música de Spotify`.instagram <url>`Posts, reels, IGTV`.facebook <url>`Videos de Facebook`.tiktok <url>`Videos de TikTok`.mediafire <url>`Archivos de Mediafire`.dl <url>`Descargador universal

> 💡 Todos los archivos se envían como **documento** para preservar calidad. Límite: **100 MB**.

### 🔄 Conversión

ComandoDescripción`.sticker`Imagen/video → sticker WebP`.toimg`Sticker → imagen`.togif`Video → GIF`.topdf`Imagen → PDF

### 🛠️ Herramientas

ComandoDescripción`.search <término>`Google, Wikipedia, YouTube, letras, clima`.tiny <url>`Acortar URL`.url <texto>`Codificar/decodificar URL`.weather <ciudad>`Clima actual

### 👑 Owner

ComandoDescripción`.broadcast <msg>`Mensaje a todos los chats`.block <num>`Bloquear/desbloquear usuario`.setpp`Cambiar foto de perfil`.autoread on/off`Auto-lectura`.prefix <nuevo>`Cambiar prefijo`.reload`Recargar comandos sin reiniciar`.eval <código>`Ejecutar JavaScript

### 🤖 IA

ComandoDescripción`.ai <pregunta>`Chat con contexto`.imagine <prompt>`Generar imagen

---

## 🖥️ Despliegue 24/7

### En Termux (Android)
bash

```
pkg update && pkg upgrade
pkg install nodejs git ffmpeg
git clone https://github.com/tu-usuario/mary_uwu.git
cd mary_uwu
npm install
npm start
```

Para mantenerlo vivo en segundo plano:

bash

```
pkg install tmux
tmux new -s mary
npm start
# Ctrl+B, luego D para desconectar de tmux
termux-wake-lock
```

### En VPS con systemd
bash

```
sudo nano /etc/systemd/system/mary_uwu.service
```

ini

```
[Unit]
Description=Mary_uwu WhatsApp Bot
After=network.target

[Service]
Type=simple
User=tu-usuario
WorkingDirectory=/home/tu-usuario/mary_uwu
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

bash

```
sudo systemctl daemon-reload
sudo systemctl enable mary_uwu
sudo systemctl start mary_uwu
sudo systemctl status mary_uwu
```

### En VPS con PM2
bash

```
npm install -g pm2
pm2 start src/index.js --name mary_uwu
pm2 save
pm2 startup
```

---

## 🧪 Desarrollo
bash

```
npm test              # Ejecutar tests
npm run lint          # ESLint
npm run test:coverage # Cobertura
```

**Estado actual:** 108 tests ✅ · 94.2% cobertura · ESLint limpio.

---

## ⚠️ Advertencias

1. **Riesgo de baneo.** Este bot usa **Baileys**, una librería no oficial que viola los Términos de Servicio de WhatsApp. **Usa un número secundario** que no te importe perder.
2. **Sin garantías.** El protocolo de WhatsApp cambia con frecuencia. Baileys puede romperse sin previo aviso.
3. **No es la API oficial.** Si necesitas algo para producción real, usa la WhatsApp Business API de Meta (tiene costo y aprobación).
4. **Tu responsabilidad.** No descargues contenido protegido por derechos de autor sin permiso.

---

## 🐛 Troubleshooting

### Error `code 440` (connectionReplaced)
Otra sesión reemplazó la del bot. Ve a **WhatsApp → Dispositivos vinculados**, cierra las sesiones antiguas y reinicia el bot.

### Error `Bad MAC` o `No matching sessions`
La sesión está corrupta. Detén el bot, **borra la carpeta `auth_info/`** y vuelve a vincular con el código de 8 dígitos.

### Error `failed to find key "AAAAALXs"`
Error de sincronización de historial. **No afecta al funcionamiento.** El bot sigue operativo, solo no verá mensajes antiguos.

### El bot no responde a mis comandos
Verifica que `OWNER_NUMBER` en el `.env` sea exactamente tu número (con código de país, sin `+`).

### FFmpeg no encontrado
Instálalo según tu sistema:

- **Linux:** `sudo apt install ffmpeg`
- **Windows:** descarga desde [ffmpeg.org](https://ffmpeg.org/) y añádelo al PATH
- **Termux:** `pkg install ffmpeg`

---

## 📄 Licencia
MIT © 2026 lenin_uwu. Ver [LICENSE](https://./LICENSE) para más detalles.

---
<div align="center">**Hecho con 🐱 y demasiada cafeína.**

*Mary_uwu no se hace responsable de los números baneados, los grupos inundados de stickers, ni de las descargas que nunca debiste hacer.*

</div>

---
