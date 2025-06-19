// discord-nitrado-bot.js  
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');  
const { NitradoWebSocketManager, NitradoWebSocketBot } = require('./nitrado-websocket-manager');  
  
class DiscordNitradoBot {  
  constructor(config) {  
    this.discordToken = config.discordToken;  
    this.applicationId = config.applicationId;  
    this.nitradoClientId = config.nitradoClientId;  
    this.nitradoClientSecret = config.nitradoClientSecret;  
      
    this.discord = new Client({  
      intents: [  
        GatewayIntentBits.Guilds,  
        GatewayIntentBits.GuildMessages,  
        GatewayIntentBits.MessageContent  
      ]  
    });  
      
    this.connectedServers = new Map(); // Almacenar conexiones activas por guild  
    this.userTokens = new Map(); // Almacenar tokens de usuario (en producción usar base de datos)  
  }  
  
  async init() {  
    // Registrar comandos slash  
    await this.registerSlashCommands();  
      
    // Configurar event handlers  
    this.setupEventHandlers();  
      
    // Conectar a Discord  
    await this.discord.login(this.discordToken);  
    console.log('✅ Bot de Discord conectado');  
  }  
  
  async registerSlashCommands() {  
    const commands = [  
      new SlashCommandBuilder()  
        .setName('connectserver')  
        .setDescription('Conectar a un servidor de Nitrado')  
        .addStringOption(option =>  
          option.setName('url')  
            .setDescription('URL del servidor de Nitrado (ej: https://webinterface.nitrado.net/12345/wi/gameserver)')  
            .setRequired(true))  
        .addStringOption(option =>  
          option.setName('token')  
            .setDescription('Tu token de acceso de Nitrado')  
            .setRequired(true)),  
  
      new SlashCommandBuilder()  
        .setName('disconnect')  
        .setDescription('Desconectar del servidor actual'),  
  
      new SlashCommandBuilder()  
        .setName('status')  
        .setDescription('Ver estado de la conexión del servidor'),  
  
      new SlashCommandBuilder()  
        .setName('players')  
        .setDescription('Ver jugadores conectados'),  
  
      new SlashCommandBuilder()  
        .setName('say')  
        .setDescription('Enviar mensaje al servidor')  
        .addStringOption(option =>  
          option.setName('message')  
            .setDescription('Mensaje a enviar')  
            .setRequired(true)),  
  
      new SlashCommandBuilder()  
        .setName('logs')  
        .setDescription('Ver logs recientes del servidor')  
        .addIntegerOption(option =>  
          option.setName('count')  
            .setDescription('Número de logs a mostrar (máximo 20)')  
            .setMinValue(1)  
            .setMaxValue(20))  
    ];  
  
    const rest = new REST({ version: '10' }).setToken(this.discordToken);  
      
    try {  
      console.log('🔄 Registrando comandos slash...');  
      await rest.put(  
        Routes.applicationCommands(this.applicationId),  
        { body: commands }  
      );  
      console.log('✅ Comandos slash registrados');  
    } catch (error) {  
      console.error('❌ Error registrando comandos:', error);  
    }  
  }  
  
  setupEventHandlers() {  
    this.discord.on('ready', () => {  
      console.log(`🤖 Bot listo como ${this.discord.user.tag}`);  
    });  
  
    this.discord.on('interactionCreate', async (interaction) => {  
      if (!interaction.isChatInputCommand()) return;  
  
      try {  
        await this.handleSlashCommand(interaction);  
      } catch (error) {  
        console.error('❌ Error manejando comando:', error);  
        const errorMessage = 'Ocurrió un error al procesar el comando.';  
          
        if (interaction.replied || interaction.deferred) {  
          await interaction.followUp({ content: errorMessage, ephemeral: true });  
        } else {  
          await interaction.reply({ content: errorMessage, ephemeral: true });  
        }  
      }  
    });  
  }  
  
  async handleSlashCommand(interaction) {  
    const { commandName, guildId } = interaction;  
  
    switch (commandName) {  
      case 'connectserver':  
        await this.handleConnectServer(interaction);  
        break;  
  
      case 'disconnect':  
        await this.handleDisconnect(interaction);  
        break;  
  
      case 'status':  
        await this.handleStatus(interaction);  
        break;  
  
      case 'players':  
        await this.handlePlayers(interaction);  
        break;  
  
      case 'say':  
        await this.handleSay(interaction);  
        break;  
  
      case 'logs':  
        await this.handleLogs(interaction);  
        break;  
  
      default:  
        await interaction.reply({ content: 'Comando no reconocido.', ephemeral: true });  
    }  
  }  
  
  async handleConnectServer(interaction) {  
    const url = interaction.options.getString('url');  
    const token = interaction.options.getString('token');  
    const guildId = interaction.guildId;  
  
    await interaction.deferReply();  
  
    try {  
      // Extraer server ID de la URL  
      const serverId = this.extractServerIdFromUrl(url);  
      if (!serverId) {  
        await interaction.editReply('❌ URL inválida. Formato esperado: https://webinterface.nitrado.net/12345/wi/gameserver');  
        return;  
      }  
  
      // Desconectar servidor anterior si existe  
      if (this.connectedServers.has(guildId)) {  
        this.connectedServers.get(guildId).disconnect();  
        this.connectedServers.delete(guildId);  
      }  
  
      // Crear nueva conexión  
      const nitradoBot = new NitradoWebSocketBot({  
        serverId: serverId,  
        accessToken: token,  
        debug: true  
      });  
  
      // Configurar eventos para Discord  
      this.setupNitradoEvents(nitradoBot, interaction.channel);  
  
      // Conectar  
      await nitradoBot.init();  
        
      // Guardar conexión  
      this.connectedServers.set(guildId, nitradoBot);  
  
      await interaction.editReply(`✅ Conectado exitosamente al servidor ${serverId}`);  
  
    } catch (error) {  
      console.error('Error conectando:', error);  
      await interaction.editReply(`❌ Error conectando al servidor: ${error.message}`);  
    }  
  }  
  
  async handleDisconnect(interaction) {  
    const guildId = interaction.guildId;  
      
    if (!this.connectedServers.has(guildId)) {  
      await interaction.reply({ content: '❌ No hay servidor conectado.', ephemeral: true });  
      return;  
    }  
  
    this.connectedServers.get(guildId).disconnect();  
    this.connectedServers.delete(guildId);  
  
    await interaction.reply('✅ Desconectado del servidor.');  
  }  
  
  async handleStatus(interaction) {  
    const guildId = interaction.guildId;  
      
    if (!this.connectedServers.has(guildId)) {  
      await interaction.reply({ content: '❌ No hay servidor conectado.', ephemeral: true });  
      return;  
    }  
  
    const bot = this.connectedServers.get(guildId);  
    const status = bot.getStatus();  
  
    const embed = {  
      title: '📊 Estado del Servidor',  
      fields: [  
        { name: 'Conectado', value: status.websocket.connected ? '✅' : '❌', inline: true },  
        { name: 'Modo Directo', value: status.websocket.directMode ? '✅' : '❌', inline: true },  
        { name: 'Jugadores', value: status.bot.players.toString(), inline: true },  
        { name: 'Juego', value: status.websocket.gameServer?.game || 'N/A', inline: true },  
        { name: 'Estado', value: status.websocket.gameServer?.status || 'N/A', inline: true },  
        { name: 'Mensajes', value: status.bot.recentMessages.toString(), inline: true }  
      ],  
      color: status.websocket.connected ? 0x00ff00 : 0xff0000,  
      timestamp: new Date().toISOString()  
    };  
  
    await interaction.reply({ embeds: [embed] });  
  }  
  
  async handlePlayers(interaction) {  
    const guildId = interaction.guildId;  
      
    if (!this.connectedServers.has(guildId)) {  
      await interaction.reply({ content: '❌ No hay servidor conectado.', ephemeral: true });  
      return;  
    }  
  
    const bot = this.connectedServers.get(guildId);  
    const players = bot.getPlayerList();  
  
    const embed = {  
      title: '👥 Jugadores Conectados',  
      description: players.length > 0 ? players.join('\n') : 'No hay jugadores conectados',  
      color: 0x0099ff,  
      footer: { text: `Total: ${players.length} jugadores` }  
    };  
  
    await interaction.reply({ embeds: [embed] });  
  }  
  
  async handleSay(interaction) {  
    const guildId = interaction.guildId;  
    const message = interaction.options.getString('message');  
      
    if (!this.connectedServers.has(guildId)) {  
      await interaction.reply({ content: '❌ No hay servidor conectado.', ephemeral: true });  
      return;  
    }  
  
    const bot = this.connectedServers.get(guildId);  
    const result = bot.sendCommand(`say ${message}`);  
  
    if (result.success) {  
      await interaction.reply(`✅ Mensaje enviado: "${message}"`);  
    } else {  
      await interaction.reply(`❌ Error enviando mensaje: ${result.error}`);  
    }  
  }  
  
  async handleLogs(interaction) {  
    const guildId = interaction.guildId;  
    const count = interaction.options.getInteger('count') || 10;  
      
    if (!this.connectedServers.has(guildId)) {  
      await interaction.reply({ content: '❌ No hay servidor conectado.', ephemeral: true });  
      return;  
    }  
  
    const bot = this.connectedServers.get(guildId);  
    const logs = bot.getRecentLogs(count);  
  
    if (logs.length === 0) {  
      await interaction.reply('📋 No hay logs disponibles.');  
      return;  
    }  
  
    const logText = logs  
      .map(log => `${log.timestamp.substring(11, 19)}: ${log.message}`)  
      .join('\n')  
      .substring(0, 2000);  
  
    const embed = {  
      title: '📋 Logs Recientes',  
      description: `\`\`\`${logText}\`\`\``,  
      color: 0xffff00,  
      footer: { text: `Mostrando ${logs.length} logs` }  
    };  
  
    await interaction.reply({ embeds: [embed] });  
  }  
  
  setupNitradoEvents(nitradoBot, channel) {  
    nitradoBot.nitrado.on('playerJoined', (data) => {  
      channel.send(`🟢 **${data.player}** se conectó al servidor`);  
    });  
  
    nitradoBot.nitrado.on('playerLeft', (data) => {  
      channel.send(`🔴 **${data.player}** se desconectó del servidor`);  
    });  
  
    nitradoBot.nitrado.on('chat', (data) => {  
      channel.send(`💬 **${data.player}**: ${data.message}`);  
    });  
  
    nitradoBot.nitrado.on('playerKilled', (data) => {  
      channel.send(`💀 ${data.message}`);  
    });  
  
    nitradoBot.nitrado.on('error', (error) => {  
      channel.send(`❌ Error del servidor: ${error.message}`);  
    });  
  
    nitradoBot.nitrado.on('disconnected', () => {  
      channel.send('🔌 Conexión con el servidor perdida');  
    });  
  }  
  
  extractServerIdFromUrl(url) {  
    // Extraer ID del servidor de URLs como: https://webinterface.nitrado.net/12345/wi/gameserver  
    const match = url.match(/nitrado\.net\/(\d+)\/wi/);  
    return match ? match[1] : null;  
  }  
}  
  
// ==================== CONFIGURACIÓN Y INICIO ====================  
  
const config = {  
  discordToken: 'TU_DISCORD_BOT_TOKEN',  
  applicationId: 'TU_APPLICATION_ID',  
  nitradoClientId: 'TU_NITRADO_CLIENT_ID',  
  nitradoClientSecret: 'TU_NITRADO_CLIENT_SECRET'  
};  
  
const bot = new DiscordNitradoBot(config);  
  
bot.init().catch(console.error);  
  
// Manejo de errores globales  
process.on('uncaughtException', (error) => {  
  console.error('❌ Error no capturado:', error);  
});  
  
process.on('unhandledRejection', (reason, promise) => {  
  console.error('❌ Promesa rechazada no manejada:', reason);  
});  
  
module.exports = DiscordNitradoBot;