import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { LogIn } from "lucide-react";

const NotConnected = () => {
  return (
    <Alert className="max-w-lg mx-auto bg-orange-50 border border-orange-400 text-background">
      <LogIn className="h-4 w-4 mr-2" />
      <AlertTitle>Attention !</AlertTitle>
      <AlertDescription className="text-background">
        Veuillez vous connecter votre portefeuille pour accéder à cette fonctionnalité.
      </AlertDescription>
    </Alert>
  )
}

export default NotConnected