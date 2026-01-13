// bookSearch.ts - Book search APIs (Google Books, Naver Books)

export interface BookSearchResult {
  title: string;
  author: string;
  thumbnail?: string;
  publisher?: string;
  publishedDate?: string;
  description?: string;
  isbn?: string;
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

    return data.items.map((item: any) => ({
      title: item.volumeInfo.title || 'Unknown Title',
      author: item.volumeInfo.authors?.join(', ') || 'Unknown Author',
      thumbnail: item.volumeInfo.imageLinks?.thumbnail || item.volumeInfo.imageLinks?.smallThumbnail,
      publisher: item.volumeInfo.publisher,
      publishedDate: item.volumeInfo.publishedDate,
      description: item.volumeInfo.description,
      isbn: item.volumeInfo.industryIdentifiers?.[0]?.identifier,
    }));
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

    return data.items.map((item: any) => ({
      title: item.title?.replace(/<[^>]*>/g, '') || 'Unknown Title', // HTML 태그 제거
      author: item.author?.replace(/<[^>]*>/g, '') || 'Unknown Author',
      thumbnail: item.image,
      publisher: item.publisher,
      publishedDate: item.pubdate,
      description: item.description?.replace(/<[^>]*>/g, ''),
      isbn: item.isbn,
    }));
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

    return data.items.map((item: any) => ({
      title: item.volumeInfo.title || 'Unknown Title',
      author: item.volumeInfo.authors?.join(', ') || 'Unknown Author',
      thumbnail: item.volumeInfo.imageLinks?.thumbnail || item.volumeInfo.imageLinks?.smallThumbnail,
      publisher: item.volumeInfo.publisher,
      publishedDate: item.volumeInfo.publishedDate,
      description: item.volumeInfo.description,
      isbn: item.volumeInfo.industryIdentifiers?.[0]?.identifier,
    }));
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
    return {
      title: item.volumeInfo.title || 'Unknown Title',
      author: item.volumeInfo.authors?.join(', ') || 'Unknown Author',
      thumbnail: item.volumeInfo.imageLinks?.thumbnail || item.volumeInfo.imageLinks?.smallThumbnail,
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
