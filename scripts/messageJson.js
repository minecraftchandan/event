export function serializeMessage(message) {
  if (!message) {
    return null;
  }

  return {
    id: message.id,
    channelId: message.channelId,
    guildId: message.guildId || null,
    createdTimestamp: message.createdTimestamp,
    content: message.content || '',
    author: {
      id: message.author?.id || null,
      username: message.author?.username || null,
      tag: message.author?.tag || null,
      bot: Boolean(message.author?.bot),
    },
    embeds: (message.embeds || []).map((embed) => embed.toJSON ? embed.toJSON() : embed),
    components: (message.components || []).map((component) => component.toJSON ? component.toJSON() : component),
    attachments: (message.attachments?.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      url: attachment.url,
      contentType: attachment.contentType || null,
    })) || []),
    stickerItems: (message.stickerItems || []).map((sticker) => ({
      id: sticker.id,
      name: sticker.name,
      format: sticker.format,
    })),
  };
}
