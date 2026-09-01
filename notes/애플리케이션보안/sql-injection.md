---
title: SQL Injection & 대응
domain: 애플리케이션보안
questions: [2-15, 4-12, 5-4, 6-14, 11-14, 22-10, 22-17, 23-6, 27-17, 30-18]
tags: [SQLi, Blind SQL Injection, PreparedStatement, 인증우회]
---

## 원리

입력값을 문자열로 이어붙여 쿼리를 생성하면 입력이 **쿼리 구조의 일부**가 된다.

```sql
SELECT * FROM member WHERE id='user1' AND pw='입력값'
```
`pw` 자리에 `' OR '1'='1` → `... AND pw='' OR '1'='1'` → **항상 참** → 인증 우회 / 전체 행 노출
`id` 자리에 `admin'--` → `... WHERE id='admin'--' AND pw=...` → **뒤 조건 주석 처리** → admin 로그인

## 유형

| 유형 | 설명 |
|---|---|
| **Error based** | 오류 메시지에 DB 정보가 노출 |
| **Union based** | `UNION SELECT`로 다른 테이블 데이터를 결과에 합침 |
| **Blind (Boolean)** | 결과가 안 보여도 참/거짓에 따른 페이지 변화로 1비트씩 추출 (`substr()`, `length()`, `AND 1=1`/`AND 1=2`) |
| **Blind (Time)** | `SLEEP(5)` 등 응답 시간 차이로 추출 |
| **Stored Procedure** | `xp_cmdshell` 등으로 OS 명령 실행 |

## 대응 (우선순위)

1. **PreparedStatement / 파라미터 바인딩** (근본 대응)
   ```java
   PreparedStatement p = con.prepareStatement("SELECT * FROM board WHERE gubun = ?");
   p.setString(1, gubun);          // 입력이 데이터로만 처리 → 쿼리 구조 불변
   ```
   - ORM(MyBatis `#{}`, JPA), 저장 프로시저(동적 SQL 미사용)
2. **입력값 검증** — 화이트리스트(타입·길이·형식), 특수문자(`'`, `--`, `;`, `/*`) 필터 (서버 측 — 클라이언트 검증은 프록시로 우회됨)
3. **최소권한 DB 계정** — 애플리케이션 계정에 DDL·시스템 권한 제거
4. **오류 메시지 최소화** — 상세 DB 오류를 사용자에게 노출 금지
5. **WAF** — 알려진 패턴 차단 (보조)

## MyBatis 주의

- `#{param}` → PreparedStatement 바인딩 (안전)
- `${param}` → 문자열 치환 (**SQLi 취약**) — ORDER BY 컬럼명 등 불가피할 때만 화이트리스트 검증 후 사용
