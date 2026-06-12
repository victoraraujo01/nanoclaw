import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  ALERT_DEADLINE_DAY,
  ALERT_START_DAY,
  DAY_MS,
  buildAlertText,
  computePhoneOfflineAlert,
  isResetMessage,
} from './whatsapp-presence.js';

const NOW = 1_700_000_000_000;
const seen = (daysAgo: number) => NOW - daysAgo * DAY_MS;

describe('computePhoneOfflineAlert', () => {
  it('does not alert before the start day', () => {
    const state = { lastPhoneSeenMs: seen(6), lastAlertedDay: null };
    expect(computePhoneOfflineAlert(state, NOW)).toBeNull();
  });

  it('alerts on the start day', () => {
    const state = {
      lastPhoneSeenMs: seen(ALERT_START_DAY),
      lastAlertedDay: null,
    };
    const alert = computePhoneOfflineAlert(state, NOW);
    expect(alert?.daysOffline).toBe(ALERT_START_DAY);
    expect(alert?.text).toContain(`${ALERT_START_DAY} dias`);
  });

  it('alerts every new day past the threshold', () => {
    const state = { lastPhoneSeenMs: seen(10), lastAlertedDay: null };
    expect(computePhoneOfflineAlert(state, NOW)?.daysOffline).toBe(10);
  });

  it('dedupes within the same offline day', () => {
    const state = { lastPhoneSeenMs: seen(9), lastAlertedDay: 9 };
    expect(computePhoneOfflineAlert(state, NOW)).toBeNull();
  });

  it('re-alerts once the day count advances', () => {
    const state = { lastPhoneSeenMs: seen(10), lastAlertedDay: 9 };
    expect(computePhoneOfflineAlert(state, NOW)?.daysOffline).toBe(10);
  });

  it('still alerts at and past the 14-day deadline', () => {
    const state = {
      lastPhoneSeenMs: seen(ALERT_DEADLINE_DAY + 2),
      lastAlertedDay: null,
    };
    const alert = computePhoneOfflineAlert(state, NOW);
    expect(alert?.daysOffline).toBe(ALERT_DEADLINE_DAY + 2);
    expect(alert?.text).toContain('🔴');
  });
});

describe('buildAlertText', () => {
  it('escalates severity with the offline window', () => {
    expect(buildAlertText(7)).toContain('🟡');
    expect(buildAlertText(11)).toContain('🟠');
    expect(buildAlertText(14)).toContain('🔴');
  });

  it('shows remaining days before the deadline', () => {
    expect(buildAlertText(7)).toContain('~7 dia');
  });
});

describe('isResetMessage', () => {
  it('matches the keyword case- and space-insensitively', () => {
    expect(isResetMessage('celular ok')).toBe(true);
    expect(isResetMessage('  CELULAR OK ')).toBe(true);
  });

  it('rejects other text', () => {
    expect(isResetMessage('ok')).toBe(false);
    expect(isResetMessage('celular')).toBe(false);
  });
});
