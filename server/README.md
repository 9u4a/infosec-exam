# 학습기록 동기화 서버 (Cloudflare Worker)

`docs/` 사이트(GitHub Pages)는 정적 파일만 서빙하므로, 학습기록을 서버에 저장하려면
아주 작은 백엔드가 필요하다. 이 폴더가 그 백엔드다.

- **비용**: 무료 (Cloudflare Workers Free + KV Free 한도 안에서 개인 사용은 충분)
- **인증**: 공유 암호 1개 → 서버가 서명 토큰 발급 (암호를 아는 사람은 같은 기록을 공유)
- **저장**: KV 키 하나(`state:v1`)에 전체 학습기록 JSON 을 통째로 보관 (last-write-wins + 클라이언트 병합)

프런트엔드는 로그인하지 않으면 **지금과 완전히 동일하게** localStorage 로만 동작한다.
로그인은 순수 추가 기능이다.

---

## 배포 (한 번만)

### 1. 사전 준비
- Cloudflare 계정 (무료) — https://dash.cloudflare.com
- Node.js 설치된 환경에서 Wrangler CLI 사용:

```bash
cd server
npx wrangler login          # 브라우저로 Cloudflare 로그인
```

> `npx` 는 일시적으로 wrangler 를 받아 실행할 뿐 프로젝트에 의존성을 추가하지 않는다
> (`server/` 밖의 규칙과 무관). 전역 설치를 원하면 `npm i -g wrangler`.

### 2. KV 네임스페이스 생성

```bash
npx wrangler kv namespace create STORE
```

출력된 `id = "xxxxxxxx..."` 값을 `wrangler.toml` 의 `kv_namespaces.id` 에 붙여넣는다.

### 3. 비밀값 설정

```bash
npx wrangler secret put PASSPHRASE      # 로그인 암호 (길고 추측 불가능하게!)
npx wrangler secret put TOKEN_SECRET    # 토큰 서명용 임의 문자열 32자 이상
```

`TOKEN_SECRET` 생성 예: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### 4. `wrangler.toml` 확인
- `kv_namespaces.id` — 2번에서 받은 값으로 교체했는지
- `vars.ALLOW_ORIGIN` — 배포된 사이트 주소 (`https://9u4a.github.io`). 오타 주의.

### 5. 배포

```bash
npx wrangler deploy
```

배포되면 `https://my-sync.<계정서브도메인>.workers.dev` 같은 URL 이 나온다.
이 URL 을 사이트의 **더보기 → 서버 동기화 → 서버 주소** 칸에 넣고 암호로 로그인하면 끝.

---

## 로컬 테스트

```bash
npx wrangler dev            # http://localhost:8787
```

`wrangler dev` 는 `.dev.vars` 파일에서 secret 을 읽는다:

```
# server/.dev.vars  (git 에 커밋하지 말 것)
PASSPHRASE = "test-pass"
TOKEN_SECRET = "test-secret-please-change"
```

`wrangler.toml` 의 `ALLOW_ORIGIN` 을 잠시 `"*"` 로 두거나 `http://localhost:8080` 으로.

---

## 한도 (Cloudflare Free)

| 항목 | 한도 | 이 앱 |
|---|---|---|
| Worker 요청 | 10만/일 | 넉넉 |
| KV 읽기 | 10만/일 | 넉넉 |
| **KV 쓰기** | **1,000/일** | 클라이언트가 4초 디바운스 + 변경 없으면 skip → 보통 1인당 수십~수백 |
| KV 저장 용량 | 1GB | 학습기록은 보통 1MB 미만 |

쓰기 한도가 부족해지면 (여러 명이 매우 활발히 사용) D1(SQLite, 10만 쓰기/일)로 옮기면 된다.

---

## 엔드포인트

| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| `POST` | `/login` | 암호 | `{ passphrase }` → `{ token }` |
| `GET` | `/state` | Bearer | `{ state, rev, updatedAt }` |
| `PUT` | `/state` | Bearer | `{ state, baseRev, force? }` → `{ rev, updatedAt }` / 409 |

토큰은 `v1.<발급시각ms>.<HMAC-SHA256>` 형식, 유효기간 1년.
`/login` 은 IP 당 분당 10회로 제한.

## 데이터 삭제 / 초기화

```bash
npx wrangler kv key delete --binding=STORE "state:v1"
```
