// 노트 품질 린터 — 경고만 출력(종료코드 0). 사용: node scripts/lint-notes.mjs [--strict]
// 규칙은 CLAUDE.md 「노트 작성 규칙」과 동일.
import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['exams/EIS/notes'];
const MAX_BULLET = 80, MAX_CELL = 70;
const KINDS = new Set(['시험', '함정', '암기', '팁', '현행']);

function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.md') ? [path.join(d, e.name)] : []);
}

const warns = [];
const W = (f, ln, msg) => warns.push(`${f}:${ln}  ${msg}`);

for (const f of ROOTS.flatMap(walk)) {
  const raw = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
  const fmQs = new Set();
  if (m) {
    const q = m[1].match(/^questions:\s*\[(.*)\]/m);
    if (q) q[1].split(',').map((x) => x.trim()).filter(Boolean).forEach((x) => fmQs.add(x));
  }
  const bodyStart = m ? m[0].split('\n').length - 1 : 0;
  const lines = raw.split('\n');
  let inCode = false;
  lines.forEach((line, i) => {
    const ln = i + 1;
    if (ln <= bodyStart) return;
    if (/^```/.test(line)) { inCode = !inCode; return; }
    if (inCode) return;
    if (/^####/.test(line)) W(f, ln, '#### 사용 금지');
    if (/^##\s+\d+[.)]\s/.test(line)) W(f, ln, '## 제목에 수동 번호(CSS 자동 번호와 중복)');
    const co = line.match(/^>\s*\[!([^\]]+)\]/);
    if (co && !KINDS.has(co[1])) W(f, ln, `알 수 없는 콜아웃 [!${co[1]}]`);
    if (/^\s*[-*]\s/.test(line)) {
      const t = line.replace(/^\s*[-*]\s+/, '').replace(/\{\{[^}]*\}\}/g, '').replace(/[*`]/g, '');
      if (t.length > MAX_BULLET) W(f, ln, `불릿 ${t.length}자 (>${MAX_BULLET})`);
    }
    if (/^\|/.test(line) && !/^\|[\s:|-]+\|?$/.test(line)) {
      line.split('|').slice(1, -1).forEach((c) => {
        const t = c.replace(/[*`]/g, '').trim();
        if (t.length > MAX_CELL) W(f, ln, `표 셀 ${t.length}자 (>${MAX_CELL}): ${t.slice(0, 16)}…`);
      });
    }
    for (const b of line.matchAll(/\{\{\s*(\d+-\d+)\s*\}\}/g)) {
      if (m && fmQs.size && !fmQs.has(b[1])) W(f, ln, `배지 {{${b[1]}}} 가 frontmatter questions 에 없음`);
    }
  });
}

if (warns.length) console.log(warns.join('\n'));
console.log(`\n노트 린트: 경고 ${warns.length}건`);
if (process.argv.includes('--strict') && warns.length) process.exit(1);
