import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type Napoleon = {
  quantity: number;
  weight: number;
  quality: string;
  initialPrice?: number;
};

type Payload = {
  napoleons?: Napoleon[];
  [key: string]: unknown;
};


export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  const awaited = await params;
  const fromParams = awaited?.wallet;
  const fromQuery = req.nextUrl.searchParams.get("wallet");
  const fromPath = req.nextUrl.pathname.split("/").pop();
  const wallet = (fromParams || fromQuery || fromPath || "").toLowerCase().trim();

  if (!wallet) {
    return NextResponse.json(
      { error: "Wallet manquant dans l'URL." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseServer
    .from("customers")
    .select("id,wallet,firstname,lastname,homeaddress,payload")
    .ilike("wallet", wallet)
    .single();

  if (error) {
    if (error.code === "PGRST116" /* no rows */) {
      return NextResponse.json({ error: "Aucun client trouvé." }, { status: 404 });
    }
    console.error("Supabase GET error", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du client." },
      { status: 500 }
    );
  }

  return NextResponse.json({ row: data });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  const awaited = await params;
  const fromParams = awaited?.wallet;
  const fromQuery = req.nextUrl.searchParams.get("wallet");
  const fromPath = req.nextUrl.pathname.split("/").pop();
  const wallet = (fromParams || fromQuery || fromPath || "").toLowerCase().trim();

  if (!wallet) {
    return NextResponse.json(
      { error: "Wallet manquant dans l'URL." },
      { status: 400 }
    );
  }

  const body = await req.json();
  const incomingNapoleons: Napoleon[] | undefined = body?.napoleons;
  const incomingCustomer = body?.customer;

  if (!incomingNapoleons || !Array.isArray(incomingNapoleons)) {
    return NextResponse.json(
      { error: "Liste de Napoléons invalide." },
      { status: 400 }
    );
  }

  const sanitizeList = (list: Napoleon[]) =>
    list.map((n) => ({
      quantity: Number(n.quantity),
      weight: Number(n.weight) || 0,
      quality: n.quality ?? "",
      initialPrice:
        n.initialPrice !== undefined && !Number.isNaN(Number(n.initialPrice))
          ? Number(n.initialPrice)
          : undefined,
    }));

  const sanitizedNapoleons = sanitizeList(incomingNapoleons);

  const hasInvalidQuantity = sanitizedNapoleons.some(
    (n) => Number(n.quantity) < 1 || Number.isNaN(Number(n.quantity))
  );
  if (hasInvalidQuantity) {
    return NextResponse.json(
      { error: "La quantité de chaque Napoléon doit être au moins 1." },
      { status: 400 }
    );
  }

  // Récupère l'existant pour fusionner proprement
  const { data: existing, error: fetchError } = await supabaseServer
    .from("customers")
    .select("id,payload,firstname,lastname,homeaddress,wallet")
    .ilike("wallet", wallet)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      return NextResponse.json({ error: "Client inexistant." }, { status: 404 });
    }
    console.error("Supabase fetch for update error", fetchError);
    return NextResponse.json(
      { error: "Erreur lors de la lecture du client." },
      { status: 500 }
    );
  }

  const currentPayload: Payload = (existing?.payload as Payload) || {};
  const existingNapoleonsRaw = Array.isArray(currentPayload.napoleons)
    ? (currentPayload.napoleons as Napoleon[])
    : [];
  const existingNapoleons = sanitizeList(existingNapoleonsRaw);

  // Remplace par les lots fournis (évite les doublons)
  const mergedNapoleons = sanitizedNapoleons.length
    ? sanitizedNapoleons
    : existingNapoleons;

  const updatedPayload: Payload = {
    ...currentPayload,
    napoleons: mergedNapoleons,
  };
  // Supprime toute trace de tokens dans l'ancien payload
  delete (updatedPayload as any).tokens;

  const { data, error: updateError } = await supabaseServer
    .from("customers")
    .update({
      firstname: incomingCustomer?.firstName ?? existing?.firstname,
      lastname: incomingCustomer?.lastName ?? existing?.lastname,
      homeaddress: incomingCustomer?.homeAddress ?? existing?.homeaddress,
      payload: updatedPayload,
      wallet, // force stockage en minuscule pour normaliser
    })
    .ilike("wallet", wallet)
    .select("id,wallet,firstname,lastname,homeaddress,payload")
    .single();

  if (updateError) {
    console.error("Supabase update error", updateError);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour des Napoléons." },
      { status: 500 }
    );
  }

  return NextResponse.json({ row: data });
}
/* eslint-disable @typescript-eslint/no-explicit-any */
