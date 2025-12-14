'use client';
import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { Alert, AlertDescription } from "../ui/alert";

type Napoleon = {
  quantity: number;
  weight: number;
  quality: string;
  initialPrice?: number;
  pieceValue?: number; // legacy
  goldPrice?: number;  // legacy
};

type Payload = {
  napoleons?: Napoleon[];
  tokens?: Array<{
    tokenId: string;
    pieceValue?: string;
    goldPrice?: string;
    quality?: string;
    amount?: string;
  }>;
};

type CustomerRow = {
  id: string;
  wallet: string;
  firstname?: string;
  lastname?: string;
  homeaddress?: string;
  payload: Payload;
};

const PatriDefiCustomer = () => {
  const { address, isConnected } = useAccount();
  const { data: totalOnChain } = useReadContract({
    abi: [
      {
        name: "totalPieceValue",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "wallet", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
      },
    ],
    address: process.env.NEXT_PUBLIC_PATRI_DEFI_ADDRESS as `0x${string}` | undefined,
    functionName: "totalPieceValue",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: Boolean(address && process.env.NEXT_PUBLIC_PATRI_DEFI_ADDRESS) },
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [row, setRow] = useState<CustomerRow | null>(null);

  const napoleons = useMemo(() => row?.payload?.napoleons || [], [row]);
  const tokens = useMemo(() => row?.payload?.tokens || [], [row]);

  const formatUsd = (raw?: string | number | bigint) => {
    if (raw === undefined || raw === null) return null;
    try {
      const big = BigInt(raw);
      const usd = Number(big) / 1e8; // valeurs en 1e8 (feed / pieceValue)
      return `$${usd.toLocaleString("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    } catch {
      return String(raw);
    }
  };

  const qualityLabel = (q: string) => {
    switch (q) {
      case "TB":
        return "TB (Très Bon)";
      case "TTB":
        return "TTB (Très Très Beau)";
      case "SUP":
        return "SUP (Superbe)";
      case "SPL":
        return "SPL (Splendide)";
      case "FDC":
        return "FDC (Fleur de Coin)";
      default:
        return q || "-";
    }
  };

  // Fetch data for connected wallet
  useEffect(() => {
    if (!address) return;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setUnauthorized(false);
      try {
        const res = await fetch(`/api/customers/${address}`);
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 404) {
            setUnauthorized(true);
            setRow(null);
            setError(null); // pas d'overlay pour un 404 attendu
            return;
          }
          throw new Error(data?.error || "Impossible de récupérer vos données.");
        }
        setRow(data.row as CustomerRow);
      } catch (err: any) {
        console.error(err);
        setRow(null);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [address]);

  if (!isConnected) {
    return (
      <div className="text-center text-sm text-muted-foreground">
        Connectez votre wallet pour voir vos informations PatriDeFi.
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="rounded-xl border bg-muted/30 p-4 text-sm text-red-600">
        Ce wallet n'est pas enregistré comme client PatriDeFi. Contactez l'administrateur.
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 rounded-2xl border bg-transparent p-6 shadow-sm">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Espace client PatriDeFi</h1>
        <p className="text-sm text-muted-foreground">
          Wallet connecté : <span className="font-mono break-all">{address}</span>
        </p>
      </div>

      {loading && (
        <Alert>
          <AlertDescription>Chargement de vos données...</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && !error && row && (
        <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
          <h2 className="text-lg font-medium">Vos informations</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Prénom</p>
              <p className="font-medium">{row?.firstname ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Nom</p>
              <p className="font-medium">{row?.lastname ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Adresse postale</p>
              <p className="font-medium break-words">
                {row?.homeaddress ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Wallet</p>
              <p className="font-mono text-sm break-all">
                {row.wallet}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-base font-semibold">Napoléons enregistrés</h3>
            {totalOnChain !== undefined && (
              <p className="text-sm text-muted-foreground mb-1">
                Valeur totale on-chain (tous lots) :{" "}
                <span className="font-medium">
                  {formatUsd(totalOnChain) ?? "-"}
                </span>
              </p>
            )}
            {tokens.length === 0 && napoleons.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun napoléon encodé pour l’instant.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {tokens.map((t, idx) => (
                  <div
                    key={`${t.tokenId}-${idx}`}
                    className="grid grid-cols-1 gap-2 rounded-lg border bg-background p-3 md:grid-cols-5"
                  >
                    <div>
                      <p className="text-xs text-muted-foreground">Token ID</p>
                      <p className="font-medium">#{t.tokenId}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Quantité</p>
                      <p className="font-medium">{t.amount ?? "1"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Qualité</p>
                      <p className="font-medium">
                        {qualityLabel(t.quality || "")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Prix initial (lot)</p>
                      <p className="font-medium">
                        {t.pieceValue && t.amount
                          ? formatUsd(
                              (BigInt(t.pieceValue) || BigInt(0)) *
                                (BigInt(t.amount) || BigInt(1))
                            )
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Prix feed</p>
                      <p className="font-medium">
                        {t.goldPrice ? formatUsd(t.goldPrice) : "-"}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Fallback affichage legacy si pas de tokens */}
                {tokens.length === 0 &&
                  napoleons.map((n, idx) => (
                    <div
                      key={`${n.quality}-${idx}`}
                      className="grid grid-cols-1 gap-2 rounded-lg border bg-background p-3 md:grid-cols-4"
                    >
                      <div>
                        <p className="text-xs text-muted-foreground">Quantité</p>
                        <p className="font-medium">{n.quantity}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Poids (g)</p>
                        <p className="font-medium">{n.weight}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Qualité</p>
                        <p className="font-medium">{qualityLabel(n.quality)}</p>
                      </div>
                      <div>
                      <p className="text-xs text-muted-foreground">Prix initial (lot)</p>
                      <p className="font-medium">
                        {n.initialPrice !== undefined
                          ? formatUsd(
                              BigInt(Math.round((n.initialPrice as number) * 1e8))
                            )
                          : n.pieceValue !== undefined
                          ? formatUsd(
                              BigInt(Math.round((n.pieceValue as number) * 1e8)) *
                                BigInt(n.quantity || 1)
                            )
                          : "-"}
                      </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && !error && !row && (
        <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
          Aucune fiche client trouvée pour ce wallet. Contactez l’administrateur
          pour l’enregistrement initial.
        </div>
      )}
    </div>
  );
};

export default PatriDefiCustomer;
