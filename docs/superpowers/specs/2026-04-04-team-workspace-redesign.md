# Team Workspace Redesign — Design Spec

**Date:** 2026-04-04
**Status:** Draft
**Scope:** Full-stack (NestJS backend + React Native mobile)
**Target audience:** Small teams/startups (3-10 members), full transparency model
**Repos:** subradar-backend, subradar-mobile

---

## 1. Overview

Transform Team Workspace from a basic member list with spending totals into an AI-powered financial intelligence dashboard for teams. Key changes:

- **Invite Code System** — replace broken email invite with 6-char sharable codes (48h TTL, single-use)
- **Cross-Team AI Analysis** — detect duplicate subscriptions across members, suggest team/family plans
- **Dashboard Redesign** — hero card with AI savings, overlap detection, spending chart, member management
- **Permissions** — Owner/Admin/Member roles with proper enforcement
- **Growth mechanics** — teasers for Free/Pro, viral invite loop, Team Savings badge on dashboard

### Dependencies

Builds on the AI Analytics Pipeline (already implemented):
- `AnalysisResult.overlaps` field
- `AnalysisProcessor` with team prompt
- `AnalysisCronService` weekly trigger for Team users
- Email digest template for team

---

## 2. Invite Code System

### Current Problem

Owner enters email → PENDING record created → no acceptance mechanism. Dead feature.

### New Flow

**Owner generates code:**
```
POST /workspace/:id/invite-code
  → Checks: requester is Owner or Admin
  → Generates 6-char code (A-Z0-9, excluding 0O1IL for readability)
  → Stores with TTL 48h, single-use
  → Returns { code, expiresAt }
  → Max 5 active codes per workspace
```

**Participant joins:**
```
POST /workspace/join/:code
  → Validates: code exists, not used, not expired
  → Validates: user not already member, workspace not full (maxMembers)
  → Marks code as used (usedBy, usedAt)
  → Creates WorkspaceMember (status=ACTIVE, role=MEMBER)
  → Returns { workspace, member }
  → Triggers team analysis re-run (debounced 1h)
```

### InviteCode Entity

```ts
@Entity('invite_codes')
class InviteCode {
  id: uuid
  workspaceId: uuid
  code: string           // 6 chars, unique
  createdBy: uuid
  usedBy: uuid | null
  usedAt: Date | null
  expiresAt: Date        // createdAt + 48h
  createdAt: Date
}
```

### Code Generation

- Character set: `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (30 chars, no 0O1IL)
- 30^6 = 729M combinations — collision extremely unlikely
- Retry on collision (unique constraint)
- Rate limit: 10 generations per hour per workspace

### Mobile UX

**Owner — generate & share:**
```
[+ Invite] button on workspace header
     │
     ▼
┌──────────────────────────┐
│  Invite Code: A7K2M9     │
│  Expires in 48 hours     │
│  Single use              │
│                          │
│  [Copy]  [Share]         │
└──────────────────────────┘
```

Share uses native Share API with message:
"Join my team on Subradar! Code: A7K2M9 — Download: https://subradar.ai/download"

**Participant — join:**
```
Workspace tab (empty state) → [Join Team]
or Settings → [Join Team]
     │
     ▼
┌──────────────────────────┐
│  Enter invite code:      │
│  [_ _ _ _ _ _]           │
│           [Join]         │
└──────────────────────────┘
```

6-char input with auto-uppercase, auto-submit on 6th char.

### Deprecation of Email Invite

Existing `POST /workspace/:id/invite { email }` endpoint kept for backward compat but hidden from UI. All new invites go through code flow.

---

## 3. Team Dashboard Redesign

### New Layout (top to bottom)

**Header:**
- Workspace name (title)
- Member count + plan badge
- Settings gear icon + Invite button

**Hero Card:**
```
┌─────────────────────────────────────┐
│ 💰 Team Spend        $1,240/mo      │
│    AI potential savings: $142       │
│    [View AI Analysis →]             │
└─────────────────────────────────────┘
```
- Total monthly spend across all members
- AI savings from `AnalysisResult.teamSavings` (null if no analysis yet)
- "View AI Analysis" → navigates to analytics tab (TeamAnalyticsSection)
- If no AI result: "Run AI analysis to find team savings" with trigger button

**Stats Row:**
```
┌──────────┐ ┌──────────┐
│ 47       │ │ $248     │
│ subs     │ │ avg/member│
└──────────┘ └──────────┘
```

**Subscription Overlaps Section:**
- Data from `AnalysisResult.overlaps[]`
- Each overlap card shows:
  - Service name + member count
  - Current total cost (sum of individual payments)
  - Suggested team/family plan + price
  - Savings amount (positive = save, negative = "not worth it" — hide these)
- If no overlaps or no analysis: placeholder with "Run analysis" CTA
- Only show overlaps with positive savings

**Spending by Member (horizontal bar chart):**
- Simple bar chart using View + proportional widths
- Sorted by spend descending
- Each bar: member name + amount
- Uses theme colors, no external chart library

**Members Section:**
- List of all members (active + pending)
- Each row: avatar initial, name/email, role badge, monthly spend, actions
- Owner/Admin see remove button (✕) for Members
- PENDING members shown in gray with "Pending" badge
- Member can't see remove buttons

**Team Settings (bottom):**
- Member: "Leave Team" button
- Owner: "Delete Team" button (red, confirmation required)

### Data Sources

- Analytics: existing `GET /workspace/me/analytics` (member spending, totals)
- AI overlaps: `GET /workspace/me/analysis/latest` (from AI pipeline)
- No new endpoints needed for dashboard data

---

## 4. AI Integration for Team

### What Already Exists

- `AnalysisResult` entity with `overlaps`, `teamSavings`, `memberCount` fields
- `AnalysisProcessor` with team prompt addition
- `AnalysisCronService` weekly trigger for Team users
- Email digest template for team

### What Needs Implementation

**1. stageCollect branch for workspaceId**

When `workspaceId` is set, collect subscriptions from ALL active workspace members:
- Get workspace via WorkspaceService
- Filter members by status=ACTIVE and userId not null
- Load all ACTIVE/TRIAL subscriptions for member userIds
- Build `memberSubscriptions` array: `[{ userId, name, subscriptions[] }]`
- Include memberSubscriptions in AI prompt

**2. Team AI prompt**

Addition to system prompt when workspaceId is present:
```
Additionally, analyze cross-member subscription overlap:
- Identify services used by 2+ team members individually
- For each overlap: suggest team/organization/family plan if available
- Calculate savings from consolidation (current total vs team plan cost)
- If team plan is MORE expensive than individual total, mark as "not_worth_it"
- Rank by total team savings (highest first)
```

**3. Workspace analysis endpoints**

```
GET  /workspace/me/analysis/latest   → team AnalysisResult with overlaps
POST /workspace/me/analysis/run      → trigger team analysis (Owner/Admin only)
```

These use existing `AnalysisService.run()` with `workspaceId` parameter.

**4. Trigger on member join/leave**

When member joins (via invite code) or leaves — trigger team analysis re-run with debounce 1h (same pattern as subscription change).

### Team Analysis Limits

| Limit | Team |
|-------|------|
| Max members in analysis | 20 |
| Max total subscriptions | 100 |
| Token limit | 16K input |
| Web searches | 10 per analysis |
| Analyses per week | 1 auto + 1 manual |
| Manual cooldown | 24h |

### Cost

Team analysis costs ~$0.06-$0.10 per run (more subscriptions = more tokens). At 1000 team workspaces × 2 analyses/month = ~$150/month. Covered by $9.99/mo team plan revenue.

---

## 5. Permissions & Member Management

### Role Matrix

| Action | Owner | Admin | Member |
|--------|-------|-------|--------|
| View all subscriptions & analytics | ✅ | ✅ | ✅ |
| Generate invite code | ✅ | ✅ | ❌ |
| Remove member | ✅ | ✅ (not Owner/Admin) | ❌ |
| Change member role | ✅ | ❌ | ❌ |
| Rename workspace | ✅ | ✅ | ❌ |
| Delete workspace | ✅ | ❌ | ❌ |
| Trigger AI analysis | ✅ | ✅ | ❌ |
| Leave workspace | ❌ (must delete) | ✅ | ✅ |

### Privacy Model

Full transparency — all members see all subscriptions of all members (name, amount, plan, category). This is the core value proposition: "transparently see who pays for what to optimize together."

### New Endpoints

| Method | Path | Who | Description |
|--------|------|-----|-------------|
| PATCH | `/workspace/:id` | Owner/Admin | Rename workspace `{ name }` |
| POST | `/workspace/:id/leave` | Admin/Member | Self-remove from workspace |
| DELETE | `/workspace/:id` | Owner | Delete workspace + all members + related analysis data |
| PATCH | `/workspace/:id/members/:memberId/role` | Owner | Change role `{ role: 'ADMIN' \| 'MEMBER' }` |

### Leave Flow

1. Member taps "Leave Team"
2. Confirmation dialog: "Leave {name}? You'll lose access to team analytics."
3. `POST /workspace/:id/leave`
4. Backend: delete WorkspaceMember where userId = current user
5. Mobile: redirect to workspace empty state
6. Trigger team analysis debounced re-run

### Delete Flow

1. Owner taps "Delete Team"
2. Confirmation: "Delete {name}? All members will be removed. Cannot be undone."
3. `DELETE /workspace/:id`
4. Backend: delete all WorkspaceMembers + InviteCodes + Workspace. Related AnalysisResults cleaned up by weekly cleanup cron.
5. Mobile: all members see empty state on next refresh

### Abuse Prevention

- Max 1 workspace as owner per user
- Can be member of multiple workspaces (but UI shows first active)
- Max 5 active invite codes per workspace at a time
- Invite code: 48h TTL, single-use
- Max members: 10 (enforced at join, not just generation)
- Rate limit: 10 invite code generations per hour per workspace
- Owner cannot leave (must delete)
- Owner downgrade from Team to Pro/Free: workspace stays, but analytics/AI stop working. Members still see cached data. Dashboard shows "Owner needs Team plan" banner. Workspace is NOT auto-deleted.

---

## 6. Growth & Monetization

### Plan Gating

| Feature | Free | Pro | Team ($9.99/mo) |
|---------|------|-----|------|
| Create workspace | ❌ | ❌ | ✅ |
| Join workspace (via code) | ✅ | ✅ | ✅ |
| View team analytics | ❌ | ❌ | ✅ (owner plan) |
| AI team analysis | ❌ | ❌ | ✅ |
| Team email digest | ❌ | ❌ | ✅ |

**Key:** Join is free for all plans. Only OWNER needs Team plan. Members on Free/Pro can join and see data as long as workspace owner is on Team plan.

### Free/Pro User Teasers

**Dashboard widget** (for users NOT in a workspace):
```
┌──────────────────────────────────┐
│ 👥 Team Workspace                │
│ Track team spending together.    │
│ AI finds shared savings.         │
│ [Create Team — Team Plan]        │
└──────────────────────────────────┘
```

**Workspace tab empty state** (non-Team users):
- Feature list (see who pays, find duplicates, switch to family plans, weekly report)
- [Start Team — $9.99/mo] button → paywall
- [Join Team] link for users with invite code

### Viral Invite Loop

```
Owner creates team → generates invite code → shares via native Share API
  → "Join my team on Subradar! Code: A7K2M9 — Download: https://subradar.ai/download"
  → Recipient installs app → signs up (free) → enters code → joins workspace
  → Adds their subscriptions → AI detects overlaps → everyone sees savings
```

### Team Savings Badge on Dashboard

For active workspace members — small badge on main dashboard:
```
┌──────────────────────────────────┐
│ 👥 Team savings: $142/mo         │
│ 3 overlaps found                │
└──────────────────────────────────┘
```
Tapping navigates to workspace tab. Data from last `AnalysisResult.teamSavings`.

---

## 7. Implementation Scope

### Backend (subradar-backend)

**New files:**
- `src/workspace/entities/invite-code.entity.ts`
- `src/migrations/TIMESTAMP-CreateInviteCodes.ts`

**Modified files:**
- `src/workspace/workspace.controller.ts` — 6 new endpoints (invite-code, join, leave, delete, rename, change-role) + 2 analysis endpoints
- `src/workspace/workspace.service.ts` — invite code logic, leave, delete, role change, permission checks
- `src/workspace/workspace.module.ts` — register InviteCode entity, import AnalysisModule
- `src/analysis/analysis.processor.ts` — stageCollect branch for workspaceId (collect all members' subs)
- `src/analysis/analysis.service.ts` — computeInputHash for workspace, onMemberChange trigger
- `src/analysis/analysis.controller.ts` — workspace analysis endpoints (if not in workspace controller)

### Mobile (subradar-mobile)

**New components:**
- `src/components/InviteCodeSheet.tsx` — generate + display code + Copy/Share buttons
- `src/components/JoinTeamSheet.tsx` — 6-char code input + join
- `src/components/TeamOverlaps.tsx` — overlap cards from AI result
- `src/components/TeamSpendChart.tsx` — horizontal bar chart by member
- `src/components/TeamSavingsBadge.tsx` — compact badge for dashboard

**New hooks:**
- `src/hooks/useWorkspaceAnalysis.ts` — useWorkspaceAnalysisLatest(), useRunWorkspaceAnalysis()

**New API methods (in src/api/workspace.ts):**
- `generateInviteCode(workspaceId)` — POST
- `joinByCode(code)` — POST
- `leave(workspaceId)` — POST
- `deleteWorkspace(workspaceId)` — DELETE
- `rename(workspaceId, name)` — PATCH
- `changeRole(workspaceId, memberId, role)` — PATCH
- `getAnalysisLatest()` — GET
- `runAnalysis()` — POST

**Modified files:**
- `app/(tabs)/workspace.tsx` — full redesign (hero card, overlaps, spend chart, members, settings, invite code, join)
- `app/(tabs)/index.tsx` — TeamSavingsBadge widget
- `src/locales/*.json` (10 files) — new i18n keys

### Migration

```sql
CREATE TABLE "invite_codes" (
  "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  "workspaceId" uuid NOT NULL,
  "code" varchar(6) NOT NULL UNIQUE,
  "createdBy" uuid NOT NULL,
  "usedBy" uuid,
  "usedAt" TIMESTAMP,
  "expiresAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP DEFAULT now()
);
CREATE INDEX "IDX_invite_codes_code" ON "invite_codes" ("code");
CREATE INDEX "IDX_invite_codes_workspaceId" ON "invite_codes" ("workspaceId");
```
