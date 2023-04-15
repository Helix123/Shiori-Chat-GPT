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

const keepAlive = require('./alive.js');
keepAlive();

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
    let prevMessages;
    if (message.channel.type === 'GUILD_TEXT') {
      // Fetch previous messages in the guild text channel
      prevMessages = await message.channel.messages.fetch({ limit: 15 });
      prevMessages.reverse();
    } else if (message.channel.type === 'DM') {
      // Fetch previous messages in the private message
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
        // max_tokens: 256, // limit token usage
      })
      .catch((error) => {
        console.log(`OPENAI ERR: ${error}`);
      });

    if (message.channel.type === 'GUILD_TEXT') {
      // Send the reply to the guild text channel
      message.reply(result.data.choices[0].message);
    } else if (message.channel.type === 'DM') {
      // Send the reply as a direct message to the user
      message.author.send(result.data.choices[0].message);
    }
  } catch (error) {
    console.log(`ERR: ${error}`);
  }
});

client.login(process.env.TOKEN);
