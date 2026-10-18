import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';

import { serializeMessage } from './messageJson.js';

const token = (process.env.DISCORD_TOKEN || '').trim();

if (!token) {
  throw new Error('Set DISCORD_TOKEN in your .env file before running the embed inspector bot.');
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

function printMessageJson(message) {
  const payload = serializeMessage(message);
  console.log('=== EMBED JSON START ===');
  console.log(JSON.stringify(payload, null, 2));
  console.log('=== EMBED JSON END ===');
}

client.on('ready', () => {
  console.log(`Embed inspector bot logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) {
    return;
  }

  const trimmed = message.content.trim();
  const match = trimmed.match(/(?:^|\s)(?:inspect|json|embed)?\s*(\d{15,20})(?:\s|$)/i);

  if (!match) {
    return;
  }

  const messageId = match[1];

  try {
    const targetMessage = await message.channel.messages.fetch(messageId);
    printMessageJson(targetMessage);
    await message.reply({ content: `Printed embed JSON for message ${messageId} to the terminal.`, ephemeral: false });
  } catch (error) {
    console.error('Unable to fetch target message:', error);
    await message.reply({ content: `I could not fetch message ${messageId}. Check that the message is in this channel and the ID is valid.`, ephemeral: true });
  }
});

client.login(token);
