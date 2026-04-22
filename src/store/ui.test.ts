import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MockStore = {
  activeTaskId: string | null;
  focusMode: boolean;
  tasks: Record<string, { id: string }>;
  focusedPanel: Record<string, string>;
};

let mockStore: MockStore;
const mocks = vi.hoisted(() => ({
  setActiveTask: vi.fn((id: string) => {
    mockStore.activeTaskId = id;
  }),
  setTaskFocusedPanel: vi.fn((taskId: string, panel: string) => {
    mockStore.focusedPanel[taskId] = panel;
  }),
}));

function setStorePath(...args: unknown[]): void {
  const value = args[args.length - 1];
  let target: Record<string, unknown> = mockStore as unknown as Record<string, unknown>;
  for (let i = 0; i < args.length - 2; i++) {
    const key = args[i] as string;
    const next = target[key] as Record<string, unknown> | undefined;
    if (!next || typeof next !== 'object') {
      target[key] = {};
    }
    target = target[key] as Record<string, unknown>;
  }
  target[args[args.length - 2] as string] = value;
}

vi.mock('solid-js', () => ({
  batch: (fn: () => void) => fn(),
}));

vi.mock('./core', () => ({
  store: new Proxy(
    {},
    {
      get(_target, prop) {
        return mockStore[prop as keyof MockStore];
      },
    },
  ),
  setStore: vi.fn((...args: unknown[]) => setStorePath(...args)),
}));

vi.mock('./navigation', () => ({
  setActiveTask: mocks.setActiveTask,
}));

vi.mock('./focus', () => ({
  setTaskFocusedPanel: mocks.setTaskFocusedPanel,
}));

vi.mock('../lib/ipc', () => ({
  invoke: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../electron/ipc/channels', () => ({
  IPC: {},
}));

import { toggleTaskFocusMode } from './ui';

beforeEach(() => {
  mockStore = {
    activeTaskId: 'task-1',
    focusMode: false,
    tasks: {
      'task-1': { id: 'task-1' },
      'task-2': { id: 'task-2' },
    },
    focusedPanel: {},
  };

  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('toggleTaskFocusMode', () => {
  it('refocuses the last focused task panel when entering focus mode', () => {
    mockStore.focusedPanel['task-1'] = 'notes';

    toggleTaskFocusMode('task-1');

    expect(mockStore.focusMode).toBe(true);
    expect(mocks.setTaskFocusedPanel).toHaveBeenCalledWith('task-1', 'notes');
  });

  it('falls back to the default task panel when there is no remembered focus', () => {
    toggleTaskFocusMode('task-1');

    expect(mocks.setTaskFocusedPanel).toHaveBeenCalledWith('task-1', 'ai-terminal');
    expect(mockStore.focusedPanel['task-1']).toBe('ai-terminal');
  });

  it('does not refocus again when leaving focus mode', () => {
    mockStore.focusMode = true;

    toggleTaskFocusMode('task-1');

    expect(mockStore.focusMode).toBe(false);
    expect(mocks.setTaskFocusedPanel).not.toHaveBeenCalled();
  });

  it('activates the requested task before entering focus mode', () => {
    mockStore.activeTaskId = 'task-1';
    mockStore.focusedPanel['task-2'] = 'changed-files';

    toggleTaskFocusMode('task-2');

    expect(mocks.setActiveTask).toHaveBeenCalledWith('task-2');
    expect(mockStore.activeTaskId).toBe('task-2');
    expect(mocks.setTaskFocusedPanel).toHaveBeenCalledWith('task-2', 'changed-files');
  });
});
