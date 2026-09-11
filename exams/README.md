# exams/

시험 트랙별 원본 데이터. 트랙 하나 = 폴더 하나(`sil`=정보보안기사 실기, `cppg`=CPPG).

**새 시험 추가 절차**: `exams/<코드>/` 폴더를 만들고, `scripts/build.mjs` 에 그 폴더를 읽어
`docs/data/<코드>.js` 를 쓰는 로더 함수를 하나 추가한 뒤, `CLAUDE.md` 에 스키마 절을 하나
추가한다. 각 트랙의 정확한 파일 구조·스키마는 `CLAUDE.md` 참고.
