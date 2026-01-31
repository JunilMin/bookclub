/**
 * Date utility functions for consistent date formatting across the app
 */

type LocaleCode = 'ko' | 'en';

/**
 * Format a date string to localized date format
 * @param dateString - ISO date string or Date
 * @param locale - 'ko' or 'en'
 * @returns Formatted date string
 */
export const formatDateLocalized = (
  dateString?: string | Date,
  locale: LocaleCode = 'en'
): string => {
  if (!dateString) return '';

  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;

  if (isNaN(date.getTime())) return '';

  return date.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Format a date string to localized date format with full month
 * @param dateString - ISO date string or Date
 * @param locale - 'ko' or 'en'
 * @returns Formatted date string
 */
export const formatDateFull = (
  dateString?: string | Date,
  locale: LocaleCode = 'en'
): string => {
  if (!dateString) return '';

  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;

  if (isNaN(date.getTime())) return '';

  return date.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * Format a date to YYYY.MM.DD format
 * @param dateString - ISO date string or Date
 * @param locale - 'ko' or 'en'
 * @returns Formatted date string (e.g., "2024.01.15" or "01/15/2024")
 */
export const formatDateCompact = (
  dateString?: string | Date,
  locale: LocaleCode = 'en'
): string => {
  if (!dateString) return '';

  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;

  if (isNaN(date.getTime())) return '';

  return date.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

/**
 * Format a date string to simple date (no year)
 * @param dateString - ISO date string or Date
 * @param locale - 'ko' or 'en'
 * @returns Formatted date string
 */
export const formatDateSimple = (
  dateString?: string | Date,
  locale: LocaleCode = 'en'
): string => {
  if (!dateString) return '';

  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;

  if (isNaN(date.getTime())) return '';

  return date.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Format relative time (e.g., "3 days ago", "2 hours ago")
 * @param dateString - ISO date string or Date
 * @param locale - 'ko' or 'en'
 * @returns Relative time string
 */
export const formatRelativeTime = (
  dateString?: string | Date,
  locale: LocaleCode = 'en'
): string => {
  if (!dateString) return '';

  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;

  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (locale === 'ko') {
    if (diffDays > 30) return formatDateLocalized(date, locale);
    if (diffDays > 0) return `${diffDays}일 전`;
    if (diffHours > 0) return `${diffHours}시간 전`;
    if (diffMinutes > 0) return `${diffMinutes}분 전`;
    return '방금 전';
  } else {
    if (diffDays > 30) return formatDateLocalized(date, locale);
    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffMinutes > 0) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  }
};
