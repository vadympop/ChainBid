# Auctions dApp

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

Visit your app on: `http://localhost:3000`. You can interact with your smart contract using the `Debug Contracts` page. You can tweak the app config in `packages/nextjs/scaffold.config.ts`.
