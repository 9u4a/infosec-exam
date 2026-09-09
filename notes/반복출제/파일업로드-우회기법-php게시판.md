---
title: 파일 업로드 필터 우회 기법 (PHP 게시판 소스)
domain: 애플리케이션보안
questions: [23-13, 29-14]
tags: [파일업로드, 확장자우회, 이중확장자, 널바이트, ContentType변조]
---

**23·29회 반복 출제.** 취약점명 / 우회 기법 / 공격 성공 조건.

**핵심 정답**
- **취약점**: 파일 업로드 취약점(확장자·MIME만 검사).
- **우회 기법**: ① **확장자 변조** — 대소문자 혼용(`test.PhP`), 이중 확장자(`test.php.jpg`), `.php3/.phtml`, **Null 바이트**(`test.php%00.jpg` → 검증은 `.jpg`, 저장은 `test.php`) ② **Content-Type 변조** — 프록시로 `Content-Type: image/jpeg`.
- **성공 조건**: ① 필터 통과 ② 크기 제한(`LimitRequestBody`) 통과 ③ 업로드 경로에서 **스크립트 실행 가능**(AddType로 text/html 재지정 안 됨, FilesMatch로 직접 호출 차단 안 됨).

**함정**: 근본 대응 = 화이트리스트 + 실행권한 제거 + 웹루트 외 저장 + 파일명 난수화. → [🔗 .htaccess 파일 업로드(웹셸) 방어 설정](#/note/%EB%B0%98%EB%B3%B5%EC%B6%9C%EC%A0%9C%2Fhtaccess-%ED%8C%8C%EC%9D%BC%EC%97%85%EB%A1%9C%EB%93%9C-%EB%B0%A9%EC%96%B4)
