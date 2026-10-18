import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { connectToMongo } from './data/mongo.js';
import { execute as eventHelpExecute } from './commands/eventHelp.js';
import { execute as leaderboardExecute, handleLeaderboardButton } from './commands/leaderboard.js';
import { executeMessage as resetLeaderboardMessage, handleResetConfirmation } from './commands/resetLeaderboard.js';
import { execute as playerStatsExecute, handleStatsView } from './commands/playerStats.js';
import { executeMessage as adminPlayerMessage, handleComponent as handleAdminPlayerComponent, handleModal as handleAdminPlayerModal, handleDeleteConfirmation } from './commands/adminPlayer.js';
import { registerDropHandler } from './handlers/dropHandler.js';
import { registerClashHandler } from './handlers/clashHandler.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const TOKEN = (process.env.DISCORD_TOKEN || '').trim();
const LUVI_BOT_ID = (process.env.LUVI_BOT_ID || '').trim();

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isStringSelectMenu()) {
    try {
      await handleStatsView(interaction);
    } catch (error) {
      console.error(error);
    }
    return;
  }

  if (interaction.isButton()) {
    try {
      if (await handleResetConfirmation(interaction)) return;
      if (await handleLeaderboardButton(interaction)) return;
      if (await handleDeleteConfirmation(interaction)) return;
      await handleAdminPlayerComponent(interaction);
    } catch (error) {
      console.error(error);
    }
    return;
  }

  if (interaction.isModalSubmit()) {
    try {
      await handleAdminPlayerModal(interaction);
    } catch (error) {
      console.error(error);
    }
    return;
  }

  return;
});

client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot) return;

    const content = (message.content || '').trim();
    const botMention = client.user ? new RegExp(`^<@!?${client.user.id}>\\s*`, 'i') : null;
    const isMentionCommand = botMention?.test(content);
    const commandContent = isMentionCommand ? content.replace(botMention, '').trim() : content;
    const [commandName, ...args] = commandContent.split(/\s+/);
    const command = commandName?.toLowerCase();

    if (command === 'eadd') {
      await adminPlayerMessage(message, args[0]);
      return;
    }

    if (command === 'ereset') {
      await resetLeaderboardMessage(message);
      return;
    }

    if (command === 'ehelp') {
      await eventHelpExecute({ reply: async (payload) => message.reply(payload) });
      return;
    }

    if (command === 'ems') {
      const rawArg = args[0];
      let targetUser = message.author;
      if (rawArg) {
        const userId = rawArg.replace(/[<>@!]/g, '');
        const member = await message.guild?.members.fetch(userId).catch(() => null)
          || await client.users.fetch(userId).catch(() => null);
        if (member) targetUser = member.user ?? member;
      }
      await playerStatsExecute({
        user: message.author,
        options: { getUser: () => targetUser },
        reply: async (payload) => message.reply(payload),
      });
      return;
    }

    if (command === 'elb') {
      await leaderboardExecute({
        options: { getInteger: () => 1 },
        reply: async (payload) => message.reply(payload),
      });
    }
  } catch (error) {
    console.error('[messageCreate] command failed:', error);
    if (!message.replied) {
      await message.reply('There was an error running that command.').catch(() => null);
    }
  }
});

await connectToMongo();

registerDropHandler(client, LUVI_BOT_ID);
registerClashHandler(client, LUVI_BOT_ID);

await client.login(TOKEN);
