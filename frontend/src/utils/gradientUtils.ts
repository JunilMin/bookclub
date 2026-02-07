/**
 * Gradient utility functions for converting Tailwind classes to CSS gradients
 */

// Tailwind 클래스 → CSS linear-gradient 매핑
const GRADIENT_MAP: Record<string, string> = {
  'from-yellow-400 to-yellow-600': 'linear-gradient(135deg, #facc15, #ca8a04)',
  'from-blue-400 to-blue-600': 'linear-gradient(135deg, #60a5fa, #2563eb)',
  'from-orange-400 to-red-600': 'linear-gradient(135deg, #fb923c, #dc2626)',
  'from-purple-400 to-purple-600': 'linear-gradient(135deg, #c084fc, #9333ea)',
  'from-amber-400 to-amber-600': 'linear-gradient(135deg, #fbbf24, #d97706)',
  'from-indigo-400 to-indigo-600': 'linear-gradient(135deg, #818cf8, #4f46e5)',
  'from-teal-400 to-teal-600': 'linear-gradient(135deg, #2dd4bf, #0d9488)',
  'from-violet-400 to-violet-600': 'linear-gradient(135deg, #a78bfa, #7c3aed)',
  'from-emerald-400 to-emerald-600': 'linear-gradient(135deg, #34d399, #059669)',
  'from-lime-400 to-lime-600': 'linear-gradient(135deg, #a3e635, #65a30d)',
  'from-rose-400 to-rose-600': 'linear-gradient(135deg, #fb7185, #e11d48)',
  'from-cyan-400 to-cyan-600': 'linear-gradient(135deg, #22d3ee, #0891b2)',
  'from-pink-400 to-pink-600': 'linear-gradient(135deg, #f472b6, #db2777)',
  'from-yellow-400 to-amber-600': 'linear-gradient(135deg, #facc15, #d97706)',
  'from-orange-400 to-orange-600': 'linear-gradient(135deg, #fb923c, #ea580c)',
};

const DEFAULT_GRADIENT = 'linear-gradient(135deg, #6b7280, #4b5563)';

/**
 * Convert gradient colors to CSS linear-gradient
 * Supports:
 * - Hex format: "#10B981,#059669"
 * - Tailwind classes: "from-yellow-400 to-yellow-600"
 *
 * @param gradientColors - The gradient color string
 * @returns CSS linear-gradient string
 */
export const getGradientStyle = (gradientColors?: string): string => {
  if (!gradientColors) return DEFAULT_GRADIENT;

  // hex 형식이면 linear-gradient로 변환 ("#10B981,#059669")
  if (gradientColors.startsWith('#')) {
    const parts = gradientColors.split(',');
    return `linear-gradient(135deg, ${parts.join(', ')})`;
  }

  // Tailwind 클래스 형식이면 매핑에서 찾기
  return GRADIENT_MAP[gradientColors] || DEFAULT_GRADIENT;
};

/**
 * Get gradient map for external use if needed
 */
export const getGradientMap = (): Record<string, string> => ({ ...GRADIENT_MAP });
