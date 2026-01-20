// bookSearch.ts - Book search APIs (Google Books, Naver Books)

export interface BookThumbnail {
  small?: string;
  medium?: string;
}

export interface BookSearchResult {
  title: string;
  author: string;
  thumbnail?: BookThumbnail;
  publisher?: string;
  publishedDate?: string;
  description?: string;
  isbn?: string;
  categories?: string[];
}

// Google Books API 검색 (영문 책)
export const searchGoogleBooks = async (query: string): Promise<BookSearchResult[]> => {
  try {
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10&langRestrict=en`
    );

    if (!response.ok) {
      throw new Error('Google Books API error');
    }

    const data = await response.json();

    if (!data.items) {
      return [];
    }

    return data.items.map((item: any) => {
      const imageLinks = item.volumeInfo.imageLinks || {};
      // Get base URL and create zoom=1 (small) and zoom=3 (medium) versions
      let baseUrl = imageLinks.thumbnail || imageLinks.smallThumbnail || '';
      if (baseUrl.startsWith('http:')) baseUrl = baseUrl.replace('http:', 'https:');

      const smallCover = baseUrl || undefined;
      // Use zoom=3 for medium (higher quality), fallback to API's medium if available
      const mediumCover = baseUrl ? baseUrl.replace(/zoom=\d/, 'zoom=3') : (imageLinks.medium || undefined);

      return {
        title: item.volumeInfo.title || 'Unknown Title',
        author: item.volumeInfo.authors?.join(', ') || 'Unknown Author',
        thumbnail: { small: smallCover, medium: mediumCover },
        publisher: item.volumeInfo.publisher,
        publishedDate: item.volumeInfo.publishedDate,
        description: item.volumeInfo.description,
        isbn: item.volumeInfo.industryIdentifiers?.[0]?.identifier,
        categories: item.volumeInfo.categories || [],
      };
    });
  } catch (error) {
    console.error('Google Books search error:', error);
    return [];
  }
};

// Naver Books API 검색 (한글 책)
// Note: Naver API는 CORS 문제로 직접 호출 불가, 백엔드 프록시 필요
// 임시로 백엔드 프록시를 통해 호출하거나, 클라이언트에서는 대체 방법 사용
export const searchNaverBooks = async (query: string): Promise<BookSearchResult[]> => {
  try {
    // 백엔드 프록시를 통해 Naver API 호출
    const response = await fetch(
      `/api/books/naver/search?query=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
      // Naver API 실패 시 Google Books API로 폴백 (한국어 검색)
      console.warn('Naver API failed, falling back to Google Books');
      return await searchGoogleBooksKorean(query);
    }

    const data = await response.json();

    if (!data.items) {
      return [];
    }

    return data.items.map((item: any) => {
      const coverUrl = item.image || '';
      return {
        title: item.title?.replace(/<[^>]*>/g, '') || 'Unknown Title', // HTML 태그 제거
        author: item.author?.replace(/<[^>]*>/g, '') || 'Unknown Author',
        thumbnail: { small: coverUrl, medium: coverUrl }, // Naver only provides one size
        publisher: item.publisher,
        publishedDate: item.pubdate,
        description: item.description?.replace(/<[^>]*>/g, ''),
        isbn: item.isbn,
      };
    });
  } catch (error) {
    console.error('Naver Books search error:', error);
    // 폴백: Google Books API로 한국어 검색
    return await searchGoogleBooksKorean(query);
  }
};

// Google Books API 한국어 검색 (Naver API 폴백용)
const searchGoogleBooksKorean = async (query: string): Promise<BookSearchResult[]> => {
  try {
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10&langRestrict=ko`
    );

    if (!response.ok) {
      throw new Error('Google Books API error');
    }

    const data = await response.json();

    if (!data.items) {
      return [];
    }

    return data.items.map((item: any) => {
      const imageLinks = item.volumeInfo.imageLinks || {};
      // Get base URL and create zoom=1 (small) and zoom=3 (medium) versions
      let baseUrl = imageLinks.thumbnail || imageLinks.smallThumbnail || '';
      if (baseUrl.startsWith('http:')) baseUrl = baseUrl.replace('http:', 'https:');

      const smallCover = baseUrl || undefined;
      // Use zoom=3 for medium (higher quality), fallback to API's medium if available
      const mediumCover = baseUrl ? baseUrl.replace(/zoom=\d/, 'zoom=3') : (imageLinks.medium || undefined);

      return {
        title: item.volumeInfo.title || 'Unknown Title',
        author: item.volumeInfo.authors?.join(', ') || 'Unknown Author',
        thumbnail: { small: smallCover, medium: mediumCover },
        publisher: item.volumeInfo.publisher,
        publishedDate: item.volumeInfo.publishedDate,
        description: item.volumeInfo.description,
        isbn: item.volumeInfo.industryIdentifiers?.[0]?.identifier,
        categories: item.volumeInfo.categories || [],
      };
    });
  } catch (error) {
    console.error('Google Books Korean search error:', error);
    return [];
  }
};

// ISBN으로 책 직접 조회 (Google Books API)
export const getBookByISBN = async (isbn: string): Promise<BookSearchResult | null> => {
  try {
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`
    );

    if (!response.ok) {
      throw new Error('Google Books API error');
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return null;
    }

    const item = data.items[0];
    const imageLinks = item.volumeInfo.imageLinks || {};
    // Get base URL and create zoom=1 (small) and zoom=3 (medium) versions
    let baseUrl = imageLinks.thumbnail || imageLinks.smallThumbnail || '';
    if (baseUrl.startsWith('http:')) baseUrl = baseUrl.replace('http:', 'https:');

    const smallCover = baseUrl || undefined;
    // Use zoom=3 for medium (higher quality), fallback to API's medium if available
    const mediumCover = baseUrl ? baseUrl.replace(/zoom=\d/, 'zoom=3') : (imageLinks.medium || undefined);

    return {
      title: item.volumeInfo.title || 'Unknown Title',
      author: item.volumeInfo.authors?.join(', ') || 'Unknown Author',
      thumbnail: { small: smallCover, medium: mediumCover },
      publisher: item.volumeInfo.publisher,
      publishedDate: item.volumeInfo.publishedDate,
      description: item.volumeInfo.description,
      isbn: item.volumeInfo.industryIdentifiers?.[0]?.identifier || isbn,
    };
  } catch (error) {
    console.error('Get book by ISBN error:', error);
    return null;
  }
};
