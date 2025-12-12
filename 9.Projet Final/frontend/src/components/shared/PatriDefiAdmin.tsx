"use client";

import { useState, useEffect, FormEvent } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";

import { keccak256, stringToBytes } from "viem";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Alert, AlertDescription } from "../ui/alert";

import { CONTRACT_ABI, CONTRACT_ADDRESS } from "@/utils/constants";
import { useReadContract } from "wagmi";

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

  // Utils
  const formatUsd = (raw?: string) => {
    if (!raw) return null;
    const n = Number(raw);
    if (Number.isNaN(n)) return raw;
    const usd = n / 1e8; // feed and pieceValue are en 1e8
    return `$${usd.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const qualityBpsMap: Record<string, number> = {
    TB: 8000,
    TTB: 9000,
    SUP: 9500,
    SPL: 9750,
    FDC: 10000,
  };

  const formatWeight = (
    pieceValue?: string,
    goldPrice?: string,
    quality?: string,
  ) => {
    if (!pieceValue || !goldPrice || !quality) return null;
    const bps = qualityBpsMap[quality] ?? null;
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
    abi: CONTRACT_ABI as any,
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

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
    });

  // Load customers list for admin view
  const fetchCustomers = async () => {
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
    } catch (err: any) {
      console.error(err);
      setListError(err.message);
    } finally {
      setListLoading(false);
    }
  };

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
    }
  }, [isConfirmed]);

  useEffect(() => {
    fetchCustomers();
  }, [isAdmin, activeTab]);

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
    } catch (err: any) {
      setSearchError(err.message || "Erreur lors de la recherche.");
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

    const weightsMg: bigint[] = [];
    const qualitiesArr: number[] = [];
    for (const n of napoleons) {
      const q = qualityMap[n.quality] ?? 0; // défaut: TB
      const wMg = BigInt(Math.round((n.weight || 0) * 1000)); // grammes -> mg
      for (let i = 0; i < (n.quantity || 0); i++) {
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
      writeContract({
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
    } catch (err: any) {
      console.error(err);
      setError("Erreur lors de l’envoi de la transaction.");
      return;
    }
  };

  const isSubmitting = isPending || isConfirming;

  if (!isAdmin)
    return (
      <div className="text-center text-red-600 font-semibold mt-12">
        Accès réservé à l'administrateur PatriDeFi.
      </div>
    );

  // --------------------------
  // RENDER COMPONENT UI
  // --------------------------

  return (
    <div className="absolute left-1/2 top-16 -translate-x-1/2 flex w-full max-w-3xl flex-col gap-4 rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5 shadow-xl backdrop-blur md:top-20">

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">
            Administration PatriDeFi
          </h1>

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
              Ajout des informations client et tokenisation des Napoléons d'or
            </h2>
            <p className="text-sm text-muted-foreground">
              Renseignez les informations sur le client et ses Napoléons d’or, puis déclenchez la tokenisation.
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

            {/* SUCCESS */}
            {success && (
              <Alert>
                <AlertDescription>{success}</AlertDescription>
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

            {/* TX HASH */}
            {txHash && (
              <p className="mt-2 text-xs break-all text-muted-foreground">
                Hash de transaction : {txHash}
              </p>
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

          {searchResult && (
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-3 flex flex-col gap-3 md:flex-row md:items-start">
              {searchResult.image && (
                <img
                  src={searchResult.image}
                  alt={searchResult.name || "Token image"}
                  className="h-32 w-32 rounded-md object-cover border"
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
          )}

        </div>
      )}
    </div>
  );
};
