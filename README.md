<div align="center">
  <img width="100%" src="https://raw.githubusercontent.com/dpiprotocol/dpiprotocol/main/banner.png" />

  <h1 style="margin-top:20px;">DPI Keepers</h1>

  <p>
    <strong>Keeper Bots for DPI Protocol — Order Filling & Liquidation Services</strong>
  </p>

  <p>
    <a href="https://dpi.market"><img alt="Website" src="https://img.shields.io/badge/website-dpi.market-blueviolet" /></a>
    <a href="https://x.com/dpiperp"><img alt="Twitter" src="https://img.shields.io/badge/twitter-@dpiperp-blueviolet" /></a>
    <a href="https://opensource.org/licenses/Apache-2.0"><img alt="License" src="https://img.shields.io/github/license/dpiprotocol/dpi-keepers?color=blueviolet" /></a>
  </p>
</div>

## Overview

DPI Keepers are the backbone infrastructure bots that keep the [DPI Protocol](https://github.com/dpiprotocol/dpi-protocol) exchange running smoothly. They handle order matching, liquidations, and other critical exchange operations for Dubai Property Index perpetual futures.

This repo is a fork of [Drift keeper-bots-v2](https://github.com/drift-labs/keeper-bots-v2), customized for DPI Protocol's RWA markets.

## Branches

| Branch | Cluster | Description |
|--------|---------|-------------|
| `master` | devnet | Bleeding edge, may be unstable |
| `mainnet-beta` | mainnet-beta | Stable, production-ready |

## Quick Start

### 1. Install Dependencies

```shell
yarn install
yarn build
```

### 2. Configure

Create a `config.yaml` based on the included `example.config.yaml`:

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `global.endpoint` | string | RPC endpoint | — |
| `global.wsEndpoint` | string | Websocket endpoint (optional) | derived from endpoint |
| `global.keeperPrivateKey` | string | Private key for signing (optional) | `KEEPER_PRIVATE_KEY` env var |
| `global.initUser` | bool | Initialize a fresh user account | `false` |
| `global.websocket` | bool | Run bots in websocket mode | `false` |
| `global.runOnce` | bool | Run only one iteration | `false` |
| `global.debug` | bool | Enable debug logging | `false` |
| `global.subaccounts` | list | Subaccount IDs to load | `[0]` |
| `enabledBots` | list | Bots to enable (must match keys in `botConfigs`) | — |
| `botConfigs` | object | Per-bot configuration | — |

### 3. Initialize User

```shell
yarn run dev --init-user
```

### 4. Deposit Collateral (if needed)

Some bots (liquidator, JIT maker) require collateral:

```shell
# deposit 10,000 USDC
yarn run dev --force-deposit 10000
```

### 5. Run

```shell
yarn run dev --config-file=config.yaml
```

Prometheus metrics are exposed at `localhost:9464/metrics` by default.

## Available Bots

### Filler Bot

Matches crossing orders on the DPI exchange for a share of taker fees. Maintains a copy of the DLOB to find crossing orders and triggers triggerable orders.

Enable with `filler`, `spotFiller`, or `fillerLite` (lightweight, works on public RPCs) in `enabledBots`.

### Liquidator Bot

Monitors DPI markets for undercollateralized accounts and liquidates positions. Configurable per-market via `perpMarketIndicies` / `spotMarketIndicies` or per-subaccount via `perpSubAccountConfig` / `spotSubAccountConfig`.

Set `disableAutoDerisking: true` to disable automatic derisking if you want to hold inherited positions.

### JIT Maker

Supplies liquidity by participating in Just-In-Time auctions for DPI perp markets.

## Related

- [DPI Protocol](https://github.com/dpiprotocol/dpi-protocol) — Core protocol and SDK
- [dpi.market](https://dpi.market) — Trading interface

## Acknowledgments

Forked from [Drift keeper-bots-v2](https://github.com/drift-labs/keeper-bots-v2). Thanks to the Drift team for the solid foundation.

## License

Apache 2.0