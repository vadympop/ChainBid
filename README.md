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

Uses scaffold eth 2

## How to develop?

1. Run a local network in the first terminal:

```
yarn chain
```

This command starts a local Ethereum network that runs on your local machine and can be used for testing and development.

2. On a second terminal, deploy the test contract:

```
yarn deploy
```

This command deploys a test smart contract to the local network.

3. On a third terminal, start your NextJS app:

```
yarn start
```

Run tests:

```
yarn test
```

Run tests with coverage:

```
yarn coverage
```

Visit your app on: `http://localhost:3000`. You can interact with your smart contract using the `Debug Contracts` page. You can tweak the app config in `packages/nextjs/scaffold.config.ts`.
