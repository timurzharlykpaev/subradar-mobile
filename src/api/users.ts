import { apiClient } from './client';

export const usersApi = {
  /**
   * Fetch the canonical user profile (used for startup reconciliation
   * of local-vs-server currency / locale state).
   */
  getMe: () => apiClient.get('/users/me'),

  updateMe: (data: {
    name?: string;
    avatarUrl?: string;
    fcmToken?: string;
    region?: string;
    displayCurrency?: string;
    /**
     * IANA timezone string (e.g. "Europe/Berlin", "Asia/Almaty"). Used
     * server-side to schedule reminder pushes in the user's local time
     * (`reminders.service.ts:89` reads `user.timezoneDetected`).
     */
    timezoneDetected?: string;
    /**
     * BCP-47-ish locale (e.g. "en", "ru", "ru-RU"). Backend normalizes to "ru".
     */
    locale?: string;
    /**
     * Date display preference for emails / PDF reports (DD/MM, MM/DD,
     * YYYY-MM-DD). Persisted on `users.dateFormat`. Without this, the
     * Settings toggle was a client-only mock — emails and PDFs always
     * used the backend default regardless of what the user picked.
     */
    dateFormat?: string;
    /**
     * Mark first-run onboarding as finished server-side. Sent once when the
     * user reaches the dashboard so the backend `users.onboardingCompleted`
     * column (and the onboarding-funnel analytics built on it) reflects
     * reality instead of staying empty. The backend started accepting this
     * field again after the UpdateUserDto whitelist fix — older builds that
     * never sent it simply keep the column at its default.
     */
    onboardingCompleted?: boolean;
  }) => apiClient.patch('/users/me', data),
};
