import { createSchema } from "@ponder/core";

export default createSchema((p) => ({
  customers: p.createTable({
    id: p.string(), // wallet (primary key by default on id)
    supabaseId: p.string(),
    dataHash: p.string(),
  }),
  tokens: p.createTable({
    id: p.string(), // tokenId
    to: p.string(),
    supabaseId: p.string(),
    goldPrice: p.string(), // prix or (per ounce, feed decimals)
    quality: p.int(), // enum Quality (0..4)
    pieceValue: p.string(), // valeur calculée de la pièce
  }),
}));
