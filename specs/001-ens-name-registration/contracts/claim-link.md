# Contract: Claim Link / URL Format

The single-use claim link is produced upstream (out of scope) and consumed by this app. This is the
contract for its shape.

## URL format

```text
https://join.black.ygg.army/#k=<privateKeyBase64Url>
```

- The secret travels in the **URL fragment** (after `#`) so it is never sent to a server (FR-001,
  FR-010, Principle II/III).
- `<privateKeyBase64Url>` is the 32-byte secp256k1 private key encoded with **base64url**
  (RFC 4648 §5: `-` and `_` instead of `+`/`/`, padding optional/omitted). Decoding yields exactly
  32 bytes.
- Parameter key: `k`. Additional fragment params (if any) are ignored.

## Parsing rules (app behavior)

1. On load, read `window.location.hash`, parse `k`.
2. Base64url-decode `k`; treat decode failure, wrong length (≠ 32 bytes), or an out-of-range scalar
   as `InvalidLink` (FR-008).
3. Derive `signerAddress` from the decoded key (whitelist identity).
4. Hold the key in memory only; do **not** write it to history, storage, logs, or any request. The
   app SHOULD clear the fragment from the address bar after reading (`replaceState`) to reduce
   shoulder-surfing/history exposure, without navigating.

## Non-goals

- Generating links, whitelisting addresses, and delivering links to recipients are upstream and out
  of scope (spec "Out of Scope").
