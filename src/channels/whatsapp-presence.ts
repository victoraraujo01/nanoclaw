import fs from 'fs';
import path from 'path';

import { STORE_DIR } from '../config.js';
import { logger } from '../logger.js';

/**
 * Phone-presence monitor for WhatsApp's multi-device 14-day rule.
 *
 * WhatsApp logs out all linked devices if the primary phone (here, the
 * unattended "home phone" the Claw account is linked to) stays offline for
 * more than 14 days. NanoClaw can't prevent that — the timer is enforced
 * server-side. What it CAN do is warn the user on their traveling phone
 * before the cliff, so they bring the home phone back online in time.
 *
 * We can't read the home phone's last-seen time reliably from Baileys, so we
 * reset the counter on the strongest signals available:
 *   - automatic: any message typed ON the home phone (on a shared number the
 *     assistant prefixes its own messages, so a non-bot fromMe message proves
 *     the home phone — the only other device — was online);
 *   - manual: the user replies to an alert from their traveling phone with a
 *     keyword, confirming they verified the home phone is back online.
 *
 * Counting always errs toward alerting early, never late: a missed online
 * signal costs an extra (ignorable) nudge, never a silent logout.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;
/** Start nagging this many days after the home phone was last seen online. */
export const ALERT_START_DAY = 7;
/** WhatsApp drops linked devices after ~14 days offline. */
export const ALERT_DEADLINE_DAY = 14;
/** Reply with this (from the traveling phone) to clear alerts manually. */
export const RESET_KEYWORD = 'celular ok';

const PRESENCE_FILE = path.join(STORE_DIR, 'phone-presence.json');

export interface PhonePresenceState {
  /** Epoch ms of the last confirmed home-phone activity. */
  lastPhoneSeenMs: number;
  /** Offline-day count for which an alert was last sent (dedupes daily). */
  lastAlertedDay: number | null;
}

export function loadPresenceState(): PhonePresenceState | null {
  try {
    const raw = fs.readFileSync(PRESENCE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<PhonePresenceState>;
    if (typeof parsed.lastPhoneSeenMs !== 'number') return null;
    return {
      lastPhoneSeenMs: parsed.lastPhoneSeenMs,
      lastAlertedDay:
        typeof parsed.lastAlertedDay === 'number'
          ? parsed.lastAlertedDay
          : null,
    };
  } catch {
    return null;
  }
}

export function savePresenceState(state: PhonePresenceState): void {
  try {
    fs.mkdirSync(STORE_DIR, { recursive: true });
    fs.writeFileSync(PRESENCE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    logger.warn({ err }, 'Failed to persist phone-presence state');
  }
}

/**
 * Seed the store on first run. We only get here while connected, and to be
 * connected the home phone was online within the last 14 days, so "now" is a
 * safe, conservative starting point (it never under-counts the offline window).
 */
export function initPhonePresence(nowMs: number = Date.now()): void {
  if (loadPresenceState()) return;
  savePresenceState({ lastPhoneSeenMs: nowMs, lastAlertedDay: null });
  logger.info('Phone-presence tracking initialized');
}

/** True if the given text is the manual reset keyword. */
export function isResetMessage(text: string): boolean {
  return text.trim().toLowerCase() === RESET_KEYWORD;
}

/**
 * Record confirmed home-phone activity and clear any pending alert state.
 * Returns whether an alert cycle was active (so the caller can confirm to the
 * user that alerts are cleared).
 */
export function recordPhoneSeen(nowMs: number = Date.now()): boolean {
  const prev = loadPresenceState();
  const wasAlerting = prev?.lastAlertedDay != null;
  savePresenceState({ lastPhoneSeenMs: nowMs, lastAlertedDay: null });
  if (wasAlerting) {
    logger.info('Home phone seen online again, offline alerts cleared');
  }
  return wasAlerting;
}

/**
 * Decide whether to alert and what to say. Pure function for testability.
 * Returns null when no alert is due (also dedupes within the same day).
 */
export function computePhoneOfflineAlert(
  state: PhonePresenceState,
  nowMs: number,
): { daysOffline: number; text: string } | null {
  const daysOffline = Math.floor((nowMs - state.lastPhoneSeenMs) / DAY_MS);
  if (daysOffline < ALERT_START_DAY) return null;
  if (state.lastAlertedDay === daysOffline) return null; // already alerted today
  return { daysOffline, text: buildAlertText(daysOffline) };
}

export function buildAlertText(daysOffline: number): string {
  const daysLeft = Math.max(ALERT_DEADLINE_DAY - daysOffline, 0);
  const header =
    daysOffline >= ALERT_DEADLINE_DAY
      ? '🔴 CRÍTICO'
      : daysOffline >= 11
        ? '🟠 URGENTE'
        : '🟡 Lembrete';

  const deadline =
    daysLeft <= 0
      ? 'O limite de 14 dias do WhatsApp foi atingido — a Claw pode cair a qualquer momento e exigir novo pareamento.'
      : `Faltam ~${daysLeft} dia(s) para o WhatsApp desconectar a Claw automaticamente (limite de 14 dias sem o celular online).`;

  return [
    `${header}: o celular de casa não dá sinal de atividade há ${daysOffline} dias.`,
    '',
    deadline,
    '',
    `Para resolver: confirme que o celular de casa está ligado e conectado ao WiFi. Depois responda "${RESET_KEYWORD}" aqui para zerar o contador.`,
  ].join('\n');
}
