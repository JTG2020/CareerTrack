
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
  Zap,
  Award,
  Target,
  LineChart,
  Search,
  ListChecks,
  Activity,
  History as HistoryIcon,
  MessageCircleQuestion,
  ListTodo,
  ShieldAlert
} from 'lucide-react';
import { CareerEntry, EntryType, ConfidenceLevel, ProcessingState, AppraisalSummary, AuditLogEntry } from './types';
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'appraisal' | 'reflection' | 'queue'>('dashboard');
  const [processing, setProcessing] = useState<ProcessingState>({ isProcessing: false, status: '' });
  const [summary, setSummary] = useState<AppraisalSummary | null>(null);
  const [reflectionData, setReflectionData] = useState<{
    summary: string | null;
    logs: string[];
  }>({ summary: null, logs: [] });
  
  const [clarificationResponse, setClarificationResponse] = useState<Record<string, string>>({});
  const [reflectionResponse, setReflectionResponse] = useState<Record<string, string>>({});
  const [evidenceInput, setEvidenceInput] = useState('');
  const [showGuardrails, setShowGuardrails] = useState(false);
  const [timezone, setTimezone] = useState('America/New_York');
  const [agentFeedback, setAgentFeedback] = useState<string | null>(null);
  
  const [pendingEntry, setPendingEntry] = useState<any | null>(null);
  const [duplicateQuestion, setDuplicateQuestion] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedEntries = localStorage.getItem('career_track_memory_v15');
    const savedReflection = localStorage.getItem('career_track_reflection_v15');
    const savedTimezone = localStorage.getItem('career_track_timezone_v15');
    const savedSummary = localStorage.getItem('career_track_summary_v15');
    if (savedEntries) setEntries(JSON.parse(savedEntries));
    if (savedReflection) setReflectionData(JSON.parse(savedReflection));
    if (savedTimezone) setTimezone(savedTimezone);
    if (savedSummary) setSummary(JSON.parse(savedSummary));
  }, []);

  useEffect(() => {
    localStorage.setItem('career_track_memory_v15', JSON.stringify(entries));
    localStorage.setItem('career_track_reflection_v15', JSON.stringify(reflectionData));
    if (summary) localStorage.setItem('career_track_summary_v15', JSON.stringify(summary));
    localStorage.setItem('career_track_timezone_v15', timezone);
  }, [entries, reflectionData, timezone, summary]);

  const clearMemory = () => {
    if (confirm("Delete all career memories and reset the agent?")) {
      setEntries([]);
      setSummary(null);
      setReflectionData({ summary: null, logs: [] });
      setClarificationResponse({});
      setReflectionResponse({});
      setAgentFeedback(null);
      localStorage.clear();
      setActiveTab('dashboard');
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
    } catch (e) { return dateStr; }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input || !input.trim() || processing.isProcessing) return;

    setAgentFeedback(null);
    setProcessing({ isProcessing: true, status: 'Agent: Validating input...' });
    try {
      const result = await captureEntryTool(input, entries, new Date().toISOString(), timezone);
      
      if (result.is_off_task) {
        setAgentFeedback(result.rejection_message || "This input doesn't appear to be a work activity. Please log an achievement, challenge, or learning.");
        setProcessing({ isProcessing: false, status: '' });
        return;
      }

      if (result.duplicate_risk_detected) {
        setPendingEntry(result);
        setDuplicateQuestion(result.duplicate_confirmation_question);
        setProcessing({ isProcessing: false, status: '' });
        return;
      }
      await commitEntry(result);
    } catch (error) {
      console.error(error);
      setProcessing({ isProcessing: false, status: '' });
    }
  };

  const commitEntry = async (entryData: any, isLinkedUpdate = false) => {
    setProcessing({ isProcessing: true, status: 'Agent: Capturing memory...' });
    const initialLog: AuditLogEntry = { timestamp: new Date().toISOString(), action: isLinkedUpdate ? 'Captured & Linked to existing memory' : 'Captured as new memory' };

    let newEntry: CareerEntry = {
      entry_id: entryData.entry_id || Math.random().toString(36).substr(2, 9),
      timestamp: entryData.timestamp || new Date().toISOString(),
      raw_input: entryData.raw_input,
      thought_signature: entryData.thought_signature,
      category: entryData.category as EntryType,
      skills: entryData.skills || [],
      impact_summary: entryData.impact_summary,
      confidence_score: entryData.confidence_score as ConfidenceLevel,
      evidence_links: entryData.evidence_links || [],
      refinement_state: isLinkedUpdate ? 'refined' : 'pending',
      audit_log: [initialLog]
    };

    if (newEntry.confidence_score === ConfidenceLevel.LOW) {
      setProcessing({ isProcessing: true, status: 'Agent: Requesting clarification...' });
      try {
        const correction = await selfCorrectionQueueTool(newEntry);
        newEntry.clarification_question = correction.question;
        newEntry.audit_log.push({ timestamp: new Date().toISOString(), action: 'Autonomous: Flagged low confidence, queued question', new_value: correction.question });
      } catch (err) { console.warn(err); }
    }

    setEntries(prev => [newEntry, ...prev]);
    setInput('');
    setPendingEntry(null);
    setDuplicateQuestion(null);
    setProcessing({ isProcessing: false, status: '' });
  };

  const submitClarification = async (id: string, text: string | undefined) => {
    if (!text || !text.trim()) return;
    setProcessing({ isProcessing: true, status: 'Agent: Updating memory...' });
    setEntries(prev => prev.map(e => {
      if (e.entry_id === id) {
        return {
          ...e,
          user_clarification_response: text,
          confidence_score: ConfidenceLevel.HIGH,
          refinement_state: 'pending',
          audit_log: [...(e.audit_log || []), { timestamp: new Date().toISOString(), action: 'User: Provided clarification', new_value: text }]
        };
      }
      return e;
    }));
    setClarificationResponse(prev => { const next = { ...prev }; delete next[id]; return next; });
    setProcessing({ isProcessing: false, status: '' });
  };

  const submitReflection = async (id: string, text: string | undefined) => {
    if (!text || !text.trim()) return;
    setProcessing({ isProcessing: true, status: 'Agent: Updating memory from reflection...' });
    setEntries(prev => prev.map(e => {
      if (e.entry_id === id) {
        return {
          ...e,
          user_clarification_response: text,
          reflection_question: undefined,
          refinement_state: 'pending',
          audit_log: [...(e.audit_log || []), { timestamp: new Date().toISOString(), action: 'User: Provided reflection answer', new_value: text }]
        };
      }
      return e;
    }));
    setReflectionResponse(prev => { const next = { ...prev }; delete next[id]; return next; });
    setProcessing({ isProcessing: false, status: '' });
  };

  const handleWeeklyReflection = async () => {
    if (entries.length === 0 || processing.isProcessing) return;
    setProcessing({ isProcessing: true, status: 'Agent: Performing weekly reflection...' });
    try {
      const result = await weeklyReflectionTool(entries, timezone);
      setEntries(result.refined_entries);
      setReflectionData({ summary: result.reflection_summary, logs: result.change_log });
      setActiveTab('reflection');
    } catch (error) { console.error(error); } finally { setProcessing({ isProcessing: false, status: '' }); }
  };

  const handleGenerateSummary = async () => {
    if (entries.length === 0 || processing.isProcessing) return;
    setProcessing({ isProcessing: true, status: 'Agent: Synthesizing appraisal...' });
    try {
      const result = await generateAppraisalSummaryTool(entries);
      setSummary(result);
      setActiveTab('appraisal');
    } catch (error) { console.error(error); } finally { setProcessing({ isProcessing: false, status: '' }); }
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
              refinement_state: 'refined',
              audit_log: [...(e.audit_log || []), { timestamp: new Date().toISOString(), action: `Autonomous: Attached evidence: ${label}`, new_value: result.reasoning }]
            };
          }
          return e;
        }));
      }
    } catch (error) { console.error(error); } finally { setProcessing({ isProcessing: false, status: '' }); if (fileInputRef.current) fileInputRef.current.value = ''; setEvidenceInput(''); }
  };

  const handleLinkEvidence = async () => { if (!evidenceInput || !evidenceInput.trim() || entries.length === 0) return; setProcessing({ isProcessing: true, status: 'Agent: Analyzing link...' }); await processEvidence(evidenceInput, 'text/plain', evidenceInput); };

  const stats = {
    achievements: entries.filter(e => (e.category || '').toLowerCase().trim() === EntryType.ACHIEVEMENT).length,
    pendingActions: entries.filter(e => (e.clarification_question || e.reflection_question) && !e.user_clarification_response).length,
    withEvidence: entries.filter(e => (e.evidence_links || []).length > 0).length,
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-900 font-sans">
      <nav className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-auto md:h-screen z-20 shadow-sm">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-lg"><BrainCircuit size={24} /></div>
          <div><h1 className="font-bold text-xl tracking-tight text-slate-900">CareerTrack</h1><p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest">Memory Agent v4.2</p></div>
        </div>
        <div className="flex-1 p-4 space-y-1">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20} />} label="Dashboard" />
          <NavItem active={activeTab === 'queue'} onClick={() => setActiveTab('queue')} icon={<ListTodo size={20} />} label="Refinement Queue" badge={stats.pendingActions} />
          <NavItem active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History size={20} />} label="Memory Log" />
          <NavItem active={activeTab === 'reflection'} onClick={() => setActiveTab('reflection')} icon={<Layers size={20} />} label="Reflections" />
          <NavItem active={activeTab === 'appraisal'} onClick={() => setActiveTab('appraisal')} icon={<FileText size={20} />} label="Appraisal Sync" />
        </div>
        <div className="p-4 border-t border-slate-100 space-y-3">
           <div className="px-2 pb-2">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Timezone</label>
             <div className="relative group"><Globe size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
               <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-lg pl-8 pr-2 py-1.5 text-xs font-bold text-slate-600 focus:outline-none appearance-none cursor-pointer hover:bg-slate-100 transition-all">
                 {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
               </select>
             </div>
           </div>
           <div className="flex gap-2">
             <button onClick={handleWeeklyReflection} disabled={processing.isProcessing || entries.length === 0} className="flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold transition-all disabled:opacity-50" title="Weekly Reflection"><CalendarDays size={18} /></button>
             <button onClick={clearMemory} className="flex items-center justify-center py-3 px-3 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-all" title="Clear All Memory"><Trash2 size={18} /></button>
           </div>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto relative">
        <div className="max-w-5xl mx-auto p-4 md:p-10">
          {processing.isProcessing && (
            <div className="fixed bottom-6 right-6 bg-white border border-slate-200 shadow-2xl rounded-2xl p-5 flex items-center gap-5 z-50 animate-in fade-in slide-in-from-bottom-4">
              <div className="bg-indigo-50 p-3 rounded-full"><Loader2 className="animate-spin text-indigo-600" size={24} /></div>
              <div><p className="text-sm font-black text-slate-900 uppercase tracking-widest">{processing.status}</p><p className="text-xs text-slate-500 font-medium italic">Autonomous reasoning in progress...</p></div>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              
              {showGuardrails && (
                <div className="bg-slate-900 text-white p-8 rounded-[40px] shadow-2xl animate-in slide-in-from-top-6 duration-300">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-2 text-indigo-400">
                      <Shield size={16} /> Agent Operating Guardrails
                    </h3>
                    <button onClick={() => setShowGuardrails(false)} className="text-slate-500 hover:text-white"><XCircle size={20} /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <GuardrailItem title="Acknowledged Uncertainty" description="If details are missing, the agent notes ambiguity rather than assuming success." />
                    <GuardrailItem title="Factual Fidelity" description="The agent strictly avoids exaggeration or inventing outcomes." />
                    <GuardrailItem title="Ownership Neutrality" description="Impact is reported neutrally; assumptions about recognition or promotion are prohibited." />
                    <GuardrailItem title="Prompt Policing" description="Non-career activities are rejected to maintain memory focus." />
                  </div>
                </div>
              )}

              {stats.pendingActions > 0 && (
                <div onClick={() => setActiveTab('queue')} className="bg-indigo-600 text-white p-6 rounded-[32px] shadow-xl shadow-indigo-100 flex items-center justify-between cursor-pointer hover:scale-[1.01] transition-all active:scale-[0.99] group">
                  <div className="flex items-center gap-5">
                    <div className="bg-white/20 p-3 rounded-2xl"><Zap size={24} className="animate-pulse" /></div>
                    <div>
                      <h3 className="font-black text-lg">Action Required</h3>
                      <p className="text-indigo-100 text-sm font-medium">You have {stats.pendingActions} pending refinements to improve your appraisal quality.</p>
                    </div>
                  </div>
                  <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
                </div>
              )}

              <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <button 
                      onClick={() => setShowGuardrails(!showGuardrails)}
                      className="text-indigo-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:bg-indigo-50 px-2 py-1 rounded transition-colors border border-indigo-100"
                    >
                      <Shield size={12} /> View Guardrails
                    </button>
                  </div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight">Activity Stream</h2>
                  <p className="text-slate-500 mt-1 text-lg font-medium">Capture your daily wins.</p>
                </div>
                <button onClick={handleGenerateSummary} disabled={entries.length === 0} className="bg-[#0F172A] hover:bg-slate-800 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 shadow-xl shadow-slate-200 transition-all uppercase tracking-widest text-sm disabled:opacity-50"><Sparkles size={18} />Synthesize Appraisal</button>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 bg-white rounded-[40px] shadow-sm border border-slate-200 p-8 md:p-10 hover:shadow-md transition-shadow relative overflow-hidden">
                  
                  {agentFeedback && (
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-300">
                      <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mb-6 shadow-inner ring-1 ring-indigo-100"><ShieldAlert size={32} /></div>
                      <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-3">Agent Guidance</h3>
                      <p className="text-2xl font-bold text-slate-900 leading-tight mb-8 max-w-md">{agentFeedback}</p>
                      <button onClick={() => { setAgentFeedback(null); setInput(''); }} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">Acknowledge</button>
                    </div>
                  )}

                  {duplicateQuestion && (
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-12 text-center">
                      <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-3xl flex items-center justify-center mb-6 shadow-inner ring-1 ring-amber-100"><AlertTriangle size={32} /></div>
                      <h3 className="text-[10px] font-black text-amber-600 uppercase tracking-[0.3em] mb-3">Duplicate Detection</h3>
                      <p className="text-2xl font-bold text-slate-900 leading-tight mb-10 max-w-md">{duplicateQuestion}</p>
                      <div className="flex gap-4 w-full max-w-sm">
                        <button onClick={() => commitEntry(pendingEntry, true)} className="flex-1 py-4 bg-amber-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all shadow-xl shadow-amber-100">Confirm & Link</button>
                        <button onClick={() => commitEntry(pendingEntry, false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Log as New</button>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-6"><h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">New Entry</h3></div>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="relative group">
                      <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="What did you work on today? (e.g. 'Reduced build time by 20%')" className="w-full h-44 p-7 bg-slate-50 border-none rounded-[32px] focus:ring-4 focus:ring-indigo-100 resize-none text-[#111827] placeholder:text-slate-200 text-xl font-bold leading-relaxed shadow-inner transition-all group-hover:bg-slate-50/80"></textarea>
                      <button type="submit" disabled={!input || !input.trim() || processing.isProcessing || !!duplicateQuestion || !!agentFeedback} className="absolute bottom-6 right-6 bg-indigo-600 text-white p-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50"><Send size={28} /></button>
                    </div>
                  </form>
                </div>

                <div className="lg:col-span-4 bg-white rounded-[40px] shadow-sm border border-slate-200 p-8 md:p-10 flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div><h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Attach Artifact</h3>
                    <div className="space-y-4">
                      <div className="relative"><input type="text" value={evidenceInput} onChange={(e) => setEvidenceInput(e.target.value)} placeholder="Evidence URL..." className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold shadow-inner" /><button onClick={handleLinkEvidence} disabled={!evidenceInput || !evidenceInput.trim() || entries.length === 0} className="absolute right-2 top-2 p-2 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-colors"><Plus size={20} /></button></div>
                    </div>
                  </div>
                  <div className="bg-indigo-50/30 p-6 rounded-[32px] border border-indigo-100/50 mt-6 flex items-start gap-4">
                    <Info size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-indigo-800 leading-relaxed font-medium">Log specific activities to help the agent build a factual case for your appraisal.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'queue' && (
            <div className="space-y-10 animate-in fade-in duration-500">
              <header>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight">Refinement Queue</h2>
                <p className="text-slate-500 mt-1 text-lg font-medium">Respond to agent prompts to strengthen your profile.</p>
              </header>

              {stats.pendingActions > 0 ? (
                <div className="space-y-8">
                  {entries.filter(e => (e.clarification_question || e.reflection_question) && !e.user_clarification_response).map(entry => {
                    const isClarification = !!entry.clarification_question;
                    const question = isClarification ? entry.clarification_question : entry.reflection_question;
                    const resValue = isClarification ? clarificationResponse[entry.entry_id] : reflectionResponse[entry.entry_id];
                    
                    return (
                      <div key={entry.entry_id} className="bg-white border border-slate-200 rounded-[40px] p-8 md:p-10 shadow-sm relative overflow-hidden group hover:shadow-xl hover:border-indigo-200 transition-all">
                        <div className={`absolute top-0 left-0 h-full w-2 ${isClarification ? 'bg-amber-400' : 'bg-indigo-500'}`}></div>
                        
                        <div className="flex flex-col gap-8">
                          <div className="space-y-4">
                            <div className="flex items-center gap-3">
                              <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isClarification ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                {isClarification ? 'Self-Correction' : 'Reflection'}
                              </span>
                              <span className="text-slate-300">/</span>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Original Entry Context</span>
                            </div>
                            <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 relative group-hover:bg-white transition-colors">
                              <p className="text-slate-600 italic font-medium leading-relaxed">"{entry.raw_input}"</p>
                              <div className="mt-3 flex gap-2">
                                <span className="bg-white px-3 py-1 rounded-lg text-[10px] font-bold text-slate-400 border border-slate-100">{entry.category}</span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-6">
                            <div className="flex items-center gap-3">
                               <div className={`p-2 rounded-xl ${isClarification ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                  {isClarification ? <Activity size={20} /> : <MessageCircleQuestion size={20} />}
                               </div>
                               <h3 className="text-2xl font-black text-slate-900 leading-tight">{question}</h3>
                            </div>
                            
                            <div className="flex flex-col md:flex-row gap-4">
                                <input 
                                  type="text" 
                                  value={resValue || ''}
                                  onChange={(ev) => {
                                    if (isClarification) {
                                      setClarificationResponse(prev => ({ ...prev, [entry.entry_id]: ev.target.value }));
                                    } else {
                                      setReflectionResponse(prev => ({ ...prev, [entry.entry_id]: ev.target.value }));
                                    }
                                  }}
                                  onKeyDown={(ev) => {
                                    if (ev.key === 'Enter') {
                                      isClarification ? submitClarification(entry.entry_id, resValue) : submitReflection(entry.entry_id, resValue);
                                    }
                                  }}
                                  placeholder={isClarification ? "Add metrics or outcomes..." : "Reflect on your impact..."}
                                  className="flex-1 bg-slate-50 border-none rounded-2xl px-6 py-4 text-base font-medium shadow-inner focus:ring-4 focus:ring-indigo-100 transition-all"
                                />
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => isClarification ? submitClarification(entry.entry_id, resValue) : submitReflection(entry.entry_id, resValue)}
                                    className={`flex-1 md:flex-none px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest text-white transition-all shadow-lg ${isClarification ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-100' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'}`}
                                  >
                                    Update Memory
                                  </button>
                                  {isClarification && (
                                    <button 
                                      onClick={() => setEntries(prev => prev.map(item => item.entry_id === entry.entry_id ? { ...item, user_clarification_response: 'skipped' } : item))}
                                      className="px-6 py-4 rounded-2xl bg-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                                    >
                                      Skip for Now
                                    </button>
                                  )}
                                </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-32 bg-white rounded-[60px] border border-slate-200 shadow-sm">
                  <div className="bg-emerald-50 text-emerald-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle size={40} />
                  </div>
                  <h3 className="text-slate-800 text-3xl font-black mb-2">Queue Empty</h3>
                  <p className="text-slate-500 font-medium">All memories are currently high confidence.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="animate-in fade-in duration-500 space-y-10">
              <header><h2 className="text-4xl font-black text-slate-900 tracking-tight">Memory Log</h2></header>
              <div className="space-y-8">
                {entries.map(entry => (
                  <div key={entry.entry_id} className={`bg-white p-10 rounded-[40px] border border-slate-200 shadow-sm hover:border-indigo-200 transition-all relative group overflow-hidden`}>
                    <div className="flex flex-col lg:flex-row gap-12">
                      <div className="flex-1 space-y-6">
                        <div className="flex flex-wrap items-center gap-4">
                          <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${entry.category === EntryType.ACHIEVEMENT ? 'bg-emerald-100 text-emerald-700' : entry.category === EntryType.CHALLENGE ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{entry.category}</span>
                          <span className="text-xs text-slate-400 font-mono font-bold">{formatWithTimezone(entry.timestamp)}</span>
                          <div className="flex items-center gap-3 ml-auto"><span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Confidence</span><ConfidenceIndicator level={entry.confidence_score} /></div>
                        </div>
                        <p className="text-lg text-slate-600 leading-relaxed italic border-l-8 border-indigo-50 pl-8 py-3 bg-slate-50/30 rounded-r-[32px]">"{entry.raw_input}"</p>
                        <div className="pt-4 space-y-4">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Agent Inferred Impact</p>
                          <p className="text-lg text-slate-800 font-bold leading-relaxed bg-slate-50 p-6 rounded-[32px] border border-slate-100 shadow-inner">{entry.impact_summary}</p>
                        </div>
                        {entry.audit_log && entry.audit_log.length > 0 && (
                          <div className="mt-8 pt-8 border-t border-slate-100">
                             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><HistoryIcon size={12} /> Agent Audit Trail</h4>
                             <div className="space-y-3">{entry.audit_log.slice(0, 5).map((log, idx) => (<div key={idx} className="text-xs flex gap-3 items-start"><span className="text-slate-300 shrink-0 font-mono">{formatWithTimezone(log.timestamp).split(',')[1]}</span><div><p className="text-slate-600 font-bold">{log.action}</p>{log.new_value && <p className="text-slate-400 italic mt-0.5">"{log.new_value}"</p>}</div></div>))}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'reflection' && (
            <div className="animate-in fade-in duration-500 space-y-10">
              <header><h2 className="text-4xl font-black text-slate-900 tracking-tight">Agent Reflections</h2></header>
              {reflectionData.summary ? (
                <div className="space-y-8">
                  <div className="bg-white border border-slate-200 rounded-[60px] p-12 md:p-16 shadow-xl shadow-indigo-900/5">
                    <h3 className="text-indigo-600 font-black text-xs uppercase tracking-[0.3em] mb-8 flex items-center gap-3"><Sparkles size={16} /> Weekly Analysis</h3>
                    <p className="text-2xl font-bold leading-relaxed text-slate-800">{reflectionData.summary}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-32 bg-white rounded-[60px] border border-slate-200 shadow-sm"><Layers className="mx-auto text-slate-100 mb-8" size={100} /><h3 className="text-slate-800 text-3xl font-black mb-4">No Reflections Yet</h3></div>
              )}
            </div>
          )}

          {activeTab === 'appraisal' && (
            <div className="animate-in fade-in duration-500 space-y-10 pb-20">
               <header className="flex flex-col md:flex-row md:items-end justify-between gap-6"><div><h2 className="text-4xl font-black text-slate-900 tracking-tight">Appraisal Sync</h2></div><button onClick={handleGenerateSummary} disabled={entries.length === 0 || processing.isProcessing} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 shadow-xl shadow-indigo-200 transition-all uppercase tracking-widest text-sm disabled:opacity-50"><RefreshCw size={18} className={processing.isProcessing ? 'animate-spin' : ''} />Regenerate Sync</button></header>
              {summary && (
                <div className="space-y-12 animate-in zoom-in-95">
                   <div className="bg-gradient-to-br from-indigo-600 to-violet-900 p-12 md:p-16 rounded-[60px] text-white shadow-2xl"><h3 className="text-indigo-200 text-xs font-black uppercase tracking-[0.3em] mb-6">Executive Summary</h3><p className="text-2xl md:text-4xl font-black leading-tight">{summary.executiveSummary}</p></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8"><SummaryCard title="Key Achievements" items={summary.keyAchievements} icon={<Award />} /><SummaryCard title="Areas for Development" items={summary.areasForDevelopment} icon={<Target />} /></div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const GuardrailItem: React.FC<{ title: string, description: string }> = ({ title, description }) => (
  <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
    <h4 className="text-indigo-400 font-black text-[10px] uppercase tracking-widest mb-1">{title}</h4>
    <p className="text-slate-400 text-xs leading-relaxed">{description}</p>
  </div>
);

const NavItem: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string, badge?: number }> = ({ active, onClick, icon, label, badge }) => (
  <button onClick={onClick} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all ${active ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
    <div className="flex items-center gap-3">
      <span className={active ? 'text-indigo-600' : 'text-slate-400'}>{icon}</span>
      {label}
    </div>
    {badge ? <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black animate-in zoom-in">{badge}</span> : null}
  </button>
);

const SummaryCard: React.FC<{ title: string, items: string[], icon: React.ReactNode }> = ({ title, items, icon }) => (
  <div className="bg-white border border-slate-200 rounded-[40px] p-10 shadow-sm"><h3 className="text-slate-900 text-xl font-black mb-6 flex items-center gap-3 uppercase tracking-widest"><span className="text-indigo-600">{icon}</span> {title}</h3><ul className="space-y-4">{items.map((item, i) => (<li key={i} className="flex gap-4 group"><div className="h-6 w-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5 font-black text-[10px]">{i + 1}</div><span className="text-slate-600 font-medium leading-snug group-hover:text-slate-900 transition-colors">{item}</span></li>))}</ul></div>
);

const ConfidenceIndicator: React.FC<{ level: ConfidenceLevel }> = ({ level }) => {
  const bars = level === ConfidenceLevel.HIGH ? 3 : level === ConfidenceLevel.MEDIUM ? 2 : 1;
  const colorClass = level === ConfidenceLevel.HIGH ? 'bg-indigo-500' : level === ConfidenceLevel.MEDIUM ? 'bg-amber-400' : 'bg-red-400';
  const label = level === ConfidenceLevel.HIGH ? 'High' : level === ConfidenceLevel.MEDIUM ? 'Med' : 'Low';
  const textColor = level === ConfidenceLevel.HIGH ? 'text-indigo-600' : level === ConfidenceLevel.MEDIUM ? 'text-amber-600' : 'text-red-600';
  return (<div className="flex items-center gap-2.5"><div className="flex gap-1 items-end h-3">{[1, 2, 3].map(i => (<div key={i} className={`w-1.5 rounded-full transition-all duration-500 ${i <= bars ? colorClass : 'bg-slate-100'}`} style={{ height: `${(i / 3) * 100}%` }} />))}</div><span className={`text-[10px] font-black uppercase tracking-tighter w-8 ${textColor}`}>{label}</span></div>);
};

const StatCard: React.FC<{ title: string, value: number, icon: React.ReactNode, color: string }> = ({ title, value, icon, color }) => {
  return (<div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm group hover:shadow-xl transition-all relative overflow-hidden"><div className="flex justify-between items-start mb-8"><div className="p-4 rounded-3xl bg-slate-50 border border-slate-100 shadow-sm">{icon}</div></div><div className="flex items-end justify-between"><h4 className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em]">{title}</h4><span className="text-5xl font-black text-slate-900 leading-none tracking-tighter">{value}</span></div></div>);
};

export default App;
