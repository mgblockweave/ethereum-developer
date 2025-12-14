"use client";

import { useState, useEffect, FormEvent, useCallback } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";

import { keccak256, stringToBytes, decodeEventLog, createPublicClient, http, type Abi } from "viem";

import Image from "next/image";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Alert, AlertDescription } from "../ui/alert";

import { CONTRACT_ABI, CONTRACT_ADDRESS, PATRI_D_NFT_ADDRESS } from "@/utils/constants";
import { useReadContract } from "wagmi";

const QUALITY_BPS_MAP: Record<string, number> = {
  TB: 8000,
  TTB: 9000,
  SUP: 9500,
  SPL: 9750,
  FDC: 10000,
};

const MG_PER_OUNCE = 31103; // 31.103 g exprimés en mg

const GOLD_TOKEN_MINTED_EVENT = {
  type: "event",
  name: "GoldTokenMinted",
  inputs: [
    { name: "tokenId", type: "uint256", indexed: true },
    { name: "to", type: "address", indexed: true },
    { name: "supabaseId", type: "bytes32", indexed: true },
    { name: "goldPrice", type: "uint256", indexed: false },
    { name: "quality", type: "uint8", indexed: false },
    { name: "pieceValue", type: "uint256", indexed: false },
    { name: "amount", type: "uint256", indexed: false },
  ],
} as const satisfies Abi[number];

type CustomerForm = {
  firstName: string;
  lastName: string;
  walletAddress: string;
  homeAddress: string;
};

type Napoleon = {
  quantity: number;
  weight: number; // grams
  quality: string;
  initialPrice?: number;
};

type CustomerRow = {
  id: string;
  wallet: string;
  firstname: string;
  lastname: string;
  homeaddress: string;
  payload: {
    napoleons?: Napoleon[];
  };
};

export const PatriDefiAdmin = () => {
  const { address: connectedAddress, isConnected } = useAccount();

  const [activeTab, setActiveTab] = useState<
    "encode" | "dashboard" | "search"
  >("encode");

  const [form, setForm] = useState<CustomerForm>({
    firstName: "",
    lastName: "",
    walletAddress: "",
    homeAddress: "",
  });

  const [napoleons, setNapoleons] = useState<Napoleon[]>([
    { quantity: 1, weight: 6.45, quality: "" },
  ]);
  // Qualités usuelles pour les Napoléons : TB (Très Bon), TTB (Très Très Beau), SUP (Superbe), SPL (Splendide), FDC (Fleur de Coin)
  const qualityOptions = ["TB", "TTB", "SUP", "SPL", "FDC"];

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [pendingNapoleons, setPendingNapoleons] = useState<Napoleon[]>([]);
  const [totalsMap, setTotalsMap] = useState<Record<string, bigint>>({});

  // Token lookup (by tokenId or supabaseId)
  const [searchInput, setSearchInput] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<{
    tokenId: string;
    name?: string;
    image?: string;
    goldPrice?: string;
    quality?: string;
    pieceValue?: string;
    amount?: string;
    uri?: string;
  } | null>(null);
  const SUCCESS_TIMEOUT_MS = 5000;
  const [lastWalletForTokens, setLastWalletForTokens] = useState<string | null>(null);

  // Utils
const formatUsd = (raw?: string | number | bigint) => {
  if (raw === undefined || raw === null) return null;
  try {
    const big = BigInt(raw);
    const usd = Number(big) / 1e8; // utilisé surtout pour l'affichage legacy
    return `$${usd.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  } catch {
    return String(raw);
  }
};

const mapContractError = (err: unknown) => {
  const msg = String((err as { shortMessage?: string; message?: string })?.shortMessage || (err as { message?: string })?.message || "");
  const entries: Record<string, string> = {
    "PatriDeFi: invalid wallet": "Adresse de wallet invalide.",
    "PatriDeFi: invalid Supabase id": "Supabase ID invalide.",
    "PatriDeFi: invalid data hash": "Hash des données invalide.",
    "PatriDeFi: no pieces": "Aucune pièce fournie.",
    "PatriDeFi: arrays mismatch": "Les tableaux poids/qualité ne correspondent pas.",
    "PatriDeFi: batch too large": "Nombre total de pièces limité à 100 par opération.",
    "PatriDeFi: weight too large": "Poids trop élevé pour une pièce.",
    "PatriDeFi: invalid weight": "Poids de pièce invalide.",
    "PatriDeFi: invalid quality": "Qualité de pièce invalide.",
    "PatriDeFi: piece value too high": "Valeur de pièce trop élevée.",
    "PatriDeFi: piece value too low": "Valeur de pièce trop faible.",
    "PatriDeFi: not admin": "Seuls les admins peuvent minter.",
    "EnforcedPause": "Le contrat est en pause.",
  };
  for (const [needle, friendly] of Object.entries(entries)) {
    if (msg.includes(needle)) return friendly;
  }
  return "Erreur lors de l’envoi de la transaction.";
};

  const formatWeight = (
    pieceValue?: string,
    goldPrice?: string,
    quality?: string,
  ) => {
    if (!pieceValue || !goldPrice || !quality) return null;
    const bps = QUALITY_BPS_MAP[quality] ?? null;
    if (!bps) return null;
    try {
      const pv = BigInt(pieceValue);
      const gp = BigInt(goldPrice);
      if (pv === BigInt(0) || gp === BigInt(0)) return null;
      // weightMg = pieceValue * 10000 * MG_PER_OUNCE / (goldPrice * bps)
      const MG_PER_OUNCE = BigInt(31103); // mg dans une once troy
      const numer = pv * BigInt(10000) * MG_PER_OUNCE;
      const denom = gp * BigInt(bps);
      if (denom === BigInt(0)) return null;
      const weightMg = numer / denom;
      const grams = Number(weightMg) / 1000;
      return `${grams.toLocaleString("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} g`;
    } catch {
      return null;
    }
  };

  // Check admin
  const { data: isAdminData } = useReadContract({
    abi: CONTRACT_ABI as Abi,
    address: CONTRACT_ADDRESS as `0x${string}`,
    functionName: "isAdmin",
    args: connectedAddress ? [connectedAddress as `0x${string}`] : undefined,
    query: {
      enabled: Boolean(connectedAddress),
    },
  });

  const isAdmin = Boolean(
    isConnected && connectedAddress && (isAdminData as boolean)
  );

  const {
    data: txHash,
    writeContract,
    isPending,
  } = useWriteContract();

  const {
    data: receipt,
    error: txError,
    isLoading: isConfirming,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
  });

  // Load customers list for admin view
  const fetchCustomers = useCallback(async () => {
    if (!isAdmin) return;
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch("/api/customers");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Impossible de charger les clients.");
      }
      setCustomers(data.rows as CustomerRow[]);
    } catch (err: unknown) {
      console.error(err);
      const message =
        err instanceof Error
          ? err.message
          : "Impossible de charger les clients.";
      setListError(message);
    } finally {
      setListLoading(false);
    }
  }, [isAdmin]);

  // Load totalPieceValue on-chain for each customer (lire directement le contrat)
  useEffect(() => {
    const loadTotals = async () => {
      try {
        if (!customers.length) {
          setTotalsMap({});
          return;
        }
        const rpcUrl =
          process.env.NEXT_PUBLIC_HARDHAT_RPC_URL ||
          process.env.NEXT_PUBLIC_RPC_URL ||
          process.env.NEXT_PUBLIC_INFURA_API_KEY ||
          "";
        if (!rpcUrl || !CONTRACT_ADDRESS) return;
        const client = createPublicClient({
          transport: http(rpcUrl),
        });
        const abiTotal = [
          {
            name: "totalPieceValue",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "wallet", type: "address" }],
            outputs: [{ name: "", type: "uint256" }],
          },
        ] as const;

        const entries: Record<string, bigint> = {};
        for (const c of customers) {
          try {
            const val = (await client.readContract({
              address: CONTRACT_ADDRESS as `0x${string}`,
              abi: abiTotal,
              functionName: "totalPieceValue",
              args: [c.wallet as `0x${string}`],
            })) as bigint;
            entries[c.wallet.toLowerCase()] = val;
          } catch {
            // ignore errors per wallet
          }
        }
        setTotalsMap(entries);
      } catch (err) {
        console.error("Failed to load totalPieceValue", err);
      }
    };
    loadTotals();
  }, [customers]);

  // Reset UI after on-chain confirmation
  useEffect(() => {
    if (isConfirmed) {
      setSuccess("Client enregistré et NFT minté avec succès");

      setForm({
        firstName: "",
        lastName: "",
        walletAddress: "",
        homeAddress: "",
      });

      setNapoleons([{ quantity: 1, weight: 6.45, quality: "" }]);
      fetchCustomers();
      // auto-hide success after timeout
      const t = setTimeout(() => setSuccess(null), SUCCESS_TIMEOUT_MS);
      return () => clearTimeout(t);
    }
  }, [fetchCustomers, isConfirmed, receipt]);

  // Track tx errors / reverted status
  useEffect(() => {
    if (txError) {
      setError(mapContractError(txError));
      setSuccess(null);
    } else if (receipt && receipt.status === "reverted") {
      setError("La transaction a échoué (reverted).");
      setSuccess(null);
    }
  }, [txError, receipt]);

  // After confirmation: compute total minted value and push into payload (initialPrice)
  useEffect(() => {
    const pushInitialPrice = async () => {
      if (!isConfirmed || !receipt || !lastWalletForTokens) return;
      if (!pendingNapoleons.length) return;
      if (!PATRI_D_NFT_ADDRESS) return;

      try {
        const mintedPieceValues: bigint[] = [];
        let decodedGoldPrice: bigint | null = null;

        for (const log of receipt.logs || []) {
          if (
            log.address?.toLowerCase() !==
            (PATRI_D_NFT_ADDRESS as string).toLowerCase()
          ) {
            continue;
          }
          try {
            const decoded = decodeEventLog({
              abi: [GOLD_TOKEN_MINTED_EVENT],
              data: log.data as `0x${string}`,
              topics: [...(log.topics || [])] as [`0x${string}`, ...`0x${string}`[]],
            });
            if (decoded.eventName === "GoldTokenMinted") {
              const args = decoded.args as Record<string, unknown>;
              const pieceValue = BigInt((args.pieceValue as bigint | number | string | undefined) ?? 0);
              const amount = BigInt((args.amount as bigint | number | string | undefined) ?? 1);
              mintedPieceValues.push(pieceValue * amount); // amount=1 en pratique
              if (decodedGoldPrice === null && args.goldPrice !== undefined) {
                decodedGoldPrice = BigInt(args.goldPrice as bigint | number | string);
              }
            }
          } catch {
            // ignore decoding errors
          }
        }

        // Répartition des valeurs par lot (ordre des pièces = ordre des saisies).
        // Si on n'a pas de logs complets, on recalcule côté front avec goldPrice décodé.
        const perLotRaw: bigint[] = [];
        if (mintedPieceValues.length >= pendingNapoleons.reduce((acc, n) => acc + (Number(n.quantity) || 0), 0)) {
          let cursor = 0;
          for (const n of pendingNapoleons) {
            const qty = Number(n.quantity) || 0;
            let sum = BigInt(0);
            for (let i = 0; i < qty && cursor < mintedPieceValues.length; i++) {
              sum += mintedPieceValues[cursor];
              cursor += 1;
            }
            perLotRaw.push(sum);
          }
        } else if (decodedGoldPrice !== null) {
          for (const n of pendingNapoleons) {
            const qty = BigInt(Number(n.quantity) || 0);
            const wMg = BigInt(Math.round((n.weight || 0) * 1000));
            const bps = BigInt(QUALITY_BPS_MAP[n.quality] ?? QUALITY_BPS_MAP["TB"]);
            const pieceVal = (decodedGoldPrice * wMg * bps) / (10000n * BigInt(MG_PER_OUNCE));
            perLotRaw.push(pieceVal * qty);
          }
        }

        const totalValueRaw =
          perLotRaw.length > 0
            ? perLotRaw.reduce((acc, v) => acc + v, BigInt(0))
            : mintedPieceValues.reduce((acc, v) => acc + v, BigInt(0));

        // Arrondi au centime directement en entier (évite les flottants)
        const toDollars = (raw: bigint | undefined) => {
          if (raw === undefined) return undefined;
          const cents = (raw * 100n + 50_000_000n) / 100_000_000n; // arrondi
          return Number(cents) / 100;
        };

        await fetch(`/api/customers/${lastWalletForTokens}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            napoleons: pendingNapoleons.map((n, idx) => ({
              ...n,
              initialPrice:
                perLotRaw[idx] !== undefined
                  ? toDollars(perLotRaw[idx])
                  : undefined,
            })),
            initialPrice:
              totalValueRaw === BigInt(0)
                ? undefined
                : toDollars(totalValueRaw),
          }),
        });
        fetchCustomers();
        setPendingNapoleons([]);
      } catch (err) {
        console.error("Sync initial price to Supabase failed", err);
      }
    };
    pushInitialPrice();
  }, [fetchCustomers, isConfirmed, lastWalletForTokens, napoleons, pendingNapoleons, receipt]);

  useEffect(() => {
    fetchCustomers();
  }, [isAdmin, activeTab, fetchCustomers]);

  // Handle input changes
  const handleChange = (field: keyof CustomerForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Handle Napoleon table changes
  const handleNapoleonChange = (
    index: number,
    field: keyof Napoleon,
    value: string
  ) => {
    setNapoleons((prev) =>
      prev.map((n, i) =>
        i === index
          ? {
              ...n,
              [field]:
                field === "quantity" || field === "weight"
                  ? Number(value) || 0
                  : value,
            }
          : n
      )
    );
  };

  const handleAddNapoleon = () => {
    setNapoleons((prev) => [
      ...prev,
      { quantity: 1, weight: 6.45, quality: "" },
    ]);
  };

  const handleRemoveNapoleon = (index: number) => {
    if (napoleons.length === 1) return;
    setNapoleons((prev) => prev.filter((_, i) => i !== index));
  };

  // --------------------------
  // TOKEN LOOKUP
  // --------------------------
  const handleSearch = async () => {
    setSearchError(null);
    setSearchResult(null);
    const value = searchInput.trim();
    if (!value) {
      setSearchError("Champ de recherche vide.");
      return;
    }

    setSearchLoading(true);
    try {
      if (!/^\d+$/.test(value)) {
        throw new Error("En mode tokenId, renseigne un nombre (ex: 1).");
      }
      const res = await fetch(`/api/metadata/${value}`);
      if (res.status === 404) {
        setSearchResult(null);
        throw new Error("Token introuvable.");
      }
      if (!res.ok) throw new Error("Impossible de récupérer la métadonnée");
      const meta = await res.json();

      const attrMap: Record<string, string> = {};
      if (Array.isArray(meta.attributes)) {
        for (const a of meta.attributes) {
          if (a?.trait_type && a?.value !== undefined) {
            attrMap[a.trait_type] = String(a.value);
          }
        }
      }

      setSearchResult({
        tokenId: value,
        name: meta.name,
        image: meta.image,
        goldPrice: attrMap["Gold Price (feed)"],
        quality: attrMap["Quality"],
        pieceValue: attrMap["Piece Value"],
        amount: attrMap["Amount"],
        uri: meta.external_url || undefined,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la recherche.";
      setSearchError(msg);
    } finally {
      setSearchLoading(false);
    }
  };


  // --------------------------
  // MAIN FORM SUBMISSION FLOW
  // --------------------------

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isAdmin) {
      setError("Seul l'administrateur peut encoder un client.");
      return;
    }

    if (!isConnected) {
      setError("Veuillez connecter votre wallet administrateur.");
      return;
    }

    // Basic front validations
    if (
      !form.firstName.trim() ||
      !form.lastName.trim() ||
      !form.walletAddress.trim() ||
      !form.homeAddress.trim()
    ) {
      setError("Tous les champs client sont obligatoires.");
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(form.walletAddress)) {
      setError("Adresse de wallet invalide.");
      return;
    }

    if (napoleons.some((n) => n.quantity <= 0 || !n.quality.trim())) {
      setError("Les champs des Napoléons doivent être remplis correctement.");
      return;
    }

    const normalizedWallet = form.walletAddress.toLowerCase();

    // Build JSON payload for Supabase (wallet stocké en minuscule)
    const offchainPayload = {
      customer: { ...form, walletAddress: normalizedWallet },
      napoleons,
    };

    // Empêche d'enregistrer le wallet admin comme client
    if (connectedAddress && normalizedWallet === connectedAddress.toLowerCase()) {
      setError("Le wallet administrateur ne peut pas être enregistré comme client.");
      return;
    }

    let supabaseUUID: string;
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(offchainPayload),
      });

      const data = await response.json();

      if (!response.ok || !data?.row?.id) {
        throw new Error(data?.error || "Supabase insertion failed");
      }

      supabaseUUID = data.row.id as string;
    } catch (err) {
      console.error(err);
      setError("Erreur Supabase: impossible d’enregistrer le client.");
      return;
    }

    // Compute hashes
    const supabaseIdBytes32 = keccak256(stringToBytes(supabaseUUID));
    const dataHash = keccak256(stringToBytes(JSON.stringify(offchainPayload)));

    // Construire les tableaux attendus par registerCustomerAndMintDetailed
    // weights en milligrammes, qualities en uint8 (0..4)
    const qualityMap: Record<string, number> = {
      TB: 0,
      TTB: 1,
      SUP: 2,
      SPL: 3,
      FDC: 4,
    };

    // Guard against insane quantities
    let totalPieces = 0;
    for (const n of napoleons) {
      const qty = Number(n.quantity) || 0;
      if (qty <= 0) {
        setError("Chaque lot doit avoir une quantité supérieure à 0.");
        return;
      }
      if (qty > 100) {
        setError("Quantité par lot limitée à 100 pièces.");
        return;
      }
      totalPieces += qty;
    }
    if (totalPieces > 100) {
      setError("Nombre total de pièces limité à 100 par opération.");
      return;
    }

    const weightsMg: bigint[] = [];
    const qualitiesArr: number[] = [];
    for (const n of napoleons) {
      const q = qualityMap[n.quality] ?? 0; // défaut: TB
      const wMg = BigInt(Math.round((n.weight || 0) * 1000)); // grammes -> mg
      const qty = Number(n.quantity) || 0;
      if (wMg <= 0) {
        setError("Le poids de chaque pièce doit être supérieur à 0.");
        return;
      }
      if (Number(n.weight) > 1000) {
        setError("Poids maximum par pièce: 1000 g.");
        return;
      }
      for (let i = 0; i < qty; i++) {
        weightsMg.push(wMg);
        qualitiesArr.push(q);
      }
    }

    if (weightsMg.length === 0 || qualitiesArr.length === 0) {
      setError("Aucune pièce saisie (quantités/poids/qualité).");
      return;
    }

    // Call smart contract
    const targetContract = CONTRACT_ADDRESS as `0x${string}`;
    if (
      !targetContract ||
      targetContract === "0x0000000000000000000000000000000000000000"
    ) {
      setError(
        "Adresse du contrat PatriDeFi non configurée (NEXT_PUBLIC_PATRI_DEFI_ADDRESS)."
      );
      return;
    }

    const recipient = normalizedWallet as `0x${string}`;

    try {
      setLastWalletForTokens(normalizedWallet);
      setPendingNapoleons(napoleons.map((n) => ({ ...n })));
      await writeContract({
        abi: CONTRACT_ABI,
        address: targetContract,
        functionName: "registerCustomerAndMintDetailed",
        args: [
          recipient,
          supabaseIdBytes32,
          dataHash,
          weightsMg,
          qualitiesArr,
        ],
      });
    } catch (err: unknown) {
      console.error(err);
      const friendly = mapContractError(err);
      // Cas fréquent : client déjà enregistré / require côté contrat
      if (friendly.includes("déjà") || friendly.includes("existe") || friendly === "Erreur lors de l’envoi de la transaction.") {
        setError("Ce client existe déjà on-chain : la base Supabase a été mise à jour mais aucun nouveau mint n’a été réalisé.");
      } else {
        setError(friendly);
      }
      return;
    }
  };

  const isSubmitting = isPending || isConfirming;

  // --------------------------
  // RENDER COMPONENT UI
  // --------------------------

  if (!isAdmin) {
    return (
      <div className="text-center text-red-600 font-semibold mt-12">
        Accès réservé à l&apos;administrateur PatriDeFi.
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4 rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5 shadow-xl backdrop-blur-sm">

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Administration PatriDeFi</h1>
        </div>

        <div className="inline-flex gap-1 rounded-lg border bg-muted/30 p-1">
          <Button
            type="button"
            variant={activeTab === "encode" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("encode")}
          >
            Ajouter un client
          </Button>
          <Button
            type="button"
            variant={activeTab === "dashboard" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("dashboard")}
          >
            Vue des clients
          </Button>
          <Button
            type="button"
            variant={activeTab === "search" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("search")}
          >
            Recherche token
          </Button>
        </div>
      </div>

      <div className="h-px w-full bg-border" />
      {activeTab === "encode" && (
        <>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">
              Ajout des informations client et tokenisation des Napoléons d&apos;or
            </h2>
            <p className="text-sm text-muted-foreground">
              Renseignez les informations sur le client et ses Napoléons d&apos;or, puis déclenchez la tokenisation.
            </p>
            {connectedAddress && (
              <p className="text-xs text-muted-foreground">
                Connecté en tant que :{" "}
                <span className="font-mono">{connectedAddress}</span>
              </p>
            )}
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* CLIENT INFO */}
            <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900/80 p-4">
              <h3 className="text-lg font-medium">Informations client</h3>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Prénom</Label>
                  <Input
                    placeholder="Jean"
                    value={form.firstName}
                    onChange={(e) => handleChange("firstName", e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label>Nom</Label>
                  <Input
                    placeholder="Dupont"
                    value={form.lastName}
                    onChange={(e) => handleChange("lastName", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Adresse du wallet</Label>
                <Input
                  placeholder="0x..."
                  value={form.walletAddress}
                  onChange={(e) => handleChange("walletAddress", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label>Adresse postale</Label>
                <Input
                  placeholder="Rue, numéro, ville, pays…"
                  value={form.homeAddress}
                  onChange={(e) => handleChange("homeAddress", e.target.value)}
                />
              </div>
            </div>

            {/* GOLD TABLE */}
            <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900/70 p-4">

              <div className="flex justify-between">
                <h3 className="text-lg font-medium">Napoléons d’or</h3>
                <Button type="button" variant="outline" size="sm" onClick={handleAddNapoleon}>
                  Ajouter un lot de pièces
                </Button>
              </div>

              {napoleons.map((nap, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 p-3 md:grid-cols-[1fr,1fr,2fr,auto]"
                >
                  <div className="space-y-1">
                    <Label>Quantité</Label>
                    <Input
                      type="number"
                      value={nap.quantity}
                      onChange={(e) =>
                        handleNapoleonChange(index, "quantity", e.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Poids (g)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={nap.weight}
                      onChange={(e) =>
                        handleNapoleonChange(index, "weight", e.target.value)
                      }
                    />
                  </div>

                <div className="space-y-1">
                  <Label>Qualité</Label>
                <select
                  className="h-10 w-full rounded-md border border-neutral-700 bg-neutral-900/60 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={nap.quality}
                  onChange={(e) =>
                    handleNapoleonChange(index, "quality", e.target.value)
                  }
                >
                    <option value="">Sélectionner</option>
                    {qualityOptions.map((q) => (
                      <option key={q} value={q}>
                        {q} (
                        {q === "TB"
                          ? "Très Bon"
                          : q === "TTB"
                          ? "Très Très Beau"
                          : q === "SUP"
                          ? "Superbe"
                          : q === "SPL"
                          ? "Splendide"
                          : "Fleur de Coin"}
                        )
                      </option>
                    ))}
                  </select>
                </div>

                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveNapoleon(index)}
                      disabled={napoleons.length === 1}
                      className="border-red-600 text-white font-bold hover:bg-red-600/10"
                    >
                      Supprimer
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* ERRORS */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* SUBMIT */}
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || !isConnected}
            >
              {isSubmitting
                ? "Transaction en cours..."
                : "Enregistrer le client et minter les NFTs"}
            </Button>

            {/* SUCCESS + TX HASH (bas) */}
            {success && txHash && isConfirmed && (
              <Alert className="border-green-500/60 bg-green-500/10 text-green-100">
                <AlertDescription className="flex flex-col gap-2">
                  {success || "Client enregistré et NFT minté avec succès."}
                  <span className="font-mono text-xs break-all">
                    Hash de transaction : {txHash}
                  </span>
                </AlertDescription>
              </Alert>
            )}
          </form>
        </>
      )}

      {activeTab === "dashboard" && (
            <div className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/80 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium">Clients enregistrés</h2>
              <p className="text-xs text-muted-foreground">
                Vue synthétique : identité, adresse postale, wallet et détail des pièces.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={fetchCustomers} disabled={listLoading}>
              {listLoading ? "Rafraîchissement..." : "Rafraîchir"}
            </Button>
          </div>

          {listError && (
            <Alert variant="destructive">
              <AlertDescription>{listError}</AlertDescription>
            </Alert>
          )}

          {!listError && customers.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun client pour l’instant.</p>
          )}

          {!listError && customers.length > 0 && (
            <div className="space-y-3">
              {customers.map((c) => {
                const napos = c.payload?.napoleons || [];
                const totalCoins = napos.reduce((acc, n) => acc + (n.quantity || 0), 0);
                const onChain = totalsMap[c.wallet.toLowerCase()];
                const sumPrice =
                  onChain !== undefined && onChain > 0n
                    ? onChain
                    : napos
                        .map((n) =>
                          n.initialPrice !== undefined
                            ? BigInt(Math.round((n.initialPrice as number) * 1e8))
                            : BigInt(0)
                        )
                        .reduce((acc, v) => acc + v, BigInt(0));
                return (
                <div
                  key={c.id}
                    className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3 space-y-2"
                  >
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-0.5">
                        <p className="font-semibold">
                          {c.firstname} {c.lastname}
                        </p>
                        <p className="text-xs text-muted-foreground break-words">
                          Wallet : {c.wallet}
                        </p>
                        <p className="text-xs text-muted-foreground break-words">
                          Adresse postale : {c.homeaddress}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Valeur totale client :{" "}
                          {sumPrice > 0n ? formatUsd(sumPrice) : "-"}
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground text-right">
                        <div>{napos.length} lot(s)</div>
                        <div>{totalCoins} pièce(s) au total</div>
                      </div>
                    </div>

                        {napos.length > 0 && (
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                            {napos.map((n, idx) => (
                          <div
                            key={`${c.id}-${idx}`}
                            className="rounded-md border bg-muted/50 p-2 text-sm"
                          >
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Lot #{idx + 1}</span>
                              <span>Qualité&nbsp;: {n.quality || "N/A"}</span>
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Quantité&nbsp;: {n.quantity} unité(s)
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Poids unitaire&nbsp;: {n.weight} g
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Prix total lot&nbsp;:{" "}
                              {n.initialPrice !== undefined
                                ? formatUsd(
                                    BigInt(Math.round((n.initialPrice as number) * 1e8))
                                  )
                                : "-"}
                            </div>
                          </div>
                        ))}
                          </div>
                        )}
                 </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "search" && (
        <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">Recherche de token</h2>
        <p className="text-xs text-muted-foreground">
          Rechercher un NFT par tokenId.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[200px,1fr,auto]">
        <div className="space-y-1">
          <Label>Token ID</Label>
          <Input
            placeholder="Ex: 1"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <div className="flex items-end">
          <Button type="button" onClick={handleSearch} disabled={searchLoading}>
            {searchLoading ? "Recherche..." : "Chercher"}
          </Button>
        </div>
      </div>

          {searchError && (
            <Alert variant="destructive">
              <AlertDescription>{searchError}</AlertDescription>
            </Alert>
          )}

          {searchResult ? (
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-3 flex flex-col gap-3 md:flex-row md:items-start">
              {searchResult.image && (
                <Image
                  src={searchResult.image}
                  alt={searchResult.name || "Token image"}
                  width={128}
                  height={128}
                  className="h-32 w-32 rounded-md object-cover border"
                  unoptimized
                />
              )}
              <div className="space-y-1 text-sm">
                <p className="font-semibold">{searchResult.name}</p>
                <p className="text-muted-foreground">Token ID : {searchResult.tokenId}</p>
                {searchResult.goldPrice && (
                  <p className="text-muted-foreground">
                    Gold price (feed) :{" "}
                    {formatUsd(searchResult.goldPrice) ?? searchResult.goldPrice}
                  </p>
                )}
                {searchResult.pieceValue && (
                  <p className="text-muted-foreground">
                    Piece value :{" "}
                    {formatUsd(searchResult.pieceValue) ??
                      searchResult.pieceValue}
                  </p>
                )}
                {formatWeight(
                  searchResult.pieceValue,
                  searchResult.goldPrice,
                  searchResult.quality,
                ) && (
                  <p className="text-muted-foreground">
                    Poids estimé :{" "}
                    {formatWeight(
                      searchResult.pieceValue,
                      searchResult.goldPrice,
                      searchResult.quality,
                    )}
                  </p>
                )}
                {searchResult.quality && (
                  <p className="text-muted-foreground">Qualité : {searchResult.quality}</p>
                )}
                {searchResult.amount && (
                  <p className="text-muted-foreground">Quantité : {searchResult.amount}</p>
                )}
                {searchResult.uri && (
                  <p className="text-muted-foreground break-all">
                    URI : {searchResult.uri}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <Alert variant="default">
              <AlertDescription>
                Entrez un token ID existant pour afficher ses informations. Aucune donnée trouvée.
              </AlertDescription>
            </Alert>
          )}

        </div>
      )}
    </div>
  );
};
