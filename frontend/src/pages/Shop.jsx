import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import axios from "axios";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { useAuth, API, LoadingKite } from "../App";
import { toast } from "sonner";
import { ArrowLeft, Lock, Check, DollarSign, ExternalLink, Sparkles } from "lucide-react";
import { KiteCharacter } from "../components/KiteCharacter";

export default function ShopPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [purchaseDialog, setPurchaseDialog] = useState(false);
  const [purchaseInfo, setPurchaseInfo] = useState(null);

  useEffect(() => {
    const fetchCharacters = async () => {
      try {
        const response = await axios.get(`${API}/characters`, { withCredentials: true });
        setCharacters(response.data);
      } catch (error) {
        toast.error("Failed to load characters");
      } finally {
        setLoading(false);
      }
    };
    fetchCharacters();
  }, []);

  const handleEquip = async (characterId) => {
    try {
      await axios.post(`${API}/characters/equip`, { character_id: characterId }, { withCredentials: true });
      toast.success("Character equipped!");
      refreshUser();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to equip character");
    }
  };

  const handlePurchase = async (character) => {
    if (character.unlock_level > (user?.level || 1)) {
      toast.error(`Reach level ${character.unlock_level} to unlock this character!`);
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

  const cuteKites = characters.filter(c => c.category === 'cute_kite');
  const animalKites = characters.filter(c => c.category === 'animal_kite');

  if (loading) {
    return (
      <div className="min-h-screen sky-gradient flex items-center justify-center">
        <LoadingKite message="Loading shop..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen sky-gradient" data-testid="shop-page">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-white/50 sticky top-0 z-50">
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
          <h1 className="text-xl font-bold text-sky-600">Character Shop</h1>
          <div className="w-20"></div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Current Character */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 mb-8 flex items-center gap-6 max-w-2xl mx-auto"
        >
          <KiteCharacter characterId={user?.current_character || 'basic_kite'} size="medium" />
          <div>
            <p className="text-sky-500 text-sm">Currently Equipped</p>
            <p className="text-xl font-semibold text-sky-900 capitalize">
              {user?.current_character?.replace('_', ' ') || 'Basic Kite'}
            </p>
            <p className="text-sky-600 text-sm mt-1">
              Level {user?.level || 1} - {user?.owned_characters?.length || 1} characters owned
            </p>
          </div>
        </motion.div>

        {/* Cute Kites Section */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-sky-900 mb-4 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-yellow-500" />
            Cute Kites
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {cuteKites.map((character, index) => (
              <CharacterCard
                key={character.character_id}
                character={character}
                owned={user?.owned_characters?.includes(character.character_id)}
                equipped={user?.current_character === character.character_id}
                userLevel={user?.level || 1}
                onEquip={handleEquip}
                onPurchase={handlePurchase}
                index={index}
              />
            ))}
          </div>
        </section>

        {/* Animal Kites Section */}
        <section>
          <h2 className="text-2xl font-bold text-sky-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">🦋</span>
            Animal Kites
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {animalKites.map((character, index) => (
              <CharacterCard
                key={character.character_id}
                character={character}
                owned={user?.owned_characters?.includes(character.character_id)}
                equipped={user?.current_character === character.character_id}
                userLevel={user?.level || 1}
                onEquip={handleEquip}
                onPurchase={handlePurchase}
                index={index}
              />
            ))}
          </div>
        </section>
      </main>

      {/* Purchase Dialog */}
      <Dialog open={purchaseDialog} onOpenChange={setPurchaseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sky-900">Complete Your Purchase</DialogTitle>
            <DialogDescription>
              Send payment via CashApp to unlock this character
            </DialogDescription>
          </DialogHeader>
          
          {purchaseInfo && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4 p-4 bg-sky-50 rounded-2xl">
                <KiteCharacter characterId={purchaseInfo.character?.character_id} size="small" />
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
              
              <p className="text-sky-600 text-sm text-center">
                After sending payment, your character will be unlocked shortly.
              </p>
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

const CharacterCard = ({ character, owned, equipped, userLevel, onEquip, onPurchase, index }) => {
  const locked = character.unlock_level > userLevel;
  const isFree = character.price === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`glass-card p-4 relative ${owned ? 'ring-2 ring-green-400' : ''} ${locked ? 'opacity-70' : ''}`}
      data-testid={`character-card-${character.character_id}`}
    >
      {/* Status Badges */}
      {equipped && (
        <span className="absolute top-2 right-2 bg-sky-500 text-white text-xs px-2 py-1 rounded-full">
          Equipped
        </span>
      )}
      {owned && !equipped && (
        <span className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
          Owned
        </span>
      )}
      {locked && (
        <span className="absolute top-2 right-2 bg-gray-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
          <Lock className="w-3 h-3" />
          Lvl {character.unlock_level}
        </span>
      )}

      {/* Character Preview */}
      <div className="flex justify-center py-4">
        <KiteCharacter characterId={character.character_id} size="small" />
      </div>

      {/* Info */}
      <div className="text-center">
        <h3 className="font-semibold text-sky-900 text-sm">{character.name}</h3>
        <p className="text-sky-600 text-xs mt-1 line-clamp-2">{character.description}</p>
        
        {/* Price */}
        {!owned && (
          <p className="mt-2 font-bold text-sky-700">
            {isFree ? 'Free' : `$${character.price.toFixed(2)}`}
          </p>
        )}
      </div>

      {/* Action Button */}
      <div className="mt-3">
        {equipped ? (
          <Button disabled className="w-full rounded-full text-xs py-2" size="sm">
            <Check className="w-4 h-4 mr-1" />
            Equipped
          </Button>
        ) : owned ? (
          <Button
            onClick={() => onEquip(character.character_id)}
            className="w-full rounded-full bg-sky-500 hover:bg-sky-600 text-xs py-2"
            size="sm"
            data-testid={`equip-${character.character_id}`}
          >
            Equip
          </Button>
        ) : locked ? (
          <Button disabled className="w-full rounded-full text-xs py-2" size="sm">
            <Lock className="w-4 h-4 mr-1" />
            Locked
          </Button>
        ) : (
          <Button
            onClick={() => onPurchase(character)}
            className="w-full rounded-full bg-green-500 hover:bg-green-600 text-xs py-2"
            size="sm"
            data-testid={`purchase-${character.character_id}`}
          >
            <DollarSign className="w-4 h-4 mr-1" />
            {isFree ? 'Get Free' : 'Buy'}
          </Button>
        )}
      </div>
    </motion.div>
  );
};

export { ShopPage };
