/**
 * 닉네임 유효성 검사 (공통)
 * - 빈 문자열, 공백, 특수문자 체크
 * - 최소 길이: 한글 2자, 영문 4자
 * - 최대 길이: 한글 8자, 영문 14자
 */
export const validateUsername = (username: string): { isValid: boolean; error: string } => {
  if (!username.trim()) {
    return { isValid: false, error: 'set_username_error_empty' };
  }

  if (/\s/.test(username)) {
    return { isValid: false, error: 'set_username_error_space' };
  }

  if (!/^[가-힣a-zA-Z0-9]+$/.test(username)) {
    return { isValid: false, error: 'set_username_error_special' };
  }

  const koreanCount = (username.match(/[가-힣]/g) || []).length;
  const nonKoreanCount = username.length - koreanCount;

  // 최소 길이 체크
  if (koreanCount > 0 && koreanCount === username.length) {
    // 한글만 있는 경우
    if (username.length < 2) {
      return { isValid: false, error: 'set_username_error_min_kr' };
    }
    if (username.length > 8) {
      return { isValid: false, error: 'set_username_error_length_kr' };
    }
  } else if (koreanCount === 0) {
    // 영문/숫자만 있는 경우
    if (username.length < 4) {
      return { isValid: false, error: 'set_username_error_min_en' };
    }
    if (username.length > 14) {
      return { isValid: false, error: 'set_username_error_length_en' };
    }
  } else {
    // 혼합된 경우: 최소 길이는 한글 기준 2자 이상
    if (koreanCount < 2 && nonKoreanCount < 4) {
      return { isValid: false, error: 'set_username_error_min_mixed' };
    }
    const equivalentLength = koreanCount * 1.75 + nonKoreanCount;
    if (equivalentLength > 14) {
      return { isValid: false, error: 'set_username_error_length_mixed' };
    }
  }

  return { isValid: true, error: '' };
};
