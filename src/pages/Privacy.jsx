import React from 'react';
import { useTranslation } from '../utils/i18nContext';

export default function Privacy() {
  const { t } = useTranslation();
  
  return (
    <div className="privacy-container glass" style={{ padding: '2rem', margin: '2rem auto', maxWidth: '800px', lineHeight: '1.6' }}>
      <h1>개인정보처리방침 (Privacy Policy)</h1>
      <p style={{ marginBottom: '2rem' }}>최종 업데이트: 2026년 4월 2일</p>

      <section style={{ marginBottom: '1.5rem' }}>
        <h3>1. 수집하는 개인정보</h3>
        <p>
          본 반응속도 테스트 앱은 구글 로그인 서비스를 이용하며, 로그인 시 구글 계정의 이메일 및 이름을 식별 정보로 수집합니다.
          또한 테스트 결과(반응속도 기록)를 서버에 저장하여 사용자 통계 및 랭킹 서비스를 제공합니다.
        </p>
      </section>

      <section style={{ marginBottom: '1.5rem' }}>
        <h3>2. 개인정보 수집 및 이용 목적</h3>
        <ul>
          <li>전체 사용자 대비 나의 순위 계산 및 실시간 랭킹 시스템 제공</li>
          <li>마이페이지를 통한 개인 활동 통계 및 그래프 제공</li>
          <li>서비스 남용 및 부정 행위(매크로 등) 방지</li>
        </ul>
      </section>

      <section style={{ marginBottom: '1.5rem' }}>
        <h3>3. 쿠키 및 광고 (Google AdSense)</h3>
        <p>
          본 사이트는 구글에서 제공하는 광고 서비스인 <strong>Google AdSense</strong>를 사용합니다.
          구글은 쿠키를 사용하여 사용자가 당사 웹사이트 또는 다른 웹사이트를 방문한 기록을 바탕으로 광고를 게재합니다.
          사용자는 구글 광고 설정 등을 통해 맞춤형 광고 게재를 거부할 수 있습니다.
        </p>
      </section>

      <section style={{ marginBottom: '1.5rem' }}>
        <h3>4. 데이터의 보유 및 파기</h3>
        <p>
          사용자가 앱에서 로그아웃하거나 계정을 삭제하지 않는 한, 서비스 제공을 위해 기록 데이터는 지속적으로 보관됩니다.
          사용자의 명시적인 삭제 요청 시 모든 관련 데이터는 파기됩니다.
        </p>
      </section>

      <section style={{ marginBottom: '1.5rem' }}>
        <h3>5. 문의처</h3>
        <p>개인정보 처리와 관련된 문의 사항은 사이트 운영자(단우아빠)에게 문의하시기 바랍니다.</p>
      </section>

      <button 
        onClick={() => window.history.back()} 
        className="start-button" 
        style={{ marginTop: '2rem', width: 'auto', padding: '0.8rem 2rem' }}
      >
        돌아가기
      </button>
    </div>
  );
}
