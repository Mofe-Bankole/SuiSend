import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase64, toHex, toBase64 } from '@mysten/sui/utils';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

const UPGRADE_CAP_ID = '0xc72edb6cfed2183e066bb02f169c6e1fbdc336a2cd745819c0123cea1bed1933';
// The latest published version - the UpgradeCap now points to this
// after the v3 upgrade
const LATEST_PACKAGE_ID = '0x15e985c9c82b8d4ed5d171b2bc6703aa78507c9cc1473ae6c0daf8b54625adcb';
const ORIGINAL_PACKAGE_ID = '0xbefdf372ed7b01a45561b71eb62ba2aed0370f7b79221d42ba1a14e8f75d6fe9';
const NETWORK = 'mainnet';

function loadKeypair() {
  const keystorePath = join(process.env.HOME, '.sui/sui_config/sui.keystore');
  const keystore = JSON.parse(readFileSync(keystorePath, 'utf-8'));
  const keyBase64 = keystore[0];
  const keyBytes = fromBase64(keyBase64);
  if (keyBytes[0] !== 0x00) throw new Error('Only Ed25519 keys supported');
  return Ed25519Keypair.fromSecretKey(keyBytes.subarray(1));
}

function loadModules() {
  const modulesDir = join(__dirname, '..', 'build', 'suisend', 'bytecode_modules');
  const files = readdirSync(modulesDir).filter(f => f.endsWith('.mv')).sort();
  return files.map(f => ({ name: f, bytes: readFileSync(join(modulesDir, f)) }));
}

function uleb128(value) {
  const bytes = [];
  do {
    let byte = value & 0x7f;
    value >>= 7;
    if (value !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (value !== 0);
  return new Uint8Array(bytes);
}

function bcsSerializeVectorOfVectors(elements) {
  // Sort lexicographically
  const sorted = [...elements].sort((a, b) => {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] !== b[i]) return a[i] - b[i];
    }
    return a.length - b.length;
  });
  // Build BCS: uleb128(len) + for each: uleb128(elem_len) + elem_bytes
  const parts = [uleb128(sorted.length)];
  for (const elem of sorted) {
    parts.push(uleb128(elem.length));
    parts.push(elem);
  }
  const totalLen = parts.reduce((acc, p) => acc + p.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.length;
  }
  return result;
}

function computeDigest(modules, dependencies) {
  // Algorithm: sha3_256(sort(modules ++ deps))
  // Where modules is list of byte arrays (each .mv file bytes)
  // and deps is list of 32-byte ObjectIDs
  // The list is sorted lexicographically as raw bytes
  // Then BCS serialized as Vec<Vec<u8>>
  // Then SHA3-256 hashed

  const moduleBytes = modules.map(m => new Uint8Array(m));
  const depIds = dependencies.map(id => {
    const hex = id.replace('0x', '').padStart(64, '0');
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
  });

  const elements = [...moduleBytes, ...depIds];
  const serialized = bcsSerializeVectorOfVectors(elements);
  const digest = createHash('sha3-256').update(serialized).digest();
  return new Uint8Array(digest);
}

async function getDependencies(client) {
  // Full transitive dependency closure from the v3 package's linkage table
  return [
    '0x0000000000000000000000000000000000000000000000000000000000000001', // std
    '0x0000000000000000000000000000000000000000000000000000000000000002', // sui
    '0x07caedbf4c4d64288771089889a8b3e8721e5522bb55d041b14a234bf5e4d242', // Decimal
    '0x1318fdc90319ec9c24df1456d960a447521b0a658316155895014a6e39b5482f', // Whitelist
    '0x1478a432123e4b3d61878b629f2c692969fdb375644f1251cd278a4b1e7d7cd6', // XOracle
    '0x779b5c547976899f5474f3a5bc0db36ddf4697ad7e5a901db0415c2281d28162', // X (Scallop Lib)
    '0xad013d5fde39e15eabda32b3dbdafd67dac32b798ce63237c27a8f73339b9b6f', // Math
    '0xca5a5a62f01c79a104bf4d31669e29daa387f325c241de4edbe30986a9bc8b0d', // CoinDecimalsRegistry
    '0xefe8b36d5b2e43728cc323298626b83177803521d195cfb11e15b910e892fddf', // Scallop
  ];
}

async function main() {
  const keypair = loadKeypair();
  const address = keypair.toSuiAddress();
  console.log('Deployer address:', address);
  console.log('Expected address: 0x44e511dec5f801ee48f3290a16a6e2b5fdd3a577210badce24f37f5739d66835');

  const client = new SuiJsonRpcClient({
    url: getJsonRpcFullnodeUrl(NETWORK),
    network: NETWORK,
  });

  const modules = loadModules();
  console.log(`\nLoaded ${modules.length} modules:`);
  modules.forEach(m => console.log(`  ${m.name}: ${m.bytes.length} bytes`));

  const dependencies = await getDependencies(client);
  console.log('Dependencies:', dependencies);

  // Validator-computed digest for this module + dep set
  const digest = new Uint8Array([107, 242, 150, 187, 27, 52, 254, 157, 254, 238, 188, 139, 245, 183, 17, 64, 58, 91, 168, 47, 26, 59, 32, 135, 153, 244, 115, 24, 202, 74, 33, 125]);
  console.log('Digest (hex):', toHex(digest));

  // Build the upgrade transaction
  const tx = new Transaction();

  // Step 1: authorize upgrade with the computed digest
  const ticket = tx.moveCall({
    target: '0x2::package::authorize_upgrade',
    arguments: [
      tx.object(UPGRADE_CAP_ID),
      tx.pure.u8(0),
      tx.pure.vector('u8', [...digest]),
    ],
  });

  // Step 2: upgrade command with bytecode and deps
  const receipt = tx.upgrade({
    modules: modules.map(m => [...m.bytes]),
    dependencies,
    package: LATEST_PACKAGE_ID,
    ticket,
  });

  // Step 3: commit upgrade
  tx.moveCall({
    target: '0x2::package::commit_upgrade',
    arguments: [tx.object(UPGRADE_CAP_ID), receipt],
  });

  tx.setGasBudget(100_000_000n);

  // Dry-run to verify
  console.log('\n=== Dry run (devInspect) ===');
  const dryResult = await client.devInspectTransactionBlock({
    transactionBlock: tx,
    sender: address,
  });
  console.log('Dry run status:', dryResult?.effects?.status?.status);
  const dryError = dryResult?.effects?.status?.error;
  if (dryError) console.log('Dry run error:', dryError);

  if (dryError && dryError.includes('DigestDoesNotMatch')) {
    console.error('Digest mismatch - skipping real submission');
    process.exit(1);
  }

  console.log('\nSubmitting upgrade...');
  const result = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: {
      showEffects: true,
      showObjectChanges: true,
      showEvents: true,
    },
  });

  console.log('\n=== Result ===');
  console.log('Digest:', result.digest);
  console.log('Status:', result.effects?.status?.status);
  if (result.effects?.status?.status === 'failure') {
    console.error('Error:', result.effects?.status?.error);
    process.exit(1);
  }

  const changes = result.objectChanges || [];
  const published = changes.find(c => c.type === 'published');
  if (published) {
    console.log('New package ID:', published.packageId);
  }

  if (result.effects?.gasUsed) {
    const gas = result.effects.gasUsed;
    console.log(`Gas: computation=${gas.computationCost}, storage=${gas.storageCost}, rebate=${gas.storageRebate}`);
  }

  console.log('\n✅ Upgrade complete!');
  if (published) {
    console.log(`\nUpdate .env with:\n  NEXT_PUBLIC_SUISEND_PACKAGE_ID=${published.packageId}`);
    console.log(`Also update:\n  NEXT_PUBLIC_SUISEND_PACKAGE_ID_V2=${published.packageId}\nif it should be the latest reference.`);
  }
}

main().catch(console.error);
