# BasedOne

BasedOne is a Base App-first frontend for a soulbound mint flow on Base Sepolia.  
Each source wallet can mint once, and multiple source wallets can point to the same target EOA.

## Current scope

- Next.js App Router frontend
- Base App-only UI gate
- Manual target EOA input
- OnchainKit transaction flow wired to the deployed `BasedOne` contract
- Static collection artwork and initial mint console

## Contract

- Network: `Base Sepolia`
- Chain ID: `84532`
- Default contract: `0x55B503cF081DD5a226f6B8929a4cC2c5C34AFa34`

Override the contract address with:

```bash
NEXT_PUBLIC_BASEDONE_CONTRACT_ADDRESS=0x...
```

## Optional env

```bash
NEXT_PUBLIC_CDP_API_KEY=your_coinbase_developer_platform_key
```

The app works without it, but OnchainKit will use a better default RPC path when it is set.

## Local development

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Local preview of the mint screen

In a normal desktop browser, the app will show the Base App access gate by default.

If you want to preview the mint UI locally without opening the app inside Base App, create a `.env.local` file:

```bash
NEXT_PUBLIC_DEV_MINIAPP_BYPASS=true
```

Then restart the dev server. This bypass is intended only for local preview.

## Notes

- This first frontend iteration accepts a pasted target EOA only.
- Optional target-signature flow is not wired yet.
- The contract remains publicly callable onchain; the Base App gate is a product-layer access filter, not a full onchain permission system.
