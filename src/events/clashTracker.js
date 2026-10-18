const rarityPatterns = [
  { name: 'legendary', regex: /LU_L/i },
  { name: 'exotic', regex: /LU_E/i },
  { name: 'rare', regex: /LU_R/i },
  { name: 'uncommon', regex: /LU_UC/i },
  { name: 'common', regex: /LU_C/i },
];

export function getFirstMentionId(text) {
  const match = String(text || '').match(/<@!?(\d+)>/);
  return match ? match[1] : null;
}

function normalizeRarityFromField(text) {
  const match = rarityPatterns.find((r) => r.regex.test(text));
  return match ? match.name : null;
}

export async function parseClashMessage(message) {
  if (!message || !message.author || !message.author.bot) {
    return null;
  }

  const content = message.content || '';
  if (!/your clash battle has ended!/i.test(content)) {
    return null;
  }

  const userId = getFirstMentionId(content);
  if (!userId) {
    return null;
  }

  if (!message.reference?.messageId) {
    console.log('[clashTracker] no referenced message id');
    return { type: 'clash', userId, rarity: null, success: false, source: 'clash' };
  }

  // Always wait 10s for capture result embed to settle
  await new Promise((resolve) => setTimeout(resolve, 10000));

  let rarity = null;
  let captureSuccess = false;

  try {
    const referencedMessage = await message.channel.messages.fetch(message.reference.messageId, { force: true, cache: false });
    const embed = referencedMessage.embeds?.[0];
    const title = embed?.title || '';

    captureSuccess = /capture successful/i.test(title);

    if (captureSuccess) {
      const capturedField = (embed?.fields || []).find((f) => /card captured/i.test(f.name));
      rarity = normalizeRarityFromField(capturedField?.value || '');
    }

    console.log('[clashTracker] title:', title, '| captureSuccess:', captureSuccess, '| rarity:', rarity);
  } catch (err) {
    console.error('[clashTracker] failed to fetch referenced message:', err.message);
  }

  return { type: 'clash', userId, rarity, success: captureSuccess, source: 'clash' };
}
