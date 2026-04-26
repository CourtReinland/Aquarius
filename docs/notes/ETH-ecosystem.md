╔══════════════════════════════════════════════════════════════════════════════════╗
║                        ETHEREUM ECOSYSTEM (2026)                               ║
╚══════════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────────┐
│                          ETHEREUM MAINNET (L1)                                  │
│  Token: ETH | Consensus: Proof of Stake | EVM-based smart contract platform     │
│  The base settlement layer — all L2s post proofs/data back here                 │
└──────────────────────────────────┬──────────────────────────────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│   TESTNETS       │  │  L2 ROLLUPS      │  │  INFRASTRUCTURE      │
│   (Free ETH)     │  │  (Scale L1)      │  │  & MIDDLEWARE         │
└──────────────────┘  └──────────────────┘  └──────────────────────┘

═══════════════════════════════════════════════════════════════════════
 TESTNETS — Free environments for devs to test before mainnet deploy
═══════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────┐
│ Sepolia        │ Primary testnet for app devs. PoS. Most       │
│                │ widely used. Permissioned validator set.       │
├────────────────┼───────────────────────────────────────────────┤
│ Holesky        │ Staking & infra testnet. Large validator set. │
│                │ Used for testing protocol upgrades & staking.  │
├────────────────┼───────────────────────────────────────────────┤
│ Hoodi          │ Newer testnet launched for Pectra upgrade      │
│                │ testing. Replaced some Goerli use cases.       │
└────────────────┴───────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════
 OPTIMISTIC ROLLUPS — Assume txs valid, fraud proofs if challenged
═══════════════════════════════════════════════════════════════════════
                         ┌──────────────┐
                         │  ETH Mainnet │
                         │  (settles to)│
                         └──────┬───────┘
               ┌────────────────┼────────────────┐
               ▼                ▼                ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Arbitrum One     │ │ OP Mainnet       │ │ Base             │
│ Token: ARB       │ │ Token: OP        │ │ Token: (no token)│
│                  │ │                  │ │                  │
│ Largest L2 by    │ │ Built OP Stack,  │ │ Built by         │
│ TVL. DeFi hub.   │ │ the framework    │ │ Coinbase on OP   │
│ Nitro engine for │ │ powering the     │ │ Stack. Consumer   │
│ fast cheap txs.  │ │ Superchain.      │ │ onboarding focus.│
│ Orbit chains     │ │ Governs via      │ │ Largest user     │
│ (L3s) built on   │ │ retroactive      │ │ base of any L2.  │
│ top of it.       │ │ public goods     │ │ Social, NFTs,    │
│                  │ │ funding (RPGF).  │ │ and DeFi.        │
└──────────────────┘ └──────────────────┘ └──────────────────┘
                              │
                     ┌────────┴────────┐
                     │  OP SUPERCHAIN  │
                     │  Shared sequencer│
                     │  & bridge model  │
                     └────────┬────────┘
                ┌─────────────┼──────────────┐
                ▼             ▼              ▼
        ┌────────────┐ ┌───────────┐ ┌────────────┐
        │ Base       │ │ Zora      │ │ Mode       │
        │ (Coinbase) │ │ NFT/media │ │ Token: MODE│
        │            │ │ chain     │ │ DeFi-native│
        └────────────┘ └───────────┘ └────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ Mantle         │ Token: MNT  │ Modular L2, uses separate DA     │
│                │             │ layer. Treasury-backed by BitDAO. │
├────────────────┼─────────────┼──────────────────────────────────┤
│ Blast          │ Token: BLAST│ Native yield on ETH & stables.   │
│                │             │ Auto-rebasing. DeFi & gaming.    │
└────────────────┴─────────────┴──────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════
 ZK ROLLUPS — Validity proofs, math-verified correctness, no delay
═══════════════════════════════════════════════════════════════════════
                         ┌──────────────┐
                         │  ETH Mainnet │
                         │  (proofs to) │
                         └──────┬───────┘
          ┌──────────────────────┼──────────────────────┐
          ▼                      ▼                      ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ zkSync Era       │  │ StarkNet         │  │ Polygon zkEVM    │
│ Token: ZK        │  │ Token: STRK      │  │ Token: POL       │
│                  │  │                  │  │                  │
│ ZK rollup with   │  │ Uses STARKs (no  │  │ EVM-equivalent   │
│ native account   │  │ trusted setup).  │  │ ZK rollup by     │
│ abstraction.     │  │ Cairo language.  │  │ Polygon. Part of │
│ Hyperchains      │  │ Full execution   │  │ Polygon 2.0 /    │
│ (ZK L3s) for     │  │ proofs on-chain. │  │ AggLayer vision. │
│ app-specific     │  │ Gaming & DeFi    │  │ Unified liquidity│
│ scaling.         │  │ focus. Fully     │  │ across Polygon   │
│                  │  │ open-source.     │  │ chains.          │
└──────────────────┘  └──────────────────┘  └──────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ Scroll          │ Token: SCR  │ EVM-equivalent zkRollup.         │
│                 │             │ Community-driven, bytecode-level │
│                 │             │ compatibility with Ethereum.     │
├─────────────────┼─────────────┼──────────────────────────────────┤
│ Linea           │ Token: (TBD)│ ConsenSys-built zkEVM. Deep      │
│                 │             │ MetaMask integration. Enterprise.│
├─────────────────┼─────────────┼──────────────────────────────────┤
│ Taiko           │ Token: TAIKO│ "Based rollup" — uses L1         │
│                 │             │ validators as sequencers.        │
│                 │             │ Maximum Ethereum-alignment.      │
└─────────────────┴─────────────┴──────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════
 DATA AVAILABILITY (DA) — Where rollups post tx data
═══════════════════════════════════════════════════════════════════════

  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
  │ Ethereum Blobs│    │ EigenDA       │    │ Celestia      │
  │ (EIP-4844)    │    │ Token: EIGEN  │    │ Token: TIA    │
  │               │    │               │    │               │
  │ Native DA via │    │ Restaked ETH  │    │ Modular DA    │
  │ blob txs.     │    │ secures DA.   │    │ layer. Some   │
  │ Cheapest for  │    │ Part of       │    │ L2s use it    │
  │ L2s posting   │    │ EigenLayer    │    │ instead of    │
  │ to Ethereum.  │    │ middleware.   │    │ Ethereum.     │
  └───────────────┘    └───────────────┘    └───────────────┘

═══════════════════════════════════════════════════════════════════════
 KEY INFRA & PROTOCOLS (built on / around Ethereum)
═══════════════════════════════════════════════════════════════════════

 DeFi                          Staking/Restaking
 ┌────────────────────────┐    ┌────────────────────────┐
 │ Uniswap    │ UNI       │    │ Lido       │ LDO/stETH │
 │ Top DEX, AMM pioneer   │    │ Liquid staking, ~28%   │
 ├────────────┼───────────┤    │ of all staked ETH      │
 │ Aave       │ AAVE      │    ├────────────┼───────────┤
 │ Lending/borrowing      │    │ EigenLayer │ EIGEN     │
 ├────────────┼───────────┤    │ Restaking. Extends ETH │
 │ MakerDAO   │ MKR/DAI   │    │ security to middleware │
 │ Decentralized stable-  │    ├────────────┼───────────┤
 │ coin (DAI) issuer      │    │ Rocket Pool│ RPL/rETH  │
 ├────────────┼───────────┤    │ Decentralized staking  │
 │ Lido       │ stETH     │    │ (permissionless nodes) │
 │ Liquid staking token   │    └────────────┴───────────┘
 ├────────────┼───────────┤
 │ Pendle     │ PENDLE    │    Bridges & Interop
 │ Yield tokenization     │    ┌────────────────────────┐
 ├────────────┼───────────┤    │ LayerZero  │ ZRO       │
 │ Ethena     │ ENA/USDe  │    │ Omnichain messaging    │
 │ Synthetic dollar,      │    ├────────────┼───────────┤
 │ delta-neutral yield    │    │ Wormhole   │ W         │
 └────────────┴───────────┘    │ Cross-chain bridge     │
                               ├────────────┼───────────┤
 Oracles & Identity            │ Across     │ ACX       │
 ┌────────────────────────┐    │ Intent-based bridge    │
 │ Chainlink  │ LINK      │    └────────────┴───────────┘
 │ Price feeds & CCIP     │
 │ (cross-chain interop)  │
 ├────────────┼───────────┤
 │ ENS        │ ENS       │
 │ .eth names, on-chain   │
 │ identity system        │
 └────────────┴───────────┘

═══════════════════════════════════════════════════════════════════════
 RELATIONSHIP MAP
═══════════════════════════════════════════════════════════════════════

  Ethereum L1 ──settles──▶ All Rollups post proofs/data to L1
       │
       ├── Blobs (EIP-4844) ── cheap DA for rollups
       │
       ├── Lido/RocketPool ── stake ETH to secure PoS
       │        │
       │        └── EigenLayer ── restake stETH to secure middleware
       │                │
       │                └── EigenDA ── DA layer secured by restaking
       │
       ├── Optimistic Rollups ── Arbitrum, OP, Base, Blast, Mantle
       │        │
       │        └── OP Superchain ── Base, Zora, Mode share infra
       │
       ├── ZK Rollups ── zkSync, StarkNet, Polygon zkEVM, Scroll
       │        │
       │        └── Polygon AggLayer ── unifies Polygon ZK chains
       │
       ├── DeFi ── Uniswap, Aave, Maker deploy on L1 + L2s
       │
       ├── Bridges ── LayerZero, Wormhole, Across move assets cross-chain
       │
       └── Oracles ── Chainlink feeds price data to DeFi on all layers
