"use client";

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import {
  generateNonce,
  generateRandomness,
  jwtToAddress,
  getExtendedEphemeralPublicKey,
  genAddressSeed,
  getZkLoginSignature,
} from "@mysten/sui/zklogin";
import { decodeJwt } from "jose";
import { Transaction } from "@mysten/sui/transactions";

// Fill these after Google OAuth setup
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
export const REDIRECT_URI =
  typeof window !== "undefined"
    ? `${window.location.origin}/auth/callback`
    : "http://localhost:3000/auth/callback";

export const PROVER_URL = "https://prover-dev.mystenlabs.com/v1";
export const SALT_URL = "https://salt.api.mystenlabs.com/get_salt";
export const NETWORK = "mainnet";

const SESSION_KEYS = {
  ephemeralKey: "zklogin.ephemeralKey",
  maxEpoch: "zklogin.maxEpoch",
  randomness: "zklogin.randomness",
  nonce: "zklogin.nonce",
  jwt: "zklogin.jwt",
  salt: "zklogin.salt",
  address: "zklogin.address",
  proof: "zklogin.proof",
} as const;

export interface ZkLoginState {
  address: string;
  jwt: string;
  maxEpoch: number;
  isReady: boolean;
}

function getSuiClient() {
  return new SuiJsonRpcClient({
    url: getJsonRpcFullnodeUrl(NETWORK),
    network: NETWORK as "testnet" | "mainnet" | "devnet" | "localnet",
  });
}

export function initZkLogin(): string {
  const sui = getSuiClient();

  const keypair = new Ed25519Keypair();
  const randomness = generateRandomness();

  // Store ephemeral key and randomness immediately
  sessionStorage.setItem(
    SESSION_KEYS.ephemeralKey,
    JSON.stringify(Array.from(keypair.getSecretKey())),
  );
  sessionStorage.setItem(SESSION_KEYS.randomness, randomness);

  // Return the Google OAuth URL (nonce will be generated when we know the epoch)
  // We need epoch first, so return a placeholder — the real flow starts async
  return "";
}

export async function getGoogleAuthUrl(): Promise<string> {
  const sui = getSuiClient();
  const { epoch } = await sui.getLatestSuiSystemState();
  const currentEpoch = Number(epoch);
  const maxEpoch = currentEpoch + 2;

  // Recover ephemeral key from session
  const keyData = sessionStorage.getItem(SESSION_KEYS.ephemeralKey);
  if (!keyData) throw new Error("No ephemeral key found. Call initZkLogin first.");
  const secretKey = new Uint8Array(JSON.parse(keyData));
  const keypair = Ed25519Keypair.fromSecretKey(secretKey);

  const randomness = sessionStorage.getItem(SESSION_KEYS.randomness)!;
  const nonce = generateNonce(keypair.getPublicKey(), maxEpoch, randomness);

  sessionStorage.setItem(SESSION_KEYS.maxEpoch, String(maxEpoch));
  sessionStorage.setItem(SESSION_KEYS.nonce, nonce);

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    response_type: "id_token",
    redirect_uri: REDIRECT_URI,
    scope: "openid",
    nonce,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function completeZkLogin(jwt: string): Promise<ZkLoginState> {
  const sui = getSuiClient();

  // Decode JWT to verify it has basic structure
  const decoded = decodeJwt(jwt);
  if (!decoded.sub || !decoded.aud) {
    throw new Error("Invalid JWT: missing sub or aud");
  }

  // Fetch salt
  const saltResp = await fetch(`${SALT_URL}?jwt=${encodeURIComponent(jwt)}`);
  if (!saltResp.ok) {
    throw new Error(`Salt service failed: ${saltResp.status}`);
  }
  const { salt } = await saltResp.json();
  const userSalt = BigInt(salt);

  // Derive Sui address
  const userAddress = jwtToAddress(jwt, userSalt, false);

  // Recover session state
  const keyData = sessionStorage.getItem(SESSION_KEYS.ephemeralKey);
  const maxEpochStr = sessionStorage.getItem(SESSION_KEYS.maxEpoch);
  const randomness = sessionStorage.getItem(SESSION_KEYS.randomness);
  if (!keyData || !maxEpochStr || !randomness) {
    throw new Error("Missing zkLogin session state. Please re-authenticate.");
  }
  const maxEpoch = Number(maxEpochStr);
  const secretKey = new Uint8Array(JSON.parse(keyData));
  const keypair = Ed25519Keypair.fromSecretKey(secretKey);
  const extendedPubKey = getExtendedEphemeralPublicKey(keypair.getPublicKey());

  // Fetch ZK proof
  const proverResp = await fetch(PROVER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jwt,
      extendedEphemeralPublicKey: extendedPubKey,
      maxEpoch,
      jwtRandomness: randomness,
      salt: userSalt.toString(),
      keyClaimName: "sub",
    }),
  });

  if (!proverResp.ok) {
    const errText = await proverResp.text().catch(() => "unknown error");
    throw new Error(`Prover failed (${proverResp.status}): ${errText}`);
  }

  const zkProof = await proverResp.json();

  // Store everything in session
  sessionStorage.setItem(SESSION_KEYS.jwt, jwt);
  sessionStorage.setItem(SESSION_KEYS.salt, userSalt.toString());
  sessionStorage.setItem(SESSION_KEYS.address, userAddress);
  sessionStorage.setItem(SESSION_KEYS.proof, JSON.stringify(zkProof));

  return {
    address: userAddress,
    jwt,
    maxEpoch,
    isReady: true,
  };
}

export function getZkLoginState(): ZkLoginState | null {
  const address = sessionStorage.getItem(SESSION_KEYS.address);
  const jwt = sessionStorage.getItem(SESSION_KEYS.jwt);
  const maxEpochStr = sessionStorage.getItem(SESSION_KEYS.maxEpoch);

  if (!address || !jwt) return null;

  return {
    address,
    jwt,
    maxEpoch: Number(maxEpochStr || "0"),
    isReady: !!sessionStorage.getItem(SESSION_KEYS.proof),
  };
}

export function clearZkLogin() {
  Object.values(SESSION_KEYS).forEach((key) => sessionStorage.removeItem(key));
}

export async function signWithZkLoginAndExecute(
  tx: Transaction,
): Promise<string> {
  const sui = getSuiClient();

  const address = sessionStorage.getItem(SESSION_KEYS.address);
  const jwt = sessionStorage.getItem(SESSION_KEYS.jwt);
  const maxEpochStr = sessionStorage.getItem(SESSION_KEYS.maxEpoch);
  const keyData = sessionStorage.getItem(SESSION_KEYS.ephemeralKey);
  const proofData = sessionStorage.getItem(SESSION_KEYS.proof);
  const saltStr = sessionStorage.getItem(SESSION_KEYS.salt);

  if (!address || !jwt || !maxEpochStr || !keyData || !proofData || !saltStr) {
    throw new Error("Incomplete zkLogin session. Please re-authenticate.");
  }

  const maxEpoch = Number(maxEpochStr);
  const secretKey = new Uint8Array(JSON.parse(keyData));
  const keypair = Ed25519Keypair.fromSecretKey(secretKey);
  const userSalt = BigInt(saltStr);
  const zkProof = JSON.parse(proofData);
  const decodedJwt = decodeJwt(jwt);

  const addressSeed = genAddressSeed(
    userSalt,
    "sub",
    decodedJwt.sub!,
    decodedJwt.aud as string,
  ).toString();

  const bytes = await tx.build({ client: sui });
  const { signature: ephemeralSignature } = await keypair.signTransaction(bytes);

  const zkLoginSignature = getZkLoginSignature({
    inputs: { ...zkProof, addressSeed },
    maxEpoch,
    userSignature: ephemeralSignature,
  });

  const result = await sui.executeTransactionBlock({
    transactionBlock: bytes,
    signature: zkLoginSignature,
  });

  return result.digest;
}
