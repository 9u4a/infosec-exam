---
title: ARP 스푸핑 & 스니핑 탐지
domain: 네트워크보안
questions: [1-16, 6-16, 13-1, 19-4, 25-17, 10-16, 19-13, 26-15]
tags: [ARP, 스푸핑, 스니핑, promiscuous, MITM]
---

## ARP 스푸핑 / 리다이렉트

- **원리**: ARP는 인증이 없어 위조된 ARP Reply(gratuitous ARP)를 무조건 캐시에 반영 → 공격자가 게이트웨이 IP에 대한 MAC을 자기 것으로 속임 → 피해자의 외부행 트래픽이 공격자 경유(**MITM**) → 감청·변조·세션 하이재킹
- **판단 근거**: ARP 테이블에서 **게이트웨이 IP와 다른 IP가 같은 MAC**을 가짐 / 관리자가 아는 GW의 실제 MAC과 불일치
- 같은 MAC이 여러 IP에 → 그 MAC의 호스트가 공격자

### 대응
```bash
arp -s <게이트웨이IP> <실제MAC>     # 정적 등록 (재부팅 시 초기화 주의)
```
- 스위치: **DAI**(Dynamic ARP Inspection) + DHCP Snooping
- 암호화 통신(SSH/HTTPS)으로 감청 무력화
- ARP watch 도구로 MAC 변경 모니터링

## Promiscuous Mode (스니핑)

로그: `device eth0 entered Promiscuous mode` (`/var/log/messages`)
→ NIC가 자기 목적지가 아닌 프레임도 모두 수신 = 스니핑 도구 설치 정황

### 해제
```bash
ifconfig eth0 -promisc          # 또는 ip link set eth0 promisc off
```

## 스니핑 탐지 기법 (위조 프레임에 반응하는지 관찰)

| 방법 | 원리 |
|---|---|
| **Ping** | 대상에 IP는 맞고 **존재하지 않는 MAC**으로 ICMP Echo → 정상 NIC는 폐기, promiscuous NIC는 응답 |
| **ARP** | 위조 MAC으로 ARP 요청 → 응답하면 promiscuous |
| **DNS** | 스니퍼가 캡처한 IP를 역방향 조회하는지 관찰 |
| **Decoy** | 가짜 계정/패스워드를 평문으로 흘려 그 계정 사용 시도를 탐지 |
| **Latency** | 대량 트래픽 유발 후 응답 지연 증가 관찰 |

## 대응 (스니핑 전반)

- 스위치 환경 + 포트 보안 (허브 금지)
- SSH·HTTPS·IPSec 등 암호화 통신
- MAC Flooding(Switch Jamming) 대비: 포트당 MAC 수 제한
