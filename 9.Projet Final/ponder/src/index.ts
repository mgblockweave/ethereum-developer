import { ponder } from "@/generated";

const toSafeString = (value: unknown) => String(value ?? "");

const getLogger = (context: any) => context?.logger ?? console;
// Helper to avoid TS type explosion on ponder.on
type KnownEvent =
  | "PatriDeFi:CustomerRegistered"
  | "PatriDeFi:CustomerUpdated"
  | "PatriDeFi:CustomerPositionCreated"
  | "PatriDNft:GoldTokenMinted";
type IndexHandler = (args: { event: any; context: any }) => Promise<void> | void;
const on = (event: KnownEvent, handler: IndexHandler) =>
  (ponder as any).on(event, handler as any);

on("PatriDeFi:CustomerRegistered", async ({ event, context }) => {
  const logger = getLogger(context);
  const { wallet, supabaseId, dataHash } = event.args;
  const supabaseIdHex = toSafeString(supabaseId);
  const dataHashHex = toSafeString(dataHash);
  const customerData = {
    supabaseId: supabaseIdHex,
    dataHash: dataHashHex,
  };

  try {
    await context.db.customers.upsert({
      id: wallet.toLowerCase(),
      create: customerData,
      update: customerData,
    });
  } catch (err) {
    logger.error("customers.upsert failed", {
      wallet,
      supabaseId,
      dataHash,
      supabaseIdHex,
      dataHashHex,
      supabaseIdType: typeof supabaseId,
      dataHashType: typeof dataHash,
    });
    throw err;
  }

  logger.info("CustomerRegistered", { wallet, supabaseId: supabaseIdHex, dataHash: dataHashHex });
});

on("PatriDeFi:CustomerUpdated", async ({ event, context }) => {
  const logger = getLogger(context);
  const { wallet, supabaseId, dataHash } = event.args;
  const supabaseIdHex = toSafeString(supabaseId);
  const dataHashHex = toSafeString(dataHash);
  const customerData = {
    supabaseId: supabaseIdHex,
    dataHash: dataHashHex,
  };

  await context.db.customers.upsert({
    id: wallet.toLowerCase(),
    create: customerData,
    update: customerData,
  });

  logger.info("CustomerUpdated", { wallet, supabaseId: supabaseIdHex, dataHash: dataHashHex });
});

on("PatriDeFi:CustomerPositionCreated", async ({ event, context }) => {
  const logger = getLogger(context);
  const { wallet, tokenId, amount } = event.args;

  await context.db.tokens.upsert({
    id: tokenId.toString(),
    create: { to: wallet.toLowerCase() },
    update: { to: wallet.toLowerCase() },
  });

  logger.info("CustomerPositionCreated", { wallet, tokenId, amount });
});

on("PatriDNft:GoldTokenMinted", async ({ event, context }) => {
  const logger = getLogger(context);
  const { tokenId, to, supabaseId, goldPrice, quality, pieceValue } =
    event.args;
  const supabaseIdHex = toSafeString(supabaseId);
  const tokenData = {
    to: to.toLowerCase(),
    supabaseId: supabaseIdHex,
    goldPrice: goldPrice.toString(),
    quality: Number(quality),
    pieceValue: pieceValue.toString(),
  };

  await context.db.tokens.upsert({
    id: tokenId.toString(),
    create: tokenData,
    update: tokenData,
  });

  logger.info("GoldTokenMinted", {
    tokenId,
    to,
    supabaseId: supabaseIdHex,
    goldPrice,
    quality,
    pieceValue,
  });
});
