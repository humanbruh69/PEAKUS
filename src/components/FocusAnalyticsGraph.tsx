import React, { useState, useMemo } from 'react';
import type { Session, Settings } from '../types';
import { dayKey, startOfDay, addDays, fmtDur } from '../lib/utils';
import { t } from '../lib/i18n';
import { Icon } from './Icons';

interface FocusAnalyticsGraphProps {
  sessions: Session[];
  settings: Settings;
  lang: string;
}

export const FocusAnalyticsGraph: React.FC<FocusAnalyticsGraphProps> = ({
  sessions,
  settings,
  lang,
}) => {
  const [rangeDays, setRangeDays] = useState<7 | 14>(7);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const goalMinutes = settings.timer.streakGoal || 25;
  const goalMs = goalMinutes * 60000;

  // Compute daily data for the past N days
  const chartData = useMemo(() => {
    const focusSessions = sessions.filter(s => s.kind === 'focus');
    const today = startOfDay(Date.now());
    const days: {
      date: Date;
      dayStr: string;
      label: string;
      minutes: number;
      sessionsCount: number;
      metGoal: boolean;
    }[] = [];

    // Map sessions to dayKey
    const dayMap = new Map<string, { ms: number; count: number }>();
    focusSessions.forEach(s => {
      const k = dayKey(s.start);
      const existing = dayMap.get(k) || { ms: 0, count: 0 };
      existing.ms += s.ms;
      if (s.completed) existing.count++;
      dayMap.set(k, existing);
    });

    for (let i = rangeDays - 1; i >= 0; i--) {
      const dTime = addDays(today, -i);
      const d = new Date(dTime);
      const k = dayKey(dTime);
      const record = dayMap.get(k) || { ms: 0, count: 0 };
      const minutes = Math.round(record.ms / 60000);
      const dayName = d.toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-US', {
        weekday: rangeDays === 7 ? 'short' : 'narrow',
      });
      const dateLabel = d.toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-US', {
        month: 'short',
        day: 'numeric',
      });

      days.push({
        date: d,
        dayStr: dayName,
        label: dateLabel,
        minutes,
        sessionsCount: record.count,
        metGoal: record.ms >= goalMs,
      });
    }

    return days;
  }, [sessions, rangeDays, goalMs, lang]);

  const maxMinutes = useMemo(() => {
    const highest = Math.max(...chartData.map(d => d.minutes), goalMinutes);
    return Math.max(60, Math.ceil(highest / 30) * 30);
  }, [chartData, goalMinutes]);

  const totalMinutes = useMemo(
    () => chartData.reduce((acc, d) => acc + d.minutes, 0),
    [chartData]
  );

  const avgMinutes = useMemo(
    () => Math.round(totalMinutes / rangeDays),
    [totalMinutes, rangeDays]
  );

  const peakDay = useMemo(() => {
    let peak = chartData[0];
    for (const d of chartData) {
      if (d.minutes > peak.minutes) {
        peak = d;
      }
    }
    return peak;
  }, [chartData]);

  const metGoalCount = useMemo(
    () => chartData.filter(d => d.metGoal).length,
    [chartData]
  );

  // SVG Chart dimensions
  const svgWidth = 600;
  const svgHeight = 220;
  const paddingBottom = 34;
  const paddingTop = 20;
  const chartHeight = svgHeight - paddingBottom - paddingTop;
  const barWidth = rangeDays === 7 ? 40 : 22;
  const gap = (svgWidth - 60 - barWidth * rangeDays) / (rangeDays - 1 || 1);

  const goalY =
    paddingTop + chartHeight - (goalMinutes / maxMinutes) * chartHeight;

  return (
    <div
      className="card"
      style={{
        padding: '20px',
        marginBottom: '20px',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
      }}
    >
      {/* Header and Toggle */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="chart" style={{ color: 'var(--accent-text)' }} />
            {t('analyticsTitle', lang as any)}
          </h3>
          <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: 'var(--muted)' }}>
            Daily study & deep work breakdown
          </p>
        </div>

        <div className="seg" role="group" aria-label="Range">
          <button
            aria-pressed={rangeDays === 7}
            onClick={() => setRangeDays(7)}
            style={{ padding: '4px 12px', fontSize: '12px' }}
          >
            {t('analytics7d', lang as any)}
          </button>
          <button
            aria-pressed={rangeDays === 14}
            onClick={() => setRangeDays(14)}
            style={{ padding: '4px 12px', fontSize: '12px' }}
          >
            {t('analytics14d', lang as any)}
          </button>
        </div>
      </div>

      {/* Analytics Summary Stats Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: '10px',
          marginBottom: '18px',
        }}
      >
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '10px',
            padding: '10px 12px',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>
            {t('totalMinutes', lang as any)}
          </div>
          <div style={{ fontSize: '17px', fontWeight: 750, color: '#fff', marginTop: '3px' }}>
            {totalMinutes} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted)' }}>min</span>
          </div>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '10px',
            padding: '10px 12px',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>
            {t('dailyAverage', lang as any)}
          </div>
          <div style={{ fontSize: '17px', fontWeight: 750, color: '#fff', marginTop: '3px' }}>
            {avgMinutes} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted)' }}>min/d</span>
          </div>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '10px',
            padding: '10px 12px',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>
            {t('peakFocusDay', lang as any)}
          </div>
          <div style={{ fontSize: '17px', fontWeight: 750, color: '#34d399', marginTop: '3px' }}>
            {peakDay && peakDay.minutes > 0 ? `${peakDay.minutes}m` : '0m'}
          </div>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '10px',
            padding: '10px 12px',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>
            {t('goalAchieved', lang as any)}
          </div>
          <div style={{ fontSize: '17px', fontWeight: 750, color: 'var(--accent-text)', marginTop: '3px' }}>
            {metGoalCount} / {rangeDays}{' '}
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted)' }}>days</span>
          </div>
        </div>
      </div>

      {/* SVG Bar Chart with Responsive ViewBox */}
      <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ width: '100%', height: 'auto', minWidth: '420px', display: 'block' }}
          role="img"
          aria-label="Focus time bar chart"
        >
          <defs>
            <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.95" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.45" />
            </linearGradient>
            <linearGradient id="barGradHighlight" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.5" />
            </linearGradient>
          </defs>

          {/* Goal reference dashed line */}
          <line
            x1="30"
            y1={goalY}
            x2={svgWidth - 10}
            y2={goalY}
            stroke="rgba(250, 204, 21, 0.55)"
            strokeDasharray="4 4"
            strokeWidth="1.5"
          />
          <text
            x={svgWidth - 12}
            y={goalY - 5}
            textAnchor="end"
            fill="rgba(250, 204, 21, 0.85)"
            fontSize="10.5"
            fontWeight="600"
          >
            {t('dailyTarget', lang as any)} ({goalMinutes}m)
          </text>

          {/* Horizontal grid lines */}
          {[0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const y = paddingTop + chartHeight * (1 - pct);
            const val = Math.round(maxMinutes * pct);
            return (
              <g key={idx}>
                <line
                  x1="30"
                  y1={y}
                  x2={svgWidth - 10}
                  y2={y}
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeWidth="1"
                />
                <text
                  x="24"
                  y={y + 3}
                  textAnchor="end"
                  fill="rgba(255, 255, 255, 0.35)"
                  fontSize="9.5"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Zero baseline */}
          <line
            x1="30"
            y1={paddingTop + chartHeight}
            x2={svgWidth - 10}
            y2={paddingTop + chartHeight}
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth="1"
          />

          {/* Bars */}
          {chartData.map((d, idx) => {
            const x = 38 + idx * (barWidth + gap);
            const height = (d.minutes / maxMinutes) * chartHeight;
            const y = paddingTop + chartHeight - height;
            const isHovered = hoveredIdx === idx;
            const isPeak = d === peakDay && d.minutes > 0;

            return (
              <g
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Background track for each day */}
                <rect
                  x={x}
                  y={paddingTop}
                  width={barWidth}
                  height={chartHeight}
                  fill={isHovered ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.015)'}
                  rx="6"
                />

                {/* Filled bar */}
                {d.minutes > 0 && (
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(4, height)}
                    fill={isPeak ? 'url(#barGradHighlight)' : 'url(#barGrad)'}
                    rx="5"
                    style={{
                      filter: isHovered ? 'brightness(1.2)' : 'none',
                      transition: 'all 0.2s',
                    }}
                  />
                )}

                {/* Minute number on top of bar if space */}
                {d.minutes > 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={Math.max(paddingTop + 14, y - 5)}
                    textAnchor="middle"
                    fill={isPeak ? '#34d399' : 'rgba(255, 255, 255, 0.9)'}
                    fontSize={rangeDays === 7 ? '11' : '9.5'}
                    fontWeight="700"
                  >
                    {d.minutes}
                  </text>
                )}

                {/* Day label below */}
                <text
                  x={x + barWidth / 2}
                  y={svgHeight - 12}
                  textAnchor="middle"
                  fill={isHovered ? '#fff' : 'rgba(255, 255, 255, 0.6)'}
                  fontSize={rangeDays === 7 ? '11' : '9.5'}
                  fontWeight={isHovered ? '700' : '500'}
                >
                  {d.dayStr}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Popup */}
        {hoveredIdx !== null && chartData[hoveredIdx] && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              right: '12px',
              background: 'rgba(20, 20, 30, 0.92)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              color: '#fff',
              pointerEvents: 'none',
              boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontWeight: 650 }}>{chartData[hoveredIdx].label}</span>
            <span style={{ color: 'var(--muted)' }}>•</span>
            <span style={{ color: 'var(--accent-text)', fontWeight: 700 }}>
              {chartData[hoveredIdx].minutes} min
            </span>
            {chartData[hoveredIdx].sessionsCount > 0 && (
              <span style={{ color: 'var(--muted)' }}>
                ({chartData[hoveredIdx].sessionsCount} completed)
              </span>
            )}
            {chartData[hoveredIdx].metGoal && (
              <span style={{ color: '#34d399', fontWeight: 700 }}>✓ Goal</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
