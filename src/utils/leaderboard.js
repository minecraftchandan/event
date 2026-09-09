import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getPlayerSnapshot } from './eventRules.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.join(__dirname, '../data/leaderboard.json');

function ensureFile() {
  if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(dataPath, JSON.stringify({ players: {} }, null, 2), 'utf8');
  }
}

function readPlayers() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(dataPath, 'utf8')).players || {};
  } catch {
    return {};
  }
}

function writePlayers(players) {
  ensureFile();
  fs.writeFileSync(dataPath, JSON.stringify({ players }, null, 2), 'utf8');
}

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
  const players = readPlayers();
  return players[String(userId)] ? normalizePlayerRecord(players[String(userId)]) : null;
}

export async function upsertPlayerRecord(player) {
  const normalized = normalizePlayerRecord(player);
  const players = readPlayers();
  players[String(normalized.userId)] = normalized;
  writePlayers(players);
  return normalized;
}

async function updatePlayer(userId, update) {
  const players = readPlayers();
  const current = players[String(userId)]
    ? normalizePlayerRecord(players[String(userId)])
    : createEmptyPlayer(userId);
  const updated = normalizePlayerRecord(update(current));

  players[String(userId)] = updated;
  writePlayers(players);
  return updated;
}

export async function recordCard(userId, rarity, source = 'drop') {
  const current = (await getPlayerRecord(userId)) || {
    userId: String(userId),
    username: 'Unknown',
    dropCardCounts: {},
    clashCardCounts: {},
    clashCount: 0,
  };

  const normalizedRarity = String(rarity || '').toLowerCase();
  const nextDropCardCounts = { ...(current.dropCardCounts || {}) };
  const nextClashCardCounts = { ...(current.clashCardCounts || {}) };

  if (source === 'clash') {
    nextClashCardCounts[normalizedRarity] = Number(nextClashCardCounts[normalizedRarity] || 0) + 1;
  } else {
    nextDropCardCounts[normalizedRarity] = Number(nextDropCardCounts[normalizedRarity] || 0) + 1;
  }

  return upsertPlayerRecord({
    ...current,
    dropCardCounts: nextDropCardCounts,
    clashCardCounts: nextClashCardCounts,
    clashCount: Number(current.clashCount || 0),
  });
}

export async function recordClash(userId) {
  const current = (await getPlayerRecord(userId)) || {
    userId: String(userId),
    username: 'Unknown',
    dropCardCounts: {},
    clashCardCounts: {},
    clashCount: 0,
  };

  return upsertPlayerRecord({
    ...current,
    dropCardCounts: current.dropCardCounts || {},
    clashCardCounts: current.clashCardCounts || {},
    clashCount: Number(current.clashCount || 0) + 1,
  });
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
  const players = readPlayers();
  const deleted = Boolean(players[String(userId)]);
  delete players[String(userId)];
  if (deleted) writePlayers(players);
  return deleted;
}

export async function getLeaderboardPage(page = 1, pageSize = 10) {
  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedSize = Math.max(1, Number(pageSize) || 10);

  const players = Object.values(readPlayers())
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
