import 'dotenv/config';
import { EmbedBuilder } from 'discord.js';
import { eventConfig } from '../data/eventConfig.js';

const POINT_EMOJI = '<a:point:1545442629729259578>';

export async function execute(interaction) {
  const rarityLines = eventConfig.rarityOrder
    .map((r) => {
      const rarity = eventConfig.rarityAp[r];
      const emoji = `<:${rarity.emojiName}:${rarity.emojiId}>`;
      return `${emoji} ${rarity.label}: +${rarity.value} ${POINT_EMOJI} each`;
    })
    .join('\n');

  const dropMilestoneLines = eventConfig.dropMilestones
    .map((milestone) => `${milestone.cards} cards  →  +${milestone.bonus} ${POINT_EMOJI}`)
    .join('\n');

  const clashMilestoneLines = eventConfig.clashMilestones
    .map((milestone) => `${milestone.clashes} clashes  →  +${milestone.bonus} ${POINT_EMOJI}`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setTitle('🏆 EVENT RULES')
    .setDescription(`Points and milestone rewards\n1 Point = 1 ${POINT_EMOJI}.`)
    .setColor(0x00d1ff)
    .addFields(
      { name: `Card ${POINT_EMOJI}`, value: rarityLines, inline: false },
      { name: 'Drop Milestones', value: dropMilestoneLines, inline: true },
      { name: 'Clash Milestones', value: clashMilestoneLines, inline: true },
    )
    .setFooter({ text: 'Progress and points update automatically as events are recorded.' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

export const data = {
  name: 'event-help',
  description: 'Show the event rules and scoreboard logic.',
};
