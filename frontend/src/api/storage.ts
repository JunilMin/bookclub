// frontend/src/api/storage.ts

/**
 * 이미지 파일을 Base64로 변환 (MongoDB 저장용)
 * @param file 업로드할 이미지 파일
 * @returns Base64 인코딩된 Data URL
 */
export const convertImageToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    // 파일 유효성 검사
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      reject(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
      return;
    }

    // 파일 크기 제한 (2MB - Base64는 원본보다 약 33% 크므로 제한 낮춤)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      reject(new Error('File size exceeds 2MB limit.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

/**
 * 이미지 파일을 리사이즈 후 Base64로 변환
 * @param file 원본 파일
 * @param maxWidth 최대 너비
 * @param maxHeight 최대 높이
 * @param quality 압축 품질 (0-1)
 * @returns 리사이즈 및 압축된 Base64 Data URL
 */
export const resizeAndConvertToBase64 = (
  file: File,
  maxWidth: number = 400,
  maxHeight: number = 400,
  quality: number = 0.8
): Promise<string> => {
  return new Promise((resolve, reject) => {
    // 파일 유효성 검사
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      reject(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
      return;
    }

    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let { width, height } = img;

      // 비율 유지하면서 리사이즈
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      if (ctx) {
        // 투명 배경을 흰색으로 채우기 (PNG → JPEG 변환 시)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // JPEG로 압축하여 Base64 변환
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      } else {
        reject(new Error('Failed to get canvas context'));
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Base64 Data URL이 유효한지 확인
 * @param dataUrl Data URL 문자열
 * @returns 유효 여부
 */
export const isValidBase64Image = (dataUrl: string): boolean => {
  return dataUrl.startsWith('data:image/');
};

/**
 * Base64 이미지의 대략적인 파일 크기 계산 (bytes)
 * @param base64 Base64 문자열
 * @returns 추정 파일 크기
 */
export const getBase64Size = (base64: string): number => {
  // Data URL에서 실제 Base64 데이터 부분만 추출
  const base64Data = base64.split(',')[1] || base64;
  // Base64는 원본의 약 4/3 크기
  return Math.round((base64Data.length * 3) / 4);
};
