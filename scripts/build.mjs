// 실기/ (원본) + meta/ (영역·해설) + notes/ (학습노트) → docs/data/bundle.js
// 외부 의존성 없음. `node scripts/build.mjs` 로 실행.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname, basename, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(ROOT, '실기');
const META_DIR = join(ROOT, 'meta');
const NOTES_DIR = join(ROOT, 'notes');
const OUT_FILE = join(ROOT, 'docs', 'data', 'bundle.js');

const DOMAINS = ['시스템보안', '네트워크보안', '애플리케이션보안', '정보보안일반', '정보보안관리및법규'];

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
      md: body.trim(),
    });
  }
  notes.sort((a, b) => a.slug.localeCompare(b.slug, 'ko'));
  return notes;
}

// ---------- 4. 출력 ----------
function main() {
  const rounds = loadRounds();
  applyMeta(rounds);
  const notes = loadNotes(rounds);

  let total = 0, classified = 0, explained = 0;
  for (const r of rounds) for (const q of r.questions) {
    total++;
    if (q.domain) classified++;
    if (q.explanation) explained++;
  }

  const data = {
    builtAt: new Date().toISOString(),
    domains: DOMAINS,
    rounds,
    notes,
    stats: { total, classified, explained, notes: notes.length },
  };

  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, `// 자동 생성물 — scripts/build.mjs 가 생성. 직접 수정 금지.\nwindow.EXAM_DATA = ${JSON.stringify(data)};\n`, 'utf8');

  console.log(`✔ ${rounds.length}개 회차 · ${total}문항`);
  console.log(`  영역 분류 ${classified}/${total} (${(classified / total * 100).toFixed(0)}%)`);
  console.log(`  해설 ${explained}/${total}`);
  console.log(`  노트 ${notes.length}개`);
  if (warnings.length) {
    console.log(`\n⚠ 경고 ${warnings.length}건:`);
    for (const w of warnings) console.log(`  - ${w}`);
  }
  console.log(`\n→ ${relative(ROOT, OUT_FILE)}`);
}

main();
