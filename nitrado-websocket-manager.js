// nitrado-websocket-manager.js - Manager usando nitrado-websocket para acceso real a consola
const WebSocket = require("ws");
const axios = require("axios");
const EventEmitter = require('events');

class NitradoWebSocketManager extends EventEmitter {
  constructor(config) {
    super();
    this.gameServerId = config.serverId;
    this.token = config.accessToken;
    this.ws = null;
    this.isConnected = false;
    this.queue = [];
    this.directMode = false;
    this.gameServerData = null;
    this.authToken = null;
    this.debug = config.debug || false;
  }

  log(message, ...args) {
    if (this.debug) {
      console.log(`[NitradoWS] ${message}`, ...args);
    }
  }

  async requestNitradoAPI(oUrl) {
    const url = oUrl || `https://api.nitrado.net/services/${this.gameServerId}/gameservers`;
    
    try {
      const response = await axios.get(url, {
        headers: {
          "Authorization": `Bearer ${this.token}`
        }
      });
      
      return response.data;
    } catch (error) {
      throw new Error(`API Error: ${error.message}`);
    }
  }

  async init() {
    try {
      this.log('🚀 Inicializando conexión WebSocket...');
      
      // Obtener datos del gameserver
      this.log('📊 Obteniendo datos del servidor...');
      this.gameServerData = await this.requestNitradoAPI();
      
      if (this.gameServerData.status !== "success") {
        throw new Error(`API Error: ${JSON.stringify(this.gameServerData)}`);
      }

      this.log('✅ Datos del servidor obtenidos:', this.gameServerData.data.gameserver.game_human);

      // Obtener token de autenticación
      this.log('🔑 Obteniendo token de autenticación...');
      const tokenData = await this.requestNitradoAPI(`https://api.nitrado.net/services/${this.gameServerId}/webinterface_login`);
      
      const url = new URL(tokenData.data.url);
      this.authToken = url.searchParams.get('access_token');
      
      if (!this.authToken) {
        throw new Error('No se pudo obtener el token de autenticación WebSocket');
      }

      this.log('✅ Token de autenticación obtenido');

      // Construir URL del WebSocket
      const wsUrl = `wss://${this.gameServerData.data.gameserver.hostsystems.linux.servername}.gamedata.io:34882/docker?token=${this.authToken}&backbuffer=200&service=${this.gameServerId}`;
      
      this.log('🌐 Conectando a WebSocket:', wsUrl.replace(this.authToken, '***'));

      // Crear conexión WebSocket
      this.ws = new WebSocket(wsUrl);

      return new Promise((resolve, reject) => {
        this.ws.on('open', () => {
          this.isConnected = true;
          this.log('✅ Conexión WebSocket establecida');
          this.emit('connected');
          
          // Activar modo directo después de 3 segundos
          setTimeout(() => {
            this.processQueue();
            this.directMode = true;
            this.log('🔄 Modo directo activado');
          }, 3000);
          
          resolve(true);
        });

        this.ws.on('message', (data) => {
          this.handleMessage(data);
        });

        this.ws.on('error', (error) => {
          this.log('❌ Error WebSocket:', error.message);
          this.emit('error', error);
          reject(error);
        });

        this.ws.on('close', () => {
          this.isConnected = false;
          this.log('🔌 Conexión WebSocket cerrada');
          this.emit('disconnected');
        });
      });

    } catch (error) {
      this.log('❌ Error inicializando:', error.message);
      throw error;
    }
  }

  handleMessage(data) {
    try {
      const json = JSON.parse(data);
      
      if (json.type === "stdout" && !this.directMode) {
        // Modo cola - almacenar mensajes
        this.queue.push(json);
      } else {
        // Modo directo - emitir inmediatamente
        this.log('📨 Mensaje recibido:', json.msg);
        this.emit('message', json);
        
        // Emitir eventos específicos basados en el contenido
        if (json.msg) {
          this.parseAndEmitEvents(json.msg);
        }
      }
    } catch (error) {
      this.log('❌ Error parseando mensaje:', error.message);
    }
  }

  parseAndEmitEvents(message) {
    // Parsear mensajes específicos de Rust Console
    if (message.includes('joined')) {
      const match = message.match(/(.+) joined/);
      if (match) {
        this.emit('playerJoined', { player: match[1], message });
      }
    } else if (message.includes('left')) {
      const match = message.match(/(.+) left/);
      if (match) {
        this.emit('playerLeft', { player: match[1], message });
      }
    } else if (message.includes('was killed')) {
      this.emit('playerKilled', { message });
    } else if (message.includes('[CHAT]')) {
      const match = message.match(/\[CHAT\]\s*(.+?):\s*(.+)/);
      if (match) {
        this.emit('chat', { player: match[1], message: match[2], full: message });
      }
    }
    
    // Emitir evento genérico de log
    this.emit('log', message);
  }

  processQueue() {
    // Procesar cola de mensajes acumulados
    this.queue = this.queue.sort((a, b) => a.timestamp - b.timestamp);
    
    this.log(`📋 Procesando ${this.queue.length} mensajes en cola...`);
    
    for (let i = 0; i < this.queue.length; i++) {
      if (this.queue[i] !== undefined) {
        this.log('📜 [QUEUE]', this.queue[i].msg);
        this.emit('queueMessage', this.queue[i]);
        delete this.queue[i];
      }
    }
    
    this.queue = [];
    this.log('✅ Cola de mensajes procesada');
  }

  sendCommand(command) {
    if (!this.isConnected || !this.ws) {
      throw new Error('WebSocket no está conectado');
    }

    const containerName = `${this.gameServerData.data.gameserver.username}-game`;
    const commandData = {
      command: command,
      container: containerName
    };

    this.log('⚡ Enviando comando:', command);
    this.ws.send(JSON.stringify(commandData));
    
    this.emit('commandSent', { command, container: containerName });
    
    return true;
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.log('🔌 Desconectado del WebSocket');
  }

  getStatus() {
    return {
      connected: this.isConnected,
      directMode: this.directMode,
      queueSize: this.queue.length,
      gameServer: this.gameServerData ? {
        game: this.gameServerData.data.gameserver.game_human,
        status: this.gameServerData.data.gameserver.status,
        username: this.gameServerData.data.gameserver.username
      } : null
    };
  }
}

// ==================== EJEMPLO DE USO ====================

class NitradoWebSocketBot {
  constructor(config) {
    this.nitrado = new NitradoWebSocketManager(config);
    this.players = new Set();
    this.lastMessages = [];
    this.maxMessages = 50;
  }

  async init() {
    // Configurar event listeners
    this.nitrado.on('connected', () => {
      console.log('🤖 Bot conectado al WebSocket de Nitrado');
    });

    this.nitrado.on('message', (data) => {
      this.addMessage(data.msg);
    });

    this.nitrado.on('queueMessage', (data) => {
      this.addMessage(`[QUEUE] ${data.msg}`);
    });

    this.nitrado.on('playerJoined', (data) => {
      this.players.add(data.player);
      console.log(`👋 Jugador conectado: ${data.player} (Total: ${this.players.size})`);
    });

    this.nitrado.on('playerLeft', (data) => {
      this.players.delete(data.player);
      console.log(`👋 Jugador desconectado: ${data.player} (Total: ${this.players.size})`);
    });

    this.nitrado.on('chat', (data) => {
      console.log(`💬 [CHAT] ${data.player}: ${data.message}`);
    });

    this.nitrado.on('playerKilled', (data) => {
      console.log(`💀 Death: ${data.message}`);
    });

    this.nitrado.on('error', (error) => {
      console.error('❌ Error del WebSocket:', error.message);
    });

    this.nitrado.on('disconnected', () => {
      console.log('🔌 WebSocket desconectado');
    });

    // Inicializar conexión
    await this.nitrado.init();
  }

  addMessage(message) {
    this.lastMessages.push({
      message,
      timestamp: new Date().toISOString()
    });

    // Mantener solo los últimos N mensajes
    if (this.lastMessages.length > this.maxMessages) {
      this.lastMessages.shift();
    }
  }

  sendCommand(command) {
    try {
      this.nitrado.sendCommand(command);
      return { success: true, message: `Comando enviado: ${command}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getRecentLogs(count = 10) {
    return this.lastMessages.slice(-count);
  }

  getPlayerCount() {
    return this.players.size;
  }

  getPlayerList() {
    return Array.from(this.players);
  }

  getStatus() {
    return {
      websocket: this.nitrado.getStatus(),
      bot: {
        players: this.players.size,
        recentMessages: this.lastMessages.length,
        playerList: Array.from(this.players)
      }
    };
  }
}

// ==================== INTEGRACIÓN DISCORD ====================

class NitradoWebSocketDiscord {
  constructor(nitradoConfig, discordConfig) {
    this.bot = new NitradoWebSocketBot(nitradoConfig);
    this.discordConfig = discordConfig;
    this.logChannel = null;
  }

  async init() {
    await this.bot.init();
    
    // Configurar eventos para Discord
    this.bot.nitrado.on('playerJoined', (data) => {
      this.sendDiscordMessage(`🟢 **${data.player}** se conectó al servidor`);
    });

    this.bot.nitrado.on('playerLeft', (data) => {
      this.sendDiscordMessage(`🔴 **${data.player}** se desconectó del servidor`);
    });

    this.bot.nitrado.on('chat', (data) => {
      this.sendDiscordMessage(`💬 **${data.player}**: ${data.message}`);
    });
  }

  async sendDiscordMessage(message) {
    // Aquí iría la lógica para enviar a Discord
    console.log(`[DISCORD] ${message}`);
  }

  async handleCommand(command, args) {
    switch (command) {
      case 'status':
        const status = this.bot.getStatus();
        return {
          embed: {
            title: '📊 Estado del WebSocket',
            fields: [
              { name: 'Conectado', value: status.websocket.connected ? '✅' : '❌', inline: true },
              { name: 'Jugadores', value: status.bot.players.toString(), inline: true },
              { name: 'Mensajes', value: status.bot.recentMessages.toString(), inline: true }
            ],
            color: status.websocket.connected ? 0x00ff00 : 0xff0000
          }
        };

      case 'players':
        const players = this.bot.getPlayerList();
        return {
          embed: {
            title: '👥 Jugadores Conectados',
            description: players.length > 0 ? players.join('\n') : 'No hay jugadores conectados',
            color: 0x0099ff
          }
        };

      case 'logs':
        const logs = this.bot.getRecentLogs(10);
        return {
          embed: {
            title: '📋 Logs Recientes',
            description: logs.map(log => `${log.timestamp.substring(11, 19)}: ${log.message}`).join('\n').substring(0, 2000),
            color: 0xffff00
          }
        };

      case 'say':
        const message = args.join(' ');
        const result = this.bot.sendCommand(`say ${message}`);
        return {
          content: result.success ? `✅ Mensaje enviado: "${message}"` : `❌ Error: ${result.error}`
        };

      default:
        return { content: 'Comando no reconocido. Usa: status, players, logs, say <mensaje>' };
    }
  }
}

module.exports = { 
  NitradoWebSocketManager, 
  NitradoWebSocketBot, 
  NitradoWebSocketDiscord 
};
