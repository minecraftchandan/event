import { parseDropMessage } from '../events/dropTracker.js';
import { recordCard } from '../utils/leaderboard.js';
import { dropMilestones } from '../utils/eventRules.js';
import { announceMilestones } from '../utils/milestones.js';

const processedDropMessages = new Set();

export function registerDropHandler(client, LUVI_BOT_ID) {
  client.on('messageUpdate', async (_oldMessage, newMessage) => {
    if (!newMessage.author?.bot || String(newMessage.author.id) !== LUVI_BOT_ID) return;
    if (processedDropMessages.has(newMessage.id)) return;

    const embed = newMessage.embeds?.[0];
    if (!embed?.footer?.iconURL) return;
    if (!/card dropped/i.test(embed?.title || '')) return;

    processedDropMessages.add(newMessage.id);

    const event = parseDropMessage(newMessage);
    if (!event) {
      console.log('[dropHandler] failed to parse drop for message:', newMessage.id);
      return;
    }

    const player = await recordCard(event.userId, event.rarity, 'drop');
    await announceMilestones(newMessage, event.userId, player.dropCount, dropMilestones, 'cards', 'dropped');
    console.log('[dropHandler] recorded | userId:', event.userId, '| rarity:', event.rarity, '| totalAp:', player.totalAp);
  });
}
