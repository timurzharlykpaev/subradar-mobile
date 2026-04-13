# Team Logic Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix Team membership logic — members get effective Pro access via team, grace period 7 days on expiration/leave, UI degradation with locked cards after grace, double-pay protection.

**Architecture:** Backend introduces `EffectiveAccess` layer (single source of truth). Mobile uses new `useEffectiveAccess` hook. Pure additive — existing payment flow untouched.

**Tech Stack:** NestJS, TypeORM, PostgreSQL migrations, RevenueCat webhooks. Mobile: React Native, Expo Router, react-i18next.

**Repos:**
- Backend: `/Users/timurzharlykpaev/Desktop/repositories/subradar-backend`
- Mobile: `/Users/timurzharlykpaev/Desktop/repositories/subradar-mobile`

---

## Task 1: Backend — User entity grace period fields

**Files:**
- Modify: `src/users/entities/user.entity.ts`
- Modify: `src/users/users.service.ts`

- [ ] **Step 1: Add fields to User entity**

In `user.entity.ts`, after existing `downgradedAt` field add:

```typescript
@Column({ type: 'timestamp', nullable: true })
gracePeriodEnd: Date | null;

@Column({ type: 'varchar', length: 20, nullable: true })
gracePeriodReason: 'team_expired' | 'pro_expired' | null;
```

- [ ] **Step 2: Add to ALLOWED_KEYS in users.service.ts**

Find `ALLOWED_KEYS` Set (around line 48), add `'gracePeriodEnd'` and `'gracePeriodReason'`:

```typescript
const ALLOWED_KEYS = new Set([
  // ...existing keys...
  'cancelAtPeriodEnd', 'currentPeriodEnd', 'status', 'downgradedAt', 'weeklyDigestEnabled',
  'gracePeriodEnd', 'gracePeriodReason',
]);
```

- [ ] **Step 3: tsc check**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/users/entities/user.entity.ts src/users/users.service.ts
git commit -m "feat(team): add gracePeriodEnd and gracePeriodReason to User entity"
```

---

## Task 2: Backend — Workspace expiredAt field

**Files:**
- Modify: `src/workspace/entities/workspace.entity.ts`

- [ ] **Step 1: Add expiredAt column**

After existing fields in workspace.entity.ts:

```typescript
@Column({ type: 'timestamp', nullable: true })
expiredAt: Date | null;
```

- [ ] **Step 2: tsc + commit**

```bash
npx tsc --noEmit
git add src/workspace/entities/workspace.entity.ts
git commit -m "feat(team): add expiredAt to Workspace entity"
```

---

## Task 3: Backend — getEffectiveAccess method

**Files:**
- Modify: `src/billing/billing.service.ts`
- Modify: `src/billing/billing.module.ts` (add Workspace repo if missing)

- [ ] **Step 1: Verify WorkspaceRepository injection**

In `billing.service.ts`, check constructor. If `WorkspaceRepository` and `WorkspaceMemberRepository` are not injected, add:

```typescript
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workspace } from '../workspace/entities/workspace.entity';
import { WorkspaceMember } from '../workspace/entities/workspace-member.entity';
```

In constructor, add params:
```typescript
@InjectRepository(Workspace) private readonly workspaceRepo: Repository<Workspace>,
@InjectRepository(WorkspaceMember) private readonly workspaceMemberRepo: Repository<WorkspaceMember>,
```

In `billing.module.ts`, ensure `TypeOrmModule.forFeature([..., Workspace, WorkspaceMember])` includes them.

- [ ] **Step 2: Add EffectiveAccess interface**

At top of `billing.service.ts`, after existing interfaces (or at top):

```typescript
export interface EffectiveAccess {
  plan: 'free' | 'pro' | 'organization';
  source: 'own' | 'team' | 'grace_team' | 'grace_pro' | 'free';
  graceUntil?: Date;
  graceDaysLeft?: number;
  isTeamOwner: boolean;
  isTeamMember: boolean;
  hasOwnPro: boolean;
  workspaceId?: string;
  workspaceExpiringAt?: Date;
}
```

- [ ] **Step 3: Implement getEffectiveAccess**

Add method to `BillingService`:

```typescript
async getEffectiveAccess(user: User): Promise<EffectiveAccess> {
  const now = new Date();

  // Step 1: Find team membership
  const member = await this.workspaceMemberRepo.findOne({
    where: { userId: user.id, status: 'ACTIVE' as any },
  });

  let workspace: Workspace | null = null;
  let teamOwnerHasActiveSubscription = false;

  if (member) {
    workspace = await this.workspaceRepo.findOne({ where: { id: member.workspaceId } });
    if (workspace && !workspace.expiredAt) {
      const owner = await this.usersService.findById(workspace.ownerId);
      teamOwnerHasActiveSubscription =
        owner.plan === 'organization' && !owner.cancelAtPeriodEnd;
    }
  }

  const isTeamOwner = !!(workspace && workspace.ownerId === user.id);
  const isTeamMember = !!member;
  const hasOwnPro =
    user.billingSource === 'revenuecat' &&
    (user.plan === 'pro' || user.plan === 'organization') &&
    !user.cancelAtPeriodEnd;

  const computeDaysLeft = (date: Date | null): number | undefined => {
    if (!date) return undefined;
    const ms = date.getTime() - now.getTime();
    if (ms <= 0) return undefined;
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  };

  // Step 2: Team active for owner — owner gets organization
  if (isTeamOwner && (user.plan === 'organization' || user.plan === 'pro')) {
    return {
      plan: 'organization',
      source: 'own',
      isTeamOwner: true,
      isTeamMember: true,
      hasOwnPro,
      workspaceId: workspace!.id,
    };
  }

  // Step 3: Team active for member
  if (isTeamMember && teamOwnerHasActiveSubscription) {
    return {
      plan: 'organization',
      source: 'team',
      isTeamOwner: false,
      isTeamMember: true,
      hasOwnPro,
      workspaceId: workspace!.id,
    };
  }

  // Step 4: Own Pro/Organization (RC active)
  if (hasOwnPro) {
    return {
      plan: user.plan as 'pro' | 'organization',
      source: 'own',
      isTeamOwner,
      isTeamMember,
      hasOwnPro: true,
      workspaceId: workspace?.id,
      workspaceExpiringAt: workspace?.expiredAt ?? undefined,
    };
  }

  // Step 5: Trial active
  if (user.trialEndDate && new Date(user.trialEndDate) > now) {
    return {
      plan: 'pro',
      source: 'own',
      isTeamOwner,
      isTeamMember,
      hasOwnPro: false,
      workspaceId: workspace?.id,
    };
  }

  // Step 6: Grace period
  if (user.gracePeriodEnd && new Date(user.gracePeriodEnd) > now) {
    return {
      plan: 'pro',
      source: user.gracePeriodReason === 'team_expired' ? 'grace_team' : 'grace_pro',
      graceUntil: new Date(user.gracePeriodEnd),
      graceDaysLeft: computeDaysLeft(new Date(user.gracePeriodEnd)),
      isTeamOwner,
      isTeamMember,
      hasOwnPro: false,
      workspaceId: workspace?.id,
      workspaceExpiringAt: workspace?.expiredAt ?? undefined,
    };
  }

  // Step 7: Free
  return {
    plan: 'free',
    source: 'free',
    isTeamOwner,
    isTeamMember,
    hasOwnPro: false,
    workspaceId: workspace?.id,
    workspaceExpiringAt: workspace?.expiredAt ?? undefined,
  };
}
```

- [ ] **Step 4: tsc + commit**

```bash
npx tsc --noEmit
git add src/billing/billing.service.ts src/billing/billing.module.ts
git commit -m "feat(team): add getEffectiveAccess as single source of truth for plan access"
```

---

## Task 4: Backend — Update getBillingInfo to use EffectiveAccess

**Files:**
- Modify: `src/billing/billing.service.ts`

- [ ] **Step 1: Replace getEffectivePlan call in getBillingInfo**

Find `getBillingInfo` method. Replace `const effectivePlan = this.getEffectivePlan(user);` with:

```typescript
const effective = await this.getEffectiveAccess(user);
const effectivePlan = effective.plan;
```

- [ ] **Step 2: Add new fields to return**

In the `return { ... }` block of `getBillingInfo`, add:

```typescript
return {
  plan: effective.plan,
  source: effective.source,
  isTeamOwner: effective.isTeamOwner,
  isTeamMember: effective.isTeamMember,
  hasOwnPro: effective.hasOwnPro,
  graceUntil: effective.graceUntil?.toISOString() ?? null,
  graceDaysLeft: effective.graceDaysLeft ?? null,
  workspaceExpiringAt: effective.workspaceExpiringAt?.toISOString() ?? null,
  // existing fields below:
  billingPeriod: user.billingPeriod ?? 'monthly',
  status,
  currentPeriodEnd: periodEnd?.toISOString() ?? null,
  cancelAtPeriodEnd: user.cancelAtPeriodEnd ?? false,
  trialUsed: user.trialUsed,
  trialDaysLeft,
  subscriptionCount,
  subscriptionLimit: planConfig.subscriptionLimit,
  aiRequestsUsed,
  aiRequestsLimit: planConfig.aiRequestsLimit,
  proInviteeEmail: user.proInviteeEmail ?? null,
  downgradedAt: user.downgradedAt?.toISOString() ?? null,
};
```

- [ ] **Step 3: Same for consumeAiRequest**

In `consumeAiRequest`, replace `const effectivePlan = this.getEffectivePlan(user);` with:

```typescript
const effective = await this.getEffectiveAccess(user);
const effectivePlan = effective.plan;
```

- [ ] **Step 4: tsc + commit**

```bash
npx tsc --noEmit
git add src/billing/billing.service.ts
git commit -m "feat(team): use getEffectiveAccess in getBillingInfo and consumeAiRequest"
```

---

## Task 5: Backend — Update guards to use EffectiveAccess

**Files:**
- Modify: `src/subscriptions/guards/subscription-limit.guard.ts`
- Modify: `src/analysis/guards/plan.guard.ts`

- [ ] **Step 1: SubscriptionLimitGuard**

In `subscription-limit.guard.ts` `canActivate` method, replace plan resolution. Find:

```typescript
const user = await this.usersRepository.findOne({ where: { id: userId } });
const plan = user.plan ?? 'free';
const planConfig = PLANS[plan as keyof typeof PLANS] ?? PLANS.free;
```

Replace with:
```typescript
const user = await this.usersRepository.findOne({ where: { id: userId } });
const effective = await this.billingService.getEffectiveAccess(user);
const planConfig = PLANS[effective.plan as keyof typeof PLANS] ?? PLANS.free;
```

If `BillingService` not injected, add to constructor:
```typescript
constructor(
  // ...existing
  private readonly billingService: BillingService,
) {}
```

And ensure module imports BillingModule.

- [ ] **Step 2: AnalysisPlanGuard**

In `analysis/guards/plan.guard.ts`:

```typescript
const user = await this.usersRepository.findOne({ where: { id: userId } });
const effective = await this.billingService.getEffectiveAccess(user);
if (effective.plan !== 'pro' && effective.plan !== 'organization') {
  throw new ForbiddenException('AI analysis requires Pro plan');
}
```

- [ ] **Step 3: tsc + commit**

```bash
npx tsc --noEmit
git add src/subscriptions/guards/subscription-limit.guard.ts src/analysis/guards/plan.guard.ts
git commit -m "feat(team): guards use getEffectiveAccess for plan-based limits"
```

---

## Task 6: Backend — Cascade on RC EXPIRATION

**Files:**
- Modify: `src/billing/billing.service.ts`

- [ ] **Step 1: Add handleTeamOwnerExpiration helper**

In `BillingService`:

```typescript
private async handleTeamOwnerExpiration(ownerId: string): Promise<void> {
  const workspace = await this.workspaceRepo.findOne({ where: { ownerId } });
  if (!workspace) return;

  // Mark workspace as expired (soft delete after 30 days via cron)
  workspace.expiredAt = new Date();
  await this.workspaceRepo.save(workspace);

  // Find all active members
  const members = await this.workspaceMemberRepo.find({
    where: { workspaceId: workspace.id, status: 'ACTIVE' as any },
  });

  for (const m of members) {
    if (m.userId === ownerId) continue;
    const u = await this.usersService.findById(m.userId);
    // Skip if member has own active Pro
    if (u.billingSource === 'revenuecat' && !u.cancelAtPeriodEnd) continue;
    // Start grace period
    u.gracePeriodEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    u.gracePeriodReason = 'team_expired';
    await this.usersService.save(u);
  }
}
```

- [ ] **Step 2: Update RC EXPIRATION handler**

In `handleRevenueCatWebhook`, find `case 'EXPIRATION':` block. Replace with:

```typescript
case 'EXPIRATION': {
  user.plan = 'free';
  user.billingPeriod = null;
  user.downgradedAt = new Date();
  user.billingSource = null as any;
  user.cancelAtPeriodEnd = false;
  user.currentPeriodEnd = null as any;
  // Start grace period for the user
  user.gracePeriodEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  user.gracePeriodReason = 'pro_expired';
  await this.usersService.save(user);
  this.logger.log(`RevenueCat: EXPIRATION — user ${appUserId} → free, grace 7d`);
  // Cascade to team members if user was team owner
  await this.handleTeamOwnerExpiration(user.id);
  break;
}
```

- [ ] **Step 3: Update RC INITIAL_PURCHASE / RENEWAL / UNCANCELLATION to clear grace**

In each of those cases, add at the end (before `break;`):

```typescript
// Clear grace period — fresh paid subscription
user.gracePeriodEnd = null;
user.gracePeriodReason = null;
// Also restore workspace if user was team owner
const ownedWs = await this.workspaceRepo.findOne({ where: { ownerId: user.id } });
if (ownedWs && ownedWs.expiredAt) {
  ownedWs.expiredAt = null;
  await this.workspaceRepo.save(ownedWs);
}
```

- [ ] **Step 4: Update cancelSubscription to start grace and cascade**

In `cancelSubscription`, after the RC subscription branch (`if (user.plan !== 'free' && user.billingSource === 'revenuecat')`), don't immediately downgrade — that already happens via cancelAtPeriodEnd. Just add:

After successful RC mark-cancel, do nothing more (keep existing behavior).

But for non-RC cancellation branch:
```typescript
if (user.plan !== 'free') {
  await this.usersService.update(userId, {
    plan: 'free',
    billingSource: undefined as any,
    cancelAtPeriodEnd: false,
    gracePeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) as any,
    gracePeriodReason: 'pro_expired' as any,
  });
  await this.handleTeamOwnerExpiration(userId);
  return;
}
```

- [ ] **Step 5: tsc + commit**

```bash
npx tsc --noEmit
git add src/billing/billing.service.ts
git commit -m "feat(team): cascade grace period on EXPIRATION/cancel, clear on purchase"
```

---

## Task 7: Backend — Voluntary leave team starts grace

**Files:**
- Modify: `src/workspace/workspace.service.ts`

- [ ] **Step 1: Find leaveTeam method**

Read `src/workspace/workspace.service.ts` to locate `leaveTeam` (or similar — search for `removeMember` / `leave`).

- [ ] **Step 2: Add grace logic after member removal**

After existing removal logic (where WorkspaceMember is deleted/marked):

```typescript
const user = await this.usersService.findById(userId);
// Skip grace if member has own RC subscription
if (user.billingSource !== 'revenuecat' || user.cancelAtPeriodEnd) {
  await this.usersService.update(userId, {
    gracePeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) as any,
    gracePeriodReason: 'team_expired' as any,
  });
}
```

If `usersService` not injected, add to constructor.

- [ ] **Step 3: tsc + commit**

```bash
npx tsc --noEmit
git add src/workspace/workspace.service.ts
git commit -m "feat(team): start 7-day grace when member leaves team"
```

---

## Task 8: Backend — Grace period cron jobs

**Files:**
- Create: `src/billing/grace-period.cron.ts`
- Modify: `src/billing/billing.module.ts`

- [ ] **Step 1: Create cron service**

```typescript
// src/billing/grace-period.cron.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Between } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Workspace } from '../workspace/entities/workspace.entity';

@Injectable()
export class GracePeriodCron {
  private readonly logger = new Logger(GracePeriodCron.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Workspace) private readonly workspaceRepo: Repository<Workspace>,
  ) {}

  @Cron('5 0 * * *')
  async resetExpiredGrace() {
    const now = new Date();
    const users = await this.userRepo.find({
      where: { gracePeriodEnd: LessThan(now) as any },
    });
    let count = 0;
    for (const u of users) {
      u.gracePeriodEnd = null;
      u.gracePeriodReason = null;
      await this.userRepo.save(u);
      count++;
    }
    this.logger.log(`Reset grace period for ${count} users`);
  }

  @Cron('0 9 * * *')
  async cleanupAbandonedWorkspaces() {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const workspaces = await this.workspaceRepo.find({
      where: { expiredAt: LessThan(cutoff) as any },
    });
    let count = 0;
    for (const w of workspaces) {
      // Mark as deleted (assuming Workspace has @DeleteDateColumn or use custom field)
      await this.workspaceRepo.softRemove(w).catch(() => this.workspaceRepo.remove(w));
      count++;
    }
    this.logger.log(`Cleaned up ${count} abandoned workspaces`);
  }
}
```

- [ ] **Step 2: Register in module**

In `billing.module.ts`:

```typescript
import { GracePeriodCron } from './grace-period.cron';

@Module({
  // ...
  providers: [
    BillingService,
    GracePeriodCron,
    // ...existing
  ],
})
```

- [ ] **Step 3: tsc + commit**

```bash
npx tsc --noEmit
git add src/billing/grace-period.cron.ts src/billing/billing.module.ts
git commit -m "feat(team): grace period cron — reset expired, cleanup abandoned workspaces"
```

---

## Task 9: Backend — Database migrations

**Files:**
- Create: `src/migrations/1744545600000-AddGracePeriodToUsers.ts`
- Create: `src/migrations/1744545600001-AddExpiredAtToWorkspace.ts`

- [ ] **Step 1: Generate migration files**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend
npx typeorm migration:generate -d src/data-source.ts src/migrations/AddGracePeriodAndExpired || true
```

If auto-generation doesn't work, create manually:

```typescript
// src/migrations/1744545600000-AddGracePeriodToUsers.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGracePeriodToUsers1744545600000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "gracePeriodEnd" TIMESTAMP NULL,
      ADD COLUMN "gracePeriodReason" VARCHAR(20) NULL
    `);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN "gracePeriodEnd",
      DROP COLUMN "gracePeriodReason"
    `);
  }
}
```

```typescript
// src/migrations/1744545600001-AddExpiredAtToWorkspace.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExpiredAtToWorkspace1744545600001 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspaces"
      ADD COLUMN "expiredAt" TIMESTAMP NULL
    `);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspaces"
      DROP COLUMN "expiredAt"
    `);
  }
}
```

- [ ] **Step 2: Verify table names**

Check existing migrations for actual table names (`users` vs `user`, `workspaces` vs `workspace`). Adjust SQL accordingly.

- [ ] **Step 3: Run migrations locally**

```bash
npm run migration:run
```
Expected: migrations applied successfully

- [ ] **Step 4: Commit**

```bash
git add src/migrations/
git commit -m "feat(team): db migrations for grace period and workspace expiredAt"
```

---

## Task 10: Backend — Workspace members endpoint includes status flags

**Files:**
- Modify: `src/workspace/workspace.controller.ts` (or service)

- [ ] **Step 1: Find members list endpoint**

Search for `GET /workspace/:id` or members endpoint in `workspace.controller.ts`.

- [ ] **Step 2: Add billing status to member response**

In the response transformation, for each member add fields:

```typescript
const enrichedMembers = await Promise.all(members.map(async (m) => {
  const u = await this.usersService.findById(m.userId);
  return {
    ...m,
    user: {
      id: u.id,
      name: u.name,
      email: u.email,
      hasOwnPro: u.billingSource === 'revenuecat' && !u.cancelAtPeriodEnd,
      gracePeriodEnd: u.gracePeriodEnd,
      gracePeriodReason: u.gracePeriodReason,
    },
  };
}));
```

- [ ] **Step 3: tsc + commit**

```bash
npx tsc --noEmit
git add src/workspace/
git commit -m "feat(team): include hasOwnPro and grace status in member list response"
```

---

## Task 11: Mobile — BillingStatus type + useEffectiveAccess hook

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/hooks/useEffectiveAccess.ts`

- [ ] **Step 1: Update BillingStatus interface**

In `src/types/index.ts`, find `BillingStatus` interface and add fields:

```typescript
export interface BillingStatus {
  // ...existing fields
  source?: 'own' | 'team' | 'grace_team' | 'grace_pro' | 'free';
  isTeamOwner?: boolean;
  isTeamMember?: boolean;
  hasOwnPro?: boolean;
  graceUntil?: string | null;
  graceDaysLeft?: number | null;
  workspaceExpiringAt?: string | null;
}
```

- [ ] **Step 2: Create hook**

```typescript
// src/hooks/useEffectiveAccess.ts
import { useBillingStatus } from './useBilling';
import { useSubscriptionsStore } from '../stores/subscriptionsStore';

export interface EffectiveAccess {
  plan: 'free' | 'pro' | 'organization';
  isPro: boolean;
  isTeam: boolean;
  isTeamOwner: boolean;
  isTeamMember: boolean;
  hasOwnPro: boolean;
  source: 'own' | 'team' | 'grace_team' | 'grace_pro' | 'free';
  graceDaysLeft: number | null;
  graceReason: 'team_expired' | 'pro_expired' | null;
  workspaceExpiringDays: number | null;
  // UI helpers
  shouldShowDoublePay: boolean;
  shouldShowGraceBanner: boolean;
  shouldShowOwnerExpiredAlert: boolean;
  isInDegradedMode: boolean;  // free + has > 3 subs
  visibleSubsCount: number;
  hiddenSubsCount: number;
}

export function useEffectiveAccess(): EffectiveAccess {
  const { data: billing } = useBillingStatus();
  const subscriptions = useSubscriptionsStore((s) => s.subscriptions);

  const plan = (billing?.plan ?? 'free') as 'free' | 'pro' | 'organization';
  const isPro = plan === 'pro' || plan === 'organization';
  const isTeam = plan === 'organization';
  const isTeamOwner = billing?.isTeamOwner ?? false;
  const isTeamMember = billing?.isTeamMember ?? false;
  const hasOwnPro = billing?.hasOwnPro ?? false;
  const source = billing?.source ?? 'free';
  const graceDaysLeft = billing?.graceDaysLeft ?? null;
  const graceReason = (source === 'grace_team' ? 'team_expired' : source === 'grace_pro' ? 'pro_expired' : null) as 'team_expired' | 'pro_expired' | null;

  const workspaceExpiringDays = billing?.workspaceExpiringAt
    ? Math.max(0, 30 - Math.floor((Date.now() - new Date(billing.workspaceExpiringAt).getTime()) / (24 * 60 * 60 * 1000)))
    : null;

  const activeSubsCount = subscriptions.filter(
    (s) => s.status === 'ACTIVE' || s.status === 'TRIAL'
  ).length;

  const isInDegradedMode = plan === 'free' && activeSubsCount > 3;
  const visibleSubsCount = isInDegradedMode ? 3 : activeSubsCount;
  const hiddenSubsCount = isInDegradedMode ? activeSubsCount - 3 : 0;

  return {
    plan,
    isPro,
    isTeam,
    isTeamOwner,
    isTeamMember,
    hasOwnPro,
    source,
    graceDaysLeft,
    graceReason,
    workspaceExpiringDays,
    shouldShowDoublePay: hasOwnPro && isTeamMember && !isTeamOwner,
    shouldShowGraceBanner: graceDaysLeft !== null && graceDaysLeft > 0,
    shouldShowOwnerExpiredAlert: isTeamOwner && workspaceExpiringDays !== null && workspaceExpiringDays > 0,
    isInDegradedMode,
    visibleSubsCount,
    hiddenSubsCount,
  };
}
```

- [ ] **Step 3: tsc + commit**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-mobile
npx tsc --noEmit
git add src/types/index.ts src/hooks/useEffectiveAccess.ts
git commit -m "feat(team): add EffectiveAccess type and useEffectiveAccess hook"
```

---

## Task 12: Mobile — i18n keys for team_logic

**Files:**
- Modify: `src/locales/*.json` (10 files)

- [ ] **Step 1: en.json — add team_logic and settings additions**

In `en.json`, after existing top-level sections add:

```json
  "team_logic": {
    "badge_team_member": "Team Member",
    "badge_pro_team": "Pro + Team",
    "badge_grace": "Grace · {{days}}d left",
    "badge_was_pro": "Was Pro",
    "expired_owner_alert": "Subscription expired. Team will be closed in {{days}} days. Renew?",
    "expired_owner_cta": "Renew Subscription",
    "grace_member_banner_title": "Owner stopped paying",
    "grace_member_banner_desc": "{{days}} days of Pro left. Get your own Pro to keep access.",
    "grace_member_cta": "Get my own Pro",
    "grace_pro_banner_title": "Pro expired",
    "grace_pro_banner_desc": "{{days}} days left. Renew Pro or join a Team.",
    "grace_pro_cta": "Renew Pro",
    "double_pay_banner_title": "You have Pro and Team",
    "double_pay_banner_desc": "Cancel your Pro to avoid paying twice.",
    "double_pay_cta": "Cancel my Pro",
    "join_warn_title": "You already have Pro",
    "join_warn_desc": "Joining Team means paying for both. Continue?",
    "join_warn_cta_continue": "Join and pay both",
    "join_warn_cta_cancel_pro": "Cancel Pro first",
    "locked_subs_banner": "{{count}} subscriptions hidden — Get Pro to see all",
    "locked_sub_alert_title": "Subscription locked",
    "locked_sub_alert_msg": "Get Pro to see {{count}} hidden subscriptions",
    "hero_locked_hint": "{{count}} subs hidden after plan expired",
    "analytics_locked_hint": "Without hidden: {{amount}}/mo",
    "member_status_own_pro": "Has own Pro",
    "member_status_team": "Team member",
    "member_status_grace": "Grace ending soon"
  },
```

In `settings` section add:
```json
    "plan_team_member": "TEAM MEMBER",
    "plan_pro_team": "PRO + TEAM",
    "plan_grace": "GRACE",
```

- [ ] **Step 2: ru.json**

```json
  "team_logic": {
    "badge_team_member": "Участник команды",
    "badge_pro_team": "Pro + Team",
    "badge_grace": "Льгота · {{days}}д",
    "badge_was_pro": "Был Pro",
    "expired_owner_alert": "Подписка истекла. Команда будет закрыта через {{days}} дней. Возобновить?",
    "expired_owner_cta": "Возобновить",
    "grace_member_banner_title": "Владелец перестал платить",
    "grace_member_banner_desc": "Осталось {{days}} дней Pro. Купи свой Pro чтобы не потерять.",
    "grace_member_cta": "Купить свой Pro",
    "grace_pro_banner_title": "Pro истёк",
    "grace_pro_banner_desc": "Осталось {{days}} дней. Продли Pro или присоединись к Team.",
    "grace_pro_cta": "Продлить Pro",
    "double_pay_banner_title": "У тебя Pro и Team",
    "double_pay_banner_desc": "Отмени свой Pro чтобы не платить дважды.",
    "double_pay_cta": "Отменить мой Pro",
    "join_warn_title": "У тебя уже есть Pro",
    "join_warn_desc": "После входа в Team будешь платить за оба. Продолжить?",
    "join_warn_cta_continue": "Войти и платить оба",
    "join_warn_cta_cancel_pro": "Сначала отменить Pro",
    "locked_subs_banner": "Скрыто {{count}} подписок — Включи Pro чтобы видеть все",
    "locked_sub_alert_title": "Подписка заблокирована",
    "locked_sub_alert_msg": "Включи Pro чтобы увидеть {{count}} скрытых подписок",
    "hero_locked_hint": "{{count}} подписок скрыто после истечения плана",
    "analytics_locked_hint": "Без скрытых: {{amount}}/мес",
    "member_status_own_pro": "Свой Pro",
    "member_status_team": "Участник команды",
    "member_status_grace": "Льготный период истекает"
  },
```

В `settings` секции:
```json
    "plan_team_member": "УЧАСТНИК",
    "plan_pro_team": "PRO + TEAM",
    "plan_grace": "ЛЬГОТА",
```

- [ ] **Step 3: Other 8 locales**

For kk, de, fr, es, zh, ja, ko, pt — translate the same keys preserving placeholders `{{days}}`, `{{count}}`, `{{amount}}`. Copy structure from en.json, translate values.

- [ ] **Step 4: Validate JSON**

```bash
for f in src/locales/*.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" || echo "INVALID: $f"; done
```
Expected: no INVALID lines

- [ ] **Step 5: Commit**

```bash
git add src/locales/
git commit -m "i18n(team-logic): add 27 translation keys for grace/team UI in 10 locales"
```

---

## Task 13: Mobile — Settings plan badge logic

**Files:**
- Modify: `app/(tabs)/settings.tsx`

- [ ] **Step 1: Replace plan badge logic**

Find the badge rendering (search for `planBadge` or `'TEAM'`/`'PRO'`/`'FREE'` text). Replace logic with:

```tsx
const access = useEffectiveAccess();

const planBadgeData = useMemo(() => {
  if (access.shouldShowGraceBanner) {
    return { label: t('settings.plan_grace'), color: '#F59E0B', sub: `${access.graceDaysLeft}d` };
  }
  if (access.isTeamOwner) {
    return { label: t('settings.plan_team'), color: '#06B6D4' };
  }
  if (access.hasOwnPro && access.isTeamMember) {
    return { label: t('settings.plan_pro_team'), color: '#06B6D4' };
  }
  if (access.isTeamMember) {
    return { label: t('settings.plan_team_member'), color: '#06B6D4' };
  }
  if (access.isPro) {
    return { label: t('settings.plan_pro'), color: '#8B5CF6' };
  }
  if (access.isInDegradedMode) {
    return { label: t('settings.plan_free'), color: '#6B7280', sub: t('team_logic.badge_was_pro') };
  }
  return { label: t('settings.plan_free'), color: '#6B7280' };
}, [access, t]);
```

- [ ] **Step 2: Render badge with sub-label**

Where badge is rendered:

```tsx
<View style={[styles.planBadge, { backgroundColor: planBadgeData.color + '20' }]}>
  <Text style={[styles.planBadgeText, { color: planBadgeData.color }]}>{planBadgeData.label}</Text>
  {planBadgeData.sub && (
    <Text style={[styles.planBadgeSub, { color: planBadgeData.color, opacity: 0.7 }]}>
      {planBadgeData.sub}
    </Text>
  )}
</View>
```

Add styles if missing:
```tsx
planBadgeSub: { fontSize: 9, fontWeight: '700', marginTop: 1 },
```

- [ ] **Step 3: tsc + commit**

```bash
npx tsc --noEmit
git add app/(tabs)/settings.tsx
git commit -m "feat(team): unified plan badge with grace/team-member/pro+team variants"
```

---

## Task 14: Mobile — DoublePayBanner component

**Files:**
- Create: `src/components/DoublePayBanner.tsx`

- [ ] **Step 1: Create component**

```tsx
// src/components/DoublePayBanner.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme, fonts } from '../theme';

let RevenueCatUI: any = null;
try { RevenueCatUI = require('react-native-purchases-ui').default; } catch {}

export function DoublePayBanner() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const onCancel = async () => {
    try { await RevenueCatUI?.presentCustomerCenter(); } catch {}
  };

  return (
    <View style={[styles.banner, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B40' }]}>
      <Ionicons name="alert-circle" size={20} color="#F59E0B" />
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.text }]}>{t('team_logic.double_pay_banner_title')}</Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>{t('team_logic.double_pay_banner_desc')}</Text>
      </View>
      <TouchableOpacity onPress={onCancel} style={styles.cta}>
        <Text style={[styles.ctaText, { color: '#F59E0B' }]}>{t('team_logic.double_pay_cta')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginVertical: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  title: { fontSize: 13, fontFamily: fonts.semiBold },
  desc: { fontSize: 11, fontFamily: fonts.regular, marginTop: 2 },
  cta: { paddingHorizontal: 8 },
  ctaText: { fontSize: 12, fontFamily: fonts.bold },
});
```

- [ ] **Step 2: tsc + commit**

```bash
npx tsc --noEmit
git add src/components/DoublePayBanner.tsx
git commit -m "feat(team): DoublePayBanner component for Pro+Team users"
```

---

## Task 15: Mobile — GraceBanner component

**Files:**
- Create: `src/components/GraceBanner.tsx`

- [ ] **Step 1: Create component**

```tsx
// src/components/GraceBanner.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme, fonts } from '../theme';
import { analytics } from '../services/analytics';

interface Props {
  daysLeft: number;
  reason: 'team_expired' | 'pro_expired';
}

export function GraceBanner({ daysLeft, reason }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const titleKey = reason === 'team_expired' ? 'team_logic.grace_member_banner_title' : 'team_logic.grace_pro_banner_title';
  const descKey = reason === 'team_expired' ? 'team_logic.grace_member_banner_desc' : 'team_logic.grace_pro_banner_desc';
  const ctaKey = reason === 'team_expired' ? 'team_logic.grace_member_cta' : 'team_logic.grace_pro_cta';

  return (
    <TouchableOpacity
      style={[styles.banner, { backgroundColor: '#FBBF2415', borderColor: '#FBBF2440' }]}
      onPress={() => {
        analytics.track('grace_ending_warning_shown' as any);
        router.push('/paywall' as any);
      }}
      activeOpacity={0.85}
    >
      <Ionicons name="time" size={20} color="#F59E0B" />
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.text }]}>{t(titleKey)}</Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>{t(descKey, { days: daysLeft })}</Text>
      </View>
      <Text style={[styles.cta, { color: '#F59E0B' }]}>{t(ctaKey)}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginVertical: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  title: { fontSize: 13, fontFamily: fonts.semiBold },
  desc: { fontSize: 11, fontFamily: fonts.regular, marginTop: 2 },
  cta: { fontSize: 12, fontFamily: fonts.bold, paddingHorizontal: 4 },
});
```

- [ ] **Step 2: tsc + commit**

```bash
npx tsc --noEmit
git add src/components/GraceBanner.tsx
git commit -m "feat(team): GraceBanner component for grace period users"
```

---

## Task 16: Mobile — LockedSubscriptionCard component

**Files:**
- Create: `src/components/LockedSubscriptionCard.tsx`

- [ ] **Step 1: Create component**

```tsx
// src/components/LockedSubscriptionCard.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme, fonts } from '../theme';
import { analytics } from '../services/analytics';

interface Props {
  hiddenCount: number;
}

export function LockedSubscriptionCard({ hiddenCount }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const onPress = () => {
    analytics.track('locked_sub_tapped' as any, { hidden_count: hiddenCount });
    Alert.alert(
      t('team_logic.locked_sub_alert_title'),
      t('team_logic.locked_sub_alert_msg', { count: hiddenCount }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: 'Get Pro', onPress: () => router.push('/paywall' as any) },
      ],
    );
  };

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface2, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.placeholder, { backgroundColor: colors.surface }]}>
        <Ionicons name="lock-closed" size={20} color={colors.textMuted} />
      </View>
      <View style={styles.middle}>
        <Text style={[styles.name, { color: colors.textMuted }]}>••••••••</Text>
        <Text style={[styles.desc, { color: colors.textMuted }]}>••••</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: colors.textMuted, opacity: 0.4 }]}>•••.••</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginHorizontal: 20, marginBottom: 10, borderRadius: 16, borderWidth: 1 },
  placeholder: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  middle: { flex: 1, gap: 4 },
  name: { fontSize: 15, fontFamily: fonts.semiBold, letterSpacing: 2 },
  desc: { fontSize: 12, fontFamily: fonts.regular },
  right: { alignItems: 'flex-end' },
  amount: { fontSize: 15, fontFamily: fonts.bold },
});
```

- [ ] **Step 2: tsc + commit**

```bash
npx tsc --noEmit
git add src/components/LockedSubscriptionCard.tsx
git commit -m "feat(team): LockedSubscriptionCard for degraded UI after grace ends"
```

---

## Task 17: Mobile — Subscriptions tab degraded mode

**Files:**
- Modify: `app/(tabs)/subscriptions.tsx`

- [ ] **Step 1: Use useEffectiveAccess + render locked cards**

Add at top of component:
```tsx
import { useEffectiveAccess } from '../../src/hooks/useEffectiveAccess';
import { LockedSubscriptionCard } from '../../src/components/LockedSubscriptionCard';

const access = useEffectiveAccess();
```

Sort and split subscriptions:
```tsx
const sortedSubs = useMemo(() => {
  return [...subscriptions].sort((a, b) =>
    new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
  );
}, [subscriptions]);

const visibleSubs = access.isInDegradedMode ? sortedSubs.slice(0, 3) : sortedSubs;
```

Render banner above list:
```tsx
{access.isInDegradedMode && access.hiddenSubsCount > 0 && (
  <TouchableOpacity
    style={[styles.lockedBanner, { backgroundColor: '#8B5CF615', borderColor: '#8B5CF640' }]}
    onPress={() => {
      analytics.track('locked_banner_tapped' as any);
      router.push('/paywall' as any);
    }}
    activeOpacity={0.85}
  >
    <Ionicons name="lock-closed" size={18} color="#8B5CF6" />
    <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.text }}>
      {t('team_logic.locked_subs_banner', { count: access.hiddenSubsCount })}
    </Text>
    <Ionicons name="chevron-forward" size={16} color="#8B5CF6" />
  </TouchableOpacity>
)}
```

In subscription list rendering, append locked cards after visible ones:
```tsx
{access.isInDegradedMode && Array.from({ length: access.hiddenSubsCount }).map((_, i) => (
  <LockedSubscriptionCard key={`locked-${i}`} hiddenCount={access.hiddenSubsCount} />
))}
```

Add styles:
```tsx
lockedBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginTop: 12, marginBottom: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
```

- [ ] **Step 2: tsc + commit**

```bash
npx tsc --noEmit
git add app/(tabs)/subscriptions.tsx
git commit -m "feat(team): degraded mode in subscriptions tab — show 3 + locked placeholders"
```

---

## Task 18: Mobile — Dashboard degraded mode + double-pay banner

**Files:**
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: Use useEffectiveAccess + slice subs**

Add:
```tsx
import { useEffectiveAccess } from '../../src/hooks/useEffectiveAccess';
import { DoublePayBanner } from '../../src/components/DoublePayBanner';
import { GraceBanner } from '../../src/components/GraceBanner';

const access = useEffectiveAccess();
const visibleSubs = access.isInDegradedMode ? activeSubs.slice(0, 3) : activeSubs;
```

Replace `totalMonthly` calculation to use `visibleSubs`:
```tsx
const totalMonthly = visibleSubs.reduce((sum, s) => {
  const mult = s.billingPeriod === 'WEEKLY' ? 4 : s.billingPeriod === 'QUARTERLY' ? 1/3 : s.billingPeriod === 'YEARLY' ? 1/12 : 1;
  return sum + (Number(s.amount) || 0) * mult;
}, 0);
```

- [ ] **Step 2: Add banners at top**

After header, before main content:
```tsx
{access.shouldShowDoublePay && <DoublePayBanner />}
{access.shouldShowGraceBanner && access.graceReason && (
  <GraceBanner daysLeft={access.graceDaysLeft!} reason={access.graceReason} />
)}
```

- [ ] **Step 3: Hero card hint when degraded**

Below hero card monthly amount, add:
```tsx
{access.isInDegradedMode && (
  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 4 }}>
    {t('team_logic.hero_locked_hint', { count: access.hiddenSubsCount })}
  </Text>
)}
```

- [ ] **Step 4: tsc + commit**

```bash
npx tsc --noEmit
git add app/(tabs)/index.tsx
git commit -m "feat(team): dashboard degraded mode + DoublePay/Grace banners"
```

---

## Task 19: Mobile — Analytics degraded mode hint

**Files:**
- Modify: `app/(tabs)/analytics.tsx`

- [ ] **Step 1: Use access + slice for calculations**

```tsx
import { useEffectiveAccess } from '../../src/hooks/useEffectiveAccess';

const access = useEffectiveAccess();
const visibleForCalc = access.isInDegradedMode ? subscriptions.slice(0, 3) : subscriptions;
```

Replace any `totalMonthly` or aggregate with `visibleForCalc`-based version. Compute also `fullMonthly`:

```tsx
const fullMonthly = subscriptions.reduce((sum, s) => {
  if (s.status !== 'ACTIVE' && s.status !== 'TRIAL') return sum;
  const mult = s.billingPeriod === 'WEEKLY' ? 4 : s.billingPeriod === 'QUARTERLY' ? 1/3 : s.billingPeriod === 'YEARLY' ? 1/12 : 1;
  return sum + (Number(s.amount) || 0) * mult;
}, 0);
```

- [ ] **Step 2: Add hint badge below main chart**

```tsx
{access.isInDegradedMode && (
  <View style={{ alignItems: 'center', marginVertical: 8 }}>
    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted }}>
      {t('team_logic.analytics_locked_hint', { amount: `${currency} ${fullMonthly.toFixed(2)}` })}
    </Text>
  </View>
)}
```

- [ ] **Step 3: tsc + commit**

```bash
npx tsc --noEmit
git add app/(tabs)/analytics.tsx
git commit -m "feat(team): analytics shows full amount hint when in degraded mode"
```

---

## Task 20: Mobile — Workspace tab member/owner banners + status

**Files:**
- Modify: `app/(tabs)/workspace.tsx`

- [ ] **Step 1: Use access + render banners**

Add:
```tsx
import { useEffectiveAccess } from '../../src/hooks/useEffectiveAccess';
import { GraceBanner } from '../../src/components/GraceBanner';

const access = useEffectiveAccess();
```

At top of view (above existing content):
```tsx
{access.shouldShowOwnerExpiredAlert && (
  <View style={[styles.expiredAlert, { backgroundColor: '#EF444415', borderColor: '#EF444440' }]}>
    <Ionicons name="warning" size={20} color="#EF4444" />
    <View style={{ flex: 1 }}>
      <Text style={[styles.expiredText, { color: colors.text }]}>
        {t('team_logic.expired_owner_alert', { days: access.workspaceExpiringDays })}
      </Text>
    </View>
    <TouchableOpacity onPress={() => router.push('/paywall' as any)}>
      <Text style={[styles.expiredCta, { color: '#EF4444' }]}>{t('team_logic.expired_owner_cta')}</Text>
    </TouchableOpacity>
  </View>
)}
{access.shouldShowGraceBanner && access.graceReason === 'team_expired' && (
  <GraceBanner daysLeft={access.graceDaysLeft!} reason="team_expired" />
)}
```

Add styles:
```tsx
expiredAlert: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginTop: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
expiredText: { fontSize: 13, fontWeight: '600' },
expiredCta: { fontSize: 12, fontWeight: '700' },
```

- [ ] **Step 2: Render member status badges**

In members list rendering, for each member:
```tsx
<Text style={[styles.memberStatus, { color: colors.textMuted }]}>
  {member.user?.hasOwnPro
    ? t('team_logic.member_status_own_pro')
    : member.user?.gracePeriodEnd
    ? t('team_logic.member_status_grace')
    : t('team_logic.member_status_team')}
</Text>
```

Add style:
```tsx
memberStatus: { fontSize: 10, fontWeight: '600', marginTop: 2 },
```

- [ ] **Step 3: tsc + commit**

```bash
npx tsc --noEmit
git add app/(tabs)/workspace.tsx
git commit -m "feat(team): owner expired alert + grace banner + member status badges in workspace"
```

---

## Task 21: Mobile — JoinTeamSheet warning if has Pro

**Files:**
- Modify: `src/components/JoinTeamSheet.tsx`

- [ ] **Step 1: Add Pro check before join**

Add:
```tsx
import { useEffectiveAccess } from '../hooks/useEffectiveAccess';
import { Alert } from 'react-native';
import { analytics } from '../services/analytics';

const access = useEffectiveAccess();
```

Wrap existing `handleJoin` in pre-check:
```tsx
const performJoin = async (code: string) => {
  // existing join logic moved here
  await workspaceApi.joinByCode(code);
  // ...
};

const handleJoin = async () => {
  const code = inputCode.trim();
  if (code.length !== 10) return;

  if (access.hasOwnPro) {
    analytics.track('join_warn_shown' as any);
    Alert.alert(
      t('team_logic.join_warn_title'),
      t('team_logic.join_warn_desc'),
      [
        { text: t('team_logic.join_warn_cta_cancel_pro'), onPress: async () => {
          let RevenueCatUI: any = null;
          try { RevenueCatUI = require('react-native-purchases-ui').default; } catch {}
          try { await RevenueCatUI?.presentCustomerCenter(); } catch {}
        }},
        { text: t('team_logic.join_warn_cta_continue'), onPress: () => {
          analytics.track('join_warn_continued' as any);
          performJoin(code);
        }},
      ],
    );
    return;
  }

  await performJoin(code);
};
```

- [ ] **Step 2: tsc + commit**

```bash
npx tsc --noEmit
git add src/components/JoinTeamSheet.tsx
git commit -m "feat(team): warn user with own Pro before joining team (double-pay protection)"
```

---

## Task 22: Mobile — Analytics events for team logic

**Files:**
- Modify: `src/services/analytics.ts`

- [ ] **Step 1: Add events to AnalyticsEvent union**

Find `AnalyticsEvent` type union, add:

```typescript
| 'grace_started'
| 'grace_ending_warning_shown'
| 'grace_ended_downgraded'
| 'grace_recovered_pro_purchased'
| 'locked_sub_tapped'
| 'locked_banner_tapped'
| 'double_pay_banner_shown'
| 'double_pay_cancel_tapped'
| 'join_warn_shown'
| 'join_warn_continued'
| 'team_owner_expired_renewed'
| 'team_owner_expired_abandoned'
```

- [ ] **Step 2: tsc + commit**

```bash
npx tsc --noEmit
git add src/services/analytics.ts
git commit -m "feat(team): add team logic analytics events to type union"
```

---

## Task 23: Final verification

- [ ] **Step 1: Full tsc both repos**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend && npx tsc --noEmit
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-mobile && npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 2: Run billing tests**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend
npx jest billing --passWithNoTests
```
Expected: existing tests pass

- [ ] **Step 3: Push backend (dev + prod)**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend
git push origin main:dev
git push origin main
```

- [ ] **Step 4: Push mobile**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-mobile
git push origin main
```

- [ ] **Step 5: Verify production deployments**

Check both API endpoints respond:
```bash
curl -s -o /dev/null -w "%{http_code}" https://api.subradar.ai/api/v1/billing/plans
curl -s -o /dev/null -w "%{http_code}" https://api-dev.subradar.ai/api/v1/billing/plans
```
Expected: 200 / 200

---

## Spec coverage check

| Spec section | Implementing tasks |
|---|---|
| Effective access layer | Tasks 3, 4, 5, 11 |
| User entity grace fields | Task 1 |
| Workspace expiredAt | Task 2 |
| RC EXPIRATION cascade | Task 6 |
| Voluntary leave grace | Task 7 |
| Cron jobs | Task 8 |
| DB migrations | Task 9 |
| Member endpoint enrichment | Task 10 |
| useEffectiveAccess hook | Task 11 |
| i18n keys (10 locales) | Task 12 |
| Settings badge | Task 13 |
| DoublePayBanner | Task 14 |
| GraceBanner | Task 15 |
| LockedSubscriptionCard | Task 16 |
| Subscriptions degraded mode | Task 17 |
| Dashboard degraded + banners | Task 18 |
| Analytics hint | Task 19 |
| Workspace banners + member status | Task 20 |
| JoinTeamSheet warning | Task 21 |
| Analytics events | Task 22 |
| Final verification | Task 23 |

All spec requirements covered.
