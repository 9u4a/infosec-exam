---
title: ARP 스푸핑 (MAC 위조 스니핑/MITM)
domain: 네트워크보안
questions: [13-1, 19-4]
tags: [ARP스푸핑, MITM, 스니핑, gratuitousARP, DAI]
---

**13·19회 반복 출제.** 'Victim의 MAC 주소를 위조한 스니핑/가로채기 공격' → ARP 스푸핑.

**핵심 정답**
- **ARP 스푸핑(ARP Cache Poisoning)**: 공격자가 위조된 **ARP Reply**로 피해자·게이트웨이의 ARP 캐시에 자기 MAC을 심어 트래픽을 자신을 경유하게 함(**MITM**) → 감청·변조·세션 하이재킹.
- 원인: ARP에 **인증이 없어** 요청하지 않은(gratuitous) Reply도 무조건 수용.
- 대응: 정적 ARP 등록, **DAI**(Dynamic ARP Inspection) + DHCP 스누핑, arpwatch, 상위계층 암호화(HTTPS/SSH).

**왜**: ARP는 상태 없는 프로토콜이라 요청하지 않은 Reply도 받는 즉시 캐시를 덮어쓴다. 게이트웨이 IP↔공격자 MAC으로 캐시가 오염되면 피해자의 외부행 프레임이 L2에서 공격자에게 배달된다. 스위치는 MAC 기준으로 스위칭하므로 CAM 테이블이 정상이어도 소용없다.

**함정**: 스위치 환경에서도 성립(스위치 CAM 테이블과 무관, 호스트 ARP 캐시를 오염).
