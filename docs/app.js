/* 정보보안기사 실기 학습 사이트 — 프레임워크 없는 해시 라우팅 SPA */
'use strict';

const DATA = window.EXAM_DATA;
const QUESTIONS = DATA.rounds.flatMap((r) => r.questions);
const BY_QID = new Map(QUESTIONS.map((q) => [q.qid, q]));
const NOTE_BY_SLUG = new Map(DATA.notes.map((n) => [n.slug, n]));
const TYPES = ['단답형', '서술형', '실무형'];

/* 예상문제 (기사 모의고사용) — 기출과 분리, 통계·진도에는 미포함 */
const PREDICTED = (DATA.predicted || []).map((q) => ({ ...q, predicted: true, notes: q.notes || [] }));
const PQ_BY_ID = new Map(PREDICTED.map((q) => [q.qid, q]));
const anyQ = (id) => BY_QID.get(id) || PQ_BY_ID.get(id);
// 예상문제 → 노트 역인덱스 (빌드가 note.predicted 를 채우지만 안전하게 재구성)
DATA.notes.forEach((n) => { if (!Array.isArray(n.predicted)) n.predicted = []; });
PREDICTED.forEach((q) => q.notes.forEach((slug) => {
  const n = NOTE_BY_SLUG.get(slug);
  if (n && !n.predicted.includes(q.qid)) n.predicted.push(q.qid);
}));
const MOCK = { total: 18, quota: { 단답형: 12, 서술형: 4, 실무형: 2 }, durationMin: 180, passScore: 60,
  domW: { 정보보안관리및법규: 29, 네트워크보안: 26, 애플리케이션보안: 23, 시스템보안: 18, 정보보안일반: 6 } };

/* 두음 (두문자 암기) — 참고자료. 채점·진도 개념 없음 */
const MNEMONICS = DATA.mnemonics || [];
const GRADE_LABEL = { o: '맞음', m: '애매함', x: '틀림' };
const GRADE_ICON = { o: '⭕', m: '🔺', x: '❌' };

/* ============ 저장소 ============ */
const LS_KEY = 'infosec_v1';
const DEFAULT_STATE = () => ({
  v: 1,
  results: {},        // qid -> { attempts: [{t, g}], memo: '' }
  favorites: [],       // [qid]
  sessions: [],        // [{ id, startedAt, endedAt, scopeLabel, graded: {o,m,x} }]
  session: null,       // 진행 중 세션 { qids, label, idx, startedAt }
  lastSummary: null,   // 마지막 제출 결과 { label, qids, startedAt, graded:{o,m,x} }
  settings: { alwaysShowAnswer: false, theme: 'auto', track: 'sil', examDate: '', cppgExamDate: '' },
  // CPPG(개인정보관리사) 트랙 — 학습기록 완전 분리
  cppg: { results: {}, favorites: [], sessions: [], session: null, lastSummary: null },
});

const store = {
  state: DEFAULT_STATE(),
  load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.state = Object.assign(DEFAULT_STATE(), parsed);
        this.state.settings = Object.assign(DEFAULT_STATE().settings, parsed.settings || {});
        this.state.cppg = Object.assign(DEFAULT_STATE().cppg, parsed.cppg || {});
      }
    } catch (e) { console.warn('상태 불러오기 실패', e); }
  },
  save(opts) {
    if (!opts || !opts.fromSync) this.state._mtime = Date.now();
    try { localStorage.setItem(LS_KEY, JSON.stringify(this.state)); }
    catch (e) { console.warn('상태 저장 실패', e); }
    if (SYNC && SYNC.on && (!opts || !opts.fromSync)) SYNC.schedulePush();
  },
  result(qid) {
    return this.state.results[qid] || (this.state.results[qid] = { attempts: [], memo: '' });
  },
  grade(qid, g) {
    this.result(qid).attempts.push({ t: Date.now(), g });
    this.save();
  },
  // 이번 풀이(since 이후) 채점: 같은 풀이에서 다시 누르면 마지막 기록을 교체
  gradeSince(qid, g, since) {
    const a = this.result(qid).attempts;
    if (a.length && a[a.length - 1].t >= since) a[a.length - 1] = { t: Date.now(), g };
    else a.push({ t: Date.now(), g });
    this.save();
  },
  // since(타임스탬프) 이후에 매긴 마지막 채점 (없으면 null)
  lastGradeSince(qid, since) {
    const a = this.state.results[qid] && this.state.results[qid].attempts;
    if (!a) return null;
    for (let i = a.length - 1; i >= 0; i--) {
      if (a[i].t >= since) return a[i].g;
    }
    return null;
  },
  setMemo(qid, memo) { this.result(qid).memo = memo; this.save(); },
  setAns(qid, ans) { this.result(qid).ans = ans; this.save(); },
  isFav(qid) { return this.state.favorites.includes(qid); },
  toggleFav(qid) {
    const i = this.state.favorites.indexOf(qid);
    if (i >= 0) this.state.favorites.splice(i, 1);
    else this.state.favorites.unshift(qid);
    this.save();
  },
  lastGrade(qid) {
    const a = this.state.results[qid] && this.state.results[qid].attempts;
    return a && a.length ? a[a.length - 1].g : null;
  },
  wrongCount(qid) {
    const r = this.state.results[qid];
    return r ? r.attempts.filter((x) => x.g === 'x').length : 0;
  },
  maybeCount(qid) {
    const r = this.state.results[qid];
    return r ? r.attempts.filter((x) => x.g === 'm').length : 0;
  },
  attemptCount(qid) {
    const r = this.state.results[qid];
    return r ? r.attempts.length : 0;
  },
  addSession(s) { this.state.sessions.unshift(s); this.save(); },
  reset() { this.state = DEFAULT_STATE(); this.save(); },
};

/* ============ 서버 동기화 (선택) ============
   로그인하지 않으면 SYNC.on === false → 앱은 localStorage 로만 동작(기존과 동일).
   로그인 시: 부팅에 서버 상태를 pull 해 병합, 이후 store.save() 마다 debounce push. */
const SYNC_LS = 'infosec_sync';
const SYNC = {
  cfg: { url: '', token: '' },
  rev: 0,
  status: 'off',       // off | idle | syncing | error | offline
  lastAt: 0,
  _timer: null,
  _pushed: '',
  get on() { return !!(this.cfg.url && this.cfg.token); },
  load() {
    try { const c = JSON.parse(localStorage.getItem(SYNC_LS) || '{}'); this.cfg = { url: c.url || '', token: c.token || '' }; this.rev = +c.rev || 0; } catch (e) { /* noop */ }
    if (this.on) this.status = 'idle';
  },
  _persist() { try { localStorage.setItem(SYNC_LS, JSON.stringify({ url: this.cfg.url, token: this.cfg.token, rev: this.rev })); } catch (e) { /* noop */ } },
  async login(url, passphrase) {
    url = String(url || '').trim().replace(/\/+$/, '');
    if (!/^https?:\/\//.test(url)) throw new Error('서버 주소는 https:// 로 시작해야 합니다');
    const r = await fetch(url + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passphrase }) });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error === 'invalid_passphrase' ? '암호가 올바르지 않습니다'
        : e.error === 'too_many_attempts' ? '로그인 시도가 너무 많습니다. 1분 후 다시 시도하세요'
        : e.error === 'server_not_configured' ? '서버에 PASSPHRASE/TOKEN_SECRET 설정이 필요합니다'
        : '로그인 실패 (HTTP ' + r.status + ')');
    }
    const { token } = await r.json();
    this.cfg = { url, token }; this.rev = 0; this._pushed = ''; this._persist();
    await this.pull();
  },
  logout() {
    this.cfg = { url: '', token: '' }; this.rev = 0; this.status = 'off'; this._pushed = '';
    try { localStorage.removeItem(SYNC_LS); } catch (e) { /* noop */ }
    updateSyncUI();
  },
  async _req(path, opts, _retried) {
    const r = await fetch(this.cfg.url + path, Object.assign({}, opts, { headers: Object.assign({}, opts && opts.headers, { Authorization: 'Bearer ' + this.cfg.token }) }));
    if (r.status === 401) {
      // 시크릿(TOKEN_SECRET) 전파 지연일 수 있음 → 한 번 재시도 후 포기 (401 은 서버에서 쓰기 전에 거부하므로 재시도 안전)
      if (!_retried) { await new Promise((s) => setTimeout(s, 2500)); return this._req(path, opts, true); }
      this.logout();
      toast('서버 인증이 거부되었습니다. 잠시 후 다시 로그인하거나, 서버의 암호·TOKEN_SECRET 설정을 확인하세요');
      throw new Error('unauthorized');
    }
    return r;
  },
  async pull() {
    if (!this.on) return;
    this.status = 'syncing'; updateSyncUI();
    try {
      const data = await (await this._req('/state')).json();
      if (data && data.state) {
        store.state = mergeState(store.state, data.state);
        store.state.settings = Object.assign(DEFAULT_STATE().settings, store.state.settings || {});
        store.state.cppg = Object.assign(DEFAULT_STATE().cppg, store.state.cppg || {});
        store.save({ fromSync: true });
        rebindSessions();
      }
      this.rev = (data && data.rev) || 0; this._persist();
      await this._push(true);            // 병합 결과를 서버에 반영
      this.status = 'idle'; this.lastAt = Date.now();
      if (typeof render === 'function') render();
    } catch (e) {
      if (e && e.message === 'unauthorized') return;
      this.status = navigator.onLine ? 'error' : 'offline';
      console.warn('sync pull 실패', e);
    }
    updateSyncUI();
  },
  schedulePush() {
    if (!this.on) return;
    this.status = 'syncing'; updateSyncUI();
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this._push(), 4000);
  },
  async pushNow() { clearTimeout(this._timer); await this._push(true); },
  async _push(force) {
    if (!this.on) return;
    const body = JSON.stringify(store.state);
    if (!force && body === this._pushed) { this.status = 'idle'; updateSyncUI(); return; }
    this.status = 'syncing'; updateSyncUI();
    try {
      let r = await this._req('/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: store.state, baseRev: this.rev }) });
      if (r.status === 409) {
        const cur = await r.json();
        store.state = mergeState(store.state, cur.state);
        store.state.settings = Object.assign(DEFAULT_STATE().settings, store.state.settings || {});
        store.state.cppg = Object.assign(DEFAULT_STATE().cppg, store.state.cppg || {});
        store.save({ fromSync: true });
        rebindSessions();
        this.rev = cur.rev;
        r = await this._req('/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: store.state, baseRev: this.rev, force: true }) });
      }
      const out = await r.json();
      if (!r.ok) throw new Error(out.error || ('HTTP ' + r.status));
      this.rev = out.rev; this._pushed = JSON.stringify(store.state); this._persist();
      this.status = 'idle'; this.lastAt = Date.now();
    } catch (e) {
      if (e && e.message === 'unauthorized') return;
      this.status = navigator.onLine ? 'error' : 'offline';
      console.warn('sync push 실패', e);
    }
    updateSyncUI();
  },
};

/* 두 상태를 병합: 누적형(results attempts·favorites·sessions)은 합집합, 스칼라(settings 등)는 최근 수정본 */
function mergeState(local, remote) {
  local = local || {}; remote = remote || {};
  const localNewer = (local._mtime || 0) >= (remote._mtime || 0);
  const out = Object.assign(DEFAULT_STATE(), remote);
  out.results = mergeResults(local.results, remote.results);
  out.favorites = unionArr(remote.favorites, local.favorites);
  out.sessions = mergeSessions(local.sessions, remote.sessions);
  out.session = local.session || remote.session || null;   // 진행 중 세션은 이 기기 우선
  out.settings = Object.assign(DEFAULT_STATE().settings, localNewer ? remote.settings : local.settings, localNewer ? local.settings : remote.settings);
  out.lastSummary = localNewer ? (local.lastSummary || remote.lastSummary || null) : (remote.lastSummary || local.lastSummary || null);
  const lc = local.cppg || {}, rc = remote.cppg || {};
  out.cppg = {
    results: mergeResults(lc.results, rc.results),
    favorites: unionArr(rc.favorites, lc.favorites),
    sessions: mergeSessions(lc.sessions, rc.sessions),
    session: lc.session || rc.session || null,
    lastSummary: localNewer ? (lc.lastSummary || rc.lastSummary || null) : (rc.lastSummary || lc.lastSummary || null),
  };
  out._mtime = Math.max(local._mtime || 0, remote._mtime || 0);
  return out;
}
function unionArr(a, b) { return [...new Set([...(a || []), ...(b || [])])]; }
function mergeResults(a, b) {
  const out = {};
  for (const src of [b || {}, a || {}]) {
    for (const qid of Object.keys(src)) {
      const r = src[qid] || {};
      const t = out[qid] || (out[qid] = { attempts: [], memo: '', ans: '' });
      const seen = new Set(t.attempts.map((x) => x.t + '/' + x.g));
      for (const at of r.attempts || []) { const k = at.t + '/' + at.g; if (!seen.has(k)) { seen.add(k); t.attempts.push(at); } }
      if ((r.memo || '').length > t.memo.length) t.memo = r.memo;
      if ((r.ans || '').length > (t.ans || '').length) t.ans = r.ans;   // 문항별 mtime 없음 → memo 와 같은 "긴 쪽 우선"
    }
  }
  for (const qid of Object.keys(out)) out[qid].attempts.sort((x, y) => x.t - y.t);
  return out;
}
function mergeSessions(a, b) {
  const byId = new Map();
  for (const s of [...(b || []), ...(a || [])]) if (s && s.id != null && !byId.has(s.id)) byId.set(s.id, s);
  return [...byId.values()].sort((x, y) => (y.startedAt || 0) - (x.startedAt || 0)).slice(0, 300);
}
// 병합 후 전역 SESSION/CSESSION 재바인딩 (진행 중 세션 복원)
function rebindSessions() {
  const s = store.state.session;
  SESSION = (s && Array.isArray(s.qids) && s.qids.length) ? s : null;
  store.state.session = SESSION;
  const c = store.state.cppg.session;
  CSESSION = (c && Array.isArray(c.ids) && c.ids.length) ? c : null;
  store.state.cppg.session = CSESSION;
}
function updateSyncUI() {
  const box = document.getElementById('syncState');
  if (!box) return;
  const label = { off: '미연결', idle: '동기화됨', syncing: '동기화 중…', error: '동기화 오류 (로컬엔 저장됨)', offline: '오프라인 (로컬 저장)' }[SYNC.status] || '';
  box.textContent = (SYNC.on ? '✅ 연결됨 · ' : '') + label + (SYNC.on && SYNC.lastAt ? ' · ' + fmtWhen(SYNC.lastAt) : '');
}

/* 노트에 연결된 문항(기출+예상)의 학습 진도. store.result() 는 빈 엔트리를 만들므로
   반드시 읽기 전용 store.lastGrade 만 사용한다. */
function noteProgress(n) {
  const ids = [...(n.questions || []), ...(n.predicted || [])];
  const v = { o: 0, m: 0, x: 0 };
  let done = 0;
  for (const id of ids) {
    const g = store.lastGrade(id);
    if (!g) continue;
    done++; v[g]++;
  }
  const rate = done ? Math.round((v.o / done) * 100) : null;
  const weak = ids.length ? (v.x * 2 + v.m + (ids.length - done) * 0.5) / ids.length : 0;
  return { total: ids.length, done, v, rate, weak, ids };
}

/* 마지막 채점이 ❌·🔺 이거나 아직 안 푼 문항 id 목록 */
function noteWeakIds(n) {
  const ids = [...(n.questions || []), ...(n.predicted || [])];
  return ids.filter((id) => {
    const g = store.lastGrade(id);
    return g === 'x' || g === 'm' || !g;
  });
}

/* ============ 복습 스케줄 (망각곡선) — attempts 만으로 파생, 저장·동기화 변경 없음 ============ */
// 마지막 채점 등급별 재복습 간격(일). 같은 등급이 연속될수록 간격을 늘린다.
const DUE_DAYS = { x: [1, 3, 7, 14], m: [3, 7, 14, 30], o: [14, 30, 60, 120] };
function reviewDueAt(qid) {
  const a = (store.state.results[qid] || {}).attempts;
  if (!a || !a.length) return null;                 // 미풀이는 '진도'지 '복습'이 아니다
  const last = a[a.length - 1];
  let streak = 0;
  for (let i = a.length - 1; i >= 0 && a[i].g === last.g; i--) streak++;
  const tab = DUE_DAYS[last.g] || DUE_DAYS.m;
  return last.t + tab[Math.min(streak - 1, tab.length - 1)] * 86400000;
}
function dueQids() {                                 // 기출만 (예상문제는 모의고사 풀로 따로 관리)
  const now = Date.now();
  return QUESTIONS
    .map((q) => ({ qid: q.qid, due: reviewDueAt(q.qid) }))
    .filter((x) => x.due && x.due <= now)
    .sort((x, y) => x.due - y.due)                   // 가장 오래 밀린 것부터
    .map((x) => x.qid);
}

/* ============ 파생 통계 ============ */
function computeStats() {
  const perDomain = {};
  const perRound = {};
  const perType = {};
  DATA.domains.forEach((d) => (perDomain[d] = { o: 0, m: 0, x: 0, done: 0, total: 0 }));
  DATA.rounds.forEach((r) => (perRound[r.round] = { o: 0, m: 0, x: 0, done: 0, total: 0 }));
  TYPES.forEach((t) => (perType[t] = { o: 0, m: 0, x: 0, done: 0, total: 0 }));

  let attemptsTotal = 0, doneTotal = 0;
  const dayMap = {};

  for (const q of QUESTIONS) {
    perDomain[q.domain].total++;
    perRound[q.round].total++;
    perType[q.type].total++;
    const r = store.state.results[q.qid];
    if (!r || !r.attempts.length) continue;
    doneTotal++;
    perDomain[q.domain].done++;
    perRound[q.round].done++;
    perType[q.type].done++;
    const last = r.attempts[r.attempts.length - 1].g;
    perDomain[q.domain][last]++;
    perRound[q.round][last]++;
    perType[q.type][last]++;
    for (const a of r.attempts) {
      attemptsTotal++;
      const key = dayKey(a.t);
      dayMap[key] = (dayMap[key] || 0) + 1;
    }
  }

  const wrongRank = QUESTIONS
    .map((q) => ({ q, x: store.wrongCount(q.qid), m: store.maybeCount(q.qid) }))
    .filter((r) => r.x > 0 || r.m > 0)
    .sort((a, b) => b.x - a.x || b.m - a.m)
    .slice(0, 40);

  return { perDomain, perRound, perType, attemptsTotal, doneTotal, dayMap, wrongRank };
}

/* ============ 유틸 ============ */
const $ = (sel, root = document) => root.querySelector(sel);
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

// 로컬 기준 YYYY-MM-DD (일별 집계 키). toISOString 은 UTC 라 KST 새벽(00~09시)이 전날로 샌다.
function dayKey(ts) {
  const d = ts == null ? new Date() : new Date(ts), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
// dayMap(키: dayKey) 에서 오늘(또는 어제)부터 역방향으로 이어지는 학습 연속일 수
function streakDays(dayMap) {
  if (!dayMap) return 0;
  let n = 0;
  const d = new Date();
  if (!dayMap[dayKey(d.getTime())]) d.setDate(d.getDate() - 1);   // 오늘 아직 안 했으면 어제부터
  while (dayMap[dayKey(d.getTime())]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

function toast(msg) {
  const t = el(`<div class="toast">${esc(msg)}</div>`);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

/* 마크다운 렌더 후 표를 가로 스크롤 컨테이너로 감싼다 (모바일에서 표 밀림 방지) */
function enhanceMarkdown(root) {
  if (!root) return;
  root.querySelectorAll('table').forEach((tbl) => {
    if (tbl.parentElement && tbl.parentElement.classList.contains('md-table')) return;
    const wrap = document.createElement('div');
    wrap.className = 'md-table';
    tbl.parentNode.insertBefore(wrap, tbl);
    wrap.appendChild(tbl);
  });
}

function qLabel(q) { return q.predicted ? `예상 · ${q.domain}` : `${q.round}회 ${q.no}번`; }

/* 원본 JSON에 누락된 지문(로그·보기·코드 등)의 보충 자료 블록.
   supplementSrc === 'provided' 는 실제 기출 지문을 확보한 것, 그 외는 정답 기반 재구성. */
function supplementHtml(q) {
  if (!q.supplement) return '';
  const provided = q.supplementSrc === 'provided';
  const cap = provided
    ? '📄 지문 <span>· 원본 데이터 누락분 복원</span>'
    : '🧩 지문 재구성 <span>· 원본 데이터 누락분</span>';
  const md = window.marked ? window.marked.parse(q.supplement) : esc(q.supplement);
  return `<div class="supplement${provided ? ' provided' : ''}"><span class="supp-cap">${cap}</span><div class="supp-body markdown">${md}</div></div>`;
}

/* 이 문항이 속한 「반복출제」 노트 (있으면) + 배지 링크 */
function repeatNote(q) {
  const slug = (q.notes || []).find((s) => s.startsWith('반복출제/'));
  return slug ? NOTE_BY_SLUG.get(slug) : null;
}
function repeatBadge(q) {
  const n = repeatNote(q);
  if (!n) return null;
  const el2 = el(`<a class="repeat-badge" href="#/note/${encodeURIComponent(n.slug)}">🔁 ${n.questions.length}회 반복 출제 · 회차별 비교 →</a>`);
  return el2;
}
/* 📎 관련 노트 링크 HTML — 반복출제 슬러그는 제외(🔁 배지와 중복) */
function noteLinksHtml(q) {
  return (q.notes || []).filter((s) => !s.startsWith('반복출제/')).map((slug) => {
    const n = NOTE_BY_SLUG.get(slug);
    return n ? `<a href="#/note/${encodeURIComponent(slug)}">📎 ${esc(n.title)}</a>` : '';
  }).join('');
}

/* 답안 텍스트에서 "정답" 접두어를 라벨로 분리 */
function renderAnswer(ans) {
  const m = String(ans).match(/^\s*(정답\s*[:：]?)\s*([\s\S]*)$/);
  if (m) return `<span class="a-label">정답</span> ${esc(m[2])}`;
  return esc(ans);
}

/* ============ 라우터 ============ */
const routes = {};
function route(path, fn) { routes[path] = fn; }
function navigate(hash) { location.hash = hash; }

function currentRoute() {
  const raw = location.hash.replace(/^#\/?/, '') || 'home';
  const [path, ...rest] = raw.split('/');
  return { path, args: rest };
}

function render() {
  const { path, args } = currentRoute();
  const view = routes[path] || routes.home;
  const app = $('#app');
  app.innerHTML = '';
  if (STIMER) { clearInterval(STIMER); STIMER = null; }   // 세션 타이머 정리 (session 라우트가 필요 시 재생성)
  try { window.scrollTo(0, 0); } catch (e) { /* noop */ }
  view(app, args);
  const tabbar = $('#tabbar');
  tabbar.hidden = false;
  const track = path === 'cppg' ? 'cppg' : 'sil';
  if (store.state.settings.track !== track) { store.state.settings.track = track; store.save(); }
  tabbar.querySelectorAll('.tabs').forEach((g) => { g.hidden = g.dataset.track !== track; });
  // 라우트 → 하단 탭 매핑 (탭이 없는 라우트는 부모 탭을 활성화)
  const SIL_TAB = { mock: 'solve', notes: 'more', note: 'more' };
  const activeTab = track === 'cppg' ? (args[0] || '') : (SIL_TAB[path] || path);
  tabbar.querySelectorAll(`.tabs[data-track="${track}"] a`).forEach((a) => {
    const on = a.dataset.tab === activeTab;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}
window.addEventListener('hashchange', render);

/* ============ 테마 ============ */
function applyTheme() {
  const t = store.state.settings.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

/* ============ 문제 카드 컴포넌트 ============ */
function questionCard(q, opts = {}) {
  const revealed = opts.revealed ?? store.state.settings.alwaysShowAnswer;
  // 이번 풀이 기준 시각: 세션이면 세션 시작, 아니면 카드를 연 지금 → 이전 채점은 힌트로만 표시
  const sinceTs = opts.sessionStart || Date.now();
  const card = el(`<div class="card q-card"></div>`);

  const notesHtml = noteLinksHtml(q);
  const rep = repeatNote(q);

  const savedAns = (store.state.results[q.qid] || {}).ans || '';
  const inSession = !!opts.sessionStart;
  const initialAns = inSession ? '' : savedAns;         // 세션 중엔 빈칸(인출 연습), 복습 문맥이면 프리필
  const longHint = (q.type === '서술형' || q.type === '실무형') ? ' · 권장 3~5줄' : '';

  card.innerHTML = `
    <div class="q-head">
      <span class="pill accent">${esc(qLabel(q))}</span>
      <span class="pill">${esc(q.type)}</span>
      <span class="pill">${esc(q.domain)}</span>
      <button class="star ${store.isFav(q.qid) ? 'on' : ''}" title="즐겨찾기" aria-label="즐겨찾기" aria-pressed="${store.isFav(q.qid)}">${store.isFav(q.qid) ? '★' : '☆'}</button>
    </div>
    <div class="q-body">${esc(q.question)}${supplementHtml(q)}</div>
    ${rep ? `<a class="repeat-badge" href="#/note/${encodeURIComponent(rep.slug)}">🔁 ${rep.questions.length}회 반복 출제 · 회차별 비교 →</a>` : ''}

    <label class="field my-answer">
      <span>✍️ 내 답 (선택 입력) <span class="ans-count"></span>${inSession && savedAns ? ' <a href="#" class="load-ans">지난 답안 불러오기</a>' : ''}</span>
      <textarea class="my-ans" rows="3" placeholder="여기에 답을 적어보고 아래에서 정답과 비교하세요">${esc(initialAns)}</textarea>
    </label>

    <div class="reveal-slot"></div>
  `;

  const slot = $('.reveal-slot', card);
  const star = $('.star', card);
  star.addEventListener('click', () => {
    store.toggleFav(q.qid);
    const on = store.isFav(q.qid);
    star.classList.toggle('on', on);
    star.setAttribute('aria-pressed', on);
    star.textContent = on ? '★' : '☆';
  });

  // ── 내 답: 저장(디바운스) · 글자수 · 비교 블록 실시간 동기화 ──
  const myAnsEl = $('.my-ans', card);
  const countEl = $('.ans-count', card);
  let acTextEl = null;      // 정답 펼치면 생성되는 비교 블록의 "내 답" 칸
  let answerEl = null;
  const saveAns = (v) => {
    v = v.trim();
    if (!v && !store.state.results[q.qid]) return;   // 빈 답으로 빈 엔트리를 만들지 않음
    store.setAns(q.qid, v);
  };
  const syncAns = () => {
    const v = myAnsEl.value.trim();
    countEl.textContent = v ? `${v.length}자${longHint}` : '';
    if (acTextEl) acTextEl.textContent = v || '(비어 있음)';
    else if (answerEl && v && !$('.ans-compare', answerEl)) { rebuildAnswer(); }
  };
  let ansTimer = null;
  myAnsEl.addEventListener('input', () => {
    myAnsEl.style.height = 'auto'; myAnsEl.style.height = myAnsEl.scrollHeight + 'px';
    syncAns();
    clearTimeout(ansTimer);
    ansTimer = setTimeout(() => saveAns(myAnsEl.value), 600);
  });
  const flushAns = () => { clearTimeout(ansTimer); saveAns(myAnsEl.value); };
  myAnsEl.addEventListener('change', flushAns);
  myAnsEl.addEventListener('blur', flushAns);
  const loadLink = $('.load-ans', card);
  if (loadLink) loadLink.addEventListener('click', (e) => {
    e.preventDefault();
    myAnsEl.value = (store.state.results[q.qid] || {}).ans || '';
    myAnsEl.dispatchEvent(new Event('input'));
    loadLink.remove();
  });

  function buildAnswer() {
    const r = store.state.results[q.qid] || {};   // 읽기 전용 — store.result() 는 빈 엔트리를 만듦
    const priorN = store.attemptCount(q.qid);
    const priorLast = store.lastGrade(q.qid);
    const priorX = store.wrongCount(q.qid);
    const histHtml = priorN
      ? `<div class="grade-hist small">지난 채점 ${GRADE_ICON[priorLast] || ''} <b>${GRADE_LABEL[priorLast] || '-'}</b> · ${priorN}회 풀이${priorX ? ` · 누적 오답 ${priorX}회` : ''}</div>`
      : '';
    const myV = myAnsEl.value.trim();
    const modelBody = `<div class="a-body">${renderAnswer(q.answer)}</div>`;
    const answerBlock = myV
      ? `<div class="ans-compare">
           <div class="ac-pane mine"><b>✍️ 내 답</b><div class="ac-text">${esc(myV)}</div></div>
           <div class="ac-pane model"><b>✅ 모범답안</b>${modelBody}</div>
         </div>`
      : modelBody;
    const wrap = el(`
      <div class="answer-wrap">
        ${answerBlock}
        ${q.explanation ? `<div class="expl"><b>💡 해설</b><div class="expl-body markdown">${window.marked ? window.marked.parse(q.explanation) : esc(q.explanation)}</div></div>` : ''}
        ${notesHtml ? `<div class="note-links">${notesHtml}</div>` : ''}
        ${histHtml}
        <div class="grade-row">
          <button class="btn" data-g="o" aria-pressed="false"><span class="g-ico">⭕</span>맞음</button>
          <button class="btn" data-g="m" aria-pressed="false"><span class="g-ico">🔺</span>애매함</button>
          <button class="btn" data-g="x" aria-pressed="false"><span class="g-ico">❌</span>틀림</button>
        </div>
        <label class="field" style="margin-bottom:0">
          <span>💭 내 메모</span>
          <textarea class="memo" rows="1" placeholder="헷갈린 점, 암기 포인트 등">${esc(r.memo || '')}</textarea>
        </label>
      </div>
    `);
    acTextEl = $('.ac-text', wrap);
    const gr = $('.grade-row', wrap);
    const paint = () => {
      const cur = store.lastGradeSince(q.qid, sinceTs);   // 이번 풀이에서 매긴 것만 하이라이트
      gr.querySelectorAll('.btn').forEach((b) => {
        const on = b.dataset.g === cur;
        b.classList.toggle('sel', on);
        b.setAttribute('aria-pressed', on);
      });
    };
    paint();
    gr.querySelectorAll('.btn').forEach((b) => b.addEventListener('click', () => {
      store.gradeSince(q.qid, b.dataset.g, sinceTs);
      paint();
      if (opts.onGrade) opts.onGrade(b.dataset.g);
    }));
    const memo = $('.memo', wrap);
    memo.addEventListener('input', () => { memo.style.height = 'auto'; memo.style.height = memo.scrollHeight + 'px'; });
    memo.addEventListener('change', () => store.setMemo(q.qid, memo.value.trim()));
    enhanceMarkdown(wrap);
    return wrap;
  }

  function rebuildAnswer() {
    if (!answerEl) return;
    const wasHidden = answerEl.hidden;
    const next = buildAnswer();
    next.hidden = wasHidden;
    answerEl.replaceWith(next);
    answerEl = next;
  }

  const toggleBtn = el(`<button class="btn primary wide reveal-btn" aria-expanded="false"></button>`);
  let shown = false;
  function setShown(next) {
    shown = next;
    if (shown && !answerEl) { answerEl = buildAnswer(); slot.appendChild(answerEl); }
    if (answerEl) answerEl.hidden = !shown;
    toggleBtn.textContent = shown ? '정답 닫기 ▲' : '정답 보기 ▼';
    toggleBtn.classList.toggle('open', shown);
    toggleBtn.setAttribute('aria-expanded', shown);
  }
  toggleBtn.addEventListener('click', () => setShown(!shown));
  slot.appendChild(toggleBtn);
  syncAns();
  setShown(revealed);
  enhanceMarkdown(card);
  return card;
}

/* 점수 화면 "다시 볼 문항" · 저장 탭 행 — 펼치면 먼저 문제만, 다시 눌러야 정답·해설 (읽기 전용) */
function reviewItem(q, grade, opts = {}) {
  const notesHtml = noteLinksHtml(q);
  const rep = repeatNote(q);
  const myAns = (store.state.results[q.qid] || {}).ans || '';
  const d = el(`<details class="q-review">
    <summary>
      <span class="pill accent">${esc(qLabel(q))}</span>
      <span class="rv-q">${esc(opts.summaryText || q.question.slice(0, 36))}</span>
      <span class="rv-g g-${grade || 'none'}">${grade ? GRADE_ICON[grade] + ' ' + GRADE_LABEL[grade] : '미채점'}</span>
    </summary>
    <div class="rv-body"></div>
  </details>`);
  const body = $('.rv-body', d);
  let built = false;
  d.addEventListener('toggle', () => {
    if (!d.open || built) return;
    built = true;
    body.innerHTML = `
      ${rep && !opts.hideRepeatBadge ? `<a class="repeat-badge" href="#/note/${encodeURIComponent(rep.slug)}">🔁 ${rep.questions.length}회 반복 출제 · 회차별 비교 →</a>` : ''}
      <div class="q-body">${esc(q.question)}${supplementHtml(q)}</div>
      ${myAns ? `<div class="ac-pane mine rv-mine"><b>✍️ 내 답</b><div class="ac-text">${esc(myAns)}</div></div>` : ''}
      ${opts.memo ? `<label class="field" style="margin:10px 0 0"><span>💭 내 메모</span><textarea class="rv-memo" rows="2" placeholder="헷갈린 점, 암기 포인트 등">${esc((store.state.results[q.qid] || {}).memo || '')}</textarea></label>` : ''}
      <div class="rv-reveal-slot"></div>
      <a class="btn sm" style="margin-top:8px" href="#/q/${encodeURIComponent(q.qid)}">이 문항만 크게 보기 →</a>`;

    const answerEl = el(`<div class="answer-wrap" style="border-top:none;margin-top:10px;padding-top:0">
      <div class="a-body">${renderAnswer(q.answer)}</div>
      ${q.explanation ? `<div class="expl"><b>💡 해설</b><div class="expl-body markdown">${window.marked ? window.marked.parse(q.explanation) : esc(q.explanation)}</div></div>` : ''}
      ${notesHtml ? `<div class="note-links">${notesHtml}</div>` : ''}
    </div>`);
    const rbtn = el(`<button class="btn primary wide reveal-btn" aria-expanded="false">정답·해설 보기 ▼</button>`);
    let shown = false;
    const setShown = (next) => {
      shown = next;
      answerEl.hidden = !shown;
      rbtn.textContent = shown ? '정답·해설 닫기 ▲' : '정답·해설 보기 ▼';
      rbtn.classList.toggle('open', shown);
      rbtn.setAttribute('aria-expanded', shown);
    };
    rbtn.addEventListener('click', () => setShown(!shown));
    const slot = $('.rv-reveal-slot', body);
    slot.append(rbtn, answerEl);
    setShown(store.state.settings.alwaysShowAnswer);

    enhanceMarkdown(body);
    const mt = $('.rv-memo', body);
    if (mt) {
      const grow = () => { mt.style.height = 'auto'; mt.style.height = mt.scrollHeight + 'px'; };
      grow();
      mt.addEventListener('input', grow);
      mt.addEventListener('change', () => store.setMemo(q.qid, mt.value.trim()));
    }
  });
  return d;
}

/* 트랙 전환 스위처 (홈 상단) */
function trackSwitch(cur) {
  const box = el(`<div class="track-switch">
    <a href="#/home" class="${cur === 'sil' ? 'on' : ''}">정보보안기사 실기</a>
    <a href="#/cppg" class="${cur === 'cppg' ? 'on' : ''}">CPPG 개인정보관리사</a>
  </div>`);
  const cppgLink = box.children[1];
  cppgLink.addEventListener('pointerenter', () => { ensureCppg(); }, { once: true });
  return box;
}

/* ============ 홈 ============ */
route('home', (app) => {
  app.appendChild(trackSwitch('sil'));
  const s = computeStats();
  const today = dayKey();
  const todayCount = s.dayMap[today] || 0;

  const weak = Object.entries(s.perDomain)
    .map(([d, v]) => ({ d, v, rate: v.done ? pct(v.o, v.done) : null }))
    .filter((x) => x.v.done >= 3)
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 3);

  const recentWrong = QUESTIONS
    .filter((q) => store.lastGrade(q.qid) === 'x')
    .map((q) => ({ q, t: store.state.results[q.qid].attempts.slice(-1)[0].t }))
    .sort((a, b) => b.t - a.t).slice(0, 5);

  app.appendChild(el(`<h1>정보보안기사 실기</h1>`));

  if (SESSION && SESSION.qids && SESSION.qids.length) {
    const isMock = SESSION.kind === 'mock';
    const expd = sExpiresAt();
    const dead = expd && Date.now() >= expd;
    const rc = el(`<div class="card resume-card">
      <div><b>${isMock ? '진행 중 모의고사' : '이어풀기'}</b> <span class="muted small">${esc(SESSION.label)} · ${SESSION.idx + 1}/${SESSION.qids.length}${expd ? ' · ' + (dead ? '시간 종료' : '남은 ' + fmtClock(expd - Date.now())) : ''}</span></div>
      <div class="row tight" style="margin-top:8px">
        <button class="btn primary sm" id="resumeGo">${dead ? '결과 보기' : '이어서 풀기 →'}</button>
        <button class="btn sm" id="resumeQuit">그만두고 제출</button>
      </div></div>`);
    $('#resumeGo', rc).addEventListener('click', () => dead ? finishSession() : navigate('#/session'));
    $('#resumeQuit', rc).addEventListener('click', () => finishSession());
    app.appendChild(rc);
  }

  const paceCard = examPaceCard(store.state.settings.examDate, {
    unsolved: QUESTIONS.length - s.doneTotal, todayCount, streak: streakDays(s.dayMap),
  });
  if (paceCard) app.appendChild(paceCard);

  app.appendChild(el(`
    <div class="stat-grid">
      <div class="card"><div class="big">${todayCount}</div><div class="muted small">오늘 푼 문항</div></div>
      <div class="card"><div class="big">${s.doneTotal}<span class="muted" style="font-size:1rem">/${QUESTIONS.length}</span></div><div class="muted small">1회+ 학습</div></div>
      <div class="card"><div class="big">${s.attemptsTotal ? pct(countLast('o'), s.doneTotal) : 0}%</div><div class="muted small">최근 정답률</div></div>
    </div>
  `));

  app.appendChild(el(`<div class="row" style="margin-top:14px">
    <a class="btn primary" href="#/solve">문제 풀기 →</a>
    ${PREDICTED.length ? '<a class="btn" href="#/mock">모의고사</a>' : ''}
    ${MNEMONICS.length ? '<a class="btn" href="#/mnemonics">📿 두음</a>' : ''}
    <a class="btn" href="#/stats">통계</a>
    ${(store.state.favorites.length || Object.values(store.state.results).some((r) => r.memo)) ? '<a class="btn" href="#/saved">⭐ 저장</a>' : ''}
    ${store.state.sessions.length ? '<a class="btn" href="#/history">지난 기록</a>' : ''}
  </div>`));

  const due = dueQids();
  if (due.length) {
    const dv = { o: 0, m: 0, x: 0 };
    due.forEach((qid) => { const g = store.lastGrade(qid); if (g) dv[g]++; });
    const box = el(`<div class="card"><h3>🔁 오늘 복습할 문항 <span class="muted small">${due.length}</span></h3>
      <div class="bar-row"><span class="bar-label">등급 구성</span>${barTrack(dv)}<span class="bar-num">${due.length}</span></div>
      <div class="row tight" style="margin-top:8px"><button class="btn primary sm" id="dueGo">복습 시작 →</button></div>
      <p class="small muted" style="margin-top:6px">망각곡선 간격 · ❌ 1→3→7일 · 🔺 3→7→14일 · ⭕ 14→30→60일</p>
    </div>`);
    $('#dueGo', box).addEventListener('click', () => {
      const ids = dueQids().slice(0, 20);
      startSession(ids, `오늘 복습 ${ids.length}문항`);
    });
    app.appendChild(box);
  }

  const mockHist = store.state.sessions.filter((s) => s.kind === 'mock');
  const lastMock = mockHist[0];
  if (lastMock) {
    const canOpen = Array.isArray(lastMock.qids) && lastMock.qids.length;
    const prev = mockHist.slice(1, 5).map((m) => `${m.score != null ? m.score : '-'}점`).join(', ');
    app.appendChild(el(`<div class="card"><h3>최근 모의고사 <span class="muted small">${mockHist.length}회 응시</span></h3>
      <div class="pass-line ${lastMock.pass ? 'ok' : 'bad'}">${lastMock.score != null ? lastMock.score + ' / 100점' : '-'} · ${lastMock.pass ? '✅ 합격' : '❌ 불합격'}</div>
      <div class="small muted">${fmtWhen(lastMock.startedAt)}${prev ? ` · 이전: ${prev}` : ''}</div>
      <div class="small muted" style="margin-top:4px">${canOpen ? `<a href="#/summary/${encodeURIComponent(lastMock.id)}">결과 다시보기</a> · ` : ''}<a href="#/history">전체 기록</a> · <a href="#/mock">새 모의고사 →</a></div>
    </div>`));
  }

  if (weak.length) {
    const box = el(`<div class="card"><h3>약점 영역</h3></div>`);
    weak.forEach((w) => box.appendChild(el(
      `<div class="bar-row"><span class="bar-label">${esc(w.d)}</span>
       ${barTrack(w.v)}<span class="bar-num">${w.rate}%</span></div>`)));
    box.appendChild(el(`<a class="btn sm" style="margin-top:8px" href="#/solve">이 영역 집중 풀기</a>`));
    app.appendChild(box);
  }

  if (recentWrong.length) {
    const box = el(`<div class="card"><h3>최근 틀린 문항</h3></div>`);
    recentWrong.forEach(({ q }) => {
      const item = el(`<div class="rank-item"><span class="pill accent">${esc(qLabel(q))}</span><span class="small muted" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(q.question.slice(0, 40))}</span></div>`);
      item.addEventListener('click', () => navigate('#/q/' + q.qid));
      box.appendChild(item);
    });
    app.appendChild(box);
  }

  app.appendChild(el(`<p class="small muted center" style="margin-top:24px">데이터 생성 ${DATA.builtAt.slice(0, 10)} · 총 ${QUESTIONS.length}문항 · 노트 ${DATA.notes.length}개</p>`));

  function countLast(g) { return QUESTIONS.filter((q) => store.lastGrade(q.qid) === g).length; }
});

function barTrack(v) {
  const tot = v.o + v.m + v.x || 1;
  return `<span class="bar-track">
    <i class="o" style="width:${(v.o / tot) * 100}%"></i>
    <i class="m" style="width:${(v.m / tot) * 100}%"></i>
    <i class="x" style="width:${(v.x / tot) * 100}%"></i>
  </span>`;
}

/* D-day · 하루 권장 페이스 · 연속 학습일 — 실기·CPPG 공용. 시험일 미설정이면 null. */
function examPaceCard(examDate, o) {
  if (!examDate) return null;
  const d0 = new Date(examDate + 'T00:00:00').getTime();
  if (isNaN(d0)) return null;
  const dLeft = Math.ceil((d0 - Date.now()) / 86400000);
  const target = dLeft > 0 && o.unsolved > 0 ? Math.ceil(o.unsolved / dLeft) : 0;
  const dLabel = dLeft > 1 ? `D-${dLeft}` : dLeft === 1 ? '내일' : dLeft === 0 ? 'D-DAY' : '시험 종료';
  const done = Math.max(0, o.todayCount || 0);
  const bar = target
    ? `<div class="bar-row"><span class="bar-label">오늘 ${done}/${target}</span>${barTrack({ o: Math.min(done, target), m: 0, x: Math.max(0, target - done) })}</div>`
    : `<div class="small muted">오늘 ${done}문항 학습</div>`;
  return el(`<div class="card dday-card">
    <div class="dday-top"><b>🗓 ${dLabel}</b><span class="muted small">${examDate}</span><span class="dday-streak">🔥 연속 ${o.streak}일</span></div>
    ${dLeft > 0 ? `<div class="small muted">미풀이 ${o.unsolved}문항 · 남은 ${dLeft}일${target ? ` → 하루 약 ${target}문항` : ''}</div>` : ''}
    ${bar}
  </div>`);
}

/* 풀기 페이지 상단 세그먼트 — [문제 풀기 | 모의고사] */
function solveSeg(mode) {
  const seg = el(`<div class="track-switch">
    <a data-v="solve" class="${mode === 'solve' ? 'on' : ''}">문제 풀기</a>
    <a data-v="mock" class="${mode === 'mock' ? 'on' : ''}">모의고사</a>
  </div>`);
  seg.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (a && a.dataset.v !== mode) navigate(a.dataset.v === 'mock' ? '#/mock' : '#/solve');
  });
  return seg;
}

/* ============ 풀기: 범위 선택 ============ */
route('solve', (app) => {
  app.appendChild(solveSeg('solve'));
  app.appendChild(el(`<h1>문제 풀기</h1>`));
  const form = el(`<div class="card stack"></div>`);

  form.appendChild(el(`<label class="field"><span>범위</span>
    <select id="scope">
      <option value="round">회차별</option>
      <option value="domain">영역별</option>
      <option value="type">유형별</option>
      <option value="predicted">예상문제 (모의고사용)</option>
      <option value="due">오늘 복습 (망각곡선)</option>
      <option value="wrong">오답만 (마지막이 틀림)</option>
      <option value="maybe">애매함만 (마지막이 애매함)</option>
      <option value="fav">즐겨찾기만</option>
      <option value="unseen">안 푼 문항</option>
      <option value="random">랜덤</option>
    </select></label>`));

  const sub = el(`<div id="sub"></div>`);
  form.appendChild(sub);

  const predWrap = el(`<label class="row" id="predWrap" style="align-items:center;gap:6px;margin:0">
    <input type="checkbox" id="incPred" style="width:auto"><span class="small">예상문제도 포함</span></label>`);
  form.appendChild(predWrap);

  form.appendChild(el(`<label class="field"><span>정렬</span>
    <select id="order">
      <option value="seq">회차·번호순</option>
      <option value="shuffle">무작위</option>
    </select></label>`));

  form.appendChild(el(`<label class="field" id="limitWrap"><span>문항 수 (0 = 전체)</span>
    <input type="number" id="limit" value="0" min="0" max="${QUESTIONS.length + PREDICTED.length}"></label>`));

  const startBtn = el(`<button class="btn primary wide" id="start">시작</button>`);
  form.appendChild(startBtn);
  app.appendChild(form);

  const scopeSel = $('#scope', form);
  function renderSub() {
    const v = scopeSel.value;
    sub.innerHTML = '';
    // '예상문제 포함'은 회차별·즐겨찾기·예상문제 범위에는 의미 없음
    predWrap.hidden = ['round', 'fav', 'predicted', 'due'].includes(v);
    if (v === 'round') {
      sub.appendChild(el(`<label class="field"><span>회차</span><select id="p">
        ${DATA.rounds.map((r) => `<option value="${r.round}">${r.round}회 (${r.date})</option>`).reverse().join('')}
      </select></label>`));
    } else if (v === 'domain' || v === 'predicted') {
      sub.appendChild(el(`<label class="field"><span>영역</span><select id="p">
        <option value="">전체</option>
        ${DATA.domains.map((d) => `<option value="${esc(d)}">${esc(d)}</option>`).join('')}
      </select></label>`));
    } else if (v === 'type') {
      sub.appendChild(el(`<label class="field"><span>유형</span><select id="p">
        <option value="">전체</option>
        ${TYPES.map((t) => `<option value="${t}">${t}</option>`).join('')}
      </select></label>`));
    }
  }
  scopeSel.addEventListener('change', renderSub);
  renderSub();

  startBtn.addEventListener('click', () => {
    const v = scopeSel.value;
    const p = $('#p', sub) ? $('#p', sub).value : null;
    const incPred = $('#incPred', form).checked && !predWrap.hidden;
    let list = (v === 'predicted') ? PREDICTED.slice() : (incPred ? QUESTIONS.concat(PREDICTED) : QUESTIONS.slice());
    let label = '';
    if (v === 'round') { list = list.filter((q) => q.round === +p); label = `${p}회`; }
    else if (v === 'domain') { list = p ? list.filter((q) => q.domain === p) : list; label = p || '전체 영역'; }
    else if (v === 'predicted') { list = p ? list.filter((q) => q.domain === p) : list; label = `예상문제${p ? ' ' + p : ''}`; }
    else if (v === 'type') { list = p ? list.filter((q) => q.type === p) : list; label = p || '전체 유형'; }
    else if (v === 'due') { const set = new Set(dueQids()); list = QUESTIONS.filter((q) => set.has(q.qid)); label = '오늘 복습'; }
    else if (v === 'wrong') { list = list.filter((q) => store.lastGrade(q.qid) === 'x'); label = '오답'; }
    else if (v === 'maybe') { list = list.filter((q) => store.lastGrade(q.qid) === 'm'); label = '애매함'; }
    else if (v === 'fav') { list = store.state.favorites.map((id) => anyQ(id)).filter(Boolean); label = '즐겨찾기'; }
    else if (v === 'unseen') { list = list.filter((q) => store.attemptCount(q.qid) === 0); label = '안 푼 문항'; }
    else if (v === 'random') { label = '랜덤'; }
    if (incPred && ['domain', 'type', 'wrong', 'maybe', 'unseen', 'random'].includes(v)) label += ' + 예상';

    if ($('#order', form).value === 'shuffle' || v === 'random') shuffle(list);
    else list.sort((a, b) => (a.round || 9999) - (b.round || 9999) || (a.no || 0) - (b.no || 0) || String(a.qid).localeCompare(String(b.qid)));

    const lim = +$('#limit', form).value;
    if (lim > 0) list = list.slice(0, lim);

    if (!list.length) { toast('해당 조건의 문항이 없습니다'); return; }
    startSession(list.map((q) => q.qid), `${label} ${list.length}문항`);
  });
});

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* ============ 세션 진행 ============ */
let SESSION = null;
let STIMER = null;
function saveSession() { store.state.session = SESSION; store.save(); }
function sExpiresAt() { return SESSION && SESSION.durationMin ? SESSION.startedAt + SESSION.durationMin * 60000 : null; }
function startSession(qids, label, opts = {}) {
  if (SESSION && SESSION.qids && SESSION.qids.length) {
    const wasMock = SESSION.kind === 'mock';
    const hadProgress = sessionHasProgress();
    const msg = wasMock
      ? '진행 중인 모의고사가 있습니다. 새로 시작하면 지금까지 채점한 내용으로 제출 처리되어 기록에 남습니다. 계속할까요?'
      : hadProgress
        ? '진행 중인 세션이 있습니다. 새로 시작하면 지금까지 채점한 내용으로 제출 처리됩니다. 계속할까요?'
        : '진행 중인 세션이 있습니다. 새로 시작하면 현재 진행이 사라집니다. 계속할까요?';
    if (!confirm(msg)) return;
    // 모의고사이거나 채점 흔적이 있으면 버리지 않고 세션 기록으로 남긴다 (홈 '최근 모의고사'·지난 기록에 표시)
    if (wasMock || hadProgress) store.addSession(recordCurrentSession());
  }
  if (STIMER) { clearInterval(STIMER); STIMER = null; }
  SESSION = { qids, label, idx: 0, startedAt: Date.now() };
  if (opts.kind) SESSION.kind = opts.kind;
  if (opts.durationMin) SESSION.durationMin = opts.durationMin;
  saveSession();
  navigate('#/session');
}
// 이번 세션에서 매긴 채점 (없으면 null)
function sessionGrade(qid) { return SESSION ? store.lastGradeSince(qid, SESSION.startedAt) : null; }

route('session', (app) => {
  if (!SESSION) { navigate('#/solve'); return; }
  const expd = sExpiresAt();
  if (expd && Date.now() >= expd) { finishSession(); return; }
  const { qids, idx } = SESSION;
  const q = anyQ(qids[idx]);

  if (expd) {
    const timer = el(`<div class="mock-timer"><span>모의고사</span><span id="sclock">${fmtClock(expd - Date.now())}</span></div>`);
    app.appendChild(timer);
    const clk = $('#sclock', timer);
    STIMER = setInterval(() => {
      const left = expd - Date.now();
      clk.textContent = fmtClock(left);
      timer.classList.toggle('warn', left < 5 * 60000);
      if (left <= 0) { clearInterval(STIMER); STIMER = null; finishSession(); }
    }, 1000);
  }

  app.appendChild(el(`<div class="q-head" style="margin-bottom:4px">
    <span class="pill">${esc(SESSION.label)}</span>
    <span class="muted small" style="margin-left:auto">${idx + 1} / ${qids.length}</span>
  </div>`));
  app.appendChild(el(`<div class="progress"><i style="width:${((idx + 1) / qids.length) * 100}%"></i></div>`));

  app.appendChild(questionCard(q, {
    sessionStart: SESSION.startedAt,
    onGrade: () => {
      saveSession();
      const cell = grid && grid.children[idx];
      if (cell) cell.className = `q-cell g-${sessionGrade(q.qid)} cur`;
    },
  }));

  const nav = el(`<div class="nav-row"></div>`);
  const prev = el(`<button class="btn">← 이전</button>`);
  prev.disabled = idx === 0;
  prev.addEventListener('click', () => { SESSION.idx--; saveSession(); render(); });
  const isLast = idx === qids.length - 1;
  const next = el(`<button class="btn primary">${isLast ? '제출 ✓' : '다음 →'}</button>`);
  next.addEventListener('click', () => {
    if (isLast) finishSession();
    else { SESSION.idx++; saveSession(); render(); }
  });
  nav.append(prev, next);
  app.appendChild(nav);

  // 문항 점프 그리드 (접기)
  const jump = el(`<details class="q-jump"><summary class="small muted">문항 이동 (${qids.length})</summary><div class="q-grid"></div></details>`);
  const grid = $('.q-grid', jump);
  qids.forEach((qid, i) => {
    const g = sessionGrade(qid);
    const glab = g ? ' · ' + GRADE_LABEL[g] : '';
    const b = el(`<button class="q-cell ${g ? 'g-' + g : ''} ${i === idx ? 'cur' : ''}" aria-label="${i + 1}번${glab}"${i === idx ? ' aria-current="true"' : ''}>${i + 1}</button>`);
    b.addEventListener('click', () => { SESSION.idx = i; saveSession(); render(); });
    grid.appendChild(b);
  });
  app.appendChild(jump);

  const quit = el(`<button class="btn sm" style="margin-top:12px">그만두고 제출</button>`);
  quit.addEventListener('click', finishSession);
  app.appendChild(quit);
});

/* 2023 배점: 단답 3 / 서술 12 / 실무 16. ⭕만 만점, 🔺·❌ 0점. 모의고사는 실무형 2문제 중 최고 등급 1개만 채점 */
const PT = { 단답형: 3, 서술형: 12, 실무형: 16 };
function scoreQids(qids, gradeOf, mock) {
  const byType = {};
  qids.forEach((qid) => {
    const q = anyQ(qid);
    if (!q || !PT[q.type]) return;
    const v = byType[q.type] || (byType[q.type] = { o: 0, m: 0, x: 0, graded: 0, total: 0 });
    v.total++;
    const gr = gradeOf(qid);
    if (gr) { v[gr]++; v.graded++; }
  });
  let score = 0, full = 0, maxIfMaybe = 0;
  for (const t of Object.keys(byType)) {
    const v = byType[t];
    if (mock && t === '실무형') {
      // 채점한 실무형 중 최고 등급 하나만 반영 (실제 시험: 2문제 중 1개 채점)
      const best = v.o ? 'o' : v.m ? 'm' : v.x ? 'x' : null;
      if (best === 'o') score += PT[t];
      if (best === 'o' || best === 'm') maxIfMaybe += PT[t];
      full += best ? PT[t] : 0;
    } else {
      score += v.o * PT[t];
      full += v.graded * PT[t];
      maxIfMaybe += (v.o + v.m) * PT[t];
    }
  }
  // 모의고사 총점은 100점 만점 고정 (미채점 문항도 편성에 포함 → 0점)
  if (mock) full = MOCK.quota.단답형 * PT.단답형 + MOCK.quota.서술형 * PT.서술형 + PT.실무형;
  return { byType, score, full, maxIfMaybe };
}

// 현재 SESSION 을 세션 레코드로 만든다 (저장/네비게이션은 하지 않음)
function recordCurrentSession() {
  if (STIMER) { clearInterval(STIMER); STIMER = null; }
  const startedAt = SESSION.startedAt;
  const kind = SESSION.kind || null;
  const qids = SESSION.qids.slice();
  const graded = { o: 0, m: 0, x: 0 };
  const grades = {};   // qid -> 'o'|'m'|'x' 스냅샷 (나중에 재채점해도 이 세션 점수창은 고정)
  for (const qid of qids) { const g = store.lastGradeSince(qid, startedAt); if (g) { graded[g]++; grades[qid] = g; } }
  const rec = { id: startedAt, startedAt, endedAt: Date.now(), scopeLabel: SESSION.label, graded, qids, grades };
  if (kind === 'mock') {
    const { score } = scoreQids(qids, (qid) => grades[qid] || null, true);
    rec.kind = 'mock'; rec.score = score; rec.pass = score >= MOCK.passScore;
  }
  return rec;
}

// 세션 진행 중 여부 + 채점 흔적 유무
function sessionHasProgress() {
  return !!(SESSION && SESSION.qids && SESSION.qids.length &&
    SESSION.qids.some((qid) => store.lastGradeSince(qid, SESSION.startedAt)));
}

function finishSession() {
  const rec = recordCurrentSession();
  store.addSession(rec);
  store.state.lastSummary = {
    label: rec.scopeLabel, qids: rec.qids, startedAt: rec.startedAt,
    graded: rec.graded, grades: rec.grades, kind: rec.kind || null,
    score: rec.score, pass: rec.pass,
  };
  SESSION = null;
  store.state.session = null;
  store.save();
  navigate('#/summary');
}

route('summary', (app, args) => {
  const sid = args && args.length ? decodeURIComponent(args.join('/')) : '';
  let SUM, past = false;
  if (sid) {   // 지난 세션의 점수창 다시보기 (#/summary/<id>)
    const rec = store.state.sessions.find((s) => String(s.id) === sid);
    if (!rec || !Array.isArray(rec.qids)) { navigate('#/history'); return; }
    SUM = { label: rec.scopeLabel, qids: rec.qids, startedAt: rec.startedAt, endedAt: rec.endedAt,
            kind: rec.kind || null, grades: rec.grades || {}, score: rec.score, pass: rec.pass };
    past = true;
  } else {
    SUM = store.state.lastSummary;
    if (!SUM) { navigate('#/solve'); return; }
  }
  const since = SUM.startedAt || 0;
  // 스냅샷(grades)이 있으면 그걸로, 없으면(구버전 기록) 세션 시작 이후 마지막 채점
  const gradeOf = SUM.grades
    ? (qid) => SUM.grades[qid] || null
    : (qid) => store.lastGradeSince(qid, since);

  const g = { o: 0, m: 0, x: 0 };
  let ungraded = 0;
  SUM.qids.forEach((qid) => { const x = gradeOf(qid); if (x) g[x]++; else ungraded++; });
  const total = g.o + g.m + g.x;

  const isMock = SUM.kind === 'mock';
  app.appendChild(el(`<h1>${isMock ? '모의고사 결과' : past ? '지난 점수창' : '제출 완료'}</h1>`));
  app.appendChild(el(`<p class="muted">${esc(SUM.label)} · 채점 ${total}문항${ungraded ? ` · 미채점 ${ungraded}문항` : ''}${past ? ` · ${new Date(SUM.startedAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })} 제출` : ''}</p>`));

  // 자가채점 점수 (2023 배점). 모의고사는 실무형 택1 채점 + 60점 합격 판정.
  const { byType, score, full, maxIfMaybe } = scoreQids(SUM.qids, gradeOf, isMock);
  const scoredTypes = ['단답형', '서술형', '실무형'].filter((t) => byType[t] && (isMock || byType[t].graded));

  if (isMock) {
    const pass = score >= MOCK.passScore;
    app.appendChild(el(`<div class="card score-card">
      <div class="pass-line ${pass ? 'ok' : 'bad'}">${score} / ${full}점 &nbsp; ${pass ? '✅ 합격' : '❌ 불합격'}</div>
      <div class="small muted">합격 기준 ${MOCK.passScore}점 이상${maxIfMaybe > score ? ` · 🔺 애매함까지 정답이면 ${maxIfMaybe}점` : ''}</div>
      <div class="small muted" style="margin-top:3px">${esc(scoredTypes.map((t) => `${t} ${byType[t].o}⭕/${byType[t].total}문항`).join(' · '))}</div>
      <div class="small muted" style="margin-top:3px">⭕ 로 채점한 문항만 가산(부분점수 없음). 실무형은 2문제 중 1문제만 채점(더 높게 채점한 쪽 반영). 자가채점이므로 실제 시험 점수와 다를 수 있습니다.</div>
    </div>`));
  } else if (scoredTypes.length) {
    let oCnt = 0, mCnt = 0, xCnt = 0;
    scoredTypes.forEach((t) => { const v = byType[t]; oCnt += v.o; mCnt += v.m; xCnt += v.x; });
    const rate = full ? Math.round((score / full) * 100) : 0;
    const breakdown = scoredTypes.map((t) => `${t} ${byType[t].o}/${byType[t].graded}×${PT[t]}점`).join(' · ');
    app.appendChild(el(`
      <div class="card score-card">
        <h3>자가채점 점수 <span class="muted small">2023 배점 · 단답 3 / 서술 12 / 실무 16</span></h3>
        <div class="score-line"><b>${score}</b><span class="muted"> / ${full}점</span> <span class="pill accent">${rate}%</span></div>
        <div class="small muted" style="margin-top:6px">
          ⭕ ${oCnt} · 🔺 ${mCnt} · ❌ ${xCnt}${mCnt ? ` · 애매함까지 정답이면 최대 ${maxIfMaybe}점` : ''}
        </div>
        <div class="small muted" style="margin-top:3px">${esc(breakdown)}</div>
        <div class="small muted" style="margin-top:3px">⭕ 로 채점한 문항만 만점 가산(부분점수 없음). 실무형은 실제 시험에서 2문제 중 1문제만 선택 채점.</div>
      </div>
    `));
  }

  app.appendChild(el(`
    <div class="stat-grid">
      <div class="card"><div class="big" style="color:var(--ok)">${g.o}</div><div class="muted small">맞음</div></div>
      <div class="card"><div class="big" style="color:var(--maybe)">${g.m}</div><div class="muted small">애매함</div></div>
      <div class="card"><div class="big" style="color:var(--bad)">${g.x}</div><div class="muted small">틀림</div></div>
    </div>
  `));

  // 영역별 성적
  const perDom = {};
  SUM.qids.forEach((qid) => {
    const gr = gradeOf(qid);
    if (!gr) return;
    const q = anyQ(qid);
    (perDom[q.domain] || (perDom[q.domain] = { o: 0, m: 0, x: 0 }))[gr]++;
  });
  if (Object.keys(perDom).length) {
    const box = el(`<div class="card"><h3>영역별</h3></div>`);
    Object.entries(perDom).forEach(([d, v]) => box.appendChild(el(
      `<div class="bar-row"><span class="bar-label">${esc(d)}</span>${barTrack(v)}<span class="bar-num">${v.o + v.m + v.x}문항</span></div>`)));
    app.appendChild(box);
  }

  // 오답·애매·미채점 문항 — 눌러서 정답·해설을 이 화면에서 바로 확인
  const review = SUM.qids.filter((qid) => { const gr = gradeOf(qid); return gr === 'x' || gr === 'm' || !gr; });
  if (review.length) {
    const box = el(`<div class="card"><h3>다시 볼 문항 (${review.length}) <span class="muted small">눌러서 답·해설</span></h3></div>`);
    review.forEach((qid) => {
      const q = anyQ(qid); if (!q) return;
      box.appendChild(reviewItem(q, gradeOf(qid)));
    });
    const btnRow = el(`<div class="row tight" style="margin-top:12px"></div>`);
    const expand = el(`<button class="btn sm">모두 펼치기</button>`);
    let allOpen = false;
    expand.addEventListener('click', () => {
      allOpen = !allOpen;
      box.querySelectorAll('details.q-review').forEach((x) => { x.open = allOpen; });
      expand.textContent = allOpen ? '모두 접기' : '모두 펼치기';
    });
    const again = el(`<button class="btn primary" style="flex:1">이 문항 다시 풀기</button>`);
    again.addEventListener('click', () => startSession(review, `${SUM.label} 복습`));
    btnRow.append(expand, again);
    box.appendChild(btnRow);
    app.appendChild(box);
  }

  app.appendChild(el(`<div class="nav-row">${isMock ? '<a class="btn" href="#/mock">새 모의고사</a>' : '<a class="btn" href="#/solve">새 세션</a>'}<a class="btn" href="#/history">지난 기록</a><a class="btn" href="#/stats">통계</a></div>`));
});

/* ============ 지난 풀이 기록 (점수창 다시보기) ============ */
route('history', (app) => {
  app.appendChild(el(`<h1>지난 풀이 기록</h1>`));
  const sess = store.state.sessions;
  if (!sess.length) {
    app.appendChild(el(`<div class="empty">아직 제출한 세션이 없습니다.<br><span class="small">문제를 풀고 제출하면 점수창이 여기에 보관됩니다.</span></div>`));
    return;
  }
  const box = el(`<div class="card"><h3>최근 ${sess.length}회 <span class="muted small">누르면 그때 점수창</span></h3></div>`);
  sess.forEach((h) => {
    const g = h.graded || { o: 0, m: 0, x: 0 };
    const openable = Array.isArray(h.qids) && h.qids.length;
    const isMock = h.kind === 'mock';
    const right = isMock
      ? `<span class="small ${h.pass ? '' : 'rank-x'}">${h.score != null ? h.score + '점 · ' + (h.pass ? '합격' : '불합격') : '-'}</span>`
      : `<span class="small muted">⭕${g.o} 🔺${g.m} ❌${g.x}</span>`;
    const item = el(`<div class="rank-item"${openable ? '' : ' style="cursor:default;opacity:.55"'}>
      <span class="pill accent">${fmtDay(h.startedAt)}</span>
      <span class="small" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${isMock ? '📝 ' : ''}${esc(h.scopeLabel || '세션')}</span>
      ${right}</div>`);
    if (openable) item.addEventListener('click', () => navigate('#/summary/' + encodeURIComponent(h.id)));
    box.appendChild(item);
  });
  app.appendChild(box);
  app.appendChild(el(`<p class="small muted center" style="margin-top:14px">문항 정보가 없는 옛 기록은 점수만 표시되고 열 수 없습니다.</p>`));
});

/* ============ 저장한 문항 (즐겨찾기 · 메모) ============ */
let savedTab = 'fav';
route('saved', (app) => {
  app.appendChild(el(`<h1>저장한 문항</h1>`));
  const favIds = store.state.favorites.filter((id) => anyQ(id));
  const memoIds = Object.keys(store.state.results)
    .filter((qid) => store.state.results[qid].memo && anyQ(qid));

  const seg = el(`<div class="track-switch">
    <a data-v="fav">⭐ 즐겨찾기 <span>${favIds.length}</span></a>
    <a data-v="memo">💭 메모 <span>${memoIds.length}</span></a></div>`);
  const wrap = el(`<div></div>`);

  const draw = (v) => {
    savedTab = v;
    seg.querySelectorAll('a').forEach((a) => a.classList.toggle('on', a.dataset.v === v));
    wrap.innerHTML = '';
    const ids = v === 'memo' ? memoIds : favIds;
    if (!ids.length) {
      wrap.appendChild(el(`<div class="empty">${v === 'memo'
        ? '메모가 없습니다.<br><span class="small">문제를 풀며 정답을 펼치면 메모를 남길 수 있어요. 여기서 바로 수정도 됩니다.</span>'
        : '즐겨찾기가 없습니다.<br><span class="small">문제 카드의 ☆ 를 눌러 추가하세요.</span>'}</div>`));
      return;
    }
    const box = el(`<div class="card"><h3>${v === 'memo' ? '메모한 문항' : '즐겨찾기'} (${ids.length}) <span class="muted small">눌러서 답·해설${v === 'memo' ? '·메모' : ''}</span></h3></div>`);
    ids.forEach((qid) => {
      const q = anyQ(qid); if (!q) return;
      box.appendChild(reviewItem(q, store.lastGrade(qid), {
        memo: true,
        summaryText: v === 'memo' ? store.state.results[qid].memo : undefined,
      }));
    });
    const btnRow = el(`<div class="row tight" style="margin-top:12px"></div>`);
    const expand = el(`<button class="btn sm">모두 펼치기</button>`);
    let allOpen = false;
    expand.addEventListener('click', () => {
      allOpen = !allOpen;
      box.querySelectorAll('details.q-review').forEach((x) => { x.open = allOpen; });
      expand.textContent = allOpen ? '모두 접기' : '모두 펼치기';
    });
    btnRow.appendChild(expand);
    if (v === 'fav') {
      const solve = el(`<button class="btn primary" style="flex:1">즐겨찾기 ${ids.length}문항 풀기</button>`);
      solve.addEventListener('click', () => startSession(ids.slice(), `즐겨찾기 ${ids.length}문항`));
      btnRow.appendChild(solve);
    }
    box.appendChild(btnRow);
    wrap.appendChild(box);
  };

  seg.addEventListener('click', (e) => { const a = e.target.closest('a'); if (a) draw(a.dataset.v); });
  app.append(seg, wrap);
  draw(memoIds.length && !favIds.length ? 'memo' : savedTab);
});

/* ============ 모의고사 (예상문제 18문항 · 180분 · 60점) ============ */
const mockSeen = (q) => store.attemptCount(q.qid) > 0;   // 예상문제 풀이 이력 유무

// opts.pool: 'all' | 'unseen'(안 푼 문항 우선) | 'seen'(푼 문항만 · 복습)
function drawMock(opts = {}) {
  const { shuffleAll = false, pool = 'all' } = opts;
  // 이번 회차에 이미 뽑힌 문항의 태그 집합 — 비슷한 주제가 한 회차에 겹치지 않게
  const picked = [];
  const tooSimilar = (q) => {
    const tags = q.tags || [];
    if (tags.length < 2) return false;
    return picked.some((pt) => {
      let n = 0; for (const t of tags) if (pt.has(t)) n++;
      return n >= 2;   // 태그 2개 이상 공유 → 유사 주제
    });
  };
  const takeWeighted = (arr) => {
    const totW = arr.reduce((s, q) => s + (MOCK.domW[q.domain] || 5), 0);
    let r = Math.random() * totW, idx = 0;
    for (; idx < arr.length; idx++) { r -= (MOCK.domW[arr[idx].domain] || 5); if (r <= 0) break; }
    return arr.splice(Math.min(idx, arr.length - 1), 1)[0];
  };
  const pick = (list, k) => {
    const bag = shuffle(list.slice());
    const deferred = [];   // 유사하다고 미뤄둔 문항 (모자라면 여기서 채움)
    const chosen = [];
    while (chosen.length < k && (bag.length || deferred.length)) {
      const q = bag.length ? takeWeighted(bag) : takeWeighted(deferred);
      if (bag.length && tooSimilar(q)) { deferred.push(q); continue; }
      chosen.push(q.qid);
      picked.push(new Set(q.tags || []));
    }
    return chosen;
  };
  const ids = [];
  for (const [type, k] of Object.entries(MOCK.quota)) {
    let cand = PREDICTED.filter((q) => q.type === type);
    if (pool === 'seen') cand = cand.filter(mockSeen);
    else if (pool === 'unseen') {
      const fresh = cand.filter((q) => !mockSeen(q));
      // 안 푼 문항 우선, 유형별 정원에 못 미치면 푼 문항으로 채움
      cand = fresh.length >= k ? fresh : fresh.concat(shuffle(cand.filter(mockSeen)));
    }
    ids.push(...pick(cand, k));
  }
  return shuffleAll ? shuffle(ids) : ids; // 기본은 단답→서술→실무 순
}

route('mock', (app) => {
  app.appendChild(solveSeg('mock'));
  app.appendChild(el(`<h1>모의고사</h1>`));

  if (!PREDICTED.length) {
    app.appendChild(el(`<div class="empty">예상문제가 아직 없습니다.<br><span class="small"><code>예상문제/</code> 폴더 작성 후 <code>node scripts/build.mjs</code></span></div>`));
    return;
  }

  // 이어풀기 (진행 중 모의고사)
  if (SESSION && SESSION.kind === 'mock' && SESSION.qids && SESSION.qids.length) {
    const expd = sExpiresAt();
    const dead = expd && Date.now() >= expd;
    const rc = el(`<div class="card resume-card">
      <div><b>진행 중 모의고사</b> <span class="muted small">${SESSION.idx + 1}/${SESSION.qids.length}${expd ? ' · ' + (dead ? '시간 종료' : '남은 ' + fmtClock(expd - Date.now())) : ''}</span></div>
      <div class="row tight" style="margin-top:8px">
        <button class="btn primary sm" id="mkResume">${dead ? '결과 보기' : '이어서 →'}</button>
        <button class="btn sm" id="mkQuit">그만두고 제출</button>
      </div></div>`);
    $('#mkResume', rc).addEventListener('click', () => dead ? finishSession() : navigate('#/session'));
    $('#mkQuit', rc).addEventListener('click', finishSession);
    app.appendChild(rc);
  }

  const perType = {};
  PREDICTED.forEach((q) => (perType[q.type] = (perType[q.type] || 0) + 1));
  const short = Object.entries(MOCK.quota).filter(([t, k]) => (perType[t] || 0) < k)
    .map(([t, k]) => `${t} ${perType[t] || 0}/${k}`);
  const freshN = PREDICTED.filter((q) => !mockSeen(q)).length;
  const seenN = PREDICTED.length - freshN;

  const form = el(`<div class="card stack">
    <p class="small muted">${MOCK.total}문항(단답 12 · 서술 4 · 실무 2) · ${MOCK.durationMin}분 · ${MOCK.passScore}점 이상 합격</p>
    <p class="small muted">예상문제 ${PREDICTED.length}개에서 영역·유형 균형으로 매번 새로 출제합니다. 필답형이라 <b>자가채점</b>이며 실제 시험 점수와 다를 수 있습니다.</p>
    ${short.length ? `<p class="small" style="color:var(--bad)">⚠ 문제 부족: ${short.join(', ')} — 있는 만큼만 출제</p>` : ''}
    <label class="field"><span>출제 범위</span>
      <select id="mkPool">
        <option value="all">전체 예상문제 (${PREDICTED.length})</option>
        <option value="unseen">안 푼 문항 우선 (${freshN})</option>
        <option value="seen">푼 문항만 · 복습 (${seenN})</option>
      </select></label>
    <p class="small muted" id="mkPoolHint">한 번이라도 풀어 본 예상문제 ${seenN}개 · 아직 안 푼 예상문제 ${freshN}개</p>
    <label class="row" style="align-items:center;gap:6px;margin:0"><input type="checkbox" id="mkTimer" checked style="width:auto"><span class="small">타이머 (${MOCK.durationMin}분, 종료 시 자동 제출)</span></label>
    <label class="row" style="align-items:center;gap:6px;margin:0"><input type="checkbox" id="mkShuffle" style="width:auto"><span class="small">문항 순서 섞기 (유형 순서 무시)</span></label>
    <button class="btn primary wide" id="mkStart">모의고사 시작</button>
  </div>`);
  app.appendChild(form);

  const poolHints = {
    all: `한 번이라도 풀어 본 예상문제 ${seenN}개 · 아직 안 푼 예상문제 ${freshN}개`,
    unseen: `안 푼 문항을 먼저 출제하고, 유형별 정원(단답 12·서술 4·실무 2)에 모자라면 푼 문항으로 채웁니다.`,
    seen: seenN >= MOCK.total ? `이미 푼 예상문제 ${seenN}개 안에서만 복습 편성합니다.` : `⚠ 푼 예상문제가 ${seenN}개뿐이라 18문항을 못 채울 수 있습니다.`,
  };
  $('#mkPool', form).addEventListener('change', (e) => { $('#mkPoolHint', form).textContent = poolHints[e.target.value]; });

  $('#mkStart', form).addEventListener('click', () => {
    const pool = $('#mkPool', form).value;
    const ids = drawMock({ shuffleAll: $('#mkShuffle', form).checked, pool });
    if (!ids.length) { toast(pool === 'seen' ? '복습할(이미 푼) 예상문제가 없습니다' : '출제할 예상문제가 없습니다'); return; }
    const tag = pool === 'unseen' ? ' · 새 문항' : pool === 'seen' ? ' · 복습' : '';
    startSession(ids, `모의고사 ${ids.length}문항${tag}`, { kind: 'mock', durationMin: $('#mkTimer', form).checked ? MOCK.durationMin : 0 });
  });

  // 이력
  const hist = store.state.sessions.filter((s) => s.kind === 'mock').slice(0, 10);
  if (hist.length) {
    const box = el(`<div class="card"><h3>모의고사 이력 <span class="muted small">누르면 점수창</span></h3></div>`);
    hist.forEach((h) => {
      const openable = Array.isArray(h.qids) && h.qids.length;
      const row = el(`<div class="rank-item"${openable ? '' : ' style="cursor:default"'}>
        <span class="pill accent">${fmtDay(h.startedAt)}</span>
        <span class="small" style="flex:1">${h.score != null ? h.score + '점' : '-'}</span>
        <span class="small ${h.pass ? '' : 'rank-x'}">${h.pass ? '합격' : '불합격'}</span></div>`);
      if (openable) row.addEventListener('click', () => navigate('#/summary/' + encodeURIComponent(h.id)));
      box.appendChild(row);
    });
    const avg = Math.round(hist.reduce((s, h) => s + (h.score || 0), 0) / hist.length);
    box.appendChild(el(`<p class="small muted" style="margin-top:6px">최근 ${hist.length}회 평균 ${avg}점</p>`));
    app.appendChild(box);
  }
});

/* ============ 통계 ============ */
route('stats', (app) => {
  const s = computeStats();
  app.appendChild(el(`<h1>통계</h1>`));

  const roundsDone = DATA.rounds.filter((r) => s.perRound[r.round].done === r.total).length;
  app.appendChild(el(`
    <div class="stat-grid">
      <div class="card"><div class="big">${s.attemptsTotal}</div><div class="muted small">총 시도</div></div>
      <div class="card"><div class="big">${pct(s.doneTotal, QUESTIONS.length)}%</div><div class="muted small">진도 (${s.doneTotal}/${QUESTIONS.length})</div></div>
      <div class="card"><div class="big">${roundsDone}</div><div class="muted small">완주한 회차</div></div>
    </div>
  `));

  // 최근 14일
  const heat = el(`<div class="card"><h3>최근 14일 학습량</h3><div class="heat"></div></div>`);
  const hc = $('.heat', heat);
  const days = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(dayKey(d.getTime())); }
  const max = Math.max(1, ...days.map((d) => s.dayMap[d] || 0));
  days.forEach((d) => {
    const n = s.dayMap[d] || 0;
    hc.appendChild(el(`<i class="${n ? 'has' : ''}" style="height:${Math.max(3, (n / max) * 100)}%" title="${d}: ${n}"></i>`));
  });
  app.appendChild(heat);

  // 오답 랭킹
  const rank = el(`<div class="card"><h3>오답 랭킹</h3></div>`);
  if (!s.wrongRank.length) rank.appendChild(el(`<p class="muted small">아직 틀리거나 애매한 문항이 없습니다.</p>`));
  s.wrongRank.forEach(({ q, x, m }) => {
    const item = el(`<div class="rank-item">
      <span class="pill accent">${esc(qLabel(q))}</span>
      <span class="small muted" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(q.question.slice(0, 32))}</span>
      ${x ? `<span class="small rank-x">${x}회 틀림</span>` : ''}
      ${m ? `<span class="small muted">${m}회 애매</span>` : ''}
    </div>`);
    item.addEventListener('click', () => navigate('#/q/' + q.qid));
    rank.appendChild(item);
  });
  app.appendChild(rank);

  // 영역별
  app.appendChild(barBox('영역별 정답률', s.perDomain));
  app.appendChild(barBox('유형별 정답률', s.perType));

  // 회차별 (접기)
  const rbox = el(`<div class="card"><h3>회차별 정답률</h3></div>`);
  DATA.rounds.slice().reverse().forEach((r) => {
    const v = s.perRound[r.round];
    rbox.appendChild(el(`<div class="bar-row"><span class="bar-label">${r.round}회</span>${barTrack(v)}
      <span class="bar-num">${v.done}/${v.total}</span></div>`));
  });
  app.appendChild(rbox);

  // 예상문제 · 모의고사 (기출 통계와 별도)
  if (PREDICTED.length) {
    const predDone = PREDICTED.filter((q) => store.attemptCount(q.qid)).length;
    const predG = PREDICTED.map((q) => store.lastGrade(q.qid)).filter(Boolean);
    const predRate = predG.length ? pct(predG.filter((x) => x === 'o').length, predG.length) : 0;
    const mocks = store.state.sessions.filter((x) => x.kind === 'mock');
    const box = el(`<div class="card"><h3>예상문제 · 모의고사 <span class="muted small">기출 진도와 별도</span></h3>
      <div class="bar-row"><span class="bar-label">예상문제 학습</span><span class="bar-track"><i class="o" style="width:${pct(predDone, PREDICTED.length)}%"></i></span><span class="bar-num">${predDone}/${PREDICTED.length}</span></div>
      <div class="bar-row"><span class="bar-label">자가채점 정답률</span>${barTrack({ o: predG.filter((x) => x === 'o').length, m: predG.filter((x) => x === 'm').length, x: predG.filter((x) => x === 'x').length })}<span class="bar-num">${predG.length ? predRate + '%' : '–'}</span></div>
    </div>`);
    if (mocks.length) {
      const mb = el(`<div style="margin-top:6px"></div>`);
      mocks.slice(0, 10).reverse().forEach((m) => mb.appendChild(el(`<div class="bar-row"><span class="bar-label">${fmtDay(m.startedAt)}</span>${barTrack({ o: m.score || 0, m: 0, x: 100 - (m.score || 0) })}<span class="bar-num">${m.score != null ? m.score : '-'}${m.pass ? '' : ' ✗'}</span></div>`)));
      box.appendChild(el(`<p class="small muted" style="margin-top:8px">모의고사 총점 추이</p>`));
      box.appendChild(mb);
    }
    app.appendChild(box);
  }
});

function barBox(title, obj) {
  const box = el(`<div class="card"><h3>${esc(title)}</h3></div>`);
  Object.entries(obj).forEach(([k, v]) => {
    box.appendChild(el(`<div class="bar-row"><span class="bar-label">${esc(k)}</span>${barTrack(v)}
      <span class="bar-num">${v.done ? pct(v.o, v.done) + '%' : '–'}</span></div>`));
  });
  return box;
}

/* ============ 노트 목록 ============ */
let noteSort = 'default';   // 'default' | 'weak' | 'linked'
route('notes', (app, args) => {
  app.appendChild(el(`<h1>학습 노트</h1>`));
  if (!DATA.notes.length) {
    app.appendChild(el(`<div class="empty">아직 노트가 없습니다.<br><span class="small">저장소의 <code>notes/</code> 폴더에 마크다운 파일을 추가하고<br><code>node scripts/build.mjs</code> 를 실행하세요.</span></div>`));
    return;
  }

  const cats = [...new Set(DATA.notes.map((n) => n.category))];
  const catCount = (c) => DATA.notes.filter((n) => n.category === c).length;
  const allTags = [...new Set(DATA.notes.flatMap((n) => n.tags || []))].sort((a, b) => a.localeCompare(b, 'ko'));

  let curCat = '', curTag = '';
  if (args[0] === 'tag') curTag = decodeURIComponent(args.slice(1).join('/') || '');
  else if (args.length) curCat = decodeURIComponent(args.join('/'));
  if (curCat && !cats.includes(curCat)) curCat = '';
  if (curTag && !allTags.includes(curTag)) curTag = '';

  const controls = el(`<div class="card stack">
    <div class="chip-row" id="catRow">
      <button class="chip" data-cat="">전체 <span>${DATA.notes.length}</span></button>
      ${cats.map((c) => `<button class="chip" data-cat="${esc(c)}">${esc(c)} <span>${catCount(c)}</span></button>`).join('')}
    </div>
    <div class="row tight">
      <input type="text" id="nq" placeholder="제목·태그·본문 검색" style="flex:2;min-width:150px" autocomplete="off">
      <select id="ntag" style="flex:1;min-width:120px">
        <option value="">태그 전체</option>
        ${allTags.map((t) => `<option value="${esc(t)}">#${esc(t)}</option>`).join('')}
      </select>
      <select id="nsort" style="flex:1;min-width:110px">
        <option value="default">기본순</option>
        <option value="weak">취약한 순</option>
        <option value="linked">연결 많은 순</option>
      </select>
    </div>
  </div>`);
  app.appendChild(controls);
  const listWrap = el(`<div id="nlist"></div>`);
  app.appendChild(listWrap);

  const nq = $('#nq', controls);
  const ntag = $('#ntag', controls);
  const nsort = $('#nsort', controls);
  ntag.value = curTag;
  nsort.value = noteSort;

  function syncChips() {
    controls.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.cat === curCat));
  }
  function syncHash() {
    const t = curTag ? '#/notes/tag/' + encodeURIComponent(curTag)
      : curCat ? '#/notes/' + encodeURIComponent(curCat)
      : '#/notes';
    try { if (location.hash !== t) history.replaceState(null, '', t); } catch (e) { /* noop */ }
  }

  function draw() {
    const f = nq.value.trim().toLowerCase();
    const notes = DATA.notes.filter((n) => {
      if (curCat && n.category !== curCat) return false;
      if (curTag && !(n.tags || []).includes(curTag)) return false;
      if (f && !(
        n.title.toLowerCase().includes(f) ||
        (n.tags || []).some((t) => t.toLowerCase().includes(f)) ||
        n.md.toLowerCase().includes(f)
      )) return false;
      return true;
    });

    listWrap.innerHTML = '';
    const tags = [];
    if (curCat) tags.push(esc(curCat));
    if (curTag) tags.push('#' + esc(curTag));
    if (f) tags.push('"' + esc(nq.value.trim()) + '"');
    listWrap.appendChild(el(`<p class="small muted" style="margin:6px 2px">${notes.length}개 노트${tags.length ? ' · ' + tags.join(' · ') : ''}</p>`));
    if (curCat === '반복출제') listWrap.appendChild(el(`<p class="small muted" style="margin:0 2px 8px">여러 회차에 반복 출제된 유형. 각 노트에서 회차별 실제 문항·정답을 펼쳐 비교하고, 핵심 정답을 암기하세요.</p>`));
    if (noteSort === 'weak') listWrap.appendChild(el(`<p class="small muted" style="margin:0 2px 8px">가장 많이 틀리거나 아직 안 푼 문항이 많은 노트부터 표시합니다.</p>`));
    if (!notes.length) { listWrap.appendChild(el(`<p class="muted small">조건에 맞는 노트가 없습니다.</p>`)); return; }

    const prog = new Map(notes.map((n) => [n.slug, noteProgress(n)]));
    const noteEl = (n) => {
      const p = prog.get(n.slug);
      const qn = (n.questions || []).length, pn = (n.predicted || []).length;
      const linkTxt = p.total
        ? `연결 ${p.total}` + (qn && pn ? ` (기출 ${qn}·예상 ${pn})` : '')
        : '연결 없음';
      const progTxt = p.done
        ? ` · ${p.done}/${p.total} 풀이 · 정답 ${p.rate}%`
        : (p.total ? ' · 아직 안 품' : '');
      return el(`<a class="note-item" href="#/note/${encodeURIComponent(n.slug)}">
        <span class="note-item-title">${esc(n.title)}</span>
        <span class="note-item-meta">${(n.tags || []).slice(0, 5).map((t) => `<span class="pill">${esc(t)}</span>`).join(' ')}
          <span class="small muted">· ${linkTxt}${progTxt}</span>
          ${p.done ? `<span class="bar-track">
            <i class="o" style="width:${(p.v.o / p.total) * 100}%"></i>
            <i class="m" style="width:${(p.v.m / p.total) * 100}%"></i>
            <i class="x" style="width:${(p.v.x / p.total) * 100}%"></i></span>` : ''}
        </span>
      </a>`);
    };

    if (noteSort === 'weak' || noteSort === 'linked') {
      const sorted = notes.slice().sort(noteSort === 'weak'
        ? (a, b) => prog.get(b.slug).weak - prog.get(a.slug).weak || prog.get(b.slug).total - prog.get(a.slug).total
        : (a, b) => prog.get(b.slug).total - prog.get(a.slug).total || a.slug.localeCompare(b.slug, 'ko'));
      sorted.forEach((n) => listWrap.appendChild(noteEl(n)));
      return;
    }

    const byCat = {};
    notes.forEach((n) => (byCat[n.category] || (byCat[n.category] = [])).push(n));
    Object.entries(byCat).forEach(([cat, arr]) => {
      if (!curCat) listWrap.appendChild(el(`<div class="note-cat">${esc(cat)}</div>`));
      arr.forEach((n) => listWrap.appendChild(noteEl(n)));
    });
  }

  $('#catRow', controls).addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    curCat = btn.dataset.cat;
    syncChips(); syncHash(); draw();
  });
  ntag.addEventListener('change', () => { curTag = ntag.value; syncHash(); draw(); });
  nsort.addEventListener('change', () => { noteSort = nsort.value; draw(); });
  nq.addEventListener('input', draw);

  syncChips();
  draw();
});

/* ============ 노트 상세 ============ */
route('note', (app, args) => {
  const slug = decodeURIComponent(args.join('/'));
  const n = NOTE_BY_SLUG.get(slug);
  if (!n) { app.appendChild(el(`<div class="empty">노트를 찾을 수 없습니다.</div>`)); return; }
  app.appendChild(el(`<a class="btn sm" href="#/notes">← 노트 목록</a>`));
  app.appendChild(el(`<h1>${esc(n.title)}</h1>`));
  app.appendChild(el(`<div class="row tight" style="margin-bottom:8px">
    <a class="pill accent" href="#/notes/${encodeURIComponent(n.category)}">${esc(n.domain || n.category)}</a>
    ${(n.tags || []).map((t) => `<a class="pill" href="#/notes/tag/${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}</div>`));

  const prog = noteProgress(n);
  if (prog.total) {
    const card = el(`<div class="card stack" style="gap:8px">
      <div class="small muted">📊 연결 ${prog.total}문항 · ${prog.done ? `${prog.done} 풀이 · 정답 ${prog.rate}%` : '아직 안 품'}</div>
      ${prog.done ? `<span class="bar-track">
        <i class="o" style="width:${(prog.v.o / prog.total) * 100}%"></i>
        <i class="m" style="width:${(prog.v.m / prog.total) * 100}%"></i>
        <i class="x" style="width:${(prog.v.x / prog.total) * 100}%"></i></span>` : ''}
    </div>`);
    const weakIds = noteWeakIds(n);
    if (weakIds.length && weakIds.length < prog.total) {
      const b = el(`<button class="btn sm">약한 문항만 풀기 (${weakIds.length})</button>`);
      b.addEventListener('click', () => startSession(weakIds.slice(), `${n.title} 약한 문항 ${weakIds.length}`));
      card.appendChild(b);
    }
    app.appendChild(card);
  }

  const md = el(`<div class="card markdown"></div>`);
  md.innerHTML = window.marked ? window.marked.parse(n.md) : `<pre>${esc(n.md)}</pre>`;
  enhanceMarkdown(md);
  app.appendChild(md);

  const isRepeat = n.category === '반복출제';
  const qBox = (title, ids, lookup, label) => {
    if (!ids || !ids.length) return;
    const box = el(`<div class="card"><h3>${title} (${ids.length}) <span class="muted small">눌러서 답·해설</span></h3></div>`);
    let shown = 0;
    ids.forEach((qid) => {
      const q = lookup(qid); if (!q) return;
      box.appendChild(reviewItem(q, store.lastGrade(qid), { hideRepeatBadge: isRepeat }));
      shown++;
    });
    if (!shown) return;
    const btnRow = el(`<div class="row tight" style="margin-top:12px"></div>`);
    const expand = el(`<button class="btn sm">모두 펼치기</button>`);
    let allOpen = false;
    expand.addEventListener('click', () => {
      allOpen = !allOpen;
      box.querySelectorAll('details.q-review').forEach((x) => { x.open = allOpen; });
      expand.textContent = allOpen ? '모두 접기' : '모두 펼치기';
    });
    const all = el(`<button class="btn primary" style="flex:1">${label}</button>`);
    all.addEventListener('click', () => startSession(ids.filter((id) => lookup(id)), `${n.title} ${title} ${ids.length}문항`));
    btnRow.append(expand, all);
    box.appendChild(btnRow);
    app.appendChild(box);
  };
  qBox('연결된 기출 문항', n.questions, (id) => BY_QID.get(id), '연결 기출 모두 풀기');
  qBox('관련 예상문제', n.predicted, (id) => PQ_BY_ID.get(id), '이 노트 예상문제 풀기');

  if (n.related && n.related.length) {
    app.appendChild(el(`<div class="card"><h3>함께 보면 좋은 노트</h3>
      <div class="row tight">${n.related.map((r) => {
        const t = NOTE_BY_SLUG.get(r.slug); if (!t) return '';
        return `<a class="pill accent" href="#/note/${encodeURIComponent(r.slug)}">${
          t.category === '반복출제' ? '🔁 ' : '📎 '}${esc(t.title)}${
          r.shared ? ` <span class="muted">${r.shared}</span>` : ''}</a>`;
      }).join('')}</div></div>`));
  }
});

/* ============ 두음 (두문자 암기) ============ */
let mnBlind = false;   // 가리기(암기) 모드 — 모듈 스코프 기억, 해시 미반영

// 두음 문자열 → 타일. 공백은 그룹 구분(.mn-gap), 나머지는 글자당 한 타일.
function mnemoHeroHtml(dueum) {
  const groups = String(dueum || '').trim().split(/\s+/).filter(Boolean);
  return `<div class="mnemo-hero">${groups.map((g, gi) =>
    (gi ? '<span class="mn-gap"></span>' : '') +
    [...g].map((ch) => `<span class="mn-tile">${esc(ch)}</span>`).join('')
  ).join('')}</div>`;
}

const CIRCLED_NUM = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮'];

function mnemoCard(item) {
  const bodyHtml = item.list
    ? `<div class="mnemo-cnt small muted">뜻 ${item.list.length}개</div>
       <ol class="mnemo-list">${item.list.map((t, i) =>
         `<li><span class="mn-no">${CIRCLED_NUM[i] || (i + 1)}</span>${esc(t)}</li>`).join('')}</ol>`
    : `<div class="mnemo-formula">${esc(item.formula)}</div>`;

  const card = el(`<div class="mnemo-card card${mnBlind ? ' blind' : ''}">
    <div class="mn-head">
      <span class="mn-topic">${esc(item.topic)}</span>
      ${item.cat ? `<span class="pill">${esc(item.cat)}</span>` : ''}
    </div>
    ${mnemoHeroHtml(item.dueum)}
    <button class="btn sm mn-peek" hidden>뜻 보기 ▼</button>
    <div class="mnemo-body"${mnBlind ? ' hidden' : ''}>${bodyHtml}</div>
  </div>`);

  const body = $('.mnemo-body', card);
  const peek = $('.mn-peek', card);
  const setPeek = (show) => {
    body.hidden = !show;
    peek.textContent = show ? '뜻 접기 ▲' : '뜻 보기 ▼';
  };
  peek.hidden = !mnBlind;
  peek.addEventListener('click', (e) => { e.stopPropagation(); setPeek(body.hidden); });
  // 가리기 모드일 때 카드(두음 타일) 아무 곳이나 눌러도 공개
  card.addEventListener('click', (e) => {
    if (!card.classList.contains('blind')) return;
    if (e.target.closest('.mnemo-body') || e.target.closest('.mn-peek')) return;
    setPeek(body.hidden);
  });
  return card;
}

let mnCat = '';
route('mnemonics', (app, args) => {
  app.appendChild(el(`<h1>두음 암기</h1>`));
  if (!MNEMONICS.length) {
    app.appendChild(el(`<div class="empty">두음 데이터가 없습니다.<br><span class="small">저장소 루트의 <code>두음.json</code> 작성 후 <code>node scripts/build.mjs</code></span></div>`));
    return;
  }

  const cats = [...new Set(MNEMONICS.map((m) => m.cat).filter(Boolean))];
  const catCount = (c) => MNEMONICS.filter((m) => m.cat === c).length;
  mnCat = args.length ? decodeURIComponent(args.join('/')) : mnCat;
  if (mnCat && !cats.includes(mnCat)) mnCat = '';

  const controls = el(`<div class="card stack">
    <div class="chip-row" id="mnCatRow">
      <button class="chip" data-cat="">전체 <span>${MNEMONICS.length}</span></button>
      ${cats.map((c) => `<button class="chip" data-cat="${esc(c)}">${esc(c)} <span>${catCount(c)}</span></button>`).join('')}
    </div>
    <div class="row tight">
      <input type="text" id="mq" placeholder="항목·두음·뜻 검색" style="flex:2;min-width:150px" autocomplete="off">
      <button class="btn sm" id="mnBlind" style="flex:1;min-width:120px">${mnBlind ? '👁 뜻 보이기' : '🙈 가리고 암기'}</button>
    </div>
  </div>`);
  app.appendChild(controls);
  const listWrap = el(`<div id="mnlist"></div>`);
  app.appendChild(listWrap);

  const mq = $('#mq', controls);
  const catRow = $('#mnCatRow', controls);
  const blindBtn = $('#mnBlind', controls);

  function syncChips() {
    catRow.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.cat === mnCat));
  }
  function syncHash() {
    const t = mnCat ? '#/mnemonics/' + encodeURIComponent(mnCat) : '#/mnemonics';
    try { if (location.hash !== t) history.replaceState(null, '', t); } catch (e) { /* noop */ }
  }

  function draw() {
    const f = mq.value.trim().toLowerCase();
    const list = MNEMONICS.filter((m) => {
      if (mnCat && m.cat !== mnCat) return false;
      if (f) {
        const hay = `${m.topic} ${m.dueum} ${m.list ? m.list.join(' ') : m.formula}`.toLowerCase();
        if (!hay.includes(f)) return false;
      }
      return true;
    });
    listWrap.innerHTML = '';
    const tags = [];
    if (mnCat) tags.push(esc(mnCat));
    if (f) tags.push('"' + esc(mq.value.trim()) + '"');
    listWrap.appendChild(el(`<p class="small muted" style="margin:6px 2px">${list.length}항목${tags.length ? ' · ' + tags.join(' · ') : ''}${mnBlind ? ' · 🙈 가리기 모드 (두음 타일을 눌러 확인)' : ''}</p>`));
    if (!list.length) { listWrap.appendChild(el(`<p class="muted small">조건에 맞는 두음이 없습니다.</p>`)); return; }

    if (mnCat) {
      list.forEach((m) => listWrap.appendChild(mnemoCard(m)));
      return;
    }
    const byCat = {};
    list.forEach((m) => (byCat[m.cat || '기타'] || (byCat[m.cat || '기타'] = [])).push(m));
    Object.entries(byCat).forEach(([cat, arr]) => {
      listWrap.appendChild(el(`<div class="note-cat">${esc(cat)}</div>`));
      arr.forEach((m) => listWrap.appendChild(mnemoCard(m)));
    });
  }

  catRow.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    mnCat = btn.dataset.cat;
    syncChips(); syncHash(); draw();
  });
  mq.addEventListener('input', draw);
  blindBtn.addEventListener('click', () => {
    mnBlind = !mnBlind;
    blindBtn.textContent = mnBlind ? '👁 뜻 보이기' : '🙈 가리고 암기';
    draw();
  });

  syncChips();
  draw();
});

/* ============ 단일 문항 (#/q/<qid>) ============ */
route('q', (app, args) => {
  const q = anyQ(decodeURIComponent(args.join('/')));
  if (!q) { app.appendChild(el(`<div class="empty">문항을 찾을 수 없습니다.</div>`)); return; }

  const top = el(`<div class="row tight" style="margin-bottom:6px">
    <a class="btn sm" href="#/search">🔍 검색</a>
    ${SESSION && SESSION.qids && SESSION.qids.length ? `<a class="btn sm" href="#/session">풀던 세션으로 →</a>` : ''}
  </div>`);
  app.appendChild(top);
  app.appendChild(el(`<h1>${esc(qLabel(q))}</h1>`));
  app.appendChild(questionCard(q));

  // 이전/다음: 예상문제는 같은 영역, 기출은 같은 회차
  const pool = q.predicted
    ? PREDICTED.filter((x) => x.domain === q.domain).sort((a, b) => a.qid.localeCompare(b.qid))
    : QUESTIONS.filter((x) => x.round === q.round).sort((a, b) => a.no - b.no);
  const label = q.predicted ? `예상 ${q.domain}` : `${q.round}회`;
  const i = pool.findIndex((x) => x.qid === q.qid);
  const nav = el(`<div class="nav-row"></div>`);
  const prev = el(`<button class="btn">← ${esc(label)} 이전</button>`);
  prev.disabled = i <= 0;
  if (i > 0) prev.addEventListener('click', () => navigate('#/q/' + encodeURIComponent(pool[i - 1].qid)));
  const next = el(`<button class="btn">${esc(label)} 다음 →</button>`);
  next.disabled = i >= pool.length - 1;
  if (i < pool.length - 1) next.addEventListener('click', () => navigate('#/q/' + encodeURIComponent(pool[i + 1].qid)));
  nav.append(prev, next);
  app.appendChild(nav);

  const whole = el(`<button class="btn sm wide" style="margin-top:10px">${esc(label)} 전체 풀기 (${pool.length}문항) →</button>`);
  whole.addEventListener('click', () => startSession(pool.map((x) => x.qid), `${label} ${pool.length}문항`));
  app.appendChild(whole);
});

/* ============ 통합 검색 (#/search/<query>) ============ */
let SEARCH_INDEX = null;
function searchIndex() {
  if (SEARCH_INDEX) return SEARCH_INDEX;
  const qs = QUESTIONS.concat(PREDICTED).map((q) => ({
    q,
    full: `${qLabel(q)} ${q.type} ${q.domain} ${q.question} ${q.answer} ${q.explanation || ''} ${q.supplement || ''}`.toLowerCase(),
    shallow: `${qLabel(q)} ${q.type} ${q.domain} ${q.question}`.toLowerCase(),
  }));
  const ns = DATA.notes.map((n) => ({
    n,
    full: `${n.title} ${(n.tags || []).join(' ')} ${n.md}`.toLowerCase(),
  }));
  SEARCH_INDEX = { qs, ns };
  return SEARCH_INDEX;
}

function searchSnippet(text, toks) {
  const src = String(text).replace(/\s+/g, ' ');
  const low = src.toLowerCase();
  let pos = -1, hit = '';
  for (const t of toks) { const p = low.indexOf(t); if (p >= 0 && (pos < 0 || p < pos)) { pos = p; hit = t; } }
  let out, lead, tail;
  if (pos < 0) { out = src.slice(0, 90); lead = false; tail = src.length > 90; }
  else {
    const a = Math.max(0, pos - 40), b = Math.min(src.length, pos + hit.length + 50);
    out = src.slice(a, b); lead = a > 0; tail = b < src.length;
  }
  let html = esc(out);
  for (const t of toks) {
    if (!t) continue;
    const re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    html = html.replace(re, '<mark>$1</mark>');
  }
  return (lead ? '…' : '') + html + (tail ? '…' : '');
}

function searchField(q, toks) {
  const hasIn = (s) => s && toks.some((t) => String(s).toLowerCase().includes(t));
  if (hasIn(q.question)) return { label: '문제', text: q.question };
  if (hasIn(q.answer)) return { label: '정답', text: q.answer };
  if (hasIn(q.explanation)) return { label: '해설', text: q.explanation };
  if (hasIn(q.supplement)) return { label: '지문', text: q.supplement };
  return { label: '', text: q.question };
}

route('search', (app, args) => {
  const initial = args.length ? decodeURIComponent(args.join('/')) : '';
  app.appendChild(el(`<h1>검색</h1>`));
  const form = el(`<div class="card stack">
    <label class="field"><input type="text" id="sq" placeholder="문제·정답·해설·노트 전체 검색" value="${esc(initial)}" autocomplete="off"></label>
    <div class="row tight">
      <select id="sdom"><option value="">전체 영역</option>${DATA.domains.map((d) => `<option value="${esc(d)}">${esc(d)}</option>`).join('')}</select>
      <select id="stype"><option value="">전체 유형</option>${TYPES.map((t) => `<option value="${t}">${t}</option>`).join('')}</select>
    </div>
    <label class="row" style="align-items:center;gap:6px;margin:0">
      <input type="checkbox" id="sdeep" checked style="width:auto"><span class="small">정답·해설 본문까지 검색</span>
    </label>
  </div>`);
  app.appendChild(form);
  const out = el(`<div id="sout"></div>`);
  app.appendChild(out);

  const idx = searchIndex();
  const input = $('#sq', form);
  let timer = null;

  function run(pushUrl) {
    const raw = input.value.trim();
    if (pushUrl) {
      const target = raw ? '#/search/' + encodeURIComponent(raw) : '#/search';
      try { if (location.hash !== target) history.replaceState(null, '', target); } catch (e) { /* noop */ }
    }
    const toks = raw.toLowerCase().split(/\s+/).filter(Boolean);
    out.innerHTML = '';
    if (!toks.length) { out.appendChild(el(`<p class="muted small" style="padding:8px 2px">검색어를 입력하세요.</p>`)); return; }

    const dom = $('#sdom', form).value;
    const typ = $('#stype', form).value;
    const deep = $('#sdeep', form).checked;

    const qhits = idx.qs.filter(({ q, full, shallow }) => {
      if (dom && q.domain !== dom) return false;
      if (typ && q.type !== typ) return false;
      const hay = deep ? full : shallow;
      return toks.every((t) => hay.includes(t));
    });
    const nhits = idx.ns.filter(({ full }) => toks.every((t) => full.includes(t)));

    const qbox = el(`<div class="card"><h3>문항 (${qhits.length})</h3></div>`);
    if (!qhits.length) qbox.appendChild(el(`<p class="muted small">일치하는 문항 없음</p>`));
    qhits.slice(0, 60).forEach(({ q }) => {
      const mf = searchField(q, toks);
      const item = el(`<div class="rank-item" style="display:block">
        <div><span class="pill accent">${esc(qLabel(q))}</span> <span class="pill">${esc(q.type)}</span> <span class="pill">${esc(q.domain)}</span>${mf.label ? ` <span class="pill">${mf.label}</span>` : ''}</div>
        <div class="small" style="margin-top:4px;line-height:1.5">${searchSnippet(mf.text, toks)}</div>
      </div>`);
      item.addEventListener('click', () => navigate('#/q/' + encodeURIComponent(q.qid)));
      qbox.appendChild(item);
    });
    if (qhits.length > 60) qbox.appendChild(el(`<p class="muted small">상위 60개만 표시</p>`));
    if (qhits.length) {
      const b = el(`<button class="btn primary wide sm" style="margin-top:10px">이 결과 ${qhits.length}문항 풀기</button>`);
      b.addEventListener('click', () => startSession(qhits.map((h) => h.q.qid), ('검색: ' + raw).slice(0, 40)));
      qbox.appendChild(b);
    }
    out.appendChild(qbox);

    const nbox = el(`<div class="card"><h3>노트 (${nhits.length})</h3></div>`);
    if (!nhits.length) nbox.appendChild(el(`<p class="muted small">일치하는 노트 없음</p>`));
    nhits.forEach(({ n }) => {
      const item = el(`<a class="note-item" href="#/note/${encodeURIComponent(n.slug)}">
        ${esc(n.title)} ${(n.tags || []).map((t) => `<span class="pill">${esc(t)}</span>`).join(' ')}
        <span class="small muted"> · ${esc(n.category)} · 연결 ${n.questions.length}</span></a>`);
      nbox.appendChild(item);
    });
    out.appendChild(nbox);
  }

  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => run(true), 180); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { clearTimeout(timer); run(true); } });
  $('#sdom', form).addEventListener('change', () => run(true));
  $('#stype', form).addEventListener('change', () => run(true));
  $('#sdeep', form).addEventListener('change', () => run(true));
  run(false);
  if (!initial) setTimeout(() => { try { input.focus(); } catch (e) { /* noop */ } }, 0);
});

/* ============ 더보기 ============ */
route('more', (app) => {
  app.appendChild(el(`<h1>더보기</h1>`));

  // 바로가기 메뉴
  const memoN = Object.values(store.state.results).filter((r) => r.memo).length;
  app.appendChild(el(`<div class="card" style="padding:2px 12px">
    <a class="menu-row" href="#/notes">📓 학습 노트 <span class="muted">${DATA.notes.length}</span></a>
    <a class="menu-row" href="#/mnemonics">📿 두음 암기 <span class="muted">${MNEMONICS.length}</span></a>
    <a class="menu-row" href="#/saved">⭐ 즐겨찾기 · 💭 메모 <span class="muted">${store.state.favorites.length} · ${memoN}</span></a>
    <a class="menu-row" href="#/history">🕐 지난 풀이 기록 <span class="muted">${store.state.sessions.length}회</span></a>
    <a class="menu-row" href="#/stats">📊 통계</a>
  </div>`));

  // 설정
  const set = store.state.settings;
  const setBox = el(`<div class="card stack"><h3>설정</h3>
    <label class="row" style="align-items:center;justify-content:space-between">
      <span>정답 항상 펼치기 (회독용)</span>
      <input type="checkbox" id="showAns" ${set.alwaysShowAnswer ? 'checked' : ''} style="width:auto">
    </label>
    <label class="field"><span>테마</span>
      <select id="theme">
        <option value="auto" ${set.theme === 'auto' ? 'selected' : ''}>시스템 설정</option>
        <option value="light" ${set.theme === 'light' ? 'selected' : ''}>라이트</option>
        <option value="dark" ${set.theme === 'dark' ? 'selected' : ''}>다크</option>
      </select></label>
    <label class="field"><span>시험일 (D-day · 하루 권장 페이스)</span>
      <input type="date" id="examDate" value="${esc(set.examDate || '')}"></label>
  </div>`);
  $('#showAns', setBox).addEventListener('change', (e) => { set.alwaysShowAnswer = e.target.checked; store.save(); });
  $('#theme', setBox).addEventListener('change', (e) => { set.theme = e.target.value; store.save(); applyTheme(); });
  $('#examDate', setBox).addEventListener('change', (e) => { set.examDate = e.target.value; store.save(); });

  if (window.matchMedia && window.matchMedia('(min-width: 900px)').matches) {
    app.appendChild(el(`<div class="card"><h3>키보드 단축키 <span class="muted small">PC</span></h3>
      <div class="small muted" style="line-height:1.9">
        <code>1</code> <code>2</code> <code>3</code> 채점(맞음·애매·틀림) / 객관식 보기 ·
        <code>←</code> <code>→</code> 이전·다음 문항 ·
        <code>Space</code> 정답 펼치기 ·
        <code>f</code> 즐겨찾기 ·
        <code>/</code> 검색 ·
        <code>?</code> 이 목록
      </div></div>`));
  }
  app.appendChild(setBox);

  // 서버 동기화 (선택)
  const syncBox = el(`<div class="card stack"><h3>서버 동기화 <span class="muted small">선택</span></h3>
    <p class="small muted">로그인하면 학습 기록이 서버에 저장되어 다른 기기·브라우저에서도 이어집니다. 로그인하지 않으면 지금처럼 이 브라우저에만 저장됩니다. 오프라인일 땐 로컬로 동작하다가 온라인이 되면 자동 동기화됩니다.</p>
    <div id="syncState" class="small" style="font-weight:600"></div>
    ${SYNC.on ? `
      <div class="small muted">서버: ${esc(SYNC.cfg.url)}</div>
      <div class="row tight">
        <button class="btn sm" id="syncNow">지금 동기화</button>
        <button class="btn sm" id="syncOut" style="color:var(--bad)">로그아웃</button>
      </div>` : `
      <label class="field"><span>서버 주소</span>
        <input type="text" id="syncUrl" placeholder="https://….workers.dev" autocomplete="off" value="${esc(SYNC.cfg.url || '')}"></label>
      <label class="field"><span>암호</span>
        <input type="password" id="syncPass" autocomplete="current-password"></label>
      <button class="btn primary sm" id="syncIn">로그인</button>
      <p class="small muted">서버는 <code>server/</code> 폴더의 안내대로 한 번만 배포하면 됩니다.</p>`}
  </div>`);
  app.appendChild(syncBox);
  updateSyncUI();
  if (SYNC.on) {
    $('#syncNow', syncBox).addEventListener('click', async () => { toast('동기화 중…'); await SYNC.pull(); toast('동기화 완료'); });
    $('#syncOut', syncBox).addEventListener('click', () => { if (confirm('로그아웃합니다. 이 기기의 학습 기록은 그대로 남습니다.')) { SYNC.logout(); toast('로그아웃됨'); render(); } });
  } else {
    $('#syncIn', syncBox).addEventListener('click', async () => {
      const btn = $('#syncIn', syncBox); const url = $('#syncUrl', syncBox).value; const pass = $('#syncPass', syncBox).value;
      if (!url || !pass) { toast('서버 주소와 암호를 입력하세요'); return; }
      btn.disabled = true; btn.textContent = '로그인 중…';
      try { await SYNC.login(url, pass); toast('로그인·동기화 완료'); render(); }
      catch (e) { toast(e.message || '로그인 실패'); btn.disabled = false; btn.textContent = '로그인'; }
    });
  }

  // 데이터 관리
  const dataBox = el(`<div class="card stack"><h3>데이터 (파일로 이동)</h3>
    <p class="small muted">${SYNC.on ? '서버 동기화와 별개로,' : ''} 학습 기록을 파일로 내보내거나 다른 기기에서 만든 파일을 가져올 수 있습니다.</p>
    <div class="row">
      <button class="btn sm" id="exp">내보내기 (JSON)</button>
      <button class="btn sm" id="imp">가져오기</button>
      <button class="btn sm" id="rst" style="color:var(--bad)">전체 초기화</button>
    </div>
    <input type="file" id="impFile" accept="application/json" hidden>
  </div>`);
  $('#exp', dataBox).addEventListener('click', exportData);
  $('#imp', dataBox).addEventListener('click', () => $('#impFile', dataBox).click());
  $('#impFile', dataBox).addEventListener('change', importData);
  $('#rst', dataBox).addEventListener('click', () => {
    if (confirm(`모든 학습 기록·즐겨찾기·메모를 삭제합니다.${SYNC.on ? ' 서버에 저장된 기록도 함께 초기화됩니다.' : ''} 계속할까요?`)) { store.reset(); SESSION = null; CSESSION = null; toast('초기화됨'); render(); }
  });
  app.appendChild(dataBox);

  app.appendChild(el(`<p class="small muted center" style="margin-top:20px">데이터 ${DATA.builtAt.slice(0, 10)}</p>`));
});

function exportData() {
  const blob = new Blob([JSON.stringify(store.state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `infosec-실기-기록-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (typeof parsed !== 'object' || !parsed.results) throw new Error('형식 오류');
      if (!confirm('현재 기록을 가져온 파일로 덮어씁니다. 계속할까요?')) return;
      store.state = Object.assign(DEFAULT_STATE(), parsed);
      store.state.settings = Object.assign(DEFAULT_STATE().settings, parsed.settings || {});
      store.state.cppg = Object.assign(DEFAULT_STATE().cppg, parsed.cppg || {});
      SESSION = (store.state.session && Array.isArray(store.state.session.qids) && store.state.session.qids.length) ? store.state.session : null;
      store.state.session = SESSION;
      CSESSION = (store.state.cppg.session && Array.isArray(store.state.cppg.session.ids) && store.state.cppg.session.ids.length) ? store.state.cppg.session : null;
      store.state.cppg.session = CSESSION;
      store.save(); applyTheme(); toast('가져오기 완료'); render();
    } catch (err) { toast('가져오기 실패: ' + err.message); }
  };
  reader.readAsText(file);
}

/* ==================================================================
   CPPG (개인정보관리사) 트랙 — 5지선다 객관식 · 자동채점 · 모의고사
   ================================================================== */
/* cppg.js 는 지연 로드된다 (index.html 에 <script> 없음). route('cppg') 관문이 ensureCppg() 를
   기다렸다가 initCppg() 로 아래 바인딩을 채운 뒤에야 CPPG 화면을 그린다. sw.js SHELL 은 유지 —
   서비스워커가 백그라운드로 미리 받아두므로 오프라인·2회차부터는 캐시 히트. */
let CPPG = window.CPPG_DATA || null;
let CQ = CPPG ? CPPG.quiz : [];
let CQ_BY_ID = new Map(CQ.map((q) => [q.id, q]));
let CSUBJ = CPPG ? CPPG.subjects : [];
let CSUBJ_BY_ID = new Map(CSUBJ.map((s) => [s.id, s]));
let CNOTE_BY_SLUG = new Map(CPPG ? CPPG.notes.map((n) => [n.slug, n]) : []);
let CCFG = (CPPG && CPPG.config) || { passTotal: 60, passPerSubjectPct: 40, durationMin: 120, totalQuestions: 100 };
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

function initCppg() {
  CPPG = window.CPPG_DATA || null;
  if (!CPPG) return false;
  CQ = CPPG.quiz || [];
  CQ_BY_ID = new Map(CQ.map((q) => [q.id, q]));
  CSUBJ = CPPG.subjects || [];
  CSUBJ_BY_ID = new Map(CSUBJ.map((s) => [s.id, s]));
  CNOTE_BY_SLUG = new Map((CPPG.notes || []).map((n) => [n.slug, n]));
  CCFG = CPPG.config || CCFG;
  return true;
}

let _cppgPromise = null;
function ensureCppg() {
  if (CPPG) return Promise.resolve(true);
  if (_cppgPromise) return _cppgPromise;
  _cppgPromise = new Promise((resolve) => {
    const sc = document.createElement('script');
    sc.src = 'data/cppg.js';
    sc.onload = () => resolve(initCppg());
    sc.onerror = () => { _cppgPromise = null; resolve(false); };
    document.head.appendChild(sc);
  });
  return _cppgPromise;
}
const subjNo = (sid) => { const s = CSUBJ_BY_ID.get(sid); return s ? s.no + '과목' : sid; };
const subjName = (sid) => { const s = CSUBJ_BY_ID.get(sid); return s ? s.name : sid; };

const cstore = {
  s() { return store.state.cppg; },
  result(id) { const r = this.s().results; return r[id] || (r[id] = { attempts: [], memo: '' }); },
  answer(id, pick, since) {
    const it = CQ_BY_ID.get(id);
    const ok = it ? pick === it.answer : false;
    const a = this.result(id).attempts;
    if (a.length && a[a.length - 1].t >= since) a[a.length - 1] = { t: Date.now(), pick, ok };
    else a.push({ t: Date.now(), pick, ok });
    store.save();
    return ok;
  },
  lastAnswerSince(id, since) {
    const a = this.s().results[id] && this.s().results[id].attempts;
    if (!a) return null;
    for (let i = a.length - 1; i >= 0; i--) if (a[i].t >= since) return a[i];
    return null;
  },
  lastAttempt(id) {
    const a = this.s().results[id] && this.s().results[id].attempts;
    return a && a.length ? a[a.length - 1] : null;
  },
  attemptCount(id) { const r = this.s().results[id]; return r ? r.attempts.length : 0; },
  wrongCount(id) { const r = this.s().results[id]; return r ? r.attempts.filter((x) => !x.ok).length : 0; },
  setMemo(id, m) { this.result(id).memo = m; store.save(); },
  isFav(id) { return this.s().favorites.includes(id); },
  toggleFav(id) { const f = this.s().favorites; const i = f.indexOf(id); if (i >= 0) f.splice(i, 1); else f.unshift(id); store.save(); },
  addSession(x) { this.s().sessions.unshift(x); if (this.s().sessions.length > 50) this.s().sessions.length = 50; store.save(); },
};

/* ---- 객관식 카드 ---- */
function cppgCard(item, opts = {}) {
  const sinceTs = opts.sessionStart || Date.now();
  const reveal = opts.reveal !== false;
  const card = el('<div class="card q-card"></div>');
  const note = item.note ? CNOTE_BY_SLUG.get(item.note) : null;
  const priorN = cstore.attemptCount(item.id);
  const prior = cstore.lastAttempt(item.id);
  const histHtml = priorN
    ? `<div class="grade-hist small">지난 풀이 ${prior && prior.ok ? '⭕' : '❌'} <b>${prior && prior.ok ? '정답' : '오답'}</b> · ${priorN}회</div>`
    : '';

  card.innerHTML = `
    <div class="q-head">
      <span class="pill accent">${esc(subjNo(item.subject))}</span>
      ${(item.tags || []).slice(0, 2).map((t) => `<span class="pill">${esc(t)}</span>`).join('')}
      ${item.difficulty ? `<span class="pill">난이도 ${'★'.repeat(item.difficulty)}</span>` : ''}
      <button class="star ${cstore.isFav(item.id) ? 'on' : ''}" aria-label="즐겨찾기">${cstore.isFav(item.id) ? '★' : '☆'}</button>
    </div>
    <div class="q-body">${esc(item.stem)}</div>
    <div class="choice-list"></div>
    <div class="verdict-slot"></div>
  `;

  const star = $('.star', card);
  star.addEventListener('click', () => {
    cstore.toggleFav(item.id);
    const on = cstore.isFav(item.id);
    star.classList.toggle('on', on); star.textContent = on ? '★' : '☆';
  });

  const list = $('.choice-list', card);
  const vslot = $('.verdict-slot', card);
  let picked = null;

  function paint() {
    [...list.children].forEach((b, i) => {
      const n = i + 1;
      b.className = 'choice';
      if (picked === n) b.classList.add('picked');
      if (reveal && picked != null) {
        if (n === item.answer) b.classList.add('correct');
        else if (picked === n) b.classList.add('wrong');
      }
      b.disabled = reveal && picked != null;
    });
  }
  function renderVerdict() {
    vslot.innerHTML = '';
    if (picked == null) { if (histHtml) vslot.appendChild(el(histHtml)); return; }
    if (!reveal) return;
    const ok = picked === item.answer;
    vslot.appendChild(el(`<div class="verdict ${ok ? 'ok' : 'bad'}">${ok ? '⭕ 정답' : '❌ 오답 · 정답 ' + CIRCLED[item.answer - 1]}</div>`));
    if (item.explain) {
      const ex = el(`<div class="expl"><b>💡 해설</b><div class="expl-body markdown">${window.marked ? window.marked.parse(item.explain) : esc(item.explain)}</div></div>`);
      vslot.appendChild(ex); enhanceMarkdown(ex);
    }
    if (note) vslot.appendChild(el(`<div class="note-links"><a href="#/cppg/note/${encodeURIComponent(note.slug)}">📎 ${esc(note.title)}</a></div>`));
    if (histHtml) vslot.appendChild(el(histHtml));
  }

  item.choices.forEach((c, i) => {
    const b = el(`<button class="choice"><span class="cnum">${CIRCLED[i] || (i + 1)}</span><span class="ctext">${esc(c)}</span></button>`);
    b.addEventListener('click', () => {
      picked = i + 1;
      cstore.answer(item.id, picked, sinceTs);
      paint(); renderVerdict();
      if (opts.onAnswer) opts.onAnswer(picked, picked === item.answer);
    });
    list.appendChild(b);
  });

  const cur = cstore.lastAnswerSince(item.id, sinceTs);
  if (cur) picked = cur.pick;
  paint(); renderVerdict();
  return card;
}

/* ---- 세션 ---- */
let CSESSION = null;
let CTIMER = null;
function csave() { store.state.cppg.session = CSESSION; store.save(); }
function cExpiresAt() { return CSESSION && CSESSION.durationMin ? CSESSION.startedAt + CSESSION.durationMin * 60000 : null; }
function fmtClock(ms) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
// 로컬 시간 기준 날짜/상대시간 (toISOString 은 UTC 라 밤 시간대에 하루 어긋남)
function fmtDay(ts) {
  const d = new Date(ts), p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}
function fmtWhen(ts) {
  const d = new Date(ts), diff = Date.now() - ts, p = (n) => String(n).padStart(2, '0');
  if (diff < 60000) return '방금 전';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (ts >= today.getTime()) return `오늘 ${p(d.getHours())}:${p(d.getMinutes())}`;
  if (ts >= today.getTime() - 86400000) return `어제 ${p(d.getHours())}:${p(d.getMinutes())}`;
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}
function cStart(ids, label, opts = {}) {
  if (!ids.length) { toast('해당 조건의 문제가 없습니다'); return; }
  if (CSESSION && CSESSION.ids && CSESSION.ids.length) {
    if (!confirm('진행 중인 CPPG 세션이 있습니다. 새로 시작하면 현재 진행이 사라집니다. 계속할까요?')) return;
  }
  CSESSION = {
    ids, label, idx: 0, startedAt: Date.now(),
    kind: opts.kind || 'practice', reveal: opts.reveal !== false,
  };
  if (opts.durationMin) CSESSION.durationMin = opts.durationMin;
  csave();
  navigate('#/cppg/run');
}
function cCell(id, since, kind) {
  const a = cstore.lastAnswerSince(id, since);
  if (!a) return 'g-none';
  if (kind === 'mock') return 'g-picked';
  return a.ok ? 'g-ok' : 'g-bad';
}
function cFinish() {
  if (!CSESSION) { navigate('#/cppg'); return; }
  clearInterval(CTIMER); CTIMER = null;
  const since = CSESSION.startedAt;
  const ids = CSESSION.ids.slice();
  const kind = CSESSION.kind;
  const label = CSESSION.label;
  let correct = 0, answered = 0;
  const per = {};
  ids.forEach((id) => {
    const it = CQ_BY_ID.get(id); if (!it) return;
    const p = per[it.subject] || (per[it.subject] = { o: 0, n: 0 });
    p.n++;
    const a = cstore.lastAnswerSince(id, since);
    if (a) { answered++; if (a.ok) { correct++; p.o++; } }
  });
  const summary = { kind, label, ids, startedAt: since, endedAt: Date.now(), total: ids.length, answered, correct, per };
  store.state.cppg.lastSummary = summary;
  const { ids: _omit, ...lean } = summary;
  cstore.addSession({ id: since, ...lean });
  CSESSION = null; store.state.cppg.session = null; store.save();
  navigate('#/cppg/result');
}
function cPass(summary) {
  const totalPct = summary.total ? (summary.correct / summary.total) * 100 : 0;
  const failed = [];
  CSUBJ.forEach((s) => {
    const p = summary.per[s.id];
    if (!p || !p.n) return;
    if ((p.o / p.n) * 100 < CCFG.passPerSubjectPct) failed.push(s);
  });
  return { pass: summary.correct >= CCFG.passTotal && failed.length === 0, totalPct, failed };
}

/* ---- 라우트 ---- */
const CPPG_ROUTES = {};
function cRoute(name, fn) { CPPG_ROUTES[name] = fn; }

route('cppg', (app, args) => {
  clearInterval(CTIMER); CTIMER = null;
  app.appendChild(trackSwitch('cppg'));
  if (!CPPG) {
    if (window.CPPG_DATA) initCppg();   // 스크립트는 이미 있는데 init 전인 경우
  }
  if (!CPPG) {
    app.appendChild(el('<div class="card"><p class="muted">CPPG 데이터를 불러오는 중…</p></div>'));
    ensureCppg().then((ok) => {
      if (ok) render();
      else app.replaceChildren(trackSwitch('cppg'),
        el('<div class="empty">CPPG 데이터를 불러오지 못했습니다.<br><span class="small">새로고침하거나 네트워크를 확인해 주세요.</span></div>'));
    });
    return;
  }
  const sub = args[0] || 'home';
  (CPPG_ROUTES[sub] || CPPG_ROUTES.home)(app, args.slice(1));
});

cRoute('home', (app) => {
  app.appendChild(el('<h1>CPPG 개인정보관리사</h1>'));

  // 이어풀기
  if (CSESSION && CSESSION.ids && CSESSION.ids.length) {
    const expd = cExpiresAt();
    const dead = expd && Date.now() >= expd;
    const rc = el(`<div class="card resume-card">
      <div><b>${CSESSION.kind === 'mock' ? '모의고사' : '이어풀기'}</b> <span class="muted small">${esc(CSESSION.label)} · ${CSESSION.idx + 1}/${CSESSION.ids.length}${expd ? ' · ' + (dead ? '시간 종료' : '남은 ' + fmtClock(expd - Date.now())) : ''}</span></div>
      <div class="row tight" style="margin-top:8px">
        <button class="btn primary sm" id="cResume">${dead ? '결과 보기' : '이어서 →'}</button>
        <button class="btn sm" id="cQuit">그만두고 제출</button>
      </div></div>`);
    $('#cResume', rc).addEventListener('click', () => dead ? cFinish() : navigate('#/cppg/run'));
    $('#cQuit', rc).addEventListener('click', cFinish);
    app.appendChild(rc);
  }

  const st = store.state.cppg;
  const done = Object.keys(st.results).filter((id) => CQ_BY_ID.has(id) && st.results[id].attempts.length).length;
  const graded = CQ.map((q) => cstore.lastAttempt(q.id)).filter(Boolean);
  const rate = graded.length ? pct(graded.filter((a) => a.ok).length, graded.length) : 0;
  const cDayMap = {};
  Object.values(st.results).forEach((r) => r.attempts.forEach((a) => { const k = dayKey(a.t); cDayMap[k] = (cDayMap[k] || 0) + 1; }));
  const cPaceCard = examPaceCard(store.state.settings.cppgExamDate, {
    unsolved: CQ.length - done, todayCount: cDayMap[dayKey()] || 0, streak: streakDays(cDayMap),
  });
  if (cPaceCard) app.appendChild(cPaceCard);

  app.appendChild(el(`<div class="stat-grid">
    <div class="card"><div class="big">${done}<span class="muted" style="font-size:1rem">/${CQ.length}</span></div><div class="muted small">푼 문제</div></div>
    <div class="card"><div class="big">${rate}%</div><div class="muted small">정답률</div></div>
    <div class="card"><div class="big">${st.sessions.filter((s) => s.kind === 'mock').length}</div><div class="muted small">모의고사</div></div>
  </div>`));

  app.appendChild(el(`<div class="row" style="margin-top:14px">
    <a class="btn primary" href="#/cppg/quiz">문제 풀기 →</a>
    <a class="btn" href="#/cppg/mock">모의고사</a>
  </div>`));

  // 약점 과목
  const per = {};
  CQ.forEach((q) => { const a = cstore.lastAttempt(q.id); if (!a) return; const p = per[q.subject] || (per[q.subject] = { o: 0, n: 0 }); p.n++; if (a.ok) p.o++; });
  const weak = CSUBJ.map((s) => ({ s, p: per[s.id] })).filter((x) => x.p && x.p.n >= 3)
    .sort((a, b) => (a.p.o / a.p.n) - (b.p.o / b.p.n)).slice(0, 3);
  if (weak.length) {
    const box = el('<div class="card"><h3>약점 과목</h3></div>');
    weak.forEach(({ s, p }) => box.appendChild(el(
      `<div class="bar-row"><span class="bar-label">${esc(s.no + '. ' + s.name)}</span>${barTrack({ o: p.o, m: 0, x: p.n - p.o })}<span class="bar-num">${pct(p.o, p.n)}%</span></div>`)));
    app.appendChild(box);
  }

  const lastMock = store.state.cppg.sessions.find((s) => s.kind === 'mock');
  if (lastMock) {
    const pr = cPass(lastMock);
    app.appendChild(el(`<div class="card"><h3>최근 모의고사</h3>
      <div class="pass-line ${pr.pass ? 'ok' : 'bad'}">${lastMock.correct} / ${lastMock.total}점 · ${pr.pass ? '✅ 합격' : '❌ 불합격'}</div>
      <div class="small muted">${fmtWhen(lastMock.startedAt)}${pr.failed.length ? ' · 과락 ' + pr.failed.map((s) => s.no + '과목').join(', ') : ''}</div>
    </div>`));
  }

  app.appendChild(el(`<p class="small muted center" style="margin-top:24px">데이터 생성 ${CPPG.builtAt.slice(0, 10)} · 문제 ${CQ.length} · 노트 ${CPPG.notes.length}</p>`));
});

cRoute('quiz', (app) => {
  app.appendChild(el('<h1>CPPG 문제 풀기</h1>'));
  const allTags = [...new Set(CQ.flatMap((q) => q.tags || []))].sort((a, b) => a.localeCompare(b, 'ko'));
  const form = el(`<div class="card stack">
    <label class="field"><span>범위</span>
      <select id="cscope">
        <option value="subject">과목별</option>
        <option value="note">노트별</option>
        <option value="tag">태그별</option>
        <option value="wrong">틀린 문제만</option>
        <option value="fav">즐겨찾기만</option>
        <option value="unseen">안 푼 문제</option>
        <option value="random">랜덤</option>
      </select></label>
    <div id="csub"></div>
    <label class="field"><span>정렬</span>
      <select id="corder"><option value="seq">순서대로</option><option value="shuffle">무작위</option></select></label>
    <label class="field"><span>문항 수 (0 = 전체)</span>
      <input type="number" id="climit" value="20" min="0" max="${CQ.length}"></label>
    <label class="row" style="align-items:center;gap:6px;margin:0">
      <input type="checkbox" id="creveal" checked style="width:auto"><span class="small">답 고르면 바로 정답·해설 공개</span>
    </label>
    <button class="btn primary wide" id="cstart">시작</button>
  </div>`);
  app.appendChild(form);
  const scope = $('#cscope', form), csub = $('#csub', form);
  const unseenN = (arr) => arr.reduce((n, q) => n + (cstore.attemptCount(q.id) ? 0 : 1), 0);
  // 현재 하위선택(과목/노트/태그)에 해당하는 문제 목록
  function subList(v, p) {
    if (v === 'subject') return CQ.filter((q) => q.subject === p);
    if (v === 'note') { const n = CNOTE_BY_SLUG.get(p); return (n ? n.quiz : []).map((id) => CQ_BY_ID.get(id)).filter(Boolean); }
    if (v === 'tag') return CQ.filter((q) => (q.tags || []).includes(p));
    return [];
  }
  function drawSub() {
    csub.innerHTML = '';
    if (scope.value === 'subject') {
      csub.appendChild(el(`<label class="field"><span>과목</span><select id="cp">${CSUBJ.map((s) => {
        const all = CQ.filter((q) => q.subject === s.id);
        return `<option value="${s.id}">${s.no}. ${esc(s.name)} (안 푼 ${unseenN(all)}/${all.length})</option>`;
      }).join('')}</select></label>`));
    } else if (scope.value === 'note') {
      const notes = CPPG.notes.filter((n) => n.quiz.length);
      csub.appendChild(el(`<label class="field"><span>노트</span><select id="cp">${notes.map((n) => {
        const all = n.quiz.map((id) => CQ_BY_ID.get(id)).filter(Boolean);
        return `<option value="${esc(n.slug)}">${esc(n.title)} (안 푼 ${unseenN(all)}/${n.quiz.length})</option>`;
      }).join('')}</select></label>`));
    } else if (scope.value === 'tag') {
      csub.appendChild(el(`<label class="field"><span>태그</span><select id="cp">${allTags.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select></label>`));
    }
    if (['subject', 'note', 'tag'].includes(scope.value)) {
      csub.appendChild(el(`<label class="row" style="align-items:center;gap:6px;margin:0">
        <input type="checkbox" id="conlyunseen" style="width:auto"><span class="small">안 푼 문제만</span>
        <span class="small muted" id="cunseenhint" style="margin-left:auto"></span></label>`));
      const cp = $('#cp', csub), hint = $('#cunseenhint', csub);
      const upd = () => { const a = subList(scope.value, cp ? cp.value : null); hint.textContent = `안 푼 ${unseenN(a)} / 전체 ${a.length}`; };
      if (cp) cp.addEventListener('change', upd);
      upd();
    }
  }
  scope.addEventListener('change', drawSub); drawSub();

  $('#cstart', form).addEventListener('click', () => {
    const v = scope.value;
    const p = $('#cp', csub) ? $('#cp', csub).value : null;
    let list = CQ.slice(); let label = '';
    if (v === 'subject') { list = list.filter((q) => q.subject === p); label = subjName(p); }
    else if (v === 'note') { const n = CNOTE_BY_SLUG.get(p); list = (n ? n.quiz : []).map((id) => CQ_BY_ID.get(id)).filter(Boolean); label = n ? n.title : '노트'; }
    else if (v === 'tag') { list = list.filter((q) => (q.tags || []).includes(p)); label = '#' + p; }
    else if (v === 'wrong') { list = list.filter((q) => { const a = cstore.lastAttempt(q.id); return a && !a.ok; }); label = '틀린 문제'; }
    else if (v === 'fav') { list = store.state.cppg.favorites.map((id) => CQ_BY_ID.get(id)).filter(Boolean); label = '즐겨찾기'; }
    else if (v === 'unseen') { list = list.filter((q) => !cstore.attemptCount(q.id)); label = '안 푼 문제'; }
    else { label = '랜덤'; }

    const onlyUnseen = $('#conlyunseen', csub);
    if (onlyUnseen && onlyUnseen.checked) {
      list = list.filter((q) => !cstore.attemptCount(q.id));
      label += ' · 안 푼';
      if (!list.length) { toast('안 푼 문제가 없습니다'); return; }
    }

    if ($('#corder', form).value === 'shuffle' || v === 'random') shuffle(list);
    else list.sort((a, b) => a.subject.localeCompare(b.subject) || a.id.localeCompare(b.id));
    const lim = +$('#climit', form).value;
    if (lim > 0) list = list.slice(0, lim);
    cStart(list.map((q) => q.id), `${label} ${list.length}문항`, { reveal: $('#creveal', form).checked });
  });
});

cRoute('mock', (app) => {
  app.appendChild(el('<h1>CPPG 모의고사</h1>'));
  const short = [];
  CSUBJ.forEach((s) => { const have = CQ.filter((q) => q.subject === s.id).length; if (have < s.count) short.push(`${s.no}과목 ${have}/${s.count}`); });
  const form = el(`<div class="card stack">
    <p class="small muted">${CCFG.totalQuestions}문항 · ${CCFG.durationMin}분 · 합격 ${CCFG.passTotal}점 이상 + 과목별 ${CCFG.passPerSubjectPct}% 이상</p>
    ${short.length ? `<p class="small" style="color:var(--bad)">⚠ 문제 부족: ${short.join(', ')} — 있는 만큼만 출제됩니다</p>` : ''}
    <label class="row" style="align-items:center;gap:6px;margin:0"><input type="checkbox" id="mtimer" checked style="width:auto"><span class="small">타이머 (${CCFG.durationMin}분)</span></label>
    <label class="row" style="align-items:center;gap:6px;margin:0"><input type="checkbox" id="mshuffle" style="width:auto"><span class="small">문제 순서 섞기 (과목 순서 무시)</span></label>
    <button class="btn primary wide" id="mstart">모의고사 시작</button>
  </div>`);
  app.appendChild(form);

  const hist = store.state.cppg.sessions.filter((s) => s.kind === 'mock').slice(0, 8);
  if (hist.length) {
    const box = el('<div class="card"><h3>모의고사 이력</h3></div>');
    hist.forEach((h) => {
      const pr = cPass(h);
      box.appendChild(el(`<div class="rank-item" style="cursor:default">
        <span class="pill accent">${fmtDay(h.startedAt)}</span>
        <span class="small" style="flex:1">${h.correct}/${h.total}점</span>
        <span class="small ${pr.pass ? '' : 'rank-x'}">${pr.pass ? '합격' : '불합격' + (pr.failed.length ? ' (과락)' : '')}</span></div>`));
    });
    app.appendChild(box);
  }

  $('#mstart', form).addEventListener('click', () => {
    const ids = [];
    CSUBJ.forEach((s) => { const pool = shuffle(CQ.filter((q) => q.subject === s.id)); ids.push(...pool.slice(0, s.count).map((q) => q.id)); });
    if ($('#mshuffle', form).checked) shuffle(ids);
    if (!ids.length) { toast('출제할 문제가 없습니다'); return; }
    cStart(ids, `모의고사 ${ids.length}문항`, { kind: 'mock', reveal: false, durationMin: $('#mtimer', form).checked ? CCFG.durationMin : 0 });
  });
});

cRoute('run', (app) => {
  if (!CSESSION) { navigate('#/cppg/quiz'); return; }
  const expd = cExpiresAt();
  if (expd && Date.now() >= expd) { cFinish(); return; }
  const { ids, idx, kind } = CSESSION;
  const it = CQ_BY_ID.get(ids[idx]);

  if (expd) {
    const timer = el(`<div class="mock-timer"><span>모의고사</span><span id="mclock">${fmtClock(expd - Date.now())}</span></div>`);
    app.appendChild(timer);
    const clk = $('#mclock', timer);
    CTIMER = setInterval(() => {
      const left = expd - Date.now();
      clk.textContent = fmtClock(left);
      timer.classList.toggle('warn', left < 5 * 60000);
      if (left <= 0) { clearInterval(CTIMER); CTIMER = null; cFinish(); }
    }, 1000);
  }

  app.appendChild(el(`<div class="q-head" style="margin-bottom:4px">
    <span class="pill">${esc(CSESSION.label)}</span>
    <span class="muted small" style="margin-left:auto">${idx + 1} / ${ids.length}</span></div>`));
  app.appendChild(el(`<div class="progress"><i style="width:${((idx + 1) / ids.length) * 100}%"></i></div>`));

  app.appendChild(cppgCard(it, {
    sessionStart: CSESSION.startedAt,
    reveal: CSESSION.reveal,
    onAnswer: () => {
      csave();
      const cell = grid && grid.children[idx];
      if (cell) cell.className = `q-cell ${cCell(it.id, CSESSION.startedAt, kind)} cur`;
      if (nextBtn && !CSESSION.reveal && idx < ids.length - 1) nextBtn.focus();
    },
  }));

  const nav = el('<div class="nav-row"></div>');
  const prev = el('<button class="btn">← 이전</button>');
  prev.disabled = idx === 0;
  prev.addEventListener('click', () => { CSESSION.idx--; csave(); render(); });
  const isLast = idx === ids.length - 1;
  const nextBtn = el(`<button class="btn primary">${isLast ? '제출 ✓' : '다음 →'}</button>`);
  nextBtn.addEventListener('click', () => { if (isLast) cFinish(); else { CSESSION.idx++; csave(); render(); } });
  nav.append(prev, nextBtn);
  app.appendChild(nav);

  const jump = el(`<details class="q-jump"><summary class="small muted">문항 이동 (${ids.length})</summary><div class="q-grid"></div></details>`);
  const grid = $('.q-grid', jump);
  ids.forEach((id, i) => {
    const b = el(`<button class="q-cell ${cCell(id, CSESSION.startedAt, kind)} ${i === idx ? 'cur' : ''}">${i + 1}</button>`);
    b.addEventListener('click', () => { CSESSION.idx = i; csave(); render(); });
    grid.appendChild(b);
  });
  app.appendChild(jump);

  const quit = el('<button class="btn sm" style="margin-top:12px">그만두고 제출</button>');
  quit.addEventListener('click', cFinish);
  app.appendChild(quit);
});

cRoute('result', (app) => {
  const SUM = store.state.cppg.lastSummary;
  if (!SUM) { navigate('#/cppg/quiz'); return; }
  const isMock = SUM.kind === 'mock';
  const pr = cPass(SUM);
  app.appendChild(el('<h1>제출 완료</h1>'));
  app.appendChild(el(`<p class="muted">${esc(SUM.label)} · ${SUM.answered}/${SUM.total}문항 응답</p>`));

  if (isMock) {
    app.appendChild(el(`<div class="card score-card">
      <div class="pass-line ${pr.pass ? 'ok' : 'bad'}">${SUM.correct} / ${SUM.total}점 &nbsp; ${pr.pass ? '✅ 합격' : '❌ 불합격'}</div>
      <div class="small muted">합격 기준: ${CCFG.passTotal}점 이상 + 모든 과목 ${CCFG.passPerSubjectPct}% 이상${pr.failed.length ? ` · <b style="color:var(--bad)">과락: ${pr.failed.map((s) => s.no + '과목').join(', ')}</b>` : ''}</div>
    </div>`));
  } else {
    app.appendChild(el(`<div class="stat-grid">
      <div class="card"><div class="big" style="color:var(--ok)">${SUM.correct}</div><div class="muted small">정답</div></div>
      <div class="card"><div class="big" style="color:var(--bad)">${SUM.answered - SUM.correct}</div><div class="muted small">오답</div></div>
      <div class="card"><div class="big">${SUM.answered ? pct(SUM.correct, SUM.answered) : 0}%</div><div class="muted small">정답률</div></div>
    </div>`));
  }

  const sBox = el('<div class="card"><h3>과목별</h3></div>');
  CSUBJ.forEach((s) => {
    const p = SUM.per[s.id]; if (!p || !p.n) return;
    const r = pct(p.o, p.n);
    const fail = isMock && r < CCFG.passPerSubjectPct;
    sBox.appendChild(el(`<div class="bar-row subject-score ${fail ? 'fail' : ''}">
      <span class="bar-label">${esc(s.no + '. ' + s.name)}</span>
      ${barTrack({ o: p.o, m: 0, x: p.n - p.o })}
      <span class="bar-num">${p.o}/${p.n} ${r}%${fail ? '<span class="fail-badge">과락</span>' : ''}</span></div>`));
  });
  app.appendChild(sBox);

  const review = SUM.ids.filter((id) => { const a = cstore.lastAnswerSince(id, SUM.startedAt); return !a || !a.ok; });
  if (review.length) {
    const box = el(`<div class="card"><h3>다시 볼 문제 (${review.length})</h3></div>`);
    review.slice(0, 40).forEach((id) => {
      const it = CQ_BY_ID.get(id); if (!it) return;
      const a = cstore.lastAnswerSince(id, SUM.startedAt);
      const item = el(`<div class="rank-item"><span class="pill accent">${esc(subjNo(it.subject))}</span>
        <span class="small" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.stem.slice(0, 40))}</span>
        <span class="small ${a ? 'rank-x' : 'muted'}">${a ? '오답' : '미응답'}</span></div>`);
      item.addEventListener('click', () => navigate('#/cppg/q/' + encodeURIComponent(id)));
      box.appendChild(item);
    });
    const again = el(`<button class="btn primary wide" style="margin-top:10px">틀린·미응답 ${review.length}문항 다시 풀기</button>`);
    again.addEventListener('click', () => cStart(review, `${SUM.label} 복습`, { reveal: true }));
    box.appendChild(again);
    app.appendChild(box);
  }
  app.appendChild(el('<div class="nav-row"><a class="btn" href="#/cppg/quiz">새 문제</a><a class="btn" href="#/cppg/stats">통계</a></div>'));
});

cRoute('stats', (app) => {
  app.appendChild(el('<h1>CPPG 통계</h1>'));
  const st = store.state.cppg;
  const graded = CQ.map((q) => ({ q, a: cstore.lastAttempt(q.id) })).filter((x) => x.a);
  const done = graded.length;
  const corr = graded.filter((x) => x.a.ok).length;
  app.appendChild(el(`<div class="stat-grid">
    <div class="card"><div class="big">${pct(done, CQ.length)}%</div><div class="muted small">진도 (${done}/${CQ.length})</div></div>
    <div class="card"><div class="big">${done ? pct(corr, done) : 0}%</div><div class="muted small">정답률</div></div>
    <div class="card"><div class="big">${st.sessions.length}</div><div class="muted small">세션</div></div>
  </div>`));

  // 14일 학습량
  const dayMap = {};
  Object.values(st.results).forEach((r) => r.attempts.forEach((a) => { const k = dayKey(a.t); dayMap[k] = (dayMap[k] || 0) + 1; }));
  const heat = el('<div class="card"><h3>최근 14일 학습량</h3><div class="heat"></div></div>');
  const hc = $('.heat', heat);
  const days = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(dayKey(d.getTime())); }
  const mx = Math.max(1, ...days.map((d) => dayMap[d] || 0));
  days.forEach((d) => { const n = dayMap[d] || 0; hc.appendChild(el(`<i class="${n ? 'has' : ''}" style="height:${Math.max(3, (n / mx) * 100)}%" title="${d}: ${n}"></i>`)); });
  app.appendChild(heat);

  // 과목별 정답률
  const per = {};
  graded.forEach(({ q, a }) => { const p = per[q.subject] || (per[q.subject] = { o: 0, n: 0 }); p.n++; if (a.ok) p.o++; });
  const sBox = el('<div class="card"><h3>과목별 정답률</h3></div>');
  CSUBJ.forEach((s) => {
    const p = per[s.id] || { o: 0, n: 0 };
    sBox.appendChild(el(`<div class="bar-row"><span class="bar-label">${esc(s.no + '. ' + s.name)}</span>${barTrack({ o: p.o, m: 0, x: p.n - p.o })}<span class="bar-num">${p.n ? pct(p.o, p.n) + '%' : '–'}</span></div>`));
  });
  app.appendChild(sBox);

  // 오답 랭킹
  const rank = CQ.map((q) => ({ q, x: cstore.wrongCount(q.id) })).filter((r) => r.x > 0).sort((a, b) => b.x - a.x).slice(0, 30);
  const rBox = el('<div class="card"><h3>오답 랭킹</h3></div>');
  if (!rank.length) rBox.appendChild(el('<p class="muted small">아직 틀린 문제가 없습니다.</p>'));
  rank.forEach(({ q, x }) => {
    const item = el(`<div class="rank-item"><span class="pill accent">${esc(subjNo(q.subject))}</span>
      <span class="small muted" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(q.stem.slice(0, 34))}</span>
      <span class="small rank-x">${x}회</span></div>`);
    item.addEventListener('click', () => navigate('#/cppg/q/' + encodeURIComponent(q.id)));
    rBox.appendChild(item);
  });
  app.appendChild(rBox);

  const mocks = st.sessions.filter((s) => s.kind === 'mock');
  if (mocks.length) {
    const box = el('<div class="card"><h3>모의고사 총점 추이</h3></div>');
    mocks.slice(0, 12).reverse().forEach((m) => {
      const pr = cPass(m);
      box.appendChild(el(`<div class="bar-row"><span class="bar-label">${fmtDay(m.startedAt)}</span>
        ${barTrack({ o: m.correct, m: 0, x: m.total - m.correct })}<span class="bar-num">${m.correct}${pr.pass ? '' : ' ✗'}</span></div>`));
    });
    app.appendChild(box);
  }
});

cRoute('notes', (app, rest) => {
  app.appendChild(el('<h1>CPPG 학습 노트</h1>'));
  const notes = CPPG.notes;
  if (!notes.length) { app.appendChild(el('<div class="empty">아직 노트가 없습니다.</div>')); return; }
  const subjNames = CSUBJ.map((s) => s.name);
  const extraCats = [...new Set(notes.map((n) => n.subject))].filter((c) => !subjNames.includes(c));
  const cats = [...subjNames, ...extraCats].filter((n) => notes.some((x) => x.subject === n));
  const catCount = (c) => notes.filter((n) => n.subject === c).length;
  const allTags = [...new Set(notes.flatMap((n) => n.tags || []))].sort((a, b) => a.localeCompare(b, 'ko'));

  let curCat = '', curTag = '';
  if (rest[0] === 'tag') curTag = decodeURIComponent(rest.slice(1).join('/') || '');
  else if (rest.length) curCat = decodeURIComponent(rest.join('/'));
  if (curCat && !cats.includes(curCat)) curCat = '';
  if (curTag && !allTags.includes(curTag)) curTag = '';

  const controls = el(`<div class="card stack">
    <div class="chip-row" id="ccatRow">
      <button class="chip" data-cat="">전체 <span>${notes.length}</span></button>
      ${cats.map((c) => `<button class="chip" data-cat="${esc(c)}">${esc(c)} <span>${catCount(c)}</span></button>`).join('')}
    </div>
    <div class="row tight">
      <input type="text" id="cnq" placeholder="제목·태그·본문 검색" style="flex:2;min-width:150px" autocomplete="off">
      <select id="cntag" style="flex:1;min-width:120px"><option value="">태그 전체</option>${allTags.map((t) => `<option value="${esc(t)}">#${esc(t)}</option>`).join('')}</select>
    </div>
  </div>`);
  app.appendChild(controls);
  const listWrap = el('<div id="cnlist"></div>');
  app.appendChild(listWrap);
  const nq = $('#cnq', controls), ntag = $('#cntag', controls);
  ntag.value = curTag;

  function syncChips() { controls.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.cat === curCat)); }
  function syncHash() {
    const t = curTag ? '#/cppg/notes/tag/' + encodeURIComponent(curTag) : curCat ? '#/cppg/notes/' + encodeURIComponent(curCat) : '#/cppg/notes';
    try { if (location.hash !== t) history.replaceState(null, '', t); } catch (e) { /* noop */ }
  }
  function draw() {
    const f = nq.value.trim().toLowerCase();
    const filtered = notes.filter((n) => {
      if (curCat && n.subject !== curCat) return false;
      if (curTag && !(n.tags || []).includes(curTag)) return false;
      if (f && !(n.title.toLowerCase().includes(f) || (n.tags || []).some((t) => t.toLowerCase().includes(f)) || n.md.toLowerCase().includes(f))) return false;
      return true;
    });
    listWrap.innerHTML = '';
    listWrap.appendChild(el(`<p class="small muted" style="margin:6px 2px">${filtered.length}개 노트</p>`));
    if (!filtered.length) { listWrap.appendChild(el('<p class="muted small">조건에 맞는 노트가 없습니다.</p>')); return; }
    const byCat = {};
    filtered.forEach((n) => (byCat[n.subject] || (byCat[n.subject] = [])).push(n));
    Object.entries(byCat).forEach(([cat, arr]) => {
      if (!curCat) listWrap.appendChild(el(`<div class="note-cat">${esc(cat)}</div>`));
      arr.forEach((n) => listWrap.appendChild(el(`<a class="note-item" href="#/cppg/note/${encodeURIComponent(n.slug)}">
        <span class="note-item-title">${esc(n.title)}</span>
        <span class="note-item-meta">${(n.tags || []).slice(0, 5).map((t) => `<span class="pill">${esc(t)}</span>`).join(' ')} <span class="small muted">· ${n.ref ? '참고자료' : '문제 ' + n.quiz.length}</span></span></a>`)));
    });
  }
  $('#ccatRow', controls).addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (!b) return; curCat = b.dataset.cat; syncChips(); syncHash(); draw(); });
  ntag.addEventListener('change', () => { curTag = ntag.value; syncHash(); draw(); });
  nq.addEventListener('input', draw);
  syncChips(); draw();
});

cRoute('note', (app, rest) => {
  const slug = decodeURIComponent(rest.join('/'));
  const n = CNOTE_BY_SLUG.get(slug);
  if (!n) { app.appendChild(el('<div class="empty">노트를 찾을 수 없습니다.</div>')); return; }
  app.appendChild(el('<a class="btn sm" href="#/cppg/notes">← 노트 목록</a>'));
  app.appendChild(el(`<h1>${esc(n.title)}</h1>`));
  app.appendChild(el(`<div class="row tight" style="margin-bottom:8px">
    <a class="pill accent" href="#/cppg/notes/${encodeURIComponent(n.subject)}">${esc(n.subject)}</a>
    ${(n.tags || []).map((t) => `<a class="pill" href="#/cppg/notes/tag/${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}</div>`));
  const md = el('<div class="card markdown"></div>');
  md.innerHTML = window.marked ? window.marked.parse(n.md) : `<pre>${esc(n.md)}</pre>`;
  enhanceMarkdown(md);
  app.appendChild(md);
  if (n.quiz.length) {
    const box = el(`<div class="card"><h3>이 노트 연습문제 (${n.quiz.length})</h3></div>`);
    n.quiz.forEach((id) => {
      const it = CQ_BY_ID.get(id); if (!it) return;
      const item = el(`<div class="rank-item"><span class="pill accent">${esc(subjNo(it.subject))}</span>
        <span class="small" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.stem.slice(0, 40))}</span></div>`);
      item.addEventListener('click', () => navigate('#/cppg/q/' + encodeURIComponent(id)));
      box.appendChild(item);
    });
    const all = el(`<button class="btn primary wide" style="margin-top:10px">이 노트 ${n.quiz.length}문항 풀기</button>`);
    all.addEventListener('click', () => cStart(n.quiz.slice(), `${n.title} ${n.quiz.length}문항`, { reveal: true }));
    box.appendChild(all);
    app.appendChild(box);
  }
});

cRoute('q', (app, rest) => {
  const id = decodeURIComponent(rest.join('/'));
  const it = CQ_BY_ID.get(id);
  if (!it) { app.appendChild(el('<div class="empty">문제를 찾을 수 없습니다.</div>')); return; }
  app.appendChild(el(`<div class="row tight" style="margin-bottom:6px">
    <a class="btn sm" href="#/cppg/quiz">← 문제</a>
    ${CSESSION && CSESSION.ids && CSESSION.ids.length ? '<a class="btn sm" href="#/cppg/run">풀던 세션으로 →</a>' : ''}</div>`));
  app.appendChild(el(`<h1>${esc(subjNo(it.subject))} 문제</h1>`));
  app.appendChild(cppgCard(it, { reveal: true }));

  const pool = CQ.filter((q) => q.subject === it.subject).sort((a, b) => a.id.localeCompare(b.id));
  const i = pool.findIndex((q) => q.id === it.id);
  const nav = el('<div class="nav-row"></div>');
  const prev = el(`<button class="btn">← 이전</button>`);
  prev.disabled = i <= 0;
  if (i > 0) prev.addEventListener('click', () => navigate('#/cppg/q/' + encodeURIComponent(pool[i - 1].id)));
  const next = el('<button class="btn">다음 →</button>');
  next.disabled = i >= pool.length - 1;
  if (i < pool.length - 1) next.addEventListener('click', () => navigate('#/cppg/q/' + encodeURIComponent(pool[i + 1].id)));
  nav.append(prev, next);
  app.appendChild(nav);
});

cRoute('more', (app) => {
  app.appendChild(el('<h1>CPPG 더보기</h1>'));
  const st = store.state.cppg;
  const favBox = el(`<div class="card"><h3>즐겨찾기 (${st.favorites.length})</h3></div>`);
  if (!st.favorites.length) favBox.appendChild(el('<p class="muted small">문제 카드의 ☆ 를 눌러 추가하세요.</p>'));
  else {
    st.favorites.forEach((id) => {
      const it = CQ_BY_ID.get(id); if (!it) return;
      const item = el(`<div class="rank-item"><span class="pill accent">${esc(subjNo(it.subject))}</span>
        <span class="small" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.stem.slice(0, 40))}</span></div>`);
      item.addEventListener('click', () => navigate('#/cppg/q/' + encodeURIComponent(id)));
      favBox.appendChild(item);
    });
    const b = el('<button class="btn sm" style="margin-top:8px">즐겨찾기 전체 풀기</button>');
    b.addEventListener('click', () => cStart(st.favorites.filter((id) => CQ_BY_ID.has(id)), `즐겨찾기 ${st.favorites.length}문항`, { reveal: true }));
    favBox.appendChild(b);
  }
  app.appendChild(favBox);

  const setBox = el(`<div class="card stack"><h3>설정</h3>
    <label class="field"><span>시험일 (D-day · 하루 권장 페이스)</span>
      <input type="date" id="cExamDate" value="${esc(store.state.settings.cppgExamDate || '')}"></label>
  </div>`);
  $('#cExamDate', setBox).addEventListener('change', (e) => { store.state.settings.cppgExamDate = e.target.value; store.save(); });
  app.appendChild(setBox);

  const rBox = el('<div class="card stack"><h3>데이터</h3><p class="small muted">CPPG 학습기록만 초기화합니다. 정보보안기사 기록은 그대로 유지됩니다.</p>'
    + '<button class="btn sm" id="cppgReset" style="color:var(--bad)">CPPG 학습기록 초기화</button></div>');
  $('#cppgReset', rBox).addEventListener('click', () => {
    if (confirm('CPPG 학습기록·즐겨찾기·세션을 삭제합니다. 계속할까요?')) {
      store.state.cppg = { results: {}, favorites: [], sessions: [], session: null, lastSummary: null };
      CSESSION = null; store.save(); toast('CPPG 기록 초기화됨'); render();
    }
  });
  app.appendChild(rBox);
  app.appendChild(el(`<p class="small muted center" style="margin-top:20px">세션 ${st.sessions.length}회 · 데이터 ${CPPG.builtAt.slice(0, 10)}</p>`));
});

/* ============ 키보드 단축키 (PC 회독용) ============
   render() 가 매번 DOM 을 새로 그리므로 상태를 들지 않고 현재 화면의 컨트롤을 클릭한다. */
function installShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
    const app = document.getElementById('app');
    if (!app) return;
    const click = (sel, root = app) => { const b = root.querySelector(sel); if (b) { b.click(); return true; } return false; };
    switch (e.key) {
      case '1': case '2': case '3': case '4': case '5': {
        const choices = app.querySelector('.choice-list');
        if (choices) { const b = choices.children[+e.key - 1]; if (b) b.click(); return; }
        if (+e.key <= 3) { const g = ['o', 'm', 'x'][+e.key - 1]; click(`.grade-row .btn[data-g="${g}"]`); }
        return;
      }
      case 'ArrowLeft': if (app.querySelector('.q-jump') && click('.nav-row button:first-child:not([disabled])')) e.preventDefault(); return;
      case 'ArrowRight': if (app.querySelector('.q-jump') && click('.nav-row button:last-child:not([disabled])')) e.preventDefault(); return;
      case ' ': if (click('.reveal-btn')) e.preventDefault(); return;
      case 'f': click('.q-card .star'); return;
      case '/': e.preventDefault(); navigate('#/search'); return;
      case '?': toast('1·2·3 채점/보기 · ←→ 이전·다음 · Space 정답 · f 즐겨찾기 · / 검색'); return;
    }
  });
}

/* ============ 부팅 ============ */
store.load();
applyTheme();
if (store.state.session && Array.isArray(store.state.session.qids) && store.state.session.qids.length) {
  SESSION = store.state.session;
  if (!SESSION.startedAt) SESSION.startedAt = Date.now();
} else {
  store.state.session = null;
}
if (store.state.cppg.session && Array.isArray(store.state.cppg.session.ids) && store.state.cppg.session.ids.length) {
  CSESSION = store.state.cppg.session;
  if (!CSESSION.startedAt) CSESSION.startedAt = Date.now();
} else {
  store.state.cppg.session = null;
}
if (!location.hash) location.hash = store.state.settings.track === 'cppg' ? '#/cppg' : '#/home';
// CPPG 트랙으로 부팅하거나 이미 #/cppg 로 들어왔으면 지연 번들을 미리 당겨둔다 (관문이 같은 Promise 를 기다림)
if (store.state.settings.track === 'cppg' || location.hash.startsWith('#/cppg')) ensureCppg();
render();
installShortcuts();

/* 서버 동기화 — 로그인되어 있으면 부팅에 서버 상태를 받아 병합 */
SYNC.load();
if (SYNC.on) SYNC.pull();
window.addEventListener('online', () => { if (SYNC.on) SYNC.pull(); });
document.addEventListener('visibilitychange', () => {
  if (!SYNC.on) return;
  if (document.hidden) SYNC.pushNow();                                 // 탭 숨김/닫힘 직전 대기분 flush
  else if (Date.now() - SYNC.lastAt > 20000) SYNC.pull();              // 돌아오면 최신화
});

/* 서비스 워커 — 새 버전 감지 시 1회 자동 새로고침 */
if ('serviceWorker' in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) location.reload();
        });
      });
    }).catch(() => {});
  });
}

/* 테스트용 노출 (스모크에서 병합·동기화 로직 검증) */
try { window.__sync = { SYNC, mergeState, mergeResults, mergeSessions, store, dayKey, streakDays, computeStats, dueQids, reviewDueAt, ensureCppg }; } catch (e) { /* noop */ }
