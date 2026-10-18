import { getLeaderboardCollection } from '../data/mongo.js';
import { getPlayerSnapshot } from './eventRules.js';

function createEmptyPlayer(userId, username = 'Unknown') {
  return {
    userId: String(userId),
    username,
    dropCardCounts: {},
    clashCardCounts: {},
    clashCount: 0,
  };
}

export function normalizePlayerRecord(player = {}) {
  const userId = String(player.userId || player._id || 'unknown');
  const dropCardCounts = { ...(player.dropCardCounts || player.cardCounts || {}) };
  const snapshot = getPlayerSnapshot({
    ...player,
    userId,
    username: player.username || 'Unknown',
    dropCardCounts,
    clashCardCounts: { ...(player.clashCardCounts || {}) },
    clashCount: Number(player.clashCount || 0),
  });

  return {
    ...snapshot,
    userId,
    username: snapshot.username || player.username || 'Unknown',
    dropCardCounts: snapshot.dropCardCounts || dropCardCounts,
    clashCardCounts: snapshot.clashCardCounts || {},
    clashCount: Number(snapshot.clashCount || 0),
    dropCount: Number(snapshot.dropCount || 0),
    collectionAp: Number(snapshot.collectionAp || 0),
    clashAp: Number(snapshot.clashAp || 0),
    totalAp: Number(snapshot.totalAp || 0),
  };
}

export async function getPlayerRecord(userId) {
  const player = await getLeaderboardCollection().findOne({ _id: String(userId) });
  return player ? normalizePlayerRecord(player) : null;
}

export async function upsertPlayerRecord(player) {
  const normalized = normalizePlayerRecord(player);
  return updatePlayer(normalized.userId, () => normalized);
}

async function updatePlayer(userId, update) {
  const collection = getLeaderboardCollection();
  const normalizedUserId = String(userId);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const stored = await collection.findOne({ _id: normalizedUserId });
    const current = stored ? normalizePlayerRecord(stored) : createEmptyPlayer(normalizedUserId);
    const version = Number(stored?._version || 0);
    const updated = normalizePlayerRecord(update(current));
    const replacement = {
      ...updated,
      _id: normalizedUserId,
      _version: version + 1,
      updatedAt: new Date(),
    };
    const filter = {
      _id: normalizedUserId,
      ...(stored?._version === undefined ? { _version: { $exists: false } } : { _version: stored._version }),
    };

    try {
      const result = await collection.replaceOne(filter, replacement, { upsert: true });
      if (result.matchedCount || result.upsertedCount) return updated;
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }

  throw new Error(`Could not update leaderboard record for user ${normalizedUserId} after repeated concurrent changes.`);
}

export async function recordCard(userId, rarity, source = 'drop') {
  const normalizedRarity = String(rarity || '').toLowerCase();
  return updatePlayer(userId, (current) => {
    const countsKey = source === 'clash' ? 'clashCardCounts' : 'dropCardCounts';
    const counts = { ...(current[countsKey] || {}) };
    counts[normalizedRarity] = Number(counts[normalizedRarity] || 0) + 1;
    return { ...current, [countsKey]: counts };
  });
}

export async function recordClash(userId) {
  return updatePlayer(userId, (current) => ({
    ...current,
    clashCount: Number(current.clashCount || 0) + 1,
  }));
}

export async function adjustClashCount(userId, delta, username) {
  return updatePlayer(userId, (current) => ({
    ...current,
    username: username || current.username,
    clashCount: Math.max(0, Number(current.clashCount || 0) + Number(delta || 0)),
  }));
}

export async function adjustCardCount(userId, source, rarity, delta, username) {
  const countsKey = source === 'clash' ? 'clashCardCounts' : 'dropCardCounts';
  const normalizedRarity = String(rarity || '').toLowerCase();

  return updatePlayer(userId, (current) => {
    const counts = { ...(current[countsKey] || {}) };
    counts[normalizedRarity] = Math.max(0, Number(counts[normalizedRarity] || 0) + Number(delta || 0));
    if (counts[normalizedRarity] === 0) delete counts[normalizedRarity];

    return {
      ...current,
      username: username || current.username,
      [countsKey]: counts,
    };
  });
}

export async function deletePlayer(userId) {
  const result = await getLeaderboardCollection().deleteOne({ _id: String(userId) });
  return result.deletedCount > 0;
}

export async function resetLeaderboard() {
  const collection = getLeaderboardCollection();
  const playerCount = await collection.countDocuments();
  await collection.deleteMany({});
  return playerCount;
}

export async function getLeaderboardPage(page = 1, pageSize = 10) {
  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedSize = Math.max(1, Number(pageSize) || 10);

  const players = (await getLeaderboardCollection().find({}).toArray())
    .map((entry) => normalizePlayerRecord(entry))
    .sort((a, b) => b.totalAp - a.totalAp || b.clashAp - a.clashAp);

  const totalPages = Math.max(1, Math.ceil(players.length / normalizedSize));
  const start = (normalizedPage - 1) * normalizedSize;
  const sliced = players.slice(start, start + normalizedSize).map((entry, index) => ({ ...entry, rank: start + index + 1 }));

  return {
    entries: sliced,
    totalPages,
    page: normalizedPage,
    pageSize: normalizedSize,
    totalRows: players.length,
  };
}

export async function getLeaderboard() {
  const result = await getLeaderboardPage(1, Number.MAX_SAFE_INTEGER);
  return result.entries;
}

export async function getPlayer(userId) {
  return (await getPlayerRecord(userId)) || {
    userId: String(userId),
    username: 'Unknown',
    dropCardCounts: {},
    clashCardCounts: {},
    clashCount: 0,
  };
}

export async function addCardForUser(userId, username, rarity) {
  return updatePlayer(userId, (current) => {
    const dropCardCounts = { ...(current.dropCardCounts || {}) };
    const normalizedRarity = String(rarity || '').toLowerCase();
    dropCardCounts[normalizedRarity] = Number(dropCardCounts[normalizedRarity] || 0) + 1;
    return { ...current, username: username || current.username, dropCardCounts };
  });
}

export async function addClashForUser(userId, username) {
  return adjustClashCount(String(userId), 1, username);
}

export async function getPlayerRank(userId) {
  const leaderboard = await getLeaderboard();
  return leaderboard.find((entry) => String(entry.userId) === String(userId)) || null;
}
