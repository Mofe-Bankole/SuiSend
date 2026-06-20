import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { createHmac } from "crypto";

const PROVER_URL = "https://prover-dev.mystenlabs.com/v1";

const googleJWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

function deriveSalt(sub: string): string {
  const seed = process.env.ZKLOGIN_MASTER_SEED;
  if (!seed) {
    throw new Error("ZKLOGIN_MASTER_SEED not set");
  }
  const hash = createHmac("sha256", seed).update(sub).digest();
  return BigInt("0x" + hash.subarray(0, 16).toString("hex")).toString();
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, jwt } = body;

  if (action === "salt") {
    if (!jwt) {
      return NextResponse.json({ error: "Missing jwt" }, { status: 400 });
    }
    try {
      const { payload } = await jwtVerify(jwt, googleJWKS, {
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      });
      if (!payload.sub) {
        return NextResponse.json(
          { error: "JWT missing sub claim" },
          { status: 400 },
        );
      }
      const salt = deriveSalt(payload.sub as string);
      return NextResponse.json({ salt });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Salt derivation failed";
      return NextResponse.json({ error: msg }, { status: 403 });
    }
  }

  if (action === "prove") {
    try {
      const resp = await fetch(PROVER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body.proverPayload),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => "unknown error");
        return NextResponse.json(
          { error: `Prover failed (${resp.status}): ${text}` },
          { status: resp.status },
        );
      }
      const data = await resp.json();
      return NextResponse.json(data);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Prover fetch failed" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
