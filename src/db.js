import { MongoClient } from "mongodb";
import { MONGODB_URL, MONGODB_DATABASE } from "./config.js";

let mongoClient = null;
let db = null;

export async function getDb() {
  if (db) return db;
  mongoClient = new MongoClient(MONGODB_URL, {
    readPreference: "secondaryPreferred",
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 10_000,
    readConcern: { level: "local" },
  });
  await mongoClient.connect();
  db = mongoClient.db(MONGODB_DATABASE);
  return db;
}

export async function closeDb() {
  if (mongoClient) {
    await mongoClient.close().catch(() => { });
    mongoClient = null;
    db = null;
  }
}

process.on("SIGINT", closeDb);
process.on("SIGTERM", closeDb);
