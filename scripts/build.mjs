// 실기/ (원본) + meta/ (영역·해설) + notes/ (학습노트) → docs/data/bundle.js
// 외부 의존성 없음. `node scripts/build.mjs` 로 실행.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname, basename, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(ROOT, '실기');
const META_DIR = join(ROOT, 'meta');
const NOTES_DIR = join(ROOT, 'notes');
const PRED_DIR = join(ROOT, '예상문제');   // 기사 모의고사용 신규 예상문제 (실기/ 원본과 별개)
const OUT_FILE = join(ROOT, 'docs', 'data', 'bundle.js');

const CPPG_DIR = join(ROOT, 'cppg');
const CPPG_NOTES_DIR = join(CPPG_DIR, 'notes');
const CPPG_QUIZ_DIR = join(CPPG_DIR, 'quiz');
const CPPG_OUT_FILE = join(ROOT, 'docs', 'data', 'cppg.js');

const DOMAINS = ['시스템보안', '네트워크보안', '애플리케이션보안', '정보보안일반', '정보보안관리및법규'];
const TYPES = ['단답형', '서술형', '실무형'];

const warnings = [];
const warn = (m) => warnings.push(m);

// ---------- 1. 원본 회차 ----------
function loadRounds() {
  const rounds = [];
  for (const name of readdirSync(SRC_DIR)) {
    const dir = join(SRC_DIR, name);
    if (!statSync(dir).isDirectory()) continue;
    const m = name.match(/^(\d+)회\((\d{4}-\d{2}-\d{2})\)$/);
    if (!m) { warn(`회차 폴더명 형식 불일치: ${name}`); continue; }
    const round = Number(m[1]);
    const date = m[2];
    const jsonName = readdirSync(dir).find((f) => f.endsWith('.json'));
    if (!jsonName) { warn(`${name}: json 없음`); continue; }
    const raw = JSON.parse(readFileSync(join(dir, jsonName), 'utf8'));
    const questions = raw.data.map((q) => ({
      qid: `r${round}q${q.id}`,
      round,
      no: q.id,
      type: q.type,
      question: q.question,
      answer: q.answer,
      domain: null,
      explanation: null,
      supplement: null,
      notes: [],
    }));
    rounds.push({ round, date, questions });
  }
  rounds.sort((a, b) => a.round - b.round);
  return rounds;
}

// ---------- 2. meta 병합 ----------
function applyMeta(rounds) {
  const byRound = new Map(rounds.map((r) => [r.round, r]));
  if (!existsSync(META_DIR)) return;
  for (const f of readdirSync(META_DIR)) {
    if (!f.endsWith('.json')) continue;
    const meta = JSON.parse(readFileSync(join(META_DIR, f), 'utf8'));
    const r = byRound.get(meta.round);
    if (!r) { warn(`meta/${f}: 대응 회차(${meta.round}) 없음`); continue; }
    const byNo = new Map(r.questions.map((q) => [String(q.no), q]));
    for (const [no, info] of Object.entries(meta.questions || {})) {
      const q = byNo.get(String(no));
      if (!q) { warn(`meta/${f}: ${meta.round}회 ${no}번 문항이 원본에 없음`); continue; }
      if (info.domain) {
        if (!DOMAINS.includes(info.domain)) warn(`meta/${f}: ${no}번 domain 값 오류 "${info.domain}"`);
        q.domain = info.domain;
      }
      if (info.explanation) q.explanation = info.explanation;
      // 원본 지문(로그·설명문 등)이 누락된 문항의 보충 자료
      if (info.supplement) q.supplement = info.supplement;
    }
  }
}

// ---------- 3. notes ----------
function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const mm = line.match(/^([A-Za-z_]\w*):\s*(.*)$/);
    if (!mm) continue;
    let [, key, val] = mm;
    val = val.trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      meta[key] = val.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else {
      meta[key] = val.replace(/^["']|["']$/g, '');
    }
  }
  return { meta, body: m[2] };
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (name.endsWith('.md')) acc.push(p);
  }
  return acc;
}

function loadNotes(rounds) {
  const notes = [];
  if (!existsSync(NOTES_DIR)) return notes;
  const qidExists = new Set();
  for (const r of rounds) for (const q of r.questions) qidExists.add(q.qid);
  const qByQid = new Map();
  for (const r of rounds) for (const q of r.questions) qByQid.set(q.qid, q);

  for (const file of walk(NOTES_DIR)) {
    const rel = relative(NOTES_DIR, file).split(sep);
    const category = rel.length > 1 ? rel[0] : '기타';
    const slug = rel.join('/').replace(/\.md$/, '');
    const { meta, body } = parseFrontmatter(readFileSync(file, 'utf8'));
    const refs = [];
    for (const ref of meta.questions || []) {
      const rm = String(ref).match(/^(\d+)[-_](\d+)$/);
      if (!rm) { warn(`notes/${slug}: questions 항목 형식 오류 "${ref}" (회차-번호)`); continue; }
      const qid = `r${rm[1]}q${rm[2]}`;
      if (!qidExists.has(qid)) { warn(`notes/${slug}: ${ref} 문항 없음`); continue; }
      refs.push(qid);
      qByQid.get(qid).notes.push(slug);
    }
    notes.push({
      slug,
      category,
      title: meta.title || basename(slug),
      domain: meta.domain || null,
      tags: meta.tags || [],
      questions: refs,
      predicted: [],   // loadPredicted 가 채움 (예상문제 → 노트 역인덱스)
      md: body.trim(),
    });
  }
  notes.sort((a, b) => a.slug.localeCompare(b.slug, 'ko'));
  return notes;
}

// ---------- 3b. 예상문제 (기사 모의고사) ----------
function loadPredicted(notes, rounds) {
  const items = [];
  if (!existsSync(PRED_DIR)) return { items, perType: {}, perDomain: {} };
  const bySlug = new Map(notes.map((n) => [n.slug, n]));
  const qidExists = new Set();
  for (const r of rounds) for (const q of r.questions) qidExists.add(q.qid);
  const seenId = new Set();
  const perDomain = {};

  for (const f of readdirSync(PRED_DIR)) {
    if (!f.endsWith('.json')) continue;
    const pack = JSON.parse(readFileSync(join(PRED_DIR, f), 'utf8'));
    const fileDomain = f.replace(/\.json$/, '');
    if (pack.domain !== fileDomain) warn(`예상문제/${f}: domain "${pack.domain}" 이 파일명과 불일치`);
    if (!DOMAINS.includes(pack.domain)) { warn(`예상문제/${f}: domain "${pack.domain}" 미정의`); continue; }
    for (const it of pack.items || []) {
      if (!it.id) { warn(`예상문제/${f}: id 없는 문항`); continue; }
      if (seenId.has(it.id)) { warn(`예상문제/${f}: id 중복 "${it.id}"`); continue; }
      if (qidExists.has(it.id)) { warn(`예상문제/${f}: id "${it.id}" 가 기출 qid 와 충돌`); continue; }
      seenId.add(it.id);
      if (!TYPES.includes(it.type)) warn(`예상문제: ${it.id} type "${it.type}" 오류 (${TYPES.join('/')})`);
      if (!it.question || !String(it.question).trim()) warn(`예상문제: ${it.id} question 비어있음`);
      if (!it.answer || !String(it.answer).trim()) warn(`예상문제: ${it.id} answer 비어있음`);
      const noteSlugs = [];
      for (const s of it.notes || []) {
        if (!bySlug.has(s)) { warn(`예상문제: ${it.id} note "${s}" 노트 없음`); continue; }
        noteSlugs.push(s);
        bySlug.get(s).predicted.push(it.id);
      }
      perDomain[pack.domain] = (perDomain[pack.domain] || 0) + 1;
      items.push({
        qid: it.id,
        no: items.length + 1,
        predicted: true,
        round: null,
        type: it.type,
        question: it.question,
        answer: it.answer,
        domain: pack.domain,
        explanation: it.explanation || null,
        supplement: it.supplement || null,
        notes: noteSlugs,
        tags: it.tags || [],
      });
    }
  }

  // 모의고사 유형 배분(단답 12 / 서술 4 / 실무 2) 최소치 점검
  const perType = {};
  for (const it of items) perType[it.type] = (perType[it.type] || 0) + 1;
  const need = { 단답형: 12, 서술형: 4, 실무형: 2 };
  for (const [t, n] of Object.entries(need)) {
    if ((perType[t] || 0) < n) warn(`예상문제: ${t} ${perType[t] || 0}개 < 모의고사 1회 편성 ${n}개`);
  }
  return { items, perType, perDomain };
}

// ---------- CPPG (개인정보관리사) ----------
const CPPG_REF_CATS = ['참고자료'];   // subjects.json 에 없어도 허용되는 노트 카테고리 (문제 연결 없이 정리용)

function buildCppg() {
  if (!existsSync(CPPG_DIR)) return null;
  const cfg = JSON.parse(readFileSync(join(CPPG_DIR, 'subjects.json'), 'utf8'));
  const subjects = cfg.subjects || [];
  const byId = new Map(subjects.map((s) => [s.id, s]));
  const byName = new Map(subjects.map((s) => [s.name, s]));
  // 노트 목록 정렬 순서: subjects.json 과목 순서 → 참고자료 카테고리 → 그 외
  const catOrder = (c) => {
    const i = subjects.findIndex((s) => s.name === c);
    if (i >= 0) return i;
    const r = CPPG_REF_CATS.indexOf(c);
    return r >= 0 ? subjects.length + r : subjects.length + CPPG_REF_CATS.length + 1;
  };

  // 노트: notes/<과목명>/<슬러그>.md
  const notes = [];
  const noteBySlug = new Map();
  if (existsSync(CPPG_NOTES_DIR)) {
    for (const file of walk(CPPG_NOTES_DIR)) {
      const rel = relative(CPPG_NOTES_DIR, file).split(sep);
      const folder = rel.length > 1 ? rel[0] : '기타';
      const slug = rel.join('/').replace(/\.md$/, '');
      const isRef = CPPG_REF_CATS.includes(folder);
      if (!byName.has(folder) && !isRef) warn(`cppg/notes/${slug}: 폴더명 "${folder}" 이 subjects.json 에 없음`);
      const { meta, body } = parseFrontmatter(readFileSync(file, 'utf8'));
      const note = {
        slug,
        subject: meta.subject || folder,
        title: meta.title || basename(slug),
        tags: meta.tags || [],
        quiz: [],
        md: body.trim(),
      };
      if (isRef) note.ref = true;
      notes.push(note);
      noteBySlug.set(slug, note);
    }
  }
  notes.sort((a, b) => catOrder(a.subject) - catOrder(b.subject) || a.slug.localeCompare(b.slug, 'ko'));

  // 문제: quiz/<과목id>.json
  const quiz = [];
  const seenId = new Set();
  if (existsSync(CPPG_QUIZ_DIR)) {
    for (const f of readdirSync(CPPG_QUIZ_DIR)) {
      if (!f.endsWith('.json')) continue;
      const pack = JSON.parse(readFileSync(join(CPPG_QUIZ_DIR, f), 'utf8'));
      const fileSubj = f.replace(/\.json$/, '');
      if (pack.subject !== fileSubj) warn(`cppg/quiz/${f}: subject "${pack.subject}" 가 파일명과 불일치`);
      if (!byId.has(pack.subject)) warn(`cppg/quiz/${f}: subject "${pack.subject}" 미정의`);
      for (const it of pack.items || []) {
        if (!it.id) { warn(`cppg/quiz/${f}: id 없는 문항`); continue; }
        if (seenId.has(it.id)) { warn(`cppg/quiz/${f}: id 중복 "${it.id}"`); continue; }
        seenId.add(it.id);
        const choices = it.choices || [];
        if (!it.stem || !String(it.stem).trim()) warn(`cppg/quiz: ${it.id} stem 비어있음`);
        if (choices.length < 2) warn(`cppg/quiz: ${it.id} 선택지 ${choices.length}개 (2개 이상 필요)`);
        if (!(it.answer >= 1 && it.answer <= choices.length)) warn(`cppg/quiz: ${it.id} answer(${it.answer}) 범위 밖 (1~${choices.length})`);
        let noteSlug = it.note || null;
        if (noteSlug) {
          if (!noteBySlug.has(noteSlug)) { warn(`cppg/quiz: ${it.id} note "${noteSlug}" 노트 없음`); noteSlug = null; }
          else noteBySlug.get(noteSlug).quiz.push(it.id);
        }
        quiz.push({
          id: it.id,
          subject: pack.subject,
          stem: it.stem,
          choices,
          answer: it.answer,
          explain: it.explain || null,
          note: noteSlug,
          tags: it.tags || [],
          difficulty: it.difficulty || null,
        });
      }
    }
  }

  // 과목별 문제 수 vs 모의고사 배분
  const perSubject = {};
  for (const s of subjects) perSubject[s.id] = 0;
  for (const q of quiz) if (perSubject[q.subject] != null) perSubject[q.subject]++;
  for (const s of subjects) {
    if (perSubject[s.id] < s.count) {
      warn(`cppg: ${s.no}과목(${s.name}) 문제 ${perSubject[s.id]}개 < 모의고사 배분 ${s.count}개`);
    }
  }

  return {
    builtAt: new Date().toISOString(),
    config: cfg,
    subjects,
    notes,
    quiz,
    stats: { subjects: subjects.length, notes: notes.length, quiz: quiz.length, perSubject },
  };
}

function writeCppg(cppg) {
  mkdirSync(dirname(CPPG_OUT_FILE), { recursive: true });
  writeFileSync(CPPG_OUT_FILE, `// 자동 생성물 — scripts/build.mjs 가 생성. 직접 수정 금지.\nwindow.CPPG_DATA = ${JSON.stringify(cppg)};\n`, 'utf8');
}

// ---------- 4. 출력 ----------
function main() {
  const rounds = loadRounds();
  applyMeta(rounds);
  const notes = loadNotes(rounds);
  const { items: predicted, perType: predType, perDomain: predDomain } = loadPredicted(notes, rounds);

  let total = 0, classified = 0, explained = 0, supplemented = 0;
  for (const r of rounds) for (const q of r.questions) {
    total++;
    if (q.domain) classified++;
    if (q.explanation) explained++;
    if (q.supplement) supplemented++;
  }

  const data = {
    builtAt: new Date().toISOString(),
    domains: DOMAINS,
    rounds,
    notes,
    predicted,
    stats: {
      total, classified, explained, supplemented, notes: notes.length,
      predicted: predicted.length, predType, predDomain,
    },
  };

  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, `// 자동 생성물 — scripts/build.mjs 가 생성. 직접 수정 금지.\nwindow.EXAM_DATA = ${JSON.stringify(data)};\n`, 'utf8');

  console.log(`✔ ${rounds.length}개 회차 · ${total}문항`);
  console.log(`  영역 분류 ${classified}/${total} (${(classified / total * 100).toFixed(0)}%)`);
  console.log(`  해설 ${explained}/${total}`);
  console.log(`  보충 지문 ${supplemented}건`);
  console.log(`  노트 ${notes.length}개`);

  if (predicted.length) {
    const abbr = { 시스템보안: '시스템', 네트워크보안: '네트워크', 애플리케이션보안: '앱', 정보보안일반: '일반', 정보보안관리및법규: '법규' };
    console.log(`\n✔ 예상문제 ${predicted.length}개 (단답 ${predType.단답형 || 0} / 서술 ${predType.서술형 || 0} / 실무 ${predType.실무형 || 0})`);
    console.log(`  영역별 ${DOMAINS.map((d) => `${abbr[d]}:${predDomain[d] || 0}`).join(' ')}`);
    const linked = predicted.filter((q) => q.notes.length).length;
    console.log(`  노트 연결 ${linked}/${predicted.length}`);
  }

  const cppg = buildCppg();
  if (cppg) {
    writeCppg(cppg);
    const refCnt = cppg.notes.filter((n) => n.ref).length;
    console.log(`\n✔ CPPG: ${cppg.stats.subjects}과목 · 노트 ${cppg.stats.notes}개(참고자료 ${refCnt}) · 문제 ${cppg.stats.quiz}문항`);
    const linked = cppg.quiz.filter((q) => q.note).length;
    console.log(`  문제–노트 연결 ${linked}/${cppg.stats.quiz}`);
    console.log(`  과목별 문제 ${cppg.subjects.map((s) => `${s.no}:${cppg.stats.perSubject[s.id]}`).join(' ')}`);
    console.log(`  → ${relative(ROOT, CPPG_OUT_FILE)}`);
  }

  if (warnings.length) {
    console.log(`\n⚠ 경고 ${warnings.length}건:`);
    for (const w of warnings) console.log(`  - ${w}`);
  }
  console.log(`\n→ ${relative(ROOT, OUT_FILE)}`);
}

main();
