# ChainBid

## Project Description

ChainBid is a decentralized auction dApp where users can create and participate in auctions for NFT-backed items. The main idea is simple: the seller lists an item, the smart contract holds the NFT during the auction, users bid through their wallets, and the result is settled on-chain.

We wanted to build something more interesting than a basic NFT marketplace. Instead of only listing an NFT for a fixed price, ChainBid supports multiple auction formats, so the seller can choose the mechanism that fits the item better.

The app supports both digital and physical items. For digital items, the NFT itself is the item being sold, for example digital art, a collectible, a game asset, or a membership token. For physical items, the NFT works more like a claim certificate. For example, a car cannot physically live on the blockchain, but an NFT can represent the right to claim that car after winning the auction. The actual delivery still happens outside the blockchain, which is a known limitation, but the auction result and payment flow are handled transparently by the smart contracts.

ChainBid supports both ERC721 and ERC1155 NFTs. ERC721 is used for unique items, while ERC1155 can represent multiple copies or semi-fungible assets.

### Auction Types

1. **English Auction**

The English auction is the most familiar auction type. The seller creates an auction with a reserve price and duration. Users place bids, and each new bid must be higher than the previous one.

When a new highest bid is placed, the previous highest bidder does not lose their ETH. Their funds become withdrawable, so they can claim the refund back from the contract. After the auction ends, the auction can be finalized. If there is a winner, the NFT goes to the highest bidder and the seller receives the winning bid.

2. **Dutch Auction**

The Dutch auction works in the opposite way. The seller starts with a higher price, and the price decreases over time until someone buys the item or the auction ends.

The seller chooses the start price, reserve price, and duration. Buyers can wait for the price to fall, but if they wait too long, someone else may buy the item first. Once a buyer accepts the current price, the auction is finished.

3. **Vickrey Auction With Commit-Reveal**

The Vickrey auction is a sealed-bid auction. Bidders do not openly show their bids during the first phase. The highest bidder wins, but they pay only the second-highest valid bid.

This is interesting on blockchain because normal blockchain data is public. If users submitted their bids directly, everyone would see them immediately. To avoid this, ChainBid uses a commit-reveal process.

First, during the commit phase, a bidder chooses a bid amount and a secret. The frontend creates a hash from those values. The bidder submits only the hash and sends a deposit. Other users can see that the bidder participated, but they cannot see the real bid amount.

Later, during the reveal phase, the bidder reveals the bid amount and the secret. The contract checks that these values match the original hash. It also checks that the deposit is enough to cover the bid. If the reveal is valid, the bid is counted. If the reveal is invalid, the bidder is blocked from this auction.

After the reveal phase ends, the auction is settled. The highest valid bidder wins, the seller receives the second-highest valid bid, and the winner gets back the extra deposit. Losing bidders can withdraw their deposits.

### Digital and Physical Items

For digital items, the auction can be settled fully on-chain. The NFT is transferred to the winner, and the ETH is handled by the contract.

For physical items, the NFT represents a claim to the real-world item. After the auction is finalized, the winner receives the NFT, but the physical item still has to be delivered off-chain. When the winner receives the item, they call the confirmation function in the app. This confirmation releases the payment to the seller.

Handling real-world ownership verification, delivery proof, and dispute resolution is outside the scope of this project. 

### Metadata and Images

Each item can have a title, description, asset type, and images. These files are not stored directly on-chain because that would be too expensive. Instead, images and metadata are uploaded to IPFS using Pinata.

The app stores the metadata URI and uses it to display the item information in the frontend. This lets users see what they are bidding on while keeping the blockchain storage small.

## Architecture Overview

ChainBid is built on top of Scaffold-ETH 2. We use the Hardhat version of Scaffold-ETH, so the project is split into two main packages:

- `packages/hardhat` contains the Solidity smart contracts, deployment scripts, and tests.
- `packages/nextjs` contains the frontend application built with Next.js.

The main stack is:

- Solidity for the smart contracts
- Hardhat for compiling, testing, and deploying contracts
- OpenZeppelin contracts for NFT standards, clone contracts, and security helpers
- Next.js and React for the frontend
- Wagmi and Viem for communication with the blockchain
- RainbowKit for wallet connection
- Pinata/IPFS for storing item images and metadata
- Sign-In with Ethereum for protecting the metadata upload endpoint

### Smart Contracts

The smart contracts are the core of the application. They handle auction creation, NFT escrow, bids, payments, refunds, and final settlement.

1. **AuctionFactory.sol**

The `AuctionFactory.sol` is the main entry point for creating auctions. Instead of deploying a completely new full contract manually every time, the factory uses OpenZeppelin clones. This means every auction gets its own contract, but creation is cheaper because the auction contract is a lightweight clone of an existing implementation.

The factory supports creating English, Dutch, and Vickrey auctions. It also validates the auction item, checks auction durations, creates the auction clone, transfers the NFT from the seller into the auction contract, and stores a list of created auctions.

This is also where the NFT escrow begins. The seller approves the factory first, and then the factory transfers the NFT into the new auction contract during auction creation.

2. **BaseAuction.sol**

`BaseAuction.sol` contains logic shared by all auction types. It stores the auction item, seller, reserve price, end time, winner, final price, and refund balances.

It also handles common behavior such as transferring the NFT, releasing payment, withdrawing refunds, and confirming receipt for physical items.

For digital items, payment can be released when the auction is finalized. For physical items, the seller receives payment only after the winner confirms that they received the item.

3. **EnglishAuction.sol**

`EnglishAuction.sol` implements the classic open bidding auction. Users can place higher bids while the auction is active. When a new highest bid is placed, the previous highest bidder can withdraw their old bid from the contract.

After the auction ends, the auction can be finalized. If the highest bid reaches the reserve price, the NFT goes to the winner and the seller receives the payment. If the auction does not reach the reserve price, the NFT is returned to the seller.

4. **DutchAuction.sol**

`DutchAuction.sol` implements a decreasing price auction. The seller chooses a start price, reserve price, and duration. The price decreases over time until it reaches the reserve price.

A buyer can buy the item at the current price. Once that happens, the auction is finalized and no more bids are accepted.

5. **VickreyAuction.sol**

`VickreyAuction.sol` implements a sealed-bid second-price auction using commit-reveal.

During the commit phase, bidders submit only a hash of their bid amount and secret, together with a deposit. During the reveal phase, they reveal the original bid amount and secret. The contract checks that the reveal matches the original commitment and that the deposit is large enough.

The highest valid bidder wins, but the final price is based on the second-highest valid bid, or the reserve price if the second bid is lower than the reserve. Invalid reveals are blocked for that auction.

6. **AuctionNFT.sol**

`AuctionNFT.sol` is a simple ERC721 NFT contract used by the app for creating platform NFTs. It is useful for demos and for users who want to create an NFT-backed item directly in ChainBid.

The NFT metadata points to IPFS, where the item title, description, images, and attributes are stored.

7. **AuctionItem.sol**

`AuctionItem.sol` contains the shared enums and structs used across the auction contracts. The enums define values such as the NFT standard, asset type, auction type, and auction state. The main struct stores the auctioned item data, including the token contract, token ID, amount, and metadata URI.

### Frontend

The frontend is built with Next.js and React. 

Users can connect their wallet, create an NFT-backed item, upload metadata, create an auction, place bids, buy from Dutch auctions, commit and reveal Vickrey bids, finalize auctions, confirm physical item receipt, and withdraw refunds.

For blockchain communication, the frontend uses Wagmi and Viem through the Scaffold-ETH hooks.

RainbowKit is used for wallet connection, so users can connect with MetaMask or another supported wallet.

### Metadata Upload and Pinata

Images and metadata are stored off-chain on IPFS using Pinata.

The frontend sends the item title, description, asset type, category, and images to a Next.js API route:

```text
/api/pinata/upload
```

The route uploads the images to Pinata, creates a metadata JSON file, uploads that metadata file to Pinata, and returns the final IPFS metadata URI to the frontend.

The metadata URI is then used by the NFT and auction item, so the frontend can later display the item information and images.

### Sign-In With Ethereum

The Pinata upload endpoint is protected with Sign-In with Ethereum. Before a user can upload item metadata, they must sign a message with their wallet.

The backend verifies the signature and creates a session. After that, the user can call the upload endpoint.

We use this because the Pinata API key belongs to the server. Without authentication, anyone could call our upload endpoint and use our Pinata account. Wallet sign-in gives us a simple way to allow real connected users.

## Deployment Details

## Setup Instructions

### 1. Install dependencies

Install all project dependencies from the repository root:

```bash
yarn install
```

### 2. Configure environment variables

Create a `.env.local` file inside the Next.js package:

```text
packages/nextjs/.env.local
```

For local development, the most important variable is the Pinata JWT:

```env
PINATA_JWT=your_pinata_jwt_here
```

This is used by the backend upload route to upload images and metadata to IPFS through Pinata. The JWT must stay server-side and should not be exposed with a `NEXT_PUBLIC_` prefix.

For Sign-In with Ethereum sessions, you can also set:

```env
IRON_SESSION_SECRET=your_long_random_secret_here
```

If this is not set, the app can still run in development, but sessions may be reset when the server restarts.

Depending on the network and wallet configuration, the frontend can also use:

```env
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_key_here
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_walletconnect_project_id_here
```

These are used by Scaffold-ETH/RainbowKit for RPC access and wallet connection support.

### 3. Start a local blockchain

Run a local Ethereum network in the first terminal:

```bash
yarn chain
```

This starts a local blockchain for development and testing.

### 4. Deploy contracts locally

In a second terminal, deploy the smart contracts to the local network:

```bash
yarn deploy
```

This deploys the auction contracts, factory contract, and NFT contract. After deployment, Scaffold-ETH generates the contract addresses and ABIs for the frontend.

### 5. Start the frontend

In a third terminal, start the Next.js frontend:

```bash
yarn start
```

The app will be available at:

```text
http://localhost:3000
```

### 6. Run tests

Run the smart contract tests:

```bash
yarn test
```

Run tests with coverage:

```bash
yarn coverage
```

## Bonuses Implemented

### Hosted public frontend

The frontend is deployed on Vercel and is publicly available at:

```text
https://chain-bid.vercel.app
```

### Advanced testing

The smart contracts have more than 90% test coverage. The coverage report from `yarn coverage`:

```text
---------------------|----------|----------|----------|----------|----------------|
File                 |  % Stmts | % Branch |  % Funcs |  % Lines |Uncovered Lines |
---------------------|----------|----------|----------|----------|----------------|
 auctions/           |      100 |    91.67 |      100 |      100 |                |
  DutchAuction.sol   |      100 |    83.33 |      100 |      100 |                |
  EnglishAuction.sol |      100 |      100 |      100 |      100 |                |
  VickreyAuction.sol |      100 |    91.67 |      100 |      100 |                |
 base/               |    96.15 |    86.67 |       90 |    94.44 |                |
  BaseAuction.sol    |    96.15 |    86.67 |       90 |    94.44 |          43,44 |
 factory/            |      100 |    92.31 |      100 |      100 |                |
  AuctionFactory.sol |      100 |    92.31 |      100 |      100 |                |
 items/              |      100 |      100 |      100 |      100 |                |
  AuctionItem.sol    |      100 |      100 |      100 |      100 |                |
  AuctionNFT.sol     |      100 |      100 |      100 |      100 |                |
---------------------|----------|----------|----------|----------|----------------|
All files            |    99.42 |    90.63 |    97.92 |    99.07 |                |
---------------------|----------|----------|----------|----------|----------------|
```

## Known Limitations

The main limitation is that `AuctionNFT.sol` does not prove ownership of a real-world item. A user can mint an NFT with metadata for an item, for example a car or a collectible, but the contract cannot verify that the user actually owns that item outside the blockchain. In our project, this NFT is treated as a claim certificate, not as legal proof of ownership.

Another limitation is the physical item delivery flow. For physical auctions, the winner has to call `confirmReceived` after receiving the item. This releases the payment to the seller. Handling disputes, delivery fraud, legal ownership checks, or cases where the winner refuses to confirm receipt is outside the scope of this project.

## AI Usage

AI tools were used as assistance during development, mainly for frontend implementation and writing smart contract tests. The generated suggestions were reviewed, adapted, and integrated manually by the team.

## What We Learned

- Smart contract development in Solidity.
- ERC721 and ERC1155 NFT standards.
- IPFS and how NFT metadata is stored off-chain.
- How to structure auction logic on-chain.
- How the frontend communicates with smart contracts.

## Conclusion
