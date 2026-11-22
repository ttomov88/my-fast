/* ---------------- Translations: Bulgarian (default) and English ----------------
   t('key', { n: 2 }) returns the text in the current language. Entries can be functions.
   Static text in index.html is marked with data-i18n / data-i18n-ph / data-i18n-aria. */
(function () {
  const pl = (n, one, other) => (n === 1 ? one : other);

  const I18N = {
    en: {
      months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      months_short: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      weekdays_short: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      cal_weekdays: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
      h: 'h', m: 'm',

      // tabs and titles
      tab_home: 'Home', tab_history: 'History', tab_settings: 'Settings', history: 'History', settings: 'Settings',

      // home
      not_fasting: 'Not fasting', fasting: 'Fasting', goal_reached: 'Goal reached 🎉',
      tap_start: 'Tap Start Fast to begin', left: p => `${p.t} left`, over: p => `+${p.t} over`,
      goal_at: p => `Goal at ${p.time} ${p.day}`, edit_start: 'Edit start',
      goal: 'Goal', custom: 'Custom', hours: 'hours', start_fast: 'Start Fast', end_fast: 'End Fast',

      // history
      all_time: 'All time', average: 'Average', fasts: 'Fasts', longest: 'Longest',
      month_meta: p => `${p.n} ${pl(p.n, 'fast', 'fasts')} · avg ${p.avg}`, no_fasts: 'No fasts',
      chart_hint: 'Touch the chart and slide your finger to see each day', day_none: 'No fast', pct_of: p => `${p.p}% of ${p.t}`, goal_of: p => `goal ${p.t}`,
      more_fasts: p => `+${p.n} more`, legend_other: 'Other goal',
      legend_hit: 'Goal met', legend_under: 'Under goal', legend_goal: p => `Goal ${p.t}`,
      add: '+ Add', no_fasts_in: p => `No fasts in ${p.month}`, use_arrows: 'Use the arrows to see other months.',
      goal_note: p => ` · goal ${p.t}`, chart_aria: 'Hours fasted per day',
      row_aria: p => `${p.date}, ${p.t} of ${p.goal} goal${p.hit ? ', goal met' : ''}. Edit`,
      prev_month: 'Previous month', next_month: 'Next month',

      // settings
      private_note: 'Your fasts are private to you', appearance: 'Appearance', theme: 'Theme',
      theme_light: 'Light', theme_dark: 'Dark', theme_auto: 'Auto', language: 'Language',
      notifications: 'Notifications', notif_off: 'Off', notif_on: 'On · alert when you reach your goal',
      notif_unsupported: 'Not supported on this browser', notif_blocked: 'Blocked in browser settings',
      remind_start: 'Remind me to start', time: 'Time',
      remind_daily: p => `Daily at ${p.t}, if you're not fasting`, remind_need_notif: p => `Daily at ${p.t} · turn on notifications to get it`,
      data: 'Data', export: 'Export', import: 'Import', clear_all: 'Clear all data',
      backup_note: 'Your fasts are saved in your account and backed up automatically every night.',
      people: 'People', invite: 'Invite', people_note: 'Invite someone, then send them the app link and their code. Their fasts are private.',
      joined: 'Joined', invite_code_is: 'Invite code ', invited_status: 'Invited', reset_password: 'Reset password', remove: 'Remove',
      account: 'Account', change_password: 'Change password', log_out: 'Log out',

      // login
      login_sub: 'Your fasting timer. Log in to see your fasts.', email: 'Email', password: 'Password',
      invite_code: 'Invite code', log_in: 'Log in', have_invite: 'I have an invite', create_account: 'Create account',
      forgot: 'Forgot password?', enter_creds: 'Enter your email and password.',
      enter_code: 'Enter the 6-character invite code you were sent.',
      register_hint: 'Enter your email, choose a password and type your invite code.',
      creating: 'Creating your account…', logging_in: 'Logging in…', loading: 'Loading your fasts…',
      wrong_creds: 'Wrong email or password.', login_failed: "Couldn't log in. Please try again.",
      load_failed: "Couldn't load your fasts. Please try again.", load_failed_login: "Couldn't load your fasts. Please log in again.",
      unreachable: "Can't reach the server. Check your internet connection.",
      not_loaded: "The app didn't load properly. Check your connection and reopen it.",
      not_invited: "This account hasn't been invited to My Fast. Ask Toma for an invite.",
      no_access: "This account doesn't have access to My Fast. Ask Toma for an invite.",
      login_again: 'Please log in again.',
      err_invalid_email: 'Enter a valid email address.', err_weak_password: 'Choose a password with at least 8 characters.',
      err_not_allowed: "This email hasn't been invited. Ask Toma to invite you.",
      err_bad_code: "That invite code isn't right. Check it and try again.",
      err_already: 'You already have an account. Log in with your password.', err_generic: 'Something went wrong. Please try again.',
      forgot_title: 'Forgot password', forgot_text: p => `The app doesn't send emails. Ask Toma (${p.admin}) for a temporary password, then change it in Settings.`,

      // sheets and buttons
      cancel: 'Cancel', save: 'Save', ok: 'OK', delete: 'Delete', clear: 'Clear', resume: 'Resume', reset: 'Reset',
      edit_start_title: 'Edit start time', started_at: 'Started at', end_fast_title: 'End fast', finished_at: 'Finished at', end_btn: 'End Fast',
      edit_fast: 'Edit fast', add_fast: 'Add fast', start: 'Start', end: 'End', goal_hours: 'Goal (hours)', delete_fast: 'Delete this fast',
      today: 'Today', hour: 'Hour', minute: 'Minute', now: 'Now', done: 'Done',
      new_password_label: 'New password (at least 8 characters)',

      // messages
      invalid_time: 'Invalid time', enter_valid_time: 'Please enter a valid date and time.',
      finish_after_start: 'Finish time must be after the start time.', finish_future: "Finish time can't be in the future.",
      too_long: "That's more than 30 days long — double check the date.",
      start_past: 'Start time must be in the past.', start_too_old: "That's more than 30 days ago — double check the date.",
      missing_info: 'Missing info', missing_info_text: 'Please fill in start, end, and a goal greater than 0.',
      invalid_times: 'Invalid times', end_after_start: 'End time must be after start time.', end_future: "End time can't be in the future.",
      fast_too_long: 'That fast is longer than 30 days — double check the start and end dates.',
      invalid_goal: 'Invalid goal', goal_max: 'The goal must be 720 hours or less.',
      cant_save: "Couldn't save", cant_start: "Couldn't start the fast", cant_end: "Couldn't end the fast",
      cant_delete: "Couldn't delete", cant_clear: "Couldn't clear",
      e_duplicate: 'That fast is already in your history.',
      e_already_ended: 'This fast was already ended, maybe on another device. Your history has been refreshed.',
      e_not_member: "Your account doesn't have access to My Fast.",
      e_offline: "No internet connection. Try again when you're online.", e_generic: 'Something went wrong. Please try again.',
      delete_q: 'Delete this fast?', delete_text: "This removes it from your history. This can't be undone.",
      notif_blocked_title: 'Notifications blocked', notif_blocked_text: 'Notifications are blocked for this app. Allow them in your phone or browser settings first.',
      unsupported_title: 'Not supported', unsupported_text: "This browser can't receive notifications.",
      notif_failed_title: "Couldn't change notifications", check_internet: 'Check your internet connection and try again.',
      import_failed: 'Import failed', import_bad_file: "That file doesn't look like a My Fast export.",
      resume_q: 'Resume active fast?', resume_text: 'This file also has an in-progress fast. Import it as your active fast?',
      import_done: 'Import complete',
      import_done_text: p => `Imported ${p.n} ${pl(p.n, 'fast', 'fasts')}${p.resumed ? ' and resumed your active fast' : ''}.${p.skipped ? ` (${p.skipped} skipped — missing or implausible data)` : ''}`,
      moved_title: 'Your fasts are in your account',
      moved_text: p => `Moved ${p.n} ${pl(p.n, 'fast', 'fasts')}${p.cur ? ' and your active fast' : ''} from this phone into your account.`,
      clear_q: 'Clear all data?', clear_text: "This deletes all logged fasts and any active fast from your account. This can't be undone.",
      invite_title: 'Invite', invalid_email: 'Enter a valid email address.', cant_invite: "Couldn't invite",
      invited_title: 'Invited',
      invited_text: p => `Send ${p.email} this:\n\n${p.link}\nInvite code: ${p.code}\n\nThey tap "I have an invite", enter their email, choose a password and type the code. If they already use My Fleet, they just log in with that password.`,
      reset_q: 'Reset password?', reset_text: p => `Give ${p.email} a temporary password?`,
      temp_pw_title: 'Temporary password', temp_pw_text: p => `${p.pw}\n\nPass it on to ${p.email}. They can change it in Settings.`,
      no_account_title: 'No account yet', no_account_text: p => `${p.email} hasn't created an account yet.`,
      cant_reset: "Couldn't reset", remove_q: 'Remove access?', remove_text: p => `${p.email} won't be able to use My Fast any more. Their fasts are kept.`,
      cant_remove: "Couldn't remove", password_title: 'Password', password_short: 'Use at least 8 characters.',
      cant_change_pw: "Couldn't change password", pw_changed: 'Password changed', pw_changed_text: 'Use the new password next time you log in.',
      logout_q: 'Log out?', logout_text: 'Your fasts stay in your account. Notifications stop on this phone.',
    },

    bg: {
      months: ['Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'],
      months_short: ['яну', 'фев', 'мар', 'апр', 'май', 'юни', 'юли', 'авг', 'сеп', 'окт', 'ное', 'дек'],
      weekdays_short: ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'],
      cal_weekdays: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'],
      h: 'ч', m: 'м',

      tab_home: 'Начало', tab_history: 'История', tab_settings: 'Настройки', history: 'История', settings: 'Настройки',

      not_fasting: 'Без фаст', fasting: 'Фаст', goal_reached: 'Целта е постигната 🎉',
      tap_start: 'Натиснете „Започни фаст“', left: p => `остават ${p.t}`, over: p => `+${p.t} над целта`,
      goal_at: p => `Цел в ${p.time} ${p.day}`, edit_start: 'Промени началото',
      goal: 'Цел', custom: 'Друга', hours: 'часа', start_fast: 'Започни фаст', end_fast: 'Приключи фаста',

      all_time: 'Общо', average: 'Средно', fasts: 'Фастове', longest: 'Най-дълъг',
      month_meta: p => `${p.n} ${pl(p.n, 'фаст', 'фаста')} · средно ${p.avg}`, no_fasts: 'Няма фастове',
      chart_hint: 'Докоснете графиката и плъзнете пръст, за да видите всеки ден', day_none: 'Без фаст', pct_of: p => `${p.p}% от ${p.t}`, goal_of: p => `цел ${p.t}`,
      more_fasts: p => `+${p.n} още`, legend_other: 'Друга цел',
      legend_hit: 'Постигната цел', legend_under: 'Под целта', legend_goal: p => `Цел ${p.t}`,
      add: '+ Добави', no_fasts_in: p => `Няма фастове през ${p.month}`, use_arrows: 'Използвайте стрелките за другите месеци.',
      goal_note: p => ` · цел ${p.t}`, chart_aria: 'Часове фаст на ден',
      row_aria: p => `${p.date}, ${p.t} от цел ${p.goal}${p.hit ? ', целта е постигната' : ''}. Промяна`,
      prev_month: 'Предишен месец', next_month: 'Следващ месец',

      private_note: 'Фастовете ви са видими само за вас', appearance: 'Изглед', theme: 'Тема',
      theme_light: 'Светла', theme_dark: 'Тъмна', theme_auto: 'Авто', language: 'Език',
      notifications: 'Известия', notif_off: 'Изключени', notif_on: 'Включени · известие при постигната цел',
      notif_unsupported: 'Не се поддържат в този браузър', notif_blocked: 'Блокирани в настройките на браузъра',
      remind_start: 'Напомни ми да започна', time: 'Час',
      remind_daily: p => `Всеки ден в ${p.t}, ако не сте във фаст`, remind_need_notif: p => `Всеки ден в ${p.t} · включете известията, за да го получавате`,
      data: 'Данни', export: 'Експорт', import: 'Импорт', clear_all: 'Изтрий всички данни',
      backup_note: 'Фастовете ви се пазят в профила ви и се архивират автоматично всяка нощ.',
      people: 'Хора', invite: 'Покани', people_note: 'Поканете някого, после му изпратете линка към приложението и кода. Фастовете му са видими само за него.',
      joined: 'Присъедини се', invite_code_is: 'Код за покана ', invited_status: 'Поканен', reset_password: 'Нова парола', remove: 'Премахни',
      account: 'Профил', change_password: 'Смяна на паролата', log_out: 'Изход',

      login_sub: 'Вашият фаст таймер. Влезте, за да видите фастовете си.', email: 'Имейл', password: 'Парола',
      invite_code: 'Код за покана', log_in: 'Вход', have_invite: 'Имам покана', create_account: 'Създай профил',
      forgot: 'Забравена парола?', enter_creds: 'Въведете имейл и парола.',
      enter_code: 'Въведете 6-знаковия код за покана, който получихте.',
      register_hint: 'Въведете имейл, изберете парола и напишете кода за покана.',
      creating: 'Създавам профила…', logging_in: 'Влизане…', loading: 'Зареждам фастовете…',
      wrong_creds: 'Грешен имейл или парола.', login_failed: 'Не успях да вляза. Опитайте отново.',
      load_failed: 'Не успях да заредя фастовете. Опитайте отново.', load_failed_login: 'Не успях да заредя фастовете. Влезте отново.',
      unreachable: 'Няма връзка със сървъра. Проверете интернета.',
      not_loaded: 'Приложението не се зареди правилно. Проверете връзката и го отворете отново.',
      not_invited: 'Този профил не е поканен в My Fast. Помолете Тома за покана.',
      no_access: 'Този профил няма достъп до My Fast. Помолете Тома за покана.',
      login_again: 'Моля, влезте отново.',
      err_invalid_email: 'Въведете валиден имейл.', err_weak_password: 'Изберете парола с поне 8 знака.',
      err_not_allowed: 'Този имейл не е поканен. Помолете Тома за покана.',
      err_bad_code: 'Кодът за покана не е верен. Проверете го и опитайте отново.',
      err_already: 'Вече имате профил. Влезте с паролата си.', err_generic: 'Нещо се обърка. Опитайте отново.',
      forgot_title: 'Забравена парола', forgot_text: p => `Приложението не изпраща имейли. Помолете Тома (${p.admin}) за временна парола и после я сменете от Настройки.`,

      cancel: 'Отказ', save: 'Запази', ok: 'OK', delete: 'Изтрий', clear: 'Изтрий', resume: 'Продължи', reset: 'Създай',
      edit_start_title: 'Промяна на началото', started_at: 'Начало', end_fast_title: 'Край на фаста', finished_at: 'Край', end_btn: 'Приключи',
      edit_fast: 'Промяна на фаст', add_fast: 'Нов фаст', start: 'Начало', end: 'Край', goal_hours: 'Цел (часове)', delete_fast: 'Изтрий този фаст',
      today: 'Днес', hour: 'Час', minute: 'Минути', now: 'Сега', done: 'Готово',
      new_password_label: 'Нова парола (поне 8 знака)',

      invalid_time: 'Невалиден час', enter_valid_time: 'Въведете валидна дата и час.',
      finish_after_start: 'Краят трябва да е след началото.', finish_future: 'Краят не може да е в бъдещето.',
      too_long: 'Това е повече от 30 дни — проверете датата.',
      start_past: 'Началото трябва да е в миналото.', start_too_old: 'Това е преди повече от 30 дни — проверете датата.',
      missing_info: 'Липсват данни', missing_info_text: 'Попълнете начало, край и цел, по-голяма от 0.',
      invalid_times: 'Невалидни часове', end_after_start: 'Краят трябва да е след началото.', end_future: 'Краят не може да е в бъдещето.',
      fast_too_long: 'Този фаст е по-дълъг от 30 дни — проверете началото и края.',
      invalid_goal: 'Невалидна цел', goal_max: 'Целта трябва да е до 720 часа.',
      cant_save: 'Не успях да запазя', cant_start: 'Не успях да започна фаста', cant_end: 'Не успях да приключа фаста',
      cant_delete: 'Не успях да изтрия', cant_clear: 'Не успях да изтрия данните',
      e_duplicate: 'Този фаст вече е в историята ви.',
      e_already_ended: 'Този фаст вече е приключен, може би от друго устройство. Историята е обновена.',
      e_not_member: 'Профилът ви няма достъп до My Fast.',
      e_offline: 'Няма интернет. Опитайте отново, когато сте онлайн.', e_generic: 'Нещо се обърка. Опитайте отново.',
      delete_q: 'Изтриване на фаста?', delete_text: 'Фастът ще бъде премахнат от историята. Това не може да се отмени.',
      notif_blocked_title: 'Известията са блокирани', notif_blocked_text: 'Известията за приложението са блокирани. Първо ги разрешете в настройките на телефона или браузъра.',
      unsupported_title: 'Не се поддържа', unsupported_text: 'Този браузър не може да получава известия.',
      notif_failed_title: 'Не успях да променя известията', check_internet: 'Проверете интернета и опитайте отново.',
      import_failed: 'Импортът не успя', import_bad_file: 'Този файл не изглежда като експорт от My Fast.',
      resume_q: 'Продължаване на текущия фаст?', resume_text: 'Файлът съдържа и започнат фаст. Да го направя ли текущ?',
      import_done: 'Импортът е готов',
      import_done_text: p => `Импортирани ${p.n} ${pl(p.n, 'фаст', 'фаста')}${p.resumed ? ' и текущият фаст е продължен' : ''}.${p.skipped ? ` (${p.skipped} пропуснати — непълни или невъзможни данни)` : ''}`,
      moved_title: 'Фастовете ви са в профила',
      moved_text: p => `Преместени ${p.n} ${pl(p.n, 'фаст', 'фаста')}${p.cur ? ' и текущият фаст' : ''} от този телефон в профила ви.`,
      clear_q: 'Изтриване на всички данни?', clear_text: 'Всички фастове и текущият фаст ще бъдат изтрити от профила ви. Това не може да се отмени.',
      invite_title: 'Покана', invalid_email: 'Въведете валиден имейл.', cant_invite: 'Не успях да поканя',
      invited_title: 'Поканен',
      invited_text: p => `Изпратете на ${p.email} това:\n\n${p.link}\nКод за покана: ${p.code}\n\nТам натиска „Имам покана“, въвежда имейла си, избира парола и пише кода. Ако вече ползва My Fleet, просто влиза с тази парола.`,
      reset_q: 'Нова парола?', reset_text: p => `Да създам ли временна парола за ${p.email}?`,
      temp_pw_title: 'Временна парола', temp_pw_text: p => `${p.pw}\n\nИзпратете я на ${p.email}. После може да я смени от Настройки.`,
      no_account_title: 'Още няма профил', no_account_text: p => `${p.email} още не е създал профил.`,
      cant_reset: 'Не успях да създам парола', remove_q: 'Премахване на достъпа?', remove_text: p => `${p.email} вече няма да може да ползва My Fast. Фастовете му се запазват.`,
      cant_remove: 'Не успях да премахна', password_title: 'Парола', password_short: 'Използвайте поне 8 знака.',
      cant_change_pw: 'Не успях да сменя паролата', pw_changed: 'Паролата е сменена', pw_changed_text: 'Следващия път влезте с новата парола.',
      logout_q: 'Изход от профила?', logout_text: 'Фастовете остават в профила ви. Известията на този телефон спират.',
    },
  };

  const LANG_KEY = 'myfast_lang';
  let lang = 'bg';
  try { const v = localStorage.getItem(LANG_KEY); if (v === 'en' || v === 'bg') lang = v; } catch (e) {}

  window.MF_I18N = {
    get lang() { return lang; },
    set(l) {
      if (l !== 'en' && l !== 'bg') return;
      lang = l;
      try { localStorage.setItem(LANG_KEY, l); } catch (e) {}
    },
    t(key, p) {
      const v = (I18N[lang] && I18N[lang][key] !== undefined) ? I18N[lang][key] : I18N.en[key];
      if (v === undefined) return key;
      return typeof v === 'function' ? v(p || {}) : v;
    },
    keys: () => Object.keys(I18N.en),
    missing: () => Object.keys(I18N.en).filter(k => !(k in I18N.bg)).concat(Object.keys(I18N.bg).filter(k => !(k in I18N.en))),
  };
})();
