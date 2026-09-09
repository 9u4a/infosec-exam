---
title: Promiscuous mode 로그 → 스니핑 정황
domain: 네트워크보안
questions: [19-13, 26-15]
tags: [Promiscuousmode, 스니핑, 로그분석, 무차별모드]
---

**19·26회 반복 출제.** `device eth0 entered Promiscuous mode` 로그 → 의미/공격/대응.

**핵심 정답**
1. **의미**: NIC가 자신이 목적지가 아닌 프레임도 버리지 않고 **모두 수신**(무차별 모드).
2. **가능 공격**: 패킷 **스니핑**(도청).
3. **대응**: ① SSH·HTTPS 등 **암호화 통신** ② `ifconfig eth0 -promisc`로 무차별 모드 해제 ③ 더미 허브 대신 **스위치**(+ 포트 보안) ④ 스니핑 탐지 도구(ping/ARP/DNS/decoy 테스트)로 지속 점검.

**함정**: tcpdump·IDS도 정상적으로 promisc를 씀 → 로그만으로 침해 단정 금지, 인가된 도구인지 확인.
