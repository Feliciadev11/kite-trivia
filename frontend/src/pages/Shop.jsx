import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useAuth, API, LoadingKite } from "../App";
import { toast } from "sonner";
import { ArrowLeft, Lock, Check, DollarSign, ExternalLink, Sparkles, Wind, Palette, Heart } from "lucide-react";
import { KiteCharacter, CompanionCharacter } from "../components/KiteCharacter";
import { AtmosphericBackground } from "../components/Atmosphere";
import { AudioControl } from "../components/AudioControl";

const RARITY_COLORS = {
  common: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', badge: 'bg-slate-200 text-slate-700' },
  rare: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', badge: 'bg-blue-200 text-blue-700' },
  epic: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600', badge: 'bg-purple-200 text-purple-700' },
  legendary: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-600', badge: 'bg-amber-200 text-amber-700' },
};

export default function ShopPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchaseDialog, setPurchaseDialog] = useState(false);
  const [purchaseInfo, setPurchaseInfo] = useState(null);
  const [activeTab, setActiveTab] = useState('kites');

  useEffect(() => {
    const fetchCharacters = async () => {
      try {
        const response = await axios.get(`${API}/characters`, { withCredentials: true });
        setCharacters(response.data);
      } catch (error) {
        toast.error("Failed to load shop items");
      } finally {
        setLoading(false);
      }
    };
    fetchCharacters();
  }, []);

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

    try {
      const response = await axios.post(`${API}/characters/purchase`, 
        { character_id: character.character_id },
        { withCredentials: true }
      );
      setPurchaseInfo(response.data);
      setPurchaseDialog(true);
    } catch (error) {
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
                  return (
                    <div key={rarity} className="mb-8">
                      <h3 className="text-lg font-semibold text-sky-800 mb-4 flex items-center gap-2 capitalize">
                        {rarity === 'legendary' && <Sparkles className="w-5 h-5 text-amber-500" />}
                        {rarity} Kites
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                  return (
                    <div key={rarity} className="mb-8">
                      <h3 className="text-lg font-semibold text-sky-800 mb-4 flex items-center gap-2 capitalize">
                        {rarity === 'legendary' && <Sparkles className="w-5 h-5 text-amber-500" />}
                        {rarity} Companions
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                  return (
                    <div key={rarity} className="mb-8">
                      <h3 className="text-lg font-semibold text-sky-800 mb-4 flex items-center gap-2 capitalize">
                        {rarity === 'legendary' && <Sparkles className="w-5 h-5 text-amber-500" />}
                        {rarity} Sky Themes
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                    </div>
                  );
                })}
              </motion.div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </main>

      {/* Purchase Dialog */}
      <Dialog open={purchaseDialog} onOpenChange={setPurchaseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sky-900">Complete Your Purchase</DialogTitle>
            <DialogDescription>
              Send payment via CashApp to unlock this item
            </DialogDescription>
          </DialogHeader>
          
          {purchaseInfo && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4 p-4 bg-sky-50 rounded-2xl">
                {purchaseInfo.character?.category === 'companion' ? (
                  <CompanionCharacter companionId={purchaseInfo.character?.character_id} size="medium" />
                ) : purchaseInfo.character?.category === 'sky_theme' ? (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-sky-200 to-sky-100 flex items-center justify-center">
                    <Palette className="w-8 h-8 text-sky-500" />
                  </div>
                ) : (
                  <KiteCharacter characterId={purchaseInfo.character?.character_id} size="small" rarity={purchaseInfo.character?.rarity} />
                )}
                <div>
                  <p className="font-semibold text-sky-900">{purchaseInfo.character?.name}</p>
                  <p className="text-sky-600 text-sm">{purchaseInfo.character?.description}</p>
                </div>
              </div>
              
              <div className="bg-green-50 p-4 rounded-2xl text-center">
                <p className="text-green-700 font-medium mb-2">Send to CashApp:</p>
                <p className="text-2xl font-bold text-green-800">${purchaseInfo.cashapp_handle}</p>
                <p className="text-3xl font-bold text-green-900 mt-2">${purchaseInfo.amount?.toFixed(2)}</p>
              </div>
              
              <div className="bg-amber-50 p-4 rounded-2xl">
                <p className="text-amber-700 text-sm">
                  <strong>Important:</strong> Include this note with your payment:
                </p>
                <p className="font-mono text-amber-900 mt-1 text-sm break-all">
                  KITE-{purchaseInfo.purchase_id}
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPurchaseDialog(false)}
              className="rounded-full"
            >
              Cancel
            </Button>
            <Button
              className="rounded-full bg-green-500 hover:bg-green-600"
              onClick={() => {
                window.open(`https://cash.app/$${purchaseInfo?.cashapp_handle}`, '_blank');
              }}
              data-testid="open-cashapp-btn"
            >
              Open CashApp
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </DialogFooter>
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
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-sky-200 via-sky-100 to-white flex items-center justify-center shadow-inner">
            <Palette className="w-8 h-8 text-sky-500" />
          </div>
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
