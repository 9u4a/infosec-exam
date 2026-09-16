---
title: DB 보안 (위협 유형 · 암호화 · 마스킹 · 감사)
domain: 애플리케이션보안
questions: [8-1, 12-4, 18-11, 21-6, 24-2, 26-6, 26-17, 28-17, 30-5]
tags: [집성, 추론, 데이터디들링, TDE, API방식, Plug-in방식, 마스킹, 감사로그, PreparedStatement]
related: [애플리케이션보안/sql-injection, 정보보안일반/대칭키-암호-알고리즘, 정보보안관리및법규/개인정보-안전성확보조치]
---

## DB 보안 위협 유형 (12-4)

| 위협 | 설명 |
|---|---|
| **집성(Aggregation)** | 개별로는 낮은 등급 데이터를 **모아** 더 민감한 정보를 도출 |
| **추론(Inference)** | 허용된 질의 결과로부터 **논리적으로** 비인가 정보를 유추 (통계 질의로 개인값 특정) |
| **데이터 디들링(Data Diddling)** | 입력·처리 전후에 몰래 데이터를 **위·변조** |
| 무단 접근 | 권한 관리 미흡으로 비인가자가 직접 접근 |

- 추론·집성 대응: 다중 인스턴스화(polyinstantiation), 질의 제한(최소 결과 수), 노이즈 추가, 셀 은닉.

## SQL 4분류 (DDL/DML/DCL/TCL)

| 분류 | 영문 | 주요 명령 | 용도 |
|---|---|---|---|
| DDL | Data Definition Language | `CREATE`, `DROP`, `ALTER` | 테이블·구조 정의 |
| DML | Data Manipulation Language | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | 데이터 조작 |
| DCL | Data Control Language | `GRANT`, `REVOKE` | 권한 부여·취소 |
| TCL | Transaction Control Language | `COMMIT`, `ROLLBACK` | 트랜잭션 제어 |

## GRANT / REVOKE 문법과 View 접근통제

```sql
-- 기본 문법
GRANT 권한 ON 객체 TO 사용자;
REVOKE 권한 ON 객체 FROM 사용자;
DENY 권한 ON 객체 TO 사용자;              -- SQL Server 전용, GRANT보다 우선하는 명시적 거부

-- 역할(ROLE)로 최소권한 부여
CREATE ROLE USERREADONLY;
GRANT SELECT ON CUSTOMER_TABLE TO USERREADONLY;
GRANT USERREADONLY TO username;

-- View로 민감 컬럼 숨김(집성·추론 방어에도 활용)
CREATE VIEW emp_view AS
  SELECT emp_id, emp_name, department FROM employee WHERE department = '영업부';
GRANT SELECT ON emp_view TO user1;        -- 원본 테이블의 salary 컬럼은 접근 불가
```
View는 특정 컬럼·행만 노출하는 가상 테이블이라 민감 컬럼 은닉 + 행 단위(WHERE) 접근 제어를 동시에 구현하는 핵심 수단이다.

## PreparedStatement (18-11)

- 개념: SQL 구문의 **구조를 먼저 컴파일**(파싱·최적화)해 두고, 이후 사용자 입력은 **데이터 바인딩**(`?` 파라미터)으로만 전달.
- SQLi를 막는 이유: 입력값이 **SQL 명령의 일부로 해석되지 않고** 순수 값으로만 처리되므로, `' OR '1'='1` 을 넣어도 문자열 리터럴로 취급.
- 정적 쿼리 + 바인딩 조합이 핵심. 동적으로 테이블/컬럼명을 바꿔야 하면 화이트리스트로.

## XML 쿼리 인젝션 대응 (26-6)

XPath/XQuery 파라미터도 **공통 검증 → 필터링 → 파라미터 바인딩(API)** 을 거쳐야 XML 구조 조작(XPath Injection)을 막을 수 있다.

## DB 암호화 방식 (24-2)

| 방식 | 암복호화 모듈 위치 | 특징 |
|---|---|---|
| **API 방식** | 애플리케이션 서버 (라이브러리) | 앱이 모듈 호출. 앱 수정 필요, DB 부하 적음 |
| **Plug-in 방식** | DB 서버 | DB가 트리거·뷰로 자동 처리. 앱 수정 최소, DB 부하 증가 |
| **TDE (Transparent Data Encryption)** | DB 엔진 내장 | 저장(데이터파일·백업) 시 자동 암·복호. 앱 투명, 컬럼/테이블스페이스 단위 |
| 하이브리드 | API + Plug-in | 상황별 혼용 |

## DB 민감정보 마스킹 (30-5)

| 방식 | 동작 |
|---|---|
| **조회 결과 변조(응답 마스킹)** | DB → 클라이언트 전달 **전에** 결과셋의 민감 컬럼을 마스킹(`홍길동` → `홍*동`) |
| **SQL 변조 마스킹** | 들어오는 **SQL 구문을 분석**해 민감 컬럼에 마스킹 함수를 씌워 재작성 후 실행 |

- 정적 마스킹(테스트 DB 복제 시 영구 치환) vs 동적 마스킹(운영 중 실시간).

## DB 접근권한 관리 (26-17)

일반/원격 사용자에게 **부여 금지** 권한(Oracle 예): `CREATE USER`, `DROP USER`, `DROP ANY TABLE`, `ALTER SYSTEM`, `GRANT ANY PRIVILEGE`, `SELECT ANY TABLE`.
**최소화 방법**

1. 역할(ROLE) 기반 부여
2. 업무별 최소 권한
3. `PUBLIC` 에 부여된 불필요 권한 회수
4. 주기적 권한 검토·미사용 계정 잠금

## DB 감사(Audit) 로그 (28-17)

Oracle `show parameter audit`:

| 파라미터 | 의미 |
|---|---|
| `audit_trail` | 감사 기록 위치 — `DB` / `OS` / `XML` / `NONE`(비활성) |
| `audit_file_dest` | OS 감사 파일 저장 경로 (`.../adump`) |
| `audit_sys_operations` | SYS(SYSDBA) 계정 작업 감사 여부 — `TRUE` 권장 |

- 점검 포인트: `audit_trail=NONE` 이면 감사 미수행(취약), `audit_sys_operations=FALSE` 면 관리자 행위 미기록.

## MySQL 외부 접속 설정 (8-1)

`bind-address = 127.0.0.1` → 로컬만 수신. 외부 허용하려면 주석 처리하거나 `0.0.0.0`(또는 특정 IP)으로.
> 보안 관점: 꼭 필요할 때만 열고, 방화벽으로 접속 IP 제한 + 계정별 host 지정(`user'@'10.0.0.5`) + SSL 강제.

```
# /etc/my.cnf
skip-networking          ← 네트워크 인터페이스 자체를 비활성화(로컬 소켓 접속만 허용, 가장 강력)

# root 계정 원격 접속 허용 여부 점검
SELECT user, host FROM mysql.user WHERE user='root';
# host 값이 '%'(전체 허용)이면 취약 → 'localhost'로 제한
```
기본 포트는 **3306/tcp**.

## Oracle DB 보안 점검 체크리스트

| 점검 항목 | 취약 상태 | 조치 |
|---|---|---|
| 불필요한 기본 계정 | `SCOTT`, `DEMO` 등 활성화 | `DROP USER` 또는 잠금 |
| 과도한 권한 | 일반 사용자에 `DBA` 롤 부여 | `REVOKE DBA FROM username` |
| PUBLIC 권한 | `PUBLIC` 롤에 민감 권한 | 최소화 |
| OS 인증 허용 | `REMOTE_OS_AUTHENTICATION=TRUE` | `ALTER SYSTEM SET REMOTE_OS_AUTHENTICATION=FALSE;`(`OS_ROLES`·`REMOTE_OS_ROLES`도 동일하게 FALSE) |
| 감사 미설정 | `AUDIT` 비활성 | `AUDIT SELECT, INSERT, UPDATE, DELETE ON 테이블 BY ACCESS;` |
