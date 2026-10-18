import { MongoClient } from 'mongodb';

import { databaseSchema } from './databaseSchema.js';

let client;
let leaderboardCollection;

export async function connectToMongo() {
  const uri = (process.env.MONGO_URI || '').trim();
  if (!uri) {
    throw new Error('Set MONGO_URI in your .env file before starting the bot.');
  }

  client = new MongoClient(uri);
  await client.connect();

  const database = client.db(databaseSchema.databaseName);
  leaderboardCollection = database.collection(databaseSchema.collectionName);
  await leaderboardCollection.createIndexes(
    databaseSchema.indexes.map(({ field, direction }) => ({
      key: { [field]: direction },
    })),
  );

  console.log(`Connected to MongoDB database "${databaseSchema.databaseName}".`);
}

export function getLeaderboardCollection() {
  if (!leaderboardCollection) {
    throw new Error('MongoDB is not connected. Call connectToMongo() before accessing the leaderboard.');
  }

  return leaderboardCollection;
}
