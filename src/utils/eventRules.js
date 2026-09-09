import { eventConfig } from '../data/eventConfig.js';

export const rarityAp = eventConfig.rarityAp;
export const dropMilestones = eventConfig.dropMilestones;
export const clashMilestones = eventConfig.clashMilestones;
const rarityOrder = eventConfig.rarityOrder;

export function getTotalCards(cardCounts = {}) {
  return Object.values(cardCounts || {}).reduce((total, count) => total + Number(count || 0), 0);
}

export function calculateCollectionAp(player = {}) {
  const dropCardCounts = player.dropCardCounts || {};
  const clashCardCounts = player.clashCardCounts || {};
  const totalCards = getTotalCards(dropCardCounts);
  let points = 0;

  for (const rarity of rarityOrder) {
    const count = Number(dropCardCounts[rarity] || 0) + Number(clashCardCounts[rarity] || 0);
    const rarityValue = Number(rarityAp[rarity]?.value ?? 0);
    points += count * rarityValue;
  }

  for (const milestone of dropMilestones) {
    if (totalCards >= milestone.cards) {
      points += milestone.bonus;
    }
  }

  return points;
}

export function calculateClashAp(player = {}) {
  const clashes = Number(player.clashCount || 0);
  let points = 0;

  for (const milestone of clashMilestones) {
    if (clashes >= milestone.clashes) {
      points += milestone.bonus;
    }
  }

  return points;
}

export function getPlayerSnapshot(player = {}) {
  const dropCount = getTotalCards(player.dropCardCounts || {});
  const collectionAp = calculateCollectionAp(player);
  const clashAp = calculateClashAp(player);
  const clashCount = Number(player.clashCount || 0);

  const dropMilestonesStatus = eventConfig.dropMilestones.map((milestone) => ({
    ...milestone,
    current: dropCount,
    complete: dropCount >= milestone.cards,
    label: `${milestone.cards} cards`,
  }));

  const clashMilestonesStatus = eventConfig.clashMilestones.map((milestone) => ({
    ...milestone,
    current: clashCount,
    complete: clashCount >= milestone.clashes,
    label: `${milestone.clashes} clashes`,
  }));

  return {
    ...player,
    dropCardCounts: player.dropCardCounts || {},
    clashCardCounts: player.clashCardCounts || {},
    clashCount,
    dropCount,
    collectionAp,
    clashAp,
    totalAp: collectionAp + clashAp,
    dropMilestones: dropMilestonesStatus,
    clashMilestones: clashMilestonesStatus,
  };
}
