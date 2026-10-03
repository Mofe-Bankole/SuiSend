# F16 — Dependency hygiene: `jose` undeclared; 4 dead dependencies

- **Severity:** P3
- **Area:** infra
- **Phase:** 5
- **Status:** Open

## Evidence

`package.json` dependencies vs. reality:

| Package | Declared | Imported in `src/` |
|---------|----------|--------------------|
| `jose` | **NO** | YES — `api/zklogin/route.ts:2`, `lib/zklogin.ts:13` |
| `fastify` | yes | no |
| `@fastify/cors` | yes | no |
| `better-sqlite3` | yes | no |
| `@privy-io/react-auth` | yes | no |

`jose` resolves today only because it hoists transitively from the lockfile
(3 copies present). Any lockfile regeneration or package-manager switch can
break the build with `Module not found: Can't resolve 'jose'` — the zkLogin
API and client both die.

The dead deps tell a story: a Fastify+SQLite backend and Privy auth were
started by the previous model and abandoned mid-generation, leaving install
weight and audit surface behind.

## Fix

```bash
npm install jose
npm uninstall fastify @fastify/cors better-sqlite3 @privy-io/react-auth @types/better-sqlite3
```

Then `npm run build` from a clean `node_modules` and lockfile. Add a CI step:
fresh install + build on every PR.

## Verification

`npm ls jose fastify better-sqlite3 @privy-io/react-auth` — first present,
rest absent. Clean-clone build passes.
