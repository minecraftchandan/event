import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

import { getLeaderboardPage } from '../utils/leaderboard.js';

const POINT_EMOJI = '<a:point:1545442629729259578>';
const PAGE_SIZE = 10;

function pageButtons(page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`leaderboard:previous:${page - 1}`)
      .setLabel('Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId(`leaderboard:next:${page + 1}`)
      .setLabel('Next')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page >= totalPages),
  );
}

async function buildLeaderboardView(page) {
  const { entries, totalPages, page: activePage } = await getLeaderboardPage(page, PAGE_SIZE);

  if (!entries.length) return { embed: null, components: [] };

  const rows = entries.map((player) => {
    const serial = `${player.rank}]`.padEnd(4, ' ');
    const points = String(player.totalAp).padStart(4, ' ');
    return `\`${serial}\` •\`${points}\` •<@${player.userId}>`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setTitle('Point Leaderboard')
    .setDescription('`S.No` •  ' + POINT_EMOJI + ' • `User`\n' + rows)
    .setFooter({ text: `Page ${activePage}/${totalPages}` })
    .setColor(0xf5b700);

  return { embed, components: [pageButtons(activePage, totalPages)] };
}

export async function execute(interaction) {
  const requestedPage = Number(interaction.options?.getInteger('page') || 1);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const view = await buildLeaderboardView(page);
  if (!view.embed) {
    await interaction.reply({ content: `No players have earned ${POINT_EMOJI} yet. Start logging cards and clashes to populate the leaderboard.`, ephemeral: true });
    return;
  }

  await interaction.reply({ embeds: [view.embed], components: view.components });
}

export async function handleLeaderboardButton(interaction) {
  if (!interaction.isButton() || !interaction.customId.startsWith('leaderboard:')) return false;

  const [, , requestedPage] = interaction.customId.split(':');
  const page = Math.max(1, Number(requestedPage) || 1);
  const view = await buildLeaderboardView(page);
  if (!view.embed) {
    await interaction.update({ content: `No players have earned ${POINT_EMOJI} yet.`, embeds: [], components: [] });
    return true;
  }

  await interaction.update({ embeds: [view.embed], components: view.components });
  return true;
}

export const data = {
  name: 'leaderboard',
  description: 'Show the top point rankings for the event with pagination.',
  options: [
    {
      name: 'page',
      description: 'Leaderboard page number to show.',
      type: 4,
      required: false,
      min_value: 1,
    },
  ],
};
