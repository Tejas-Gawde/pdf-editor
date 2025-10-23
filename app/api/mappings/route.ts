import { NextRequest } from "next/server";
import { getDb } from "@/lib/mongodb";

type Mapping = {
  _id?: string;
  name: string; // document type name
  page: number; // 1-based page index
  x: number; // normalized 0..1 from left
  y: number; // normalized 0..1 from top
  width?: number; // normalized width of signature box (optional)
  height?: number; // normalized height of signature box (optional)
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = (searchParams.get("name") || "").trim();
    if (!name) {
      return new Response(JSON.stringify({ error: "name query param required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    const db = await getDb();
    const doc = await db.collection<Mapping>("mappings").findOne({ name });
    return new Response(JSON.stringify(doc), {
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
    const body = (await req.json()) as Partial<Mapping>;
    const name = (body.name || "").trim();
    const page = Number(body.page ?? 1);
    const x = Number(body.x);
    const y = Number(body.y);
    const width = body.width === undefined ? undefined : Number(body.width);
    const height = body.height === undefined ? undefined : Number(body.height);

    if (!name || Number.isNaN(page) || Number.isNaN(x) || Number.isNaN(y)) {
      return new Response(JSON.stringify({ error: "invalid payload" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    const db = await getDb();
    const col = db.collection<Mapping>("mappings");
    await col.updateOne(
      { name },
      { $set: { name, page, x, y, width, height } },
      { upsert: true }
    );
    const saved = await col.findOne({ name });
    return new Response(JSON.stringify(saved), {
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


