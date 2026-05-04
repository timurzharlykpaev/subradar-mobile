import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GmailClient } from '../services/gmail/gmailClient';
import { buildGmailQuery } from '../services/gmail/gmailQueryBuilder';
import { scannedMessageStore } from '../services/scannedMessageStore';
import { emailImportApi, Candidate } from '../api/emailImport';
import { useGmailAuth } from './useGmailAuth';
import { useSettingsStore } from '../stores/settingsStore';
import { emailImportTelemetry } from '../utils/emailImportTelemetry';

export type ScanStage =
  | 'fetching_list'
  | 'fetching_bodies'
  | 'parsing'
  | 'done';

export interface ScanProgress {
  stage: ScanStage;
  current: number;
  total: number;
}

export interface ScanResult {
  candidates: Candidate[];
  scannedCount: number;
  durationMs: number;
}

export class GmailScanError extends Error {
  constructor(
    public readonly code:
      | 'aborted'
      | 'token_revoked'
      | 'pro_required'
      | 'network'
      | 'unknown',
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'GmailScanError';
  }
}

/**
 * Orchestrates the full scan pipeline:
 *   allowlist fetch → Gmail query → list ids → batch fetch bodies →
 *   filter unscanned → POST /parse-bulk → filter recurring → return.
 *
 * Stage tracking via useRef so async catch-handlers see the current stage
 * (review M3 — useState in deps would create stale closures).
 *
 * 402 mid-scan (Pro expired between Add Sheet entry and parse-bulk call)
 * surfaces as `GmailScanError('pro_required')` so callers can route to
 * the paywall instead of showing a generic error (review H7).
 */
export function useGmailScan() {
  const auth = useGmailAuth();
  const { i18n } = useTranslation();
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const stageRef = useRef<ScanStage | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const setStage = useCallback((p: ScanProgress | null) => {
    stageRef.current = p?.stage ?? null;
    setProgress(p);
  }, []);

  const scan = useCallback(
    async (opts: { mode: 'shallow' } = { mode: 'shallow' }): Promise<ScanResult> => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const start = Date.now();
      emailImportTelemetry.scanStarted(opts.mode);

      try {
        await scannedMessageStore.init();

        // Stage 1: list message ids
        setStage({ stage: 'fetching_list', current: 0, total: 0 });
        const sendersRes = await emailImportApi.getKnownSenders().catch((e) => {
          if (e?.response?.status === 402) throw new GmailScanError('pro_required');
          throw e;
        });
        const senders = sendersRes.data.senders;
        const windowDays = useSettingsStore.getState().emailImportWindowDays;
        const query = buildGmailQuery({ windowDays, senders });

        const client = new GmailClient(auth.getAccessToken, ctrl.signal);
        const ids = await client.listMessages(query, 400);
        if (ctrl.signal.aborted) throw new GmailScanError('aborted');

        // Stage 2: dedup against locally-cached scanned message-ids
        const unscannedIds = await scannedMessageStore.filterUnscanned(ids);
        if (unscannedIds.length === 0) {
          setStage({ stage: 'done', current: 0, total: 0 });
          return { candidates: [], scannedCount: 0, durationMs: Date.now() - start };
        }

        // Stage 3: batch-fetch bodies (concurrency 10 inside GmailClient)
        setStage({ stage: 'fetching_bodies', current: 0, total: unscannedIds.length });
        const messages = await client.getMessagesBatch(unscannedIds, (cur, total) => {
          setStage({ stage: 'fetching_bodies', current: cur, total });
        });
        if (ctrl.signal.aborted) throw new GmailScanError('aborted');

        // Stage 4: AI parse on backend
        setStage({ stage: 'parsing', current: 0, total: messages.length });
        let parseRes;
        try {
          parseRes = await emailImportApi.parseBulk({
            messages: messages.map((m) => ({
              id: m.id,
              subject: m.subject,
              snippet: m.snippet,
              from: m.from,
              receivedAt: m.receivedAt,
            })),
            locale: i18n.language ?? 'en',
          });
        } catch (e: any) {
          if (e?.response?.status === 402) throw new GmailScanError('pro_required');
          if (e?.response?.status === 429) {
            throw new GmailScanError('network', 'rate_limited');
          }
          throw new GmailScanError('network', e?.message ?? 'parse_failed');
        }

        await scannedMessageStore.markScanned(
          messages.map((m) => ({ messageId: m.id, sourceSender: m.from })),
        );

        const recurring = parseRes.data.candidates.filter(
          (c) => c.isRecurring && !c.isCancellation,
        );
        setStage({ stage: 'done', current: recurring.length, total: recurring.length });

        const result: ScanResult = {
          candidates: recurring,
          scannedCount: messages.length,
          durationMs: Date.now() - start,
        };

        emailImportTelemetry.scanCompleted({
          found: recurring.length,
          durationMs: result.durationMs,
          mode: opts.mode,
        });
        if (recurring.length === 0) emailImportTelemetry.zeroResults();

        return result;
      } catch (e: any) {
        const stage = stageRef.current ?? 'unknown';
        const code = e instanceof GmailScanError ? e.code : 'unknown';
        if (code !== 'aborted') {
          emailImportTelemetry.scanFailed({
            stage,
            errorCode: e?.message ?? code ?? 'unknown',
          });
        }
        throw e;
      } finally {
        abortRef.current = null;
      }
    },
    [auth.getAccessToken, i18n.language, setStage],
  );

  /**
   * Same pipeline but invoked silently for the opportunistic re-scan path —
   * caller controls UX (banner / no UI).
   */
  const silentScan = useCallback(async () => {
    const r = await scan({ mode: 'shallow' });
    return { newCandidates: r.candidates };
  }, [scan]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { scan, silentScan, progress, cancel };
}
