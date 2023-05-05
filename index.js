const { Client, Intents } = require('discord.js');
const { Configuration, OpenAIApi } = require('openai');
const fetch = require('node-fetch');
const fs = require('fs');

const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_TYPING,
    Intents.FLAGS.DIRECT_MESSAGES,
    Intents.FLAGS.DIRECT_MESSAGE_TYPING,
  ],
});

const keepAlive = require('./alive.js');
keepAlive();

const RESTRICTED_CHANNELS_FILE = './restricted_channels.json';

// Load restricted channels from file
let restrictedChannels = new Set();
if (fs.existsSync(RESTRICTED_CHANNELS_FILE)) {
  const data = fs.readFileSync(RESTRICTED_CHANNELS_FILE);
  const { restrictedChannels: savedRestrictedChannels } = JSON.parse(data);
  savedRestrictedChannels.forEach(channelId => restrictedChannels.add(channelId));
}

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.application.commands.create({
    name: 'restrict',
    description: 'Restricts Shiori from talking',
  });
  client.application.commands.create({
    name: 'unrestrict',
    description: 'Unrestricts Shiori',
  });
});

const configuration = new Configuration({
  apiKey: process.env.API_KEY,
});
const openai = new OpenAIApi(configuration);

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.content.startsWith('!')) {
    if (message.content === '!restrict') {
      if (!restrictedChannels.has(message.channel.id)) {
        restrictedChannels.add(message.channel.id);
        message.reply('Chat permission denied');
        saveRestrictedChannels();
      } else {
        message.reply('Already restricted.');
      }
    } else if (message.content === '!unrestrict') {
      if (restrictedChannels.has(message.channel.id)) {
        restrictedChannels.delete(message.channel.id);
        message.reply('Chat permission given.');
        saveRestrictedChannels();
      } else {
        message.reply('Already unrestricted');
      }
    }
    return;
  }
  if (restrictedChannels.has(message.channel.id)) return; // Check if channel is restricted

  let conversationLog = [];

  try {
    let prevMessages;
    if (message.channel.type === 'GUILD_TEXT') {
      prevMessages = await message.channel.messages.fetch({ limit: 15 });
      prevMessages.reverse();
    } else if (message.channel.type === 'DM') {
      prevMessages = await message.channel.messages.fetch({ limit: 15 });
    }

    prevMessages.forEach((msg) => {
      if (message.content.startsWith('!')) return;
      if (msg.author.id !== client.user.id && message.author.bot) return;
      if (msg.author.id !== message.author.id) return;

      conversationLog.push({
        role: 'user',
        content: msg.content,
      });
    });

    const result = await openai
      .createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: conversationLog,
      })
      .catch((error) => {
        console.log(`OPENAI ERR: ${error}`);
      });

    if (message.channel.type === 'GUILD_TEXT') {
      message.reply(result.data.choices[0].message);
    } else if (message.channel.type === 'DM' || message.channel.type === 'GROUP_DM') {
      message.channel.send(result.data.choices[0].message);
    }
  } catch (error) {
    console.log(`ERR: ${error}`);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'restrict') {
    if (!restrictedChannels.has(interaction.channelId)) {
      restrictedChannels.add(interaction.channelId);
      await interaction.reply('Chat permission denied');
      saveRestrictedChannels();
    } else {
      await interaction.reply('Already restricted.');
    }
  } else if (commandName === 'unrestrict') {
    if (restrictedChannels.has(interaction.channelId)) {
      restrictedChannels.delete(interaction.channelId);
      await interaction.reply('Chat permission given.');
      saveRestrictedChannels();
      } else {
        await interaction.reply('Already unrestricted');
    }
  }
  return;
});

// Save restricted channels to file
function saveRestrictedChannels() {
  const data = JSON.stringify({ restrictedChannels: [...restrictedChannels] });
  fs.writeFileSync(RESTRICTED_CHANNELS_FILE, data);
}

client.login(process.env.TOKEN);

