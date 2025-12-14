import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { LogIn } from "lucide-react";

const NotConnected = () => {
  return (
    <Alert className="max-w-lg mx-auto bg-neutral-900/80 border border-white/10 text-white">
      <LogIn className="h-4 w-4 mr-2" />
      <AlertTitle>Connexion requise</AlertTitle>
      <AlertDescription className="text-neutral-200">
        Administrateur ou client, connectez votre wallet (bouton en haut) pour accéder à votre
        espace PatriDeFi.
      </AlertDescription>
    </Alert>
  );
};

export default NotConnected
