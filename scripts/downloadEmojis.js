import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { createWriteStream, mkdirSync } from 'fs';
import { get } from 'https';
import { join } from 'path';

const CHANNEL_ID = '1402243540343459991';
const MESSAGE_ID = '1545091863961280512';
const SKIP = ['LU_M', 'LU_awakening'];
const OUT_DIR = join(process.cwd(), 'emojis');

mkdirSync(OUT_DIR, { recursive: true });

function extractEmojis(text) {
  const matches = [...(text ?? '').matchAll(/<a?:(\w+):(\d+)>/g)];
  return matches.map(m => ({ name: m[1], id: m[2], animated: m[0].startsWith('<a:') }));
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    get(url, res => res.pipe(file).on('finish', resolve).on('error', reject)).on('error', reject);
  });
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

client.once('ready', async () => {
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    const message = await channel.messages.fetch(MESSAGE_ID);

    function extractTexts(components) {
      const out = [];
      for (const c of components ?? []) {
        if (c.content) out.push(c.content);
        if (c.components) out.push(...extractTexts(c.components));
      }
      return out;
    }

    const texts = [message.content];
    for (const embed of message.embeds) {
      texts.push(embed.title, embed.description, embed.footer?.text);
      for (const field of embed.fields ?? []) texts.push(field.name, field.value);
    }
    texts.push(...extractTexts(message.components));

    const seen = new Set();
    const emojis = texts.flatMap(t => extractEmojis(t)).filter(e => {
      if (SKIP.includes(e.name)) return false;
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });

    console.log(`Found ${emojis.length} unique emojis to download.`);

    for (const e of emojis) {
      const ext = e.animated ? 'gif' : 'png';
      const url = `https://cdn.discordapp.com/emojis/${e.id}.${ext}`;
      const dest = join(OUT_DIR, `${e.name}.${ext}`);
      await download(url, dest);
      console.log(`Downloaded ${e.name}.${ext}`);
    }

    console.log(`Done. Saved to ${OUT_DIR}`);
  } catch (err) {
    console.error(err);
  } finally {
    client.destroy();
  }
});

client.login(process.env.DISCORD_TOKEN);
