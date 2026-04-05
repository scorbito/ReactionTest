# ⚡ 반응속도 테스트 웹 (Reaction Test Web)

반응속도 테스트 웹은 사용자의 반응 속도를 측정하고, 이를 실시간 랭킹과 개인 대시보드로 시각화하여 제공하는 프로젝트입니다.

## 🚀 주요 기능
- **반응속도 측정:** 무작위 대기 시간 후 녹색 화면으로 전환될 때 클릭하여 속도 측정 (3회 평균값 활용)
- **부정행위 방지:** 너무 이른 클릭이나 매크로 활동 시 경고 및 재시작 유도
- **실시간 리더보드:** Firebase Firestore를 연동하여 상위 100위 랭킹 실시간 노출
- **개인 통계(마이페이지):** Chart.js를 통해 본인의 최근 10회 기록 변화를 그래프로 확인
- **다국어 지원:** 한국어 및 영어 지원 (Context API 기반 i18n 시스템)
- **세련된 UI:** 글래스모피즘(Glassmorphism) 스타일의 반응형 디자인

## 🛠 기술 스택
- **프레임워크:** React 19, Vite
- **스타일링:** Vanilla CSS (Modern Design System)
- **백엔드:** Firebase (Authentication, Firestore, Hosting)
- **라이브러리:** Chart.js, react-firebase-hooks, React Router v7

## 📂 프로젝트 구조
- `src/pages`: Home(게임), MyPage(통계), Privacy(약관)
- `src/components`: Navigation(상단바), Footer(하단바)
- `src/utils`: Firebase 설정, i18n 시스템, Helper 함수
- `src/index.css`: 고해상도 디자인 시스템 및 CSS 변수

## ⚙️ 실행 방법
1. 의존성 설치: `npm install`
2. 환경 변수(`.env`) 설정 (Firebase API Key 등)
3. 개발 서버 실행: `npm run dev`

---
작성일: 2026-04-03
작성자: 대단부자 [단우튜브]
버전: v1.0.0
