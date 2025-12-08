import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type Napoleon = {
  quantity: number;
  weight: number;
  quality: string;
};

type Payload = {
  napoleons?: Napoleon[];
  [key: string]: unknown;
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  const { wallet: walletFromParams } = await params;
  const walletInput =
    walletFromParams ||
    req.nextUrl.searchParams.get("wallet") ||
    ""; // fallback if Next params is unexpectedly empty
  const wallet = walletInput.toLowerCase();

  if (!wallet || typeof wallet !== "string") {
    return NextResponse.json(
      { error: "Wallet manquant dans l'URL." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseServer
    .from("customers")
    .select("id,wallet,firstname,lastname,homeaddress,payload")
    .eq("wallet", wallet)
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
  const { wallet: walletFromParams } = await params;
  const walletInput =
    walletFromParams ||
    req.nextUrl.searchParams.get("wallet") ||
    ""; // fallback if Next params is unexpectedly empty
  const wallet = walletInput.toLowerCase();

  if (!wallet || typeof wallet !== "string") {
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

  const sanitizedNapoleons = incomingNapoleons.map((n) => ({
    quantity: Number(n.quantity),
    weight: Number(n.weight) || 0,
    quality: n.quality ?? "",
  }));

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
    .select("id,payload,firstname,lastname,homeaddress")
    .eq("wallet", wallet)
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

  const updatedPayload: Payload = {
    ...currentPayload,
    napoleons: sanitizedNapoleons,
  };

  const { data, error: updateError } = await supabaseServer
    .from("customers")
    .update({
      firstname: incomingCustomer?.firstName ?? existing?.firstname,
      lastname: incomingCustomer?.lastName ?? existing?.lastname,
      homeaddress: incomingCustomer?.homeAddress ?? existing?.homeaddress,
      payload: updatedPayload,
    })
    .eq("wallet", wallet)
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
