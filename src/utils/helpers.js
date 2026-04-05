/**
 * 무작위 지연 시간을 계산합니다 (2초 ~ 5초).
 * @returns {number} 밀리초 단위의 지연 시간
 */
export const getRandomDelay = () => Math.floor(Math.random() * 3000) + 2000;
