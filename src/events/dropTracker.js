const rarityPatterns = [
  { name: 'legendary', regex: /LU_L|legendary/i },
  { name: 'exotic', regex: /LU_E|exotic/i },
  { name: 'rare', regex: /LU_R|rare/i },
  { name: 'uncommon', regex: /LU_UC|uncommon/i },
  { name: 'common', regex: /LU_C/i },
];

function normalizeRarityValue(text) {
  const match = rarityPatterns.find((item) => item.regex.test(String(text || '')));
  return match ? match.name : null;
}

function getDropUserId(message) {
  const footerUrl = message?.embeds?.[0]?.footer?.iconURL || '';
  const match = footerUrl.match(/\/avatars\/(\d+)\//);
  return match ? match[1] : null;
}

export function parseDropMessage(message) {
  if (!message?.author?.bot) return null;

  const embed = message.embeds?.[0];
  const rarity = normalizeRarityValue(embed?.description || embed?.title || '');
  if (!rarity) return null;

  const userId = getDropUserId(message);
  if (!userId) return null;

  return { userId, rarity };
}
