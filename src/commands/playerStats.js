import 'dotenv/config';
import { ActionRowBuilder, EmbedBuilder, PermissionFlagsBits, StringSelectMenuBuilder } from 'discord.js';

import { getPlayer } from '../utils/leaderboard.js';
import { getPlayerSnapshot } from '../utils/eventRules.js';
import { eventConfig } from '../data/eventConfig.js';

const POINT_EMOJI = '<a:point:1545442629729259578>';

const LUVI_BOT_ID = (process.env.LUVI_BOT_ID || '').trim();
const OWNER_ID = (process.env.BOT_OWNER_ID || '').trim();

function formatRarityDrops(snapshot) {
  return eventConfig.rarityOrder
    .map((rarity) => {
      const data = eventConfig.rarityAp[rarity];
      const total = (snapshot.dropCardCounts?.[rarity] || 0) + (snapshot.clashCardCounts?.[rarity] || 0);
      const emoji = `<:${data.emojiName}:${data.emojiId}>`;
      return `${emoji} ${data.label}: **${total}**`;
    })
    .join('\n');
}

function formatMilestones(milestones, targetKey) {
  return milestones
    .map((milestone) => `${milestone.complete ? '✅ ' : ''}${milestone.label} (${milestone.current}/${milestone[targetKey]}) (+${milestone.bonus} ${POINT_EMOJI})`)
    .join('\n');
}

export function buildStatsEmbed(targetUser, snapshot, includeMilestones = false) {
  const embed = new EmbedBuilder()
    .setTitle(`${targetUser.tag}'s Event Stats`)
    .setColor(0x00d1ff)
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: `Total ${POINT_EMOJI}`, value: `${snapshot.totalAp}`, inline: true },
      { name: 'Drop Count', value: `${snapshot.dropCount}`, inline: true },
      { name: 'Clash Count', value: `${snapshot.clashCount}`, inline: true },
      { name: 'Cards by Rarity', value: formatRarityDrops(snapshot), inline: false },
    );

  if (includeMilestones) {
    embed.addFields(
      { name: 'Drop Milestones', value: formatMilestones(snapshot.dropMilestones, 'cards'), inline: false },
      { name: 'Clash Milestones', value: formatMilestones(snapshot.clashMilestones, 'clashes'), inline: false },
    );
  }

  return embed;
}

export function buildMilestonesEmbed(targetUser, snapshot) {
  return new EmbedBuilder()
    .setTitle(`${targetUser.tag}'s Milestones`)
    .setColor(0x00d1ff)
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: 'Drop Milestones', value: formatMilestones(snapshot.dropMilestones, 'cards'), inline: false },
      { name: 'Clash Milestones', value: formatMilestones(snapshot.clashMilestones, 'clashes'), inline: false },
    );
}

export function buildStatsViewMenu(userId, admin = false) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${admin ? 'admin' : 'public'}-player-view:${userId}`)
      .setPlaceholder('Choose a view')
      .addOptions(
        { label: 'Stats', value: 'stats', description: 'View card counts and points' },
        { label: 'Milestones', value: 'milestones', description: 'View drop and clash milestones' },
      ),
  );
}

export async function execute(interaction) {
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const callerUser = interaction.user;

  if (targetUser.id === LUVI_BOT_ID) {
    await interaction.reply({ content: 'The Luvi bot account is tracked separately and is not included in event player rankings.', ephemeral: true });
    return;
  }

  const player = await getPlayer(targetUser.id);
  const snapshot = getPlayerSnapshot(player);

  const embed = buildStatsEmbed(targetUser, snapshot);

  await interaction.reply({ embeds: [embed], components: [buildStatsViewMenu(targetUser.id)] });
}

export async function handleStatsView(interaction) {
  if (!interaction.isStringSelectMenu()) return false;
  const isAdminView = interaction.customId.startsWith('admin-player-view:');
  if (!interaction.customId.startsWith('public-player-view:') && !isAdminView) return false;
  if (isAdminView && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) && interaction.user.id !== OWNER_ID) {
    await interaction.reply({ content: 'Only the bot owner or a server administrator can use this panel.', ephemeral: true });
    return true;
  }

  const [, userId] = interaction.customId.split(':');
  const targetUser = await interaction.client.users.fetch(userId).catch(() => null);
  if (!targetUser || targetUser.id === LUVI_BOT_ID) {
    await interaction.reply({ content: 'That player could not be found.', ephemeral: true });
    return true;
  }

  const snapshot = getPlayerSnapshot(await getPlayer(userId));
  const embed = interaction.values[0] === 'milestones'
    ? buildMilestonesEmbed(targetUser, snapshot)
    : buildStatsEmbed(targetUser, snapshot);
  await interaction.update({ embeds: [embed] });
  return true;
}

export const data = {
  name: 'mystats',
  description: 'Check your event progress, drop totals, clash totals, rarity counts, and milestone progress.',
  options: [
    {
      name: 'user',
      description: 'view stats',
      type: 6,
      required: false,
    },
  ],
};
