import { motion } from "framer-motion";
import { Check, CreditCard, Loader2, Sparkles } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { KiteCharacter, CompanionCharacter } from "../../components/KiteCharacter";
import { SkyThemeSwatch } from "../../components/SkyThemeSwatch";

/**
 * Stripe Checkout status dialog. Lives outside the page render to keep the
 * Shop page lean. Close is disabled while polling so the user can't dismiss
 * mid-payment.
 */
const PurchasePreview = ({ character }) => {
  if (!character) return null;
  if (character.category === "companion") {
    return <CompanionCharacter companionId={character.character_id} size="medium" />;
  }
  if (character.category === "sky_theme") {
    return <SkyThemeSwatch themeId={character.character_id} size={64} />;
  }
  return <KiteCharacter characterId={character.character_id} size="small" rarity={character.rarity} />;
};

const StatusBlock = ({ status }) => {
  if (status === "polling") {
    return (
      <div className="flex flex-col items-center gap-3 text-sky-600" data-testid="purchase-status-polling">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm">Drifting through the clouds...</p>
      </div>
    );
  }
  if (status === "paid") {
    return (
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex flex-col items-center gap-3 text-emerald-600"
        data-testid="purchase-status-paid"
      >
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
          <Check className="w-7 h-7" />
        </div>
        <p className="text-sm font-medium">Payment complete</p>
      </motion.div>
    );
  }
  if (status === "failed") {
    return (
      <div className="flex flex-col items-center gap-3 text-amber-600" data-testid="purchase-status-failed">
        <Sparkles className="w-8 h-8" />
        <p className="text-sm">Something didn&apos;t go through. Please try again.</p>
      </div>
    );
  }
  return null;
};

/**
 * @param {{
 *   open: boolean,
 *   status: 'polling' | 'paid' | 'failed' | null,
 *   character: object | null,
 *   onClose: () => void,
 * }} props
 */
export const PurchaseDialog = ({ open, status, character, onClose }) => {
  const handleOpenChange = (next) => {
    if (!next && status !== "polling") onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="purchase-dialog">
        <DialogHeader>
          <DialogTitle className="text-sky-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-sky-500" />
            {status === "paid" ? "Your sky is yours" : "Preparing secure checkout"}
          </DialogTitle>
          <DialogDescription>
            {status === "paid"
              ? "We've added this to your collection."
              : "Apple Pay, Google Pay, Visa, and Mastercard accepted."}
          </DialogDescription>
        </DialogHeader>

        {character && (
          <div className="flex items-center gap-4 p-4 bg-sky-50/70 rounded-2xl my-2">
            <PurchasePreview character={character} />
            <div className="flex-1">
              <p className="font-semibold text-sky-900">{character.name}</p>
              <p className="text-sky-600 text-sm">{character.description}</p>
              <p className="text-sky-700 font-medium mt-1">${Number(character.price).toFixed(2)}</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-center py-6">
          <StatusBlock status={status} />
        </div>

        {status !== "polling" && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={onClose}
              className="rounded-full"
              data-testid="purchase-dialog-close"
            >
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
