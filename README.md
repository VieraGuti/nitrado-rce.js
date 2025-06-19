# 🤖 Discord Bot para Servidores Nitrado (Rust Console Edition)

Este bot de Discord permite a los usuarios conectar su servidor de **Rust Console Edition** alojado en **Nitrado**, mediante **WebSocket** en tiempo real. Captura logs, permite enviar comandos, gestionar usuarios y monitorear eventos del servidor desde Discord.

---

## 🚀 Características

- 🎮 **Conexión WebSocket Real** con servidores Nitrado
- 📡 **Slash Commands** de Discord para control directo
- 👥 **Monitoreo de Jugadores** conectados/desconectados
- 💬 **Captura de Chat y Logs** en tiempo real
- 🛠️ **Envío de comandos al servidor** desde Discord
- 🧠 **Manejo de múltiples servidores** por servidor de Discord (multi-guild)

---

## 📚 Comandos Slash Disponibles

| Comando             | Descripción                                                                 |
|---------------------|-----------------------------------------------------------------------------|
| `/connectserver`    | Conectar a un servidor de Nitrado via URL y Token                           |
| `/disconnect`       | Desconecta del servidor actual                                              |
| `/status`           | Muestra estado del servidor y la conexión WebSocket                         |
| `/players`          | Lista los jugadores conectados actualmente                                 |
| `/say <mensaje>`    | Envía un mensaje al chat del juego desde Discord                           |
| `/logs [cantidad]`  | Muestra los últimos logs del servidor (máx. 20)                            |

---

## ⚙️ Requisitos

- Node.js v16 o superior
- Una cuenta de Discord con aplicación de bot configurada
- Cuenta Nitrado con acceso a API y servidor activo
- Token de acceso (`access_token`) de Nitrado (puede obtenerse vía OAuth2)

---

## 🔐 Variables de Entorno (.env)

Crea un archivo `.env` en la raíz del proyecto con el siguiente contenido:

```env
DISCORD_TOKEN=tu_discord_bot_token
APPLICATION_ID=tu_discord_application_id
NITRADO_CLIENT_ID=tu_nitrado_client_id
NITRADO_CLIENT_SECRET=tu_nitrado_client_secret
DEBUG=true
```

> ✅ Asegúrate de **NO subir tu archivo `.env` al repositorio público**. Agrega `.env` a tu `.gitignore`.

---

## 🧪 Instalación

```bash
git clone https://github.com/VieraGuti/nitrado-rce.js.git
cd nitrado-rce.js
npm install
```

---

## ▶️ Ejecución del Bot

Una vez configurado tu `.env`, inicia el bot con:

```bash
node index.js
```

---

## 🧾 Ejemplo de Uso del Comando `/connectserver`

```bash
/connectserver
URL: https://webinterface.nitrado.net/12345/wi/gameserver
Token: eyJhbGciOiJIUz...
```

El bot extraerá automáticamente el ID del servidor desde la URL y establecerá una conexión WebSocket.

---
/**
 * Basado en el trabajo original de:
 * https://github.com/ExtremTechniker/nitrado-websocket
 * Autor: ExtremTechniker
 * Adaptado para integración con Discord y Rust Console Edition
 */


## 📝 Licencia

Este proyecto está bajo licencia MIT. Ver el archivo `LICENSE` para más detalles.
