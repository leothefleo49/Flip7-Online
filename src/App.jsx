import React, { useState, useEffect } from 'react';
import { 
  User, Users, Trash2, RotateCcw, Shuffle, Settings, 
  ShieldCheck, Plus, Trophy, X, AlertOctagon, Sparkles,
  ChevronRight, Edit2, Check, Snowflake, Hand, Crown, 
  AlertTriangle, Maximize, Minimize, LogOut, ArrowRight, Gamepad2
} from 'lucide-react';

// --- FIREBASE CONFIGURATION ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCV8cthZmuld7b8wJrO2YSLJlgbosAX968",
  authDomain: "flip7-online-2d0fc.firebaseapp.com",
  projectId: "flip7-online-2d0fc",
  storageBucket: "flip7-online-2d0fc.firebasestorage.app",
  messagingSenderId: "576916003695",
  appId: "1:576916003695:web:aa62f61a0b2e145602269a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- GAME CONSTANTS ---
const DECK = {
  'num_0': 1, 'num_1': 1, 'num_2': 2, 'num_3': 3, 'num_4': 4,
  'num_5': 5, 'num_6': 6, 'num_7': 7, 'num_8': 8, 'num_9': 9,
  'num_10': 10, 'num_11': 11, 'num_12': 12,
  'mod_+2': 1, 'mod_+4': 1, 'mod_+6': 1, 'mod_+8': 1, 'mod_+10': 1, 'mod_x2': 1,
  'act_freeze': 3, 'act_flip3': 3, 'act_2nd': 3
};

const NUMBERS = Array.from({ length: 13 }, (_, i) => `num_${i}`);
const MODIFIERS = ['mod_+2', 'mod_+4', 'mod_+6', 'mod_+8', 'mod_+10', 'mod_x2'];
const ACTIONS = ['act_freeze', 'act_flip3', 'act_2nd'];
const WINNING_SCORE = 200;

function calculatePoints(cardsArray, isBusted = false) {
  if (isBusted) return 0;
  let numSum = 0;
  let plusSum = 0;
  let hasX2 = false;
  let uniqueNums = new Set();
  
  cardsArray.forEach(c => {
    if (c.startsWith('num_')) {
      const val = parseInt(c.replace('num_', ''));
      numSum += val;
      uniqueNums.add(val);
    } else if (c.startsWith('mod_')) {
      if (c === 'mod_x2') hasX2 = true;
      else plusSum += parseInt(c.replace('mod_+', ''));
    }
  });
  
  let total = numSum * (hasX2 ? 2 : 1) + plusSum;
  if (uniqueNums.size >= 7) total += 15;
  return total;
}

const formatCardName = (id) => {
  if (!id) return '';
  if (id.startsWith('num_')) return id.replace('num_', '');
  if (id.startsWith('mod_')) return id.replace('mod_', '');
  if (id === 'act_freeze') return 'Freeze';
  if (id === 'act_flip3') return 'Flip 3';
  if (id === 'act_2nd') return '2nd Chance';
  return id;
};

const customScrollbarCSS = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(15, 23, 42, 0.4); 
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(51, 65, 85, 0.8); 
    border-radius: 10px;
    border: 2px solid rgba(15, 23, 42, 0.4);
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(59, 130, 246, 0.8);
  }
  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: rgba(51, 65, 85, 0.8) rgba(15, 23, 42, 0.4);
  }
`;

// --- POPUP COMPONENT ---
const GamePopup = ({ popup, onClose }) => {
  useEffect(() => {
    if (!popup) return;
    const timer = setTimeout(() => onClose(), 2500);
    return () => clearTimeout(timer);
  }, [popup, onClose]);

  if (!popup) return null;

  const configs = {
    BUST: {
      bg: 'bg-rose-600', border: 'border-rose-400',
      icon: <AlertOctagon size={56} className="text-white mb-2 animate-bounce" />,
      title: 'BUSTED!',
      desc: `${popup.playerName} hit a duplicate ${formatCardName(popup.cardId)}!`
    },
    SAVED: {
      bg: 'bg-amber-500', border: 'border-amber-300',
      icon: <ShieldCheck size={56} className="text-white mb-2 animate-pulse" />,
      title: 'SAVED!',
      desc: `${popup.playerName} used a 2nd Chance on ${formatCardName(popup.cardId)}!`
    },
    FLIP7: {
      bg: 'bg-blue-600', border: 'border-blue-400',
      icon: <Sparkles size={56} className="text-white mb-2 animate-spin-slow" />,
      title: 'FLIP 7!',
      desc: `${popup.playerName} collected 7 unique numbers! +15 Pts!`
    }
  };
  const config = configs[popup.type];

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm transition-all animate-in fade-in zoom-in duration-200 cursor-pointer">
      <div onClick={(e) => e.stopPropagation()} className={`${config.bg} border-4 ${config.border} p-8 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col items-center text-center max-w-sm w-full transform transition-all`}>
        {config.icon}
        <h2 className="text-4xl md:text-5xl font-black text-white tracking-widest uppercase shadow-black/50 drop-shadow-lg mb-2">{config.title}</h2>
        <p className="text-white/95 font-bold text-lg md:text-xl">{config.desc}</p>
        <p className="text-white/50 text-xs mt-6 uppercase tracking-widest font-bold">Tap anywhere to dismiss</p>
      </div>
    </div>
  );
};

export default function OnlineFlip7() {
  // --- USER & LOBBY STATE ---
  const [user, setUser] = useState(null);
  const [myProfile, setMyProfile] = useState(() => {
    const saved = localStorage.getItem('flip7_profile');
    return saved ? JSON.parse(saved) : { name: `Player_${Math.floor(Math.random() * 1000)}` };
  });
  const [roomId, setRoomId] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [savedRooms, setSavedRooms] = useState(() => {
    const saved = localStorage.getItem('flip7_rooms');
    return saved ? JSON.parse(saved) : [];
  });
  const [lobbyError, setLobbyError] = useState('');
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEndRound, setShowEndRound] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [editName, setEditName] = useState('');
  
  const [settings, setSettings] = useState({ trackAllPlayers: true, trackDiscard: true, autoSwitch: true });

  // --- GAME STATE ---
  const defaultState = {
    host: '',
    players: [],
    discardPile: [],
    round: 1,
    activeTab: 'discard',
    eventTrigger: null
  };
  const [gameState, setGameState] = useState(defaultState);

  // --- AUTH INIT ---
  useEffect(() => {
    signInAnonymously(auth).catch(e => {
      console.error("Auth Error", e);
      setLobbyError("Server Auth Error: Please enable 'Anonymous' Sign-in in Firebase Authentication.");
    });
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // --- PROFILE SAVE ---
  useEffect(() => {
    localStorage.setItem('flip7_profile', JSON.stringify(myProfile));
  }, [myProfile]);

  // --- FIREBASE SYNC ---
  useEffect(() => {
    if (!roomId || !user) return;
    const docRef = doc(db, 'rooms', roomId);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGameState(prev => ({
           ...prev,
           ...data,
           eventTrigger: data.eventTrigger?.id !== prev.eventTrigger?.id ? data.eventTrigger : prev.eventTrigger
        }));
      } else {
        setRoomId(null);
        setLobbyError("Room no longer exists.");
      }
    });
    return () => unsubscribe();
  }, [roomId, user]);

  // --- LOBBY ACTIONS ---
  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
  };

  const saveRoomToHistory = (code, hostName) => {
    const newRooms = [{ id: code, name: `${hostName}'s Room`, date: Date.now() }, ...savedRooms.filter(r => r.id !== code)].slice(0, 5);
    setSavedRooms(newRooms);
    localStorage.setItem('flip7_rooms', JSON.stringify(newRooms));
  };

  const handleHostGame = async () => {
    if (!user) {
      setLobbyError("Connecting to server... If stuck, ensure Anonymous Auth is enabled in Firebase.");
      return;
    }
    
    try {
      const newRoomId = generateRoomCode();
      const colors = ['emerald', 'amber', 'pink', 'cyan', 'indigo', 'rose', 'orange'];
      const myPlayer = { id: user.uid, name: myProfile.name, cards: [], score: 0, busted: false, standing: false, frozen: false, color: colors[0] };
      
      const initialState = {
        ...defaultState,
        host: myProfile.name,
        players: [myPlayer],
        activeTab: user.uid
      };
      
      await setDoc(doc(db, 'rooms', newRoomId), initialState);
      saveRoomToHistory(newRoomId, myProfile.name);
      setRoomId(newRoomId);
    } catch (error) {
      console.error("Database Error:", error);
      setLobbyError("Database Error: Did you create the Firestore Database in 'Test Mode'?");
    }
  };

  const handleJoinGame = async (codeToJoin) => {
    if (!user) {
      setLobbyError("Connecting to server... If stuck, ensure Anonymous Auth is enabled in Firebase.");
      return;
    }
    if (!codeToJoin) return;
    
    const code = codeToJoin.toUpperCase();
    setLobbyError('Joining...');
    
    try {
      const docRef = doc(db, 'rooms', code);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        let updatedPlayers = [...data.players];
        
        // Add me if I'm not in the room yet
        if (!updatedPlayers.find(p => p.id === user.uid)) {
          const colors = ['emerald', 'amber', 'pink', 'cyan', 'indigo', 'rose', 'orange'];
          const randomColor = colors[updatedPlayers.length % colors.length];
          updatedPlayers.push({ id: user.uid, name: myProfile.name, cards: [], score: 0, busted: false, standing: false, frozen: false, color: randomColor });
          await setDoc(docRef, { players: updatedPlayers }, { merge: true });
        }
        
        saveRoomToHistory(code, data.host || "Friend");
        setLobbyError('');
        setRoomId(code);
      } else {
        setLobbyError("Room not found. Check the code.");
      }
    } catch (error) {
      console.error("Database Error:", error);
      setLobbyError("Database Error: Cannot read from Firestore.");
    }
  };

  // --- GAMEPLAY ACTIONS ---
  const updateGame = async (updates) => {
    const newState = { ...gameState, ...updates };
    setGameState(newState); 
    if (roomId && user) {
      await setDoc(doc(db, 'rooms', roomId), newState, { merge: true });
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(e => console.error(e));
    } else {
      if (document.exitFullscreen) document.exitFullscreen().then(() => setIsFullscreen(false)).catch(e => console.error(e));
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const { players, discardPile, round, activeTab, eventTrigger } = gameState;
  const activePlayer = players.find(p => p.id === activeTab);
  const isDiscardTab = activeTab === 'discard';

  const getRemaining = (key) => {
    let count = DECK[key];
    if (settings.trackAllPlayers) players.forEach(p => { count -= p.cards.filter(c => c === key).length; });
    if (settings.trackDiscard) count -= discardPile.filter(c => c === key).length;
    return Math.max(0, count);
  };

  const totalRemaining = Object.keys(DECK).reduce((sum, key) => sum + getRemaining(key), 0);
  const currentPoints = activePlayer ? calculatePoints(activePlayer.cards, activePlayer.busted) : 0;
  const activeNums = activePlayer ? new Set(activePlayer.cards.filter(c => c.startsWith('num_'))) : new Set();
  const hasSecondChance = activePlayer ? activePlayer.cards.includes('act_2nd') : false;

  const advanceTurn = (newPlayersState) => {
    if (!settings.autoSwitch) return activeTab;
    const currentIndex = newPlayersState.findIndex(p => p.id === activeTab);
    if (currentIndex === -1) return activeTab;
    
    let nextIndex = (currentIndex + 1) % newPlayersState.length;
    let loopCount = 0;
    while (loopCount < newPlayersState.length) {
      const nextP = newPlayersState[nextIndex];
      if (!nextP.busted && !nextP.standing && !nextP.frozen) return nextP.id;
      nextIndex = (nextIndex + 1) % newPlayersState.length;
      loopCount++;
    }
    return activeTab;
  };

  const handleAddCard = (id) => {
    if (getRemaining(id) <= 0) return;
    if (isDiscardTab) {
      updateGame({ discardPile: [...discardPile, id] });
      return;
    }
    if (!activePlayer || activePlayer.busted || activePlayer.standing || activePlayer.frozen) return;

    let updatedPlayers = [...players];
    let newDiscard = [...discardPile];
    let newEvent = null;
    let nextTab = activeTab;

    if (id.startsWith('num_') && activePlayer.cards.includes(id)) {
      const secondChanceIdx = activePlayer.cards.indexOf('act_2nd');
      if (secondChanceIdx !== -1) {
        const newCards = [...activePlayer.cards];
        newCards.splice(secondChanceIdx, 1);
        updatedPlayers = updatedPlayers.map(p => p.id === activePlayer.id ? { ...p, cards: newCards } : p);
        newDiscard = [...newDiscard, 'act_2nd', id];
        newEvent = { id: Date.now(), type: 'SAVED', playerName: activePlayer.name, cardId: id };
      } else {
        const newCards = [...activePlayer.cards, id];
        updatedPlayers = updatedPlayers.map(p => p.id === activePlayer.id ? { ...p, cards: newCards, busted: true } : p);
        newEvent = { id: Date.now(), type: 'BUST', playerName: activePlayer.name, cardId: id };
      }
    } else {
      const newCards = [...activePlayer.cards, id];
      updatedPlayers = updatedPlayers.map(p => p.id === activePlayer.id ? { ...p, cards: newCards } : p);
      if (id.startsWith('num_')) {
        if (new Set(newCards.filter(c => c.startsWith('num_'))).size === 7) newEvent = { id: Date.now(), type: 'FLIP7', playerName: activePlayer.name };
      }
    }

    nextTab = advanceTurn(updatedPlayers);
    updateGame({ players: updatedPlayers, discardPile: newDiscard, activeTab: nextTab, eventTrigger: newEvent || eventTrigger });
  };

  const togglePlayerState = (playerId, field) => {
    const updatedPlayers = players.map(p => p.id === playerId ? { ...p, [field]: !p[field] } : p);
    let nextTab = activeTab;
    if (playerId === activeTab && updatedPlayers.find(p => p.id === playerId)[field]) nextTab = advanceTurn(updatedPlayers);
    updateGame({ players: updatedPlayers, activeTab: nextTab });
  };

  const handleRemoveCard = (playerId, index) => {
    if (playerId === 'discard') {
      updateGame({ discardPile: discardPile.filter((_, i) => i !== index) });
    } else {
      updateGame({
        players: players.map(p => {
          if (p.id === playerId) {
            const newCards = [...p.cards];
            newCards.splice(index, 1);
            const hasDuplicate = new Set(newCards.filter(c => c.startsWith('num_'))).size !== newCards.filter(c => c.startsWith('num_')).length;
            return { ...p, cards: newCards, busted: hasDuplicate };
          }
          return p;
        })
      });
    }
  };

  const handleAddLocalPlayer = () => {
    const newId = Date.now().toString();
    const colors = ['emerald', 'amber', 'pink', 'cyan', 'indigo', 'rose', 'orange'];
    const randomColor = colors[players.length % colors.length];
    updateGame({
      players: [...players, { id: newId, name: `Guest ${players.length + 1}`, cards: [], score: 0, busted: false, standing: false, frozen: false, color: randomColor }]
    });
  };

  const commitRoundScores = (shuffleDeck = false) => {
    let allCardsToDiscard = [];
    const updatedPlayers = players.map(p => {
      const roundPts = calculatePoints(p.cards, p.busted);
      allCardsToDiscard = [...allCardsToDiscard, ...p.cards];
      return { ...p, score: p.score + roundPts, cards: [], busted: false, standing: false, frozen: false };
    });
    updateGame({
      players: updatedPlayers,
      discardPile: shuffleDeck ? [] : [...discardPile, ...allCardsToDiscard],
      round: round + 1,
      activeTab: updatedPlayers[0]?.id || 'discard'
    });
    setShowEndRound(false);
  };

  const InputButton = ({ id }) => {
    const count = getRemaining(id);
    const disabled = count <= 0 || (!isDiscardTab && (activePlayer?.busted || activePlayer?.standing || activePlayer?.frozen));
    const text = formatCardName(id);
    
    let colorClasses = 'bg-slate-800 text-slate-200 border-slate-700/50';
    if (!disabled) {
      if (id.startsWith('num_')) colorClasses = 'bg-blue-900/40 hover:bg-blue-800/60 text-blue-100 border-blue-700/50';
      if (id.startsWith('mod_')) colorClasses = 'bg-purple-900/40 hover:bg-purple-800/60 text-purple-100 border-purple-700/50';
      if (id.startsWith('act_')) colorClasses = 'bg-amber-900/40 hover:bg-amber-800/60 text-amber-100 border-amber-700/50';
    }
    
    return (
      <button 
        onClick={() => handleAddCard(id)} 
        disabled={disabled}
        className={`relative p-1 md:p-2 rounded-xl border flex flex-col items-center justify-center font-bold transition-all min-h-[3.25rem] md:min-h-[3.5rem] w-full ${colorClasses} ${disabled ? 'opacity-30 cursor-not-allowed' : 'active:scale-95 hover:shadow-lg'}`}
      >
        <span className="text-xs sm:text-sm md:text-base leading-tight text-center px-0.5 whitespace-normal w-full">{text}</span>
        <span className="text-[9px] md:text-[10px] font-normal opacity-70 mt-0.5">{count} left</span>
      </button>
    );
  };

  const CardBadge = ({ id, onRemove, isBustCard }) => {
    const text = formatCardName(id);
    let color = 'bg-slate-700 text-white';
    if (id.startsWith('num_')) color = 'bg-blue-600 text-white';
    if (id.startsWith('mod_')) color = 'bg-purple-600 text-white';
    if (id.startsWith('act_')) color = 'bg-amber-600 text-white';
    
    return (
      <div onClick={onRemove} className={`rounded-lg cursor-pointer flex flex-col items-center justify-center font-bold text-sm md:text-base lg:text-lg shadow-md border hover:border-red-400 transition-all w-12 h-16 md:w-14 md:h-20 group relative overflow-hidden flex-shrink-0 ${color} ${isBustCard ? 'border-red-500 animate-pulse' : 'border-white/10'}`}>
        <span>{text}</span>
        <div className="absolute inset-0 bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={18} /></div>
      </div>
    );
  };

  // --- RENDER LOBBY ---
  if (!roomId) {
    return (
      <div className="min-h-[100dvh] w-full bg-slate-950 text-slate-200 font-sans flex items-center justify-center p-4 selection:bg-blue-500/30 relative overflow-hidden">
        <style>{customScrollbarCSS}</style>
        {/* Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg h-96 bg-blue-600/20 blur-[100px] rounded-full pointer-events-none"></div>
        
        <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative z-10 flex flex-col gap-6">
           <div className="text-center">
             <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-blue-900/50 mb-4">
                <Gamepad2 size={32} className="text-white"/>
             </div>
             <h1 className="text-3xl font-black bg-gradient-to-r from-blue-400 via-purple-400 to-amber-400 bg-clip-text text-transparent mb-1">FLIP 7 ONLINE</h1>
             <p className="text-slate-400 text-xs font-bold tracking-widest uppercase">Multiplayer Engine</p>
           </div>

           <div className="space-y-4 bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50 shadow-inner">
             <div>
               <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 mb-1 block">Your Display Name</label>
               <div className="relative">
                 <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                 <input 
                   type="text" maxLength={12}
                   value={myProfile.name} onChange={(e) => setMyProfile({ ...myProfile, name: e.target.value })}
                   className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white font-bold focus:outline-none focus:border-blue-500 transition-colors"
                 />
               </div>
             </div>
             
             <div className="flex gap-2 pt-2">
               <button onClick={handleHostGame} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20 active:scale-95 flex items-center justify-center gap-2">
                  <Plus size={18}/> Host Game
               </button>
             </div>
           </div>

           <div className="space-y-4">
             <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-slate-800"></div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Or Join Friends</span>
                <div className="flex-1 h-px bg-slate-800"></div>
             </div>

             <div className="flex gap-2">
               <input 
                 type="text" placeholder="ROOM CODE" maxLength={4}
                 value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                 className="flex-1 bg-slate-900/80 border border-slate-700 rounded-xl px-4 text-center text-xl font-black tracking-widest text-white focus:outline-none focus:border-purple-500 uppercase placeholder:text-slate-700"
               />
               <button onClick={() => handleJoinGame(joinCode)} disabled={joinCode.length < 4} className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 text-white px-6 rounded-xl font-bold transition-all shadow-lg shadow-purple-900/20 active:scale-95">
                 Join
               </button>
             </div>
             {lobbyError && <p className="text-rose-500 text-xs font-bold text-center animate-pulse">{lobbyError}</p>}
           </div>

           {savedRooms.length > 0 && (
             <div className="mt-2">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Users size={12}/> Recent Friends</h3>
                <div className="flex flex-col gap-2 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                  {savedRooms.map(room => (
                    <button key={room.id} onClick={() => handleJoinGame(room.id)} className="w-full bg-slate-800/50 hover:bg-slate-700/80 border border-slate-700/50 rounded-lg p-2.5 flex items-center justify-between transition-colors group">
                       <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">{room.name}</span>
                       <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">{room.id}</span>
                          <ArrowRight size={14} className="text-slate-600 group-hover:text-blue-400 transition-colors"/>
                       </div>
                    </button>
                  ))}
                </div>
             </div>
           )}
        </div>
      </div>
    );
  }

  // --- RENDER GAME BOARD ---
  return (
    <div className="h-[100dvh] w-full bg-slate-950 text-slate-200 font-sans flex flex-col overflow-hidden selection:bg-blue-500/30">
      <style>{customScrollbarCSS}</style>
      <GamePopup popup={eventTrigger} onClose={() => updateGame({ eventTrigger: null })} />

      {/* --- TOP HEADER --- */}
      <div className="h-14 md:h-16 px-3 md:px-6 flex justify-between items-center bg-slate-900/80 border-b border-slate-800 flex-shrink-0 backdrop-blur z-20">
        <div className="flex items-center gap-3 md:gap-4">
          <button onClick={() => setRoomId(null)} className="p-1.5 md:p-2 bg-slate-800 hover:bg-rose-900/80 text-slate-400 hover:text-rose-400 rounded-lg transition-colors" title="Leave Room">
             <LogOut size={16} />
          </button>
          <div className="h-6 w-px bg-slate-700"></div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white leading-none flex items-center gap-2">
              ROOM: <span className="text-blue-400 tracking-widest">{roomId}</span>
            </h1>
            <p className="text-slate-400 text-[9px] md:text-[10px] mt-1 font-bold tracking-wider uppercase">
              ROUND {round} <span className="mx-2 text-slate-700">|</span> {totalRemaining} CARDS
            </p>
          </div>
        </div>
        
        <div className="flex gap-2 relative">
          <button onClick={toggleFullscreen} className="hidden md:flex px-2 md:px-3 py-1.5 md:py-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors items-center justify-center text-slate-400 hover:text-white" title="Toggle Fullscreen">
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
          <button onClick={() => updateGame({ discardPile: [] })} className="hidden sm:flex px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg transition-colors items-center gap-1.5 text-xs md:text-sm border border-slate-700">
            <Shuffle size={14} /> Reshuffle
          </button>
          <button onClick={() => setShowEndRound(true)} className="px-3 md:px-4 py-1.5 md:py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-indigo-900/20 text-xs md:text-sm">
            <Trophy size={14} /> End Round
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className="px-2 md:px-3 py-1.5 md:py-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center">
            <Settings size={16} />
          </button>
          
          {showSettings && (
            <div className="absolute top-full right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-4 z-40">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Engine Settings</h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-xs font-bold text-slate-300 group-hover:text-white">Auto-Advance Turn</span>
                  <input type="checkbox" className="w-4 h-4 rounded bg-slate-900" checked={settings.autoSwitch} onChange={() => setSettings(s => ({ ...s, autoSwitch: !s.autoSwitch }))} />
                </label>
                <div className="h-px w-full bg-slate-700"></div>
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-xs font-bold text-slate-300 group-hover:text-white">Track All Players</span>
                  <input type="checkbox" className="w-4 h-4 rounded bg-slate-900" checked={settings.trackAllPlayers} onChange={() => setSettings(s => ({ ...s, trackAllPlayers: !s.trackAllPlayers }))} />
                </label>
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-xs font-bold text-slate-300 group-hover:text-white">Track Discard</span>
                  <input type="checkbox" className="w-4 h-4 rounded bg-slate-900" checked={settings.trackDiscard} onChange={() => setSettings(s => ({ ...s, trackDiscard: !s.trackDiscard }))} />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- MAIN 3-COLUMN LAYOUT --- */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 w-full mx-auto p-2 md:p-3 lg:p-4 gap-2 md:gap-3 lg:gap-4 overflow-hidden relative">
        
        {/* COLUMN 1: Keyboard */}
        <div className="w-full lg:w-4/12 xl:w-3/12 flex flex-col min-h-0 gap-2 md:gap-3 order-2 lg:order-1">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-xl flex-1 overflow-y-auto custom-scrollbar flex flex-col relative">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex justify-between items-center flex-shrink-0 sticky top-0 bg-slate-900 pb-2 z-10">
              <span>{isDiscardTab ? 'Add to Discard' : 'Draw Card'}</span>
            </h3>
            
            <div className={`flex flex-col gap-2 md:gap-3 transition-opacity ${(!isDiscardTab && (activePlayer?.busted || activePlayer?.standing || activePlayer?.frozen)) ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="grid grid-cols-4 gap-1.5">
                {NUMBERS.map(id => <InputButton key={id} id={id} />)}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {MODIFIERS.map(id => <InputButton key={id} id={id} />)}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {ACTIONS.map(id => <InputButton key={id} id={id} />)}
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 2: Active Center Stage */}
        <div className="w-full lg:w-5/12 xl:w-6/12 flex flex-col min-h-0 order-1 lg:order-2">
          
          {/* Top Leaderboard / Tabs */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-1.5 shadow-xl overflow-x-auto custom-scrollbar mb-2 md:mb-3 flex-shrink-0">
            <div className="flex gap-1.5 min-w-max">
              {players.map((p) => {
                const pRoundPts = calculatePoints(p.cards, p.busted);
                const isWinning = p.score + pRoundPts >= WINNING_SCORE;
                const isMe = p.id === user?.uid;

                return (
                  <button 
                    key={p.id} onClick={() => updateGame({ activeTab: p.id })} 
                    className={`relative px-3 py-2 rounded-lg text-sm font-bold flex flex-col items-start min-w-[110px] transition-all overflow-hidden ${activeTab === p.id ? `bg-${p.color}-600 text-white shadow-lg` : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                  >
                    {isWinning && <div className="absolute top-0 right-0 p-1 bg-amber-400 text-amber-900 rounded-bl-lg"><Crown size={10} /></div>}
                    <div className="flex items-center justify-between w-full mb-0.5">
                      <span className={`truncate pr-3 text-xs ${isMe ? 'underline decoration-2 underline-offset-2' : ''}`}>{p.name}</span>
                      {activeTab === p.id && <Edit2 size={10} className="opacity-50 hover:opacity-100 absolute right-2 top-2.5 z-10" onClick={(e) => { e.stopPropagation(); setEditName(p.name); setEditingPlayerId(p.id); }} />}
                    </div>
                    <div className="text-[10px] font-normal opacity-90 flex gap-1 items-center">
                       <span>Pts: {p.score}</span>
                       <span className={p.busted ? 'text-red-300 font-bold' : (p.standing || p.frozen) ? 'text-amber-300 font-bold' : 'text-white font-bold'}>
                         ({p.busted ? 'BUST' : p.standing ? 'STAND' : p.frozen ? 'FROZEN' : `+${pRoundPts}`})
                       </span>
                    </div>
                  </button>
                )
              })}
              
              <button onClick={() => updateGame({ activeTab: 'discard' })} className={`px-3 py-2 rounded-lg text-xs font-bold flex flex-col items-center justify-center min-w-[90px] transition-all ${activeTab === 'discard' ? 'bg-slate-600 text-white shadow-lg' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}>
                 <Trash2 size={14} className="mb-0.5" /> Discard
              </button>
              <button onClick={handleAddLocalPlayer} className="px-3 py-2 rounded-lg text-xs font-bold flex flex-col items-center justify-center min-w-[60px] bg-slate-900 border border-slate-700 border-dashed text-slate-400 hover:bg-slate-800 transition-all">
                 <Plus size={16} /> Guest
              </button>
            </div>
          </div>

          {/* Inline Edit UI */}
          {editingPlayerId && (
             <div className="bg-slate-800 border border-slate-600 p-2 rounded-lg flex gap-2 shadow-xl mb-2 flex-shrink-0 animate-in fade-in slide-in-from-top-1 z-20">
                <input 
                  type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none" autoFocus maxLength={12}
                />
                <button onClick={() => { updateGame({ players: players.map(p => p.id === editingPlayerId ? { ...p, name: editName || p.name } : p) }); setEditingPlayerId(null); }} className="bg-blue-600 p-1.5 rounded text-white"><Check size={14}/></button>
                <button onClick={() => setEditingPlayerId(null)} className="bg-slate-700 p-1.5 rounded text-white"><X size={14}/></button>
                <button onClick={() => { updateGame({ players: players.filter(p => p.id !== editingPlayerId) }); setEditingPlayerId(null); }} className="bg-rose-900/50 text-rose-400 p-1.5 rounded ml-auto hover:bg-rose-900"><Trash2 size={14}/></button>
             </div>
          )}

          {/* Active View Area */}
          <div className="flex-1 flex flex-col min-h-0 relative">
            {isDiscardTab ? (
              <div className="flex-1 bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 flex flex-col overflow-y-auto custom-scrollbar shadow-inner relative">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center justify-between mb-4 sticky top-0 bg-slate-900/90 backdrop-blur p-2 -mx-2 rounded z-10">
                  <span className="flex items-center gap-1.5"><Trash2 size={14} className="text-slate-500"/> Discard Pile</span>
                  <span className="bg-slate-800 px-2 py-1 rounded">{discardPile.length} Cards</span>
                </h3>
                <div className="flex flex-wrap gap-1.5 content-start">
                   {discardPile.map((card, i) => <CardBadge key={`disc-${i}`} id={card} onRemove={() => handleRemoveCard('discard', i)} />)}
                </div>
              </div>
            ) : activePlayer ? (
              <div className={`flex-1 bg-slate-900/60 border rounded-xl p-3 md:p-5 flex flex-col overflow-y-auto custom-scrollbar shadow-inner transition-colors ${activePlayer.busted ? 'border-rose-900/50 bg-rose-950/10' : activePlayer.standing ? 'border-amber-900/50' : activePlayer.frozen ? 'border-cyan-900/50' : `border-${activePlayer.color}-900/30`}`}>
                 
                 <div className="flex justify-between items-start mb-3 md:mb-4">
                   <div>
                     <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
                        <User size={20} className={`text-${activePlayer.color}-500`} /> {activePlayer.name}
                     </h2>
                     <div className="text-[10px] md:text-xs text-slate-400 font-bold mt-1 tracking-wider uppercase">Race to {WINNING_SCORE}: <span className="text-white">{activePlayer.score} pts</span></div>
                   </div>
                   
                   <div className="flex gap-1.5 md:gap-2">
                      <button onClick={() => togglePlayerState(activePlayer.id, 'frozen')} className={`p-1.5 md:p-2 rounded-lg border transition-all ${activePlayer.frozen ? 'bg-cyan-900/80 text-cyan-300 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-slate-900 text-slate-500 border-slate-700 hover:text-cyan-400 hover:border-cyan-800'}`} title="Toggle Frozen">
                         <Snowflake size={16} />
                      </button>
                      <button onClick={() => togglePlayerState(activePlayer.id, 'standing')} className={`p-1.5 md:p-2 rounded-lg border transition-all ${activePlayer.standing ? 'bg-amber-900/80 text-amber-300 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'bg-slate-900 text-slate-500 border-slate-700 hover:text-amber-400 hover:border-amber-800'}`} title="Toggle Stand">
                         <Hand size={16} />
                      </button>
                   </div>
                 </div>

                 <div className="flex flex-wrap gap-2 mb-3 md:mb-4">
                   <div className="bg-slate-950 px-2 md:px-3 py-1 rounded-lg border border-slate-800 flex items-center gap-2 shadow-inner">
                      <span className="text-[9px] md:text-[10px] uppercase tracking-widest text-slate-500 font-bold">Round</span>
                      <span className={`text-lg md:text-xl font-black ${activePlayer.busted ? 'text-rose-500 line-through opacity-50' : 'text-white'}`}>{currentPoints}</span>
                   </div>
                   {hasSecondChance && <span className="bg-amber-900/40 text-amber-400 text-[9px] md:text-[10px] px-2 py-1 rounded-lg uppercase font-bold border border-amber-700/50 flex items-center gap-1"><ShieldCheck size={12}/> Shield Active</span>}
                   {activePlayer.busted && <span className="bg-rose-900/40 text-rose-400 text-[9px] md:text-[10px] px-2 py-1 rounded-lg uppercase font-bold border border-rose-700/50 flex items-center gap-1 animate-pulse"><AlertTriangle size={12}/> BUSTED</span>}
                   {activePlayer.standing && <span className="bg-amber-900/40 text-amber-400 text-[9px] md:text-[10px] px-2 py-1 rounded-lg uppercase font-bold border border-amber-700/50 flex items-center gap-1"><Hand size={12}/> STANDING</span>}
                   {activePlayer.frozen && <span className="bg-cyan-900/40 text-cyan-400 text-[9px] md:text-[10px] px-2 py-1 rounded-lg uppercase font-bold border border-cyan-700/50 flex items-center gap-1"><Snowflake size={12}/> FROZEN</span>}
                   <span className={`text-[9px] md:text-[10px] px-2 py-1 rounded-lg uppercase font-bold border flex items-center gap-1 ml-auto ${activeNums.size >= 7 ? 'bg-blue-900/50 text-blue-300 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>
                      <Sparkles size={12}/> {activeNums.size}/7
                   </span>
                 </div>
                 
                 <div className="flex-1 flex flex-wrap gap-1.5 md:gap-2 content-start bg-slate-950/30 rounded-xl p-2 md:p-4 border border-slate-800/50 min-h-[100px] overflow-y-auto">
                    {activePlayer.cards.length === 0 ? (
                      <div className="w-full flex flex-col items-center justify-center text-slate-600 text-xs font-bold uppercase tracking-wider h-full opacity-50">Line is empty</div>
                    ) : (
                      activePlayer.cards.map((card, i) => {
                        const isBustCard = activePlayer.busted && card.startsWith('num_') && activePlayer.cards.filter(c => c === card).length > 1;
                        return <CardBadge key={`card-${i}`} id={card} onRemove={() => handleRemoveCard(activePlayer.id, i)} isBustCard={isBustCard} />;
                      })
                    )}
                 </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* COLUMN 3: Right Overview (Widescreen Only, persistent table layout) */}
        <div className="hidden lg:flex w-3/12 xl:w-3/12 flex-col min-h-0 order-3 border-l border-slate-800 pl-4 bg-slate-950">
           <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center justify-between flex-shrink-0 pr-2">
             <span className="flex items-center gap-2"><Users size={14}/> Table Status</span>
             <span className="text-[9px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800">Goal: {WINNING_SCORE}</span>
           </h3>
           <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 pr-2">
              {players.map((p, idx) => {
                 const pRoundPts = calculatePoints(p.cards, p.busted);
                 const progressPercent = Math.min(100, ((p.score + pRoundPts) / WINNING_SCORE) * 100);
                 const isWinning = p.score + pRoundPts >= WINNING_SCORE;
                 
                 return (
                   <div key={p.id} className={`bg-slate-900/80 border p-3 rounded-xl flex flex-col gap-2 transition-all ${p.id === activeTab ? `border-${p.color}-500/50 shadow-[0_0_15px_rgba(var(--tw-colors-${p.color}-500),0.1)]` : 'border-slate-800'}`}>
                      <div className="flex justify-between items-center">
                         <div className="flex items-center gap-2">
                           <div className={`w-5 h-5 rounded bg-${p.color}-900/50 text-${p.color}-400 text-[10px] font-bold flex items-center justify-center border border-${p.color}-700`}>{idx + 1}</div>
                           <span className="text-sm font-bold text-white truncate max-w-[100px]">{p.name}</span>
                         </div>
                         <div className="flex gap-1">
                            <button onClick={() => togglePlayerState(p.id, 'frozen')} className={`p-1 rounded ${p.frozen ? 'bg-cyan-900 text-cyan-400' : 'bg-slate-800 text-slate-500 hover:text-cyan-400'}`}><Snowflake size={12}/></button>
                            <button onClick={() => togglePlayerState(p.id, 'standing')} className={`p-1 rounded ${p.standing ? 'bg-amber-900 text-amber-400' : 'bg-slate-800 text-slate-500 hover:text-amber-400'}`}><Hand size={12}/></button>
                         </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1">
                          <span className={isWinning ? 'text-amber-400 animate-pulse flex items-center gap-1' : 'text-slate-400'}>
                             {isWinning && <Crown size={10}/>} Total {p.score} <span className="text-emerald-400 opacity-80">(+{pRoundPts})</span>
                          </span>
                        </div>
                        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                           <div className={`h-full transition-all ${isWinning ? 'bg-amber-400' : `bg-${p.color}-500`}`} style={{width: `${progressPercent}%`}}></div>
                        </div>
                      </div>

                      {/* Mini Cards */}
                      <div className="flex flex-wrap gap-1 mt-1">
                         {p.cards.length === 0 ? <span className="text-[9px] text-slate-600 uppercase font-bold tracking-widest">No Cards</span> : null}
                         {p.cards.map((c, i) => {
                           let color = 'bg-slate-700 border-white/10 text-white';
                           let shortName = c.replace('num_', '').replace('mod_', '').replace('act_', '');
                           if (shortName === 'freeze') shortName = 'Frz';
                           if (shortName === 'flip3') shortName = 'Flp';
                           if (shortName === '2nd') shortName = '2nd';
                           
                           if (c.startsWith('num_')) color = 'bg-blue-900/50 border-blue-700/50 text-blue-200';
                           if (c.startsWith('mod_')) color = 'bg-purple-900/50 border-purple-700/50 text-purple-200';
                           if (c.startsWith('act_')) color = 'bg-amber-900/50 border-amber-700/50 text-amber-200';
                           
                           return (
                             <div key={i} className={`w-6 h-7 rounded border flex items-center justify-center text-[9px] font-bold shadow-sm ${color}`}>
                               {shortName}
                             </div>
                           );
                         })}
                      </div>
                      
                      {/* Status row */}
                      <div className="flex gap-1 mt-auto pt-1">
                         {p.busted && <span className="text-[8px] bg-rose-900/50 text-rose-400 px-1.5 py-0.5 rounded border border-rose-800 uppercase font-bold">Busted</span>}
                         {p.standing && <span className="text-[8px] bg-amber-900/50 text-amber-400 px-1.5 py-0.5 rounded border border-amber-800 uppercase font-bold">Stand</span>}
                         {p.frozen && <span className="text-[8px] bg-cyan-900/50 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-800 uppercase font-bold">Frozen</span>}
                         {new Set(p.cards.filter(c => c.startsWith('num_'))).size >= 7 && <span className="text-[8px] bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500 uppercase font-bold ml-auto">Flip 7</span>}
                      </div>
                   </div>
                 );
              })}
           </div>
        </div>
      </div>

      {/* --- END ROUND MODAL --- */}
      {showEndRound && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
          <div className="bg-slate-900 border border-slate-700 p-6 md:p-8 rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
            <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-widest mb-4 flex items-center justify-between flex-shrink-0">
              Round {round} Summary <Trophy className="text-amber-400" />
            </h2>
            
            <div className="overflow-y-auto custom-scrollbar flex-1 space-y-2 mb-6 pr-2">
              {players.map((p, i) => {
                const roundPts = calculatePoints(p.cards, p.busted);
                const newTotal = p.score + roundPts;
                const isWinner = newTotal >= WINNING_SCORE;
                
                return (
                  <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl border ${isWinner ? 'bg-amber-900/30 border-amber-500/50' : 'bg-slate-800 border-slate-700/50'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full bg-${p.color}-500 flex items-center justify-center text-white font-bold shadow-md`}>{i+1}</div>
                      <div>
                        <span className="font-bold text-white block leading-tight">{p.name}</span>
                        {isWinner && <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest flex items-center gap-1"><Crown size={10}/> Winner!</span>}
                      </div>
                    </div>
                    <div className="text-right">
                       <span className={`text-lg font-black block leading-tight ${p.busted ? 'text-rose-500' : 'text-emerald-400'}`}>
                         {p.busted ? 'BUST (0)' : `+${roundPts}`}
                       </span>
                       <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total: {newTotal}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
              <button onClick={() => commitRoundScores(false)} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-colors">
                Next Round (Keep Discard)
              </button>
              <button onClick={() => commitRoundScores(true)} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                <Shuffle size={14}/> Reshuffle Deck
              </button>
            </div>
            <button onClick={() => setShowEndRound(false)} className="w-full mt-2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 text-sm font-bold rounded-xl transition-colors flex-shrink-0">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
