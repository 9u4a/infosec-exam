/* 정보보안기사 실기 학습 사이트 — 프레임워크 없는 해시 라우팅 SPA */
'use strict';

const DATA = window.EXAM_DATA;
const QUESTIONS = DATA.rounds.flatMap((r) => r.questions);
const BY_QID = new Map(QUESTIONS.map((q) => [q.qid, q]));
const NOTE_BY_SLUG = new Map(DATA.notes.map((n) => [n.slug, n]));
const TYPES = ['단답형', '서술형', '실무형'];
const GRADE_LABEL = { o: '맞음', m: '애매함', x: '틀림' };

/* ============ 저장소 ============ */
const LS_KEY = 'infosec_v1';
const DEFAULT_STATE = () => ({
  v: 1,
  results: {},        // qid -> { attempts: [{t, g}], memo: '' }
  favorites: [],       // [qid]
  sessions: [],        // [{ id, startedAt, endedAt, scopeLabel, graded: {o,m,x} }]
  session: null,       // 진행 중 세션 { qids, label, idx, startedAt, graded:{o,m,x}, seen:[qid] }
  lastSummary: null,   // 마지막 제출 결과 { label, qids, seen:[qid], graded:{o,m,x} }
  settings: { alwaysShowAnswer: false, theme: 'auto' },
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
      }
    } catch (e) { console.warn('상태 불러오기 실패', e); }
  },
  save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(this.state)); }
    catch (e) { console.warn('상태 저장 실패', e); }
  },
  result(qid) {
    return this.state.results[qid] || (this.state.results[qid] = { attempts: [], memo: '' });
  },
  grade(qid, g) {
    this.result(qid).attempts.push({ t: Date.now(), g });
    this.save();
  },
  setMemo(qid, memo) { this.result(qid).memo = memo; this.save(); },
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
      const key = new Date(a.t).toISOString().slice(0, 10);
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

function toast(msg) {
  const t = el(`<div class="toast">${esc(msg)}</div>`);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

function qLabel(q) { return `${q.round}회 ${q.no}번`; }

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
  try { window.scrollTo(0, 0); } catch (e) { /* noop */ }
  view(app, args);
  const tabbar = $('#tabbar');
  tabbar.hidden = false;
  tabbar.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.tab === path));
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
  const card = el(`<div class="card q-card"></div>`);

  const notesHtml = (q.notes || []).map((slug) => {
    const n = NOTE_BY_SLUG.get(slug);
    return n ? `<a href="#/note/${encodeURIComponent(slug)}">📎 ${esc(n.title)}</a>` : '';
  }).join('');

  card.innerHTML = `
    <div class="q-head">
      <span class="pill accent">${esc(qLabel(q))}</span>
      <span class="pill">${esc(q.type)}</span>
      <span class="pill">${esc(q.domain)}</span>
      <button class="star ${store.isFav(q.qid) ? 'on' : ''}" title="즐겨찾기" aria-label="즐겨찾기">${store.isFav(q.qid) ? '★' : '☆'}</button>
    </div>
    <div class="q-body">${esc(q.question)}${q.supplement ? `<div class="supplement"><span class="supp-cap">🧩 지문 재구성 <span>· 원본 데이터 누락분</span></span><div class="supp-body">${window.marked ? window.marked.parse(q.supplement) : esc(q.supplement)}</div></div>` : ''}</div>

    <label class="field my-answer">
      <span>내 답 (선택 입력)</span>
      <textarea rows="2" placeholder="여기에 답을 적어보고 아래에서 정답과 비교하세요"></textarea>
    </label>

    <div class="reveal-slot"></div>
  `;

  const slot = $('.reveal-slot', card);
  const star = $('.star', card);
  star.addEventListener('click', () => {
    store.toggleFav(q.qid);
    const on = store.isFav(q.qid);
    star.classList.toggle('on', on);
    star.textContent = on ? '★' : '☆';
  });

  function buildAnswer() {
    const r = store.result(q.qid);
    const wrap = el(`
      <div class="answer-wrap">
        <div class="a-body">${renderAnswer(q.answer)}</div>
        ${q.explanation ? `<div class="expl"><b>💡 해설</b><div class="expl-body">${window.marked ? window.marked.parse(q.explanation) : esc(q.explanation)}</div></div>` : ''}
        ${notesHtml ? `<div class="note-links">${notesHtml}</div>` : ''}
        <div class="grade-row">
          <button class="btn" data-g="o"><span class="g-ico">⭕</span>맞음</button>
          <button class="btn" data-g="m"><span class="g-ico">🔺</span>애매함</button>
          <button class="btn" data-g="x"><span class="g-ico">❌</span>틀림</button>
        </div>
        <label class="field" style="margin-bottom:0">
          <span>💭 내 메모</span>
          <textarea class="memo" rows="1" placeholder="헷갈린 점, 암기 포인트 등">${esc(r.memo || '')}</textarea>
        </label>
      </div>
    `);
    const gr = $('.grade-row', wrap);
    const paint = () => {
      const last = store.lastGrade(q.qid);
      gr.querySelectorAll('.btn').forEach((b) => b.classList.toggle('sel', b.dataset.g === last));
    };
    paint();
    gr.querySelectorAll('.btn').forEach((b) => b.addEventListener('click', () => {
      store.grade(q.qid, b.dataset.g);
      paint();
      if (opts.onGrade) opts.onGrade(b.dataset.g);
    }));
    const memo = $('.memo', wrap);
    memo.addEventListener('input', () => { memo.style.height = 'auto'; memo.style.height = memo.scrollHeight + 'px'; });
    memo.addEventListener('change', () => store.setMemo(q.qid, memo.value.trim()));
    return wrap;
  }

  const toggleBtn = el(`<button class="btn primary wide reveal-btn"></button>`);
  let answerEl = null;
  let shown = false;
  function setShown(next) {
    shown = next;
    if (shown && !answerEl) { answerEl = buildAnswer(); slot.appendChild(answerEl); }
    if (answerEl) answerEl.hidden = !shown;
    toggleBtn.textContent = shown ? '정답 닫기 ▲' : '정답 보기 ▼';
    toggleBtn.classList.toggle('open', shown);
  }
  toggleBtn.addEventListener('click', () => setShown(!shown));
  slot.appendChild(toggleBtn);
  setShown(revealed);
  return card;
}

/* ============ 홈 ============ */
route('home', (app) => {
  const s = computeStats();
  const today = new Date().toISOString().slice(0, 10);
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
    const rc = el(`<div class="card resume-card">
      <div><b>이어풀기</b> <span class="muted small">${esc(SESSION.label)} · ${SESSION.idx + 1}/${SESSION.qids.length}</span></div>
      <div class="row tight" style="margin-top:8px">
        <button class="btn primary sm" id="resumeGo">이어서 풀기 →</button>
        <button class="btn sm" id="resumeQuit">그만두고 제출</button>
      </div></div>`);
    $('#resumeGo', rc).addEventListener('click', () => navigate('#/session'));
    $('#resumeQuit', rc).addEventListener('click', () => finishSession());
    app.appendChild(rc);
  }

  app.appendChild(el(`
    <div class="stat-grid">
      <div class="card"><div class="big">${todayCount}</div><div class="muted small">오늘 푼 문항</div></div>
      <div class="card"><div class="big">${s.doneTotal}<span class="muted" style="font-size:1rem">/${QUESTIONS.length}</span></div><div class="muted small">1회+ 학습</div></div>
      <div class="card"><div class="big">${s.attemptsTotal ? pct(countLast('o'), s.doneTotal) : 0}%</div><div class="muted small">최근 정답률</div></div>
    </div>
  `));

  app.appendChild(el(`<div class="row" style="margin-top:14px">
    <a class="btn primary" href="#/solve">문제 풀기 →</a>
    <a class="btn" href="#/stats">통계 보기</a>
  </div>`));

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

/* ============ 풀기: 범위 선택 ============ */
route('solve', (app) => {
  app.appendChild(el(`<h1>문제 풀기</h1>`));
  const form = el(`<div class="card stack"></div>`);

  form.appendChild(el(`<label class="field"><span>범위</span>
    <select id="scope">
      <option value="round">회차별</option>
      <option value="domain">영역별</option>
      <option value="type">유형별</option>
      <option value="wrong">오답만 (마지막이 틀림)</option>
      <option value="maybe">애매함만 (마지막이 애매함)</option>
      <option value="fav">즐겨찾기만</option>
      <option value="unseen">안 푼 문항</option>
      <option value="random">랜덤</option>
    </select></label>`));

  const sub = el(`<div id="sub"></div>`);
  form.appendChild(sub);

  form.appendChild(el(`<label class="field"><span>정렬</span>
    <select id="order">
      <option value="seq">회차·번호순</option>
      <option value="shuffle">무작위</option>
    </select></label>`));

  form.appendChild(el(`<label class="field" id="limitWrap"><span>문항 수 (0 = 전체)</span>
    <input type="number" id="limit" value="0" min="0" max="532"></label>`));

  const startBtn = el(`<button class="btn primary wide" id="start">시작</button>`);
  form.appendChild(startBtn);
  app.appendChild(form);

  const scopeSel = $('#scope', form);
  function renderSub() {
    const v = scopeSel.value;
    sub.innerHTML = '';
    if (v === 'round') {
      sub.appendChild(el(`<label class="field"><span>회차</span><select id="p">
        ${DATA.rounds.map((r) => `<option value="${r.round}">${r.round}회 (${r.date})</option>`).reverse().join('')}
      </select></label>`));
    } else if (v === 'domain') {
      sub.appendChild(el(`<label class="field"><span>영역</span><select id="p">
        ${DATA.domains.map((d) => `<option value="${esc(d)}">${esc(d)}</option>`).join('')}
      </select></label>`));
    } else if (v === 'type') {
      sub.appendChild(el(`<label class="field"><span>유형</span><select id="p">
        ${TYPES.map((t) => `<option value="${t}">${t}</option>`).join('')}
      </select></label>`));
    }
  }
  scopeSel.addEventListener('change', renderSub);
  renderSub();

  startBtn.addEventListener('click', () => {
    const v = scopeSel.value;
    const p = $('#p', sub) ? $('#p', sub).value : null;
    let list = QUESTIONS.slice();
    let label = '';
    if (v === 'round') { list = list.filter((q) => q.round === +p); label = `${p}회`; }
    else if (v === 'domain') { list = list.filter((q) => q.domain === p); label = p; }
    else if (v === 'type') { list = list.filter((q) => q.type === p); label = p; }
    else if (v === 'wrong') { list = list.filter((q) => store.lastGrade(q.qid) === 'x'); label = '오답'; }
    else if (v === 'maybe') { list = list.filter((q) => store.lastGrade(q.qid) === 'm'); label = '애매함'; }
    else if (v === 'fav') { list = store.state.favorites.map((id) => BY_QID.get(id)).filter(Boolean); label = '즐겨찾기'; }
    else if (v === 'unseen') { list = list.filter((q) => store.attemptCount(q.qid) === 0); label = '안 푼 문항'; }
    else if (v === 'random') { label = '랜덤'; }

    if ($('#order', form).value === 'shuffle' || v === 'random') shuffle(list);
    else list.sort((a, b) => a.round - b.round || a.no - b.no);

    const lim = +$('#limit', form).value;
    if (lim > 0) list = list.slice(0, lim);

    if (!list.length) { toast('해당 조건의 문항이 없습니다'); return; }
    startSession(list.map((q) => q.qid), `${label} ${list.length}문항`);
  });
});

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* ============ 세션 진행 ============ */
let SESSION = null;
function saveSession() { store.state.session = SESSION; store.save(); }
function seenAdd(qid) { if (!SESSION.seen.includes(qid)) SESSION.seen.push(qid); }
function startSession(qids, label) {
  if (SESSION && SESSION.qids && SESSION.qids.length) {
    if (!confirm('진행 중인 세션이 있습니다. 새로 시작하면 현재 진행이 사라집니다. 계속할까요?')) return;
  }
  SESSION = { qids, label, idx: 0, startedAt: Date.now(), graded: { o: 0, m: 0, x: 0 }, seen: [] };
  saveSession();
  navigate('#/session');
}

route('session', (app) => {
  if (!SESSION) { navigate('#/solve'); return; }
  const { qids, idx } = SESSION;
  const q = BY_QID.get(qids[idx]);

  app.appendChild(el(`<div class="q-head" style="margin-bottom:4px">
    <span class="pill">${esc(SESSION.label)}</span>
    <span class="muted small" style="margin-left:auto">${idx + 1} / ${qids.length}</span>
  </div>`));
  app.appendChild(el(`<div class="progress"><i style="width:${((idx + 1) / qids.length) * 100}%"></i></div>`));

  app.appendChild(questionCard(q, {
    onGrade: () => { seenAdd(q.qid); saveSession(); },
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
    const g = SESSION.seen.includes(qid) ? store.lastGrade(qid) : null;
    const b = el(`<button class="q-cell ${g ? 'g-' + g : ''} ${i === idx ? 'cur' : ''}">${i + 1}</button>`);
    b.addEventListener('click', () => { SESSION.idx = i; saveSession(); render(); });
    grid.appendChild(b);
  });
  app.appendChild(jump);

  const quit = el(`<button class="btn sm" style="margin-top:12px">그만두고 제출</button>`);
  quit.addEventListener('click', finishSession);
  app.appendChild(quit);
});

function finishSession() {
  const graded = { o: 0, m: 0, x: 0 };
  for (const qid of SESSION.qids) {
    const g = store.lastGrade(qid);
    if (g && SESSION.seen.includes(qid)) graded[g]++;
  }
  store.addSession({
    id: SESSION.startedAt,
    startedAt: SESSION.startedAt,
    endedAt: Date.now(),
    scopeLabel: SESSION.label,
    graded,
  });
  store.state.lastSummary = { label: SESSION.label, qids: SESSION.qids.slice(), seen: SESSION.seen.slice(), graded };
  SESSION = null;
  store.state.session = null;
  store.save();
  navigate('#/summary');
}

route('summary', (app) => {
  const SUM = store.state.lastSummary;
  if (!SUM) { navigate('#/solve'); return; }
  const g = SUM.graded;
  const seenHas = (qid) => SUM.seen.includes(qid);
  const total = g.o + g.m + g.x;
  app.appendChild(el(`<h1>제출 완료</h1>`));
  app.appendChild(el(`<p class="muted">${esc(SUM.label)} · 채점한 ${total}문항</p>`));
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
    if (!seenHas(qid)) return;
    const q = BY_QID.get(qid); const gr = store.lastGrade(qid);
    if (!gr) return;
    (perDom[q.domain] || (perDom[q.domain] = { o: 0, m: 0, x: 0 }))[gr]++;
  });
  if (Object.keys(perDom).length) {
    const box = el(`<div class="card"><h3>영역별</h3></div>`);
    Object.entries(perDom).forEach(([d, v]) => box.appendChild(el(
      `<div class="bar-row"><span class="bar-label">${esc(d)}</span>${barTrack(v)}<span class="bar-num">${v.o + v.m + v.x}문항</span></div>`)));
    app.appendChild(box);
  }

  // 틀린/애매한 문항 바로가기
  const review = SUM.qids.filter((qid) => seenHas(qid) && ['x', 'm'].includes(store.lastGrade(qid)));
  if (review.length) {
    const box = el(`<div class="card"><h3>다시 볼 문항 (${review.length})</h3></div>`);
    review.forEach((qid) => {
      const q = BY_QID.get(qid); const gr = store.lastGrade(qid);
      const item = el(`<div class="rank-item"><span class="pill accent">${esc(qLabel(q))}</span>
        <span class="small" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(q.question.slice(0, 36))}</span>
        <span class="small ${gr === 'x' ? 'rank-x' : 'muted'}">${GRADE_LABEL[gr]}</span></div>`);
      item.addEventListener('click', () => navigate('#/q/' + q.qid));
      box.appendChild(item);
    });
    const again = el(`<button class="btn primary wide" style="margin-top:10px">틀린·애매한 문항 다시 풀기</button>`);
    again.addEventListener('click', () => startSession(review, `${SUM.label} 오답복습`));
    box.appendChild(again);
    app.appendChild(box);
  }

  app.appendChild(el(`<div class="nav-row"><a class="btn" href="#/solve">새 세션</a><a class="btn" href="#/stats">통계</a></div>`));
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
  for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d.toISOString().slice(0, 10)); }
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
route('notes', (app) => {
  app.appendChild(el(`<h1>학습 노트</h1>`));
  if (!DATA.notes.length) {
    app.appendChild(el(`<div class="empty">아직 노트가 없습니다.<br><span class="small">저장소의 <code>notes/</code> 폴더에 마크다운 파일을 추가하고<br><code>node scripts/build.mjs</code> 를 실행하세요.</span></div>`));
    return;
  }
  app.appendChild(el(`<label class="field"><input type="text" id="nq" placeholder="노트 검색 (제목·태그·본문)"></label>`));
  const listWrap = el(`<div id="nlist"></div>`);
  app.appendChild(listWrap);

  function draw(filter) {
    listWrap.innerHTML = '';
    const f = (filter || '').trim().toLowerCase();
    const notes = DATA.notes.filter((n) => !f ||
      n.title.toLowerCase().includes(f) ||
      (n.tags || []).some((t) => t.toLowerCase().includes(f)) ||
      n.md.toLowerCase().includes(f));
    if (!notes.length) { listWrap.appendChild(el(`<p class="muted small">검색 결과 없음</p>`)); return; }
    const cats = {};
    notes.forEach((n) => (cats[n.category] || (cats[n.category] = [])).push(n));
    Object.entries(cats).forEach(([cat, arr]) => {
      listWrap.appendChild(el(`<div class="note-cat">${esc(cat)}</div>`));
      arr.forEach((n) => {
        listWrap.appendChild(el(`<a class="note-item" href="#/note/${encodeURIComponent(n.slug)}">
          ${esc(n.title)} ${(n.tags || []).map((t) => `<span class="pill">${esc(t)}</span>`).join(' ')}
          <span class="small muted"> · 연결 문항 ${n.questions.length}</span></a>`));
      });
    });
  }
  draw('');
  $('#nq', app).addEventListener('input', (e) => draw(e.target.value));
});

/* ============ 노트 상세 ============ */
route('note', (app, args) => {
  const slug = decodeURIComponent(args.join('/'));
  const n = NOTE_BY_SLUG.get(slug);
  if (!n) { app.appendChild(el(`<div class="empty">노트를 찾을 수 없습니다.</div>`)); return; }
  app.appendChild(el(`<a class="btn sm" href="#/notes">← 노트 목록</a>`));
  app.appendChild(el(`<h1>${esc(n.title)}</h1>`));
  app.appendChild(el(`<div class="row tight" style="margin-bottom:8px">
    ${n.domain ? `<span class="pill accent">${esc(n.domain)}</span>` : ''}
    ${(n.tags || []).map((t) => `<span class="pill">${esc(t)}</span>`).join('')}</div>`));
  const md = el(`<div class="card markdown"></div>`);
  md.innerHTML = window.marked ? window.marked.parse(n.md) : `<pre>${esc(n.md)}</pre>`;
  app.appendChild(md);

  if (n.questions.length) {
    const box = el(`<div class="card"><h3>연결된 기출 문항</h3></div>`);
    n.questions.forEach((qid) => {
      const q = BY_QID.get(qid); if (!q) return;
      const item = el(`<div class="rank-item"><span class="pill accent">${esc(qLabel(q))}</span>
        <span class="small" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(q.question.slice(0, 36))}</span></div>`);
      item.addEventListener('click', () => navigate('#/q/' + qid));
      box.appendChild(item);
    });
    const all = el(`<button class="btn primary wide" style="margin-top:10px">연결 문항 모두 풀기</button>`);
    all.addEventListener('click', () => startSession(n.questions.filter((id) => BY_QID.has(id)), `${n.title} 관련 ${n.questions.length}문항`));
    box.appendChild(all);
    app.appendChild(box);
  }
});

/* ============ 단일 문항 (#/q/<qid>) ============ */
route('q', (app, args) => {
  const q = BY_QID.get(args[0]);
  if (!q) { app.appendChild(el(`<div class="empty">문항을 찾을 수 없습니다.</div>`)); return; }

  const top = el(`<div class="row tight" style="margin-bottom:6px">
    <a class="btn sm" href="#/search">🔍 검색</a>
    ${SESSION && SESSION.qids && SESSION.qids.length ? `<a class="btn sm" href="#/session">풀던 세션으로 →</a>` : ''}
  </div>`);
  app.appendChild(top);
  app.appendChild(el(`<h1>${esc(qLabel(q))}</h1>`));
  app.appendChild(questionCard(q));

  const sameRound = QUESTIONS.filter((x) => x.round === q.round).sort((a, b) => a.no - b.no);
  const i = sameRound.findIndex((x) => x.qid === q.qid);
  const nav = el(`<div class="nav-row"></div>`);
  const prev = el(`<button class="btn">← ${q.round}회 이전</button>`);
  prev.disabled = i <= 0;
  if (i > 0) prev.addEventListener('click', () => navigate('#/q/' + sameRound[i - 1].qid));
  const next = el(`<button class="btn">${q.round}회 다음 →</button>`);
  next.disabled = i >= sameRound.length - 1;
  if (i < sameRound.length - 1) next.addEventListener('click', () => navigate('#/q/' + sameRound[i + 1].qid));
  nav.append(prev, next);
  app.appendChild(nav);

  const whole = el(`<button class="btn sm wide" style="margin-top:10px">${q.round}회 전체 풀기 (${sameRound.length}문항) →</button>`);
  whole.addEventListener('click', () => startSession(sameRound.map((x) => x.qid), `${q.round}회 ${sameRound.length}문항`));
  app.appendChild(whole);
});

/* ============ 통합 검색 (#/search/<query>) ============ */
let SEARCH_INDEX = null;
function searchIndex() {
  if (SEARCH_INDEX) return SEARCH_INDEX;
  const qs = QUESTIONS.map((q) => ({
    q,
    full: `${q.round}회 ${q.no}번 ${q.type} ${q.domain} ${q.question} ${q.answer} ${q.explanation || ''} ${q.supplement || ''}`.toLowerCase(),
    shallow: `${q.round}회 ${q.no}번 ${q.type} ${q.domain} ${q.question}`.toLowerCase(),
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
      item.addEventListener('click', () => navigate('#/q/' + q.qid));
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

  // 즐겨찾기
  const favBox = el(`<div class="card"><h3>즐겨찾기 (${store.state.favorites.length})</h3></div>`);
  if (!store.state.favorites.length) favBox.appendChild(el(`<p class="muted small">문제 카드의 ☆ 를 눌러 추가하세요.</p>`));
  else {
    store.state.favorites.forEach((qid) => {
      const q = BY_QID.get(qid); if (!q) return;
      const item = el(`<div class="rank-item"><span class="pill accent">${esc(qLabel(q))}</span>
        <span class="small" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(q.question.slice(0, 36))}</span></div>`);
      item.addEventListener('click', () => navigate('#/q/' + qid));
      favBox.appendChild(item);
    });
    favBox.appendChild(el(`<button class="btn sm" id="favAll" style="margin-top:8px">즐겨찾기 전체 풀기</button>`));
  }
  app.appendChild(favBox);
  if ($('#favAll', app)) $('#favAll', app).addEventListener('click', () =>
    startSession(store.state.favorites.filter((id) => BY_QID.has(id)), `즐겨찾기 ${store.state.favorites.length}문항`));

  // 메모 모아보기
  const memoQids = Object.entries(store.state.results).filter(([, r]) => r.memo).map(([qid]) => qid);
  const memoBox = el(`<div class="card"><h3>내 메모 (${memoQids.length})</h3></div>`);
  if (!memoQids.length) memoBox.appendChild(el(`<p class="muted small">문제 풀이 중 남긴 메모가 여기 모입니다.</p>`));
  memoQids.forEach((qid) => {
    const q = BY_QID.get(qid); if (!q) return;
    const item = el(`<div class="rank-item" style="display:block">
      <span class="pill accent">${esc(qLabel(q))}</span>
      <div class="small" style="margin-top:4px">${esc(store.state.results[qid].memo)}</div></div>`);
    item.addEventListener('click', () => navigate('#/q/' + qid));
    memoBox.appendChild(item);
  });
  app.appendChild(memoBox);

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
  </div>`);
  $('#showAns', setBox).addEventListener('change', (e) => { set.alwaysShowAnswer = e.target.checked; store.save(); });
  $('#theme', setBox).addEventListener('change', (e) => { set.theme = e.target.value; store.save(); applyTheme(); });
  app.appendChild(setBox);

  // 데이터 관리
  const dataBox = el(`<div class="card stack"><h3>데이터 (기기 간 이동)</h3>
    <p class="small muted">학습 기록은 이 브라우저에만 저장됩니다. 다른 기기로 옮기려면 내보낸 파일을 그 기기에서 가져오세요.</p>
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
    if (confirm('모든 학습 기록·즐겨찾기·메모를 삭제합니다. 계속할까요?')) { store.reset(); SESSION = null; toast('초기화됨'); render(); }
  });
  app.appendChild(dataBox);

  app.appendChild(el(`<p class="small muted center" style="margin-top:20px">
    최근 세션 ${store.state.sessions.length}회 · 데이터 ${DATA.builtAt.slice(0, 10)}</p>`));
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
      SESSION = (store.state.session && Array.isArray(store.state.session.qids) && store.state.session.qids.length) ? store.state.session : null;
      store.state.session = SESSION;
      store.save(); applyTheme(); toast('가져오기 완료'); render();
    } catch (err) { toast('가져오기 실패: ' + err.message); }
  };
  reader.readAsText(file);
}

/* ============ 부팅 ============ */
store.load();
applyTheme();
if (store.state.session && Array.isArray(store.state.session.qids) && store.state.session.qids.length) {
  SESSION = store.state.session;
  if (!Array.isArray(SESSION.seen)) SESSION.seen = [];
} else {
  store.state.session = null;
}
if (!location.hash) location.hash = '#/home';
render();

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
