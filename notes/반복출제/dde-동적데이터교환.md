---
title: DDE (Dynamic Data Exchange) — Office 문서 악용
domain: 애플리케이션보안
questions: [14-4, 18-4]
tags: [DDE, 동적데이터교환, Office악성문서, 매크로우회]
---

**14·18회 반복 출제.** 'MS Office 앱 간 데이터 전달 프로토콜, 엑셀에서 활성화 시 악용' → DDE.

**핵심 정답**: **DDE (Dynamic Data Exchange)**
- MS Office 앱 간 데이터 교환 프로토콜.
- 문서의 DDE 필드에 `=cmd|'/c 명령'!A1` 같은 수식을 넣으면 **매크로 없이도 외부 명령 실행** → 매크로 경고를 우회하는 피싱 문서로 악용.
- 대응: DDE 자동 업데이트 비활성화(레지스트리/GPO), 첨부문서 차단.

**함정**: 매크로가 아니라 DDE. 후속 개념은 OLE·필드코드 악용.
