import 'dotenv/config';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

import { eventConfig } from '../data/eventConfig.js';
import { getPlayer, adjustCardCount, adjustClashCount, deletePlayer } from '../utils/leaderboard.js';
import { buildStatsEmbed } from './playerStats.js';

const OWNER_ID = (process.env.BOT_OWNER_ID || '').trim();
const LUVI_BOT_ID = (process.env.LUVI_BOT_ID || '').trim();
const POINT_EMOJI = '<a:point:1545442629729259578>';
const USER_ID_PATTERN = /^(?:<@!?(\d+)>|(\d+))$/;

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) || interaction.user.id === OWNER_ID;
}

function parseUserId(value) {
  const match = String(value || '').trim().match(USER_ID_PATTERN);
  return match?.[1] || match?.[2] || null;
}

async function resolveUser(interaction, value) {
  const userId = parseUserId(value);
  if (!userId) return null;
  return interaction.client.users.fetch(userId).catch(() => null);
}

function panelComponents(userId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`admin-player:clash:${userId}`).setLabel('Edit clash count').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`admin-player:drop:${userId}`).setLabel('Edit drop cards').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`admin-player:rarity:${userId}`).setLabel('Edit rarity cards').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`admin-player:delete:${userId}`).setLabel('Delete player').setStyle(ButtonStyle.Danger),
    ),
  ];
}

function editModal(type, userId, player) {
  const isClash = type === 'clash';
  const modal = new ModalBuilder()
    .setCustomId(`admin-modal:${type}:${userId}`)
    .setTitle(isClash ? 'Edit clash count' : 'Edit card count');

  if (!isClash) {
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('source')
        .setLabel('Card source: drop or clash')
        .setPlaceholder('drop')
        .setValue(type === 'drop' ? 'drop' : 'clash')
        .setRequired(true)
        .setStyle(TextInputStyle.Short),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('rarity')
          .setLabel('Rarity')
          .setPlaceholder(`Drop: ${Object.entries(player.dropCardCounts || {}).map(([rarity, count]) => `${rarity}=${count}`).join(', ') || 'none'} | Clash: ${Object.entries(player.clashCardCounts || {}).map(([rarity, count]) => `${rarity}=${count}`).join(', ') || 'none'}`.slice(0, 100))
          .setRequired(true)
          .setStyle(TextInputStyle.Short),
      ),
    ));
  }

  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('delta')
      .setLabel('Change by (use a negative number to remove)')
      .setPlaceholder(isClash ? `Current: ${player.clashCount || 0}; enter +1 or -1` : 'Enter +1 or -1')
      .setRequired(true)
      .setStyle(TextInputStyle.Short),
  ));
  return modal;
}

export async function execute(interaction) {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: 'Only the bot owner or a server administrator can manage player data.', ephemeral: true });
    return;
  }

  const targetUser = await resolveUser(interaction, interaction.options.getString('user'));
  if (!targetUser) {
    await interaction.reply({ content: 'Enter a valid Discord user ID or mention, such as `123456789012345678` or `<@123456789012345678>`.', ephemeral: true });
    return;
  }
  if (targetUser.id === LUVI_BOT_ID) {
    await interaction.reply({ content: 'The Luvi bot account cannot be edited as an event player.', ephemeral: true });
    return;
  }

  const player = await getPlayer(targetUser.id);
  const embed = buildStatsEmbed(targetUser, player, true);
  embed.setTitle(`Admin: ${targetUser.tag}'s Event Stats`).setColor(0xff8a3d);

  await interaction.reply({ embeds: [embed], components: panelComponents(targetUser.id), ephemeral: true });
}

export async function executeMessage(message, rawUser) {
  if (!message.member?.permissions?.has(PermissionFlagsBits.Administrator) && message.author.id !== OWNER_ID) {
    await message.reply('Only the bot owner or a server administrator can manage player data.');
    return;
  }

  const targetUser = await resolveUser(message, rawUser);
  if (!targetUser) {
    await message.reply('Use `eadmin <user ID>` or `eadmin <@mention>`.');
    return;
  }
  if (targetUser.id === LUVI_BOT_ID) {
    await message.reply('The Luvi bot account cannot be edited as an event player.');
    return;
  }

  const player = await getPlayer(targetUser.id);
  const embed = buildStatsEmbed(targetUser, player, true);
  embed.setTitle(`Admin: ${targetUser.tag}'s Event Stats`).setColor(0xff8a3d);
  await message.reply({ embeds: [embed], components: panelComponents(targetUser.id) });
}

export async function handleComponent(interaction) {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: 'Only the bot owner or a server administrator can use this panel.', ephemeral: true });
    return true;
  }

  const [kind, type, userId] = interaction.customId.split(':');
  if (kind !== 'admin-player') return false;

  if (type === 'delete') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`admin-player-confirm-delete:${userId}`).setLabel('Confirm delete').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('admin-player-cancel-delete').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
    );
    await interaction.reply({ content: `Delete all event data for <@${userId}>? This cannot be undone.`, components: [row], ephemeral: true });
    return true;
  }

  const player = await getPlayer(userId);
  await interaction.showModal(editModal(type === 'rarity' ? 'cards' : type, userId, player));
  return true;
}

export async function handleModal(interaction) {
  if (!isAdmin(interaction) || !interaction.customId.startsWith('admin-modal:')) return false;

  const [, type, userId] = interaction.customId.split(':');
  const delta = Number(interaction.fields.getTextInputValue('delta'));
  if (!Number.isInteger(delta) || delta === 0) {
    await interaction.reply({ content: 'Change must be a non-zero whole number.', ephemeral: true });
    return true;
  }

  const targetUser = await interaction.client.users.fetch(userId).catch(() => null);
  if (!targetUser || targetUser.id === LUVI_BOT_ID) {
    await interaction.reply({ content: 'That player could not be found or cannot be edited.', ephemeral: true });
    return true;
  }

  let player;
  if (type === 'clash') {
    player = await adjustClashCount(userId, delta, targetUser.tag);
  } else {
    const source = interaction.fields.getTextInputValue('source').trim().toLowerCase();
    const rarity = interaction.fields.getTextInputValue('rarity').trim().toLowerCase();
    if (!['drop', 'clash'].includes(source) || !eventConfig.rarityOrder.includes(rarity)) {
      await interaction.reply({ content: 'Source must be `drop` or `clash`, and rarity must be a valid event rarity.', ephemeral: true });
      return true;
    }
    player = await adjustCardCount(userId, source, rarity, delta, targetUser.tag);
  }

  const embed = buildStatsEmbed(targetUser, player, true);
  embed.setTitle(`Admin: ${targetUser.tag}'s Event Stats`).setColor(0xff8a3d);
  await interaction.reply({ content: `Updated <@${userId}> by ${delta > 0 ? '+' : ''}${delta}. Milestones and ${POINT_EMOJI} were recalculated.`, embeds: [embed], components: panelComponents(userId), ephemeral: true });
  return true;
}

export async function handleDeleteConfirmation(interaction) {
  if (!isAdmin(interaction)) return false;
  if (interaction.customId === 'admin-player-cancel-delete') {
    await interaction.update({ content: 'Delete cancelled.', components: [] });
    return true;
  }
  if (!interaction.customId.startsWith('admin-player-confirm-delete:')) return false;

  const userId = interaction.customId.split(':')[1];
  const deleted = await deletePlayer(userId);
  await interaction.update({ content: deleted ? `Deleted all event data for <@${userId}>.` : 'No stored data existed for that player.', components: [] });
  return true;
}

export const data = {
  name: 'admin-player',
  description: 'Open the admin editor for a player.',
  options: [{
    name: 'user',
    description: 'A Discord user ID or mention.',
    type: 3,
    required: true,
  }],
};
