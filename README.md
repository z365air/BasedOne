# BasedOne

BasedOne is a Base App-first frontend for a soulbound mint flow on Base Sepolia.  

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

## Notes

- Optional target-signature flow is not wired yet.
- The contract remains publicly callable onchain; the Base App gate is a product-layer access filter, not a full onchain permission system.
