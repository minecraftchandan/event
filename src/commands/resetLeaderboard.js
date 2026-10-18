import { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';

import { resetLeaderboard } from '../utils/leaderboard.js';

const OWNER_ID = (process.env.BOT_OWNER_ID || '').trim();
const RESET_CONFIRMATION_PREFIX = 'leaderboard-reset:confirm:';
const RESET_CANCELLATION_PREFIX = 'leaderboard-reset:cancel:';

function isAdmin(permissions, userId) {
  return permissions?.has(PermissionFlagsBits.Administrator) || userId === OWNER_ID;
}

export async function executeMessage(message) {
  if (!isAdmin(message.member?.permissions, message.author.id)) {
    await message.reply('Only the bot owner or a server administrator can reset the leaderboard.');
    return;
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${RESET_CONFIRMATION_PREFIX}${message.author.id}`)
      .setLabel('Confirm')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`${RESET_CANCELLATION_PREFIX}${message.author.id}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary),
  );

  await message.reply({
    content: 'Do you want to reset the leaderboard? This cannot be undone.',
    components: [row],
  });
}

export async function handleResetConfirmation(interaction) {
  const isConfirm = interaction.customId.startsWith(RESET_CONFIRMATION_PREFIX);
  const isCancel = interaction.customId.startsWith(RESET_CANCELLATION_PREFIX);
  if (!isConfirm && !isCancel) return false;

  const requesterId = interaction.customId.slice(
    (isConfirm ? RESET_CONFIRMATION_PREFIX : RESET_CANCELLATION_PREFIX).length,
  );
  if (interaction.user.id !== requesterId || !isAdmin(interaction.memberPermissions, interaction.user.id)) {
    await interaction.reply({
      content: 'Only the administrator who requested this reset can use these buttons.',
      ephemeral: true,
    });
    return true;
  }

  if (isCancel) {
    await interaction.update({ content: 'Leaderboard reset cancelled.', components: [] });
    return true;
  }

  const playerCount = await resetLeaderboard();
  await interaction.update({
    content: `Leaderboard reset. Removed ${playerCount} player record${playerCount === 1 ? '' : 's'}.`,
    components: [],
  });
  return true;
}
