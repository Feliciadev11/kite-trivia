import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Heart, Palette, Wind } from "lucide-react";
import { toast } from "sonner";

import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useAuth, API, LoadingKite } from "../App";
import { AtmosphericBackground } from "../components/Atmosphere";
import { AudioControl } from "../components/AudioControl";
import { getStoreProducts, purchaseProduct } from "../lib/purchases";

import { EquippedSummary } from "./shop/EquippedSummary";
import { PurchaseDialog } from "./shop/PurchaseDialog";
import { ShopTabContent } from "./shop/ShopTabContent";

const TAB_TRIGGERS = [
  { value: "kites", label: "Kites", Icon: Wind },
  { value: "companions", label: "Companions", Icon: Heart },
  { value: "skies", label: "Skies", Icon: Palette },
];

export default function ShopPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("kites");
  const [purchaseInfo, setPurchaseInfo] = useState(null);
  const [purchaseDialog, setPurchaseDialog] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [isPremium, setIsPremium] = useState(false);

  const loadCharacters = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/characters`, { withCredentials: true });
     const charactersData = response?.data?.characters || response?.data;
     setCharacters(Array.isArray(charactersData) ? charactersData : []);
    } catch {
      toast.error("Failed to load shop items");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCharacters();
    (async () => {
      try {
        const response = await axios.get(`${API}/premium/status`, { withCredentials: true });
        setIsPremium(!!response.data?.is_premium);
      } catch {
        // leave isPremium false
      }
    })();
  }, [loadCharacters]);

  const itemsByCategory = useMemo(() => ({
    kites:      characters.filter(c => c.category === "kite"),
    companions: characters.filter(c => c.category === "companion"),
    skies:      characters.filter(c => c.category === "sky_theme"),
  }), [characters]);

  const handleEquip = useCallback(async (characterId, type) => {
    try {
      await axios.post(
        `${API}/characters/equip`,
        { character_id: characterId, type },
        { withCredentials: true }
      );
      toast.success(
        type === "kite" ? "Kite equipped!"
        : type === "companion" ? "Companion joined you!"
        : "Sky changed!"
      );
      refreshUser();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to equip");
    }
  }, [refreshUser]);

  const handlePurchase = useCallback(async (character) => {
    if (character.unlock_level > (user?.level || 1)) {
      toast.error(`Reach level ${character.unlock_level} to unlock this!`);
      return;
    }
    setPurchaseInfo({ character });
    setPurchaseDialog(true);
    setPaymentStatus("polling");

    try {
      if (Number(character.price) <= 0) {
        const { data } = await axios.post(
          `${API}/characters/claim`,
          { character_id: character.character_id },
          { withCredentials: true }
        );
        if (data.free && data.granted) {
          toast.success("Unlocked!");
          await refreshUser();
          await loadCharacters();
          setPurchaseDialog(false);
          setPaymentStatus(null);
        }
        return;
      }

      if (!character.product_id) {
        throw new Error("This item isn't available for purchase yet");
      }

      const { ok: productsOk, products, reason: productsReason } =
        await getStoreProducts([character.product_id]);
      const product = products?.[character.product_id];
      if (!productsOk || !product) {
        throw new Error(productsReason === "unavailable"
          ? "Available on iOS and Android"
          : "Could not load this item's price right now");
      }

      const result = await purchaseProduct(product);
      if (result.canceled) {
        setPurchaseDialog(false);
        setPaymentStatus(null);
        return;
      }
      if (!result.ok || !result.transactionId) {
        throw new Error(result.error || "Purchase couldn't complete");
      }

      const { data: syncData } = await axios.post(
        `${API}/characters/purchase/sync`,
        {
          character_id: character.character_id,
          product_id: character.product_id,
          transaction_id: result.transactionId,
        },
        { withCredentials: true }
      );
      if (!syncData.ok || !syncData.granted) {
        throw new Error("Purchase is still processing. Check back in a moment.");
      }

      setPaymentStatus("paid");
      toast.success("Item unlocked — welcome to your new sky!");
      await refreshUser();
      await loadCharacters();
      setTimeout(() => {
        setPurchaseDialog(false);
        setPaymentStatus(null);
      }, 1800);
    } catch (error) {
      setPaymentStatus("failed");
      toast.error(error.response?.data?.detail || error.message || "Failed to complete purchase");
    }
  }, [user?.level, refreshUser, loadCharacters]);

  const closePurchaseDialog = useCallback(() => {
    setPurchaseDialog(false);
    setPaymentStatus(null);
  }, [setPurchaseDialog, setPaymentStatus]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <AtmosphericBackground theme={user?.current_sky_theme || "dawn"} />
        <div className="relative z-10">
          <LoadingKite message="Opening shop..." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative" data-testid="shop-page">
      <AtmosphericBackground theme={user?.current_sky_theme || "dawn"} />

      <header className="bg-white/70 backdrop-blur-md border-b border-white/50 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={() => navigate("/dashboard")}
            data-testid="back-btn"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </Button>
          <h1 className="text-xl font-bold text-sky-600">Collection</h1>
          <AudioControl minimal />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 relative z-10">
        <EquippedSummary user={user} />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="max-w-5xl mx-auto">
          <TabsList className="grid w-full grid-cols-3 bg-white/60 backdrop-blur-sm rounded-full p-1 mb-6">
            {TAB_TRIGGERS.map(({ value, label, Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="rounded-full data-[state=active]:bg-sky-500 data-[state=active]:text-white"
              >
                <Icon className="w-4 h-4 mr-2" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {TAB_TRIGGERS.map(({ value }) => (
            <TabsContent key={value} value={value} className="mt-0">
              <ShopTabContent
                tabKey={value}
                items={itemsByCategory[value]}
                user={user}
                onEquip={handleEquip}
                onPurchase={handlePurchase}
                isPremium={isPremium}
              />
            </TabsContent>
          ))}
        </Tabs>
      </main>

      <PurchaseDialog
        open={purchaseDialog}
        status={paymentStatus}
        character={purchaseInfo?.character || null}
        onClose={closePurchaseDialog}
      />
    </div>
  );
}

export { ShopPage };
