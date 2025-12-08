import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type CustomerForm = {
  firstName: string;
  lastName: string;
  walletAddress: string; // utilisé pour l'on-chain et la validation, mais non stocké dans payload
  homeAddress: string;
};

type Napoleon = {
  quantity: number;
  weight: number;
  quality: string;
};

type SupabaseRow = {
  id: string;
  wallet: string;
  firstname: string;
  lastname: string;
  homeaddress: string;
  payload: {
    napoleons?: Napoleon[];
    [key: string]: unknown;
  };
};

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return NextResponse.json(
      { error: "Supabase n'est pas configuré côté serveur." },
      { status: 500 }
    );
  }

  const { customer, napoleons }: { customer?: CustomerForm; napoleons?: Napoleon[] } =
    await req.json();

  if (!customer || !napoleons) {
    return NextResponse.json(
      { error: "Données manquantes pour créer le client." },
      { status: 400 }
    );
  }

  const { firstName, lastName, walletAddress, homeAddress } = customer;
  const normalizedWallet = walletAddress.toLowerCase();

  const hasMissingFields =
    !firstName?.trim() ||
    !lastName?.trim() ||
    !walletAddress?.trim() ||
    !homeAddress?.trim();

  if (hasMissingFields || !Array.isArray(napoleons) || napoleons.length === 0) {
    return NextResponse.json(
      { error: "Champs obligatoires manquants." },
      { status: 400 }
    );
  }

  const hasInvalidQuantity = napoleons.some(
    (n) => Number(n.quantity) < 1 || Number.isNaN(Number(n.quantity))
  );
  if (hasInvalidQuantity) {
    return NextResponse.json(
      { error: "La quantité de chaque Napoléon doit être au moins 1." },
      { status: 400 }
    );
  }

  // Normalise les napoléons et retire le wallet du payload stocké (le wallet est déjà une colonne dédiée)
  const sanitizedNapoleons = napoleons.map((n) => ({
    quantity: Number(n.quantity),
    weight: Number(n.weight) || 0,
    quality: n.quality ?? "",
  }));

  const { walletAddress: _omitWallet, ...customerWithoutWallet } = customer;

  // Vérifie s'il existe déjà une fiche pour ce wallet
  const { data: existing, error: fetchError } = await supabaseServer
    .from("customers")
    .select("id,payload,firstname,lastname,homeaddress")
    .eq("wallet", normalizedWallet)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    console.error("Supabase fetch error", fetchError);
    return NextResponse.json(
      { error: "Erreur Supabase lors de la vérification du client." },
      { status: 500 }
    );
  }

  if (existing) {
    const currentNapoleons = (existing.payload?.napoleons as Napoleon[] | undefined) || [];
    const mergedNapoleons = [...currentNapoleons, ...sanitizedNapoleons];

    const { data, error: updateError } = await supabaseServer
      .from("customers")
      .update({
        firstname: customer.firstName,
        lastname: customer.lastName,
        homeaddress: customer.homeAddress,
        payload: {
          ...(existing.payload || {}),
          napoleons: mergedNapoleons,
        },
      })
      .eq("wallet", normalizedWallet)
      .select("id,wallet,firstname,lastname,homeaddress,payload")
      .single();

    if (updateError) {
      console.error("Supabase update error", updateError);
      return NextResponse.json(
        { error: "Erreur Supabase lors de la mise à jour." },
        { status: 500 }
      );
    }

    return NextResponse.json({ row: data as SupabaseRow });
  }

  const { data, error: insertError } = await supabaseServer
    .from("customers")
    .insert({
      wallet: normalizedWallet,
      firstname: customer.firstName,
      lastname: customer.lastName,
      homeaddress: customer.homeAddress,
      payload: {
        napoleons: sanitizedNapoleons,
      },
    })
    .select("id,wallet,firstname,lastname,homeaddress,payload")
    .single();

  if (insertError) {
    console.error("Supabase insert error", insertError);
    return NextResponse.json(
      { error: "Erreur Supabase lors de l'insertion." },
      { status: 500 }
    );
  }

  return NextResponse.json({ row: data as SupabaseRow });
}

// Liste tous les clients pour l'admin
export async function GET() {
  const { data, error } = await supabaseServer
    .from("customers")
    .select("id,wallet,firstname,lastname,homeaddress,payload");

  if (error) {
    console.error("Supabase list error", error);
    return NextResponse.json(
      { error: "Erreur Supabase lors de la récupération des clients." },
      { status: 500 }
    );
  }

  return NextResponse.json({ rows: data as SupabaseRow[] });
}
