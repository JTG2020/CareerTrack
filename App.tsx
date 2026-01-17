
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
  Bell
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

/**
 * Main application component for CareerTrack Agent.
 * Handles state management for career entries, processing states, and tool interactions.
 */
const App: React.FC = () => {
  const [entries, setEntries] = useState<CareerEntry[]>([]);
  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'appraisal' | 'reflection'>('dashboard');
  const [processing, setProcessing] = useState<ProcessingState>({ isProcessing: false, status: '' });
  const [summary, setSummary] = useState<AppraisalSummary | null>(null);
  const [reflectionSummary, setReflectionSummary] = useState<string | null>(null);
  const [clarificationResponse, setClarificationResponse] = useState<Record<string, string>>({});
  const [evidenceInput, setEvidenceInput] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [agentFeedback, setAgentFeedback] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load state from local storage on mount
  useEffect(() => {
    const savedEntries = localStorage.getItem('career_track_memory_v8');
    const savedReflection = localStorage.getItem('career_track_reflection_v8');
    const savedTimezone = localStorage.getItem('career_track_timezone');
    if (savedEntries) {
      try {
        const parsed = JSON.parse(savedEntries);
        if (Array.isArray(parsed)) setEntries(parsed);
      } catch (e) {
        console.error("Failed to parse saved entries", e);
      }
    }
    if (savedReflection) setReflectionSummary(savedReflection);
    if (savedTimezone) setTimezone(savedTimezone);
  }, []);

  // Sync state to local storage on change
  useEffect(() => {
    localStorage.setItem('career_track_memory_v8', JSON.stringify(entries));
    if (reflectionSummary) localStorage.setItem('career_track_reflection_v8', reflectionSummary);
    localStorage.setItem('career_track_timezone', timezone);
  }, [entries, reflectionSummary, timezone]);

  /**
   * Formats a date string according to the user's selected timezone.
   */
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

  /**
   * Captures a new work entry and triggers self-correction agent if confidence is low.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || processing.isProcessing) return;

    setProcessing({ isProcessing: true, status: 'Agent: Analyzing input...' });
    setAgentFeedback(null);

    try {
      const result = await captureEntryTool(input, new Date().toISOString(), timezone, entries.length);
      
      // Intent Check: If agent thinks this is a command and not a log entry
      if (result.intent === 'meta_command') {
        setAgentFeedback({ message: result.feedback, type: 'info' });
        setProcessing({ isProcessing: false, status: '' });
        setInput('');
        return;
      }

      let newEntry: CareerEntry = {
        entry_id: result.entry_id || Math.random().toString(36).substr(2, 9),
        timestamp: result.timestamp || new Date().toISOString(),
        raw_input: input,
        thought_signature: result.thought_signature || 'generic_capture',
        category: (result.category as EntryType) || EntryType.ACHIEVEMENT,
        skills: Array.isArray(result.skills) ? result.skills : [],
        impact_summary: result.impact_summary || 'No impact recorded.',
        confidence_score: (result.confidence_score as ConfidenceLevel) || ConfidenceLevel.MEDIUM,
        evidence_links: Array.isArray(result.evidence_links) ? result.evidence_links : [],
        refinement_state: 'pending'
      };

      // TRIGGER RULE: Only fire clarification for LOW confidence.
      const shouldClarify = newEntry.confidence_score === ConfidenceLevel.LOW;

      if (shouldClarify) {
        setProcessing({ isProcessing: true, status: 'Agent: Requesting clarification...' });
        try {
          const correction = await selfCorrectionQueueTool(newEntry);
          newEntry.clarification_question = correction.question;
        } catch (err) {
          console.warn("Self-correction tool failed:", err);
        }
      }

      setEntries(prev => [newEntry, ...prev]);
      setAgentFeedback({ message: "Entry successfully logged to memory.", type: 'success' });
      setInput('');
    } catch (error) {
      console.error("Capture failed:", error);
      setAgentFeedback({ message: "Agent encountered an error processing your input.", type: 'error' });
    } finally {
      setProcessing({ isProcessing: false, status: '' });
      // Clear feedback after some time
      setTimeout(() => setAgentFeedback(null), 8000);
    }
  };

  /**
   * Submits a user's response to a clarifying question.
   */
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
          refinement_state: 'refined' // Marking as refined after update
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

  /**
   * Triggers the weekly reflection analysis tool.
   */
  const handleWeeklyReflection = async () => {
    if (entries.length === 0 || processing.isProcessing) {
      setAgentFeedback({ message: "No entries available to summarize. Please log some work activities first.", type: 'info' });
      return;
    }
    setProcessing({ isProcessing: true, status: 'Agent: Analyzing weekly performance...' });
    try {
      const { refined_entries, reflection_summary } = await weeklyReflectionTool(entries, timezone);
      setEntries(refined_entries);
      setReflectionSummary(reflection_summary);
      setActiveTab('reflection');
    } catch (error) {
      console.error("Reflection failed:", error);
    } finally {
      setProcessing({ isProcessing: false, status: '' });
    }
  };

  /**
   * Generates a formal appraisal report using the Gemini model.
   */
  const handleGenerateAppraisal = async () => {
    if (entries.length === 0 || processing.isProcessing) {
      setAgentFeedback({ message: "Cannot generate an appraisal without career memories. Please log work first.", type: 'info' });
      return;
    }
    setProcessing({ isProcessing: true, status: 'Agent: Drafting performance appraisal...' });
    try {
      const res = await generateAppraisalSummaryTool(entries);
      setSummary(res);
      setActiveTab('appraisal');
    } catch (error) {
      console.error("Appraisal generation failed:", error);
    } finally {
      setProcessing({ isProcessing: false, status: '' });
    }
  };

  /**
   * Attaches evidence (links/text) to the most relevant memory entry.
   */
  const handleAttachEvidence = async (artifact: string, mimeType: string = 'text/plain') => {
    if (entries.length === 0 || processing.isProcessing) return;
    setProcessing({ isProcessing: true, status: 'Agent: Auditing evidence...' });
    try {
      const result = await attachEvidenceTool(artifact, entries, mimeType);
      if (result.is_match && result.match_id) {
        setEntries(prev => prev.map(e => {
          if (e.entry_id === result.match_id) {
            const displayLink = mimeType.startsWith('image/') ? 'Screenshot Attached' : artifact;
            return {
              ...e,
              evidence_links: [...(e.evidence_links || []), displayLink],
              confidence_score: (result.suggested_confidence as ConfidenceLevel) || e.confidence_score,
              refinement_state: 'refined'
            };
          }
          return e;
        }));
        setAgentFeedback({ message: `Evidence linked to: "${result.reasoning}"`, type: 'success' });
      } else {
        setAgentFeedback({ message: "Could not find a clear match for this evidence. Please try logging a specific activity first.", type: 'info' });
      }
      setEvidenceInput('');
    } catch (error) {
      console.error("Evidence attachment failed:", error);
    } finally {
      setProcessing({ isProcessing: false, status: '' });
    }
  };

  /**
   * Handles file uploads (screenshots/documents) for evidence.
   */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      await handleAttachEvidence(base64, file.type);
    };
    reader.readAsDataURL(file);
    // Reset input
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navigation Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
              <BrainCircuit size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
                CareerTrack Agent
              </h1>
              <p className="text-xs text-slate-500 font-medium">Autonomous Career Memory & Appraisal</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full">
              <Globe size={14} className="text-slate-500" />
              <select 
                value={timezone} 
                onChange={(e) => setTimezone(e.target.value)}
                className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer"
              >
                {TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>
            {processing.isProcessing && (
              <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-xs font-bold whitespace-nowrap">{processing.status}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Agent Feedback Notification */}
        {agentFeedback && (
          <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${
            agentFeedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
            agentFeedback.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
            'bg-indigo-50 border-indigo-200 text-indigo-800'
          }`}>
            <Bell size={20} className={agentFeedback.type === 'error' ? 'text-rose-600' : 'text-indigo-600'} />
            <p className="text-sm font-semibold">{agentFeedback.message}</p>
            <button onClick={() => setAgentFeedback(null)} className="ml-auto text-slate-400 hover:text-slate-600">
              <XCircle size={16} />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Dashboard Sidebar */}
          <aside className="lg:col-span-3">
            <nav className="space-y-1">
              {[
                { id: 'dashboard', label: 'Capture & Stats', icon: LayoutDashboard },
                { id: 'history', label: 'Memory Log', icon: History },
                { id: 'reflection', label: 'Weekly Reflection', icon: Sparkles },
                { id: 'appraisal', label: 'Appraisal Report', icon: FileText },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    activeTab === tab.id 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                    : 'text-slate-600 hover:bg-white hover:shadow-sm'
                  }`}
                >
                  <tab.icon size={20} />
                  <span className="font-semibold">{tab.label}</span>
                </button>
              ))}
            </nav>

            <div className="mt-8 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-slate-800">
                <TrendingUp size={18} className="text-indigo-600" />
                <h3 className="font-bold">Stats Overview</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <span className="text-xs text-slate-500 font-medium">Total Entries</span>
                  <span className="text-sm font-bold text-slate-900">{entries?.length || 0}</span>
                </div>
                <div className="flex justify-between items-center px-1">
                  <span className="text-xs text-slate-500 font-medium">Achievements</span>
                  <span className="text-sm font-bold text-emerald-600">
                    {entries?.filter(e => e.category === EntryType.ACHIEVEMENT).length || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center px-1">
                  <span className="text-xs text-slate-500 font-medium">Challenges</span>
                  <span className="text-sm font-bold text-amber-600">
                    {entries?.filter(e => e.category === EntryType.CHALLENGE).length || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center px-1">
                  <span className="text-xs text-slate-500 font-medium">Learnings</span>
                  <span className="text-sm font-bold text-blue-600">
                    {entries?.filter(e => e.category === EntryType.LEARNING).length || 0}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-100 flex justify-between items-center px-1">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-tighter">Refined</span>
                  <span className="text-sm font-black text-indigo-600">
                    {entries?.filter(e => e.refinement_state === 'refined').length || 0}
                  </span>
                </div>
              </div>
            </div>
          </aside>

          {/* Tab Views */}
          <div className="lg:col-span-9 space-y-6">
            
            {activeTab === 'dashboard' && (
              <>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-6">
                    <Sparkles className="text-indigo-600" size={20} />
                    <h2 className="text-lg font-bold">Log New Work Activity</h2>
                  </div>
                  <form onSubmit={handleSubmit} className="relative">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="E.g., Delivered the payment integration service for the UK market. Reduced latency by 150ms using Redis caching."
                      className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none text-slate-700 leading-relaxed"
                    />
                    <div className="absolute bottom-3 right-3 flex gap-2">
                      <button
                        type="submit"
                        disabled={!input.trim() || processing.isProcessing}
                        className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-indigo-100"
                      >
                        {processing.isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                        Log Entry
                      </button>
                    </div>
                  </form>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-4 text-violet-600">
                        <RefreshCw size={20} />
                        <h3 className="font-bold">Weekly Reflection</h3>
                      </div>
                      <p className="text-sm text-slate-500 mb-6">
                        The agent will analyze your logs from the last 7 days, merge related tasks, and refine your impact statements.
                      </p>
                    </div>
                    <button 
                      onClick={handleWeeklyReflection}
                      disabled={processing.isProcessing}
                      className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 transition-all"
                    >
                      Trigger Weekly Audit
                    </button>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-4 text-indigo-600">
                        <FileText size={20} />
                        <h3 className="font-bold">Performance Appraisal</h3>
                      </div>
                      <p className="text-sm text-slate-500 mb-6">
                        Generate a professional summary for your manager based on all recorded career memories and evidence.
                      </p>
                    </div>
                    <button 
                      onClick={handleGenerateAppraisal}
                      disabled={processing.isProcessing}
                      className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-100"
                    >
                      Draft Appraisal Report
                    </button>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-slate-800">
                      <Paperclip size={20} className="text-indigo-600" />
                      <h3 className="font-bold">Attach Evidence Artifact</h3>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Supports Screenshots & Links</span>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={evidenceInput}
                      onChange={(e) => setEvidenceInput(e.target.value)}
                      placeholder="Paste a PR link, Jira URL, or achievement snippet..."
                      className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      className="hidden" 
                      accept="image/*,.pdf,.txt"
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all shadow-sm"
                      title="Upload Screenshot or Document"
                    >
                      <ImageIcon size={20} />
                    </button>
                    <button 
                      onClick={() => handleAttachEvidence(evidenceInput)}
                      disabled={!evidenceInput.trim() || processing.isProcessing}
                      className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 transition-all text-sm shadow-md"
                    >
                      Attach
                    </button>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'history' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <History size={24} className="text-indigo-600" />
                    Career Memory Log
                  </h2>
                </div>
                {!entries?.length ? (
                  <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-300 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                      <LayoutDashboard size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">No entries yet</h3>
                    <p className="text-slate-500 max-w-xs mx-auto mt-2">Start logging your work activities to build your career memory.</p>
                  </div>
                ) : (
                  entries.map((entry) => (
                    <div key={entry.entry_id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:border-indigo-200 transition-all">
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              entry.category === EntryType.ACHIEVEMENT ? 'bg-emerald-100 text-emerald-700' :
                              entry.category === EntryType.CHALLENGE ? 'bg-amber-100 text-amber-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {entry.category || 'achievement'}
                            </span>
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <CalendarDays size={12} />
                              {formatWithTimezone(entry.timestamp)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {entry.refinement_state === 'refined' && (
                              <span className="bg-indigo-50 text-indigo-600 p-1 rounded-full" title="Refined by Agent">
                                <ShieldCheck size={16} />
                              </span>
                            )}
                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                              entry.confidence_score === ConfidenceLevel.HIGH ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                              entry.confidence_score === ConfidenceLevel.MEDIUM ? 'border-indigo-200 bg-indigo-50 text-indigo-700' :
                              'border-amber-200 bg-amber-50 text-amber-700'
                            }`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              {entry.confidence_score || 'low'} confidence
                            </div>
                          </div>
                        </div>

                        <p className="text-slate-800 font-medium mb-4 leading-relaxed">{entry.impact_summary}</p>
                        
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {(entry.skills || []).map((skill, i) => (
                            <span key={i} className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium border border-slate-200">
                              {skill}
                            </span>
                          ))}
                        </div>

                        {(entry.evidence_links?.length || 0) > 0 && (
                          <div className="mt-4 pt-4 border-t border-slate-100">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-tighter mb-2 flex items-center gap-1">
                              <LinkIcon size={12} /> Supporting Evidence
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {entry.evidence_links.map((link, i) => (
                                <a key={i} href={link.startsWith('http') ? link : '#'} target="_blank" rel="noopener noreferrer" 
                                   className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 hover:bg-indigo-100 transition-all truncate max-w-[200px]">
                                  {link}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {entry.clarification_question && !entry.user_clarification_response && (
                          <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-xl">
                            <div className="flex items-start gap-3">
                              <div className="mt-1 text-amber-600">
                                <MessageSquare size={18} />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-bold text-amber-900 mb-2">{entry.clarification_question}</p>
                                <div className="flex gap-2">
                                  <input 
                                    type="text"
                                    value={clarificationResponse[entry.entry_id] || ''}
                                    onChange={(e) => setClarificationResponse(prev => ({ ...prev, [entry.entry_id]: e.target.value }))}
                                    placeholder="Provide more detail to improve your appraisal..."
                                    className="flex-1 px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                                  />
                                  <button 
                                    onClick={() => submitClarification(entry.entry_id)}
                                    className="bg-amber-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-amber-700"
                                  >
                                    Respond
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        {entry.user_clarification_response && (
                          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex gap-3">
                            <CheckCircle2 className="text-emerald-600 shrink-0" size={18} />
                            <div>
                              <p className="text-[10px] font-black text-emerald-700 uppercase mb-1">Clarification Provided</p>
                              <p className="text-sm text-emerald-900">{entry.user_clarification_response}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'reflection' && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={24} className="text-indigo-600" />
                  <h2 className="text-xl font-bold">Weekly Reflection Synthesis</h2>
                </div>
                {reflectionSummary ? (
                  <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm prose prose-slate max-w-none">
                    <div className="flex items-center gap-3 mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-700">
                      <BrainCircuit size={24} />
                      <p className="m-0 font-bold">The agent has processed your recent entries to improve clarity and detect trends.</p>
                    </div>
                    <div className="whitespace-pre-wrap text-slate-700 leading-relaxed font-medium">
                      {reflectionSummary}
                    </div>
                    <div className="mt-8 pt-6 border-t border-slate-100">
                      <button 
                        onClick={() => setActiveTab('history')}
                        className="flex items-center gap-2 text-indigo-600 font-bold hover:underline"
                      >
                        View Refined Memory Log <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-300 text-center">
                    <p className="text-slate-500">No reflection summary available. Run the weekly audit from the dashboard.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'appraisal' && (
              <div className="space-y-6 pb-12">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <FileText size={24} className="text-indigo-600" />
                    Performance Appraisal Report
                  </h2>
                  {summary && (
                    <button 
                      className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800"
                      onClick={() => window.print()}
                    >
                      Export PDF
                    </button>
                  )}
                </div>

                {summary ? (
                  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-8 print:shadow-none print:border-none">
                    <div className="flex justify-between items-start border-b border-slate-100 pb-6">
                      <div>
                        <p className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-1">Period Covered</p>
                        <h3 className="text-2xl font-bold text-slate-900">{summary.period}</h3>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Generated On</p>
                        <p className="font-bold text-slate-700">{formatWithTimezone(new Date().toISOString())}</p>
                      </div>
                    </div>

                    <section>
                      <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <ShieldCheck size={16} className="text-indigo-600" /> Executive Summary
                      </h4>
                      <p className="text-lg text-slate-800 leading-relaxed font-medium bg-slate-50 p-6 rounded-2xl italic border-l-4 border-indigo-600">
                        "{summary.executiveSummary}"
                      </p>
                    </section>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <section>
                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <TrendingUp size={16} className="text-emerald-600" /> Core Strengths
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {(summary.topStrengths || []).map((s, i) => (
                            <span key={i} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-bold border border-emerald-100">
                              {s}
                            </span>
                          ))}
                        </div>
                      </section>
                      <section>
                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <AlertCircle size={16} className="text-amber-600" /> Areas for Growth
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {(summary.growthAreas || []).map((g, i) => (
                            <span key={i} className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-xl text-sm font-bold border border-amber-100">
                              {g}
                            </span>
                          ))}
                        </div>
                      </section>
                    </div>

                    <section>
                      <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <LayoutDashboard size={16} className="text-indigo-600" /> Key Achievement Narratives
                      </h4>
                      <div className="space-y-4">
                        {(summary.keyAchievements || []).map((ach, i) => (
                          <div key={i} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex gap-4">
                            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center font-bold text-indigo-600 shrink-0 border border-slate-200">
                              {i + 1}
                            </div>
                            <p className="text-slate-800 font-medium leading-relaxed">{ach}</p>
                          </div>
                        ))}
                      </div>
                    </section>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-slate-100">
                      <section>
                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Recommended Focus</h4>
                        <p className="text-slate-700 text-sm leading-relaxed">{summary.recommendedFocus}</p>
                      </section>
                      <section>
                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Evidence Gap Analysis</h4>
                        <p className="text-slate-700 text-sm leading-relaxed">{summary.gapAnalysis}</p>
                      </section>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-300 text-center">
                    <p className="text-slate-500">No appraisal generated yet. Go to Dashboard to draft your report.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Security and Info Footer */}
      <footer className="bg-slate-100 border-t border-slate-200 py-12 mt-12">
        <div className="max-w-6xl mx-auto px-4 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h4 className="font-bold text-slate-900 mb-4">About CareerTrack Agent</h4>
              <p className="text-slate-500 leading-relaxed">
                An autonomous workspace for professionals to track achievements, refine growth areas, and generate objective, data-backed performance reviews.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-4">Privacy & Security</h4>
              <div className="flex flex-col gap-2 text-slate-500">
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-indigo-600" />
                  <span>Local-first storage (Browser)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye size={14} className="text-indigo-600" />
                  <span>Private agent processing</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-4">Agent Capabilities</h4>
              <ul className="space-y-2 text-slate-500">
                <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-500" /> Autonomous Categorization</li>
                <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-500" /> Evidence-Based Auditing</li>
                <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-500" /> Narrative Synthesis</li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
