'use client';
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { Alert, AlertDescription } from "../ui/alert";

type Napoleon = {
  quantity: number;
  weight: number;
  quality: string;
};

type Payload = {
  napoleons?: Napoleon[];
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [row, setRow] = useState<CustomerRow | null>(null);

  const napoleons = useMemo(() => row?.payload?.napoleons || [], [row]);

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
            throw new Error("Ce wallet n'est pas enregistré chez PatriDeFi.");
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
            {napoleons.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun napoléon encodé pour l’instant.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {napoleons.map((n, idx) => (
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
                      <p className="font-medium">{n.quality}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Index</p>
                      <p className="font-medium">#{idx + 1}</p>
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
