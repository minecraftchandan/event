import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';

const WATCH_CHANNEL_ID = '1363072720027521175';
const LUVI_BOT_ID = (process.env.LUVI_BOT_ID || '').trim();
const TOKEN = (process.env.DISCORD_TOKEN || '').trim();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// messageId -> { startTime, editCount, edits: [{ time, content, embeds }] }
const tracked = new Map();

function isLuvi(message) {
  return message?.author?.bot && String(message.author.id) === LUVI_BOT_ID;
}

function embedSummary(embeds = []) {
  return embeds.map((e, i) => {
    const lines = [`  [Embed ${i + 1}]`];
    if (e.title) lines.push(`    title: ${e.title}`);
    if (e.description) lines.push(`    description: ${e.description}`);
    if (e.fields?.length) {
      e.fields.forEach((f) => lines.push(`    field — ${f.name}: ${f.value}`));
    }
    if (e.footer?.text) lines.push(`    footer: ${e.footer.text}`);
    return lines.join('\n');
  }).join('\n') || '  (no embeds)';
}

client.on('messageCreate', (message) => {
  if (!isLuvi(message)) return;
  if (message.channel.id !== WATCH_CHANNEL_ID) return;

  const entry = {
    startTime: Date.now(),
    editCount: 0,
    edits: [],
  };

  tracked.set(message.id, entry);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`[NEW MESSAGE] id: ${message.id}`);
  console.log(`  content: ${message.content || '(empty)'}`);
  console.log(`  embeds:\n${embedSummary(message.embeds)}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

client.on('messageUpdate', (oldMessage, newMessage) => {
  if (!isLuvi(newMessage)) return;
  if (newMessage.channel.id !== WATCH_CHANNEL_ID) return;

  const entry = tracked.get(newMessage.id);
  if (!entry) return;

  entry.editCount += 1;
  const elapsed = ((Date.now() - entry.startTime) / 1000).toFixed(2);

  const editSnapshot = {
    editNumber: entry.editCount,
    elapsedSeconds: elapsed,
    content: newMessage.content || '(empty)',
    embeds: newMessage.embeds || [],
  };

  entry.edits.push(editSnapshot);

  console.log(`\n[EDIT #${entry.editCount}] message: ${newMessage.id} | +${elapsed}s`);
  console.log(`  content: ${editSnapshot.content}`);
  console.log(`  embeds:\n${embedSummary(editSnapshot.embeds)}`);

  // Detect final clash state
  const content = newMessage.content || '';
  const isClashEnded = /your clash battle has ended!/i.test(content);
  const isVictory = /you defeated/i.test(content);
  const isDefeat = /you were defeated by/i.test(content);

  if (isClashEnded && (isVictory || isDefeat)) {
    const totalTime = ((Date.now() - entry.startTime) / 1000).toFixed(2);
    console.log('\n  ✅ CLASH RESOLVED');
    console.log(`  result  : ${isVictory ? 'VICTORY (capture success)' : 'DEFEAT (capture failed)'}`);
    console.log(`  edits   : ${entry.editCount}`);
    console.log(`  total time: ${totalTime}s`);
    tracked.delete(newMessage.id);
  }
});

client.once('ready', () => {
  console.log(`\n🔍 Clash Watcher ready — watching channel ${WATCH_CHANNEL_ID}`);
  console.log(`   Luvi bot ID: ${LUVI_BOT_ID || '(not set — will miss messages)'}\n`);
});

client.login(TOKEN);
