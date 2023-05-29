const { Client, Intents } = require('discord.js');
const { Configuration, OpenAIApi } = require('openai');
const fetch = require('node-fetch');
const fs = require('fs');

const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_TYPING,
  ],
});

const keepAlive = require('./alive.js');
keepAlive();

const SAVED_CHANNELS_FILE = './saved_channels.json';

// Load saved channels from file
let savedChannels = [];
if (fs.existsSync(SAVED_CHANNELS_FILE)) {
  const data = fs.readFileSync(SAVED_CHANNELS_FILE);
  savedChannels = JSON.parse(data);
}

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.application.commands.create({
    name: 'setchannel',
    description: 'Sets the channel where the bot will respond',
  });
});

const configuration = new Configuration({
  apiKey: process.env.API_KEY,
});
const openai = new OpenAIApi(configuration);

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.content.startsWith('!')) {
    if (message.content === '!setchannel') {
      const channelId = message.channel.id;
      if (!savedChannels.includes(channelId)) {
        savedChannels = [channelId];
        message.reply('Channel set. The bot will now only respond in this channel.');
        saveChannels();
      } else {
        message.reply('The bot is already restricted to this channel.');
      }
    }
    return;
  }

  const channelId = message.channel.id;
  if (!savedChannels.includes(channelId)) return; // Check if channel is the saved channel

  const greetings = ['hello', 'hi', 'hey', 'howdy', 'sup', "what's up"];
  if (greetings.includes(message.content.toLowerCase())) {
    message.reply("Hi there! I'm Shiori, your friendly AI assistant. How can I help you today?");
    return;
  }

  let conversationLog = [];

  try {
    const prevMessages = await message.channel.messages.fetch({ limit: 15 });
    const filteredMessages = prevMessages.filter(
      (msg) => msg.author.id === client.user.id || msg.author.id === message.author.id
    );

    filteredMessages.forEach((msg) => {
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

    message.reply(result.data.choices[0].message);
  } catch (error) {
    console.log(`ERR: ${error}`);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'setchannel') {
    const channelId = interaction.channelId;
    if (!savedChannels.includes(channelId)) {
      savedChannels = [channelId];
      await interaction.reply('Channel set. The bot will now only respond in this channel.');
      saveChannels();
    } else {
      await interaction.reply('The bot is already restricted to this channel.');
    }
  }
});

// Save channels to file
function saveChannels() {
  const data = JSON.stringify(savedChannels);
  fs.writeFileSync(SAVED_CHANNELS_FILE, data);
}

client.login(process.env.TOKEN);

