import { For } from 'solid-js';
import { theme } from '../lib/theme';
import { sf } from '../lib/fontScale';
import type { ReviewAnnotation } from './review-types';

interface ReviewSidebarProps {
  annotations: ReviewAnnotation[];
  canSubmit: boolean;
  onDismiss: (id: string) => void;
  onScrollTo: (annotation: ReviewAnnotation) => void;
  onSubmit: () => void;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text;
}

export function ReviewSidebar(props: ReviewSidebarProps) {
  return (
    <div
      style={{
        width: '300px',
        'min-width': '300px',
        'border-left': `1px solid ${theme.border}`,
        display: 'flex',
        'flex-direction': 'column',
        background: theme.bgElevated,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          'border-bottom': `1px solid ${theme.border}`,
          'font-weight': '600',
          'font-size': sf(12),
          color: theme.fg,
        }}
      >
        Review Comments ({props.annotations.length})
      </div>

      {/* Scrollable list */}
      <div
        style={{
          flex: '1',
          'overflow-y': 'auto',
          padding: '8px',
        }}
      >
        <For each={props.annotations}>
          {(annotation) => (
            <div
              onClick={() => props.onScrollTo(annotation)}
              style={{
                padding: '8px 10px',
                'margin-bottom': '6px',
                'border-left': `3px solid ${theme.warning}`,
                'border-radius': '0 4px 4px 0',
                background: 'rgba(255,255,255,0.03)',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              {/* Dismiss button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  props.onDismiss(annotation.id);
                }}
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  background: 'transparent',
                  border: 'none',
                  color: theme.fgSubtle,
                  cursor: 'pointer',
                  padding: '2px 4px',
                  'font-size': sf(11),
                  'line-height': '1',
                  'border-radius': '2px',
                }}
              >
                &times;
              </button>

              {/* File path + line range */}
              <div
                style={{
                  'font-size': sf(10),
                  color: theme.fgSubtle,
                  'font-family': "'JetBrains Mono', monospace",
                  overflow: 'hidden',
                  'text-overflow': 'ellipsis',
                  'white-space': 'nowrap',
                  'padding-right': '16px',
                }}
              >
                {annotation.filePath}:{annotation.startLine}-{annotation.endLine}
              </div>

              {/* Code snippet */}
              <div
                style={{
                  'font-size': sf(10),
                  color: theme.fgMuted,
                  'font-family': "'JetBrains Mono', monospace",
                  'max-height': '2.4em',
                  overflow: 'hidden',
                  'margin-top': '2px',
                }}
              >
                {truncate(annotation.selectedText, 120)}
              </div>

              {/* Comment text */}
              <div
                style={{
                  'font-size': sf(11),
                  color: theme.fg,
                  'white-space': 'pre-wrap',
                  'margin-top': '4px',
                }}
              >
                {annotation.comment}
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '8px',
          'border-top': `1px solid ${theme.border}`,
        }}
      >
        <button
          onClick={() => props.onSubmit()}
          disabled={!props.canSubmit}
          style={{
            width: '100%',
            background: props.canSubmit ? theme.accent : theme.bgHover,
            color: props.canSubmit ? theme.accentText : theme.fgMuted,
            border: 'none',
            'font-weight': '600',
            'font-size': sf(12),
            padding: '8px 16px',
            'border-radius': '4px',
            cursor: props.canSubmit ? 'pointer' : 'default',
          }}
          title={props.canSubmit ? undefined : 'No agent available to receive review'}
        >
          Send to Agent ({props.annotations.length})
        </button>
      </div>
    </div>
  );
}
