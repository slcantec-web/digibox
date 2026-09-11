import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  Filter,
  FolderPlus,
  Layers,
  Lightbulb,
  LogOut,
  Mail,
  MessageSquare,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  Send,
  Shield,
  Smartphone,
  Sparkles,
  Tag,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import {
  ComplaintStatus,
  DailyReport,
  FeedbackBox,
  FeedbackGroup,
  FeedbackNote,
  Operator,
  Organization,
  StatisticsData,
  Submission,
  SubmissionStatus,
  SubmissionType,
  SuggestionStatus,
} from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { formatDailyEmailText } from '../lib/formatReport';

interface OperatorDashboardProps {
  token: string;
  operator: Operator;
  organization: Organization;
  onLogout: () => void;
  onOpenPublicView: (boxCode?: string) => void;
}

export const OperatorDashboard: React.FC<OperatorDashboardProps> = ({
  token,
  operator,
  organization,
  onLogout,
  onOpenPublicView,
}) => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<
    'all' | 'suggestions' | 'complaints' | 'groups' | 'analytics' | 'qrcodes' | 'reports'
  >('all');

  // Submissions State
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [totalSubmissions, setTotalSubmissions] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loadingSubs, setLoadingSubs] = useState<boolean>(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedBoxId, setSelectedBoxId] = useState<string>('all');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');

  // Metadata & Stats
  const [boxes, setBoxes] = useState<FeedbackBox[]>([]);
  const [groups, setGroups] = useState<FeedbackGroup[]>([]);
  const [stats, setStats] = useState<StatisticsData | null>(null);
  const [reports, setReports] = useState<DailyReport[]>([]);

  // Selected Submission Modal
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [submissionNotes, setSubmissionNotes] = useState<FeedbackNote[]>([]);
  const [newNoteText, setNewNoteText] = useState<string>('');
  const [addingNote, setAddingNote] = useState<boolean>(false);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Group creation modal
  const [showCreateGroupModal, setShowCreateGroupModal] = useState<boolean>(false);
  const [newGroupTitle, setNewGroupTitle] = useState<string>('');
  const [newGroupType, setNewGroupType] = useState<SubmissionType>('suggestion');
  const [newGroupDesc, setNewGroupDesc] = useState<string>('');

  // Daily Report Trigger
  const [triggeringReport, setTriggeringReport] = useState<boolean>(false);
  const [reportResultNotice, setReportResultNotice] = useState<string | null>(null);
  const [previewReportPayload, setPreviewReportPayload] = useState<DailyReport | null>(null);

  // QR Codes Map
  const [qrCodeDataUrls, setQrCodeDataUrls] = useState<Record<string, string>>({});

  // Reset seed notice
  const [seedNotice, setSeedNotice] = useState<string | null>(null);

  // Common Headers
  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  // Load Submissions
  const fetchSubmissions = async () => {
    setLoadingSubs(true);
    try {
      let typeParam = 'all';
      if (activeTab === 'suggestions') typeParam = 'suggestion';
      if (activeTab === 'complaints') typeParam = 'complaint';

      const params = new URLSearchParams({
        page: String(page),
        limit: '25',
      });
      if (typeParam !== 'all') params.append('type', typeParam);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (selectedBoxId !== 'all') params.append('feedback_box_id', selectedBoxId);
      if (selectedGroupId !== 'all') params.append('group_id', selectedGroupId);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await fetch(`/api/operator/submissions?${params.toString()}`, {
        headers: authHeaders,
      });
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions || []);
        setTotalSubmissions(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch submissions', err);
    } finally {
      setLoadingSubs(false);
    }
  };

  // Load Groups
  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/operator/groups', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups || []);
      }
    } catch (err) {
      console.error('Failed to fetch groups', err);
    }
  };

  // Load Statistics
  const fetchStats = async () => {
    try {
      const res = await fetch('/api/operator/statistics', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  };

  // Load Boxes
  const fetchBoxes = async () => {
    try {
      const res = await fetch('/api/public/boxes');
      if (res.ok) {
        const data = await res.json();
        setBoxes(data.boxes || []);
      }
    } catch (err) {
      console.error('Failed to fetch boxes', err);
    }
  };

  // Load Daily Reports
  const fetchReports = async () => {
    try {
      const res = await fetch('/api/operator/reports', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
        if (data.reports?.length > 0 && !previewReportPayload) {
          setPreviewReportPayload(data.reports[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch reports', err);
    }
  };

  // Initial load
  useEffect(() => {
    fetchBoxes();
    fetchGroups();
    fetchStats();
    fetchReports();
  }, []);

  // Refresh submissions when filters change
  useEffect(() => {
    if (['all', 'suggestions', 'complaints'].includes(activeTab)) {
      fetchSubmissions();
    }
  }, [page, activeTab, selectedStatus, selectedBoxId, selectedGroupId, searchQuery]);

  // Generate QR codes for all boxes
  useEffect(() => {
    async function generateQRs() {
      const urls: Record<string, string> = {};
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      for (const box of boxes) {
        try {
          const publicUrl = `${origin}/s/${box.box_code}`;
          const qrData = await QRCode.toDataURL(publicUrl, {
            width: 256,
            margin: 2,
            color: { dark: '#0284c7', light: '#ffffff' },
          });
          urls[box.box_code] = qrData;
        } catch (e) {
          console.error('QR generation error', e);
        }
      }
      setQrCodeDataUrls(urls);
    }
    if (boxes.length > 0) {
      generateQRs();
    }
  }, [boxes]);

  // View submission detail
  const openSubmissionDetail = async (sub: Submission) => {
    setSelectedSubmission(sub);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/operator/submissions/${sub.id}`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setSelectedSubmission(data);
        setSubmissionNotes(data.notes || []);
      }
    } catch (err) {
      console.error('Failed to load details', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Update status
  const handleUpdateStatus = async (subId: string, newStatus: SubmissionStatus) => {
    try {
      const res = await fetch(`/api/operator/submissions/${subId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        if (selectedSubmission?.id === subId) {
          setSelectedSubmission(updated);
        }
        setSubmissions((prev) => prev.map((s) => (s.id === subId ? { ...s, status: newStatus } : s)));
        fetchStats();
      }
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  // Assign Group
  const handleAssignGroup = async (subId: string, groupId: string | null) => {
    try {
      const res = await fetch(`/api/operator/submissions/${subId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ group_id: groupId }),
      });
      if (res.ok) {
        const updated = await res.json();
        if (selectedSubmission?.id === subId) {
          setSelectedSubmission(updated);
        }
        setSubmissions((prev) => prev.map((s) => (s.id === subId ? updated : s)));
        fetchGroups();
        fetchStats();
      }
    } catch (err) {
      console.error('Failed to assign group', err);
    }
  };

  // Add internal note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubmission || !newNoteText.trim()) return;

    setAddingNote(true);
    try {
      const res = await fetch(`/api/operator/submissions/${selectedSubmission.id}/notes`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ note: newNoteText.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setSubmissionNotes(data.notes || []);
        setNewNoteText('');
        if (selectedSubmission) {
          setSelectedSubmission({
            ...selectedSubmission,
            notes_count: (selectedSubmission.notes_count || 0) + 1,
          });
        }
      }
    } catch (err) {
      console.error('Failed to add note', err);
    } finally {
      setAddingNote(false);
    }
  };

  // Create Group
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupTitle.trim()) return;

    try {
      const res = await fetch('/api/operator/groups', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title: newGroupTitle.trim(),
          type: newGroupType,
          description: newGroupDesc.trim(),
        }),
      });
      if (res.ok) {
        setShowCreateGroupModal(false);
        setNewGroupTitle('');
        setNewGroupDesc('');
        fetchGroups();
      }
    } catch (err) {
      console.error('Failed to create group', err);
    }
  };

  // Delete Group
  const handleDeleteGroup = async (groupId: string) => {
    if (!window.confirm('Delete this feedback group? Individual feedback submissions will remain intact.')) {
      return;
    }
    try {
      const res = await fetch(`/api/operator/groups/${groupId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (res.ok) {
        fetchGroups();
        fetchSubmissions();
        fetchStats();
      }
    } catch (err) {
      console.error('Failed to delete group', err);
    }
  };

  // Trigger Daily Report
  const handleTriggerDailyReport = async (force: boolean = false) => {
    setTriggeringReport(true);
    setReportResultNotice(null);
    try {
      const res = await fetch('/api/operator/reports/daily-trigger', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (res.ok) {
        setReportResultNotice(data.message || 'Daily summary executed.');
        if (data.report) {
          setPreviewReportPayload(data.report);
        }
        fetchReports();
      } else {
        setReportResultNotice(data.error || 'Failed to generate daily report.');
      }
    } catch (err: any) {
      setReportResultNotice(err.message || 'Report trigger failed');
    } finally {
      setTriggeringReport(false);
    }
  };

  // Reset demo seed
  const handleResetSeed = async () => {
    if (!window.confirm('Reset database to initial pristine seed data (with 25 canteen submissions, etc.)?')) {
      return;
    }
    try {
      const res = await fetch('/api/operator/seed', {
        method: 'POST',
        headers: authHeaders,
      });
      if (res.ok) {
        setSeedNotice('Database successfully re-seeded with demo records.');
        fetchSubmissions();
        fetchGroups();
        fetchStats();
        fetchReports();
        setTimeout(() => setSeedNotice(null), 4000);
      }
    } catch (err) {
      console.error('Failed to reset seed', err);
    }
  };

  const suggestionStatuses: SuggestionStatus[] = [
    'New',
    'Reviewing',
    'Accepted',
    'In Progress',
    'Implemented',
    'Rejected',
    'Closed',
  ];

  const complaintStatuses: ComplaintStatus[] = [
    'New',
    'Under Review',
    'Investigating',
    'Action Taken',
    'Resolved',
    'Closed',
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top Operator Navbar */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center text-slate-950 font-black text-sm shadow-sm">
              CB
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-tight text-white">
                  CloudBase Digital Feedback
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  {operator.role}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                {organization.name} ({organization.code})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              id="btn-open-public-view"
              onClick={() => onOpenPublicView()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 text-xs font-medium border border-slate-700 transition"
              title="Test public user submission view"
            >
              <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Public Box View</span>
            </button>

            <PWAInstallButton className="hidden sm:inline-flex" />

            <div className="hidden md:flex items-center gap-2 pl-2 border-l border-slate-700 text-xs text-slate-300">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>{operator.username}</span>
            </div>

            <button
              id="btn-operator-logout"
              onClick={onLogout}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-1 text-xs"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Seed Reset Banner Notice */}
      {seedNotice && (
        <div className="bg-emerald-600 text-white text-xs px-4 py-2 text-center font-medium shadow-xs">
          {seedNotice}
        </div>
      )}

      {/* Subnav & Stat Highlights Bar */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total Submissions
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">
                  {stats?.total_feedback ?? totalSubmissions}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">All time</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80">
              <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider block">
                Suggestions
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-amber-900">
                  {stats?.total_suggestions ?? 0}
                </span>
                <span className="text-[11px] text-amber-700 font-medium">Ideas & improvements</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200/80">
              <span className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider block">
                Complaints
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-rose-900">
                  {stats?.total_complaints ?? 0}
                </span>
                <span className="text-[11px] text-rose-700 font-medium">Actionable issues</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-sky-50/60 border border-sky-200/80">
              <span className="text-[11px] font-semibold text-sky-800 uppercase tracking-wider block">
                Estimated Devices
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-sky-900">
                  {stats?.estimated_unique_devices ?? 0}
                </span>
                <span className="text-[11px] text-sky-700 font-medium">Unique tokens</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80 col-span-2 sm:col-span-1">
              <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
                Today's Submissions
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-900">
                  {stats?.today_feedback ?? 0}
                </span>
                <span className="text-[11px] text-emerald-700 font-medium">New today</span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center justify-between overflow-x-auto border-b border-slate-200 scrollbar-none gap-2">
            <nav className="flex space-x-1 sm:space-x-2">
              <button
                id="tab-all-feedback"
                onClick={() => {
                  setActiveTab('all');
                  setPage(1);
                }}
                className={`py-2 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap border-b-2 transition ${
                  activeTab === 'all'
                    ? 'border-sky-600 text-sky-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                All Feedback
              </button>

              <button
                id="tab-suggestions"
                onClick={() => {
                  setActiveTab('suggestions');
                  setPage(1);
                }}
                className={`py-2 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap border-b-2 transition ${
                  activeTab === 'suggestions'
                    ? 'border-amber-600 text-amber-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                💡 Suggestions
              </button>

              <button
                id="tab-complaints"
                onClick={() => {
                  setActiveTab('complaints');
                  setPage(1);
                }}
                className={`py-2 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap border-b-2 transition ${
                  activeTab === 'complaints'
                    ? 'border-rose-600 text-rose-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                ⚠ Complaints
              </button>

              <button
                id="tab-groups"
                onClick={() => setActiveTab('groups')}
                className={`py-2 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === 'groups'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Groups & Head Count</span>
              </button>

              <button
                id="tab-analytics"
                onClick={() => setActiveTab('analytics')}
                className={`py-2 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === 'analytics'
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Analytics</span>
              </button>

              <button
                id="tab-qrcodes"
                onClick={() => setActiveTab('qrcodes')}
                className={`py-2 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === 'qrcodes'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>QR Boxes & Print</span>
              </button>

              <button
                id="tab-reports"
                onClick={() => setActiveTab('reports')}
                className={`py-2 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === 'reports'
                    ? 'border-sky-600 text-sky-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Daily Email Reports</span>
              </button>
            </nav>

            <button
              id="btn-reseed-demo"
              onClick={handleResetSeed}
              className="py-1 px-2.5 rounded-lg border border-slate-200 text-[11px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition shrink-0 flex items-center gap-1"
              title="Reset sample seed data (25 canteen submissions, etc.)"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset Seed Data</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Tab Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">
        {/* TAB: All / Suggestions / Complaints */}
        {['all', 'suggestions', 'complaints'].includes(activeTab) && (
          <div className="space-y-4">
            {/* Search and Filters Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  id="input-search-feedback"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search feedback text, submitter, ID..."
                  className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 outline-hidden transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filters dropdowns */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Box Filter */}
                <select
                  id="select-filter-box"
                  value={selectedBoxId}
                  onChange={(e) => {
                    setSelectedBoxId(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by Feedback Box"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 bg-white hover:bg-slate-50 focus:border-sky-500 outline-hidden"
                >
                  <option value="all">All Feedback Boxes</option>
                  {boxes.map((b) => (
                    <option key={b.id || b.box_code} value={b.id}>
                      {b.box_code} - {b.title}
                    </option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  id="select-filter-status"
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by Status"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 bg-white hover:bg-slate-50 focus:border-sky-500 outline-hidden"
                >
                  <option value="all">All Statuses</option>
                  <option value="New">New</option>
                  <option value="Reviewing">Reviewing / Under Review</option>
                  <option value="Accepted">Accepted</option>
                  <option value="In Progress">In Progress / Investigating</option>
                  <option value="Resolved">Resolved / Implemented</option>
                  <option value="Closed">Closed</option>
                </select>

                {/* Group Filter */}
                <select
                  id="select-filter-group"
                  value={selectedGroupId}
                  onChange={(e) => {
                    setSelectedGroupId(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by Feedback Group"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 bg-white hover:bg-slate-50 focus:border-sky-500 outline-hidden"
                >
                  <option value="all">All Groups</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title} ({g.submission_count})
                    </option>
                  ))}
                </select>

                <button
                  id="btn-refresh-subs"
                  onClick={fetchSubmissions}
                  className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
                  title="Refresh data"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingSubs ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Submissions List / Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="text-xs font-bold text-slate-700">
                  Showing {submissions.length} of {totalSubmissions} submissions
                </div>
                <div className="text-[11px] text-slate-400 font-medium">
                  Duplicates allowed & tracked for head count
                </div>
              </div>

              {loadingSubs ? (
                <div className="p-12 text-center text-xs text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-500" />
                  Loading feedback submissions...
                </div>
              ) : submissions.length === 0 ? (
                <div className="p-12 text-center">
                  <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-700">No feedback submissions found</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Try adjusting your search criteria or submit new feedback from the public box.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {submissions.map((sub) => (
                    <div
                      key={sub.id}
                      id={`submission-row-${sub.id}`}
                      onClick={() => openSubmissionDetail(sub)}
                      className="p-4 sm:px-5 hover:bg-sky-50/40 transition cursor-pointer flex flex-col md:flex-row items-start md:items-center justify-between gap-3 group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="font-mono text-xs font-bold text-slate-800">
                            {sub.id}
                          </span>

                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              sub.type === 'suggestion'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {sub.type === 'suggestion' ? '💡 Suggestion' : '⚠ Complaint'}
                          </span>

                          <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {sub.feedback_box_code || 'BOX'}
                          </span>

                          {/* Duplicate Head Count Indicator */}
                          {sub.duplicate_count && sub.duplicate_count > 1 && (
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded"
                              title={`${sub.duplicate_count} submissions from approx ${sub.estimated_devices_count} devices`}
                            >
                              <Users className="w-3 h-3" />
                              <span>
                                {sub.duplicate_count} submissions · {sub.estimated_devices_count} devices
                              </span>
                            </span>
                          )}

                          {sub.group_title && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                              <Tag className="w-3 h-3" />
                              <span>{sub.group_title}</span>
                            </span>
                          )}
                        </div>

                        {/* Message Preview */}
                        <p className="text-sm font-medium text-slate-900 group-hover:text-sky-900 transition line-clamp-2">
                          "{sub.message}"
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(sub.submitted_at).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>

                          <span>•</span>

                          <span>
                            {sub.is_anonymous ? (
                              <span className="italic text-slate-500">Anonymous Submitter</span>
                            ) : (
                              <span className="font-semibold text-slate-700">
                                {sub.submitter_name} {sub.submitter_contact ? `(${sub.submitter_contact})` : ''}
                              </span>
                            )}
                          </span>

                          {sub.notes_count && sub.notes_count > 0 ? (
                            <>
                              <span>•</span>
                              <span className="text-sky-600 font-medium">
                                {sub.notes_count} internal note{sub.notes_count > 1 ? 's' : ''}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>

                      {/* Status Tag & Action */}
                      <div
                        className="flex items-center gap-2 shrink-0 self-end md:self-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          id={`status-select-${sub.id}`}
                          value={sub.status}
                          onChange={(e) =>
                            handleUpdateStatus(sub.id, e.target.value as SubmissionStatus)
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 focus:border-sky-500 outline-hidden"
                        >
                          {(sub.type === 'suggestion' ? suggestionStatuses : complaintStatuses).map(
                            (st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            )
                          )}
                        </select>

                        <button
                          id={`btn-open-detail-${sub.id}`}
                          onClick={() => openSubmissionDetail(sub)}
                          className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition"
                          title="Open details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination footer */}
              {totalPages > 1 && (
                <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50 text-xs text-slate-600">
                  <div>
                    Page {page} of {totalPages}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      id="btn-prev-page"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                      className="px-3 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      id="btn-next-page"
                      disabled={page >= totalPages}
                      onClick={() => setPage(page + 1)}
                      className="px-3 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: Groups & Head Count (Spec #26, #27, #62) */}
        {activeTab === 'groups' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Feedback Groups & Head Count Calculation
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Every submission remains an independent database record. Groups aggregate head count & estimated unique devices.
                </p>
              </div>
              <button
                id="btn-open-create-group"
                onClick={() => setShowCreateGroupModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 text-xs font-semibold shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New Group</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groups.map((group) => (
                <div
                  key={group.id}
                  id={`group-card-${group.id}`}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                            group.type === 'suggestion'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {group.type === 'suggestion' ? '💡 Suggestion' : '⚠ Complaint'}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {group.status}
                        </span>
                      </div>

                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        title="Delete group (keeps original feedback intact)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h4 className="text-base font-bold text-slate-900">{group.title}</h4>
                    {group.description && (
                      <p className="text-xs text-slate-500 mt-1">{group.description}</p>
                    )}

                    {/* Head count metric showcase */}
                    <div className="mt-4 p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-around text-center">
                      <div>
                        <div className="text-xl font-black text-indigo-950">
                          {group.submission_count}
                        </div>
                        <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                          Head Count
                        </div>
                      </div>
                      <div className="h-8 w-px bg-indigo-200" />
                      <div>
                        <div className="text-xl font-black text-indigo-950">
                          {group.estimated_devices}
                        </div>
                        <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                          Estimated Devices
                        </div>
                      </div>
                    </div>

                    {/* Sample feedback previews */}
                    {group.sample_messages && group.sample_messages.length > 0 && (
                      <div className="mt-3.5 text-xs text-slate-600">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          Sample Submissions in Group:
                        </span>
                        <ul className="space-y-1 pl-3 list-disc text-slate-600">
                          {group.sample_messages.map((msg, i) => (
                            <li key={i} className="line-clamp-1 italic text-[11px]">
                              "{msg}"
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-mono">
                      Group ID: {group.id}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedGroupId(group.id);
                        setActiveTab('all');
                      }}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      View All Submissions →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: Analytics (Spec #20, #21, #63) */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {!stats ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
                <RefreshCw className="w-6 h-6 text-teal-600 animate-spin mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-700">Loading analytics data...</p>
                <p className="text-xs text-slate-400 mt-1">Calculating cluster reports and counts</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Repeated Suggestions */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <Lightbulb className="w-4 h-4 text-amber-500" />
                      Top Repeated Suggestions (Head Count)
                    </h3>
                    <span className="text-xs text-slate-400">Repeated feedback rank</span>
                  </div>

                  {(!stats.top_repeated_suggestions || stats.top_repeated_suggestions.length === 0) ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      No repeated suggestions or clusters identified yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {stats.top_repeated_suggestions.map((item, index) => (
                        <div
                          key={index}
                          className="p-3 rounded-xl bg-amber-50/40 border border-amber-100 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-amber-200/80 text-amber-900 text-xs font-bold flex items-center justify-center shrink-0">
                              {index + 1}
                            </span>
                            <div>
                              <div className="text-xs font-bold text-slate-900">
                                {item.group_title || item.message}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {item.count} total submissions
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded block">
                              {item.estimated_devices} devices
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Complaints Breakdown */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-500" />
                      Complaints Status Distribution
                    </h3>
                    <span className="text-xs text-slate-400">Workflow pipeline</span>
                  </div>

                  {Object.keys(stats.complaint_status_counts || {}).length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      No complaint data recorded yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(stats.complaint_status_counts || {}).map(([status, count]) => (
                        <div key={status} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                            {status}
                          </span>
                          <span className="text-xl font-black text-slate-900 block mt-1">
                            {count}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Feedback Boxes Distribution */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs lg:col-span-2">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-sky-600" />
                      Feedback Breakdown by Location / Box
                    </h3>
                    <span className="text-xs text-slate-400">Multi-box tracking</span>
                  </div>

                  {(!stats.boxes_breakdown || stats.boxes_breakdown.length === 0) ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      No boxes configured or no submissions yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      {stats.boxes_breakdown.map((b) => (
                        <div
                          key={b.box_code}
                          className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between"
                        >
                          <div>
                            <span className="text-[10px] font-bold font-mono text-slate-400 block">
                              {b.box_code}
                            </span>
                            <div className="text-xs font-bold text-slate-900 mt-0.5 line-clamp-1">
                              {b.title}
                            </div>
                          </div>

                          <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800">{b.total} total</span>
                            <span className="text-[11px] text-slate-500">
                              {b.suggestions} 💡 / {b.complaints} ⚠
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: QR Codes & Print Signs (Spec #15, #16) */}
        {activeTab === 'qrcodes' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Permanent Public QR Codes & Digital Feedback Boxes
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Print these placards to attach directly onto physical suggestion boxes or dining tables.
                </p>
              </div>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 text-xs font-semibold shadow-xs transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Placards</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {boxes.map((box) => {
                const qrUrl = qrCodeDataUrls[box.box_code];
                const publicUrl =
                  typeof window !== 'undefined'
                    ? `${window.location.origin}/s/${box.box_code}`
                    : `/s/${box.box_code}`;

                return (
                  <div
                    key={box.box_code}
                    id={`qr-card-${box.box_code}`}
                    className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col items-center text-center justify-between relative overflow-hidden"
                  >
                    {/* Header bar on card */}
                    <div className="w-full pb-3 mb-2 border-b border-slate-100">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 block">
                        CloudBase Digital Feedback Box
                      </span>
                      <h4 className="text-base font-extrabold text-slate-900 mt-0.5">
                        {box.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {box.description}
                      </p>
                    </div>

                    {/* QR Code image */}
                    <div className="my-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                      {qrUrl ? (
                        <img
                          src={qrUrl}
                          alt={`QR Code for ${box.box_code}`}
                          className="w-44 h-44 object-contain rounded-lg"
                        />
                      ) : (
                        <div className="w-44 h-44 flex items-center justify-center text-xs text-slate-400">
                          Generating QR...
                        </div>
                      )}
                    </div>

                    <div className="w-full">
                      <div className="text-[11px] font-mono text-slate-500 bg-slate-100 py-1 px-2 rounded-md mb-3 select-all">
                        {box.box_code}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(publicUrl);
                            alert(`Copied link to clipboard: ${publicUrl}`);
                          }}
                          className="py-2 px-2 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
                        >
                          Copy URL
                        </button>
                        <button
                          onClick={() => onOpenPublicView(box.box_code)}
                          className="py-2 px-2 text-xs font-semibold rounded-xl bg-sky-600 hover:bg-sky-700 text-white transition flex items-center justify-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Test View</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB: Daily Email Reports (Spec #48, #49, #50, #51, #52) */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Cloudflare Worker Daily Cron Summary & Gateway Reports
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Automated CloudBase Email Gateway job runs every day to deliver separate suggestions & complaints summary.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="btn-trigger-cron"
                  disabled={triggeringReport}
                  onClick={() => handleTriggerDailyReport(false)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-3.5 py-2 text-xs font-semibold shadow-xs transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${triggeringReport ? 'animate-spin' : ''}`} />
                  <span>Run Daily Cron Now</span>
                </button>

                <button
                  id="btn-force-cron"
                  disabled={triggeringReport}
                  onClick={() => handleTriggerDailyReport(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-2 text-xs font-medium transition disabled:opacity-50"
                  title="Force run even if today's report was already sent"
                >
                  <span>Force Re-send</span>
                </button>
              </div>
            </div>

            {reportResultNotice && (
              <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
                <span>{reportResultNotice}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Daily Email Preview matching Spec #49 */}
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-sky-600" />
                    <h4 className="text-sm font-bold text-slate-900">
                      Simulated Email Gateway Delivery Payload
                    </h4>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Recipient: management@cantec.example.com
                  </span>
                </div>

                {previewReportPayload ? (
                  <div className="font-mono text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-5 whitespace-pre-wrap leading-relaxed">
                    {formatDailyEmailText(
                      previewReportPayload.report_payload.organization_name,
                      previewReportPayload.report_payload.report_date,
                      previewReportPayload.report_payload
                    )}
                  </div>
                ) : (
                  <div className="p-10 text-center text-xs text-slate-400">
                    Click "Run Daily Cron Now" above to generate and preview the daily summary email.
                  </div>
                )}
              </div>

              {/* History of Daily Reports */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-3 border-b border-slate-100 mb-3">
                  Report Execution History
                </h4>

                <div className="space-y-2.5 max-h-96 overflow-y-auto">
                  {reports.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No previous daily reports logged.</p>
                  ) : (
                    reports.map((rep) => (
                      <button
                        key={rep.id}
                        onClick={() => setPreviewReportPayload(rep)}
                        className={`w-full text-left p-3 rounded-xl border transition ${
                          previewReportPayload?.id === rep.id
                            ? 'bg-sky-50 border-sky-300'
                            : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">
                            {rep.report_date}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              rep.status === 'sent'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {rep.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          {rep.report_payload.total_suggestions} suggestions ·{' '}
                          {rep.report_payload.total_complaints} complaints
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: Individual Feedback Detail & Notes (Spec #24 & #25) */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div
            id="modal-submission-detail"
            className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                    selectedSubmission.type === 'suggestion'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {selectedSubmission.type === 'suggestion' ? '💡 Suggestion' : '⚠ Complaint'}
                </span>
                <h3 className="text-base font-extrabold text-slate-900">
                  Feedback {selectedSubmission.id}
                </h3>
              </div>

              <button
                id="btn-close-detail-modal"
                onClick={() => setSelectedSubmission(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Message Box */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Submitted Message
                </label>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 whitespace-pre-wrap leading-relaxed">
                  "{selectedSubmission.message}"
                </div>
              </div>

              {/* Duplicate / Head Count Info (Spec #24) */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200/80 flex items-center justify-between text-xs text-indigo-900">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <div>
                    <span className="font-bold">Related Feedback Head Count:</span>{' '}
                    <span>
                      {selectedSubmission.duplicate_count || 1} submissions ·{' '}
                      {selectedSubmission.estimated_devices_count || 1} estimated unique devices
                    </span>
                  </div>
                </div>
              </div>

              {/* Attributes Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Location</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">
                    {selectedSubmission.feedback_box_title || selectedSubmission.feedback_box_code}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Submitted</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">
                    {new Date(selectedSubmission.submitted_at).toLocaleString()}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Submitter</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">
                    {selectedSubmission.is_anonymous
                      ? 'Anonymous'
                      : `${selectedSubmission.submitter_name || 'Named'} (${selectedSubmission.submitter_contact || 'No contact'})`}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Estimated Device Token
                  </span>
                  <span className="font-mono text-slate-600 text-[11px] mt-0.5 block truncate">
                    {selectedSubmission.device_token_hash.slice(0, 16)}... (Masked)
                  </span>
                </div>
              </div>

              {/* Status & Group Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Manage Status
                  </label>
                  <select
                    id="modal-status-select"
                    value={selectedSubmission.status}
                    onChange={(e) =>
                      handleUpdateStatus(selectedSubmission.id, e.target.value as SubmissionStatus)
                    }
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs font-semibold text-slate-900 bg-white"
                  >
                    {(selectedSubmission.type === 'suggestion'
                      ? suggestionStatuses
                      : complaintStatuses
                    ).map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Assign to Group
                  </label>
                  <select
                    id="modal-group-select"
                    value={selectedSubmission.group_id || ''}
                    onChange={(e) =>
                      handleAssignGroup(selectedSubmission.id, e.target.value || null)
                    }
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs font-semibold text-slate-900 bg-white"
                  >
                    <option value="">(No group assigned)</option>
                    {groups
                      .filter((g) => g.type === selectedSubmission.type)
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.title} ({g.submission_count})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Internal Notes Section (Spec #25) */}
              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Internal Operator Notes (Confidential)
                </h4>
                <p className="text-[11px] text-slate-400 mb-3">
                  These notes are visible strictly to operators and never exposed to public submitters.
                </p>

                {/* Notes List */}
                <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                  {submissionNotes.length === 0 ? (
                    <div className="text-xs text-slate-400 italic py-1">No internal notes yet.</div>
                  ) : (
                    submissionNotes.map((note) => (
                      <div
                        key={note.id}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                          <span className="font-semibold text-slate-700">{note.operator_name}</span>
                          <span>{new Date(note.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-800 font-medium">{note.note}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Note Form */}
                <form onSubmit={handleAddNote} className="flex gap-2">
                  <input
                    id="input-new-note"
                    type="text"
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="Write internal operator note..."
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:ring-1 focus:ring-sky-200 outline-hidden"
                  />
                  <button
                    id="btn-save-note"
                    type="submit"
                    disabled={addingNote || !newNoteText.trim()}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
                  >
                    Add Note
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Create New Feedback Group */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">Create Feedback Group</h3>
              <button
                onClick={() => setShowCreateGroupModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Group Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewGroupType('suggestion')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition ${
                      newGroupType === 'suggestion'
                        ? 'bg-amber-100 border-amber-400 text-amber-900'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    💡 Suggestion
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewGroupType('complaint')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition ${
                      newGroupType === 'complaint'
                        ? 'bg-rose-100 border-rose-400 text-rose-900'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    ⚠ Complaint
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Group Title / Issue Name
                </label>
                <input
                  type="text"
                  required
                  value={newGroupTitle}
                  onChange={(e) => setNewGroupTitle(e.target.value)}
                  placeholder="e.g. Canteen Food Quality"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-sky-500 outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={3}
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="Summary of what this feedback cluster represents..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-sky-500 outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newGroupTitle.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition disabled:opacity-50"
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
