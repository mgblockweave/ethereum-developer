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

import {
  CONTRACT_ABI,
  CONTRACT_ADDRESS,
  ADMIN_ADDRESS,
} from "@/utils/constants";

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

  const [activeTab, setActiveTab] = useState<"encode" | "dashboard">("encode");

  const [form, setForm] = useState<CustomerForm>({
    firstName: "",
    lastName: "",
    walletAddress: "",
    homeAddress: "",
  });

  const [napoleons, setNapoleons] = useState<Napoleon[]>([
    { quantity: 1, weight: 6.45, quality: "" },
  ]);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);

  // Check admin
  const isAdmin =
    isConnected &&
    connectedAddress &&
    connectedAddress.toLowerCase() === ADMIN_ADDRESS.toLowerCase();

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
      setSuccess("Client enregistré et NFT minté avec succès ✅");

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

    // Build JSON payload for Supabase
    const offchainPayload = {
      customer: form,
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

    // Compute total gold amount
    const totalAmount = napoleons.reduce((acc, n) => acc + n.quantity, 0);

    // Call smart contract
    try {
      writeContract({
        abi: CONTRACT_ABI,
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: "registerCustomerAndMint",
        args: [
          form.walletAddress as `0x${string}`,
          supabaseIdBytes32,
          dataHash,
          BigInt(totalAmount),
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-2xl border p-5 shadow-sm bg-transparent">

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">
            Administration PatriDeFi
          </h1>
          <p className="text-sm text-muted-foreground">
            Encodage et vue globale des clients et napoléons.
          </p>
        </div>

        <div className="inline-flex gap-1 rounded-lg border bg-muted/30 p-1">
          <Button
            type="button"
            variant={activeTab === "encode" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("encode")}
          >
            Encodage
          </Button>
          <Button
            type="button"
            variant={activeTab === "dashboard" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("dashboard")}
          >
            Tableau clients
          </Button>
        </div>
      </div>

      {activeTab === "encode" && (
        <>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">
              Encodage client
            </h2>

            <p className="text-sm text-muted-foreground">
              Saisissez les informations du client ainsi que les pièces d’or.
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
            <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
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
            <div className="space-y-4 rounded-xl border bg-muted/30 p-4">

              <div className="flex justify-between">
                <h3 className="text-lg font-medium">Napoléons d’or</h3>
                <Button type="button" variant="outline" size="sm" onClick={handleAddNapoleon}>
                  Ajouter une ligne
                </Button>
              </div>

              {napoleons.map((nap, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 gap-3 rounded-lg border bg-background p-3 md:grid-cols-[1fr,1fr,2fr,auto]"
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
                    <Input
                      placeholder="TTB, SUP, FDC…"
                      value={nap.quality}
                      onChange={(e) =>
                        handleNapoleonChange(index, "quality", e.target.value)
                      }
                    />
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
        <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium">Clients enregistrés</h2>
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
                    className="rounded-lg border bg-background p-3 space-y-2"
                  >
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-0.5">
                        <p className="font-semibold">
                          {c.firstname} {c.lastname} — {c.wallet}
                        </p>
                        <p className="text-xs text-muted-foreground break-words">
                          {c.homeaddress}
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {napos.length} ligne(s) · {totalCoins} pièce(s)
                      </div>
                    </div>

                    {napos.length > 0 && (
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        {napos.map((n, idx) => (
                          <div
                            key={`${c.id}-${idx}`}
                            className="rounded-md border bg-muted/50 p-2 text-sm"
                          >
                            <div className="flex justify-between">
                              <span className="text-xs text-muted-foreground"># {idx + 1}</span>
                              <span className="text-xs">{n.quality}</span>
                            </div>
                            <div className="mt-1 font-medium">
                              {n.quantity} pcs · {n.weight} g
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
    </div>
  );
};
