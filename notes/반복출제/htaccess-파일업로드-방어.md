---
title: .htaccess 파일 업로드(웹셸) 방어 설정
domain: 애플리케이션보안
questions: [13-11, 19-15]
tags: [htaccess, 파일업로드, 웹셸, FilesMatch, AddType]
---

**13·19회 반복 출제.**

**핵심 정답**
1. `<FilesMatch \.(ph|lib|sh|...)>` + `Deny from all` → 서버사이드 스크립트 파일에 대한 **직접 URL 호출 차단**(업로드된 웹셸 실행 방지).
2. `AddType text/html .php .php3 .phtml ...` → 스크립트 확장자를 **실행 불가한 text/html MIME으로 재지정** → 소스가 그대로 출력되고 실행 안 됨.

**함정**: 두 설정 모두 '업로드 차단'이 아니라 '**업로드된 스크립트의 실행 차단**'. 근본 대응은 화이트리스트 + 실행권한 제거 + 웹루트 외 저장 + 파일명 난수화 → [🔗 파일 업로드 필터 우회 기법 (PHP 게시판 소스)](#/note/%EB%B0%98%EB%B3%B5%EC%B6%9C%EC%A0%9C%2F%ED%8C%8C%EC%9D%BC%EC%97%85%EB%A1%9C%EB%93%9C-%EC%9A%B0%ED%9A%8C%EA%B8%B0%EB%B2%95-php%EA%B2%8C%EC%8B%9C%ED%8C%90)
