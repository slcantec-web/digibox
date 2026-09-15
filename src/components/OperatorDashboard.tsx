import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  FolderPlus,
  Globe,
  HelpCircle,
  Key,
  KeyRound,
  Layers,
  Lightbulb,
  Lock,
  LogOut,
  Mail,
  MessageSquare,
  Pencil,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  Sliders,
  Smartphone,
  Sparkles,
  Tag,
  Trash2,
  User,
  UserCheck,
  UserPlus,
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
    'all' | 'suggestions' | 'complaints' | 'groups' | 'analytics' | 'qrcodes' | 'reports' | 'users' | 'settings'
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

  // Organization state & settings
  const [currentOrg, setCurrentOrg] = useState<Organization>(organization);
  const [orgForm, setOrgForm] = useState({
    name: organization.name || '',
    code: organization.code || '',
    contact_email: organization.contact_email || '',
    welcome_message: organization.welcome_message || '',
    thank_you_message: organization.thank_you_message || '',
  });
  const [savingOrg, setSavingOrg] = useState<boolean>(false);
  const [orgSaveNotice, setOrgSaveNotice] = useState<string | null>(null);
  const [orgSaveError, setOrgSaveError] = useState<string | null>(null);

  // Box Management (Create / Edit / Delete)
  const [showBoxModal, setShowBoxModal] = useState<boolean>(false);
  const [boxModalMode, setBoxModalMode] = useState<'create' | 'edit'>('create');
  const [editingBoxId, setEditingBoxId] = useState<string | null>(null);
  const [boxForm, setBoxForm] = useState({
    title: '',
    box_code: '',
    description: '',
    public_enabled: true,
  });
  const [boxActionLoading, setBoxActionLoading] = useState<boolean>(false);
  const [boxActionError, setBoxActionError] = useState<string | null>(null);
  const [boxActionNotice, setBoxActionNotice] = useState<string | null>(null);
  const [deleteBoxConfirmId, setDeleteBoxConfirmId] = useState<string | null>(null);

  // User Management (Add / Edit / Remove)
  const [users, setUsers] = useState<Operator[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [showUserModal, setShowUserModal] = useState<boolean>(false);
  const [userModalMode, setUserModalMode] = useState<'create' | 'edit'>('create');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    role: 'operator' as 'admin' | 'operator',
    status: 'active' as 'active' | 'inactive',
  });
  const [userActionLoading, setUserActionLoading] = useState<boolean>(false);
  const [userActionError, setUserActionError] = useState<string | null>(null);
  const [userActionNotice, setUserActionNotice] = useState<string | null>(null);
  const [deleteUserConfirmId, setDeleteUserConfirmId] = useState<string | null>(null);

  const savingBox = boxActionLoading;
  const savingUser = userActionLoading;

  // Feedback Deletion
  const [deleteSubConfirmId, setDeleteSubConfirmId] = useState<string | null>(null);
  const [deletingSub, setDeletingSub] = useState<boolean>(false);
  const [subActionNotice, setSubActionNotice] = useState<string | null>(null);

  // Selected Submission Modal
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [submissionNotes, setSubmissionNotes] = useState<FeedbackNote[]>([]);
  const [newNoteText, setNewNoteText] = useState<string>('');
  const [addingNote, setAddingNote] = useState<boolean>(false);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Group creation & editing modal
  const [showCreateGroupModal, setShowCreateGroupModal] = useState<boolean>(false);
  const [newGroupTitle, setNewGroupTitle] = useState<string>('');
  const [newGroupType, setNewGroupType] = useState<SubmissionType>('suggestion');
  const [newGroupDesc, setNewGroupDesc] = useState<string>('');
  const [newGroupBoxId, setNewGroupBoxId] = useState<string>('all');

  const [editingGroup, setEditingGroup] = useState<FeedbackGroup | null>(null);
  const [editGroupTitle, setEditGroupTitle] = useState<string>('');
  const [editGroupDesc, setEditGroupDesc] = useState<string>('');
  const [editGroupStatus, setEditGroupStatus] = useState<FeedbackGroup['status']>('Active');
  const [editGroupBoxId, setEditGroupBoxId] = useState<string>('all');
  const [savingGroupEdit, setSavingGroupEdit] = useState<boolean>(false);

  // Group Box Filter for synchronizing with Boxes & QR Codes
  const [groupSelectedBoxFilter, setGroupSelectedBoxFilter] = useState<string>('all');

  // Daily Report Trigger
  const [triggeringReport, setTriggeringReport] = useState<boolean>(false);
  const [reportResultNotice, setReportResultNotice] = useState<string | null>(null);
  const [previewReportPayload, setPreviewReportPayload] = useState<DailyReport | null>(null);

  // QR Codes Map & Universal Readability Engine
  const [qrCodeDataUrls, setQrCodeDataUrls] = useState<Record<string, string>>({});
  const [qrCodeSvgStrings, setQrCodeSvgStrings] = useState<Record<string, string>>({});
  const [qrColorMode, setQrColorMode] = useState<'universal' | 'brand'>('universal');
  const [qrErrorLevel, setQrErrorLevel] = useState<'M' | 'L'>('M');
  const [qrCustomDomain, setQrCustomDomain] = useState<string>('');
  const [placardModalBox, setPlacardModalBox] = useState<FeedbackBox | null>(null);
  const [showAllPlacardsModal, setShowAllPlacardsModal] = useState<boolean>(false);

  // Reset seed notice
  const [seedNotice, setSeedNotice] = useState<string | null>(null);

  // Change My Password Modal
  const [showChangePassModal, setShowChangePassModal] = useState<boolean>(false);
  const [currentPassInput, setCurrentPassInput] = useState<string>('');
  const [newPassInput, setNewPassInput] = useState<string>('');
  const [confirmPassInput, setConfirmPassInput] = useState<string>('');
  const [changePassLoading, setChangePassLoading] = useState<boolean>(false);
  const [changePassError, setChangePassError] = useState<string | null>(null);
  const [changePassSuccess, setChangePassSuccess] = useState<string | null>(null);

  // Reset User Password Modal (Admin resetting another user's password)
  const [resetUserModalUser, setResetUserModalUser] = useState<Operator | null>(null);
  const [resetUserNewPass, setResetUserNewPass] = useState<string>('');
  const [resetUserLoading, setResetUserLoading] = useState<boolean>(false);
  const [resetUserError, setResetUserError] = useState<string | null>(null);
  const [resetUserSuccess, setResetUserSuccess] = useState<string | null>(null);

  // Automated Email in Daily Reports Tab
  const [automatedEmailInput, setAutomatedEmailInput] = useState<string>(organization.contact_email || '');
  const [savingAutomatedEmail, setSavingAutomatedEmail] = useState<boolean>(false);
  const [automatedEmailNotice, setAutomatedEmailNotice] = useState<string | null>(null);
  const [automatedEmailError, setAutomatedEmailError] = useState<string | null>(null);

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

  // Load Groups (Synced with Boxes & QR Codes)
  const fetchGroups = async (boxFilter?: string) => {
    try {
      const activeBox = boxFilter !== undefined ? boxFilter : groupSelectedBoxFilter;
      const url = activeBox && activeBox !== 'all'
        ? `/api/operator/groups?box_id=${encodeURIComponent(activeBox)}`
        : '/api/operator/groups';
      const res = await fetch(url, { headers: authHeaders });
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
      const res = await fetch('/api/operator/boxes', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setBoxes(data.boxes || []);
      } else {
        const fallback = await fetch('/api/public/boxes');
        if (fallback.ok) {
          const data = await fallback.json();
          setBoxes(data.boxes || []);
        }
      }
    } catch (err) {
      console.error('Failed to fetch boxes', err);
    }
  };

  // Load Users
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/operator/users', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to fetch users', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Load Organization
  const fetchOrganization = async () => {
    try {
      const res = await fetch('/api/operator/organization', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        if (data.organization) {
          setCurrentOrg(data.organization);
          setOrgForm({
            name: data.organization.name || '',
            code: data.organization.code || '',
            contact_email: data.organization.contact_email || '',
            welcome_message: data.organization.welcome_message || '',
            thank_you_message: data.organization.thank_you_message || '',
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch organization', err);
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
    fetchOrganization();
    if (operator.role === 'admin') {
      fetchUsers();
    }
  }, []);

  // Fetch when tab changes
  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'settings') {
      fetchOrganization();
    }
  }, [activeTab]);

  // Box CRUD Handlers
  const openCreateBoxModal = () => {
    setBoxForm({
      title: '',
      box_code: `${currentOrg.code || 'CTP'}-`,
      description: '',
      public_enabled: true,
    });
    setEditingBoxId(null);
    setBoxModalMode('create');
    setBoxActionError(null);
    setShowBoxModal(true);
  };

  const openEditBoxModal = (box: FeedbackBox) => {
    setBoxForm({
      title: box.title || '',
      box_code: box.box_code || '',
      description: box.description || '',
      public_enabled: box.public_enabled !== false,
    });
    setEditingBoxId(box.id);
    setBoxModalMode('edit');
    setBoxActionError(null);
    setShowBoxModal(true);
  };

  const handleSaveBox = async (e: React.FormEvent) => {
    e.preventDefault();
    setBoxActionError(null);
    if (!boxForm.title.trim()) {
      setBoxActionError('Box title is required.');
      return;
    }
    if (!boxForm.box_code.trim()) {
      setBoxActionError('Box code is required.');
      return;
    }

    setBoxActionLoading(true);
    try {
      const url =
        boxModalMode === 'create'
          ? '/api/operator/boxes'
          : `/api/operator/boxes/${editingBoxId}`;
      const method = boxModalMode === 'create' ? 'POST' : 'PATCH';

      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify({
          title: boxForm.title.trim(),
          box_code: boxForm.box_code.trim().toUpperCase(),
          description: boxForm.description.trim(),
          public_enabled: boxForm.public_enabled,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save feedback box.');
      }

      setShowBoxModal(false);
      setBoxActionNotice(
        boxModalMode === 'create'
          ? 'Feedback box created successfully!'
          : 'Feedback box updated successfully!'
      );
      setTimeout(() => setBoxActionNotice(null), 4000);
      await fetchBoxes();
      await fetchStats();
    } catch (err: any) {
      setBoxActionError(err.message || 'Failed to save feedback box.');
    } finally {
      setBoxActionLoading(false);
    }
  };

  const handleDeleteBox = async (boxId: string) => {
    setBoxActionLoading(true);
    try {
      const res = await fetch(`/api/operator/boxes/${boxId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete box.');
      }
      setDeleteBoxConfirmId(null);
      setBoxActionNotice('Feedback box deleted successfully.');
      setTimeout(() => setBoxActionNotice(null), 4000);
      await fetchBoxes();
      await fetchStats();
    } catch (err: any) {
      alert(err.message || 'Failed to delete box');
    } finally {
      setBoxActionLoading(false);
    }
  };

  // User CRUD Handlers
  const openCreateUserModal = () => {
    setUserForm({
      username: '',
      password: '',
      role: 'operator',
      status: 'active',
    });
    setEditingUserId(null);
    setUserModalMode('create');
    setUserActionError(null);
    setShowUserModal(true);
  };

  const openEditUserModal = (u: Operator) => {
    setUserForm({
      username: u.username,
      password: '',
      role: u.role,
      status: u.status,
    });
    setEditingUserId(u.id);
    setUserModalMode('edit');
    setUserActionError(null);
    setShowUserModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserActionError(null);
    if (!userForm.username.trim()) {
      setUserActionError('Username is required.');
      return;
    }
    if (userModalMode === 'create' && !userForm.password) {
      setUserActionError('Password is required for new users.');
      return;
    }

    setUserActionLoading(true);
    try {
      const url =
        userModalMode === 'create'
          ? '/api/operator/users'
          : `/api/operator/users/${editingUserId}`;
      const method = userModalMode === 'create' ? 'POST' : 'PATCH';

      const payload: any = {
        role: userForm.role,
        status: userForm.status,
      };
      if (userModalMode === 'create') {
        payload.username = userForm.username.trim();
        payload.password = userForm.password;
      } else {
        if (userForm.password.trim()) {
          payload.password = userForm.password.trim();
        }
      }

      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save user.');
      }

      setShowUserModal(false);
      setUserActionNotice(
        userModalMode === 'create' ? 'User created successfully!' : 'User updated successfully!'
      );
      setTimeout(() => setUserActionNotice(null), 4000);
      await fetchUsers();
    } catch (err: any) {
      setUserActionError(err.message || 'Failed to save user.');
    } finally {
      setUserActionLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setUserActionLoading(true);
    try {
      const res = await fetch(`/api/operator/users/${userId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete user.');
      }
      setDeleteUserConfirmId(null);
      setUserActionNotice('User removed successfully.');
      setTimeout(() => setUserActionNotice(null), 4000);
      await fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to delete user');
    } finally {
      setUserActionLoading(false);
    }
  };

  // Change currently authenticated operator's password
  const handleChangeMyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePassError(null);
    setChangePassSuccess(null);

    if (!currentPassInput) {
      setChangePassError('Please enter your current password.');
      return;
    }
    if (!newPassInput || newPassInput.length < 4) {
      setChangePassError('New password must be at least 4 characters.');
      return;
    }
    if (newPassInput !== confirmPassInput) {
      setChangePassError('New passwords do not match.');
      return;
    }

    setChangePassLoading(true);
    try {
      const res = await fetch('/api/operator/change-my-password', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          currentPassword: currentPassInput,
          newPassword: newPassInput,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to change password.');
      }

      setChangePassSuccess('Your password has been changed successfully!');
      setCurrentPassInput('');
      setNewPassInput('');
      setConfirmPassInput('');
      setTimeout(() => {
        setShowChangePassModal(false);
        setChangePassSuccess(null);
      }, 2000);
    } catch (err: any) {
      setChangePassError(err.message || 'Failed to change password.');
    } finally {
      setChangePassLoading(false);
    }
  };

  // Admin resetting another user's password
  const handleResetUserPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUserModalUser) return;
    setResetUserError(null);
    setResetUserSuccess(null);

    if (!resetUserNewPass || resetUserNewPass.length < 4) {
      setResetUserError('New password must be at least 4 characters.');
      return;
    }

    setResetUserLoading(true);
    try {
      const res = await fetch(`/api/operator/users/${resetUserModalUser.id}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          password: resetUserNewPass,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password.');
      }

      setResetUserSuccess(`Password for ${resetUserModalUser.username} updated successfully!`);
      setTimeout(() => {
        setResetUserModalUser(null);
        setResetUserNewPass('');
        setResetUserSuccess(null);
      }, 2000);
    } catch (err: any) {
      setResetUserError(err.message || 'Failed to reset password.');
    } finally {
      setResetUserLoading(false);
    }
  };

  // Automated Daily Report Email Update
  const handleSaveAutomatedEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setAutomatedEmailError(null);
    setAutomatedEmailNotice(null);

    if (!automatedEmailInput.trim()) {
      setAutomatedEmailError('Please enter a valid email address.');
      return;
    }

    setSavingAutomatedEmail(true);
    try {
      const res = await fetch('/api/operator/automated-email', {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          email: automatedEmailInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update automated email.');
      }

      setCurrentOrg((prev) => ({ ...prev, contact_email: data.contact_email }));
      setOrgForm((prev) => ({ ...prev, contact_email: data.contact_email }));
      setAutomatedEmailNotice('Automated email updated successfully! Future daily reports will be sent here.');
      setTimeout(() => setAutomatedEmailNotice(null), 4000);
    } catch (err: any) {
      setAutomatedEmailError(err.message || 'Failed to update automated email.');
    } finally {
      setSavingAutomatedEmail(false);
    }
  };

  // Organization Settings Save Handler
  const handleSaveOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrgSaveError(null);
    setOrgSaveNotice(null);

    if (!orgForm.name.trim()) {
      setOrgSaveError('Company Name is required.');
      return;
    }
    if (!orgForm.code.trim()) {
      setOrgSaveError('Company Code is required.');
      return;
    }

    setSavingOrg(true);
    try {
      const res = await fetch('/api/operator/organization', {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          name: orgForm.name.trim(),
          code: orgForm.code.trim().toUpperCase(),
          contact_email: orgForm.contact_email.trim(),
          welcome_message: orgForm.welcome_message.trim(),
          thank_you_message: orgForm.thank_you_message.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update organization details.');
      }

      setCurrentOrg(data.organization);
      setOrgSaveNotice('Company details and messages saved successfully!');
      setTimeout(() => setOrgSaveNotice(null), 4000);
    } catch (err: any) {
      setOrgSaveError(err.message || 'Failed to update organization settings.');
    } finally {
      setSavingOrg(false);
    }
  };

  // Feedback Deletion Handler
  const handleDeleteSubmission = async (subId: string) => {
    setDeletingSub(true);
    try {
      const res = await fetch(`/api/operator/submissions/${subId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete submission.');
      }

      if (selectedSubmission?.id === subId) {
        setSelectedSubmission(null);
      }
      setDeleteSubConfirmId(null);
      setSubmissions((prev) => prev.filter((s) => s.id !== subId));
      setTotalSubmissions((prev) => Math.max(0, prev - 1));
      setSubActionNotice(`Feedback #${subId} deleted successfully.`);
      setTimeout(() => setSubActionNotice(null), 4000);
      await fetchStats();
    } catch (err: any) {
      alert(err.message || 'Failed to delete submission.');
    } finally {
      setDeletingSub(false);
    }
  };

  // Refresh submissions when filters change
  useEffect(() => {
    if (['all', 'suggestions', 'complaints'].includes(activeTab)) {
      fetchSubmissions();
    }
  }, [page, activeTab, selectedStatus, selectedBoxId, selectedGroupId, searchQuery]);

  // Generate QR codes for all boxes with Universal Mobile Compatibility
  useEffect(() => {
    async function generateQRs() {
      const urls: Record<string, string> = {};
      const svgs: Record<string, string> = {};
      const baseOrigin = qrCustomDomain.trim()
        ? qrCustomDomain.trim().replace(/\/$/, '')
        : typeof window !== 'undefined'
        ? window.location.origin
        : '';

      const darkColor = qrColorMode === 'universal' ? '#000000' : '#0284c7';

      for (const box of boxes) {
        try {
          const publicUrl = `${baseOrigin}/s/${box.box_code}`;

          // High-resolution 1024px PNG with ISO/IEC 18004 4-module quiet zone & pure contrast
          const qrData = await QRCode.toDataURL(publicUrl, {
            width: 1024,
            margin: 4,
            errorCorrectionLevel: qrErrorLevel,
            color: { dark: darkColor, light: '#ffffff' },
          });
          urls[box.box_code] = qrData;

          // Pure scalable vector SVG (infinite sharpness for print placards)
          const svgData = await QRCode.toString(publicUrl, {
            type: 'svg',
            margin: 4,
            errorCorrectionLevel: qrErrorLevel,
            color: { dark: darkColor, light: '#ffffff' },
          });
          svgs[box.box_code] = svgData;
        } catch (e) {
          console.error('QR generation error', e);
        }
      }
      setQrCodeDataUrls(urls);
      setQrCodeSvgStrings(svgs);
    }
    if (boxes.length > 0) {
      generateQRs();
    }
  }, [boxes, qrColorMode, qrErrorLevel, qrCustomDomain]);

  // Download High-Resolution PNG (1024px)
  const downloadPng = (boxCode: string, boxTitle: string) => {
    const pngUrl = qrCodeDataUrls[boxCode];
    if (!pngUrl) return;
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = `QR-${boxCode}-${boxTitle.replace(/[^a-zA-Z0-9]/g, '_')}-1024px.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Download Vector SVG (infinite scale for print signage)
  const downloadSvg = (boxCode: string, boxTitle: string) => {
    const svgStr = qrCodeSvgStrings[boxCode];
    if (!svgStr) return;
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QR-${boxCode}-${boxTitle.replace(/[^a-zA-Z0-9]/g, '_')}-Vector.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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

  // Create Group (Synced with Feedback Boxes & QR Codes)
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
          feedback_box_id: newGroupBoxId === 'all' ? undefined : newGroupBoxId,
        }),
      });
      if (res.ok) {
        setShowCreateGroupModal(false);
        setNewGroupTitle('');
        setNewGroupDesc('');
        setNewGroupBoxId('all');
        await Promise.all([fetchGroups(), fetchBoxes(), fetchStats()]);
      }
    } catch (err) {
      console.error('Failed to create group', err);
    }
  };

  // Open Edit Group Modal
  const openEditGroupModal = (group: FeedbackGroup) => {
    setEditingGroup(group);
    setEditGroupTitle(group.title);
    setEditGroupDesc(group.description || '');
    setEditGroupStatus(group.status || 'Active');
    setEditGroupBoxId(group.feedback_box_id || 'all');
  };

  // Submit Edit Group
  const handleEditGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup || !editGroupTitle.trim()) return;

    setSavingGroupEdit(true);
    try {
      const res = await fetch(`/api/operator/groups/${editingGroup.id}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          title: editGroupTitle.trim(),
          description: editGroupDesc.trim(),
          status: editGroupStatus,
          feedback_box_id: editGroupBoxId === 'all' ? null : editGroupBoxId,
        }),
      });
      if (res.ok) {
        setEditingGroup(null);
        await Promise.all([fetchGroups(), fetchBoxes(), fetchStats()]);
      }
    } catch (err) {
      console.error('Failed to update group', err);
    } finally {
      setSavingGroupEdit(false);
    }
  };

  // Delete Group (Keeps submissions intact and re-syncs boxes & head counts)
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
        await Promise.all([fetchGroups(), fetchBoxes(), fetchSubmissions(), fetchStats()]);
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
      <header className="no-print bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
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
                {currentOrg.name} ({currentOrg.code})
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
              id="btn-header-change-password"
              onClick={() => {
                setChangePassError(null);
                setChangePassSuccess(null);
                setCurrentPassInput('');
                setNewPassInput('');
                setConfirmPassInput('');
                setShowChangePassModal(true);
              }}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5 text-xs border border-slate-700"
              title="Change your account password"
            >
              <KeyRound className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Password</span>
            </button>

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
        <div className="no-print bg-emerald-600 text-white text-xs px-4 py-2 text-center font-medium shadow-xs">
          {seedNotice}
        </div>
      )}

      {/* Subnav & Stat Highlights Bar */}
      <section className="no-print bg-white border-b border-slate-200">
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
                <span>Boxes & QR Codes</span>
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

              <button
                id="tab-users"
                onClick={() => setActiveTab('users')}
                className={`py-2 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === 'users'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>User Control</span>
              </button>

              <button
                id="tab-settings"
                onClick={() => setActiveTab('settings')}
                className={`py-2 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === 'settings'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Company Details</span>
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
      <main className={`max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full ${placardModalBox || showAllPlacardsModal ? 'no-print' : ''}`}>
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

                        <button
                          id={`btn-delete-sub-${sub.id}`}
                          onClick={() => setDeleteSubConfirmId(sub.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Delete submission"
                        >
                          <Trash2 className="w-4 h-4" />
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
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    Feedback Groups & Head Count Calculation
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                    Synced with Boxes & QR
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Every submission remains an independent database record. Groups aggregate head count & estimated unique devices across your physical and digital QR boxes.
                </p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  id="btn-open-create-group"
                  onClick={() => setShowCreateGroupModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 text-xs font-semibold shadow-xs transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create New Group</span>
                </button>
              </div>
            </div>

            {/* Sync & Filter Bar with Boxes & QR Codes */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <Filter className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Filter by QR Box / Location:</span>
                </div>
                <select
                  id="select-group-box-filter"
                  value={groupSelectedBoxFilter}
                  onChange={(e) => {
                    const newFilter = e.target.value;
                    setGroupSelectedBoxFilter(newFilter);
                    fetchGroups(newFilter);
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-hidden"
                >
                  <option value="all">🌐 All Feedback Boxes (Cross-Facility Head Count)</option>
                  {boxes.map((box) => (
                    <option key={box.id} value={box.id}>
                      📍 {box.title} ({box.box_code}) — {box.submission_count || 0} Submissions · {box.groups_count || 0} Groups
                    </option>
                  ))}
                </select>

                {groupSelectedBoxFilter !== 'all' && (
                  <button
                    onClick={() => {
                      setGroupSelectedBoxFilter('all');
                      fetchGroups('all');
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg transition"
                  >
                    <X className="w-3 h-3" />
                    <span>Clear Box Filter</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <button
                  onClick={() => {
                    fetchGroups(groupSelectedBoxFilter);
                    fetchBoxes();
                    fetchStats();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 transition"
                  title="Synchronize Group head counts with Box submissions"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Sync Head Count</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('qrcodes');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800 transition"
                  title="Navigate to Boxes & QR Codes"
                >
                  <QrCode className="w-3.5 h-3.5 text-slate-600" />
                  <span>Manage QR Boxes →</span>
                </button>
              </div>
            </div>

            {groups.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-800">No Feedback Groups Found</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {groupSelectedBoxFilter !== 'all'
                    ? 'No groups are currently associated with this selected feedback box. Submissions from this box can be clustered or assigned to any group.'
                    : 'Create feedback groups to aggregate related submissions into unified issues with automated head count and device telemetry.'}
                </p>
                {groupSelectedBoxFilter !== 'all' ? (
                  <button
                    onClick={() => {
                      setGroupSelectedBoxFilter('all');
                      fetchGroups('all');
                    }}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold"
                  >
                    View All Groups Across All Boxes
                  </button>
                ) : (
                  <button
                    onClick={() => setShowCreateGroupModal(true)}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create First Group</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    id={`group-card-${group.id}`}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex flex-wrap items-center gap-1.5">
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

                          {/* Synced Target Box Badge */}
                          {group.feedback_box_id && group.feedback_box_code ? (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md"
                              title="Locked to this QR Box"
                            >
                              <Building2 className="w-3 h-3 text-sky-600" />
                              <span>{group.feedback_box_title || group.feedback_box_code} [{group.feedback_box_code}]</span>
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md"
                              title="Aggregates submissions across all physical QR boxes"
                            >
                              <Layers className="w-3 h-3 text-indigo-600" />
                              <span>Cross-Facility ({group.boxes_breakdown?.length || 0} boxes)</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditGroupModal(group)}
                            className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-50 transition"
                            title="Edit group & assigned box"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteGroup(group.id)}
                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition"
                            title="Delete group (keeps original feedback intact)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h4 className="text-base font-bold text-slate-900">{group.title}</h4>
                      {group.description && (
                        <p className="text-xs text-slate-500 mt-1">{group.description}</p>
                      )}

                      {/* Head count metric showcase */}
                      <div className="mt-4 p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-around text-center">
                        <div>
                          <div className="text-2xl font-black text-indigo-950">
                            {group.submission_count}
                          </div>
                          <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                            Total Head Count
                          </div>
                        </div>
                        <div className="h-8 w-px bg-indigo-200" />
                        <div>
                          <div className="text-2xl font-black text-indigo-950">
                            {group.estimated_devices}
                          </div>
                          <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                            Estimated Devices
                          </div>
                        </div>
                      </div>

                      {/* Head Count Contribution by Contributing QR Boxes */}
                      <div className="mt-3.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                          <span className="flex items-center gap-1.5">
                            <QrCode className="w-3.5 h-3.5 text-slate-500" />
                            <span>Head Count by QR Location / Box</span>
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold lowercase">
                            {group.boxes_breakdown?.length || 0} locations synced
                          </span>
                        </div>

                        {(!group.boxes_breakdown || group.boxes_breakdown.length === 0) ? (
                          <p className="text-[11px] text-slate-400 italic">
                            No submissions in this group yet. QR box scans matching this issue will automatically sync here.
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {group.boxes_breakdown.map((b) => (
                              <div
                                key={b.box_id}
                                className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                                    {b.box_code}
                                  </span>
                                  <span className="font-semibold text-slate-800 truncate text-[11px]">
                                    {b.box_title}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-bold text-indigo-900 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded text-[11px]">
                                    {b.count} <span className="text-[9px] font-semibold text-indigo-600">head count</span>
                                  </span>
                                  <span className="text-[10px] text-slate-400 hidden sm:inline">
                                    ({b.devices} dev.)
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
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
            )}
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
            {/* Top Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    Permanent Public QR Codes & Digital Feedback Placards
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Universal Mobile Mode
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Engineered with ISO/IEC 18004 high-contrast pure black (#000000), 4-module quiet zone, and coarse module grid to ensure 100% scan reliability on all budget smartphones (e.g. Samsung Galaxy M02, Android Go, Xiaomi) as well as modern devices.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  id="btn-create-feedback-box"
                  onClick={openCreateBoxModal}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-3.5 py-2 text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Feedback Box</span>
                </button>
                <button
                  id="btn-print-all-placards"
                  onClick={() => setShowAllPlacardsModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Placards</span>
                </button>
              </div>
            </div>

            {/* Universal Mobile Compatibility Diagnostics & Control Panel */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-sm border border-slate-700 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-700/80">
                <div className="flex items-start sm:items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      Universal Mobile Scanner Optimization
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/40">
                        Active & Verified
                      </span>
                    </h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Budget phones (like Samsung Galaxy M02) lack neural HDR and rely on basic luminance thresholding. These QR codes use 21:1 contrast, 4-module quiet borders, and low-density modules so any phone camera scans them instantly.
                    </p>
                  </div>
                </div>
              </div>

              {/* Live Configuration Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
                {/* Contrast Mode */}
                <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700">
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1.5 flex items-center gap-1">
                    <Sliders className="w-3 h-3 text-sky-400" />
                    <span>Contrast / Color Mode</span>
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-900 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setQrColorMode('universal')}
                      className={`py-1.5 px-2 rounded-md font-semibold text-[11px] transition text-center ${
                        qrColorMode === 'universal'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Pure Black (#000)
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrColorMode('brand')}
                      className={`py-1.5 px-2 rounded-md font-semibold text-[11px] transition text-center ${
                        qrColorMode === 'brand'
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Colored QR codes may fail on budget devices with basic cameras"
                    >
                      Brand Blue
                    </button>
                  </div>
                </div>

                {/* Error Correction / Density */}
                <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700">
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1.5 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-emerald-400" />
                    <span>Dot Matrix Size / Density</span>
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-900 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setQrErrorLevel('M')}
                      className={`py-1.5 px-2 rounded-md font-semibold text-[11px] transition text-center ${
                        qrErrorLevel === 'M'
                          ? 'bg-slate-700 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Level M (15% Redundant)
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrErrorLevel('L')}
                      className={`py-1.5 px-2 rounded-md font-semibold text-[11px] transition text-center ${
                        qrErrorLevel === 'L'
                          ? 'bg-slate-700 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Level L (Largest Dots)
                    </button>
                  </div>
                </div>

                {/* Custom Base URL Override */}
                <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                      <Globe className="w-3 h-3 text-sky-400" />
                      <span>Production Base URL</span>
                    </label>
                    {qrCustomDomain && (
                      <button
                        type="button"
                        onClick={() => setQrCustomDomain('')}
                        className="text-[10px] text-sky-400 hover:underline"
                      >
                        Reset to default
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={qrCustomDomain}
                    onChange={(e) => setQrCustomDomain(e.target.value)}
                    placeholder={typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder-slate-500 font-mono outline-hidden focus:border-sky-500"
                  />
                </div>
              </div>
            </div>

            {boxActionNotice && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-medium text-emerald-800 flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{boxActionNotice}</span>
              </div>
            )}

            {boxes.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
                <QrCode className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-800">No Feedback Boxes Found</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Create your first permanent feedback box (e.g. Canteen, Production Floor, Reception) to generate unique QR codes.
                </p>
                <button
                  onClick={openCreateBoxModal}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create First Box</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {boxes.map((box) => {
                  const qrUrl = qrCodeDataUrls[box.box_code];
                  const baseOrigin = qrCustomDomain.trim()
                    ? qrCustomDomain.trim().replace(/\/$/, '')
                    : typeof window !== 'undefined'
                    ? window.location.origin
                    : '';
                  const publicUrl = `${baseOrigin}/s/${box.box_code}`;

                  return (
                    <div
                      key={box.box_code}
                      id={`qr-card-${box.box_code}`}
                      className="bg-white border-2 border-slate-200 hover:border-slate-300 transition-colors rounded-3xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden"
                    >
                      {/* Top Bar on Card: Status & Actions */}
                      <div className="w-full pb-3 mb-2 border-b border-slate-100 flex items-center justify-between">
                        <div>
                          {box.public_enabled !== false ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              Active Online
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                              <Lock className="w-2.5 h-2.5" />
                              Disabled
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            id={`btn-edit-box-${box.id}`}
                            onClick={() => openEditBoxModal(box)}
                            className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition"
                            title="Edit Feedback Box"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`btn-delete-box-${box.id}`}
                            onClick={() => setDeleteBoxConfirmId(box.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete Feedback Box"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Box Info */}
                      <div className="text-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 block">
                          {currentOrg.name || 'CloudBase Digital Box'}
                        </span>
                        <h4 className="text-base font-extrabold text-slate-900 mt-0.5">
                          {box.title}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 min-h-[32px]">
                          {box.description || 'Public feedback and suggestion box.'}
                        </p>
                      </div>

                      {/* High-Contrast QR Code image inside Stark White Container with ISO Quiet Zone */}
                      <div className="my-3 p-4 bg-white rounded-2xl border-2 border-slate-200 shadow-sm flex flex-col items-center justify-center">
                        {qrUrl ? (
                          <img
                            src={qrUrl}
                            alt={`Universal QR Code for ${box.box_code}`}
                            className="w-44 h-44 object-contain qr-crisp"
                          />
                        ) : (
                          <div className="w-44 h-44 flex items-center justify-center text-xs text-slate-400">
                            Generating Universal QR...
                          </div>
                        )}
                        <span className="text-[11px] font-mono text-slate-800 font-bold bg-slate-100 border border-slate-300 mt-2 py-0.5 px-3 rounded-full select-all">
                          {box.box_code}
                        </span>
                        <span className="text-[10px] text-emerald-700 font-semibold mt-1.5 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                          <span>100% Mobile Ready (Samsung M02 tested)</span>
                        </span>
                      </div>

                      {/* Synced Activity & Head Count Section (Spec sync with Groups & Head Count) */}
                      <div className="w-full my-2 p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-left">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-indigo-600" />
                            <span className="text-xs font-bold text-slate-900">Synced Head Count</span>
                          </div>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                            <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                            Live Synced
                          </span>
                        </div>

                        {/* Head Count & Device Metrics */}
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="bg-white/90 p-2 rounded-xl border border-indigo-100 shadow-2xs">
                            <div className="text-lg font-black text-indigo-950">{box.submission_count || 0}</div>
                            <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Submissions</div>
                          </div>
                          <div className="bg-white/90 p-2 rounded-xl border border-indigo-100 shadow-2xs">
                            <div className="text-lg font-black text-indigo-950">{box.estimated_devices || 0}</div>
                            <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Devices</div>
                          </div>
                        </div>

                        {/* Suggestions / Complaints Breakdown */}
                        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600 px-1 font-medium">
                          <span>💡 {box.suggestions_count || 0} suggestions</span>
                          <span>⚠ {box.complaints_count || 0} complaints</span>
                        </div>

                        {/* Active Linked Groups for this Box */}
                        {box.active_groups && box.active_groups.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-indigo-100">
                            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                              <span>Linked Groups ({box.active_groups.length}):</span>
                            </div>
                            <div className="space-y-1">
                              {box.active_groups.slice(0, 3).map((grp) => (
                                <div
                                  key={grp.id}
                                  className="flex items-center justify-between bg-white px-2 py-1 rounded-lg border border-indigo-100 text-[11px]"
                                >
                                  <span className="truncate max-w-[140px] text-slate-800 font-medium">
                                    {grp.type === 'suggestion' ? '💡' : '⚠'} {grp.title}
                                  </span>
                                  <span className="font-bold text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px] shrink-0">
                                    {grp.submission_count} <span className="text-indigo-600 font-normal">count</span>
                                  </span>
                                </div>
                              ))}
                              {box.active_groups.length > 3 && (
                                <span className="text-[10px] text-slate-400 block text-right pt-0.5">
                                  +{box.active_groups.length - 3} more groups
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Quick Action: Jump to Groups filtered for this box */}
                        <button
                          id={`btn-box-groups-${box.box_code}`}
                          onClick={() => {
                            setGroupSelectedBoxFilter(box.id);
                            fetchGroups(box.id);
                            setActiveTab('groups');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold transition shadow-xs"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>View Groups & Head Count ({box.groups_count || 0}) →</span>
                        </button>
                      </div>

                      {/* Card Actions */}
                      <div className="w-full space-y-2">
                        {/* Primary Action: Print Official Placard */}
                        <button
                          id={`btn-placard-${box.box_code}`}
                          onClick={() => setPlacardModalBox(box)}
                          className="w-full py-2 px-3 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print Official Placard</span>
                        </button>

                        {/* Download Options */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            id={`btn-download-png-${box.box_code}`}
                            onClick={() => downloadPng(box.box_code, box.title)}
                            disabled={!qrUrl}
                            className="py-1.5 px-2 text-[11px] font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition flex items-center justify-center gap-1"
                            title="Download 1024px High-Resolution PNG"
                          >
                            <Download className="w-3 h-3 text-slate-500" />
                            <span>PNG (1024px)</span>
                          </button>
                          <button
                            id={`btn-download-svg-${box.box_code}`}
                            onClick={() => downloadSvg(box.box_code, box.title)}
                            disabled={!qrCodeSvgStrings[box.box_code]}
                            className="py-1.5 px-2 text-[11px] font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition flex items-center justify-center gap-1"
                            title="Download Vector SVG (lossless infinite print resolution)"
                          >
                            <FileText className="w-3 h-3 text-slate-500" />
                            <span>SVG (Vector)</span>
                          </button>
                        </div>

                        {/* Navigation & Link testing */}
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                          <button
                            id={`btn-copy-url-${box.box_code}`}
                            onClick={() => {
                              navigator.clipboard.writeText(publicUrl);
                              setBoxActionNotice(`Copied link for ${box.title}: ${publicUrl}`);
                              setTimeout(() => setBoxActionNotice(null), 3000);
                            }}
                            className="py-1 px-2 text-[11px] font-medium rounded-lg text-slate-600 hover:bg-slate-100 transition flex items-center justify-center gap-1"
                          >
                            <Copy className="w-3 h-3 text-slate-400" />
                            <span>Copy URL</span>
                          </button>
                          <button
                            id={`btn-test-view-${box.box_code}`}
                            onClick={() => onOpenPublicView(box.box_code)}
                            className="py-1 px-2 text-[11px] font-medium rounded-lg text-sky-600 hover:bg-sky-50 transition flex items-center justify-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Test Form</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: User Control (Add / Edit / Remove Operators) */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600" />
                  <span>Operator & User Access Control</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Manage administrators and operators who can review submissions, categorize groups, and manage settings.
                </p>
              </div>

              {operator.role === 'admin' && (
                <button
                  id="btn-add-user"
                  onClick={openCreateUserModal}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-2 text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Operator / User</span>
                </button>
              )}
            </div>

            {userActionNotice && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-medium text-emerald-800 flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{userActionNotice}</span>
              </div>
            )}

            {operator.role !== 'admin' ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
                <Shield className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-amber-900">Administrator Privileges Required</h4>
                <p className="text-xs text-amber-700 mt-1 max-w-md mx-auto">
                  Only administrators have permission to create, edit, or remove operator accounts.
                  Your current account ({operator.username}) has the role: <span className="font-bold uppercase">{operator.role}</span>.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                {loadingUsers ? (
                  <div className="py-12 text-center text-xs text-slate-400">Loading user list...</div>
                ) : users.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">No users found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
                        <tr>
                          <th className="py-3 px-4">User</th>
                          <th className="py-3 px-4">Role</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Created Date</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {users.map((u) => {
                          const isSelf = u.id === operator.id;
                          return (
                            <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs">
                                    {u.username.slice(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                      <span>{u.username}</span>
                                      {isSelf && (
                                        <span className="text-[10px] font-semibold text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200">
                                          You
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] font-mono text-slate-400">
                                      ID: {u.id}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3.5 px-4">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold text-[11px] ${
                                    u.role === 'admin'
                                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                      : 'bg-slate-100 text-slate-800 border border-slate-200'
                                  }`}
                                >
                                  {u.role === 'admin' ? (
                                    <ShieldCheck className="w-3 h-3 text-purple-600" />
                                  ) : (
                                    <User className="w-3 h-3 text-slate-500" />
                                  )}
                                  <span className="capitalize">{u.role}</span>
                                </span>
                              </td>

                              <td className="py-3.5 px-4">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[11px] ${
                                    u.status === 'active'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      u.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'
                                    }`}
                                  ></span>
                                  <span className="capitalize">{u.status}</span>
                                </span>
                              </td>

                              <td className="py-3.5 px-4 text-slate-500">
                                {new Date(u.created_at).toLocaleDateString()}
                              </td>

                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    id={`btn-reset-user-password-${u.id}`}
                                    onClick={() => {
                                      setResetUserModalUser(u);
                                      setResetUserNewPass('');
                                      setResetUserError(null);
                                      setResetUserSuccess(null);
                                    }}
                                    className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition"
                                    title={`Reset Password for ${u.username}`}
                                  >
                                    <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                                  </button>

                                  <button
                                    id={`btn-edit-user-${u.id}`}
                                    onClick={() => openEditUserModal(u)}
                                    className="p-1.5 text-slate-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition"
                                    title="Edit User"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    id={`btn-delete-user-${u.id}`}
                                    onClick={() => setDeleteUserConfirmId(u.id)}
                                    disabled={isSelf}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                                    title={isSelf ? 'Cannot delete yourself' : 'Remove User'}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB: Company Details & Messages Customization */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-sky-600" />
                <span>Company Details & System Message Customization</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Configure your company name, short code, and custom messages presented to employees and guests on public QR boxes.
              </p>
            </div>

            {orgSaveNotice && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-medium text-emerald-800 flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{orgSaveNotice}</span>
              </div>
            )}

            {orgSaveError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-medium text-rose-800 flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{orgSaveError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Form Section */}
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
                <form onSubmit={handleSaveOrganization} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Company / Organization Name *
                      </label>
                      <input
                        id="input-company-name"
                        type="text"
                        required
                        value={orgForm.name}
                        onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                        placeholder="e.g. Cantec Printing & Packaging"
                        className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-sky-500 focus:ring-1 focus:ring-sky-200 outline-hidden"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        Displayed in public headers and email summaries.
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Short Code *
                      </label>
                      <input
                        id="input-company-code"
                        type="text"
                        required
                        value={orgForm.code}
                        onChange={(e) => setOrgForm({ ...orgForm, code: e.target.value })}
                        placeholder="e.g. CTP"
                        className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono uppercase text-slate-900 focus:border-sky-500 focus:ring-1 focus:ring-sky-200 outline-hidden"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        Prefix used for permanent QR codes and reports.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Management Notification Email
                    </label>
                    <input
                      id="input-company-email"
                      type="email"
                      value={orgForm.contact_email}
                      onChange={(e) => setOrgForm({ ...orgForm, contact_email: e.target.value })}
                      placeholder="e.g. management@cantec.lk"
                      className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-sky-500 focus:ring-1 focus:ring-sky-200 outline-hidden"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Target address where daily Cron email summaries and urgent alerts are dispatched.
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Public Welcome Message
                    </label>
                    <textarea
                      id="input-welcome-message"
                      rows={3}
                      value={orgForm.welcome_message}
                      onChange={(e) => setOrgForm({ ...orgForm, welcome_message: e.target.value })}
                      placeholder="Welcome to our Digital Feedback Box. Your voice helps us improve everyday."
                      className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-sky-500 focus:ring-1 focus:ring-sky-200 outline-hidden"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Shown to employees on the public feedback landing screen before they select a category.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Public Thank You / Submission Confirmation Message
                    </label>
                    <textarea
                      id="input-thankyou-message"
                      rows={3}
                      value={orgForm.thank_you_message}
                      onChange={(e) => setOrgForm({ ...orgForm, thank_you_message: e.target.value })}
                      placeholder="Thank you for your valuable feedback! Our management team reviews all submissions promptly."
                      className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-sky-500 focus:ring-1 focus:ring-sky-200 outline-hidden"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Presented to users immediately after their suggestion or complaint is recorded.
                    </p>
                  </div>

                  <div className="pt-3">
                    <button
                      id="btn-save-company-details"
                      type="submit"
                      disabled={savingOrg}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>{savingOrg ? 'Saving Changes...' : 'Save Company Details'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Live Preview Section */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                    Live Preview: Public Welcome Screen
                  </span>
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded-md bg-sky-600 text-white font-black text-[10px] flex items-center justify-center">
                        {orgForm.code?.slice(0, 2) || 'CB'}
                      </div>
                      <span className="text-xs font-extrabold text-slate-900 truncate">
                        {orgForm.name || 'Company Name'}
                      </span>
                    </div>
                    <div className="p-3 bg-sky-50/60 border border-sky-100 rounded-lg text-xs text-sky-900 leading-relaxed">
                      {orgForm.welcome_message || 'Welcome to our Digital Feedback Box. Your voice helps us improve everyday.'}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                    Live Preview: Public Thank You Screen
                  </span>
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs text-center">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                      <Check className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-900 block mb-1">
                      Feedback Submitted Successfully!
                    </span>
                    <p className="text-[11px] text-slate-600 leading-relaxed bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100">
                      {orgForm.thank_you_message || 'Thank you for your valuable feedback! Our management team reviews all submissions promptly.'}
                    </p>
                  </div>
                </div>
              </div>
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

            {/* Automated Email Configuration Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Automated Daily Reports Destination Email
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Cloudflare Worker Cron job dispatches daily digests to this designated address.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 truncate max-w-[220px]">
                    {currentOrg.contact_email || 'Not configured'}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSaveAutomatedEmail} className="mt-3.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <input
                    id="input-automated-report-email"
                    type="email"
                    required
                    value={automatedEmailInput}
                    onChange={(e) => setAutomatedEmailInput(e.target.value)}
                    placeholder="Enter automated email recipient (e.g. executive@cantec.lk)..."
                    className="w-full rounded-xl border border-slate-300 py-2 px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-200 outline-hidden font-medium"
                  />
                </div>
                <button
                  id="btn-save-automated-email"
                  type="submit"
                  disabled={savingAutomatedEmail || !automatedEmailInput.trim() || automatedEmailInput.trim() === currentOrg.contact_email}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer shrink-0"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{savingAutomatedEmail ? 'Updating...' : 'Update Email'}</span>
                </button>
              </form>

              {automatedEmailNotice && (
                <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{automatedEmailNotice}</span>
                </div>
              )}
              {automatedEmailError && (
                <div className="mt-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{automatedEmailError}</span>
                </div>
              )}
            </div>

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
                    Recipient: {currentOrg.contact_email || 'Not configured'}
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

              <div className="flex items-center gap-2">
                <button
                  id="btn-delete-sub-modal"
                  onClick={() => setDeleteSubConfirmId(selectedSubmission.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 text-xs font-semibold transition"
                  title="Delete this feedback"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>

                <button
                  id="btn-close-detail-modal"
                  onClick={() => setSelectedSubmission(null)}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
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
                  Assign to Feedback Box / QR Location
                </label>
                <select
                  value={newGroupBoxId}
                  onChange={(e) => setNewGroupBoxId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-sky-500 outline-hidden bg-white"
                >
                  <option value="all">🌐 All Boxes / Cross-Facility (Syncs from any QR code)</option>
                  {boxes.map((box) => (
                    <option key={box.id} value={box.id}>
                      📍 {box.title} ({box.box_code})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  If selected, this group will be linked to this specific physical box, and its head count metrics will sync with it.
                </p>
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

      {/* MODAL: Edit Feedback Group (Synced with Feedback Boxes & QR Codes) */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Edit Feedback Group</h3>
              </div>
              <button
                onClick={() => setEditingGroup(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditGroupSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Group Title / Issue Name
                </label>
                <input
                  type="text"
                  required
                  value={editGroupTitle}
                  onChange={(e) => setEditGroupTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-indigo-500 outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Status
                </label>
                <select
                  value={editGroupStatus}
                  onChange={(e) => setEditGroupStatus(e.target.value as FeedbackGroup['status'])}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-indigo-500 outline-hidden bg-white"
                >
                  <option value="Active">Active</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Target Feedback Box / QR Location
                </label>
                <select
                  value={editGroupBoxId}
                  onChange={(e) => setEditGroupBoxId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-indigo-500 outline-hidden bg-white"
                >
                  <option value="all">🌐 All Boxes / Cross-Facility (Multi-Location Sync)</option>
                  {boxes.map((box) => (
                    <option key={box.id} value={box.id}>
                      📍 {box.title} ({box.box_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editGroupDesc}
                  onChange={(e) => setEditGroupDesc(e.target.value)}
                  placeholder="Summary of what this feedback cluster represents..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-indigo-500 outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editGroupTitle.trim() || savingGroupEdit}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition disabled:opacity-50"
                >
                  {savingGroupEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create / Edit Feedback Box */}
      {showBoxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <QrCode className="w-4 h-4 text-sky-600" />
                <span>{boxModalMode === 'create' ? 'Create Feedback Box' : 'Edit Feedback Box'}</span>
              </h3>
              <button
                onClick={() => setShowBoxModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBox} className="space-y-4">
              {boxActionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{boxActionError}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Box Title *
                </label>
                <input
                  id="input-box-title"
                  type="text"
                  required
                  value={boxForm.title}
                  onChange={(e) => setBoxForm({ ...boxForm, title: e.target.value })}
                  placeholder="e.g. Canteen Cafeteria Feedback"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-sky-500 outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Box Identifier Code *
                </label>
                <input
                  id="input-box-code"
                  type="text"
                  required
                  value={boxForm.box_code}
                  onChange={(e) =>
                    setBoxForm({
                      ...boxForm,
                      box_code: e.target.value.toUpperCase().replace(/[^A-Z0-9\-_]/g, ''),
                    })
                  }
                  placeholder="e.g. CTP-CANTEEN"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono uppercase text-slate-900 focus:border-sky-500 outline-hidden"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Unique URL slug and QR payload (e.g. /s/CTP-CANTEEN).
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Description / Placard Subtitle
                </label>
                <textarea
                  id="input-box-desc"
                  rows={3}
                  value={boxForm.description}
                  onChange={(e) => setBoxForm({ ...boxForm, description: e.target.value })}
                  placeholder="Feedback for canteen cafeteria, food quality, hygiene, and dining environment..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-sky-500 outline-hidden"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Public Availability</span>
                  <p className="text-[10px] text-slate-500">
                    When enabled, anyone scanning this QR code can submit feedback.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={boxForm.public_enabled}
                    onChange={(e) => setBoxForm({ ...boxForm, public_enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBoxModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  id="btn-save-box-submit"
                  type="submit"
                  disabled={savingBox || !boxForm.title.trim() || !boxForm.box_code.trim()}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
                >
                  {savingBox ? 'Saving...' : boxModalMode === 'create' ? 'Create Box' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Delete Box Confirmation */}
      {deleteBoxConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center">Delete Feedback Box?</h3>
            <p className="text-xs text-slate-500 text-center mt-1">
              Are you sure you want to delete this permanent QR feedback box? Submissions already recorded in this box will be preserved in the archive.
            </p>
            <div className="flex justify-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeleteBoxConfirmId(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-delete-box"
                type="button"
                onClick={() => handleDeleteBox(deleteBoxConfirmId)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition"
              >
                Delete Box
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Create / Edit User */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-600" />
                <span>{userModalMode === 'create' ? 'Add Operator / User' : 'Edit User'}</span>
              </h3>
              <button
                onClick={() => setShowUserModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              {userActionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{userActionError}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Username *
                </label>
                <input
                  id="input-user-username"
                  type="text"
                  required
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  placeholder="e.g. ops_manager"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-purple-500 outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {userModalMode === 'create' ? 'Password *' : 'New Password (Optional)'}
                </label>
                <input
                  id="input-user-password"
                  type="password"
                  required={userModalMode === 'create'}
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder={
                    userModalMode === 'create'
                      ? 'Enter login password...'
                      : 'Leave blank to keep existing password'
                  }
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-purple-500 outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    System Role
                  </label>
                  <select
                    id="select-user-role"
                    value={userForm.role}
                    onChange={(e) =>
                      setUserForm({ ...userForm, role: e.target.value as 'operator' | 'admin' })
                    }
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 bg-white"
                  >
                    <option value="operator">Operator</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Account Status
                  </label>
                  <select
                    id="select-user-status"
                    value={userForm.status}
                    onChange={(e) =>
                      setUserForm({ ...userForm, status: e.target.value as 'active' | 'inactive' })
                    }
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  id="btn-save-user-submit"
                  type="submit"
                  disabled={
                    savingUser ||
                    !userForm.username.trim() ||
                    (userModalMode === 'create' && !userForm.password)
                  }
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
                >
                  {savingUser ? 'Saving...' : userModalMode === 'create' ? 'Add User' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Delete User Confirmation */}
      {deleteUserConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center">Remove Operator Account?</h3>
            <p className="text-xs text-slate-500 text-center mt-1">
              Are you sure you want to remove this operator account? They will immediately lose access to the operator dashboard.
            </p>
            <div className="flex justify-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeleteUserConfirmId(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-delete-user"
                type="button"
                onClick={() => handleDeleteUser(deleteUserConfirmId)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition"
              >
                Remove User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Change Current Operator Password */}
      {showChangePassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Change Account Password</h3>
                  <p className="text-[11px] text-slate-500">Updating credentials for {operator.username}</p>
                </div>
              </div>
              <button
                onClick={() => setShowChangePassModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleChangeMyPassword} className="space-y-4">
              {changePassSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{changePassSuccess}</span>
                </div>
              )}

              {changePassError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{changePassError}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Current Password *
                </label>
                <input
                  id="input-change-curr-pass"
                  type="password"
                  required
                  value={currentPassInput}
                  onChange={(e) => setCurrentPassInput(e.target.value)}
                  placeholder="Enter current password..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-sky-500 focus:ring-1 focus:ring-sky-200 outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  New Password *
                </label>
                <input
                  id="input-change-new-pass"
                  type="password"
                  required
                  value={newPassInput}
                  onChange={(e) => setNewPassInput(e.target.value)}
                  placeholder="Enter new password (min 4 characters)..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-sky-500 focus:ring-1 focus:ring-sky-200 outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Confirm New Password *
                </label>
                <input
                  id="input-change-confirm-pass"
                  type="password"
                  required
                  value={confirmPassInput}
                  onChange={(e) => setConfirmPassInput(e.target.value)}
                  placeholder="Re-type new password..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-sky-500 focus:ring-1 focus:ring-sky-200 outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChangePassModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-change-password"
                  type="submit"
                  disabled={changePassLoading || !currentPassInput || !newPassInput || !confirmPassInput}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
                >
                  {changePassLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Admin Reset User Password */}
      {resetUserModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Reset Operator Password</h3>
                  <p className="text-[11px] text-slate-500">
                    Assigning a new password for <span className="font-semibold text-slate-800">{resetUserModalUser.username}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setResetUserModalUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetUserPassword} className="space-y-4">
              {resetUserSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{resetUserSuccess}</span>
                </div>
              )}

              {resetUserError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{resetUserError}</span>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    New Password *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const randomPass = Math.random().toString(36).slice(-8) + '!';
                      setResetUserNewPass(randomPass);
                    }}
                    className="text-[11px] font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Generate Random</span>
                  </button>
                </div>
                <input
                  id="input-reset-user-new-pass"
                  type="text"
                  required
                  value={resetUserNewPass}
                  onChange={(e) => setResetUserNewPass(e.target.value)}
                  placeholder="Enter or generate temporary password..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-200 outline-hidden"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Share this password with the operator securely so they can log in.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetUserModalUser(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-reset-user-password"
                  type="submit"
                  disabled={resetUserLoading || !resetUserNewPass || resetUserNewPass.length < 4}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
                >
                  {resetUserLoading ? 'Saving...' : 'Set New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Delete Submission Confirmation */}
      {deleteSubConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center">Permanently Delete Feedback?</h3>
            <p className="text-xs text-slate-500 text-center mt-1">
              Are you sure you want to delete feedback <span className="font-mono font-bold text-slate-800">{deleteSubConfirmId}</span>? This will permanently remove the submission and any attached internal notes.
            </p>
            <div className="flex justify-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeleteSubConfirmId(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-delete-sub"
                type="button"
                onClick={() => handleDeleteSubmission(deleteSubConfirmId)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition"
              >
                Delete Feedback
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Single Official Printable Placard (Spec #16 & Universal Mobile QR) */}
      {placardModalBox && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-start bg-black/75 p-4 overflow-y-auto backdrop-blur-xs">
          {/* Top Control Bar (Screen Only - Hidden in Print) */}
          <div className="no-print w-full max-w-xl bg-slate-900 text-white rounded-2xl p-3 mb-4 shadow-xl border border-slate-800 flex items-center justify-between gap-3 sticky top-2 z-10">
            <div className="flex items-center gap-2">
              <Printer className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold">Printable Placard Preview</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                id="btn-modal-print-placard"
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Placard</span>
              </button>
              <button
                type="button"
                onClick={() => downloadSvg(placardModalBox.box_code, placardModalBox.title)}
                disabled={!qrCodeSvgStrings[placardModalBox.box_code]}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition flex items-center gap-1"
                title="Download Vector SVG for vinyl printing"
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">SVG</span>
              </button>
              <button
                type="button"
                onClick={() => downloadPng(placardModalBox.box_code, placardModalBox.title)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition flex items-center gap-1"
                title="Download 1024px High-Res PNG"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">PNG</span>
              </button>
              <button
                type="button"
                onClick={() => setPlacardModalBox(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Official Printable Placard Page (Styled for A4 / Letter Print) */}
          <div className="print-placard-page w-full max-w-xl bg-white text-slate-900 rounded-3xl shadow-2xl p-8 sm:p-10 border-4 border-slate-900 flex flex-col items-center justify-between text-center relative my-auto">
            {/* Header / Brand */}
            <div className="w-full border-b-2 border-slate-900 pb-5">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 block mb-1">
                {currentOrg.name || 'CloudBase Digital'} • Official Feedback Channel
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight uppercase">
                {placardModalBox.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-2 font-medium max-w-md mx-auto">
                {placardModalBox.description ||
                  'Your honest suggestions and feedback help us improve. Scan the code to submit anonymously or openly.'}
              </p>
            </div>

            {/* Huge Universal High-Contrast QR Code */}
            <div className="my-6 p-6 bg-white border-2 border-slate-900 rounded-2xl shadow-sm flex flex-col items-center justify-center">
              {qrCodeDataUrls[placardModalBox.box_code] ? (
                <img
                  src={qrCodeDataUrls[placardModalBox.box_code]}
                  alt={`QR Code for ${placardModalBox.box_code}`}
                  className="w-56 h-56 sm:w-64 sm:h-64 object-contain qr-crisp"
                />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-xs text-slate-400">
                  Generating High-Contrast QR...
                </div>
              )}
              <div className="mt-3 font-mono text-sm sm:text-base font-black bg-slate-100 border border-slate-300 text-slate-900 px-4 py-1 rounded-full">
                BOX CODE: {placardModalBox.box_code}
              </div>
            </div>

            {/* Step-by-Step Instructions for All Phone Users */}
            <div className="w-full bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left mb-6">
              <h5 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-2.5 text-center">
                How to Submit (Takes Under 60 Seconds)
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-700">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                    1
                  </div>
                  <p className="leading-snug">
                    Open your mobile camera or any QR scanner app.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                    2
                  </div>
                  <p className="leading-snug">
                    Point camera at the QR code and tap the link that appears.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                    3
                  </div>
                  <p className="leading-snug">
                    Choose Suggestion or Complaint, write your thoughts, and send.
                  </p>
                </div>
              </div>
            </div>

            {/* Direct Web Address Fallback */}
            <div className="text-xs text-slate-500 font-mono mb-4 select-all">
              Direct Web Address:{' '}
              <span className="font-bold text-slate-900">
                {(qrCustomDomain.trim()
                  ? qrCustomDomain.trim().replace(/\/$/, '')
                  : typeof window !== 'undefined'
                  ? window.location.origin
                  : '') + `/s/${placardModalBox.box_code}`}
              </span>
            </div>

            {/* Guarantee / Privacy Footer */}
            <div className="w-full border-t border-slate-200 pt-3 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 font-medium">
              <span className="flex items-center gap-1 text-slate-800 font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                100% Anonymous & Securely Encrypted
              </span>
              <span className="text-[10px] text-slate-400 mt-1 sm:mt-0">
                CloudBase Digital Feedback System
              </span>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Print All Placards (Batch Multi-Page Print for Entire Facility) */}
      {showAllPlacardsModal && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-start bg-black/80 p-4 overflow-y-auto backdrop-blur-xs">
          {/* Top Toolbar */}
          <div className="no-print w-full max-w-xl bg-slate-900 text-white rounded-2xl p-3 mb-6 shadow-xl border border-slate-800 flex items-center justify-between gap-3 sticky top-2 z-10">
            <div className="flex items-center gap-2">
              <Printer className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold">
                Batch Facility Placards ({boxes.length} Sign{boxes.length === 1 ? '' : 's'})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print All Signs</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAllPlacardsModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sequential Placards for Each Box */}
          <div className="w-full max-w-xl space-y-8">
            {boxes.map((box) => {
              const baseOrigin = qrCustomDomain.trim()
                ? qrCustomDomain.trim().replace(/\/$/, '')
                : typeof window !== 'undefined'
                ? window.location.origin
                : '';
              const publicUrl = `${baseOrigin}/s/${box.box_code}`;
              const qrUrl = qrCodeDataUrls[box.box_code];

              return (
                <div
                  key={`all-placard-${box.box_code}`}
                  className="print-placard-page w-full bg-white text-slate-900 rounded-3xl shadow-2xl p-8 sm:p-10 border-4 border-slate-900 flex flex-col items-center justify-between text-center relative mb-8"
                >
                  <div className="w-full border-b-2 border-slate-900 pb-5">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 block mb-1">
                      {currentOrg.name || 'CloudBase Digital'} • Official Feedback Channel
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight uppercase">
                      {box.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 mt-2 font-medium max-w-md mx-auto">
                      {box.description ||
                        'Your honest suggestions and feedback help us improve. Scan the code to submit anonymously or openly.'}
                    </p>
                  </div>

                  <div className="my-6 p-6 bg-white border-2 border-slate-900 rounded-2xl shadow-sm flex flex-col items-center justify-center">
                    {qrUrl ? (
                      <img
                        src={qrUrl}
                        alt={`QR Code for ${box.box_code}`}
                        className="w-56 h-56 sm:w-64 sm:h-64 object-contain qr-crisp"
                      />
                    ) : (
                      <div className="w-56 h-56 flex items-center justify-center text-xs text-slate-400">
                        Generating High-Contrast QR...
                      </div>
                    )}
                    <div className="mt-3 font-mono text-sm sm:text-base font-black bg-slate-100 border border-slate-300 text-slate-900 px-4 py-1 rounded-full">
                      BOX CODE: {box.box_code}
                    </div>
                  </div>

                  <div className="w-full bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left mb-6">
                    <h5 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-2.5 text-center">
                      How to Submit (Takes Under 60 Seconds)
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-700">
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                          1
                        </div>
                        <p className="leading-snug">
                          Open your mobile camera or any QR scanner app.
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                          2
                        </div>
                        <p className="leading-snug">
                          Point camera at the QR code and tap the link that appears.
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                          3
                        </div>
                        <p className="leading-snug">
                          Choose Suggestion or Complaint, write your thoughts, and send.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 font-mono mb-4 select-all">
                    Direct Web Address:{' '}
                    <span className="font-bold text-slate-900">{publicUrl}</span>
                  </div>

                  <div className="w-full border-t border-slate-200 pt-3 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span className="flex items-center gap-1 text-slate-800 font-semibold">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      100% Anonymous & Securely Encrypted
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1 sm:mt-0">
                      CloudBase Digital Feedback System
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
