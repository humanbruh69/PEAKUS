import React, { useEffect, useRef, useState } from 'react';

interface FlipDigitProps {
  char: string;
  animate?: boolean;
}

const FLIP_DURATION_MS = 480;

const FlipDigit: React.FC<FlipDigitProps> = ({ char, animate = true }) => {
  const [state, setState] = useState<{
    current: string;
    prev: string;
    flipping: boolean;
    flipGen: number;
  }>({
    current: char,
    prev: char,
    flipping: false,
    flipGen: 0,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setState(prevState => {
      if (prevState.current === char) return prevState;
      if (!animate) {
        return {
          current: char,
          prev: char,
          flipping: false,
          flipGen: prevState.flipGen,
        };
      }
      return {
        current: char,
        prev: prevState.current,
        flipping: true,
        flipGen: prevState.flipGen + 1,
      };
    });
  }, [char, animate]);

  useEffect(() => {
    if (!state.flipping) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setState(s => (s.flipping ? { ...s, prev: s.current, flipping: false } : s));
    }, FLIP_DURATION_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state.flipping, state.flipGen]);

  const { current, prev, flipping, flipGen } = state;
  const staticBottomChar = flipping ? prev : current;

  return (
    <span className={`d flip-card${flipping ? ' is-flipping' : ''}`}>
      {/* Static upper half displays incoming/current digit */}
      <span className="flip-half flip-top" aria-hidden="true">
        <span className="flip-glyph">{current}</span>
      </span>

      {/* Static lower half holds previous digit until bottom flap settles */}
      <span className="flip-half flip-bottom" aria-hidden="true">
        <span className="flip-glyph">{staticBottomChar}</span>
      </span>

      {/* Animated falling flaps keyed by flipGen so CSS animation restarts cleanly per change */}
      {flipping && (
        <React.Fragment key={flipGen}>
          <span className="flip-half flip-flap-top" aria-hidden="true">
            <span className="flip-glyph">{prev}</span>
          </span>
          <span className="flip-half flip-flap-bottom" aria-hidden="true">
            <span className="flip-glyph">{current}</span>
          </span>
        </React.Fragment>
      )}

      {/* Center hinge hairline + accessible character */}
      <span className="flip-hinge" aria-hidden="true" />
      <span className="flip-sr">{current}</span>
    </span>
  );
};

interface FlipClockDigitsProps {
  value: string;
  animate?: boolean;
}

export const FlipClockDigits: React.FC<FlipClockDigitsProps> = ({ value, animate = true }) => {
  return (
    <>
      {Array.from(value).map((ch, idx) => {
        if (ch === ':') {
          return (
            <span key={`col-${idx}`} className="c">
              :
            </span>
          );
        }
        return <FlipDigit key={`fd-${idx}`} char={ch} animate={animate} />;
      })}
    </>
  );
};
