import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import './styles/HexagonChart.css';

// 6개의 평가 항목
const CATEGORIES = [
  'ENGAGEMENT',      // 참여도
  'COMMUNICATION',   // 소통
  'RESPECT',         // 존중
  'RULE_ADHERENCE',  // 규칙준수
  'PREPARATION',     // 준비성
  'REMATCH',         // 재참여의향
] as const;

type CategoryKey = typeof CATEGORIES[number];

interface HexagonChartProps {
  data: Partial<Record<CategoryKey, number>>;
  size?: number;
}

const HexagonChart: React.FC<HexagonChartProps> = ({ data, size = 280 }) => {
  const { t } = useTranslation();

  // 각 항목의 값 가져오기
  const values = useMemo(() => {
    return CATEGORIES.map(cat => data[cat] || 0);
  }, [data]);

  // 최대값 계산 (최대값 * 1.3을 기준으로)
  const maxValue = useMemo(() => {
    const max = Math.max(...values, 1);
    return max * 1.3;
  }, [values]);

  // SVG 중심점과 반지름
  const center = size / 2;
  const radius = size * 0.35;
  const labelRadius = size * 0.47;

  // 6각형의 꼭지점 좌표 계산 (위쪽부터 시계방향)
  const getPoint = (index: number, r: number) => {
    const angle = (Math.PI / 2) + (index * Math.PI * 2 / 6);
    return {
      x: center + r * Math.cos(angle),
      y: center - r * Math.sin(angle),
    };
  };

  // 그리드 라인 (3개 레벨)
  const gridPaths = useMemo(() => {
    return [0.33, 0.66, 1].map(level => {
      const r = radius * level;
      const points = CATEGORIES.map((_, i) => getPoint(i, r));
      return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
    });
  }, [center, radius]);

  // 데이터 영역 경로
  const dataPath = useMemo(() => {
    const points = values.map((value, i) => {
      const normalizedValue = Math.min(value / maxValue, 1);
      const r = radius * normalizedValue;
      return getPoint(i, r);
    });
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
  }, [values, maxValue, center, radius]);

  // 축 라인
  const axisLines = useMemo(() => {
    return CATEGORIES.map((_, i) => {
      const point = getPoint(i, radius);
      return { x1: center, y1: center, x2: point.x, y2: point.y };
    });
  }, [center, radius]);

  // 라벨 위치
  const labelPositions = useMemo(() => {
    return CATEGORIES.map((cat, i) => {
      const point = getPoint(i, labelRadius);
      return {
        category: cat,
        x: point.x,
        y: point.y,
        value: values[i],
      };
    });
  }, [labelRadius, values]);

  return (
    <div className="hexagon-chart-container">
      <svg viewBox={`0 0 ${size} ${size}`} className="hexagon-chart">
        {/* 배경 */}
        <circle cx={center} cy={center} r={radius * 1.1} className="chart-background" />

        {/* 그리드 라인 */}
        {gridPaths.map((path, i) => (
          <path key={`grid-${i}`} d={path} className="chart-grid" />
        ))}

        {/* 축 라인 */}
        {axisLines.map((line, i) => (
          <line
            key={`axis-${i}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            className="chart-axis"
          />
        ))}

        {/* 데이터 영역 */}
        <path d={dataPath} className="chart-data" />

        {/* 데이터 포인트 */}
        {values.map((value, i) => {
          const normalizedValue = Math.min(value / maxValue, 1);
          const r = radius * normalizedValue;
          const point = getPoint(i, r);
          return (
            <circle
              key={`point-${i}`}
              cx={point.x}
              cy={point.y}
              r={4}
              className="chart-point"
            />
          );
        })}
      </svg>

      {/* 라벨 */}
      <div className="hexagon-labels" style={{ width: size, height: size }}>
        {labelPositions.map((pos) => (
          <div
            key={pos.category}
            className="hexagon-label"
            style={{
              left: pos.x,
              top: pos.y,
            }}
          >
            <span className="label-text">
              {t(`endorsement_${pos.category.toLowerCase()}`)}
            </span>
            <span className="label-value">{pos.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HexagonChart;
