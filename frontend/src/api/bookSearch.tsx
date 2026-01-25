// bookSearch.ts - Book search APIs (via Backend with Google API Key)

import axiosInstance from './axiosInstance';

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

// 백엔드를 통한 Google Books API 검색 (API 키 사용)
const searchBooksViaBackend = async (query: string, lang?: string): Promise<BookSearchResult[]> => {
  try {
    let url = `/books/search?query=${encodeURIComponent(query)}`;
    if (lang) {
      url += `&lang=${lang}`;
    }

    console.log('Calling API:', url);
    const response = await axiosInstance.get(url);
    console.log('API Response:', response.data);

    const data = response.data;

    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item: any) => ({
      title: item.title || 'Unknown Title',
      author: item.author || 'Unknown Author',
      thumbnail: item.thumbnail || undefined,
      publisher: item.publisher,
      publishedDate: item.publishedDate,
      description: item.description,
      isbn: item.isbn,
      categories: item.categories || [],
    }));
  } catch (error) {
    console.error('Book search error:', error);
    return [];
  }
};

// Google Books API 검색 (영문 책)
export const searchBooksEN = async (query: string): Promise<BookSearchResult[]> => {
  return searchBooksViaBackend(query, 'en');
};

// Google Books API 검색 (한글 책)
export const searchBooksKO = async (query: string): Promise<BookSearchResult[]> => {
  return searchBooksViaBackend(query, 'ko');
};

// Legacy aliases (for backwards compatibility)
export const searchGoogleBooks = searchBooksEN;
export const searchNaverBooks = searchBooksKO;

// ISBN으로 책 직접 조회 (백엔드를 통한 Google Books API)
export const getBookByISBN = async (isbn: string): Promise<BookSearchResult | null> => {
  try {
    const results = await searchBooksViaBackend(`isbn:${isbn}`);
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('Get book by ISBN error:', error);
    return null;
  }
};
