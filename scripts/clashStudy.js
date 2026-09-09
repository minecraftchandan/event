import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';

const WATCH_CHANNEL_ID = '1363072720027521175';
const LUVI_BOT_ID = (process.env.LUVI_BOT_ID || '').trim();
const TOKEN = (process.env.DISCORD_TOKEN || '').trim();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// messageId -> full study data
const sessions = new Map();

function isLuvi(message) {
  return message?.author?.bot && String(message.author.id) === LUVI_BOT_ID;
}

function inChannel(message) {
  return message?.channel?.id === WATCH_CHANNEL_ID;
}

function embedSnapshot(embeds = []) {
  if (!embeds.length) return '  (no embeds)';
  return embeds.map((e, i) => {
    const lines = [`  [Embed ${i + 1}]`];
    lines.push(`    title       : ${e.title || '(none)'}`);
    lines.push(`    description : ${e.description || '(none)'}`);
    lines.push(`    color       : ${e.color ?? '(none)'}`);
    lines.push(`    image       : ${e.image?.url || '(none)'}`);
    lines.push(`    thumbnail   : ${e.thumbnail?.url || '(none)'}`);
    lines.push(`    footer.text : ${e.footer?.text || '(none)'}`);
    lines.push(`    footer.icon : ${e.footer?.icon_url || e.footer?.proxy_icon_url || '(none)'}`);
    if (e.fields?.length) {
      e.fields.forEach((f) => lines.push(`    field       : [${f.name}] = ${f.value}`));
    } else {
      lines.push('    fields      : (none)');
    }
    return lines.join('\n');
  }).join('\n');
}

function separator(label = '') {
  const line = '━'.repeat(50);
  return label ? `\n${line}\n  ${label}\n${line}` : `\n${line}`;
}

function log(...args) {
  console.log(...args);
}

// Track all Luvi messages in the channel
client.on('messageCreate', async (message) => {
  if (!isLuvi(message) || !inChannel(message)) return;

  const now = Date.now();
  const isClashEnded = /your clash battle has ended!/i.test(message.content || '');

  if (isClashEnded) {
    // This is the clash result reply — start a study session
    const session = {
      resultMessageId: message.id,
      resultMessageTime: now,
      resultContent: message.content,
      resultEmbeds: message.embeds,
      referencedMessageId: message.reference?.messageId || null,
      referencedFetches: [],
      edits: [],
      finalResult: null,
    };

    sessions.set(message.id, session);

    log(separator('CLASH ENDED MESSAGE RECEIVED'));
    log(`  message id      : ${message.id}`);
    log(`  timestamp       : ${new Date(now).toISOString()}`);
    log(`  content         : ${message.content || '(empty)'}`);
    log(`  has reference   : ${!!message.reference?.messageId}`);
    log(`  referenced id   : ${message.reference?.messageId || '(none)'}`);
    log(`  embeds on reply :\n${embedSnapshot(message.embeds)}`);

    if (!message.reference?.messageId) {
      log('  ⚠️  NO REFERENCE — cannot fetch original clash embed');
      return;
    }

    // Fetch referenced embed immediately (before edits finish)
    try {
      const immediate = await message.channel.messages.fetch(message.reference.messageId, { force: true, cache: false });
      session.referencedFetches.push({ label: 'immediate (0s)', time: Date.now(), embeds: immediate.embeds, content: immediate.content });
      log(separator('REFERENCED EMBED — IMMEDIATE FETCH (0s)'));
      log(`  content : ${immediate.content || '(empty)'}`);
      log(`  embeds  :\n${embedSnapshot(immediate.embeds)}`);
    } catch (err) {
      log(`  ❌ immediate fetch failed: ${err.message}`);
    }

    // Fetch at 3s
    setTimeout(async () => {
      try {
        const msg = await message.channel.messages.fetch(message.reference.messageId, { force: true, cache: false });
        const elapsed = ((Date.now() - now) / 1000).toFixed(2);
        session.referencedFetches.push({ label: `+${elapsed}s`, time: Date.now(), embeds: msg.embeds, content: msg.content });
        log(separator(`REFERENCED EMBED — FETCH AT +${elapsed}s`));
        log(`  content : ${msg.content || '(empty)'}`);
        log(`  embeds  :\n${embedSnapshot(msg.embeds)}`);
      } catch (err) {
        log(`  ❌ 3s fetch failed: ${err.message}`);
      }
    }, 3000);

    // Fetch at 6s
    setTimeout(async () => {
      try {
        const msg = await message.channel.messages.fetch(message.reference.messageId, { force: true, cache: false });
        const elapsed = ((Date.now() - now) / 1000).toFixed(2);
        session.referencedFetches.push({ label: `+${elapsed}s`, time: Date.now(), embeds: msg.embeds, content: msg.content });
        log(separator(`REFERENCED EMBED — FETCH AT +${elapsed}s`));
        log(`  content : ${msg.content || '(empty)'}`);
        log(`  embeds  :\n${embedSnapshot(msg.embeds)}`);
      } catch (err) {
        log(`  ❌ 6s fetch failed: ${err.message}`);
      }
    }, 6000);

    // Fetch at 10s — final
    setTimeout(async () => {
      try {
        const msg = await message.channel.messages.fetch(message.reference.messageId, { force: true, cache: false });
        const elapsed = ((Date.now() - now) / 1000).toFixed(2);
        session.referencedFetches.push({ label: `+${elapsed}s (final)`, time: Date.now(), embeds: msg.embeds, content: msg.content });

        const embed = msg.embeds?.[0];
        const embedText = [
          embed?.title || '',
          embed?.description || '',
          ...(embed?.fields || []).map((f) => `${f.name} ${f.value}`),
        ].join(' ');

        const isVictory = /you defeated/i.test(embedText) || /you defeated/i.test(message.content);
        const isDefeat = /you were defeated/i.test(embedText) || /you were defeated/i.test(message.content);

        // Detect rarity
        const rarityPatterns = [
          { name: 'legendary', regex: /LU_L|legendary/i },
          { name: 'exotic', regex: /LU_E|exotic/i },
          { name: 'rare', regex: /LU_R|rare/i },
          { name: 'uncommon', regex: /LU_UC|uncommon/i },
          { name: 'common', regex: /LU_C|common/i },
        ];
        const rarityMatch = rarityPatterns.find((r) => r.regex.test(embedText));
        const rarity = rarityMatch?.name || null;

        session.finalResult = { isVictory, isDefeat, rarity, embedText };

        log(separator('FINAL FETCH AT +10s'));
        log(`  content     : ${msg.content || '(empty)'}`);
        log(`  embeds      :\n${embedSnapshot(msg.embeds)}`);
        log(separator('CLASH STUDY SUMMARY'));
        log(`  result message id   : ${session.resultMessageId}`);
        log(`  referenced embed id : ${session.referencedMessageId}`);
        log(`  total fetches       : ${session.referencedFetches.length}`);
        log(`  total edits seen    : ${session.edits.length}`);
        log(`  victory detected    : ${isVictory}`);
        log(`  defeat detected     : ${isDefeat}`);
        log(`  rarity detected     : ${rarity || '(none)'}`);
        log(`  full embed text     : ${embedText.slice(0, 300)}`);
        log(separator('END OF CLASH STUDY'));

        sessions.delete(message.id);
      } catch (err) {
        log(`  ❌ final fetch failed: ${err.message}`);
      }
    }, 10000);

    return;
  }

  // Any other Luvi message — log it
  log(separator('LUVI MESSAGE'));
  log(`  id      : ${message.id}`);
  log(`  content : ${message.content || '(empty)'}`);
  log(`  embeds  :\n${embedSnapshot(message.embeds)}`);
});

// Track all edits to Luvi messages
client.on('messageUpdate', async (oldMessage, newMessage) => {
  if (!isLuvi(newMessage) || !inChannel(newMessage)) return;

  const now = Date.now();

  // Find if this is a referenced embed being tracked
  for (const [, session] of sessions) {
    if (session.referencedMessageId === newMessage.id) {
      const elapsed = ((now - session.resultMessageTime) / 1000).toFixed(2);
      session.edits.push({ elapsed, embeds: newMessage.embeds, content: newMessage.content });

      log(separator(`REFERENCED EMBED EDITED — +${elapsed}s after clash ended`));
      log(`  edit #  : ${session.edits.length}`);
      log(`  content : ${newMessage.content || '(empty)'}`);
      log(`  embeds  :\n${embedSnapshot(newMessage.embeds)}`);
      return;
    }
  }

  // General edit log
  log(separator('LUVI MESSAGE EDITED'));
  log(`  id      : ${newMessage.id}`);
  log(`  content : ${newMessage.content || '(empty)'}`);
  log(`  embeds  :\n${embedSnapshot(newMessage.embeds)}`);
});

client.once('ready', () => {
  log(separator('CLASH STUDY BOT READY'));
  log(`  logged in as : ${client.user.tag}`);
  log(`  watching     : channel ${WATCH_CHANNEL_ID}`);
  log(`  luvi bot id  : ${LUVI_BOT_ID || '⚠️  NOT SET'}`);
  log(separator());
});

client.login(TOKEN);
