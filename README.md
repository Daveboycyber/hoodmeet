# HoodMeet

Decentralized video conferencing MVP on **Robinhood Chain**.

- On-chain: `MeetToken` (MEET) + `RoomRegistry` (open / paid / token-gated rooms, 10% protocol fee on settle)
- Off-chain media: WebRTC via PeerJS (star topology — first tab is host)
- App: Next.js 14 + wagmi/viem, wallet login, testnet chain id **46630**

## Contracts

```bash
cd contracts
forge install OpenZeppelin/openzeppelin-contracts foundry-rs/forge-std --no-commit
export PRIVATE_KEY=0x...
export TREASURY=0x...
forge script script/Deploy.s.sol:Deploy --rpc-url robinhood_testnet --broadcast
```

Copy deployed addresses into `app/.env.local`:

```
NEXT_PUBLIC_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_ROOMS_ADDRESS=0x...
```

Public RPCs (rate limited):

- Testnet `https://rpc.testnet.chain.robinhood.com` chain id 46630
- Mainnet `https://rpc.mainnet.chain.robinhood.com` chain id 4663

## App

```bash
cd app
npm install
npm run dev
```

Open http://localhost:3000 — connect an injected wallet, add Robinhood Chain Testnet, create a room, open the room URL in a second browser.

Until contracts are deployed the UI still opens local WebRTC rooms.
