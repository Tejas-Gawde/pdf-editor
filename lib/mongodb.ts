import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI as string | undefined;

if (!uri) {
  // We allow boot without URI so the user can add it later; actual calls will throw.
}

let client: MongoClient | undefined;
let clientPromise: Promise<MongoClient> | undefined;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

export function getMongoClient(): Promise<MongoClient> {
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      client = new MongoClient(uri);
      global._mongoClientPromise = client.connect();
    }
    return global._mongoClientPromise;
  }

  if (!clientPromise) {
    client = new MongoClient(uri);
    clientPromise = client.connect();
  }
  return clientPromise;
}

export async function getDb(dbName = process.env.MONGODB_DB || "pdf-editor") {
  const cli = await getMongoClient();
  return cli.db(dbName);
}


