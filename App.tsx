
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Layout, Calculator, Settings, CloudSync, Wifi, WifiOff, History, Loader2, Calendar, Banknote, ShieldCheck, MapPin, BarChart3, CloudUpload } from 'lucide-react';
import { View, HarvestEntry, HarvestSettings } from './types';
import { DBService } from './db';
import { ControlPanel } from './components/ControlPanel';
import { CrateEntry } from './components/CrateEntry';
import { AbstractScreen } from './components/AbstractScreen';
import { SyncManager } from './components/SyncManager';
import { LogScreen } from './components/LogScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { RevenueScreen } from './components/RevenueScreen';
import { GoogleGenAI } from "@google/genai";

interface WeatherData {
  temp: number;
  condition: string;
  vibe: 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'windy';
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.ENTRY);
  const [settings, setSettings] = useState<HarvestSettings>(DBService.getSettings());
  const [entries, setEntries] = useState<HarvestEntry[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [lastWeatherFetch, setLastWeatherFetch] = useState<number>(0);

  const syncingRef = useRef(false);

  useEffect(() => {
    const handleViewportChange = () => {
      if (window.visualViewport) {
        setIsKeyboardVisible(window.visualViewport.height < window.innerHeight * 0.85);
      }
    };
    window.visualViewport?.addEventListener('resize', handleViewportChange);
    return () => window.visualViewport?.removeEventListener('resize', handleViewportChange);
  }, []);

  const activeEntries = useMemo(() => 
    entries.filter(e => e.farmName === settings.farmName && e.sessionName === settings.sessionName),
    [entries, settings.farmName, settings.sessionName]
  );

  const loadData = useCallback(async () => {
    try {
      const allEntries = await DBService.getAllEntries();
      setEntries(allEntries || []);
      setIsDbLoaded(true);
    } catch (err) {
      console.error(err);
      setIsDbLoaded(true); 
    }
  }, []);

  const performAutoSync = useCallback(async () => {
    if (!isOnline || syncingRef.current || !settings.googleSheetUrl) return;
    const unsynced = entries.filter(e => !e.synced);
    if (unsynced.length === 0) return;

    syncingRef.current = true;
    setIsSyncing(true);
    try {
      await fetch(settings.googleSheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(unsynced)
      });
      await DBService.markSynced(unsynced.map(e => e.id));
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [isOnline, entries, settings.googleSheetUrl, loadData]);

  useEffect(() => { if (isOnline) performAutoSync(); }, [isOnline, entries.length, performAutoSync]);

  const fetchWeather = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && weather && (now - lastWeatherFetch < 3600000)) return;
    if (!navigator.geolocation || loadingWeather) return;
    setLoadingWeather(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const res = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Current weather for ${pos.coords.latitude}, ${pos.coords.longitude}? JSON: {"temp": number, "condition": string, "vibe": "sunny"|"cloudy"|"rainy"|"stormy"|"windy"}.`,
          config: { tools: [{ googleSearch: {} }], responseMimeType: "application/json" },
        });
        const data = JSON.parse(res.text || '{}');
        if (data.temp) { setWeather(data); setLastWeatherFetch(now); }
      } catch (err) { console.error(err); }
      finally { setLoadingWeather(false); }
    }, () => setLoadingWeather(false));
  }, [weather, lastWeatherFetch, loadingWeather]);

  useEffect(() => {
    DBService.requestPersistence();
    loadData();
    fetchWeather();
    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, [loadData, fetchWeather]);

  /**
   * Propagates count changes retrospectively to all entries in the current session
   */
  const handleRetrospectiveUpdate = useCallback(async (newSettings: HarvestSettings) => {
    const targetTank = newSettings.activeTank;
    const newCount = newSettings.shrimpCount;
    
    // Find all entries in current session for this tank that have a different count
    const affectedEntries = entries.map(e => {
      const isSameSession = e.farmName === settings.farmName && e.sessionName === settings.sessionName;
      if (isSameSession && e.tank === targetTank && e.count !== newCount) {
        return { ...e, count: newCount, synced: false };
      }
      return e;
    });

    const changedEntries = affectedEntries.filter((e, i) => e !== entries[i]);
    
    if (changedEntries.length > 0) {
      await DBService.upsertEntries(changedEntries);
      setEntries(affectedEntries);
      console.log(`PWA: Retrospectively updated ${changedEntries.length} entries for ${targetTank}`);
    }
  }, [entries, settings.farmName, settings.sessionName]);

  const handleQuickUpdateSettings = (updates: Partial<HarvestSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...updates };
      
      // If count was changed, trigger retrospective update
      if (updates.shrimpCount !== undefined && updates.shrimpCount !== prev.shrimpCount) {
        handleRetrospectiveUpdate(next);
      }
      
      DBService.saveSettings(next);
      return next;
    });
  };

  const handleAddEntry = async (weight: number, crateCount: number) => {
    const newEntry = {
      id: DBService.generateId(), tank: settings.activeTank, count: settings.shrimpCount, weight,
      crateWeight: settings.crateWeight, crateCount, team: settings.teamName,
      timestamp: new Date().toISOString(), synced: false,
      farmName: settings.farmName, sessionName: settings.sessionName
    };
    await DBService.saveEntry(newEntry);
    setLastSaved(`${weight}kg`);
    setEntries(prev => [newEntry, ...prev]);
  };

  const getNavClass = (view: View) => 
    `flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-300 flex-1 ${
      currentView === view 
        ? 'text-white bg-blue-600 scale-110 active-nav-glow -translate-y-3 z-10' 
        : 'text-slate-400'
    }`;

  if (!isDbLoaded || isResetting) {
    return (
      <div className="h-screen w-screen bg-slate-900 flex flex-col items-center justify-center gap-6">
        <Loader2 className="w-16 h-16 text-orange-500 animate-spin" />
        <h2 className="text-xl font-black text-white uppercase tracking-[0.3em]">Shrimp Master</h2>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-slate-50">
      
      {/* PROFESSIONAL HEADER */}
      <header className={`bg-slate-900 px-6 py-4 flex items-center justify-between shrink-0 z-50 transition-all ${isKeyboardVisible ? 'py-2 opacity-90' : ''}`}>
        <div className="flex items-center gap-3">
          {/* Logo container updated to Orange (Copper) to match new logo */}
          <div className="bg-orange-500/10 p-0.5 rounded-full ring-2 ring-orange-500/20 shadow-xl shadow-orange-500/20 overflow-hidden">
            <img src="logo.png" alt="RR Logo" className="w-9 h-9 object-contain" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-[0.2em] text-white leading-none uppercase">SHRIMP MASTER PRO</h1>
            <p className="text-[10px] text-slate-500 uppercase font-bold mt-1.5 flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5 text-orange-500" /> {settings.farmName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {isSyncing && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_#3b82f6]" />}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase ${isOnline ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isOnline ? 'Online' : 'Offline Mode'}
          </div>
        </div>
      </header>

      {/* VIEWPORT WITH KINETIC TAB ENTRY */}
      <main className="flex-1 overflow-y-auto relative no-scrollbar bg-[#fcfdfe]">
        <div key={currentView} className="p-4 animate-reveal min-h-full">
          {currentView === View.ENTRY && (
            <CrateEntry 
              onSave={handleAddEntry} settings={settings} onUpdateSettings={handleQuickUpdateSettings}
              onChangeTank={() => setCurrentView(View.CONTROL)} lastSaved={lastSaved}
              entries={activeEntries} weather={weather} loadingWeather={loadingWeather}
              onRefreshWeather={() => fetchWeather(true)}
            />
          )}
          {currentView === View.LOG && (
            <LogScreen 
              entries={activeEntries} onDelete={async (id) => { await DBService.deleteEntry(id); loadData(); }} 
              onBatchDelete={async (ids) => { await DBService.deleteEntries(ids); loadData(); }} 
              onUpdate={async (e) => { await DBService.saveEntry(e); loadData(); }} 
            />
          )}
          {currentView === View.ABSTRACT && <AbstractScreen entries={activeEntries} prices={settings.tankPrices || {}} />}
          {currentView === View.REVENUE && (
            <RevenueScreen 
              entries={activeEntries} prices={settings.tankPrices || {}} 
              onUpdatePrice={(t, p) => handleQuickUpdateSettings({ tankPrices: { ...settings.tankPrices, [t]: p } })} 
            />
          )}
          {currentView === View.SYNC && <SyncManager entries={entries} settings={settings} onSyncComplete={loadData} onUpdateSettings={handleQuickUpdateSettings} />}
          {currentView === View.HISTORY && (
            <HistoryScreen 
              entries={entries} prices={settings.tankPrices || {}} 
              onDeleteSession={async (f, s) => { 
                const ids = entries.filter(e => e.farmName === f && e.sessionName === s).map(e => e.id);
                await DBService.deleteEntries(ids); loadData(); 
              }} 
            />
          )}
          {currentView === View.CONTROL && (
            <ControlPanel 
              initialSettings={settings} 
              onSave={(s) => { 
                handleRetrospectiveUpdate(s);
                setSettings(s); 
                DBService.saveSettings(s); 
                setCurrentView(View.ENTRY); 
              }} 
              onCancel={() => setCurrentView(View.ENTRY)} onReset={async () => { await DBService.nuclearReset(); window.location.reload(); }}
              installPrompt={null} isInstalled={true} onInstallTrigger={() => {}}
            />
          )}
        </div>
      </main>

      {/* INDUSTRIAL NAVIGATION BAR */}
      <nav className={`bg-white/95 backdrop-blur-3xl border-t flex justify-around items-center shrink-0 safe-area-bottom pb-6 pt-3 px-2 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-50 transition-all duration-500 transform ${isKeyboardVisible ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100 relative'}`}>
        <button onClick={() => setCurrentView(View.ENTRY)} className={getNavClass(View.ENTRY)}>
          <Calculator className="w-6 h-6 mb-1.5" />
          <span className="text-[9px] font-black uppercase tracking-tighter">Entry</span>
        </button>
        <button onClick={() => setCurrentView(View.LOG)} className={getNavClass(View.LOG)}>
          <History className="w-6 h-6 mb-1.5" />
          <span className="text-[9px] font-black uppercase tracking-tighter">Timeline</span>
        </button>
        <button onClick={() => setCurrentView(View.ABSTRACT)} className={getNavClass(View.ABSTRACT)}>
          <BarChart3 className="w-6 h-6 mb-1.5" />
          <span className="text-[9px] font-black uppercase tracking-tighter">Stats</span>
        </button>
        <button onClick={() => setCurrentView(View.REVENUE)} className={getNavClass(View.REVENUE)}>
          <Banknote className="w-6 h-6 mb-1.5" />
          <span className="text-[9px] font-black uppercase tracking-tighter">Settlement</span>
        </button>
        <button onClick={() => setCurrentView(View.SYNC)} className={getNavClass(View.SYNC)}>
          <CloudSync className="w-6 h-6 mb-1.5" />
          <span className="text-[9px] font-black uppercase tracking-tighter">Cloud</span>
        </button>
        <button onClick={() => setCurrentView(View.HISTORY)} className={getNavClass(View.HISTORY)}>
          <Calendar className="w-6 h-6 mb-1.5" />
          <span className="text-[9px] font-black uppercase tracking-tighter">Archive</span>
        </button>
        <button onClick={() => setCurrentView(View.CONTROL)} className={getNavClass(View.CONTROL)}>
          <Settings className="w-6 h-6 mb-1.5" />
          <span className="text-[9px] font-black uppercase tracking-tighter">Set</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
