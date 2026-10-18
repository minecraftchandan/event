const POINT_EMOJI = '<a:point:1545442629729259578>';

export function getMilestonesReachedAtCount(count, milestones, countKey) {
  const currentCount = Number(count || 0);
  return milestones.filter((milestone) => currentCount === Number(milestone[countKey]));
}

export async function announceMilestones(message, userId, count, milestones, countKey, action) {
  const reached = getMilestonesReachedAtCount(count, milestones, countKey);

  for (const milestone of reached) {
    await message.channel.send(`<@${userId}> ${action} ${milestone[countKey]} ${countKey === 'cards' ? 'cards' : 'clashes'} +${milestone.bonus} ${POINT_EMOJI}`).catch((error) => {
      console.error('[milestones] failed to announce milestone:', error.message);
    });
  }
}