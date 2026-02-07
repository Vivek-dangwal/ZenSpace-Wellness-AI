import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { GEMINI_API_KEY } from "../constants";
import { db } from "../firebaseConfig";

const { width } = Dimensions.get("window");

export default function Index() {
  const [loading, setLoading] = useState(false);
  const [journalText, setJournalText] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [history, setHistory] = useState([]);
  const [showGames, setShowGames] = useState(false);
  const [activeGame, setActiveGame] = useState(null); 
  
  const [tiles, setTiles] = useState([]);
  const [selected, setSelected] = useState([]);
  const breathAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const q = query(collection(db, "user_moods"), orderBy("time", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const stats = useMemo(() => {
    const total = history.length;
    const happyCount = history.filter(h => h.mood === 'Happy').length;
    let currentStreak = 0;
    let streakBroken = false;
    const now = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(); d.setDate(now.getDate() - i);
      const hasEntry = history.some(h => h.time?.toDate().toDateString() === d.toDateString());
      if (hasEntry && !streakBroken) currentStreak++;
      else if (i > 0 && !hasEntry) streakBroken = true;
    }
    return { total, happyPercent: total ? Math.round((happyCount/total)*100) : 0, streak: currentStreak };
  }, [history]);

  const saveEntry = async (mood, note = "") => {
    setLoading(true);
    try {
      await addDoc(collection(db, "user_moods"), { mood, note, time: serverTimestamp() });
      const prompt = `User is ${mood}. ${note ? 'Note: '+note : ''} 1-line wellness tip.`;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      setAiResponse(data.candidates?.[0]?.content?.parts[0]?.text || "Positive energy saved!");
    } catch (e) { setAiResponse("Logged to cloud!"); }
    finally { setLoading(false); setJournalText(""); }
  };

  const setupMatchGame = () => {
    const icons = ['🍀', '💎', '🕊️', '☀️', '🍀', '💎', '🕊️', '☀️'];
    setTiles(icons.sort(() => Math.random() - 0.5).map((icon, i) => ({ id: i, icon, flipped: false, solved: false })));
    setSelected([]);
    setActiveGame('match');
  };

  const handleTilePress = (index) => {
    if (selected.length === 2 || tiles[index].flipped || tiles[index].solved) return;
    const newTiles = [...tiles];
    newTiles[index].flipped = true;
    setTiles(newTiles);
    const newSelected = [...selected, index];
    if (newSelected.length === 2) {
      if (tiles[newSelected[0]].icon === tiles[newSelected[1]].icon) {
        newTiles[newSelected[0]].solved = true;
        newTiles[newSelected[1]].solved = true;
        setTiles(newTiles);
        setSelected([]);
      } else {
        setTimeout(() => {
          newTiles[newSelected[0]].flipped = false;
          newTiles[newSelected[1]].flipped = false;
          setTiles(newTiles);
          setSelected([]);
        }, 600);
      }
    } else setSelected(newSelected);
  };

  return (
    <View style={{flex: 1, backgroundColor: "#0F172A"}}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerContainer}>
          <Text style={styles.mainHeading}>ZenSpace</Text>
          <Text style={styles.developerBrand}>Developed by Vivek Dangwal</Text>
        </View>
        
        <TouchableOpacity style={styles.gameCenterBtn} onPress={() => setShowGames(true)}>
          <Text style={styles.gameBtnText}>🎮 Wellness Game Center</Text>
        </TouchableOpacity>

        <View style={styles.statsCard}>
            <View style={styles.statBox}><Text style={styles.statVal}>{stats.streak}</Text><Text style={styles.statLab}>🔥 Streak</Text></View>
            <View style={styles.statBox}><Text style={styles.statVal}>{stats.happyPercent}%</Text><Text style={styles.statLab}>Positivity</Text></View>
            <View style={styles.statBox}><Text style={styles.statVal}>{stats.total}</Text><Text style={styles.statLab}>Total</Text></View>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.moodBtn, {backgroundColor: '#10B981'}]} onPress={() => saveEntry("Happy")}><Text style={styles.btnText}>HAPPY 😊</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.moodBtn, {backgroundColor: '#EF4444'}]} onPress={() => saveEntry("Stressed")}><Text style={styles.btnText}>STRESSED 😡</Text></TouchableOpacity>
        </View>

        <View style={styles.glassCard}>
          <TextInput style={styles.textInput} placeholder="How was your day? Write here..." placeholderTextColor="#64748B" multiline value={journalText} onChangeText={setJournalText} />
          <TouchableOpacity style={styles.analyzeBtn} onPress={() => saveEntry("Happy", journalText)}>
            <Text style={styles.btnText}>Analyze & Save ✨</Text>
          </TouchableOpacity>
        </View>

        {aiResponse ? (<View style={styles.insightCard}><Text style={styles.insightTitle}>✨ AI Coaching</Text><Text style={styles.insightBody}>{aiResponse}</Text></View>) : null}

        <View style={styles.historySection}>
          <Text style={styles.miniLabel}>Recent Timeline</Text>
          {history.slice(0, 5).map((item) => (
            <View key={item.id} style={styles.timelineCard}>
              <View style={{flex: 1}}><Text style={styles.timelineMood}>{item.mood === 'Happy' ? '☀️' : '🌊'} {item.mood}</Text>{item.note ? <Text style={styles.historyNote}>{item.note}</Text> : null}</View>
              <Text style={styles.timelineTime}>{item.time?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* GAMES MODAL */}
      <Modal visible={showGames} animationType="slide">
        <View style={[styles.modalContainer, activeGame === 'breath' ? {backgroundColor: '#1E1B4B'} : activeGame === 'match' ? {backgroundColor: '#064E3B'} : {backgroundColor: '#0F172A'}]}>
          <TouchableOpacity onPress={() => {setShowGames(false); setActiveGame(null)}} style={styles.closeBtn}><Text style={styles.closeText}>✕ Exit Game</Text></TouchableOpacity>
          
          {!activeGame ? (
            <View style={styles.gameMenu}>
              <Text style={styles.modalTitle}>ZenPlay</Text>
              <TouchableOpacity style={styles.gameItem} onPress={() => {setActiveGame('breath'); Animated.loop(Animated.sequence([Animated.timing(breathAnim,{toValue:2.5,duration:4000,useNativeDriver:true}),Animated.timing(breathAnim,{toValue:1,duration:4000,useNativeDriver:true})])).start();}}><Text style={styles.gameName}>🧘 Deep Breath Sync</Text></TouchableOpacity>
              <TouchableOpacity style={styles.gameItem} onPress={setupMatchGame}><Text style={styles.gameName}>🧩 Nature Match</Text></TouchableOpacity>
            </View>
          ) : activeGame === 'breath' ? (
            <View style={styles.gamePlayArea}><Text style={styles.gameInstruction}>Inhale deeply... and Release</Text><Animated.View style={[styles.breathOrb, {transform: [{scale: breathAnim}]}]} /></View>
          ) : (
            <View style={styles.gamePlayArea}>
              <Text style={styles.gameInstruction}>Memory Focus</Text>
              <View style={styles.tileGrid}>{tiles.map((tile, i) => (
                  <TouchableOpacity key={i} style={[styles.tile, tile.flipped || tile.solved ? styles.tileFlipped : null]} onPress={() => handleTilePress(i)}>
                    <Text style={styles.tileText}>{tile.flipped || tile.solved ? tile.icon : '?'}</Text>
                  </TouchableOpacity>
                ))}</View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  content: { padding: 20, paddingTop: 60 },
  headerContainer: { marginBottom: 25 },
  mainHeading: { fontSize: 34, fontWeight: "900", color: "#F8FAFC" },
  developerBrand: { fontSize: 12, color: "#6366F1", fontWeight: "700", textTransform: "uppercase", letterSpacing: 2, marginTop: -2 },
  gameCenterBtn: { backgroundColor: '#4F46E5', padding: 18, borderRadius: 20, marginBottom: 25, alignItems: 'center' },
  gameBtnText: { color: '#FFF', fontWeight: '800' },
  statsCard: { backgroundColor: "#1E293B", padding: 22, borderRadius: 28, marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: '#334155' },
  statBox: { alignItems: 'center' },
  statVal: { color: '#F8FAFC', fontSize: 24, fontWeight: '900' },
  statLab: { color: '#94A3B8', fontSize: 10, marginTop: 4, fontWeight: '700', textTransform: 'uppercase' },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  moodBtn: { width: '48%', padding: 20, borderRadius: 22, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: '800' },
  glassCard: { backgroundColor: "#1E293B", padding: 20, borderRadius: 24, marginBottom: 25, borderWidth: 1, borderColor: "#334155" },
  textInput: { backgroundColor: "#0F172A", borderRadius: 18, padding: 18, color: "#F8FAFC", minHeight: 90, marginBottom: 15 },
  analyzeBtn: { backgroundColor: '#6366F1', padding: 16, borderRadius: 18, alignItems: 'center' },
  insightCard: { backgroundColor: "#1E1B4B", padding: 20, borderRadius: 24, marginBottom: 25, borderLeftWidth: 6, borderLeftColor: "#6366F1" },
  insightTitle: { color: "#818CF8", fontWeight: "800", fontSize: 11, marginBottom: 5 },
  insightBody: { color: "#E0E7FF", fontSize: 15, lineHeight: 22 },
  timelineCard: { backgroundColor: "#1E293B", padding: 18, borderRadius: 20, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timelineMood: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  historyNote: { color: '#94A3B8', fontSize: 13, marginTop: 4 },
  timelineTime: { color: '#64748B', fontSize: 11 },
  miniLabel: { color: "#64748B", fontSize: 11, fontWeight: "800", textTransform: "uppercase", marginBottom: 12 },
  modalContainer: { flex: 1, padding: 20, paddingTop: 100 },
  closeBtn: { position: 'absolute', top: 60, right: 25, backgroundColor: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 12 },
  closeText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  modalTitle: { color: '#FFF', fontSize: 42, fontWeight: '900', marginBottom: 40, textAlign: 'center' },
  gameItem: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 30, borderRadius: 28, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  gameName: { color: '#FFF', fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  gamePlayArea: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  gameInstruction: { color: '#FFF', fontSize: 24, marginBottom: 50, fontWeight: '700', textAlign: 'center' },
  breathOrb: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#818CF8' },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', width: 280 },
  tile: { width: 60, height: 60, backgroundColor: 'rgba(255,255,255,0.1)', margin: 5, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  tileFlipped: { backgroundColor: '#10B981' },
  tileText: { fontSize: 28 }
});