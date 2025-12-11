import { ponder } from "@/generated";

// Log basique des événements PatriDeFi
ponder.on("PatriDeFi:CustomerRegistered", async ({ event, context }) => {
  context.logger.info("CustomerRegistered", {
    wallet: event.args.wallet,
    supabaseId: event.args.supabaseId,
    dataHash: event.args.dataHash,
  });
});

ponder.on("PatriDeFi:CustomerUpdated", async ({ event, context }) => {
  context.logger.info("CustomerUpdated", {
    wallet: event.args.wallet,
    supabaseId: event.args.supabaseId,
    dataHash: event.args.dataHash,
  });
});

ponder.on("PatriDeFi:CustomerPositionCreated", async ({ event, context }) => {
  context.logger.info("CustomerPositionCreated", {
    wallet: event.args.wallet,
    tokenId: event.args.tokenId,
    amount: event.args.amount,
  });
});

// Log des mint ERC1155
ponder.on("Gold1155:GoldTokenMinted", async ({ event, context }) => {
  context.logger.info("GoldTokenMinted", {
    tokenId: event.args.tokenId,
    to: event.args.to,
    supabaseId: event.args.supabaseId,
    goldPrice: event.args.goldPrice,
    quality: event.args.quality,
    pieceValue: event.args.pieceValue,
  });
});
