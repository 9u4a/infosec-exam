---
title: 메일 발신자 위조 방지 — SPF · DKIM · DMARC
domain: 애플리케이션보안
questions: [16-13, 32-16]
tags: [SPF, DKIM, DMARC, 메일스푸핑, 스팸방지]
---

**16·32회 반복 출제.** SPF 확인 항목 / DKIM 서명 주체·키 공유 / SPF+DKIM 결합 기법명.

**핵심 정답**
- **SPF**: 도메인 소유자가 **DNS TXT**에 '이 도메인 메일은 이 IP들에서만 나간다'를 공표 → 수신 서버가 **접속 IP와 대조**(Envelope From 기준).
- **DKIM**: **발신 메일 서버**가 **개인키로 헤더를 전자서명**, 공개키는 **DNS TXT**에 공개 → 수신 서버가 서명 검증(위·변조 + 발신자 확인).
- **DMARC**: SPF·DKIM 결과 + From 헤더 정렬(alignment)을 확인하고 실패 시 정책(none/quarantine/reject)·리포트 규정.

**함정**: DKIM 서명 주체 = **발신 메일 서버**. SPF+DKIM 결합 = **DMARC**. 표시이름 스푸핑은 이걸로 못 막음.
