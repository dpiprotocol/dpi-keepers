# DPI Keepers — E2E Testing

## Quick Start

```bash
cd ~/dubai/dpi-keepers
npx tsx scripts/test-e2e.ts
```

## What It Does

1. **Loads admin keypair** from `~/dpi-protocol/target/deploy/admin-keypair.json` (override with `ADMIN_KEYPAIR_PATH` env var)
2. **Creates 2 test wallets** (Trader A + Trader B) — keypairs saved in `test-wallets/` (gitignored, persists across runs)
3. **Funds each wallet** with 0.3 SOL from admin
4. **Mints 1000 devnet USDC** each via token faucet
5. **Creates user accounts** on the DPI protocol for both traders
6. **Deposits USDC** as collateral for both traders
7. **Trader A places a LONG** market order (0.1 units on perp market 0)
8. **Trader B places a SHORT** market order (0.1 units on perp market 0)
9. **Polls every 2s** waiting for the filler bot to match orders (up to 60s timeout)
10. **Reports final state** — positions, open orders, free collateral

## What It Validates

- Users can deposit collateral
- Orders can be placed on-chain
- The **filler bot** picks up and matches opposing orders
- Positions are opened correctly (long vs short)

## Files

| File | Description |
|------|-------------|
| `scripts/test-e2e.ts` | The test script |
| `test-wallets/` | Generated keypairs (gitignored) |

## Config

| Variable | Default | Description |
|----------|---------|-------------|
| `ADMIN_KEYPAIR_PATH` | `/root/dpi-protocol/target/deploy/admin-keypair.json` | Admin wallet that funds test wallets |
| `DEPOSIT_AMOUNT_USDC` | 1000 | USDC deposited per trader |
| `ORDER_SIZE_BASE` | 0.1 | Order size in base units |
| `SOL_PER_WALLET` | 0.3 | SOL sent to each test wallet for tx fees |

## Re-running

Test wallets are reused across runs. If wallets already have SOL/USDC and user accounts, those steps are skipped automatically.
