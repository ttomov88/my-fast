(() => {
  'use strict';

  // ---------- Account ----------
  // Fasts live in your account (Supabase, shared project with My Fleet; separate tables).
  // A copy is kept on the phone so the app opens instantly and can be viewed offline.
  const SUPABASE_URL = 'https://lsyihonmzxpjnmiueqgp.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_VOsIQ53p2Lulq6-Ov4m7sg_5KywhXPr';
  const API_URL = SUPABASE_URL + '/functions/v1/fast-api';
  const ADMIN_EMAIL = 'ttomov88@gmail.com';
  const AUTH_KEY = 'myfast_auth';           // must differ from My Fleet's (same website origin)
  const CACHE_KEY = 'myfast_cache_v1';
  const THEME_KEY = 'myfast_theme';
  const OLD_KEY = 'fasttrack_state_v1';     // data from the phone-only version, moved on first login

  const RING_CIRC = 2 * Math.PI * 115; // 722.566
  const PRESET_HOURS = [16, 18, 20, 24];
  const DEFAULT_REMINDER = '20:00';
  const RING_COLOR = '#FFFFFF';        // on the teal timer card
  const RING_DONE_COLOR = '#FFD27A';   // goal reached

  const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { storageKey: AUTH_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  }) : null;

  // ---------- State ----------
  // state.current: { startISO, targetHours } | null
  // state.history: [{ id, startISO, endISO, targetHours }] newest first
  function emptyState() {
    return { userId: null, email: '', current: null, history: [], lastTargetHours: 16, startReminder: null };
  }
  let state = loadCache();
  let theme = loadTheme();

  function loadCache() {
    try {
      const v = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (v && v.userId && Array.isArray(v.history)) return Object.assign(emptyState(), v);
    } catch (e) {}
    return emptyState();
  }
  function saveCache() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function loadTheme() {
    try {
      const t = localStorage.getItem(THEME_KEY);
      if (['light', 'dark', 'system'].includes(t)) return t;
      const old = JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
      if (old && ['light', 'dark', 'system'].includes(old.theme)) return old.theme;
    } catch (e) {}
    return 'light';
  }

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const el = {
    timerView: $('timerView'), historyView: $('historyView'), settingsView: $('settingsView'),
    tabs: document.querySelectorAll('.tab'),
    ringProgress: $('ringProgress'), statusLabel: $('statusLabel'), elapsedTime: $('elapsedTime'),
    subLabel: $('subLabel'), finishTime: $('finishTime'),
    targetPicker: $('targetPicker'), customTargetWrap: $('customTargetWrap'), customTargetInput: $('customTargetInput'),
    mainActionBtn: $('mainActionBtn'), editStartBtn: $('editStartBtn'),
    editModal: $('editModal'), editStartInput: $('editStartInput'), editCancelBtn: $('editCancelBtn'), editSaveBtn: $('editSaveBtn'),
    endFastModal: $('endFastModal'), endFastInput: $('endFastInput'), endFastCancelBtn: $('endFastCancelBtn'), endFastConfirmBtn: $('endFastConfirmBtn'),
    historyList: $('historyList'), historyEmpty: $('historyEmpty'), historyLoadMoreBtn: $('historyLoadMoreBtn'),
    statAvg: $('statAvg'), statCount: $('statCount'), statLongest: $('statLongest'),
    importFile: $('importFile'),
    chartBars: $('chartBars'), chartLabels: $('chartLabels'), chartMonthLabel: $('chartMonthLabel'),
    chartPrevMonthBtn: $('chartPrevMonthBtn'), chartNextMonthBtn: $('chartNextMonthBtn'),
    addFastBtn: $('addFastBtn'),
    // settings
    themeToggle: $('themeToggle'),
    settingsNotifToggle: $('settingsNotifToggle'), notifStatusText: $('notifStatusText'),
    startReminderToggle: $('startReminderToggle'), startReminderText: $('startReminderText'),
    startReminderTimeRow: $('startReminderTimeRow'), startReminderHour: $('startReminderHour'), startReminderMinute: $('startReminderMinute'),
    settingsExportBtn: $('settingsExportBtn'), settingsImportBtn: $('settingsImportBtn'),
    resetDataBtn: $('resetDataBtn'),
    peopleSection: $('peopleSection'), inviteList: $('inviteList'), inviteEmailInput: $('inviteEmailInput'), inviteBtn: $('inviteBtn'),
    accountEmail: $('accountEmail'), profileAvatar: $('profileAvatar'), changePasswordBtn: $('changePasswordBtn'), logoutBtn: $('logoutBtn'),
    passwordModal: $('passwordModal'), newPasswordInput: $('newPasswordInput'), passwordCancelBtn: $('passwordCancelBtn'), passwordSaveBtn: $('passwordSaveBtn'),
    // login
    loginScreen: $('loginScreen'), loginForm: $('loginForm'), loginEmail: $('loginEmail'), loginPassword: $('loginPassword'),
    loginMsg: $('loginMsg'), registerBtn: $('registerBtn'), forgotBtn: $('forgotBtn'),
    // fast add/edit modal
    fastEditModal: $('fastEditModal'), fastEditTitle: $('fastEditTitle'),
    fastEditStartInput: $('fastEditStartInput'), fastEditEndInput: $('fastEditEndInput'), fastEditTargetInput: $('fastEditTargetInput'),
    fastEditCancelBtn: $('fastEditCancelBtn'), fastEditSaveBtn: $('fastEditSaveBtn'), fastEditDeleteBtn: $('fastEditDeleteBtn'),
    // generic dialog
    dialogModal: $('dialogModal'), dialogTitle: $('dialogTitle'), dialogMessage: $('dialogMessage'),
    dialogOkBtn: $('dialogOkBtn'), dialogCancelBtn: $('dialogCancelBtn'),
  };

  el.ringProgress.style.strokeDasharray = RING_CIRC;

  let tickInterval = null;
  let selectedTargetHours = state.lastTargetHours || 16;
  let currentChartMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const HISTORY_PAGE_SIZE = 30;
  let historyRenderLimit = HISTORY_PAGE_SIZE;
  let editingFastId = null; // null = adding a new fast; number = editing that fast

  // ---------- Generic styled dialog (replaces confirm()/alert()) ----------
  let dialogResolve = null;

  function showDialog({ title, message, okText = 'OK', cancelText = 'Cancel', showCancel = true, danger = false }) {
    return new Promise((resolve) => {
      el.dialogTitle.textContent = title;
      el.dialogMessage.textContent = message;
      el.dialogOkBtn.textContent = okText;
      el.dialogCancelBtn.textContent = cancelText;
      el.dialogCancelBtn.style.display = showCancel ? '' : 'none';
      el.dialogOkBtn.classList.toggle('stop', !!danger);
      dialogResolve = resolve;
      el.dialogModal.classList.remove('hidden');
    });
  }

  function closeDialog(result) {
    el.dialogModal.classList.add('hidden');
    if (dialogResolve) {
      const r = dialogResolve;
      dialogResolve = null;
      r(result);
    }
  }

  el.dialogOkBtn.addEventListener('click', () => closeDialog(true));
  el.dialogCancelBtn.addEventListener('click', () => closeDialog(false));

  function showAlert(title, message) {
    return showDialog({ title, message, showCancel: false, okText: 'OK' });
  }

  // ---------- Talking to the account ----------
  function must(res) {
    if (res && res.error) throw res.error;
    return res ? res.data : null;
  }

  async function accessToken() {
    try { const { data } = await sb.auth.getSession(); return data.session ? data.session.access_token : null; } catch (e) { return null; }
  }

  async function api(action, body) {
    const token = await accessToken();
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${token || SUPABASE_KEY}` },
      body: JSON.stringify(Object.assign({ action }, body || {})),
    });
    let out = {};
    try { out = await res.json(); } catch (e) {}
    if (!res.ok && !out.error) out.error = 'server_error';
    return out;
  }

  // Every change is saved to the account straight away. If that fails (no internet), nothing
  // changes on screen and you're told, so the phone and the account never disagree.
  let busy = false;
  async function saveChange(fn, failTitle = "Couldn't save") {
    if (busy) return false;
    busy = true;
    try {
      await fn();
      saveCache();
      return true;
    } catch (e) {
      const offline = !navigator.onLine || (e && /fetch|network/i.test(String(e.message || e)));
      const duplicate = e && e.code === '23505';
      await showAlert(failTitle, duplicate
        ? 'That fast is already in your history.'
        : offline ? "No internet connection. Try again when you're online." : 'Something went wrong. Please try again.');
      return false;
    } finally {
      busy = false;
    }
  }

  const rowToEntry = (r) => ({
    id: r.id,
    startISO: new Date(r.start_at).toISOString(),
    endISO: new Date(r.end_at).toISOString(),
    targetHours: Number(r.target_hours),
  });
  const FAST_COLS = 'id, start_at, end_at, target_hours';
  const sortHistory = () => state.history.sort((a, b) => new Date(b.startISO) - new Date(a.startISO));

  async function fetchAllFasts() {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const rows = must(await sb.from('fasts').select(FAST_COLS).order('start_at', { ascending: false }).range(from, from + 999));
      out.push(...rows);
      if (rows.length < 1000) break;
    }
    return out.map(rowToEntry);
  }

  async function fetchProfile() {
    const cols = 'current_start, current_target, last_target, start_reminder';
    let p = must(await sb.from('fast_profiles').select(cols).maybeSingle());
    if (!p) p = must(await sb.from('fast_profiles').insert({ user_id: state.userId }).select(cols).single());
    return p;
  }

  async function loadFromServer() {
    const [p, history] = await Promise.all([fetchProfile(), fetchAllFasts()]);
    state.current = p.current_start ? { startISO: new Date(p.current_start).toISOString(), targetHours: Number(p.current_target) } : null;
    state.lastTargetHours = Number(p.last_target) || 16;
    state.startReminder = p.start_reminder ? String(p.start_reminder).slice(0, 5) : null;
    state.history = history;
    if (!state.current) selectedTargetHours = state.lastTargetHours;
    saveCache();
    renderAll();
  }

  let refreshing = false;
  async function refresh() {
    if (refreshing || busy || !state.userId) return;
    refreshing = true;
    try { await loadFromServer(); } catch (e) {} finally { refreshing = false; }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });

  function updateProfile(fields) {
    return sb.from('fast_profiles').update(Object.assign({ updated_at: new Date().toISOString() }, fields)).eq('user_id', state.userId);
  }

  // ---------- Theme ----------
  function resolveTheme() {
    if (theme === 'system') {
      return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    }
    return theme;
  }

  function applyTheme() {
    const resolved = resolveTheme();
    document.documentElement.setAttribute('data-theme', resolved);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#000000' : '#F2F3F7');
    el.themeToggle.querySelectorAll('.theme-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.theme === theme);
    });
  }

  el.themeToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('.theme-btn');
    if (!btn) return;
    theme = btn.dataset.theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch (err) {}
    applyTheme();
  });

  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { if (theme === 'system') applyTheme(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  // ---------- View navigation (bottom menu) ----------
  function showView(id) {
    [el.timerView, el.historyView, el.settingsView].forEach(v => v.classList.toggle('active', v.id === id));
    el.tabs.forEach(t => {
      if (t.dataset.view === id) t.setAttribute('aria-current', 'page');
      else t.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
    if (id === 'historyView') {
      historyRenderLimit = HISTORY_PAGE_SIZE;
      renderHistory();
      renderChart();
    } else if (id === 'settingsView') {
      syncSettingsUI();
      refreshPushState();
      loadInvites();
    }
  }

  el.tabs.forEach(t => t.addEventListener('click', () => showView(t.dataset.view)));

  // ---------- Preset picker (main timer view) ----------
  function setPresetUI(hours) {
    const isCustom = !PRESET_HOURS.includes(hours);
    document.querySelectorAll('.preset').forEach(btn => {
      const val = btn.dataset.hours;
      if (val === 'custom') {
        btn.classList.toggle('active', isCustom);
      } else {
        btn.classList.toggle('active', Number(val) === hours && !isCustom);
      }
    });
    el.customTargetWrap.classList.toggle('hidden', !isCustom);
    if (isCustom) {
      el.customTargetInput.value = hours;
    }
  }

  // The chosen goal is remembered in the account (used by the "start a fast" reminder text).
  let targetSaveTimer = null;
  function chooseTarget(hours) {
    selectedTargetHours = hours;
    state.lastTargetHours = hours;
    saveCache();
    setPresetUI(hours);
    clearTimeout(targetSaveTimer);
    targetSaveTimer = setTimeout(() => {
      if (state.userId && hours <= 720) updateProfile({ last_target: hours }).then(() => {}, () => {});
    }, 800);
  }

  el.targetPicker.addEventListener('click', (e) => {
    const btn = e.target.closest('.preset');
    if (!btn || state.current) return; // locked while fasting
    if (btn.dataset.hours === 'custom') {
      chooseTarget(Number(el.customTargetInput.value) || 16);
      el.customTargetWrap.classList.remove('hidden');
    } else {
      chooseTarget(Number(btn.dataset.hours));
    }
  });

  el.customTargetInput.addEventListener('input', () => {
    const v = Number(el.customTargetInput.value);
    if (v > 0 && v <= 72) chooseTarget(v);
  });

  // ---------- Main action ----------
  el.mainActionBtn.addEventListener('click', () => {
    if (state.current) {
      openEndFastModal();
    } else {
      startFast();
    }
  });

  function openEndFastModal() {
    el.endFastInput.value = toLocalInputValue(new Date());
    el.endFastModal.classList.remove('hidden');
  }

  el.endFastCancelBtn.addEventListener('click', () => {
    el.endFastModal.classList.add('hidden');
  });

  el.endFastConfirmBtn.addEventListener('click', async () => {
    const val = el.endFastInput.value;
    if (!val || !state.current) {
      el.endFastModal.classList.add('hidden');
      return;
    }
    const endDate = new Date(val);
    const startDate = new Date(state.current.startISO);
    if (isNaN(endDate.getTime())) {
      await showAlert('Invalid time', 'Please enter a valid date and time.');
      return;
    }
    if (endDate <= startDate) {
      await showAlert('Invalid time', 'Finish time must be after the start time.');
      return;
    }
    if (endDate.getTime() > Date.now()) {
      await showAlert('Invalid time', "Finish time can't be in the future.");
      return;
    }
    if ((endDate - startDate) / 3600000 > 720) {
      await showAlert('Invalid time', "That's more than 30 days long — double check the date.");
      return;
    }
    el.endFastModal.classList.add('hidden');
    endFast(endDate);
  });

  async function startFast() {
    const startISO = new Date().toISOString();
    const targetHours = selectedTargetHours;
    const ok = await saveChange(async () => {
      must(await updateProfile({ current_start: startISO, current_target: targetHours, last_target: targetHours, goal_notified_for: null }));
      state.current = { startISO, targetHours };
      state.lastTargetHours = targetHours;
    }, "Couldn't start the fast");
    if (ok) render();
  }

  async function endFast(endDate) {
    if (!state.current) return;
    const ok = await saveChange(async () => {
      const row = must(await sb.rpc('fast_end', { p_end: endDate.toISOString() }));
      state.history.unshift(rowToEntry(row));
      sortHistory();
      state.current = null;
    }, "Couldn't end the fast");
    if (ok) renderAll();
    else refresh();
  }

  // ---------- Notifications (sent by the server, so they arrive even with the app closed) ----------
  const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  let pushOn = false;

  function b64uToBytes(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    s += '='.repeat((4 - (s.length % 4)) % 4);
    const bin = atob(s), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function bytesToB64u(b) {
    let s = '';
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
  }

  async function storeSubscription(sub) {
    const j = sub.toJSON();
    must(await sb.from('fast_push_subscriptions').upsert(
      { endpoint: j.endpoint, user_id: state.userId, p256dh: j.keys.p256dh, auth: j.keys.auth },
      { onConflict: 'endpoint' }
    ));
  }

  async function subscribePush() {
    if (!pushSupported()) throw new Error('unsupported');
    if (Notification.permission !== 'granted') {
      if (await Notification.requestPermission() !== 'granted') throw new Error('denied');
    }
    const reg = await withTimeout(navigator.serviceWorker.ready, 10000);
    const { publicKey } = await api('publicKey');
    if (!publicKey) throw new Error('server');
    let sub = await reg.pushManager.getSubscription();
    const key = sub && sub.options && sub.options.applicationServerKey;
    if (sub && key && bytesToB64u(new Uint8Array(key)) !== publicKey) { await sub.unsubscribe(); sub = null; }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(publicKey) });
    await storeSubscription(sub);
  }

  async function unsubscribePush() {
    if (!pushSupported()) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && await reg.pushManager.getSubscription();
    if (!sub) return;
    if (state.userId) await sb.from('fast_push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }

  // What the switch shows is what the phone really does. While on, the sign-up is re-sent to the
  // account now and then (push services sometimes replace it).
  let lastPushRefresh = 0;
  async function refreshPushState() {
    let on = false;
    try {
      if (pushSupported() && Notification.permission === 'granted') {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg && await reg.pushManager.getSubscription();
        on = !!sub;
        if (sub && state.userId && Date.now() - lastPushRefresh > 6 * 3600 * 1000) {
          lastPushRefresh = Date.now();
          storeSubscription(sub).catch(() => { lastPushRefresh = 0; });
        }
      }
    } catch (e) {}
    pushOn = on;
    syncSettingsUI();
  }

  function syncSettingsUI() {
    el.settingsNotifToggle.classList.toggle('on', pushOn);
    el.settingsNotifToggle.setAttribute('aria-checked', String(pushOn));
    if (!pushSupported()) {
      el.notifStatusText.textContent = 'Not supported on this browser';
    } else if (Notification.permission === 'denied') {
      el.notifStatusText.textContent = 'Blocked in browser settings';
    } else if (pushOn) {
      el.notifStatusText.textContent = 'On · alert when you reach your goal';
    } else {
      el.notifStatusText.textContent = 'Off';
    }

    const rem = state.startReminder;
    el.startReminderToggle.classList.toggle('on', !!rem);
    el.startReminderToggle.setAttribute('aria-checked', String(!!rem));
    el.startReminderTimeRow.classList.toggle('hidden', !rem);
    if (rem) {
      el.startReminderHour.value = rem.slice(0, 2);
      el.startReminderMinute.value = rem.slice(3, 5);
      el.startReminderText.textContent = pushOn
        ? `Daily at ${rem}, if you're not fasting`
        : `Daily at ${rem} · turn on notifications to get it`;
    } else {
      el.startReminderText.textContent = 'Off';
    }

    el.accountEmail.textContent = state.email || '';
    el.profileAvatar.textContent = (state.email || '?').charAt(0).toUpperCase();
    el.peopleSection.classList.toggle('hidden', state.email !== ADMIN_EMAIL);
    applyTheme();
  }

  let pushBusy = false;
  el.settingsNotifToggle.addEventListener('click', async () => {
    if (pushBusy) return;
    if (pushSupported() && Notification.permission === 'denied') {
      await showAlert('Notifications blocked', 'Notifications are blocked for this app. Allow them in your phone or browser settings first.');
      return;
    }
    pushBusy = true;
    try {
      if (pushOn) await unsubscribePush();
      else await subscribePush();
    } catch (e) {
      const msg = e && e.message;
      if (msg === 'unsupported') await showAlert('Not supported', "This browser can't receive notifications.");
      else if (msg !== 'denied') await showAlert("Couldn't change notifications", 'Check your internet connection and try again.');
    } finally {
      pushBusy = false;
      await refreshPushState();
    }
  });

  // Start-a-fast reminder: the time is kept in the account, the server sends it.
  (function fillTimeSelects() {
    const pad = (n) => String(n).padStart(2, '0');
    for (let h = 0; h < 24; h++) el.startReminderHour.add(new Option(pad(h), pad(h)));
    ['00', '15', '30', '45'].forEach(m => el.startReminderMinute.add(new Option(m, m)));
  })();

  async function setStartReminder(value) {
    const ok = await saveChange(async () => {
      must(await updateProfile({ start_reminder: value, last_start_reminder: null }));
      state.startReminder = value;
    });
    syncSettingsUI();
    return ok;
  }

  el.startReminderToggle.addEventListener('click', async () => {
    if (state.startReminder) { setStartReminder(null); return; }
    const ok = await setStartReminder(DEFAULT_REMINDER);
    if (ok && !pushOn && pushSupported() && Notification.permission !== 'denied') {
      el.settingsNotifToggle.click();   // a reminder needs notifications
    }
  });

  const onTimeChange = () => {
    if (!state.startReminder) return;
    setStartReminder(`${el.startReminderHour.value}:${el.startReminderMinute.value}`);
  };
  el.startReminderHour.addEventListener('change', onTimeChange);
  el.startReminderMinute.addEventListener('change', onTimeChange);

  // ---------- Edit start time (active fast) ----------
  el.editStartBtn.addEventListener('click', () => {
    if (!state.current) return;
    el.editStartInput.value = toLocalInputValue(new Date(state.current.startISO));
    el.editModal.classList.remove('hidden');
  });

  el.editCancelBtn.addEventListener('click', () => {
    el.editModal.classList.add('hidden');
  });

  el.editSaveBtn.addEventListener('click', async () => {
    const val = el.editStartInput.value;
    if (val && state.current) {
      const newDate = new Date(val);
      const now = Date.now();
      if (isNaN(newDate.getTime()) || newDate.getTime() >= now) {
        el.editModal.classList.add('hidden');
        await showAlert('Invalid time', 'Start time must be in the past.');
        return;
      }
      if ((now - newDate.getTime()) / 3600000 > 720) {
        el.editModal.classList.add('hidden');
        await showAlert('Invalid time', "That's more than 30 days ago — double check the date.");
        return;
      }
      el.editModal.classList.add('hidden');
      const startISO = newDate.toISOString();
      const goalPassed = newDate.getTime() + state.current.targetHours * 3600000 <= now;
      const ok = await saveChange(async () => {
        // If the new start means the goal is already behind you, no "goal reached" alert is sent.
        must(await updateProfile({ current_start: startISO, goal_notified_for: goalPassed ? startISO : null }));
        state.current.startISO = startISO;
      });
      if (ok) render();
      return;
    }
    el.editModal.classList.add('hidden');
  });

  function toLocalInputValue(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  // ---------- Add / edit a past fast ----------
  function openFastEditModal(id) {
    editingFastId = id;
    let entry = id === null ? null : state.history.find(e => e.id === id);
    if (!entry) {
      editingFastId = null;
      const now = new Date();
      const defaultStart = new Date(now.getTime() - (state.lastTargetHours || 16) * 3600000);
      entry = { startISO: defaultStart.toISOString(), endISO: now.toISOString(), targetHours: state.lastTargetHours || 16 };
      el.fastEditTitle.textContent = 'Add fast';
      el.fastEditDeleteBtn.classList.add('hidden');
    } else {
      el.fastEditTitle.textContent = 'Edit fast';
      el.fastEditDeleteBtn.classList.remove('hidden');
    }
    el.fastEditStartInput.value = toLocalInputValue(new Date(entry.startISO));
    el.fastEditEndInput.value = toLocalInputValue(new Date(entry.endISO));
    el.fastEditTargetInput.value = entry.targetHours;
    el.fastEditModal.classList.remove('hidden');
  }

  el.addFastBtn.addEventListener('click', () => openFastEditModal(null));

  el.fastEditCancelBtn.addEventListener('click', () => {
    el.fastEditModal.classList.add('hidden');
  });

  el.fastEditSaveBtn.addEventListener('click', async () => {
    const startVal = el.fastEditStartInput.value;
    const endVal = el.fastEditEndInput.value;
    const targetVal = Number(el.fastEditTargetInput.value);

    if (!startVal || !endVal || !targetVal || targetVal <= 0) {
      await showAlert('Missing info', 'Please fill in start, end, and a goal greater than 0.');
      return;
    }
    const startDate = new Date(startVal);
    const endDate = new Date(endVal);
    if (endDate <= startDate) {
      await showAlert('Invalid times', 'End time must be after start time.');
      return;
    }
    if (endDate.getTime() > Date.now()) {
      await showAlert('Invalid times', "End time can't be in the future.");
      return;
    }
    if ((endDate - startDate) / 3600000 > 720) {
      await showAlert('Invalid times', 'That fast is longer than 30 days — double check the start and end dates.');
      return;
    }
    if (targetVal > 720) {
      await showAlert('Invalid goal', 'The goal must be 720 hours or less.');
      return;
    }

    const row = { start_at: startDate.toISOString(), end_at: endDate.toISOString(), target_hours: targetVal };
    const id = editingFastId;
    const ok = await saveChange(async () => {
      if (id === null) {
        const saved = must(await sb.from('fasts').insert(Object.assign({ user_id: state.userId }, row)).select(FAST_COLS).single());
        state.history.push(rowToEntry(saved));
      } else {
        const saved = must(await sb.from('fasts').update(row).eq('id', id).select(FAST_COLS).single());
        const i = state.history.findIndex(e => e.id === id);
        if (i >= 0) state.history[i] = rowToEntry(saved);
      }
      sortHistory();
    });
    if (!ok) return;
    el.fastEditModal.classList.add('hidden');
    renderHistory();
    renderChart();
  });

  // ---------- Rendering: timer ----------
  function formatElapsed(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  function renderAll() {
    render();
    if (el.historyView.classList.contains('active')) { renderHistory(); renderChart(); }
    if (el.settingsView.classList.contains('active')) syncSettingsUI();
  }

  function render() {
    if (state.current) {
      el.mainActionBtn.textContent = 'End Fast';
      el.mainActionBtn.classList.add('stop');
      el.editStartBtn.classList.remove('hidden');
      el.statusLabel.textContent = 'Fasting';
      el.targetPicker.classList.add('locked');
      el.customTargetInput.disabled = true;
      setPresetUI(state.current.targetHours);

      const finishDate = new Date(new Date(state.current.startISO).getTime() + state.current.targetHours * 3600000);
      const finishStr = finishDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
      const finishWeekday = finishDate.toLocaleDateString(undefined, { weekday: 'short' });
      el.finishTime.textContent = `Goal at ${finishStr} ${finishWeekday}`;
      el.finishTime.classList.remove('hidden');

      startTick();
    } else {
      el.mainActionBtn.textContent = 'Start Fast';
      el.mainActionBtn.classList.remove('stop');
      el.editStartBtn.classList.add('hidden');
      el.statusLabel.textContent = 'Not fasting';
      el.subLabel.textContent = 'Tap Start Fast to begin';
      el.elapsedTime.textContent = '00:00:00';
      el.finishTime.classList.add('hidden');
      el.finishTime.textContent = '';
      el.ringProgress.style.stroke = RING_COLOR;
      el.ringProgress.style.strokeDashoffset = RING_CIRC;
      el.targetPicker.classList.remove('locked');
      el.customTargetInput.disabled = false;
      setPresetUI(selectedTargetHours);
      stopTick();
    }
  }

  function startTick() {
    stopTick();
    tick();
    tickInterval = setInterval(tick, 1000);
  }
  function stopTick() {
    if (tickInterval) clearInterval(tickInterval);
    tickInterval = null;
  }

  function tick() {
    if (!state.current) return;
    const start = new Date(state.current.startISO).getTime();
    const elapsedMs = Date.now() - start;
    const targetMs = state.current.targetHours * 3600 * 1000;
    el.elapsedTime.textContent = formatElapsed(elapsedMs);

    const frac = Math.min(1, elapsedMs / targetMs);
    el.ringProgress.style.strokeDashoffset = RING_CIRC * (1 - frac);

    if (elapsedMs >= targetMs) {
      el.ringProgress.style.stroke = RING_DONE_COLOR;
      el.statusLabel.textContent = 'Goal reached 🎉';
      el.subLabel.textContent = `+${formatElapsed(elapsedMs - targetMs)} over`;
    } else {
      el.ringProgress.style.stroke = RING_COLOR;
      el.statusLabel.textContent = 'Fasting';
      el.subLabel.textContent = `${formatElapsed(targetMs - elapsedMs)} left`;
    }
  }

  // ---------- History list ----------
  function renderHistory() {
    const items = state.history;
    el.historyList.innerHTML = '';
    el.historyEmpty.classList.toggle('hidden', items.length > 0);

    const visible = items.slice(0, historyRenderLimit);
    visible.forEach((entry) => {
      const start = new Date(entry.startISO);
      const end = new Date(entry.endISO);
      const durationH = (end - start) / 3600000;
      const hit = durationH >= entry.targetHours;

      const li = document.createElement('li');
      li.className = 'row row-btn';
      li.dataset.id = entry.id;

      const dateStr = formatShortDate(start);
      const timeOpts = { hour: '2-digit', minute: '2-digit', hour12: false };
      const timeStr = `${start.toLocaleTimeString(undefined, timeOpts)} – ${end.toLocaleTimeString(undefined, timeOpts)}`;
      const icon = hit
        ? '<path d="M5 12.5l4.5 4.5L19 7.5"/>'
        : '<path d="M7 7l10 10M17 7L7 17"/>';

      li.innerHTML = `
        <span class="avatar ${hit ? 'a-green' : 'a-red'}"><svg viewBox="0 0 24 24">${icon}</svg></span>
        <span class="row-text">
          <span class="row-title">${dateStr}</span>
          <span class="row-sub">${timeStr} · goal ${formatHoursShort(entry.targetHours)}</span>
        </span>
        <span class="row-right"><span class="row-value ${hit ? 'v-green' : 'v-red'}">${formatHoursShort(durationH)}</span></span>
      `;
      el.historyList.appendChild(li);
    });

    renderStats();

    const remaining = items.length - visible.length;
    el.historyLoadMoreBtn.classList.toggle('hidden', remaining <= 0);
    el.historyLoadMoreBtn.textContent = `Load more (${remaining} remaining)`;
  }

  el.historyList.addEventListener('click', (e) => {
    const row = e.target.closest('.row');
    if (row) openFastEditModal(Number(row.dataset.id));
  });

  el.fastEditDeleteBtn.addEventListener('click', async () => {
    const id = editingFastId;
    if (id === null) return;
    const ok = await showDialog({
      title: 'Delete this fast?',
      message: "This removes it from your history. This can't be undone.",
      okText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    const saved = await saveChange(async () => {
      must(await sb.from('fasts').delete().eq('id', id));
      state.history = state.history.filter(x => x.id !== id);
    }, "Couldn't delete");
    if (!saved) return;
    el.fastEditModal.classList.add('hidden');
    renderHistory();
    renderChart();
  });

  el.historyLoadMoreBtn.addEventListener('click', () => {
    historyRenderLimit += HISTORY_PAGE_SIZE;
    renderHistory();
  });

  // Compact, consistent day-month-year format regardless of device locale, e.g. "8 Aug 25".
  function formatShortDate(date) {
    const day = date.getDate();
    const month = date.toLocaleDateString(undefined, { month: 'short' });
    const year = String(date.getFullYear()).slice(-2);
    return `${day} ${month} ${year}`;
  }

  function formatHoursShort(h) {
    const whole = Math.floor(h);
    const min = Math.round((h - whole) * 60);
    return min > 0 ? `${whole}h ${min}m` : `${whole}h`;
  }

  function dateKey(d) {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  function renderStats() {
    const items = state.history;
    el.statCount.textContent = items.length;

    if (items.length === 0) {
      el.statAvg.textContent = '0h';
      el.statLongest.textContent = '0h';
      return;
    }

    let totalH = 0;
    let longestH = 0;
    items.forEach(e => {
      const durationH = (new Date(e.endISO) - new Date(e.startISO)) / 3600000;
      totalH += durationH;
      if (durationH > longestH) longestH = durationH;
    });

    el.statAvg.textContent = formatHoursShort(totalH / items.length);
    el.statLongest.textContent = `${Math.round(longestH)}h`;
  }

  // ---------- Chart ----------
  function isSameMonth(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  }

  function buildMonthBuckets(monthDate) {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const buckets = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      buckets.push({ key: dateKey(d), date: d, value: 0 });
    }
    const map = new Map(buckets.map(b => [b.key, b]));

    // Split each fast's hours across every calendar day it actually spans, proportional to how
    // much of it fell on each day — an overnight fast shows hours on both days.
    state.history.forEach(entry => {
      const start = new Date(entry.startISO);
      const end = new Date(entry.endISO);
      let cursor = new Date(start);
      let guard = 0;
      while (cursor < end && guard < 40) {
        const dayStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
        const dayEnd = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 1);
        const segmentEnd = end < dayEnd ? end : dayEnd;
        const key = dateKey(dayStart);
        if (map.has(key)) map.get(key).value += (segmentEnd - cursor) / 3600000;
        cursor = segmentEnd;
        guard++;
      }
    });
    return buckets;
  }

  el.chartPrevMonthBtn.addEventListener('click', () => {
    currentChartMonth = new Date(currentChartMonth.getFullYear(), currentChartMonth.getMonth() - 1, 1);
    renderChart();
  });

  el.chartNextMonthBtn.addEventListener('click', () => {
    const next = new Date(currentChartMonth.getFullYear(), currentChartMonth.getMonth() + 1, 1);
    if (next > new Date()) return; // can't navigate into the future
    currentChartMonth = next;
    renderChart();
  });

  function renderChart() {
    const buckets = buildMonthBuckets(currentChartMonth);
    const goalHours = Math.min(24, state.lastTargetHours || 16);

    el.chartMonthLabel.textContent = currentChartMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    el.chartNextMonthBtn.disabled = isSameMonth(currentChartMonth, new Date());

    el.chartBars.innerHTML = '';
    el.chartLabels.innerHTML = '';

    const goalLine = document.createElement('div');
    goalLine.className = 'chart-goal-line';
    goalLine.style.top = `${(1 - goalHours / 24) * 100}%`;
    el.chartBars.appendChild(goalLine);

    const showEvery = 5;
    buckets.forEach((b, idx) => {
      const col = document.createElement('div');
      col.className = 'chart-bar-col';
      const bar = document.createElement('div');
      const pct = Math.max(0, Math.min(100, (b.value / 24) * 100));
      bar.className = 'chart-bar' + (b.value > 0 ? (b.value >= goalHours ? ' hit-goal' : ' has-value') : '');
      bar.style.height = `${pct}%`;
      col.appendChild(bar);
      el.chartBars.appendChild(col);

      const label = document.createElement('span');
      const fromEnd = buckets.length - 1 - idx;
      label.textContent = (idx === 0 || idx === buckets.length - 1 || fromEnd % showEvery === 0) ? String(b.date.getDate()) : '';
      el.chartLabels.appendChild(label);
    });
  }

  // ---------- Import ----------
  // Adds fasts to the account; ones already there are skipped. Works with My Fast and Fast Track files.
  function validEntries(list) {
    const rows = [];
    let skipped = 0;
    (list || []).forEach((entry) => {
      if (!entry || !entry.startISO || !entry.endISO || !entry.targetHours) { skipped++; return; }
      const start = new Date(entry.startISO);
      const end = new Date(entry.endISO);
      const target = Number(entry.targetHours);
      const durH = (end - start) / 3600000;
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || !(durH > 0) || durH > 720 || !(target > 0) || target > 720) { skipped++; return; }
      rows.push({ user_id: state.userId, start_at: start.toISOString(), end_at: end.toISOString(), target_hours: Math.round(target * 10) / 10 });
    });
    return { rows, skipped };
  }

  async function uploadEntries(rows) {
    let added = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const saved = must(await sb.from('fasts')
        .upsert(rows.slice(i, i + 500), { onConflict: 'user_id,start_at,end_at', ignoreDuplicates: true })
        .select('id'));
      added += saved.length;
    }
    return added;
  }

  function validCurrent(c) {
    if (!c || !c.startISO || !c.targetHours) return null;
    const start = new Date(c.startISO);
    const target = Number(c.targetHours);
    if (isNaN(start.getTime()) || start.getTime() > Date.now() || !(target > 0) || target > 720) return null;
    return { startISO: start.toISOString(), targetHours: target };
  }

  async function setCurrentFrom(c) {
    const goalPassed = new Date(c.startISO).getTime() + c.targetHours * 3600000 <= Date.now();
    must(await updateProfile({ current_start: c.startISO, current_target: c.targetHours, goal_notified_for: goalPassed ? c.startISO : null }));
  }

  function triggerImport() {
    el.importFile.value = '';
    el.importFile.click();
  }

  el.settingsImportBtn.addEventListener('click', triggerImport);

  el.importFile.addEventListener('change', () => {
    const file = el.importFile.files && el.importFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let data = null;
      try { data = JSON.parse(reader.result); } catch (e) {}
      importData(data);
    };
    reader.readAsText(file);
  });

  async function importData(data) {
    if (!data || !Array.isArray(data.history)) {
      await showAlert('Import failed', "That file doesn't look like a My Fast export.");
      return;
    }
    const { rows, skipped } = validEntries(data.history);
    const cur = !state.current ? validCurrent(data.current) : null;
    let resume = false;
    if (cur) {
      resume = await showDialog({
        title: 'Resume active fast?',
        message: 'This file also has an in-progress fast. Import it as your active fast?',
        okText: 'Resume',
      });
    }
    let added = 0;
    const ok = await saveChange(async () => {
      added = await uploadEntries(rows);
      if (resume) await setCurrentFrom(cur);
    }, 'Import failed');
    if (!ok) return;
    try { await loadFromServer(); } catch (e) {}
    const skippedMsg = skipped > 0 ? ` (${skipped} skipped — missing or implausible data)` : '';
    await showAlert('Import complete', `Imported ${added} fast${added === 1 ? '' : 's'}${resume ? ' and resumed your active fast' : ''}.${skippedMsg}`);
  }

  // One time, after the first login on a phone that used the old phone-only version: its fasts
  // are moved into the account. The old copy is kept under another name, just in case.
  async function moveOldPhoneData() {
    let raw = null, old = null;
    try { raw = localStorage.getItem(OLD_KEY); old = raw && JSON.parse(raw); } catch (e) {}
    if (!old) return;
    const { rows } = validEntries(old.history);
    const cur = !state.current ? validCurrent(old.current) : null;
    try {
      const added = await uploadEntries(rows);
      if (cur) await setCurrentFrom(cur);
      try { localStorage.setItem(OLD_KEY + '_moved', raw); localStorage.removeItem(OLD_KEY); } catch (e) {}
      await loadFromServer();
      if (added || cur) {
        await showAlert('Your fasts are in your account', `Moved ${added} fast${added === 1 ? '' : 's'}${cur ? ' and your active fast' : ''} from this phone into your account.`);
      }
    } catch (e) {
      // Not moved (e.g. no internet): the old data stays on the phone and this runs again next time.
    }
  }

  el.resetDataBtn.addEventListener('click', async () => {
    const ok = await showDialog({
      title: 'Clear all data?',
      message: "This deletes all logged fasts and any active fast from your account. This can't be undone.",
      okText: 'Clear',
      danger: true,
    });
    if (!ok) return;
    const saved = await saveChange(async () => {
      must(await sb.from('fasts').delete().eq('user_id', state.userId));
      must(await updateProfile({ current_start: null, current_target: null, goal_notified_for: null }));
      state.history = [];
      state.current = null;
    }, "Couldn't clear");
    if (saved) renderAll();
  });

  // ---------- Export ----------
  function buildBackupFile() {
    const payload = {
      app: 'my-fast',
      version: 1,
      exportedAt: new Date().toISOString(),
      history: state.history.map(({ startISO, endISO, targetHours }) => ({ startISO, endISO, targetHours })),
      current: state.current,
    };
    const filename = `my-fast-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    return { blob, filename };
  }

  el.settingsExportBtn.addEventListener('click', () => {
    const { blob, filename } = buildBackupFile();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // ---------- People (administrator only) ----------
  const isAdmin = () => state.email === ADMIN_EMAIL;

  async function loadInvites() {
    if (!isAdmin()) return;
    const r = await api('invites').catch(() => ({}));
    if (!r.emails) return;
    el.inviteList.innerHTML = '';
    r.emails.forEach(email => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = email;
      const actions = document.createElement('div');
      const reset = document.createElement('button');
      reset.className = 'text-btn accent';
      reset.textContent = 'Reset password';
      reset.dataset.reset = email;
      const remove = document.createElement('button');
      remove.className = 'text-btn';
      remove.textContent = 'Remove';
      remove.dataset.remove = email;
      actions.append(reset, remove);
      li.append(name, actions);
      el.inviteList.appendChild(li);
    });
  }

  el.inviteBtn.addEventListener('click', async () => {
    const email = el.inviteEmailInput.value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { await showAlert('Invite', 'Enter a valid email address.'); return; }
    const r = await api('invite', { email }).catch(() => ({ error: 'offline' }));
    if (r.error) { await showAlert("Couldn't invite", 'Check your internet connection and try again.'); return; }
    el.inviteEmailInput.value = '';
    await loadInvites();
    await showAlert('Invited', `${email} can now open My Fast, tap "Create account" and choose a password.`);
  });

  el.inviteList.addEventListener('click', async (e) => {
    const resetEmail = e.target.dataset && e.target.dataset.reset;
    const removeEmail = e.target.dataset && e.target.dataset.remove;
    if (resetEmail) {
      if (!(await showDialog({ title: 'Reset password?', message: `Give ${resetEmail} a temporary password?`, okText: 'Reset' }))) return;
      const r = await api('adminReset', { email: resetEmail }).catch(() => ({ error: 'offline' }));
      if (r.password) await showAlert('Temporary password', `${r.password}\n\nPass it on to ${resetEmail}. They can change it in Settings.`);
      else if (r.error === 'not_registered') await showAlert('No account yet', `${resetEmail} hasn't created an account yet.`);
      else await showAlert("Couldn't reset", 'Check your internet connection and try again.');
    } else if (removeEmail) {
      if (!(await showDialog({ title: 'Remove invite?', message: `${removeEmail} won't be able to create an account. An existing account keeps working.`, okText: 'Remove', danger: true }))) return;
      const r = await api('uninvite', { email: removeEmail }).catch(() => ({ error: 'offline' }));
      if (r.error) await showAlert("Couldn't remove", 'Check your internet connection and try again.');
      await loadInvites();
    }
  });

  // ---------- Password ----------
  el.changePasswordBtn.addEventListener('click', () => {
    el.newPasswordInput.value = '';
    el.passwordModal.classList.remove('hidden');
  });
  el.passwordCancelBtn.addEventListener('click', () => el.passwordModal.classList.add('hidden'));
  el.passwordSaveBtn.addEventListener('click', async () => {
    const password = el.newPasswordInput.value;
    if (password.length < 8 || password.length > 72) { await showAlert('Password', 'Use at least 8 characters.'); return; }
    const { error } = await sb.auth.updateUser({ password }).catch((e) => ({ error: e }));
    if (error) { await showAlert("Couldn't change password", 'Check your internet connection and try again.'); return; }
    el.passwordModal.classList.add('hidden');
    await showAlert('Password changed', 'Use the new password next time you log in.');
  });

  // ---------- Login ----------
  function showLogin(msg) {
    el.loginScreen.classList.remove('hidden');
    sayLogin(msg || '');
  }
  function sayLogin(text, ok) {
    el.loginMsg.textContent = text;
    el.loginMsg.className = ok ? 'login-msg ok' : 'login-msg';
  }

  const REGISTER_ERRORS = {
    invalid_email: 'Enter a valid email address.',
    weak_password: 'Choose a password with at least 8 characters.',
    not_allowed: "This email hasn't been invited. Ask Toma to invite you.",
    already_registered: 'You already have an account. Log in with your password.',
  };

  let loginBusy = false;
  async function doLogin(register) {
    if (loginBusy) return;
    if (!sb) { sayLogin("The app didn't load properly. Check your connection and reopen it."); return; }
    const email = el.loginEmail.value.trim().toLowerCase();
    const password = el.loginPassword.value;
    if (!email || !password) { sayLogin('Enter your email and password.'); return; }
    loginBusy = true;
    el.loginForm.querySelectorAll('button').forEach(b => b.disabled = true);
    sayLogin(register ? 'Creating your account…' : 'Logging in…', true);
    try {
      if (register) {
        const r = await api('register', { email, password });
        if (r.error) { sayLogin(REGISTER_ERRORS[r.error] || 'Something went wrong. Please try again.'); return; }
      }
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        sayLogin(error && /invalid/i.test(error.message) ? 'Wrong email or password.' : "Couldn't log in. Please try again.");
        return;
      }
      sayLogin('Loading your fasts…', true);
      if (!(await startSession(data.session.user))) { sayLogin("Couldn't load your fasts. Please try again."); return; }
      el.loginScreen.classList.add('hidden');
      el.loginPassword.value = '';
    } catch (e) {
      sayLogin("Can't reach the server. Check your internet connection.");
    } finally {
      loginBusy = false;
      el.loginForm.querySelectorAll('button').forEach(b => b.disabled = false);
    }
  }

  el.loginForm.addEventListener('submit', (e) => { e.preventDefault(); doLogin(false); });
  el.registerBtn.addEventListener('click', () => doLogin(true));
  el.forgotBtn.addEventListener('click', () =>
    showAlert('Forgot password', `The app doesn't send emails. Ask Toma (${ADMIN_EMAIL}) for a temporary password, then change it in Settings.`));

  // Load this person's data. A different person on this phone starts from a clean slate.
  async function startSession(user) {
    if (state.userId !== user.id) {
      state = emptyState();
      selectedTargetHours = 16;
    }
    state.userId = user.id;
    state.email = (user.email || '').toLowerCase();
    try {
      await loadFromServer();
    } catch (e) {
      return false;
    }
    await moveOldPhoneData();
    refreshPushState();
    return true;
  }

  let loggingOut = false;
  el.logoutBtn.addEventListener('click', async () => {
    const ok = await showDialog({ title: 'Log out?', message: 'Your fasts stay in your account. Notifications stop on this phone.', okText: 'Log out', danger: true });
    if (!ok) return;
    loggingOut = true;
    try { await withTimeout(unsubscribePush(), 6000); } catch (e) {}
    try { await sb.auth.signOut({ scope: 'local' }); } catch (e) {}
    try { localStorage.removeItem(AUTH_KEY); localStorage.removeItem(CACHE_KEY); } catch (e) {}
    state = emptyState();
    selectedTargetHours = 16;
    pushOn = false;
    loggingOut = false;
    showView('timerView');
    renderAll();
    showLogin();
  });

  async function startAccount() {
    if (!sb) { if (!state.userId) showLogin("The app didn't load properly. Check your connection and reopen it."); return; }
    sb.auth.onAuthStateChange((event) => {
      setTimeout(() => {   // never call the library from inside its own callback
        if (event === 'SIGNED_OUT' && state.userId && !loggingOut) showLogin('Please log in again.');
      }, 0);
    });
    let session = null;
    try { session = (await sb.auth.getSession()).data.session; } catch (e) {}
    if (session) {
      if (!(await startSession(session.user)) && state.userId !== session.user.id) showLogin("Couldn't load your fasts. Please log in again.");
    } else if (!state.userId) {
      showLogin();
    } else {
      showLogin('Please log in again.');
    }
  }

  // ---------- Init ----------
  applyTheme();
  setPresetUI(selectedTargetHours);
  render();
  startAccount();

  // ---------- Service worker ----------
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
})();
