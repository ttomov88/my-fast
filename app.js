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

  const I = window.MF_I18N;
  const t = (k, p) => I.t(k, p);
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
    historyList: $('historyList'), historyEmpty: $('historyEmpty'), historyEmptyTitle: $('historyEmptyTitle'), listTitle: $('listTitle'),
    monthMeta: $('monthMeta'), chartInfo: $('chartInfo'), legendGoal: $('legendGoal'),
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
    inviteCodeField: $('inviteCodeField'), inviteCodeInput: $('inviteCodeInput'),
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
  let editingFastId = null; // null = adding a new fast; number = editing that fast

  // ---------- Sheets and the phone's back button ----------
  // While a sheet is open or you're on History/Settings, one extra history entry is kept, so the
  // back button closes the sheet / returns to Home instead of leaving the app.
  const sheetStack = [];
  let armed = false, ignoreNextPop = false;
  const atRoot = () => !sheetStack.length && el.timerView.classList.contains('active');
  function arm() {
    if (!armed) { history.pushState({ myfast: 1 }, ''); armed = true; }
  }
  function maybeDisarm() {
    setTimeout(() => {
      if (armed && atRoot()) { armed = false; ignoreNextPop = true; history.back(); }
    }, 350);
  }
  function openSheet(m) {
    m.classList.remove('hidden');
    if (!sheetStack.includes(m)) sheetStack.push(m);
    arm();
  }
  function closeSheet(m) {
    m.classList.add('hidden');
    const i = sheetStack.indexOf(m);
    if (i >= 0) sheetStack.splice(i, 1);
    maybeDisarm();
  }
  function dismissTop() {
    const top = sheetStack[sheetStack.length - 1];
    if (!top) return false;
    if (top === el.dialogModal) closeDialog(false);
    else closeSheet(top);
    return true;
  }
  window.addEventListener('popstate', () => {
    armed = false;
    if (ignoreNextPop) { ignoreNextPop = false; return; }
    if (!dismissTop() && !el.timerView.classList.contains('active')) showView('timerView');
    if (!atRoot()) arm();
  });
  // Tapping the dark area above a sheet closes it.
  document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', (e) => {
    if (e.target !== m) return;
    if (m === el.dialogModal) closeDialog(false);
    else closeSheet(m);
  }));

  // ---------- Generic styled dialog (replaces confirm()/alert()) ----------
  let dialogResolve = null;

  function showDialog({ title, message, okText = t('ok'), cancelText = t('cancel'), showCancel = true, danger = false }) {
    return new Promise((resolve) => {
      el.dialogTitle.textContent = title;
      el.dialogMessage.textContent = message;
      el.dialogOkBtn.textContent = okText;
      el.dialogCancelBtn.textContent = cancelText;
      el.dialogCancelBtn.style.display = showCancel ? '' : 'none';
      el.dialogOkBtn.classList.toggle('stop', !!danger);
      if (dialogResolve) dialogResolve(false);
      dialogResolve = resolve;
      openSheet(el.dialogModal);
    });
  }

  function closeDialog(result) {
    closeSheet(el.dialogModal);
    if (dialogResolve) {
      const r = dialogResolve;
      dialogResolve = null;
      r(result);
    }
  }

  el.dialogOkBtn.addEventListener('click', () => closeDialog(true));
  el.dialogCancelBtn.addEventListener('click', () => closeDialog(false));

  function showAlert(title, message) {
    return showDialog({ title, message, showCancel: false, okText: t('ok') });
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
  async function saveChange(fn, failTitle = t('cant_save')) {
    if (busy) return false;
    busy = true;
    try {
      await fn();
      saveCache();
      return true;
    } catch (e) {
      await showAlert(failTitle, friendlyError(e));
      return false;
    } finally {
      busy = false;
    }
  }

  function friendlyError(e) {
    const msg = String((e && (e.message || e)) || '');
    if (e && e.code === '23505') return t('e_duplicate');
    if (/no_active_fast/.test(msg)) return t('e_already_ended');
    if (/not_member/.test(msg)) return t('e_not_member');
    if (!navigator.onLine || /fetch|network/i.test(msg)) return t('e_offline');
    return t('e_generic');
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

  const PHONE_TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Sofia'; } catch (e) { return 'Europe/Sofia'; } })();

  async function fetchProfile() {
    const cols = 'current_start, current_target, last_target, start_reminder, tz, lang';
    let p = must(await sb.from('fast_profiles').select(cols).maybeSingle());
    if (!p) {
      // Created on first use. Two devices opening at once may race: then just read the winner's row.
      const ins = await sb.from('fast_profiles').insert({ user_id: state.userId, tz: PHONE_TZ, lang: I.lang }).select(cols).single();
      p = ins.error && ins.error.code === '23505' ? must(await sb.from('fast_profiles').select(cols).single()) : must(ins);
    }
    // The start reminder follows the phone's time zone.
    if (p.tz !== PHONE_TZ || p.lang !== I.lang) updateProfile({ tz: PHONE_TZ, lang: I.lang }).then(() => {}, () => {});
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
    if (id === 'timerView') maybeDisarm(); else arm();
    if (id === 'historyView') {
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
    setDT(el.endFastInput, new Date());
    openSheet(el.endFastModal);
  }

  el.endFastCancelBtn.addEventListener('click', () => {
    closeSheet(el.endFastModal);
  });

  el.endFastConfirmBtn.addEventListener('click', async () => {
    const endDate = getDT(el.endFastInput);
    if (!state.current) {
      closeSheet(el.endFastModal);
      return;
    }
    const startDate = new Date(state.current.startISO);
    if (!endDate) {
      await showAlert(t('invalid_time'), t('enter_valid_time'));
      return;
    }
    if (endDate <= startDate) {
      await showAlert(t('invalid_time'), t('finish_after_start'));
      return;
    }
    if (endDate.getTime() > Date.now()) {
      await showAlert(t('invalid_time'), t('finish_future'));
      return;
    }
    if ((endDate - startDate) / 3600000 > 720) {
      await showAlert(t('invalid_time'), t('too_long'));
      return;
    }
    closeSheet(el.endFastModal);
    endFast(endDate);
  });

  async function startFast() {
    const startISO = new Date().toISOString();
    const targetHours = selectedTargetHours;
    const ok = await saveChange(async () => {
      must(await updateProfile({ current_start: startISO, current_target: targetHours, last_target: targetHours, goal_notified_for: null }));
      state.current = { startISO, targetHours };
      state.lastTargetHours = targetHours;
    }, t('cant_start'));
    if (ok) render();
  }

  async function endFast(endDate) {
    if (!state.current) return;
    const ok = await saveChange(async () => {
      const row = must(await sb.rpc('fast_end', { p_end: endDate.toISOString() }));
      state.history.unshift(rowToEntry(row));
      sortHistory();
      state.current = null;
    }, t('cant_end'));
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
    // Server-side so the phone moves to whoever is logged in now, even if someone else used it before.
    must(await sb.rpc('fast_claim_push', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth }));
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
      el.notifStatusText.textContent = t('notif_unsupported');
    } else if (Notification.permission === 'denied') {
      el.notifStatusText.textContent = t('notif_blocked');
    } else if (pushOn) {
      el.notifStatusText.textContent = t('notif_on');
    } else {
      el.notifStatusText.textContent = t('notif_off');
    }

    const rem = state.startReminder;
    el.startReminderToggle.classList.toggle('on', !!rem);
    el.startReminderToggle.setAttribute('aria-checked', String(!!rem));
    el.startReminderTimeRow.classList.toggle('hidden', !rem);
    if (rem) {
      el.startReminderHour.value = rem.slice(0, 2);
      el.startReminderMinute.value = rem.slice(3, 5);
      el.startReminderText.textContent = pushOn
        ? t('remind_daily', { t: rem })
        : t('remind_need_notif', { t: rem });
    } else {
      el.startReminderText.textContent = t('notif_off');
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
      await showAlert(t('notif_blocked_title'), t('notif_blocked_text'));
      return;
    }
    pushBusy = true;
    try {
      if (pushOn) await unsubscribePush();
      else await subscribePush();
    } catch (e) {
      const msg = e && e.message;
      if (msg === 'unsupported') await showAlert(t('unsupported_title'), t('unsupported_text'));
      else if (msg !== 'denied') await showAlert(t('notif_failed_title'), t('check_internet'));
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
    setDT(el.editStartInput, new Date(state.current.startISO));
    openSheet(el.editModal);
  });

  el.editCancelBtn.addEventListener('click', () => {
    closeSheet(el.editModal);
  });

  el.editSaveBtn.addEventListener('click', async () => {
    const newDate = getDT(el.editStartInput);
    if (state.current) {
      const now = Date.now();
      if (!newDate || newDate.getTime() >= now) {
        closeSheet(el.editModal);
        await showAlert(t('invalid_time'), t('start_past'));
        return;
      }
      if ((now - newDate.getTime()) / 3600000 > 720) {
        closeSheet(el.editModal);
        await showAlert(t('invalid_time'), t('start_too_old'));
        return;
      }
      closeSheet(el.editModal);
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
    closeSheet(el.editModal);
  });

  // Date + time fields: dd.mm.yyyy and 24-hour, each opening a small sheet (the phone's own
  // pickers follow its language and may show US dates or AM/PM).
  const pad2 = (n) => String(n).padStart(2, '0');
  const fmtDate = (d) => `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
  const fmtTime = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  function setDT(f, d) {
    f._date = new Date(d.getTime());
    f._date.setSeconds(0, 0);
    f.querySelector('.dt-date').textContent = fmtDate(f._date);
    f.querySelector('.dt-time').textContent = fmtTime(f._date);
  }
  function getDT(f) {
    return f._date ? new Date(f._date.getTime()) : null;
  }

  const calModal = $('calendarModal'), calGrid = $('calGrid'), calTitle = $('calTitle');
  const timeModal = $('timeModal'), hourGrid = $('hourGrid'), minuteGrid = $('minuteGrid'), timeTitle = $('timeTitle');
  let pickField = null, calMonth = null, pickTime = null;

  function renderCalendar() {
    calTitle.textContent = `${t('months')[calMonth.getMonth()]} ${calMonth.getFullYear()}`;
    calGrid.innerHTML = '';
    t('cal_weekdays').forEach(w => {
      const h = document.createElement('div');
      h.className = 'cal-wd';
      h.textContent = w;
      calGrid.appendChild(h);
    });
    const first = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7;   // Monday first
    for (let i = 0; i < lead; i++) calGrid.appendChild(document.createElement('span'));
    const days = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const sel = pickField._date;
    for (let d = 1; d <= days; d++) {
      const day = new Date(calMonth.getFullYear(), calMonth.getMonth(), d);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cal-day';
      b.textContent = d;
      b.dataset.day = d;
      if (day > today) b.disabled = true;   // fasts are never in the future
      if (day.getTime() === today.getTime()) b.classList.add('today');
      if (sel && inMonth(sel, day) && sel.getDate() === d) b.classList.add('sel');
      calGrid.appendChild(b);
    }
    const nextMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1);
    $('calNext').disabled = nextMonth > today;
  }
  calGrid.addEventListener('click', (e) => {
    const b = e.target.closest('.cal-day');
    if (!b || b.disabled) return;
    const d = new Date(pickField._date.getTime());
    d.setFullYear(calMonth.getFullYear(), calMonth.getMonth(), Number(b.dataset.day));
    setDT(pickField, d);
    closeSheet(calModal);
  });
  $('calPrev').addEventListener('click', () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); renderCalendar(); });
  $('calNext').addEventListener('click', () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); renderCalendar(); });
  $('calToday').addEventListener('click', () => {
    const d = new Date(pickField._date.getTime()), t = new Date();
    d.setFullYear(t.getFullYear(), t.getMonth(), t.getDate());
    setDT(pickField, d);
    closeSheet(calModal);
  });

  (function buildTimeGrids() {
    for (let h = 0; h < 24; h++) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = pad2(h); b.dataset.h = h;
      hourGrid.appendChild(b);
    }
    for (let m = 0; m < 60; m += 5) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = pad2(m); b.dataset.m = m;
      minuteGrid.appendChild(b);
    }
  })();
  function renderTime() {
    timeTitle.textContent = fmtTime(pickTime);
    hourGrid.querySelectorAll('button').forEach(b => b.classList.toggle('sel', Number(b.dataset.h) === pickTime.getHours()));
    minuteGrid.querySelectorAll('button').forEach(b => b.classList.toggle('sel', Number(b.dataset.m) === pickTime.getMinutes()));
  }
  hourGrid.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    pickTime.setHours(Number(b.dataset.h));
    renderTime();
  });
  minuteGrid.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    pickTime.setMinutes(Number(b.dataset.m));
    setDT(pickField, pickTime);
    closeSheet(timeModal);
  });
  $('timeNow').addEventListener('click', () => {
    const n = new Date();
    pickTime.setHours(n.getHours(), n.getMinutes());
    setDT(pickField, pickTime);
    closeSheet(timeModal);
  });
  $('timeDone').addEventListener('click', () => { setDT(pickField, pickTime); closeSheet(timeModal); });

  document.querySelectorAll('.dt-field').forEach(f => {
    f.querySelector('.dt-date').addEventListener('click', () => {
      pickField = f;
      calMonth = new Date(f._date.getFullYear(), f._date.getMonth(), 1);
      renderCalendar();
      openSheet(calModal);
    });
    f.querySelector('.dt-time').addEventListener('click', () => {
      pickField = f;
      pickTime = new Date(f._date.getTime());
      renderTime();
      openSheet(timeModal);
    });
  });

  // ---------- Add / edit a past fast ----------
  function openFastEditModal(id) {
    editingFastId = id;
    let entry = id === null ? null : state.history.find(e => e.id === id);
    if (!entry) {
      editingFastId = null;
      const now = new Date();
      const defaultStart = new Date(now.getTime() - (state.lastTargetHours || 16) * 3600000);
      entry = { startISO: defaultStart.toISOString(), endISO: now.toISOString(), targetHours: state.lastTargetHours || 16 };
      el.fastEditTitle.textContent = t('add_fast');
      el.fastEditDeleteBtn.classList.add('hidden');
    } else {
      el.fastEditTitle.textContent = t('edit_fast');
      el.fastEditDeleteBtn.classList.remove('hidden');
    }
    setDT(el.fastEditStartInput, new Date(entry.startISO));
    setDT(el.fastEditEndInput, new Date(entry.endISO));
    el.fastEditTargetInput.value = entry.targetHours;
    openSheet(el.fastEditModal);
  }

  el.addFastBtn.addEventListener('click', () => openFastEditModal(null));

  el.fastEditCancelBtn.addEventListener('click', () => {
    closeSheet(el.fastEditModal);
  });

  el.fastEditSaveBtn.addEventListener('click', async () => {
    const startDate = getDT(el.fastEditStartInput);
    const endDate = getDT(el.fastEditEndInput);
    const targetVal = Number(el.fastEditTargetInput.value);

    if (!startDate || !endDate || !targetVal || targetVal <= 0) {
      await showAlert(t('missing_info'), t('missing_info_text'));
      return;
    }
    if (endDate <= startDate) {
      await showAlert(t('invalid_times'), t('end_after_start'));
      return;
    }
    if (endDate.getTime() > Date.now()) {
      await showAlert(t('invalid_times'), t('end_future'));
      return;
    }
    if ((endDate - startDate) / 3600000 > 720) {
      await showAlert(t('invalid_times'), t('fast_too_long'));
      return;
    }
    if (targetVal > 720) {
      await showAlert(t('invalid_goal'), t('goal_max'));
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
    closeSheet(el.fastEditModal);
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
      el.mainActionBtn.textContent = t('end_fast');
      el.mainActionBtn.classList.add('stop');
      el.editStartBtn.classList.remove('hidden');
      el.statusLabel.textContent = t('fasting');
      el.targetPicker.classList.add('locked');
      el.customTargetInput.disabled = true;
      setPresetUI(state.current.targetHours);

      const finishDate = new Date(new Date(state.current.startISO).getTime() + state.current.targetHours * 3600000);
      el.finishTime.textContent = t('goal_at', { time: fmtTime(finishDate), day: t('weekdays_short')[finishDate.getDay()] });
      el.finishTime.classList.remove('hidden');

      startTick();
    } else {
      el.mainActionBtn.textContent = t('start_fast');
      el.mainActionBtn.classList.remove('stop');
      el.editStartBtn.classList.add('hidden');
      el.statusLabel.textContent = t('not_fasting');
      el.subLabel.textContent = t('tap_start');
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
      el.statusLabel.textContent = t('goal_reached');
      el.subLabel.textContent = t('over', { t: formatElapsed(elapsedMs - targetMs) });
    } else {
      el.ringProgress.style.stroke = RING_COLOR;
      el.statusLabel.textContent = t('fasting');
      el.subLabel.textContent = t('left', { t: formatElapsed(targetMs - elapsedMs) });
    }
  }

  // ---------- History: one month at a time ----------
  // The ‹ › arrows move the chart and the list together. Stats at the top are all-time.
  const durH = (e) => (new Date(e.endISO) - new Date(e.startISO)) / 3600000;
  const inMonth = (d, m) => d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth();

  // The goal used most often; rows only mention their goal when it's different.
  function usualGoal() {
    const counts = new Map();
    state.history.forEach(e => counts.set(e.targetHours, (counts.get(e.targetHours) || 0) + 1));
    let best = state.lastTargetHours || 16, n = 0;
    counts.forEach((c, g) => { if (c > n) { n = c; best = g; } });
    return best;
  }

  function ringAvatar(pct) {
    if (pct >= 1) {
      return '<span class="ring-avatar done" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>';
    }
    const C = 2 * Math.PI * 17;
    const off = C * (1 - Math.max(0.02, pct));
    return `<span class="ring-avatar" aria-hidden="true"><svg viewBox="0 0 40 40"><circle class="ra-track" cx="20" cy="20" r="17"/>` +
      `<circle class="ra-fill" cx="20" cy="20" r="17" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/></svg>` +
      `<span>${Math.floor(pct * 100)}%</span></span>`;
  }

  const timeOpts = { hour: '2-digit', minute: '2-digit', hour12: false };
  function formatRowDate(d) {
    return `${t('weekdays_short')[d.getDay()]} ${d.getDate()} ${t('months_short')[d.getMonth()]}`;
  }

  function renderHistory() {
    renderStats();
    const month = currentChartMonth;
    const items = state.history.filter(e => inMonth(new Date(e.startISO), month));
    const usual = usualGoal();
    const monthName = `${t('months')[month.getMonth()]} ${month.getFullYear()}`;

    if (items.length) {
      const avg = items.reduce((t, e) => t + durH(e), 0) / items.length;
      el.monthMeta.textContent = t('month_meta', { n: items.length, avg: formatHoursShort(avg) });
    } else {
      el.monthMeta.textContent = t('no_fasts');
    }
    el.listTitle.textContent = t('months')[month.getMonth()];
    el.historyEmptyTitle.textContent = t('no_fasts_in', { month: monthName });
    el.historyEmpty.classList.toggle('hidden', items.length > 0);

    el.historyList.innerHTML = '';
    items.forEach((entry) => {
      const start = new Date(entry.startISO);
      const end = new Date(entry.endISO);
      const hours = durH(entry);
      const pct = hours / entry.targetHours;
      const hit = pct >= 1;
      const goalNote = entry.targetHours !== usual ? t('goal_note', { t: formatHoursShort(entry.targetHours) }) : '';
      const li = document.createElement('li');
      li.className = 'row row-btn';
      li.dataset.id = entry.id;
      li.tabIndex = 0;
      li.setAttribute('role', 'button');
      li.setAttribute('aria-label',
        t('row_aria', { date: formatRowDate(start), t: formatHoursShort(hours), goal: formatHoursShort(entry.targetHours), hit }));
      li.innerHTML = `
        ${ringAvatar(pct)}
        <span class="row-text">
          <span class="row-title">${formatRowDate(start)}</span>
          <span class="row-sub">${fmtTime(start)} → ${fmtTime(end)}${goalNote}</span>
        </span>
        <span class="row-right"><span class="row-value ${hit ? 'v-hit' : 'v-under'}">${formatHoursShort(hours)}</span></span>
      `;
      el.historyList.appendChild(li);
    });
  }

  el.historyList.addEventListener('click', (e) => {
    const row = e.target.closest('.row');
    if (row) openFastEditModal(Number(row.dataset.id));
  });
  el.historyList.addEventListener('keydown', (e) => {
    const row = e.target.closest('.row');
    if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openFastEditModal(Number(row.dataset.id)); }
  });

  el.fastEditDeleteBtn.addEventListener('click', async () => {
    const id = editingFastId;
    if (id === null) return;
    const ok = await showDialog({
      title: t('delete_q'),
      message: t('delete_text'),
      okText: t('delete'),
      danger: true,
    });
    if (!ok) return;
    const saved = await saveChange(async () => {
      must(await sb.from('fasts').delete().eq('id', id));
      state.history = state.history.filter(x => x.id !== id);
    }, t('cant_delete'));
    if (!saved) return;
    closeSheet(el.fastEditModal);
    renderHistory();
    renderChart();
  });

  function formatHoursShort(h) {
    let whole = Math.floor(h);
    let min = Math.round((h - whole) * 60);
    if (min === 60) { whole++; min = 0; }
    return min > 0 ? `${whole}${t('h')} ${min}${t('m')}` : `${whole}${t('h')}`;
  }

  function dateKey(d) {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  // "38h 35m" with small units, so long values stay on one line in the stat cards.
  function statHTML(h) {
    let whole = Math.floor(h), min = Math.round((h - whole) * 60);
    if (min === 60) { whole++; min = 0; }
    const u = (x) => `<small>${x}</small>`;
    return min > 0 ? `${whole}${u(t('h'))} ${min}${u(t('m'))}` : `${whole}${u(t('h'))}`;
  }

  function renderStats() {
    const items = state.history;
    el.statCount.textContent = items.length;
    if (items.length === 0) {
      el.statAvg.innerHTML = statHTML(0);
      el.statLongest.innerHTML = statHTML(0);
      return;
    }
    let totalH = 0, longestH = 0;
    items.forEach(e => {
      const h = durH(e);
      totalH += h;
      if (h > longestH) longestH = h;
    });
    el.statAvg.innerHTML = statHTML(totalH / items.length);
    el.statLongest.innerHTML = statHTML(longestH);
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

  function firstMonth() {
    let min = null;
    state.history.forEach(e => { const d = new Date(e.startISO); if (!min || d < min) min = d; });
    return min ? new Date(min.getFullYear(), min.getMonth(), 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  }

  function goToMonth(delta) {
    const next = new Date(currentChartMonth.getFullYear(), currentChartMonth.getMonth() + delta, 1);
    if (next > new Date() || next < firstMonth()) return;
    currentChartMonth = next;
    renderChart();
    renderHistory();
  }
  el.chartPrevMonthBtn.addEventListener('click', () => goToMonth(-1));
  el.chartNextMonthBtn.addEventListener('click', () => goToMonth(1));

  let chartBuckets = [];
  function showDayInfo(idx) {
    const b = chartBuckets[idx];
    el.chartBars.querySelectorAll('.chart-bar-col').forEach((c, i) => c.classList.toggle('sel', i === idx));
    if (!b) { el.chartInfo.textContent = t('tap_day'); return; }
    const day = formatRowDate(b.date);
    el.chartInfo.innerHTML = '';
    el.chartInfo.append(t('day_info', { day }));
    const strong = document.createElement('b');
    strong.textContent = b.value > 0 ? t('day_hours', { t: formatHoursShort(b.value) }) : t('day_none');
    el.chartInfo.append(strong);
  }
  el.chartBars.addEventListener('click', (e) => {
    const col = e.target.closest('.chart-bar-col');
    if (col) showDayInfo(Number(col.dataset.idx));
  });
  el.chartBars.addEventListener('keydown', (e) => {
    const col = e.target.closest('.chart-bar-col');
    if (col && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); showDayInfo(Number(col.dataset.idx)); }
  });

  function renderChart() {
    const buckets = buildMonthBuckets(currentChartMonth);
    chartBuckets = buckets;
    const goalHours = Math.min(24, state.lastTargetHours || 16);

    el.chartMonthLabel.textContent = `${t('months')[currentChartMonth.getMonth()]} ${currentChartMonth.getFullYear()}`;
    el.chartNextMonthBtn.disabled = isSameMonth(currentChartMonth, new Date());
    el.chartPrevMonthBtn.disabled = currentChartMonth <= firstMonth();
    el.legendGoal.textContent = t('legend_goal', { t: formatHoursShort(goalHours) });
    $('chartAxis').querySelectorAll('span').forEach((n, i) => { n.textContent = `${24 - i * 6}${t('h')}`; });

    el.chartBars.innerHTML = '';
    el.chartLabels.innerHTML = '';
    showDayInfo(-1);

    const goalLine = document.createElement('div');
    goalLine.className = 'chart-goal-line';
    goalLine.style.top = `${(1 - goalHours / 24) * 100}%`;
    el.chartBars.appendChild(goalLine);

    const showEvery = 5;
    buckets.forEach((b, idx) => {
      const col = document.createElement('div');
      col.className = 'chart-bar-col';
      col.dataset.idx = idx;
      col.tabIndex = 0;
      col.setAttribute('role', 'button');
      col.setAttribute('aria-label', `${formatRowDate(b.date)}: ${formatHoursShort(b.value)}`);
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
      await showAlert(t('import_failed'), t('import_bad_file'));
      return;
    }
    const { rows, skipped } = validEntries(data.history);
    const cur = !state.current ? validCurrent(data.current) : null;
    let resume = false;
    if (cur) {
      resume = await showDialog({
        title: t('resume_q'),
        message: t('resume_text'),
        okText: t('resume'),
      });
    }
    let added = 0;
    const ok = await saveChange(async () => {
      added = await uploadEntries(rows);
      if (resume) await setCurrentFrom(cur);
    }, t('import_failed'));
    if (!ok) return;
    try { await loadFromServer(); } catch (e) {}
    await showAlert(t('import_done'), t('import_done_text', { n: added, resumed: resume, skipped }));
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
        await showAlert(t('moved_title'), t('moved_text', { n: added, cur: !!cur }));
      }
    } catch (e) {
      // Not moved (e.g. no internet): the old data stays on the phone and this runs again next time.
    }
  }

  el.resetDataBtn.addEventListener('click', async () => {
    const ok = await showDialog({
      title: t('clear_q'),
      message: t('clear_text'),
      okText: t('clear'),
      danger: true,
    });
    if (!ok) return;
    const saved = await saveChange(async () => {
      must(await sb.from('fasts').delete().eq('user_id', state.userId));
      must(await updateProfile({ current_start: null, current_target: null, goal_notified_for: null }));
      state.history = [];
      state.current = null;
    }, t('cant_clear'));
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
    if (!r.people) return;
    el.inviteList.innerHTML = '';
    r.people.forEach(p => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = p.email;
      const status = document.createElement('small');
      status.className = 'inv-status';
      if (p.joined) status.textContent = t('joined');
      else if (p.code) { status.append(t('invite_code_is')); const b = document.createElement('b'); b.textContent = p.code; status.append(b); }
      else status.textContent = t('invited_status');
      name.appendChild(status);
      const actions = document.createElement('div');
      if (p.joined) {
        const reset = document.createElement('button');
        reset.className = 'text-btn accent';
        reset.textContent = t('reset_password');
        reset.dataset.reset = p.email;
        actions.append(reset);
      }
      const remove = document.createElement('button');
      remove.className = 'text-btn';
      remove.textContent = t('remove');
      remove.dataset.remove = p.email;
      actions.append(remove);
      li.append(name, actions);
      el.inviteList.appendChild(li);
    });
  }

  el.inviteBtn.addEventListener('click', async () => {
    const email = el.inviteEmailInput.value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { await showAlert(t('invite_title'), t('invalid_email')); return; }
    const r = await api('invite', { email }).catch(() => ({ error: 'offline' }));
    if (r.error) { await showAlert(t('cant_invite'), t('check_internet')); return; }
    el.inviteEmailInput.value = '';
    await loadInvites();
    await showAlert(t('invited_title'), t('invited_text', { email, link: location.origin + location.pathname, code: r.code }));
  });

  el.inviteList.addEventListener('click', async (e) => {
    const resetEmail = e.target.dataset && e.target.dataset.reset;
    const removeEmail = e.target.dataset && e.target.dataset.remove;
    if (resetEmail) {
      if (!(await showDialog({ title: t('reset_q'), message: t('reset_text', { email: resetEmail }), okText: t('reset') }))) return;
      const r = await api('adminReset', { email: resetEmail }).catch(() => ({ error: 'offline' }));
      if (r.password) await showAlert(t('temp_pw_title'), t('temp_pw_text', { pw: r.password, email: resetEmail }));
      else if (r.error === 'not_registered') await showAlert(t('no_account_title'), t('no_account_text', { email: resetEmail }));
      else await showAlert(t('cant_reset'), t('check_internet'));
    } else if (removeEmail) {
      if (!(await showDialog({ title: t('remove_q'), message: t('remove_text', { email: removeEmail }), okText: t('remove'), danger: true }))) return;
      const r = await api('uninvite', { email: removeEmail }).catch(() => ({ error: 'offline' }));
      if (r.error) await showAlert(t('cant_remove'), t('check_internet'));
      await loadInvites();
    }
  });

  // ---------- Password ----------
  el.changePasswordBtn.addEventListener('click', () => {
    el.newPasswordInput.value = '';
    openSheet(el.passwordModal);
  });
  el.passwordCancelBtn.addEventListener('click', () => closeSheet(el.passwordModal));
  el.passwordSaveBtn.addEventListener('click', async () => {
    const password = el.newPasswordInput.value;
    if (password.length < 8 || password.length > 72) { await showAlert(t('password_title'), t('password_short')); return; }
    const { error } = await sb.auth.updateUser({ password }).catch((e) => ({ error: e }));
    if (error) { await showAlert(t('cant_change_pw'), t('check_internet')); return; }
    closeSheet(el.passwordModal);
    await showAlert(t('pw_changed'), t('pw_changed_text'));
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
    invalid_email: 'err_invalid_email', weak_password: 'err_weak_password', not_allowed: 'err_not_allowed',
    bad_code: 'err_bad_code', already_registered: 'err_already',
  };

  let loginBusy = false;
  async function doLogin(register) {
    if (loginBusy) return;
    if (!sb) { sayLogin(t('not_loaded')); return; }
    const email = el.loginEmail.value.trim().toLowerCase();
    const password = el.loginPassword.value;
    if (!email || !password) { sayLogin(t('enter_creds')); return; }
    const code = el.inviteCodeInput.value.trim().toUpperCase();
    if (register && code.length !== 6) { sayLogin(t('enter_code')); el.inviteCodeInput.focus(); return; }
    loginBusy = true;
    el.loginForm.querySelectorAll('button').forEach(b => b.disabled = true);
    sayLogin(register ? t('creating') : t('logging_in'), true);
    try {
      if (register) {
        const r = await api('register', { email, password, code });
        if (r.error) { sayLogin(REGISTER_ERRORS[r.error] ? t(REGISTER_ERRORS[r.error]) : t('err_generic')); return; }
      }
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        sayLogin(error && /invalid/i.test(error.message) ? t('wrong_creds') : t('login_failed'));
        return;
      }
      if (!(await checkMember())) {
        try { await sb.auth.signOut({ scope: 'local' }); } catch (e) {}
        sayLogin(t('not_invited'));
        return;
      }
      sayLogin(t('loading'), true);
      if (!(await startSession(data.session.user))) { sayLogin(t('load_failed')); return; }
      el.inviteCodeField.classList.add('hidden');
      el.inviteCodeInput.value = '';
      el.registerBtn.textContent = t('have_invite');
      el.loginScreen.classList.add('hidden');
      el.loginPassword.value = '';
    } catch (e) {
      sayLogin(t('unreachable'));
    } finally {
      loginBusy = false;
      el.loginForm.querySelectorAll('button').forEach(b => b.disabled = false);
    }
  }

  el.loginForm.addEventListener('submit', (e) => { e.preventDefault(); doLogin(false); });
  // First tap shows the invite code field; second tap creates the account.
  el.registerBtn.addEventListener('click', () => {
    if (el.inviteCodeField.classList.contains('hidden')) {
      el.inviteCodeField.classList.remove('hidden');
      el.registerBtn.textContent = t('create_account');
      sayLogin(t('register_hint'), true);
      el.loginEmail.focus();
      return;
    }
    doLogin(true);
  });

  async function checkMember() {
    try {
      const { data, error } = await sb.rpc('is_fast_member');
      return error ? null : data === true;
    } catch (e) { return null; }   // null = couldn't check (offline): don't lock anyone out
  }
  el.forgotBtn.addEventListener('click', () =>
    showAlert(t('forgot_title'), t('forgot_text', { admin: ADMIN_EMAIL })));

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
    const ok = await showDialog({ title: t('logout_q'), message: t('logout_text'), okText: t('log_out'), danger: true });
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
    if (!sb) { if (!state.userId) showLogin(t('not_loaded')); return; }
    sb.auth.onAuthStateChange((event) => {
      setTimeout(() => {   // never call the library from inside its own callback
        if (event === 'SIGNED_OUT' && state.userId && !loggingOut) showLogin(t('login_again'));
      }, 0);
    });
    let session = null;
    try { session = (await sb.auth.getSession()).data.session; } catch (e) {}
    if (session) {
      if ((await checkMember()) === false) {
        try { await sb.auth.signOut({ scope: 'local' }); } catch (e) {}
        state = emptyState();
        saveCache();
        renderAll();
        showLogin(t('no_access'));
        return;
      }
      if (!(await startSession(session.user)) && state.userId !== session.user.id) showLogin(t('load_failed_login'));
    } else if (!state.userId) {
      showLogin();
    } else {
      showLogin(t('login_again'));
    }
  }

  // ---------- Language ----------
  function applyStaticText() {
    document.documentElement.lang = I.lang;
    document.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
    document.querySelectorAll('[data-i18n-aria]').forEach(n => n.setAttribute('aria-label', t(n.dataset.i18nAria)));
    document.querySelectorAll('#langToggle button').forEach(b => b.classList.toggle('active', b.dataset.lang === I.lang));
    $('loginLang').textContent = I.lang === 'bg' ? 'EN' : 'БГ';
    el.registerBtn.textContent = el.inviteCodeField.classList.contains('hidden') ? t('have_invite') : t('create_account');
    el.chartInfo.textContent = t('tap_day');
  }
  function setLanguage(l) {
    I.set(l);
    applyStaticText();
    renderAll();
    if (el.historyView.classList.contains('active')) { renderHistory(); renderChart(); }
    if (el.settingsView.classList.contains('active')) loadInvites();
    // The server writes notifications in this language.
    if (state.userId) updateProfile({ lang: I.lang }).then(() => {}, () => {});
  }
  document.querySelectorAll('#langToggle button').forEach(b => b.addEventListener('click', () => setLanguage(b.dataset.lang)));
  $('loginLang').addEventListener('click', () => setLanguage(I.lang === 'bg' ? 'en' : 'bg'));

  // ---------- Init ----------
  applyStaticText();
  applyTheme();
  setPresetUI(selectedTargetHours);
  render();
  startAccount();

  // ---------- Service worker ----------
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
})();
