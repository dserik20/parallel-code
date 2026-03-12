import { theme } from '../lib/theme';
import { sf } from '../lib/fontScale';
import type { ReviewAnnotation } from './review-types';

interface ReviewCommentCardProps {
  annotation: ReviewAnnotation;
  onDismiss: () => void;
}

export function ReviewCommentCard(props: ReviewCommentCardProps) {
  const lineLabel = () =>
    props.annotation.startLine === props.annotation.endLine
      ? `line ${props.annotation.startLine}`
      : `lines ${props.annotation.startLine}\u2013${props.annotation.endLine}`;

  return (
    <div
      style={{
        margin: '4px 40px 4px 80px',
        'border-left': `3px solid ${theme.warning}`,
        'border-radius': '0 4px 4px 0',
        background: theme.bgElevated,
        padding: '8px 12px',
        'font-family': "'JetBrains Mono', monospace",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'space-between',
        }}
      >
        <span
          style={{
            'font-size': sf(11),
            color: theme.warning,
          }}
        >
          Review &middot; {lineLabel()}
        </span>
        <button
          onClick={() => props.onDismiss()}
          style={{
            background: 'transparent',
            border: 'none',
            color: theme.fgMuted,
            cursor: 'pointer',
            padding: '2px 4px',
            'border-radius': '3px',
            'font-size': sf(14),
            'line-height': '1',
          }}
          title="Dismiss"
        >
          &times;
        </button>
      </div>

      {/* Comment text */}
      <div
        style={{
          color: theme.fg,
          'white-space': 'pre-wrap',
          'font-size': sf(12),
          'margin-top': '4px',
        }}
      >
        {props.annotation.comment}
      </div>
    </div>
  );
}
