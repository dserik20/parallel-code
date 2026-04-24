import { batch, createSignal, For, type JSX } from 'solid-js';
import { getPanelUserSize, setPanelUserSize, deletePanelUserSize } from '../store/store';

export interface PanelChild {
  id: string;
  content: () => JSX.Element;
  minSize?: number;
}

interface ResizablePanelProps {
  direction: 'horizontal' | 'vertical';
  children: PanelChild[];
  /** When set, user-drag pixel sizes persist under `${persistKey}:${childId}`. */
  persistKey?: string;
  /** ID(s) of the child(ren) that flex-absorb remaining space. Defaults to
   *  the last child. Multiple absorbers split remaining space equally
   *  (each gets `flex: 1 1 0`). A user-pinned child always takes its pinned
   *  size regardless of this flag; on drag, absorbers are never pinned so
   *  they keep filling remaining space after the user releases the handle. */
  absorberId?: string | string[];
  class?: string;
  style?: JSX.CSSProperties;
}

export function ResizablePanel(props: ResizablePanelProps) {
  let containerRef!: HTMLDivElement;
  const [draggingIdx, setDraggingIdx] = createSignal<number | null>(null);
  const [dragOverride, setDragOverride] = createSignal<Record<number, number>>({});

  const isHorizontal = () => props.direction === 'horizontal';
  const absorberIds = (): Set<string> => {
    const id = props.absorberId;
    if (!id) {
      const last = props.children[props.children.length - 1];
      return last ? new Set([last.id]) : new Set();
    }
    return new Set(Array.isArray(id) ? id : [id]);
  };
  const isAbsorber = (childId: string) => absorberIds().has(childId);
  const keyFor = (childId: string) => (props.persistKey ? `${props.persistKey}:${childId}` : null);

  function childStyle(child: PanelChild, idx: number): JSX.CSSProperties {
    const override = dragOverride()[idx];
    const key = keyFor(child.id);
    const userPinned = key ? getPanelUserSize(key) : undefined;
    // The sole absorber of a tree always fills remaining space — stale persisted
    // pins on it (e.g. from earlier development iterations) are ignored so the
    // AI terminal can never lose its "take whatever's left" role. Multi-absorber
    // trees still honor pins so user-dragged splits survive.
    const isSoleAbsorber = isAbsorber(child.id) && absorberIds().size === 1;
    const pinned = override ?? (isSoleAbsorber ? undefined : userPinned);
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
    return {
      flex: '0 0 auto',
      [minDim]: `${min}px`,
      overflow: 'hidden',
    };
  }

  /** Wrapper divs sit at even positions (0, 2, 4…), handles at odd positions. */
  function measureWrapper(idx: number): number {
    const el = containerRef.children[idx * 2] as HTMLElement | undefined;
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
    const keys: string[] = [];
    const leftKey = keyFor(props.children[handleIdx]?.id ?? '');
    const rightKey = keyFor(props.children[handleIdx + 1]?.id ?? '');
    if (leftKey) keys.push(leftKey);
    if (rightKey) keys.push(rightKey);
    if (keys.length > 0) deletePanelUserSize(keys);
  }

  return (
    <div
      ref={containerRef}
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
            <div style={childStyle(child, i())}>{child.content()}</div>
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
