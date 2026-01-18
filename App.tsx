
import React, { useState, useEffect, useRef } from 'react';
import { 
  BrainCircuit, 
  Send, 
  LayoutDashboard, 
  FileText, 
  History, 
  ShieldCheck, 
  TrendingUp, 
  AlertCircle, 
  Sparkles, 
  ChevronRight, 
  Loader2, 
  RefreshCw, 
  Plus, 
  Link as LinkIcon,
  MessageSquare,
  CheckCircle2,
  CalendarDays,
  Paperclip,
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ClipboardCheck,
  Shield,
  Eye,
  Info,
  Layers,
  Globe,
  Trash2,
  Zap
} from 'lucide-react';
import { CareerEntry, EntryType, ConfidenceLevel, ProcessingState, AppraisalSummary } from './types';
import { captureEntryTool } from './tools/capture_entry';
import { selfCorrectionQueueTool } from './tools/self_correction_queue';
import { weeklyReflectionTool } from './tools/weekly_reflection';
import { attachEvidenceTool } from './tools/attach_evidence';
import { generateAppraisalSummaryTool } from './tools/generate_appraisal_summary';

const TIMEZONES = [
  { label: 'Eastern Time (EST)', value: 'America/New_York' },
  { label: 'Central Time (CST)', value: 'America/Chicago' },
  { label: 'Mountain Time (MST)', value: 'America/Denver' },
  { label: 'Pacific Time (PST)', value: 'America/Los_Angeles' },
  { label: 'UTC', value: 'UTC' },
  { label: 'London (GMT)', value: 'Europe/London' },
  { label: 'Tokyo (JST)', value: 'Asia/Tokyo' },
];

const App: React.FC = () => {
  const [entries, setEntries] = useState<CareerEntry[]>([]);
  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'appraisal' | 'reflection'>('dashboard');
  const [processing, setProcessing] = useState<ProcessingState>({ isProcessing: false, status: '' });
  const [summary, setSummary] = useState<AppraisalSummary | null>(null);
  const [reflectionSummary, setReflectionSummary] = useState<string | null>(null);
  const [clarificationResponse, setClarificationResponse] = useState<Record<string, string>>({});
  const [evidenceInput, setEvidenceInput] = useState('');
  const [showGuardrails, setShowGuardrails] = useState(false);
  const [timezone, setTimezone] = useState('America/New_York');
  const [showAgentBanner, setShowAgentBanner] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedEntries = localStorage.getItem('career_track_memory_v10');
    const savedReflection = localStorage.getItem('career_track_reflection_v10');
    const savedTimezone = localStorage.getItem('career_track_timezone');
    if (savedEntries) setEntries(JSON.parse(savedEntries));
    if (savedReflection) setReflectionSummary(savedReflection);
    if (savedTimezone) setTimezone(savedTimezone);
  }, []);

  useEffect(() => {
    localStorage.setItem('career_track_memory_v10', JSON.stringify(entries));
    if (reflectionSummary) localStorage.setItem('career_track_reflection_v10', reflectionSummary);
    localStorage.setItem('career_track_timezone', timezone);

    // SCREEN 3: Autonomous Trigger Logic
    const count = entries.length;
    if (count > 0 && count % 3 === 0) {
      const lastBannerCount = localStorage.getItem('last_agent_banner_at');
      if (lastBannerCount !== String(count)) {
        setShowAgentBanner(true);
      }
    }
  }, [entries, reflectionSummary, timezone]);

  const clearMemory = () => {
    if (confirm("Delete all career memories and reset the agent? This cannot be undone.")) {
      setEntries([]);
      setSummary(null);
      setReflectionSummary(null);
      setClarificationResponse({});
      localStorage.removeItem('career_track_memory_v10');
      localStorage.removeItem('career_track_reflection_v10');
      localStorage.removeItem('last_agent_banner_at');
      setShowAgentBanner(false);
      setActiveTab('dashboard');
    }
  };

  const handleTriggerRefinement = async () => {
    setShowAgentBanner(false);
    localStorage.setItem('last_agent_banner_at', String(entries.length));
    
    // Find a low confidence entry to refine
    const target = entries.find(e => e.confidence_score === ConfidenceLevel.LOW && !e.clarification_question) || entries[0];
    if (!target) return;

    setProcessing({ isProcessing: true, status: 'Agent: Analyzing memory for refinement...' });
    try {
      const correction = await selfCorrectionQueueTool(target);
      setEntries(prev => prev.map(e => e.entry_id === target.entry_id ? { ...e, clarification_question: correction.question } : e));
      setActiveTab('dashboard');
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing({ isProcessing: false, status: '' });
    }
  };

  const formatWithTimezone = (dateStr: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(dateStr));
    } catch (e) {
      return dateStr;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || processing.isProcessing) return;

    setProcessing({ isProcessing: true, status: 'Agent: Capturing entry...' });
    try {
      const result = await captureEntryTool(input, new Date().toISOString(), timezone);
      
      let newEntry: CareerEntry = {
        entry_id: result.entry_id || Math.random().toString(36).substr(2, 9),
        timestamp: result.timestamp || new Date().toISOString(),
        raw_input: input,
        thought_signature: result.thought_signature,
        category: result.category as EntryType,
        skills: result.skills || [],
        impact_summary: result.impact_summary,
        confidence_score: result.confidence_score as ConfidenceLevel,
        evidence_links: result.evidence_links || [],
        refinement_state: 'pending'
      };

      if (newEntry.confidence_score === ConfidenceLevel.LOW) {
        setProcessing({ isProcessing: true, status: 'Agent: Requesting clarification...' });
        try {
          const correction = await selfCorrectionQueueTool(newEntry);
          newEntry.clarification_question = correction.question;
        } catch (err) {
          console.warn(err);
        }
      }

      setEntries(prev => [newEntry, ...prev]);
      setInput('');
    } catch (error) {
      console.error(error);
    } finally {
      setProcessing({ isProcessing: false, status: '' });
    }
  };

  const submitClarification = async (id: string) => {
    const responseText = clarificationResponse[id];
    if (!responseText || !responseText.trim()) return;

    setProcessing({ isProcessing: true, status: 'Agent: Updating memory...' });
    setEntries(prev => prev.map(e => {
      if (e.entry_id === id) {
        return {
          ...e,
          user_clarification_response: responseText,
          confidence_score: ConfidenceLevel.HIGH,
          refinement_state: 'pending'
        };
      }
      return e;
    }));
    setClarificationResponse(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setProcessing({ isProcessing: false, status: '' });
  };

  const handleWeeklyReflection = async () => {
    if (entries.length === 0 || processing.isProcessing) return;
    setProcessing({ isProcessing: true, status: 'Agent: Performing weekly reflection...' });
    try {
      const { refined_entries, reflection_summary } = await weeklyReflectionTool(entries, timezone);
      setEntries(refined_entries);
      setReflectionSummary(reflection_summary);
      setActiveTab('reflection');
    } catch (error) {
      console.error(error);
    } finally {
      setProcessing({ isProcessing: false, status: '' });
    }
  };

  const handleGenerateSummary = async () => {
    if (entries.length === 0 || processing.isProcessing) return;
    setProcessing({ isProcessing: true, status: 'Agent: Synthesizing appraisal...' });
    try {
      const result = await generateAppraisalSummaryTool(entries);
      setSummary(result);
      setActiveTab('appraisal');
    } catch (error) {
      console.error(error);
    } finally {
      setProcessing({ isProcessing: false, status: '' });
    }
  };

  const processEvidence = async (artifact: string, mimeType: string, label: string) => {
    try {
      const result = await attachEvidenceTool(artifact, entries, mimeType);
      
      if (result.is_match) {
        setProcessing({ isProcessing: true, status: `Agent: Matching evidence...` });
        setEntries(prev => prev.map(e => {
          if (e.entry_id === result.match_id) {
            return {
              ...e,
              evidence_links: [...(e.evidence_links || []), label],
              confidence_score: result.suggested_confidence as ConfidenceLevel,
              refinement_state: 'refined'
            };
          }
          return e;
        }));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setProcessing({ isProcessing: false, status: '' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      setEvidenceInput('');
    }
  };

  const handleLinkEvidence = async () => {
    if (!evidenceInput.trim() || entries.length === 0) return;
    setProcessing({ isProcessing: true, status: 'Agent: Analyzing link...' });
    await processEvidence(evidenceInput, 'text/plain', evidenceInput);
  };

  const handleEvidenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || entries.length === 0) return;
    setProcessing({ isProcessing: true, status: 'Agent: Analyzing artifact...' });
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      await processEvidence(base64, file.type, file.name);
    };
    reader.readAsDataURL(file);
  };

  const stats = {
    achievements: entries.filter(e => (e.category || '').toLowerCase().trim() === EntryType.ACHIEVEMENT).length,
    challenges: entries.filter(e => (e.category || '').toLowerCase().trim() === EntryType.CHALLENGE).length,
    learnings: entries.filter(e => (e.category || '').toLowerCase().trim() === EntryType.LEARNING).length,
    pendingClarifications: entries.filter(e => e.clarification_question && !e.user_clarification_response).length,
    withEvidence: entries.filter(e => (e.evidence_links || []).length > 0).length,
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-900 font-sans">
      <nav className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-auto md:h-screen z-20">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-indigo-100 shadow-lg">
            <BrainCircuit size={24} />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight text-slate-900">CareerTrack</h1>
            <p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest">Memory Agent v4.2</p>
          </div>
        </div>

        <div className="flex-1 p-4 space-y-1">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20} />} label="Dashboard" />
          <NavItem active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History size={20} />} label="Memory Log" />
          <NavItem active={activeTab === 'reflection'} onClick={() => setActiveTab('reflection')} icon={<Layers size={20} />} label="Reflections" />
          <NavItem active={activeTab === 'appraisal'} onClick={() => setActiveTab('appraisal')} icon={<FileText size={20} />} label="Appraisal Sync" />
        </div>

        <div className="p-4 border-t border-slate-100 space-y-3">
           <div className="px-2 pb-2">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Timezone</label>
             <div className="relative group">
               <Globe size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
               <select 
                 value={timezone} 
                 onChange={(e) => setTimezone(e.target.value)}
                 className="w-full bg-slate-50 border border-slate-100 rounded-lg pl-8 pr-2 py-1.5 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 appearance-none cursor-pointer hover:bg-slate-100 transition-all"
               >
                 {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
               </select>
             </div>
           </div>
           
           <div className="flex gap-2">
             <button 
               onClick={handleWeeklyReflection}
               disabled={processing.isProcessing || entries.length === 0}
               className="flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold transition-all disabled:opacity-50"
             >
               <CalendarDays size={18} />
             </button>
             <button 
               onClick={clearMemory}
               className="flex items-center justify-center py-3 px-3 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-all"
               title="Clear All Memory"
             >
               <Trash2 size={18} />
             </button>
           </div>
           
           <div className="bg-indigo-50/50 p-4 rounded-xl flex items-center gap-3 border border-indigo-100 shadow-sm">
              <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></div>
              <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Agent Logic Active</span>
           </div>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto relative">
        <div className="max-w-5xl mx-auto p-4 md:p-10">
          
          {processing.isProcessing && (
            <div className="fixed bottom-6 right-6 bg-white border border-slate-200 shadow-2xl rounded-2xl p-5 flex items-center gap-5 z-50 animate-in fade-in slide-in-from-bottom-4 ring-1 ring-black/5">
              <div className="bg-indigo-50 p-3 rounded-full">
                <Loader2 className="animate-spin text-indigo-600" size={24} />
              </div>
              <div>
                <p className="text-sm font-black text-slate-900 uppercase tracking-widest">{processing.status}</p>
                <p className="text-xs text-slate-500 font-medium italic">Autonomous reasoning in progress...</p>
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              
              {/* SCREEN 3: Autonomous Agent Banner */}
              {showAgentBanner && (
                <div className="bg-white border-2 border-indigo-600 p-8 rounded-[40px] shadow-[0_32px_64px_-16px_rgba(79,70,229,0.2)] flex flex-col md:flex-row items-center gap-6 animate-in slide-in-from-top-6 duration-500 relative ring-8 ring-indigo-50/50">
                  <div className="absolute -top-3 left-10 px-4 py-1 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg">
                    Agent Insight
                  </div>
                  <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
                    <Zap size={32} fill="currentColor" />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <p className="text-lg font-black tracking-tight leading-tight text-slate-900 mb-1">Memory Refinement Available</p>
                    <p className="text-sm font-bold text-slate-500 leading-relaxed">You've logged {entries.length} items. Want to clarify one to improve your appraisal quality?</p>
                  </div>
                  <div className="flex gap-3 w-full md:w-auto">
                    <button 
                      onClick={handleTriggerRefinement}
                      className="flex-1 px-8 py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95"
                    >
                      Refine
                    </button>
                    <button 
                      onClick={() => { setShowAgentBanner(false); localStorage.setItem('last_agent_banner_at', String(entries.length)); }}
                      className="flex-1 px-8 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-slate-200 transition-all active:scale-95"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}

              <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter">Live Session</span>
                    <span className="text-slate-300">/</span>
                    <button 
                      onClick={() => setShowGuardrails(!showGuardrails)}
                      className="text-indigo-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:bg-indigo-50 px-2 py-0.5 rounded transition-colors"
                    >
                      <Shield size={10} /> Safety Guardrails
                    </button>
                  </div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight">Activity Stream</h2>
                  <p className="text-slate-500 mt-1 text-lg font-medium">Capture your progress. Current Time: {formatWithTimezone(new Date().toISOString())}</p>
                </div>
                <button 
                  onClick={handleGenerateSummary}
                  disabled={entries.length === 0}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 shadow-xl shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-widest text-sm disabled:opacity-50"
                >
                  <Sparkles size={18} />
                  Synthesize Appraisal
                </button>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 bg-white rounded-[40px] shadow-sm border border-slate-200 p-8 md:p-10 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">New Entry</h3>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="relative group">
                      <textarea 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="What did you work on today? Focus on the activity, I'll infer the impact."
                        className="w-full h-44 p-7 bg-slate-50 border-none rounded-[32px] focus:ring-4 focus:ring-indigo-100 resize-none text-[#111827] placeholder:text-slate-200 text-xl font-bold leading-relaxed shadow-inner transition-all group-hover:bg-slate-50/80"
                      ></textarea>
                      <button 
                        type="submit"
                        disabled={!input.trim() || processing.isProcessing}
                        className="absolute bottom-6 right-6 bg-[#0F172A] text-white p-4 rounded-2xl hover:bg-indigo-600 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 hover:-translate-y-1 active:translate-y-0"
                      >
                        <Send size={28} />
                      </button>
                    </div>
                  </form>
                </div>

                <div className="lg:col-span-4 bg-white rounded-[40px] shadow-sm border border-slate-200 p-8 md:p-10 flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Attach Artifact</h3>
                    <div className="space-y-4">
                      <div className="relative">
                        <input 
                          type="text" 
                          value={evidenceInput}
                          onChange={(e) => setEvidenceInput(e.target.value)}
                          placeholder="Evidence URL..."
                          className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-100 pr-12 shadow-inner"
                        />
                        <button 
                          onClick={handleLinkEvidence}
                          disabled={!evidenceInput.trim() || entries.length === 0}
                          className="absolute right-2 top-2 p-2 text-indigo-600 hover:bg-indigo-100 rounded-xl disabled:opacity-30 transition-colors"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleEvidenceUpload} />
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={entries.length === 0}
                        className="w-full flex items-center justify-center gap-3 py-4 px-4 rounded-2xl border-2 border-dashed border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group disabled:opacity-30"
                      >
                        <ImageIcon size={20} className="group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-black uppercase tracking-widest">Upload File</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {stats.pendingClarifications > 0 && (
                <div className="space-y-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3 ml-2">
                    <MessageSquare size={16} className="text-amber-500" /> Self-Correction Queue
                  </h3>
                  {entries.filter(e => e.clarification_question && !e.user_clarification_response).map(e => (
                    <div key={e.entry_id} className="bg-white border border-slate-200 rounded-[32px] p-8 animate-in slide-in-from-left-4 shadow-xl shadow-amber-900/5 relative overflow-hidden">
                       <div className="absolute top-0 left-0 h-full w-2 bg-amber-400"></div>
                       <div className="flex flex-col md:flex-row gap-8 items-start">
                         <div className="flex-1">
                            <p className="text-[10px] font-black text-amber-600 uppercase mb-3 tracking-[0.2em]">Clarification Requested</p>
                            <p className="text-xl text-slate-900 font-bold mb-6">"{e.clarification_question}"</p>
                            <div className="flex gap-4">
                                <input 
                                  type="text" 
                                  value={clarificationResponse[e.entry_id] || ''}
                                  onChange={(ev) => setClarificationResponse(prev => ({ ...prev, [e.entry_id]: ev.target.value }))}
                                  onKeyDown={(ev) => ev.key === 'Enter' && submitClarification(e.entry_id)}
                                  placeholder="Provide context..."
                                  className="flex-1 bg-slate-50 border-none rounded-2xl px-6 py-4 text-base font-medium focus:outline-none focus:ring-4 focus:ring-amber-100 shadow-inner"
                                />
                                <button 
                                  onClick={() => submitClarification(e.entry_id)}
                                  className="bg-amber-500 text-white px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg shadow-amber-100"
                                >
                                  Update
                                </button>
                            </div>
                         </div>
                       </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <StatCard title="Achievements" value={stats.achievements} icon={<ShieldCheck className="text-emerald-500" />} color="emerald" />
                <StatCard title="Challenges" value={stats.challenges} icon={<AlertCircle className="text-amber-500" />} color="amber" />
                <StatCard title="Learnings" value={stats.learnings} icon={<TrendingUp className="text-blue-500" />} color="blue" />
                <StatCard title="Evidence" value={stats.withEvidence} icon={<Paperclip className="text-indigo-500" />} color="indigo" />
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="animate-in fade-in duration-500 space-y-10">
              <header className="flex items-center justify-between">
                <div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight">Memory Log</h2>
                  <p className="text-slate-500 mt-1 font-medium italic">Confidence indicators reflect agent reasoning strength.</p>
                </div>
              </header>

              <div className="space-y-8">
                {entries.map(entry => (
                  <div key={entry.entry_id} className={`bg-white p-10 rounded-[40px] border border-slate-200 shadow-sm hover:border-indigo-200 transition-all group ${entry.confidence_score === ConfidenceLevel.LOW ? 'ring-2 ring-amber-100 ring-offset-0' : ''}`}>
                    <div className="flex flex-col lg:flex-row gap-12">
                      <div className="flex-1 space-y-6">
                        <div className="flex flex-wrap items-center gap-4">
                          <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            (entry.category || '').toLowerCase().trim() === EntryType.ACHIEVEMENT ? 'bg-emerald-100 text-emerald-700' :
                            (entry.category || '').toLowerCase().trim() === EntryType.CHALLENGE ? 'bg-amber-100 text-amber-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {entry.category}
                          </span>
                          <span className="text-xs text-slate-400 font-mono font-bold">
                            {formatWithTimezone(entry.timestamp)}
                          </span>
                          <div className="flex items-center gap-3 ml-auto">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Confidence</span>
                            <ConfidenceIndicator level={entry.confidence_score} />
                          </div>
                        </div>
                        <p className="text-lg text-slate-600 leading-relaxed italic border-l-8 border-indigo-50 pl-8 py-3 bg-slate-50/30 rounded-r-[32px]">
                          "{entry.raw_input}"
                        </p>
                        <div className="pt-4 space-y-4">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Agent Inferred Impact</p>
                          <p className="text-lg text-slate-800 font-bold leading-relaxed bg-slate-50 p-6 rounded-[32px] border border-slate-100 shadow-inner">
                            {entry.impact_summary}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'reflection' && (
            <div className="animate-in fade-in duration-500 space-y-10">
              <header>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight">Agent Reflections</h2>
              </header>

              {reflectionSummary ? (
                <div className="bg-white border border-slate-200 rounded-[60px] p-12 md:p-16 shadow-xl shadow-indigo-900/5">
                  <h3 className="text-indigo-600 font-black text-xs uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                    <Sparkles size={16} /> Analysis Output
                  </h3>
                  <p className="text-2xl font-bold leading-relaxed text-slate-800">
                    {reflectionSummary}
                  </p>
                </div>
              ) : (
                <div className="text-center py-32 bg-white rounded-[60px] border border-slate-200 shadow-sm">
                  <Layers className="mx-auto text-slate-100 mb-8" size={100} />
                  <h3 className="text-slate-800 text-3xl font-black mb-4">No Reflections Yet</h3>
                </div>
              )}
            </div>
          )}

          {activeTab === 'appraisal' && (
            <div className="animate-in fade-in duration-500 space-y-10 pb-20">
               <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight">Appraisal Sync</h2>
                </div>
                <button 
                  onClick={handleGenerateSummary}
                  disabled={entries.length === 0 || processing.isProcessing}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 shadow-xl shadow-indigo-200 transition-all disabled:opacity-50 active:scale-95 uppercase tracking-widest text-sm"
                >
                  <RefreshCw size={18} className={processing.isProcessing ? 'animate-spin' : ''} />
                  Regenerate Sync
                </button>
              </header>

              {summary && (
                <div className="space-y-12 animate-in zoom-in-95">
                   <div className="bg-gradient-to-br from-indigo-600 to-violet-900 p-12 md:p-16 rounded-[60px] text-white shadow-2xl">
                    <h3 className="text-indigo-200 text-xs font-black uppercase tracking-[0.3em] mb-6">Executive Summary</h3>
                    <p className="text-2xl md:text-4xl font-black leading-tight">{summary.executiveSummary}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const NavItem: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 group ${active ? 'bg-indigo-50 text-indigo-700 shadow-indigo-100/50 shadow-md ring-1 ring-indigo-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
    <span className={`${active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`}>{icon}</span>
    <span className="text-sm font-black tracking-widest uppercase">{label}</span>
  </button>
);

const ConfidenceIndicator: React.FC<{ level: ConfidenceLevel }> = ({ level }) => {
  const bars = level === ConfidenceLevel.HIGH ? 3 : level === ConfidenceLevel.MEDIUM ? 2 : 1;
  const colorClass = level === ConfidenceLevel.HIGH ? 'bg-indigo-500' : level === ConfidenceLevel.MEDIUM ? 'bg-amber-400' : 'bg-red-400';
  const label = level === ConfidenceLevel.HIGH ? 'High' : level === ConfidenceLevel.MEDIUM ? 'Med' : 'Low';
  const textColor = level === ConfidenceLevel.HIGH ? 'text-indigo-600' : level === ConfidenceLevel.MEDIUM ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex gap-1 items-end h-3">
        {[1, 2, 3].map(i => (
          <div 
            key={i} 
            className={`w-1.5 rounded-full transition-all duration-500 ${i <= bars ? colorClass : 'bg-slate-100'}`} 
            style={{ height: `${(i / 3) * 100}%` }}
          />
        ))}
      </div>
      <span className={`text-[10px] font-black uppercase tracking-tighter w-8 ${textColor}`}>{label}</span>
    </div>
  );
};

const StatCard: React.FC<{ title: string, value: number, icon: React.ReactNode, color: string }> = ({ title, value, icon, color }) => {
  return (
    <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm group hover:shadow-xl transition-all relative overflow-hidden">
      <div className="flex justify-between items-start mb-8">
        <div className="p-4 rounded-3xl bg-slate-50 border border-slate-100 shadow-sm">
          {icon}
        </div>
      </div>
      <div className="flex items-end justify-between">
        <h4 className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em]">{title}</h4>
        <span className="text-5xl font-black text-slate-900 leading-none tracking-tighter">{value}</span>
      </div>
    </div>
  );
};

export default App;
