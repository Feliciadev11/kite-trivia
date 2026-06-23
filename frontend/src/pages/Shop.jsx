import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useAuth, API, LoadingKite } from "../App";
import { toast } from "sonner";
import { ArrowLeft, Lock, Check, Sparkles, Wind, Palette, Heart, CreditCard, Loader2, DollarSign, Star } from "lucide-react";
import { KiteCharacter, CompanionCharacter } from "../components/KiteCharacter";
import { AtmosphericBackground } from "../components/Atmosphere";
import { SkyThemeSwatch } from "../components/SkyThemeSwatch";
import { AudioControl } from "../components/AudioControl";

// Mirror of backend PROGRESSIVE_GATES — used to render rarity-section headers
// with a "Unlocks at Level N" badge for items the player can't yet purchase.
// Backend remains source of truth for purchase enforcement.
const RARITY_GATES = {
  kite:       { common: 3,  rare: 8,  epic: 14, legendary: 20 },
  companion:  { common: 5,  rare: 10, epic: 16, legendary: 22 },
  sky_theme:  { common: 4,  rare: 9,  epic: 15, legendary: 20 },
};

const RARITY_COLORS = {
  common: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', badge: 'bg-slate-200 text-slate-700' },
  rare: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', badge: 'bg-blue-200 text-blue-700' },
  epic: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600', badge: 'bg-purple-200 text-purple-700' },
  legendary: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-600', badge: 'bg-amber-200 text-amber-700' },
};

export default function ShopPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, refreshUser } = useAuth();
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchaseDialog, setPurchaseDialog] = useState(false);
  const [purchaseInfo, setPurchaseInfo] = useState(null);
  const [activeTab, setActiveTab] = useState('kites');
  const [paymentStatus, setPaymentStatus] = useState(null); // 'polling' | 'paid' | 'failed' | null

  const loadCharacters = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/characters`, { withCredentials: true });
      setCharacters(response.data);
    } catch (error) {
      toast.error("Failed to load shop items");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

  // Stable refs to avoid re-running the polling effect when context callbacks
  // re-create on each render (refreshUser is not memoized by AuthProvider).
  const refreshUserRef = useRef(refreshUser);
  const loadCharactersRef = useRef(loadCharacters);
  useEffect(() => { refreshUserRef.current = refreshUser; }, [refreshUser]);
  useEffect(() => { loadCharactersRef.current = loadCharacters; }, [loadCharacters]);

  // Stripe polling on return from Checkout
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const canceled = searchParams.get('canceled');
    if (canceled) {
      toast.info("Payment canceled. Your sky stays as it was.");
      setSearchParams({}, { replace: true });
      return;
    }
    if (!sessionId) return;

    let attempts = 0;
    const maxAttempts = 8;
    const interval = 2000;
    setPurchaseDialog(true);
    setPaymentStatus('polling');

    const poll = async () => {
      try {
        const { data } = await axios.get(`${API}/payments/checkout/status/${sessionId}`, { withCredentials: true });
        if (data.payment_status === 'paid' || data.granted) {
          setPaymentStatus('paid');
          toast.success("Item unlocked — welcome to your new sky!");
          await refreshUserRef.current();
          await loadCharactersRef.current();
          setTimeout(() => {
            setPurchaseDialog(false);
            setPaymentStatus(null);
            setSearchParams({}, { replace: true });
          }, 1800);
          return;
        }
        if (data.status === 'expired') {
          setPaymentStatus('failed');
          toast.error("Payment session expired. Please try again.");
          return;
        }
        attempts += 1;
        if (attempts >= maxAttempts) {
          setPaymentStatus('failed');
          toast.error("Payment is still processing. Check back in a moment.");
          return;
        }
        setTimeout(poll, interval);
      } catch (e) {
        setPaymentStatus('failed');
        toast.error(e.response?.data?.detail || "Could not verify payment.");
      }
    };
    poll();
  }, [searchParams, setSearchParams]);

  const handleEquip = async (characterId, type = 'kite') => {
    try {
      await axios.post(`${API}/characters/equip`, { character_id: characterId, type }, { withCredentials: true });
      toast.success(type === 'kite' ? "Kite equipped!" : type === 'companion' ? "Companion joined you!" : "Sky changed!");
      refreshUser();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to equip");
    }
  };

  const handlePurchase = async (character) => {
    if (character.unlock_level > (user?.level || 1)) {
      toast.error(`Reach level ${character.unlock_level} to unlock this!`);
      return;
    }
    setPurchaseInfo({ character });
    setPurchaseDialog(true);
    setPaymentStatus('polling');

    try {
      const { data } = await axios.post(
        `${API}/characters/purchase`,
        {
          character_id: character.character_id,
          origin_url: window.location.origin,
        },
        { withCredentials: true }
      );
      if (data.free && data.granted) {
        toast.success("Unlocked!");
        await refreshUser();
        await loadCharacters();
        setPurchaseDialog(false);
        setPaymentStatus(null);
        return;
      }
      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
        return;
      }
      throw new Error("Could not start checkout");
    } catch (error) {
      setPurchaseDialog(false);
      setPaymentStatus(null);
      toast.error(error.response?.data?.detail || "Failed to start purchase");
    }
  };

  const kites = characters.filter(c => c.category === 'kite');
  const companions = characters.filter(c => c.category === 'companion');
  const skyThemes = characters.filter(c => c.category === 'sky_theme');

  // Sort by rarity order: common, rare, epic, legendary
  const rarityOrder = { common: 0, rare: 1, epic: 2, legendary: 3 };
  const sortByRarity = (items) => [...items].sort((a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <AtmosphericBackground theme={user?.current_sky_theme || 'dawn'} />
        <div className="relative z-10">
          <LoadingKite message="Opening shop..." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative" data-testid="shop-page">
      <AtmosphericBackground theme={user?.current_sky_theme || 'dawn'} />
      
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-md border-b border-white/50 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={() => navigate('/dashboard')}
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
        {/* Current Equipment */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 mb-8 max-w-3xl mx-auto"
        >
          <p className="text-sky-500 text-sm mb-4 text-center">Currently Equipped</p>
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <KiteCharacter characterId={user?.current_character || 'basic_kite'} size="medium" />
              <p className="text-sky-700 text-sm mt-2 capitalize">{user?.current_character?.replace(/_/g, ' ')}</p>
            </div>
            {user?.current_companion && (
              <div className="text-center">
                <CompanionCharacter companionId={user.current_companion} size="medium" />
                <p className="text-sky-700 text-sm mt-2 capitalize">{user.current_companion.replace(/_/g, ' ')}</p>
              </div>
            )}
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-sky-200 to-sky-100 flex items-center justify-center">
                <Palette className="w-8 h-8 text-sky-500" />
              </div>
              <p className="text-sky-700 text-sm mt-2 capitalize">{user?.current_sky_theme?.replace(/_/g, ' ') || 'Dawn'}</p>
            </div>
          </div>
        </motion.div>

        {/* Shop Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="max-w-5xl mx-auto">
          <TabsList className="grid w-full grid-cols-3 bg-white/60 backdrop-blur-sm rounded-full p-1 mb-6">
            <TabsTrigger value="kites" className="rounded-full data-[state=active]:bg-sky-500 data-[state=active]:text-white">
              <Wind className="w-4 h-4 mr-2" />
              Kites
            </TabsTrigger>
            <TabsTrigger value="companions" className="rounded-full data-[state=active]:bg-sky-500 data-[state=active]:text-white">
              <Heart className="w-4 h-4 mr-2" />
              Companions
            </TabsTrigger>
            <TabsTrigger value="skies" className="rounded-full data-[state=active]:bg-sky-500 data-[state=active]:text-white">
              <Palette className="w-4 h-4 mr-2" />
              Skies
            </TabsTrigger>
          </TabsList>

          <AnimatePresence>
            {/* Kites Tab */}
            <TabsContent value="kites" className="mt-0">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {['common', 'rare', 'epic', 'legendary'].map(rarity => {
                  const items = sortByRarity(kites).filter(k => k.rarity === rarity);
                  if (items.length === 0) return null;
                  const gate = RARITY_GATES.kite[rarity] || 0;
                  const locked = (user?.level || 1) < gate;
                  return (
                    <div key={rarity}>
                      <RaritySection
                        rarity={rarity}
                        items={items}
                        gateLevel={gate}
                        userLevel={user?.level || 1}
                      >
                        Kites
                      </RaritySection>
                      {!locked && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                          {items.map((item, index) => (
                            <ItemCard
                              key={item.character_id}
                              item={item}
                              owned={user?.owned_characters?.includes(item.character_id)}
                              equipped={user?.current_character === item.character_id}
                              userLevel={user?.level || 1}
                              onEquip={() => handleEquip(item.character_id, 'kite')}
                              onPurchase={() => handlePurchase(item)}
                              index={index}
                              type="kite"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </motion.div>
            </TabsContent>

            {/* Companions Tab */}
            <TabsContent value="companions" className="mt-0">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {['common', 'rare', 'epic', 'legendary'].map(rarity => {
                  const items = sortByRarity(companions).filter(k => k.rarity === rarity);
                  if (items.length === 0) return null;
                  const gate = RARITY_GATES.companion[rarity] || 0;
                  const locked = (user?.level || 1) < gate;
                  return (
                    <div key={rarity}>
                      <RaritySection
                        rarity={rarity}
                        items={items}
                        gateLevel={gate}
                        userLevel={user?.level || 1}
                      >
                        Companions
                      </RaritySection>
                      {!locked && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                          {items.map((item, index) => (
                            <ItemCard
                              key={item.character_id}
                              item={item}
                              owned={user?.owned_companions?.includes(item.character_id)}
                              equipped={user?.current_companion === item.character_id}
                              userLevel={user?.level || 1}
                              onEquip={() => handleEquip(item.character_id, 'companion')}
                              onPurchase={() => handlePurchase(item)}
                              index={index}
                              type="companion"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </motion.div>
            </TabsContent>

            {/* Sky Themes Tab */}
            <TabsContent value="skies" className="mt-0">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {['common', 'rare', 'epic', 'legendary'].map(rarity => {
                  const items = sortByRarity(skyThemes).filter(k => k.rarity === rarity);
                  if (items.length === 0) return null;
                  const gate = RARITY_GATES.sky_theme[rarity] || 0;
                  const locked = (user?.level || 1) < gate;
                  return (
                    <div key={rarity}>
                      <RaritySection
                        rarity={rarity}
                        items={items}
                        gateLevel={gate}
                        userLevel={user?.level || 1}
                      >
                        Sky Themes
                      </RaritySection>
                      {!locked && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                          {items.map((item, index) => (
                            <ItemCard
                              key={item.character_id}
                              item={item}
                              owned={user?.owned_sky_themes?.includes(item.character_id)}
                              equipped={user?.current_sky_theme === item.character_id}
                              userLevel={user?.level || 1}
                              onEquip={() => handleEquip(item.character_id, 'sky_theme')}
                              onPurchase={() => handlePurchase(item)}
                              index={index}
                              type="sky_theme"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </motion.div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </main>

      {/* Purchase Dialog — Stripe Checkout status */}
      <Dialog open={purchaseDialog} onOpenChange={(open) => {
        if (!open && paymentStatus !== 'polling') {
          setPurchaseDialog(false);
          setPaymentStatus(null);
        }
      }}>
        <DialogContent className="sm:max-w-md" data-testid="purchase-dialog">
          <DialogHeader>
            <DialogTitle className="text-sky-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-sky-500" />
              {paymentStatus === 'paid' ? "Your sky is yours" : "Preparing secure checkout"}
            </DialogTitle>
            <DialogDescription>
              {paymentStatus === 'paid'
                ? "We've added this to your collection."
                : "Apple Pay, Google Pay, Visa, and Mastercard accepted."}
            </DialogDescription>
          </DialogHeader>

          {purchaseInfo?.character && (
            <div className="flex items-center gap-4 p-4 bg-sky-50/70 rounded-2xl my-2">
              {purchaseInfo.character?.category === 'companion' ? (
                <CompanionCharacter companionId={purchaseInfo.character?.character_id} size="medium" />
              ) : purchaseInfo.character?.category === 'sky_theme' ? (
                <SkyThemeSwatch themeId={purchaseInfo.character?.character_id} size={64} />
              ) : (
                <KiteCharacter characterId={purchaseInfo.character?.character_id} size="small" rarity={purchaseInfo.character?.rarity} />
              )}
              <div className="flex-1">
                <p className="font-semibold text-sky-900">{purchaseInfo.character?.name}</p>
                <p className="text-sky-600 text-sm">{purchaseInfo.character?.description}</p>
                <p className="text-sky-700 font-medium mt-1">${Number(purchaseInfo.character?.price).toFixed(2)}</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center py-6">
            {paymentStatus === 'polling' && (
              <div className="flex flex-col items-center gap-3 text-sky-600" data-testid="purchase-status-polling">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-sm">Drifting through the clouds...</p>
              </div>
            )}
            {paymentStatus === 'paid' && (
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
            )}
            {paymentStatus === 'failed' && (
              <div className="flex flex-col items-center gap-3 text-amber-600" data-testid="purchase-status-failed">
                <Sparkles className="w-8 h-8" />
                <p className="text-sm">Something didn&apos;t go through. Please try again.</p>
              </div>
            )}
          </div>

          {paymentStatus !== 'polling' && (
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => { setPurchaseDialog(false); setPaymentStatus(null); }}
                className="rounded-full"
                data-testid="purchase-dialog-close"
              >
                Close
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const ItemCard = ({ item, owned, equipped, userLevel, onEquip, onPurchase, index, type }) => {
  const locked = item.unlock_level > userLevel;
  const isFree = item.price === 0;
  const rarity = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`glass-card p-4 relative ${rarity.bg} ${rarity.border} border ${owned ? 'ring-2 ring-green-400' : ''} ${locked ? 'opacity-60' : ''}`}
      data-testid={`item-card-${item.character_id}`}
    >
      {/* Rarity Badge */}
      <span className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full ${rarity.badge} capitalize`}>
        {item.rarity}
      </span>

      {/* Status Badges */}
      {equipped && (
        <span className="absolute top-2 right-2 bg-sky-500 text-white text-xs px-2 py-0.5 rounded-full">
          Active
        </span>
      )}
      {owned && !equipped && (
        <span className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
          Owned
        </span>
      )}
      {locked && !owned && (
        <span className="absolute top-2 right-2 bg-gray-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
          <Lock className="w-3 h-3" />
          Lvl {item.unlock_level}
        </span>
      )}

      {/* Item Preview */}
      <div className="flex justify-center py-6 mt-4">
        {type === 'companion' ? (
          <CompanionCharacter companionId={item.character_id} size="medium" />
        ) : type === 'sky_theme' ? (
          <SkyThemeSwatch themeId={item.character_id} size={80} />
        ) : (
          <KiteCharacter characterId={item.character_id} size="small" rarity={item.rarity} />
        )}
      </div>

      {/* Info */}
      <div className="text-center">
        <h3 className="font-semibold text-sky-900 text-sm">{item.name}</h3>
        <p className="text-sky-600 text-xs mt-1 line-clamp-2 h-8">{item.description}</p>
        
        {/* Price */}
        {!owned && (
          <p className={`mt-2 font-bold ${rarity.text}`}>
            {isFree ? 'Free' : `$${item.price.toFixed(2)}`}
          </p>
        )}
      </div>

      {/* Action Button */}
      <div className="mt-3">
        {equipped ? (
          <Button disabled className="w-full rounded-full text-xs py-2" size="sm">
            <Check className="w-4 h-4 mr-1" />
            Active
          </Button>
        ) : owned ? (
          <Button
            onClick={onEquip}
            className="w-full rounded-full bg-sky-500 hover:bg-sky-600 text-xs py-2"
            size="sm"
          >
            Use
          </Button>
        ) : locked ? (
          <Button disabled className="w-full rounded-full text-xs py-2" size="sm">
            <Lock className="w-4 h-4 mr-1" />
            Locked
          </Button>
        ) : (
          <Button
            onClick={onPurchase}
            className={`w-full rounded-full text-xs py-2 ${item.rarity === 'legendary' ? 'bg-amber-500 hover:bg-amber-600' : item.rarity === 'epic' ? 'bg-purple-500 hover:bg-purple-600' : 'bg-green-500 hover:bg-green-600'}`}
            size="sm"
          >
            <DollarSign className="w-4 h-4 mr-1" />
            {isFree ? 'Get' : 'Buy'}
          </Button>
        )}
      </div>
    </motion.div>
  );
};

export { ShopPage };

const RaritySection = ({ rarity, items, gateLevel, userLevel, children, accent }) => {
  if (!items || items.length === 0) return null;
  const locked = userLevel < gateLevel;
  const justUnlocked = userLevel === gateLevel;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`mb-10 ${locked ? 'opacity-70' : ''}`}
      data-testid={`rarity-section-${rarity}`}
    >
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/40">
        <h3 className="text-lg font-semibold text-sky-800 flex items-center gap-2 capitalize">
          {rarity === 'legendary' && <Sparkles className="w-5 h-5 text-amber-500" />}
          {rarity === 'epic' && <Star className="w-5 h-5 text-violet-500" />}
          {rarity} {children}
        </h3>
        {locked ? (
          <motion.span
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-xs text-sky-500 bg-white/70 px-3 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-sm"
            data-testid={`rarity-gate-${rarity}`}
          >
            <Lock className="w-3 h-3" />
            Unlocks at Level {gateLevel}
          </motion.span>
        ) : justUnlocked ? (
          <motion.span
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-xs text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full flex items-center gap-1.5"
            data-testid={`rarity-newly-unlocked-${rarity}`}
          >
            <Sparkles className="w-3 h-3" />
            Newly available
          </motion.span>
        ) : (
          <span className={`text-xs px-3 py-1 rounded-full ${accent || 'bg-white/40 text-sky-600'}`}>
            {items.length} item{items.length === 1 ? '' : 's'}
          </span>
        )}
      </div>
      {locked && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-sky-600/70 mb-4 italic"
        >
          {items.length} item{items.length === 1 ? '' : 's'} waiting in the clouds — keep playing to discover them.
        </motion.p>
      )}
    </motion.div>
  );
};

export { RaritySection };
