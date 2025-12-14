'use client';
import NotConnected from "@/components/shared/NotConnected";
import PatriDefiHome from "@/components/shared/PatriDefiHome";
import { useAccount } from "wagmi";

export default function Home() {
  const { isConnected } = useAccount();

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-900 to-black text-white">
      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12 font-sans lg:px-10">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-900/40 px-4 py-2 text-sm font-medium text-emerald-200">
                Napoléons d’or tokenisés · Conservation sécurisée
              </div>
              <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
                PatriDeFi, plateforme de tokenisation des Napoléons d’or
              </h1>
              <p className="max-w-3xl text-base text-neutral-200">
                Capture, sécurise et valorise les positions physiques en Napoléons d’or.
                Les lots sont saisis par un administrateur, conservés en custody,
                et restent visibles avec leurs valeurs et caractéristiques. En partenariat
                avec Brink’s pour la conservation, nous accompagnons vos besoins de
                tokenisation premium. Contactez notre équipe pour étudier votre situation.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <FeatureCard title="Processus maîtrisé" description="Saisie centralisée par un administrateur ; chaque lot est consigné et conservé de façon sécurisée." />
                <FeatureCard title="Valeur et traçabilité" description="Poids, qualité et valeur initiale renseignés pour suivre vos Napoléons en toute transparence." />
                <FeatureCard title="Visibilité client" description="Espace dédié pour consulter les lots, la valeur totale et l’historique des positions." />
                <FeatureCard
                  title="Rôles et gouvernance"
                  description="Accès restreint aux administrateurs autorisés. L’administrateur détient les NFTs en custody pour les collatéraliser en PatriGold (ERC‑3643) et activer un rendement sur l’or tokenisé."
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
          {isConnected ? <PatriDefiHome /> : <NotConnected />}
        </section>
      </main>
    </div>
  );
}

type FeatureProps = { title: string; description: string };

const FeatureCard = ({ title, description }: FeatureProps) => (
  <div className="rounded-2xl border border-white/10 bg-black/50 p-4 shadow-sm">
    <p className="text-base font-semibold text-white">{title}</p>
    <p className="mt-1 text-sm text-neutral-300">{description}</p>
  </div>
);
