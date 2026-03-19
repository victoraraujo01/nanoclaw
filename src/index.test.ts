import path from 'path';
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

const { mockMkdirSync, mockWriteFileSync } = vi.hoisted(() => ({
  mockMkdirSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
}));

import { _makeOnMessageHandler, _setRegisteredGroups } from './index.js';
import { RegisteredGroup, NewMessage } from './types.js';

const DATA_DIR = '/tmp/nanoclaw-test-data';

vi.mock('./config.js', () => ({
  ASSISTANT_NAME: 'Andy',
  CREDENTIAL_PROXY_PORT: 0,
  IDLE_TIMEOUT: 30000,
  POLL_INTERVAL: 1000,
  TIMEZONE: 'UTC',
  TRIGGER_PATTERN: /@Andy/i,
  DATA_DIR: '/tmp/nanoclaw-test-data',
  GROUPS_DIR: '/tmp/nanoclaw-test-groups',
  IPC_POLL_INTERVAL: 500,
}));

// Silence db, channel, and startup imports
vi.mock('./db.js', () => ({
  initDatabase: vi.fn(),
  getRouterState: vi.fn(() => null),
  setRouterState: vi.fn(),
  getAllSessions: vi.fn(() => ({})),
  getAllRegisteredGroups: vi.fn(() => ({})),
  getAllChats: vi.fn(() => []),
  getAllTasks: vi.fn(() => []),
  getMessagesSince: vi.fn(() => []),
  getNewMessages: vi.fn(() => ({ messages: [], newTimestamp: '' })),
  storeMessage: vi.fn(),
  storeChatMetadata: vi.fn(),
  setRegisteredGroup: vi.fn(),
  setSession: vi.fn(),
}));

vi.mock('./channels/index.js', () => ({}));
vi.mock('./channels/registry.js', () => ({
  getRegisteredChannelNames: vi.fn(() => []),
  getChannelFactory: vi.fn(() => null),
}));
vi.mock('./container-runner.js', () => ({
  runContainerAgent: vi.fn(),
  writeGroupsSnapshot: vi.fn(),
  writeTasksSnapshot: vi.fn(),
}));
vi.mock('./container-runtime.js', () => ({
  ensureContainerRuntimeRunning: vi.fn(),
  cleanupOrphans: vi.fn(),
  PROXY_BIND_HOST: '127.0.0.1',
}));
vi.mock('./credential-proxy.js', () => ({
  startCredentialProxy: vi.fn(async () => ({ close: vi.fn() })),
}));
vi.mock('./remote-control.js', () => ({
  restoreRemoteControl: vi.fn(),
  startRemoteControl: vi.fn(),
  stopRemoteControl: vi.fn(),
}));
vi.mock('./task-scheduler.js', () => ({ startSchedulerLoop: vi.fn() }));
vi.mock('./ipc.js', () => ({ startIpcWatcher: vi.fn() }));
vi.mock('./sender-allowlist.js', () => ({
  loadSenderAllowlist: vi.fn(() => ({ logDenied: false })),
  shouldDropMessage: vi.fn(() => false),
  isSenderAllowed: vi.fn(() => true),
  isTriggerAllowed: vi.fn(() => false),
}));
vi.mock('./image.js', () => ({ parseImageReferences: vi.fn(() => []) }));
vi.mock('./logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  },
}));
vi.mock('./group-queue.js', () => {
  class GroupQueue {
    enqueueMessageCheck = vi.fn();
    sendMessage = vi.fn(() => false);
    closeStdin = vi.fn();
    notifyIdle = vi.fn();
    registerProcess = vi.fn();
    setProcessMessagesFn = vi.fn();
    shutdown = vi.fn(async () => {});
  }
  return { GroupQueue };
});

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    default: {
      ...actual,
      mkdirSync: mockMkdirSync,
      writeFileSync: mockWriteFileSync,
    },
  };
});

// ─── helpers ────────────────────────────────────────────────────────────────

function makeMsg(
  content: string,
  overrides: Partial<NewMessage> = {},
): NewMessage {
  return {
    id: 'msg-1',
    chat_jid: 'group@g.us',
    sender: 'user@s.whatsapp.net',
    sender_name: 'User',
    content,
    timestamp: '2024-01-01T00:00:00.000Z',
    is_from_me: false,
    is_bot_message: false,
    ...overrides,
  };
}

const REGISTERED_GROUP: RegisteredGroup = {
  name: 'Test Group',
  folder: 'test-group',
  trigger: '@Andy',
  added_at: '2024-01-01T00:00:00.000Z',
};

const GROUPS: Record<string, RegisteredGroup> = {
  'group@g.us': REGISTERED_GROUP,
};

// ─── tests ──────────────────────────────────────────────────────────────────

describe('/stop command', () => {
  let storeMessage: (msg: NewMessage) => void;
  let handleRemoteControl: (
    cmd: string,
    jid: string,
    msg: NewMessage,
  ) => Promise<void>;
  let onMessage: (chatJid: string, msg: NewMessage) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    storeMessage = vi.fn() as (msg: NewMessage) => void;
    handleRemoteControl = vi.fn(async () => {}) as (
      cmd: string,
      jid: string,
      msg: NewMessage,
    ) => Promise<void>;
    onMessage = _makeOnMessageHandler({
      getRegisteredGroups: () => GROUPS,
      storeMessage,
      handleRemoteControl,
    });
  });

  it('creates _close sentinel in the correct IPC input directory', () => {
    onMessage('group@g.us', makeMsg('/stop'));

    const expectedDir = path.join(DATA_DIR, 'ipc', 'test-group', 'input');
    const expectedSentinel = path.join(expectedDir, '_close');

    expect(mockMkdirSync).toHaveBeenCalledWith(expectedDir, {
      recursive: true,
    });
    expect(mockWriteFileSync).toHaveBeenCalledWith(expectedSentinel, '');
  });

  it('does not call storeMessage for /stop', () => {
    onMessage('group@g.us', makeMsg('/stop'));
    expect(storeMessage).not.toHaveBeenCalled();
  });

  it('does not create sentinel for unregistered group', () => {
    onMessage('unknown@g.us', makeMsg('/stop'));
    expect(mockMkdirSync).not.toHaveBeenCalled();
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('does not create sentinel for normal messages', () => {
    onMessage('group@g.us', makeMsg('@Andy do something'));
    expect(mockMkdirSync).not.toHaveBeenCalled();
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('stores normal messages instead of creating sentinel', () => {
    const msg = makeMsg('@Andy do something');
    onMessage('group@g.us', msg);
    expect(storeMessage).toHaveBeenCalledWith(msg);
  });

  it('ignores /stop with extra whitespace (trims content)', () => {
    onMessage('group@g.us', makeMsg('  /stop  '));
    const expectedDir = path.join(DATA_DIR, 'ipc', 'test-group', 'input');
    expect(mockMkdirSync).toHaveBeenCalledWith(expectedDir, {
      recursive: true,
    });
    expect(storeMessage).not.toHaveBeenCalled();
  });
});
