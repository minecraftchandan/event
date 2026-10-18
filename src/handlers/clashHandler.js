import { parseClashMessage } from '../events/clashTracker.js';
import { recordCard, recordClash } from '../utils/leaderboard.js';
import { clashMilestones } from '../utils/eventRules.js';
import { announceMilestones } from '../utils/milestones.js';

export function registerClashHandler(client, LUVI_BOT_ID, DISCORD_GUILD_ID) {
  client.on('messageCreate', async (message) => {
    if (message.guildId !== DISCORD_GUILD_ID) return;
    if (!message.author?.bot || String(message.author.id) !== LUVI_BOT_ID) return;
    if (!/your clash battle has ended!/i.test(message.content || '')) return;

    const event = await parseClashMessage(message);
    if (!event) {
      console.log('[clashHandler] failed to parse clash for message:', message.id);
      return;
    }

    if (event.success && event.rarity) {
      const player = await recordCard(event.userId, event.rarity, 'clash');
      const updatedPlayer = await recordClash(event.userId);
      await announceMilestones(message, event.userId, updatedPlayer.clashCount, clashMilestones, 'clashes', 'completed');
      console.log('[clashHandler] capture success | userId:', event.userId, '| rarity:', event.rarity, '| totalAp:', player.totalAp);
    } else {
      const player = await recordClash(event.userId);
      await announceMilestones(message, event.userId, player.clashCount, clashMilestones, 'clashes', 'completed');
      console.log('[clashHandler] capture failed | userId:', event.userId, '| clashCount:', player.clashCount);
    }
  });
}
