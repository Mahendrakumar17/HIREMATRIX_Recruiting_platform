import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Bell, LayoutDashboard, ShieldCheck, UserCircle2, Users } from 'lucide-react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import api, { rejectApplication, shortlistApplication } from './api';
import { useAuth } from './state';

const signupRoles = ['Applicant', 'Recruiter', 'HR', 'HiringManager'];
const socketBaseUrl = `http://${window.location.hostname}:5001`;
const roleSections = { Applicant: ['overview', 'jobs', 'applications', 'interviews', 'notifications'], Recruiter: ['overview', 'jobs', 'applications', 'interviews', 'notifications'], HiringManager: ['overview', 'applications', 'interviews', 'notifications'], HR: ['overview', 'jobs', 'applications', 'analytics', 'notifications'], Admin: ['overview', 'jobs', 'analytics', 'users', 'notifications'] };
const sectionLabel = { overview: 'Overview', jobs: 'Jobs', applications: 'Applications', interviews: 'Interviews', notifications: 'Notifications', analytics: 'Analytics', users: 'User Governance' };

const Landing = () => (
  <div className="landing hero-shell">
    <nav className="top-nav glass"><h2>HireMatrix</h2><div><a href="#features">Features</a><Link to="/auth" className="btn btn-ghost">Log In</Link><Link to="/auth" className="btn">Get Started</Link></div></nav>
    <section className="hero glass"><span className="badge">Born in AI. Built for Hiring Teams.</span><h1>The All-In-One Platform<br />For Candidate Conversations.</h1><p>Streamline sourcing, screening, interviews, decisions, and communication in one synchronized recruiting workspace.</p><div className="hero-actions"><Link to="/auth" className="btn">Launch HireMatrix</Link><a href="#features" className="btn btn-ghost">Explore Features</a></div></section>
  </div>
);

const AuthPage = () => {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'Applicant', phone: '', skills: '', experience: '', companyName: '', companyWebsite: '', designation: '', resume: null });
  const [recommendedSkills, setRecommendedSkills] = useState([]);
  useEffect(() => {
    const loadRecommendedSkills = async () => {
      if (isLogin || form.role !== 'Applicant') return;
      // /jobs is protected; skip request for unauthenticated users to avoid 401 noise.
      if (!localStorage.getItem('token')) return;
      try {
        const { data } = await api.get('/jobs');
        const collected = new Set();
        (data || []).forEach((job) => (job.requirements || []).forEach((req) => req?.trim() && collected.add(req.trim())));
        setRecommendedSkills(Array.from(collected).slice(0, 20));
      } catch {
        setRecommendedSkills([]);
      }
    };
    loadRecommendedSkills();
  }, [isLogin, form.role]);
  const submit = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await login(form.email, form.password);
        return;
      }
      if (form.role === 'Applicant' && !form.resume) {
        toast.error('Resume is mandatory for applicants.');
        return;
      }
      if ((form.role === 'Recruiter' || form.role === 'HR') && !form.companyName?.trim()) {
        toast.error('Company name is required for recruiter/HR onboarding.');
        return;
      }
      const data = await register(form);
      if (data?.message && !data.token) {
        toast.success(data.message);
        setIsLogin(true);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Authentication failed.');
    }
  };
  return <div className="auth-shell hero-shell"><div className="auth-card glass"><h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2><form onSubmit={submit} className="stack">{!isLogin && <input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />}<input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /><input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
    {!isLogin && <><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{signupRoles.map((r) => <option key={r}>{r}</option>)}</select><input placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />{form.role === 'Applicant' && <><input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setForm({ ...form, resume: e.target.files?.[0] || null })} required /><input placeholder="Skills (comma separated)" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} /><input placeholder="Experience" value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} />{recommendedSkills.length > 0 && <div className="row-actions">{recommendedSkills.map((skill) => <button key={skill} type="button" className="btn btn-ghost" onClick={() => setForm({ ...form, skills: `${form.skills ? `${form.skills}, ` : ''}${skill}` })}>{skill}</button>)}</div>}</>}{(form.role === 'Recruiter' || form.role === 'HR') && <><input placeholder="Company name" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required /><input placeholder="Company website" value={form.companyWebsite} onChange={(e) => setForm({ ...form, companyWebsite: e.target.value })} /><input placeholder="Designation" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></>}</>}
    <button className="btn" type="submit">{isLogin ? 'Login' : 'Register'}</button></form><button className="btn btn-ghost" onClick={() => setIsLogin((v) => !v)}>{isLogin ? 'Need an account? Register' : 'Already have an account? Login'}</button></div></div>;
};

const Dashboard = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const role = user?.role || 'Applicant';
  const sections = roleSections[role] || roleSections.Applicant;
  const [jobs, setJobs] = useState([]);
  const [apps, setApps] = useState([]);
  const [notes, setNotes] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [report, setReport] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [resumeFiles, setResumeFiles] = useState({});
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [teamComment, setTeamComment] = useState({});
  const [selectedRecruiterJobId, setSelectedRecruiterJobId] = useState('');
  const [selectedApplicationsJobId, setSelectedApplicationsJobId] = useState('');
  const [selectedJobPreview, setSelectedJobPreview] = useState(null);
  const governanceUsers = useMemo(
    () => adminUsers.filter((u) => !['Recruiter', 'HR', 'HiringManager'].includes(u.role)),
    [adminUsers],
  );

  const load = async () => {
    setBusy(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (selectedApplicationsJobId && role !== 'Applicant') params.jobId = selectedApplicationsJobId;
      const [j, a, n, i] = await Promise.all([api.get('/jobs'), api.get('/applications', { params }), api.get('/notifications'), api.get('/interviews')]);
      setJobs(j.data); setApps(a.data); setNotes(n.data); setInterviews(i.data);
      if (role === 'HR' || role === 'Admin') setReport((await api.get('/admin/report')).data);
      if (role === 'Admin') {
        setAdminUsers((await api.get('/admin/users')).data);
        setPendingUsers((await api.get('/admin/pending-users')).data);
      }
    } finally { setBusy(false); }
  };
  useEffect(() => { load(); }, [role, statusFilter, selectedApplicationsJobId]);
  useEffect(() => {
    if (!selectedApplicationsJobId) return;
    if (!jobs.some((job) => job._id === selectedApplicationsJobId)) setSelectedApplicationsJobId('');
  }, [jobs, selectedApplicationsJobId]);
  useEffect(() => { if (!user) return; const socket = io(socketBaseUrl); socket.emit('join', user._id || user.id); socket.on('notification:new', (item) => { setNotes((p) => [item, ...p]); toast.success(item.message); }); return () => socket.disconnect(); }, [user]);

  const applyJob = async (jobId) => {
    const selectedResume = resumeFiles[jobId];
    if (!selectedResume) return toast.error('Upload a resume first');
    const data = new FormData();
    data.append('jobId', jobId);
    data.append('resume', selectedResume);
    try {
      await api.post('/applications', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Application submitted');
      await load();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to apply');
      await load();
    }
  };
  const setAppStatus = async (id, status) => { await api.patch(`/applications/${id}/status`, { status }); toast.success(`Updated to ${status}`); await load(); };
  const handleShortlist = async (id) => { await shortlistApplication(id); toast.success('Candidate shortlisted'); await load(); };
  const handleReject = async (id) => { const reason = window.prompt('Optional rejection reason', '') || ''; await rejectApplication(id, reason); toast.success('Candidate rejected'); await load(); };
  const scheduleInterview = async (applicationId) => { await api.post('/interviews', { applicationId, interviewerId: user?._id || user?.id, scheduledDate: new Date(Date.now() + 86400000).toISOString() }); toast.success('Interview scheduled'); await load(); };
  const addFeedback = async (id, result, feedback) => { await api.patch(`/interviews/${id}`, { result, feedback }); toast.success('Feedback submitted'); await load(); };
  const setUserActive = async (u, isActive) => {
    if (!isActive) {
      if (!window.confirm(`Deactivate and delete ${u.name} permanently?`)) return;
      await api.patch(`/admin/users/${u._id}`, { isActive: false });
      toast.success('User deactivated and removed');
    } else {
      await api.patch(`/admin/users/${u._id}`, { isActive: true });
      toast.success('User activated');
    }
    await load();
  };
  const approveUser = async (id) => { await api.patch(`/admin/users/${id}/approval`, { approvalStatus: 'Approved' }); toast.success('User approved'); await load(); };
  const rejectUser = async (id) => { const reason = window.prompt('Provide rejection reason (optional):'); await api.patch(`/admin/users/${id}/approval`, { approvalStatus: 'Rejected', rejectionReason: reason || '' }); toast.success('User rejected'); await load(); };
  const addComment = async (appId) => { const message = (teamComment[appId] || '').trim(); if (!message) return; await api.post(`/applications/${appId}/comments`, { message }); setTeamComment((p) => ({ ...p, [appId]: '' })); toast.success('Team note added'); await load(); };
  const updateJob = async (job) => { const title = window.prompt('Update job title', job.title); if (!title) return; const description = window.prompt('Update job description', job.description); if (!description) return; const requirementsText = window.prompt('Update requirements (comma separated)', (job.requirements || []).join(', ')) || ''; const deadlineDefault = job.deadline ? new Date(job.deadline).toISOString().slice(0, 10) : ''; const deadline = window.prompt('Update deadline (YYYY-MM-DD, leave empty for none)', deadlineDefault) || ''; await api.put(`/jobs/${job._id}`, { title, description, requirements: requirementsText.split(',').map((x) => x.trim()).filter(Boolean), deadline: deadline || undefined }); toast.success('Job updated'); await load(); };
  const deleteJob = async (job) => { if (!window.confirm(`Delete ${job.title}?`)) return; await api.delete(`/jobs/${job._id}`); toast.success('Job deleted'); await load(); };

  const myId = user?._id || user?.id;
  const applicantInterviews = useMemo(() => interviews.filter((it) => (it.applicationId?.applicantId?._id || it.applicationId?.applicantId?.id) === myId), [interviews, myId]);
  const pipeline = useMemo(() => apps.reduce((acc, curr) => { acc[curr.status] = (acc[curr.status] || 0) + 1; return acc; }, {}), [apps]);
  const applicantApplicationsByJob = useMemo(() => {
    if (role !== 'Applicant') return {};
    return apps.reduce((acc, app) => {
      if (app?.jobId?._id) acc[app.jobId._id] = app;
      return acc;
    }, {});
  }, [apps, role]);
  const canCreateJobs = role === 'Recruiter' || role === 'HR' || role === 'Admin';
  const filteredApps = apps.filter((a) => { const term = searchFilter.toLowerCase(); return !term || a.jobId?.title?.toLowerCase().includes(term) || a.applicantId?.name?.toLowerCase().includes(term); });
  const recruiterJobBuckets = useMemo(() => { const grouped = {}; filteredApps.forEach((app) => { const id = app.jobId?._id; if (!id) return; if (!grouped[id]) grouped[id] = { jobTitle: app.jobId.title, applications: [] }; grouped[id].applications.push(app); }); return grouped; }, [filteredApps]);
  const isDeadlinePassed = (deadline) => !!deadline && new Date(deadline).getTime() < Date.now();
  const applicantTrackingLabel = { Applied: 'Application submitted', 'Under Review': 'Profile under review', Shortlisted: 'Shortlisted', Rejected: 'Rejected', 'Interview Scheduled': 'Interview scheduled', Selected: 'Selected', 'Not Shortlisted': 'Not shortlisted' };

  const getContent = (section) => {
    if (!sections.includes(section)) return <Navigate to={`/dashboard/${sections[0]}`} replace />;
    if (section === 'overview') return <section className="panel glass"><h3>Overview</h3><div className="stat-grid"><div className="glass"><LayoutDashboard size={18} /> Jobs <b>{jobs.length}</b></div><div className="glass"><Users size={18} /> Applications <b>{apps.length}</b></div><div className="glass"><Bell size={18} /> Alerts <b>{notes.length}</b></div><div className="glass"><ShieldCheck size={18} /> Role <b>{role}</b></div></div></section>;
    if (section === 'jobs') return <section className="panel glass"><h3>{canCreateJobs ? 'Create and Manage Jobs' : 'Open Jobs'}</h3>{canCreateJobs && <JobForm onDone={load} />}<div className="divider" />{jobs.map((job) => { const existingApplication = applicantApplicationsByJob[job._id]; const hasApplied = role === 'Applicant' && !!existingApplication; return <div className="row" key={job._id}><div><b>{job.title}</b><p>{job.company}</p><p>{job.deadline ? `Deadline: ${new Date(job.deadline).toLocaleDateString()}` : 'No deadline'}</p>{isDeadlinePassed(job.deadline) && <span className="pill">Applications Closed</span>}</div><div className="row-actions"><button className="btn btn-ghost" onClick={() => setSelectedJobPreview(job)}>View Details</button>{role === 'Applicant' && !hasApplied && <><input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setResumeFiles((p) => ({ ...p, [job._id]: e.target.files?.[0] || null }))} disabled={isDeadlinePassed(job.deadline)} /><button className="btn" onClick={() => applyJob(job._id)} disabled={isDeadlinePassed(job.deadline)}>{isDeadlinePassed(job.deadline) ? 'Closed' : 'Apply'}</button></>}{role === 'Applicant' && hasApplied && <span className="pill">Applied ({existingApplication.status})</span>}{canCreateJobs && <><button className="btn btn-ghost" onClick={() => updateJob(job)}>Edit</button><button className="btn btn-ghost" onClick={() => deleteJob(job)}>Delete</button></>}</div></div>; })}</section>;
    if (section === 'applications') {
      if (role === 'Recruiter') {
        const jobOptions = Object.entries(recruiterJobBuckets);
        const selectedBucketId = selectedRecruiterJobId || jobOptions[0]?.[0] || '';
        const selectedBucket = selectedBucketId ? recruiterJobBuckets[selectedBucketId] : undefined;
        return <section className="panel glass"><h3>Recruiter Applications by Job</h3><div className="row-actions"><input placeholder="Search candidate/job" value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All statuses</option><option>Applied</option><option>Under Review</option><option>Shortlisted</option><option>Interview Scheduled</option><option>Rejected</option><option>Selected</option></select><select value={selectedBucketId} onChange={(e) => setSelectedRecruiterJobId(e.target.value)}>{jobOptions.map(([jobId, bucket]) => <option key={jobId} value={jobId}>{bucket.jobTitle} ({bucket.applications.length})</option>)}</select></div>{!selectedBucket && <p>No applications for your jobs yet.</p>}{selectedBucket && <><p><b>{selectedBucket.jobTitle}</b> | Applicants: {selectedBucket.applications.length}</p>{selectedBucket.applications.map((app) => <div className="row" key={app._id}><div><b>{app.applicantId?.name}</b><p>{app.applicantId?.email || 'No email'} - {app.status}</p><p>{app.statusReason || ''}</p><p>{app.resume ? <a href={`http://${window.location.hostname}:5001/${app.resume}`} target="_blank" rel="noreferrer">View Resume</a> : 'Resume unavailable'}</p></div><div className="row-actions"><button className="btn" onClick={() => setAppStatus(app._id, 'Under Review')}>Reviewing</button><button className="btn" onClick={() => handleShortlist(app._id)}>Shortlist</button><button className="btn btn-ghost" onClick={() => handleReject(app._id)}>Reject</button><button className="btn" onClick={() => scheduleInterview(app._id)}>Schedule</button><input placeholder="Team note" value={teamComment[app._id] || ''} onChange={(e) => setTeamComment((p) => ({ ...p, [app._id]: e.target.value }))} /><button className="btn btn-ghost" onClick={() => addComment(app._id)}>Add Note</button></div></div>)}</>}</section>;
      }
      const roleList = filteredApps;
      const jobsForFilter = jobs || [];
      return <section className="panel glass"><h3>{role} Applications</h3><div className="row-actions"><input placeholder="Search candidate/job" value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All statuses</option><option>Applied</option><option>Under Review</option><option>Shortlisted</option><option>Interview Scheduled</option><option>Rejected</option><option>Selected</option></select>{role !== 'Applicant' && <select value={selectedApplicationsJobId} onChange={(e) => setSelectedApplicationsJobId(e.target.value)}><option value="">Select job</option>{jobsForFilter.map((job) => <option key={job._id} value={job._id}>{job.title} - {job.company}</option>)}</select>}</div>{role !== 'Applicant' && selectedApplicationsJobId && <p><b>Applicant count:</b> {roleList.length}</p>}{role !== 'Applicant' && !selectedApplicationsJobId && <p>Select a job to view applicants in detail.</p>}{(role === 'Applicant' || selectedApplicationsJobId) && roleList.map((app) => <div className="row" key={app._id}><div><b>{app.jobId?.title}</b><p>{app.applicantId?.name} - {app.status}</p><p>{app.applicantId?.email || ''}</p><p>{app.statusReason || ''}</p><p>{app.resume ? <a href={`http://${window.location.hostname}:5001/${app.resume}`} target="_blank" rel="noreferrer">View Resume</a> : 'Resume unavailable'}</p>{app.comments?.slice(-2).map((c, i) => <p key={i}>[{c.authorRole}] {c.message}</p>)}</div><div className="row-actions">{role === 'HR' && <><button className="btn" onClick={() => setAppStatus(app._id, 'Selected')}>Select</button><button className="btn btn-ghost" onClick={() => handleReject(app._id)}>Reject</button><button className="btn" onClick={() => setAppStatus(app._id, 'Interview Scheduled')}>Set Interview Stage</button></>}{(role === 'Recruiter' || role === 'HR' || role === 'HiringManager' || role === 'Admin') && <><input placeholder="Team note" value={teamComment[app._id] || ''} onChange={(e) => setTeamComment((p) => ({ ...p, [app._id]: e.target.value }))} /><button className="btn btn-ghost" onClick={() => addComment(app._id)}>Add Note</button></>}{role === 'Applicant' && <span className="pill">{applicantTrackingLabel[app.status] || app.status}</span>}</div></div>)}</section>;
    }
    if (section === 'interviews') { const list = role === 'Applicant' ? applicantInterviews : interviews; return <section className="panel glass"><h3>Interviews</h3>{list.map((it) => <div className="row" key={it._id}><div><b>{it.applicationId?.jobId?.title || 'Interview'}</b><p>{new Date(it.scheduledDate).toLocaleString()} | {it.result || 'Pending'}</p></div>{role === 'HiringManager' && <InterviewFeedbackRow interview={it} onSubmit={addFeedback} />}</div>)}</section>; }
    if (section === 'analytics') return <section className="panel glass"><h3>Recruitment Analytics</h3>{report && <p>Users: {report.users} | Jobs: {report.jobs} | Applications: {report.applications}</p>}<pre>{JSON.stringify(pipeline, null, 2)}</pre></section>;
    if (section === 'users') return <section className="panel glass"><h3>Pending Approvals</h3>{pendingUsers.length === 0 && <p>No pending approvals.</p>}{pendingUsers.map((u) => <div className="row" key={u._id}><div><b>{u.name}</b><p>{u.email} | {u.role}</p><p>Company: {u.companyDetails?.companyName || 'N/A'}</p></div><div className="row-actions"><button className="btn" onClick={() => approveUser(u._id)}>Approve</button><button className="btn btn-ghost" onClick={() => rejectUser(u._id)}>Reject</button></div></div>)}<div className="divider" /><h3>User Governance</h3>{governanceUsers.length === 0 && <p>No users available for governance.</p>}{governanceUsers.map((u) => <div className="row" key={u._id}><div><b>{u.name}</b><p>{u.email} | {u.role}</p></div><div className="row-actions"><button className="btn btn-ghost" onClick={() => setUserActive(u, false)}>Deactivate & Delete</button></div></div>)}</section>;
    return <section className="panel glass"><h3>Notifications</h3>{notes.map((note) => <div className="row" key={note._id}><div>{note.message}</div></div>)}</section>;
  };

  const currentSection = location.pathname.split('/')[2] || sections[0];
  return <><div className="dashboard-shell"><header className="header glass"><div><h3>HireMatrix</h3><p>{sectionLabel[currentSection] || 'Workspace'}</p></div><div className="header-actions"><button className="btn btn-ghost"><UserCircle2 size={16} /> {user?.name} ({role})</button><button className="btn" onClick={load} disabled={busy}>{busy ? 'Refreshing...' : 'Refresh'}</button><button className="btn btn-ghost" onClick={logout}>Logout</button></div></header><aside className="sidebar glass">{sections.map((section) => <NavLink key={section} to={`/dashboard/${section}`} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>{sectionLabel[section]}</NavLink>)}</aside><main className="dashboard-main">{getContent(currentSection)}</main></div>{selectedJobPreview && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.55)', display: 'grid', placeItems: 'center', zIndex: 1000 }} onClick={() => setSelectedJobPreview(null)}><div className="glass" style={{ width: 'min(720px, 92vw)', maxHeight: '82vh', overflowY: 'auto', padding: 16 }} onClick={(e) => e.stopPropagation()}><div className="row" style={{ justifyContent: 'space-between' }}><h4>{selectedJobPreview.title} - Job Details</h4><button className="btn btn-ghost" onClick={() => setSelectedJobPreview(null)}>Close</button></div><p><b>Company:</b> {selectedJobPreview.company}</p><p><b>Description:</b> {selectedJobPreview.description}</p><p><b>Requirements:</b> {selectedJobPreview.requirements?.join(', ') || 'N/A'}</p><p><b>Deadline:</b> {selectedJobPreview.deadline ? new Date(selectedJobPreview.deadline).toLocaleString() : 'No deadline'}</p><p><b>Status:</b> {isDeadlinePassed(selectedJobPreview.deadline) ? 'Applications Closed' : 'Open for applications'}</p></div></div>}</>;
};

const InterviewFeedbackRow = ({ interview, onSubmit }) => {
  const [feedback, setFeedback] = useState('');
  return <div className="row-actions"><input value={feedback} placeholder="Add feedback" onChange={(e) => setFeedback(e.target.value)} /><button className="btn" onClick={() => onSubmit(interview._id, 'Pass', feedback)}>Pass</button><button className="btn btn-ghost" onClick={() => onSubmit(interview._id, 'Fail', feedback)}>Fail</button></div>;
};

const JobForm = ({ onDone }) => {
  const [form, setForm] = useState({ title: '', company: '', description: '', requirements: '', deadline: '' });
  const submit = async (e) => {
    e.preventDefault();
    await api.post('/jobs', { ...form, requirements: form.requirements.split(',').map((x) => x.trim()).filter(Boolean), deadline: form.deadline || undefined });
    toast.success('Job posted successfully');
    setForm({ title: '', company: '', description: '', requirements: '', deadline: '' });
    onDone();
  };
  return <form className="form-grid" onSubmit={submit}><input value={form.title} placeholder="Job title" onChange={(e) => setForm({ ...form, title: e.target.value })} required /><input value={form.company} placeholder="Company" onChange={(e) => setForm({ ...form, company: e.target.value })} required /><textarea value={form.description} placeholder="Job description" onChange={(e) => setForm({ ...form, description: e.target.value })} required /><input value={form.requirements} placeholder="Requirements (comma separated)" onChange={(e) => setForm({ ...form, requirements: e.target.value })} /><input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /><button className="btn" type="submit">Publish Job</button></form>;
};

export default function App() {
  const { user } = useAuth();
  return <Routes><Route path="/" element={<Landing />} /><Route path="/auth" element={user ? <Navigate to="/dashboard/overview" /> : <AuthPage />} /><Route path="/dashboard" element={user ? <Navigate to="/dashboard/overview" /> : <Navigate to="/auth" />} /><Route path="/dashboard/:section" element={user ? <Dashboard /> : <Navigate to="/auth" />} /></Routes>;
}
