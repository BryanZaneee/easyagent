import { marked } from './vendor/marked.mjs';
import DOMPurify from './vendor/purify.mjs';
import { readEvents, applyEvent, safeUrl } from './chat.mjs';

const $ = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icon = name => `<img src="/vendor/icons/${name}.svg" alt="">`;
const colors = ['#ed571f', '#4486ed', '#28a169', '#a763db', '#cc664d', '#6b839b'];
const state = { profiles: [], profileId: null, models: [], model: null, sessions: [], activeId: null,
  details: new Map(), tools: [], view: 'chat', sidebar: 'chats', capTab: 'skills', selectedItem: null,
  channel: 'sms', filter: 'all', connected: false, loading: true, panel: false };
const profile = () => state.profiles.find(p => p.id === state.profileId);
const active = () => state.sessions.find(s => s.id === state.activeId);
const color = id => colors[Math.max(0, state.profiles.findIndex(p => p.id === id)) % colors.length];
const avatar = (p, size = '') => `<span class="avatar ${size}" style="--agent-color:${color(p?.id)}">${escape((p?.label || 'R').slice(0, 1))}</span>`;
const friendly = name => ({ list_kb: 'Browse knowledge', read_file: 'Read a document', search_kb: 'Search knowledge', semantic_search_kb: 'Search by meaning', web_search: 'Search the web', fetch_url_text: 'Read a web page', calculator: 'Calculate', read_skill: 'Read a skill', catalog_lookup: 'Look up a product', qualify_lead: 'Qualify a lead', lead_capture_preview: 'Preview lead details', checkout_link_preview: 'Preview checkout', get_resume_summary: 'Read profile summary', get_project_context: 'Read project context' })[name] || String(name).replaceAll('_', ' ');

function markdown(text) {
  const clean = DOMPurify.sanitize(marked.parse(text, { breaks: true }), {
    ALLOWED_TAGS: ['p','br','strong','em','del','a','code','pre','blockquote','ul','ol','li','h1','h2','h3','h4','hr','table','thead','tbody','tr','th','td'],
    ALLOWED_ATTR: ['href','title','start'],
  });
  const template = document.createElement('template');
  template.innerHTML = clean;
  for (const a of template.content.querySelectorAll('a')) {
    const url = safeUrl(a.getAttribute('href'));
    if (!url) a.removeAttribute('href');
    else { a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  }
  return template.innerHTML;
}

async function api(path) {
  const res = await fetch(path, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error('Could not load workspace data. Please reconnect.');
  return res.json();
}

function toast(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { $('toast').hidden = true; }, 3500);
}

function setNavigation(open) {
  $('sidebar').classList.toggle('is-open', open);
  $('sidebar-backdrop').hidden = !open;
  $('open-nav').setAttribute('aria-expanded', String(open));
  $('main').inert = open && window.innerWidth <= 700;
  if (open) $('close-nav').focus();
  else if (window.innerWidth <= 700) $('open-nav').focus();
}

function empty(iconName, title, body) {
  return `<div class="empty-state"><div class="empty-icon">${icon(iconName)}</div><h3>${escape(title)}</h3><p>${escape(body)}</p></div>`;
}

async function loadDetail(id) {
  try {
    const detail = await api(`/api/profile?profile_id=${encodeURIComponent(id)}`);
    state.details.set(id, detail);
    if (state.profileId === id) render();
  } catch (error) {
    if (state.profileId === id) toast(error.message);
  }
}

function newChat() {
  if (!profile()) return;
  let session = state.sessions.find(s => s.profileId === state.profileId && !s.turns.length && !s.draft);
  if (!session) {
    session = { id: crypto.randomUUID(), profileId: state.profileId, model: state.model, title: 'New chat',
      turns: [], draft: '', pinned: false, busy: false, failed: false, created: Date.now(), updated: Date.now() };
    state.sessions.push(session);
  }
  state.activeId = session.id;
  state.view = 'chat'; state.sidebar = 'chats';
  setNavigation(false);
  render();
  $('composer-input').focus();
}

function selectProfile(id) {
  state.profileId = id;
  state.selectedItem = null;
  const last = [...state.sessions].reverse().find(s => s.profileId === id);
  if (last) { state.activeId = last.id; state.view = 'chat'; render(); }
  else newChat();
  setNavigation(false);
  loadDetail(id);
}

function dateGroup(date) {
  const today = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1);
  return date >= today.getTime() ? 'Today' : date >= yesterday.getTime() ? 'Yesterday' : 'Earlier';
}

function relativeTime(timestamp) {
  const minutes = Math.max(0, Math.floor((Date.now()-timestamp)/60000));
  return minutes < 1 ? 'now' : minutes < 60 ? `${minutes}m` : minutes < 1440 ? `${Math.floor(minutes/60)}h` : `${Math.floor(minutes/1440)}d`;
}

function renderSidebar() {
  $('chats-tab').setAttribute('aria-pressed', String(state.sidebar === 'chats'));
  $('agents-tab').setAttribute('aria-pressed', String(state.sidebar === 'agents'));
  $('sidebar-search').placeholder = `Search ${state.sidebar}`;
  $('sidebar-search').setAttribute('aria-label', `Search ${state.sidebar}`);
  const search = $('sidebar-search').value.trim().toLowerCase();
  $('new-chat').disabled = !profile();
  for (const btn of document.querySelectorAll('[data-view]')) btn.classList.toggle('is-active', btn.dataset.view === state.view);
  if (state.sidebar === 'agents') {
    const profiles = state.profiles.filter(p => `${p.label} ${p.description}`.toLowerCase().includes(search));
    $('sidebar-list').innerHTML = `<p class="group-label">YOUR AGENTS · ${state.profiles.length}</p>` + profiles.map(p => `<button class="agent-row ${p.id === state.profileId ? 'selected' : ''}" data-profile="${escape(p.id)}" aria-pressed="${p.id === state.profileId}">${avatar(p)}<span class="session-copy"><span class="session-title">${escape(p.label)}</span><span class="session-subtitle">${escape(p.description)}</span></span></button>`).join('') + (!profiles.length ? '<p class="sidebar-empty">No agents found.</p>' : '') + '<p class="sidebar-empty">Agent creation is not available yet.</p>';
  } else {
    const sessions = state.sessions.filter(s => (s.turns.length || s.draft) && s.title.toLowerCase().includes(search)).sort((a,b) => b.updated-a.updated);
    $('sidebar-list').innerHTML = ['Pinned','Today','Yesterday','Earlier'].map(group => {
      const items = sessions.filter(s => s.pinned ? group === 'Pinned' : dateGroup(s.created) === group);
      if (!items.length) return '';
      return `<p class="group-label">${group.toUpperCase()}</p>` + items.map(s => {
        const p = state.profiles.find(p => p.id === s.profileId);
        return `<div class="session-row ${s.id === state.activeId && state.view === 'chat' ? 'selected' : ''}" style="--agent-color:${color(s.profileId)}"><button class="session-select" data-session="${s.id}" ${s.id === state.activeId ? 'aria-current="true"' : ''}><span class="session-dot"></span><span class="session-copy"><span class="session-title">${escape(s.title)}</span><span class="session-subtitle">${escape(p?.label)}</span></span><span class="session-time">${s.busy ? 'working' : relativeTime(s.updated)}</span></button><button class="pin-button" data-pin="${s.id}" aria-label="${s.pinned ? 'Unpin' : 'Pin'} ${escape(s.title)}" aria-pressed="${s.pinned}">${s.pinned ? 'Pinned' : 'Pin'}</button></div>`;
      }).join('');
    }).join('') || `<p class="sidebar-empty">${search ? 'No matching chats.' : 'A little less on your plate.<br>Start a chat to get things moving.'}</p>`;
  }
  $('agent-dock').innerHTML = state.profiles.map(p => `<button data-profile="${escape(p.id)}" title="${escape(p.label)}" aria-label="Choose ${escape(p.label)}" aria-pressed="${p.id === state.profileId}">${avatar(p)}</button>`).join('');
}

function renderHeader() {
  const p = profile(), s = active();
  const titles = { capabilities: 'Skills & Tools', channels: 'Channels', automations: 'Automations', files: 'Files & Links' };
  $('header-identity').innerHTML = state.view === 'chat'
    ? `${avatar(p)}<div class="header-copy"><h1>${escape(s?.turns.length ? s.title : 'Your workspace')}</h1><p>${escape(p?.label || (state.loading ? 'Connecting…' : 'No agent available'))} · ${!state.connected ? 'offline' : !state.model ? 'setup needed' : s?.failed ? 'needs attention' : s?.busy ? 'working' : 'ready'}</p></div>`
    : `<div class="header-copy"><h1>${titles[state.view]}</h1><p>${escape(p?.label || 'Runnrr workspace')}</p></div>`;
  const model = state.models.find(m => m.id === (s?.model || state.model));
  $('model-label').textContent = model?.label || '';
  $('files-toggle').hidden = state.view !== 'chat';
  $('files-toggle').setAttribute('aria-expanded', String(state.panel));
  $('runtime-status').classList.toggle('offline', !state.connected || !state.model);
  $('runtime-status').innerHTML = `<span class="status-dot"></span>${state.loading ? 'Connecting' : !state.connected ? 'Offline' : !state.model ? 'Setup needed' : 'Connected'}`;
}

function sourcesFor(sessions) {
  const sources = new Map();
  for (const s of sessions) for (const t of s.turns) for (const b of t.blocks) {
    for (const item of b.sources || []) sources.set(item.url || `${item.kind}:${item.label}`, item);
  }
  return [...sources.values()];
}

function sourceChip(item) {
  const label = escape(item.label || 'Source');
  const url = safeUrl(item.url);
  return url ? `<a class="source-chip" href="${escape(url)}" target="_blank" rel="noopener noreferrer">${icon('link')}${label}</a>` : `<span class="source-chip">${icon('document-text')}${label}</span>`;
}

function renderPanel() {
  $('file-panel').hidden = !state.panel;
  const sources = active() ? sourcesFor([active()]) : [];
  $('file-panel-content').innerHTML = sources.length
    ? `<div class="panel-sources"><p class="eyebrow">REFERENCED IN THIS CHAT</p>${sources.map(sourceChip).join('')}<p class="source-summary">Source labels are provided by the agent. File previews and downloads are not available yet.</p></div>`
    : empty('folder', 'Room for the results', 'Sources used in this chat will appear here. File creation and previews are not available yet.');
}

function renderChat() {
  const s = active(), p = profile();
  const pane = $('transcript');
  const atBottom = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 100;
  const oldScroll = pane.scrollTop;
  if (!s?.turns.length) {
    const detail = state.details.get(state.profileId);
    const suggestions = detail?.suggestions?.slice(0,4) || [];
    pane.innerHTML = `<div class="welcome"><div class="welcome-eyebrow">${icon('squares-2x2')} A LITTLE MORE ROOM IN YOUR DAY</div><h2>What can we take<br>off your plate?</h2><p>${escape(p?.description || 'Your agents, conversations, and tools. Together in one place, ready when you are.')}</p>${p ? `<button class="welcome-agent" data-choose-agent>${avatar(p)}${escape(p.label)}${icon('chevron-right')}</button>` : ''}<div class="suggestions">${suggestions.map(text => `<button class="suggestion" data-suggestion="${escape(text)}">${escape(text)}${icon('chevron-right')}</button>`).join('')}</div></div>`;
  } else {
    pane.innerHTML = s.turns.map((turn, index) => `<article class="turn"><div class="user-message">${escape(turn.prompt)}</div>${turn.blocks.map(b => {
      if (b.kind === 'text') return `<div class="assistant-message">${avatar(p,'small')}<div class="markdown">${markdown(b.text)}</div></div>`;
      const toolIcon = b.status === 'done' ? 'check' : b.status === 'error' ? 'exclamation-triangle' : 'puzzle-piece';
      return `<div class="tool-row ${b.status}">${icon(toolIcon)}<span>${escape(friendly(b.name))}</span><span class="tool-state">${escape(b.status === 'running' ? 'Working' : b.status === 'done' ? 'Done' : b.status === 'error' ? 'Failed' : 'Interrupted')}</span></div>${b.summary ? `<div class="source-summary">${escape(b.summary)}</div>` : ''}`;
    }).join('')}${!turn.finished ? `<div class="activity">${icon('arrow-path')}<span>${turn.thinking ? 'Working through your request…' : 'Working on it…'}</span></div>` : ''}${turn.error ? `<div class="error-card" role="alert"><p>${escape(turn.error)}</p><p>Your partial response is kept here. Start a fresh chat to try again.</p><button data-fresh-chat>Start a fresh chat</button></div>` : ''}${turn.finished ? `<div class="turn-footer"><button class="copy-button" data-copy="${index}">${icon('clipboard')}Copy response</button>${turn.tokens ? `<span>${turn.tokens.toLocaleString()}${turn.estimated ? ' estimated' : ''} tokens</span>` : ''}</div>` : ''}</article>`).join('');
  }
  if (atBottom) pane.scrollTop = pane.scrollHeight;
  else pane.scrollTop = oldScroll;
  renderComposer();
  renderPanel();
}

function renderComposer() {
  const s = active();
  const unavailable = state.loading || !state.connected || !state.model || !s || s.busy || s.failed;
  $('composer-input').disabled = Boolean(unavailable);
  $('composer-input').placeholder = s?.failed ? 'Start a fresh chat to continue' : `Tell ${profile()?.label || 'your agent'} what to do…`;
  $('send-button').disabled = Boolean(unavailable || !s?.draft.trim());
  $('turn-status').textContent = s?.busy ? 'Working…' : '';
  $('composer-context').textContent = !state.model && state.connected ? 'No model provider is configured. Ask the runtime owner to connect one.' : '';
}

const channels = [
  { id: 'sms', name: 'Text messages', description: 'Keep conversations going with customers over SMS.', icon: 'chat-bubble-left-right' },
  { id: 'email', name: 'Email', description: 'Bring incoming mail and customer replies into your workspace.', icon: 'document-text' },
  { id: 'telegram', name: 'Telegram', description: 'Talk to your agents from Telegram.', icon: 'chat-bubble-left-right' },
  { id: 'calendar', name: 'Calendar', description: 'Connect appointments and availability to your agents.', icon: 'clock' },
];
function sectionIntro(eyebrow, title, description) {
  return `<div class="section-intro"><div class="eyebrow">${eyebrow}</div><h2>${title}</h2><p>${description}</p></div>`;
}
function renderSection() {
  const p = profile(), detail = state.details.get(state.profileId);
  const root = $('workspace-view');
  if (state.view === 'capabilities') {
    const skills = detail?.skills || [];
    const tools = (p?.tools || []).map(name => ({ name, description: detail?.tool_schemas?.find(t => t.name === name)?.description || state.tools.find(t => t.name === name)?.description || '' }));
    const tabs = [['skills','Skills',skills.length],['tools','Tools',tools.length],['connections','Connections',detail?.mcp_servers?.length || 0]];
    const items = state.capTab === 'skills' ? skills : tools;
    const selected = items.find(i => (i.slug || i.name) === state.selectedItem) || items[0];
    root.innerHTML = sectionIntro('YOUR AGENT’S ABILITIES', 'A good teammate has the right tools.', `Explore what ${escape(p?.label || 'your agent')} can use. Capabilities are managed by the runtime owner.`) + `<div class="section-tabs" aria-label="Capability categories">${tabs.map(([id,label,count])=>`<button data-cap-tab="${id}" aria-pressed="${state.capTab === id}">${label}<span class="count">${count}</span></button>`).join('')}</div>`;
    if (state.capTab === 'connections') {
      root.innerHTML += empty('puzzle-piece', 'Connections are on the way', 'Custom tool connections are not active yet. Configured server names do not mean they are connected.') + (detail?.mcp_servers?.length ? `<p class="section-note">Configured: ${detail.mcp_servers.map(escape).join(', ')}</p>` : '');
    } else if (!items.length) {
      root.innerHTML += empty('squares-2x2', state.capTab === 'skills' ? 'No skills added yet' : 'No tools available', state.capTab === 'skills' ? 'Skills teach an agent how to carry out a task. This agent has no skills configured yet.' : 'This agent does not currently have any tools configured.');
    } else {
      root.innerHTML += `<div class="section-body"><div class="item-list">${items.map(i=>`<button class="item-row ${i === selected ? 'selected' : ''}" data-item="${escape(i.slug || i.name)}"><span class="item-icon">${icon(state.capTab === 'skills' ? 'document-text' : 'puzzle-piece')}</span><span><strong>${escape(state.capTab === 'skills' ? i.name : friendly(i.name))}</strong><p>${escape(i.description.slice(0,105))}${i.description.length > 105 ? '…' : ''}</p></span><span class="badge">Available</span></button>`).join('')}</div><aside class="item-detail"><span class="badge">${state.capTab === 'skills' ? 'Skill' : 'Tool'}</span><h3>${escape(state.capTab === 'skills' ? selected.name : friendly(selected.name))}</h3><p>${escape(selected.description)}</p><p>Available to this agent. Editing capabilities is not available in the workstation yet.</p></aside></div>`;
    }
  } else if (state.view === 'channels') {
    const selected = channels.find(c => c.id === state.channel);
    root.innerHTML = sectionIntro('STAY IN THE CONVERSATION','Meet customers where they are.','Connect the places your business talks. Channel integrations are coming in a later update.') + `<div class="section-body"><div class="item-list">${channels.map(c=>`<button class="item-row ${c === selected ? 'selected' : ''}" data-channel="${c.id}"><span class="item-icon">${icon(c.icon)}</span><span><strong>${c.name}</strong><p>${c.description}</p></span><span class="badge unavailable">Not available</span></button>`).join('')}</div><aside class="item-detail"><span class="badge unavailable">Coming later</span><h3>${selected.name}</h3><p>${selected.description}</p><p>No accounts are connected. Runnrr cannot send or receive messages through this channel yet.</p><button class="soft-button" disabled>Connect ${selected.name.toLowerCase()}</button></aside></div>`;
  } else if (state.view === 'automations') {
    root.innerHTML = sectionIntro('MAKE SPACE FOR WHAT MATTERS','Good routines, on autopilot.','Scheduled work will live here: daily briefings, follow-ups, and the tasks that keep your business moving.') + empty('clock','Your next routine starts here','Automations are not available yet. Your agents currently work when you send them a message.') + '<div style="text-align:center"><button class="soft-button" disabled>Create an automation</button></div>';
  } else if (state.view === 'files') {
    const sources = sourcesFor(state.sessions);
    const visible = sources.filter(s=>state.filter !== 'links' || safeUrl(s.url));
    root.innerHTML = sectionIntro('THE WORK, ALL IN ONE PLACE','Keep the useful things close.','Sources referenced in this temporary workspace. Generated files and downloadable artifacts are coming later.') + `<div class="section-tabs" aria-label="Source filters">${['all','links'].map(f=>`<button data-filter="${f}" aria-pressed="${state.filter === f}">${f === 'all' ? 'All sources' : 'Links'}<span class="count">${f === 'all' ? sources.length : sources.filter(s=>safeUrl(s.url)).length}</span></button>`).join('')}</div>` + (visible.length ? `<div class="section-body"><div class="item-list">${visible.map(s=>`<div class="item-row"><span class="item-icon">${icon(safeUrl(s.url) ? 'link' : 'document-text')}</span>${sourceChip(s)}</div>`).join('')}</div></div>` : empty('folder','Nothing here just yet','Sources will appear as your agents use tools. Start a chat and put them to work.'));
  }
}

function render() {
  renderSidebar(); renderHeader();
  $('chat-view').hidden = state.view !== 'chat';
  $('workspace-view').hidden = state.view === 'chat';
  if (state.view === 'chat') {
    $('composer-input').value = active()?.draft || '';
    renderChat();
  } else renderSection();
}

let renderPending = false;
function streamRender() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => { renderPending = false; renderHeader(); if (state.view === 'chat') renderChat(); });
}

async function sendMessage() {
  const session = active();
  if (!session || session.busy || session.failed || !state.connected || !state.model) return;
  const prompt = session.draft.trim();
  if (!prompt || prompt.length > 4000) return;
  if (!session.turns.length) { session.title = prompt.slice(0,60); session.model = state.model; }
  const turn = { prompt, blocks: [], tokens: 0, finished: false, thinking: false, error: null };
  session.turns.push(turn); session.draft = ''; session.busy = true; session.updated = Date.now();
  $('composer-input').value = ''; $('composer-input').style.height = 'auto';
  render(); $('transcript').scrollTop = $('transcript').scrollHeight;
  try {
    const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session.id, message: prompt, model: session.model, profile: session.profileId }) });
    if (!res.ok || !res.body) {
      const messages = { 400: 'The model or agent is unavailable. Check the runtime configuration.', 429: 'A chat or rate limit was reached. Wait a moment before starting a fresh chat.', 503: 'The runtime is at capacity or its daily budget is exhausted.' };
      throw new Error(messages[res.status] || 'The agent could not start this request. Please try a fresh chat.');
    }
    await readEvents(res.body, (event, data) => {
      applyEvent(turn, event, data);
      if (session.id === state.activeId) streamRender();
    });
    if (!turn.finished) throw new Error('The connection ended before the agent finished.');
  } catch (error) {
    applyEvent(turn, 'error', { message: error instanceof TypeError ? 'The connection to the runtime was lost.' : error.message });
  } finally {
    session.busy = false; session.failed = Boolean(turn.error);
    renderSidebar(); renderHeader();
    if (session.id === state.activeId && state.view === 'chat') { renderChat(); if (!session.failed) $('composer-input').focus(); }
  }
}

async function connect() {
  if (connect.pending) return;
  connect.pending = true; state.loading = true;
  renderHeader(); renderComposer();
  $('reconnect').disabled = true;
  try {
    const [health, profiles, models, tools] = await Promise.all([api('/api/health'), api('/api/profiles'), api('/api/models'), api('/api/tools')]);
    state.connected = health.status === 'ok'; state.profiles = profiles.profiles;
    state.models = models.models; state.model = models.default; state.tools = tools.tools;
    if (!state.profiles.some(p => p.id === state.profileId)) state.profileId = state.profiles.find(p=>p.id === profiles.default)?.id || state.profiles[0]?.id || null;
    $('connection-banner').hidden = Boolean(state.model && state.profiles.length);
    $('connection-message').textContent = !state.profiles.length ? 'No agents are configured in this runtime.' : 'No model provider is configured. Contact the runtime owner to get started.';
    if (!active() && profile()) newChat();
    if (state.profileId) await loadDetail(state.profileId);
  } catch {
    state.connected = false;
    $('connection-banner').hidden = false;
    $('connection-message').textContent = 'Cannot reach your runtime. Your open chats are still here.';
  } finally {
    state.loading = false; connect.pending = false; $('reconnect').disabled = false; render();
  }
}

$('chats-tab').onclick = () => { state.sidebar = 'chats'; $('sidebar-search').value = ''; renderSidebar(); };
$('agents-tab').onclick = () => { state.sidebar = 'agents'; $('sidebar-search').value = ''; renderSidebar(); };
$('new-chat').onclick = newChat;
$('sidebar-search').oninput = renderSidebar;
$('open-nav').onclick = () => setNavigation(true);
$('close-nav').onclick = $('sidebar-backdrop').onclick = () => setNavigation(false);
$('reconnect').onclick = connect;
$('files-toggle').onclick = () => { state.panel = !state.panel; renderHeader(); renderPanel(); if (state.panel) $('close-files').focus(); };
$('close-files').onclick = () => { state.panel = false; renderHeader(); renderPanel(); $('files-toggle').focus(); };
$('session-info').onclick = () => $('info-dialog').showModal();
$('composer-form').onsubmit = event => { event.preventDefault(); sendMessage(); };
$('composer-input').oninput = event => {
  if (active()) active().draft = event.target.value;
  event.target.style.height = 'auto'; event.target.style.height = `${Math.min(event.target.scrollHeight,150)}px`;
  renderComposer();
};
$('composer-input').onkeydown = event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.isComposing) { event.preventDefault(); sendMessage(); }
};
$('transcript').onscroll = () => { const p = $('transcript'); $('scroll-bottom').hidden = p.scrollHeight-p.scrollTop-p.clientHeight < 150; };
$('scroll-bottom').onclick = () => { $('transcript').scrollTop = $('transcript').scrollHeight; };
window.addEventListener('resize', () => { if (window.innerWidth > 700) setNavigation(false); });
document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); if (window.innerWidth <= 700) setNavigation(true); $('sidebar-search').focus(); }
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); newChat(); }
  if (event.key === 'Escape' && !$('info-dialog').open) { state.panel = false; renderPanel(); renderHeader(); setNavigation(false); }
  if (event.key === 'Tab' && $('sidebar').classList.contains('is-open') && window.innerWidth <= 700) {
    const controls = [...$('sidebar').querySelectorAll('a,button,input')].filter(el=>!el.disabled && el.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
document.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  const d = button.dataset;
  if (d.profile) selectProfile(d.profile);
  if (d.session) {
    const s = state.sessions.find(s=>s.id === d.session);
    state.activeId = s.id; state.profileId = s.profileId; state.view = 'chat';
    setNavigation(false); render(); loadDetail(s.profileId);
  }
  if (d.pin) { const s = state.sessions.find(s=>s.id === d.pin); s.pinned = !s.pinned; renderSidebar(); }
  if (d.view) { state.view = d.view; state.selectedItem = null; setNavigation(false); render(); }
  if ('chooseAgent' in d) { state.sidebar = 'agents'; $('sidebar-search').value = ''; renderSidebar(); if (window.innerWidth <= 700) setNavigation(true); }
  if (d.suggestion && active() && !active().busy && !active().failed) { active().draft = d.suggestion; $('composer-input').value = d.suggestion; renderComposer(); $('composer-input').focus(); }
  if ('freshChat' in d) newChat();
  if (d.capTab) { state.capTab = d.capTab; state.selectedItem = null; renderSection(); }
  if (d.item) { state.selectedItem = d.item; renderSection(); }
  if (d.channel) { state.channel = d.channel; renderSection(); }
  if (d.filter) { state.filter = d.filter; renderSection(); }
  if ('copy' in d) {
    const turn = active()?.turns[Number(d.copy)];
    const text = turn?.blocks.filter(b=>b.kind === 'text').map(b=>b.text).join('\n\n');
    if (!text) { toast('No response text to copy yet.'); return; }
    try { await navigator.clipboard.writeText(text); toast('Response copied'); }
    catch { toast('Could not copy. Select the response text and copy it manually.'); }
  }
});
connect();
