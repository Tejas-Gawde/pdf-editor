import { NextRequest } from "next/server";
import { getDb } from "@/lib/mongodb";

type DocumentType = {
  _id?: string;
  name: string;
  // Future: coordinates and additional metadata
};

export async function GET() {
  try {
    const db = await getDb();
    const items = await db
      .collection<DocumentType>("document_types")
      .find({}, { projection: { name: 1 } })
      .toArray();
    return new Response(JSON.stringify(items), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Unknown error" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<DocumentType>;
    const name = (body.name || "").trim();
    if (!name) {
      return new Response(JSON.stringify({ error: "name is required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const db = await getDb();
    const col = db.collection<DocumentType>("document_types");
    const existing = await col.findOne({ name: { $regex: `^${name}$`, $options: "i" } });
    if (existing) {
      return new Response(JSON.stringify(existing), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    const result = await col.insertOne({ name });
    const created = await col.findOne({ _id: result.insertedId });
    return new Response(JSON.stringify(created), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Unknown error" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}


