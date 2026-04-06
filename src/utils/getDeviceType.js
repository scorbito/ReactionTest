/**
 * 접속 기기가 모바일인지 데스크탑인지 판별하는 함수
 */
export const getDeviceType = () => {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
    ? 'mobile'
    : 'desktop';
};
