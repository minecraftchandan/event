export const databaseSchema = {
  databaseName: 'luvi_event',
  collectionName: 'leaderboard',
  indexes: [
    { field: 'totalAp', direction: -1 },
    { field: 'collectionAp', direction: -1 },
    { field: 'clashAp', direction: -1 },
    { field: 'userId', direction: 1 },
    { field: 'dropCount', direction: -1 },
    { field: 'clashCount', direction: -1 },
  ],
  fields: {
    _id: 'string',
    userId: 'string',
    username: 'string',
    dropCardCounts: {
      common: 'number',
      uncommon: 'number',
      rare: 'number',
      exotic: 'number',
      legendary: 'number',
    },
    clashCardCounts: {
      common: 'number',
      uncommon: 'number',
      rare: 'number',
      exotic: 'number',
      legendary: 'number',
    },
    dropCount: 'number',
    clashCount: 'number',
    totalCards: 'number',
    collectionAp: 'number',
    clashAp: 'number',
    totalAp: 'number',
    dropMilestones: 'array',
    clashMilestones: 'array',
    updatedAt: 'date',
  },
};

export default databaseSchema;
