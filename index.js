const { Client, Intents } = require('discord.js');
const { Configuration, OpenAIApi } = require('openai');

const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_TYPING,
    Intents.FLAGS.DIRECT_MESSAGES,
    Intents.FLAGS.DIRECT_MESSAGE_TYPING,
  ],
});

const keepAlive = require('./alive.js')
keepAlive()


client.on('ready', () => {
  console.log('The bot is online!');
});

const configuration = new Configuration({
  apiKey: process.env.API_KEY,
});
const openai = new OpenAIApi(configuration);

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.content.startsWith('!')) return;

  let conversationLog = [{ role: 'system', content: 'You are a friendly chatbot.' }];

  try {
    const result = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: conversationLog,
      // max_tokens: 256, // limit token usage
    }).catch((error) => {
      console.log(`OPENAI ERR: ${error}`);
    });

    // Determine the channel type (server or DM)
    const channelType = message.channel.type;

    // Send the response to the appropriate channel
    if (channelType === 'DM') {
      message.channel.send(result.data.choices[0].message);
    } else if (channelType === 'GUILD_TEXT') {
      message.reply(result.data.choices[0].message);
    }
  } catch (error) {
    console.log(`ERR: ${error}`);
  }
});

client.login(process.env.TOKEN);
