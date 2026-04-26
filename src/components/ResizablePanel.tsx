import { batch, createEffect, createMemo, createSignal, For, type JSX } from 'solid-js';
import { getPanelUserSize, setPanelUserSize, deletePanelUserSize } from '../store/store';

export interface PanelChild {
  id: string;
  content: () => JSX.Element;
  minSize?: number;
  /** Starting flex-basis (px) for non-absorbers without a user-pinned size.
   *  Without this, non-absorbers fall back to `auto` (content-sized), which
   *  in horizontal splits lets wide intrinsic content push the column far
   *  past its min. Use whenever content-driven sizing would surprise. */
  defaultSize?: number;
}

interface ResizablePanelProps {
  direction: 'horizontal' | 'vertical';
  children: PanelChild[];
  /** When set, user-drag pixel sizes persist under `${persistKey}:${childId}`. */
  persistKey?: string;
  /** IDs of the children that flex-absorb remaining space. Defaults to the
   *  last child. Multiple entries split remaining space equally via
   *  `flex: 1 1 0` on each. A user-pinned child always takes its pinned size;
   *  on drag, absorbers adjacent to non-absorbers are never pinned so they
   *  keep filling remaining space after release. */
  absorberIds?: string[];
  class?: string;
  style?: JSX.CSSProperties;
}

export function ResizablePanel(props: ResizablePanelProps) {
  const [draggingIdx, setDraggingIdx] = createSignal<number | null>(null);
  const [dragOverride, setDragOverride] = createSignal<Record<number, number>>({});
  /** Stable per-index refs so drag measurement doesn't rely on DOM index math. */
  const wrapperRefs: HTMLDivElement[] = [];

  const isHorizontal = () => props.direction === 'horizontal';

  const absorberSet = createMemo((): Set<string> => {
    const ids = props.absorberIds;
    if (ids && ids.length > 0) return new Set(ids);
    const last = props.children[props.children.length - 1];
    return last ? new Set([last.id]) : new Set();
  });
  const isAbsorber = (childId: string) => absorberSet().has(childId);

  const keyFor = (childId: string): string | null =>
    props.persistKey ? `${props.persistKey}:${childId}` : null;

  /** Sole absorbers must never carry a persisted pin — the drag-release path
   *  refuses to write one, but legacy data or renamed-absorber migrations can
   *  leave stale entries behind. Delete them as they're detected so the store
   *  self-heals instead of silently diverging from what the user sees. */
  createEffect(() => {
    const absorbers = absorberSet();
    if (absorbers.size !== 1) return;
    const stale: string[] = [];
    for (const child of props.children) {
      if (!absorbers.has(child.id)) continue;
      const key = keyFor(child.id);
      if (key && getPanelUserSize(key) !== undefined) stale.push(key);
    }
    if (stale.length > 0) deletePanelUserSize(stale);
  });

  function childStyle(child: PanelChild, idx: number): JSX.CSSProperties {
    const override = dragOverride()[idx];
    const key = keyFor(child.id);
    const pinned = override ?? (key ? getPanelUserSize(key) : undefined);
    const dim = isHorizontal() ? 'width' : 'height';
    const minDim = isHorizontal() ? 'min-width' : 'min-height';
    const min = child.minSize ?? 0;

    if (pinned !== undefined) {
      return {
        flex: `0 0 ${pinned}px`,
        [dim]: `${pinned}px`,
        [minDim]: `${min}px`,
        overflow: 'hidden',
      };
    }
    if (isAbsorber(child.id)) {
      return {
        flex: '1 1 0',
        [minDim]: `${min}px`,
        overflow: 'hidden',
      };
    }
    if (child.defaultSize !== undefined) {
      return {
        flex: `0 0 ${child.defaultSize}px`,
        [dim]: `${child.defaultSize}px`,
        [minDim]: `${min}px`,
        overflow: 'hidden',
      };
    }
    return {
      flex: '0 0 auto',
      [minDim]: `${min}px`,
      overflow: 'hidden',
    };
  }

  function measureWrapper(idx: number): number {
    const el = wrapperRefs[idx];
    if (!el) return 0;
    return isHorizontal() ? el.getBoundingClientRect().width : el.getBoundingClientRect().height;
  }

  function beginDrag(handleIdx: number, e: MouseEvent) {
    e.preventDefault();
    const leftChild = props.children[handleIdx];
    const rightChild = props.children[handleIdx + 1];
    if (!leftChild || !rightChild) return;

    setDraggingIdx(handleIdx);
    const startPos = isHorizontal() ? e.clientX : e.clientY;
    const startLeft = measureWrapper(handleIdx);
    const startRight = measureWrapper(handleIdx + 1);
    const leftMin = leftChild.minSize ?? 0;
    const rightMin = rightChild.minSize ?? 0;
    let latestLeft = startLeft;
    let latestRight = startRight;

    const onMove = (ev: MouseEvent) => {
      let delta = (isHorizontal() ? ev.clientX : ev.clientY) - startPos;
      if (startLeft + delta < leftMin) delta = leftMin - startLeft;
      if (startRight - delta < rightMin) delta = startRight - rightMin;
      latestLeft = startLeft + delta;
      latestRight = startRight - delta;
      setDragOverride({ [handleIdx]: latestLeft, [handleIdx + 1]: latestRight });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDraggingIdx(null);
      // An absorber adjacent to a non-absorber keeps its flex:1 1 0 role on
      // drag-release (otherwise panels like the AI terminal would stop filling
      // remaining space after any drag involving their edge). When both sides
      // are absorbers, pin both so the user's explicit split survives.
      const leftIsAbs = isAbsorber(leftChild.id);
      const rightIsAbs = isAbsorber(rightChild.id);
      const leftKey = leftIsAbs && !rightIsAbs ? null : keyFor(leftChild.id);
      const rightKey = rightIsAbs && !leftIsAbs ? null : keyFor(rightChild.id);
      batch(() => {
        if (leftKey) setPanelUserSize(leftKey, latestLeft);
        if (rightKey) setPanelUserSize(rightKey, latestRight);
        // Clear the drag override in the same batch so there's no frame where
        // both the override and the fresh userSize are absent.
        setDragOverride({});
      });
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function unpin(handleIdx: number) {
    const left = props.children[handleIdx];
    const right = props.children[handleIdx + 1];
    if (!left || !right || !props.persistKey) return;
    deletePanelUserSize([`${props.persistKey}:${left.id}`, `${props.persistKey}:${right.id}`]);
  }

  return (
    <div
      class={props.class}
      style={{
        display: 'flex',
        'flex-direction': isHorizontal() ? 'row' : 'column',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        ...props.style,
      }}
    >
      <For each={props.children}>
        {(child, i) => (
          <>
            <div
              ref={(el) => {
                wrapperRefs[i()] = el;
              }}
              style={childStyle(child, i())}
            >
              {child.content()}
            </div>
            {i() < props.children.length - 1 && (
              <div
                class={`resize-handle resize-handle-${isHorizontal() ? 'h' : 'v'} ${draggingIdx() === i() ? 'dragging' : ''}`}
                onMouseDown={(e) => beginDrag(i(), e)}
                onDblClick={() => unpin(i())}
              />
            )}
          </>
        )}
      </For>
    </div>
  );
}
