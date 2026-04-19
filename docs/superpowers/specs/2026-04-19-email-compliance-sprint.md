# Email Compliance Sprint — Approach A

**Date:** 2026-04-19
**Status:** Implemented + shipped to backend `main` and `dev`.
**Goal:** Stop the SubRadar sending domain from being flagged as spam by Gmail / Yahoo / Apple. No engagement-layer or growth-email work — just the legal + deliverability minimum.

## Problem

Email audit on 2026-04-19 found 8 production email types but only 1 (Weekly Digest)
had Gmail's Feb-2024 bulk-sender requirements: `List-Unsubscribe` +
`List-Unsubscribe-Post: List-Unsubscribe=One-Click`. The other 7 (payment reminders,
trial expiry, monthly report, Pro expiration warnings) had none. There was no
bounce/complaint handler — repeated sends to a bouncing inbox would have us
thrown into the spam folder for everyone within weeks. There was no GDPR
consent record, no CAN-SPAM physical address, and the cron was not idempotent.

## Changes

### Suppression list (new)
- `SuppressedEmail` entity (`src/notifications/entities/suppressed-email.entity.ts`)
  with unique-by-email index, reason enum (`hard_bounce | soft_bounce | complaint
  | unsubscribe | manual`), and Resend event context.
- Migration `1776700000000-CreateSuppressedEmails.ts`.
- `SuppressionService` — single `isSuppressed(email)` / `suppress(email, reason)`
  surface, lower-cases addresses, idempotent `INSERT ... ON CONFLICT`.

### Resend webhook handler (new)
- `ResendWebhookController` at `POST /api/v1/notifications/resend-webhook`.
- Verifies Svix-style signature using `RESEND_WEBHOOK_SECRET` env (Resend's
  webhook signing format). Verification skipped if secret unset (dev).
- On `email.bounced` → suppress with reason `hard_bounce` or `soft_bounce`.
- On `email.complained` → suppress with reason `complaint`.
- All other event types are logged at debug level for future engagement work.

### Universal `List-Unsubscribe` headers
- `NotificationsService.sendEmail()` signature changed from
  `(to, subject, html, headers?)` to `(to, subject, html, opts?)` where
  `opts = { userId?, unsubType?, headers? }`.
- When `userId` is provided we auto-attach `List-Unsubscribe` and
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers pointing at the
  HMAC-signed unsubscribe URL.
- Suppression check happens before every Resend call — bouncing / unsubscribed
  addresses are silently dropped, never re-sent.
- Errors from Resend are logged with masked email + propagated, instead of
  being swallowed.

All four scheduled-mail call sites updated to pass `userId` + `unsubType`:
- `reminders.service.ts` payment reminders → `email_notifications`
- `reminders.service.ts` Pro-expiration 7-day notice → `email_notifications`
- `monthly-report.service.ts` → `email_notifications`
- `trial-checker.cron.ts` (×3) → `email_notifications`

Magic-link and OTP emails intentionally **don't** pass `userId`. They are
purely transactional, time-limited (15 min) and user-initiated, so the
List-Unsubscribe header is unnecessary and would actually be incorrect under
Gmail's bulk-sender definition.

### Footer rewrite (CAN-SPAM)
- `email-templates.ts` `wrap()` now takes
  `(content, { unsubscribeUrl?, preheader? })`.
- Footer now shows `Goalin LLP · Astana, Kazakhstan` (CAN-SPAM-required physical
  address) and three links: Unsubscribe (HMAC URL), Privacy, Terms.
- The previous footer pointed Unsubscribe at `/app/settings?tab=notifications`,
  which required login and was useless for cold-inbox unsubs.
- Added preheader text (hidden div, 110-char max) so Gmail's inbox preview
  shows useful context instead of the first visible HTML element.

### Templates updated to surface unsub URL
- `buildPaymentReminderHtml()` — accepts `unsubscribeUrl`, passes through to
  `wrap()`, generates locale-aware preheader.
- `buildWeeklyDigestHtml()` — already had `unsubscribeUrl` param; now also
  passes it to `wrap()` and adds preheader.
- `buildMonthlyReportHtml()` — preheader added.

### GDPR consent recording
- `users` table gains three nullable columns: `consentedAt`, `consentVersion`,
  `consentIp`. Backfill plan: existing users keep `NULL` (grandfathered), and
  the next policy-version bump triggers a one-off re-consent email.
- Migration `1776700001000-AddUserConsent.ts`.
- Setting these on signup is the next step (out of scope for this sprint —
  schema is in place so we can ship before the legal review of the consent UX).

### Reminder idempotency
- `subscriptions.lastReminderSentDate` (DATE) added.
- Migration `1776700002000-AddSubscriptionLastReminderDate.ts`.
- `RemindersService.sendDailyRemindersImpl()` now checks if today's UTC date
  equals `lastReminderSentDate` before sending; updates the column after a
  successful send (after, not before, so a Resend failure leaves the row unsent
  and the next cron retries).

### PII masking in logs
- `notifications.service.ts` now uses the existing `maskEmail` helper from
  `common/utils/pii.ts` everywhere it logs. Resend webhook controller and
  suppression service both ship with their own masking helpers.

## Out of scope (intentional)

- Welcome / onboarding sequences (Approach C).
- React Email / MJML migration (Approach B).
- Per-recipient send-volume rate limiting (next sprint — needs metrics first).
- Setting `consentedAt` at signup (needs UX review of consent checkbox copy).

## Operational follow-up

After deploy:
1. **In Resend dashboard** — verify domain `subradar.ai` has DKIM + SPF set up.
   If not, add DNS records exactly as Resend prescribes.
2. **In Resend dashboard → Webhooks** — add endpoint
   `https://api.subradar.ai/api/v1/notifications/resend-webhook`, subscribe to
   `email.bounced` and `email.complained`. Copy the signing secret and set
   `RESEND_WEBHOOK_SECRET` in GitHub Actions secrets.
3. Verify a test mail to a known-bouncing address adds a row to
   `suppressed_emails`. Verify a follow-up send to the same address logs
   "Email skipped — ... is on the suppression list" instead of hitting Resend.

## Files

**New:**
- `src/notifications/entities/suppressed-email.entity.ts`
- `src/notifications/suppression.service.ts`
- `src/notifications/resend-webhook.controller.ts`
- `src/migrations/1776700000000-CreateSuppressedEmails.ts`
- `src/migrations/1776700001000-AddUserConsent.ts`
- `src/migrations/1776700002000-AddSubscriptionLastReminderDate.ts`

**Modified:**
- `src/notifications/notifications.service.ts` — new `opts` signature, suppression check, header injection, masked logs
- `src/notifications/notifications.module.ts` — register suppression + webhook
- `src/notifications/email-templates.ts` — `wrap()` rewrite, preheaders, payment template
- `src/users/entities/user.entity.ts` — consent columns
- `src/subscriptions/entities/subscription.entity.ts` — `lastReminderSentDate`
- `src/reminders/reminders.service.ts` — idempotency check, userId pass-through
- `src/reminders/monthly-report.service.ts` — userId pass-through
- `src/subscriptions/trial-checker.cron.ts` — userId pass-through (×3)
