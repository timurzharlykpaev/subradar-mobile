# Subscription System Refactor — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild SubRadar backend billing system around a formal BillingStateMachine, unified EffectiveAccessResolver, outbox + reconciliation, secure trial system, and hardened endpoints.

**Architecture:** State machine as pure module (no repo deps). Single `/billing/me` endpoint delegating to `EffectiveAccessResolver`. Webhook handlers write via state machine + outbox events for side effects. Hourly reconciliation cron self-heals from RC. All billing endpoints protected by `PlanGuard` + rate limiter.

**Tech Stack:** NestJS 11, TypeORM (PostgreSQL), `@nestjs/throttler` (Redis storage), `@nestjs/schedule`, Jest + testcontainers.

**Spec:** `docs/superpowers/specs/2026-04-19-subscription-system-refactor-design.md`

**Repo:** `/Users/timurzharlykpaev/Desktop/repositories/subradar-backend`

**Phases:**
1. Database migrations + entities
2. State machine (pure module)
3. Outbox system
4. Unified Effective Access
5. RC API client + reconciliation
6. Trial system
7. Webhook handlers rewrite
8. Security (PlanGuard, rate limiting, Pro invite transaction)
9. Workspace audit + grace period cron cleanup
10. `/billing/me` controller rewrite + health endpoint
11. Integration tests + deploy prep

---

## Phase 1: Database migrations + entities

### Task 1.1: Migration — alter users table

**Files:**
- Create: `src/migrations/<timestamp>-AlterUsersBillingRefactor.ts`

- [ ] **Step 1: Generate timestamp**

Run: `node -e "console.log(Date.now())"`
Use value as migration prefix (e.g. `1776854400000`).

- [ ] **Step 2: Write migration**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterUsersBillingRefactor1776854400000 implements MigrationInterface {
  name = 'AlterUsersBillingRefactor1776854400000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      DO $$ BEGIN
        CREATE TYPE "billing_status_enum" AS ENUM (
          'active','cancel_at_period_end','billing_issue','grace_pro','grace_team','free'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "billing_status" "billing_status_enum" NOT NULL DEFAULT 'free'`);
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "current_period_start" TIMESTAMPTZ NULL`);
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invited_by_user_id" uuid NULL`);
    await q.query(`
      ALTER TABLE "users" ADD CONSTRAINT "fk_users_invited_by_user_id"
      FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_users_invited_by" ON "users"("invited_by_user_id")`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "idx_users_invited_by"`);
    await q.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "fk_users_invited_by_user_id"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "invited_by_user_id"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "current_period_start"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "billing_status"`);
    await q.query(`DROP TYPE IF EXISTS "billing_status_enum"`);
  }
}
```

- [ ] **Step 3: Run migration locally**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend
npm run migration:run
```
Expected: `Migration AlterUsersBillingRefactor1776854400000 has been executed successfully.`

- [ ] **Step 4: Verify revertable**

```bash
npm run migration:revert
npm run migration:run
```
Both must succeed.

- [ ] **Step 5: Commit**

```bash
git add src/migrations/*-AlterUsersBillingRefactor.ts
git commit -m "feat(billing): alter users with billing_status and invited_by_user_id"
```

---

### Task 1.2: Migration — backfill billing_status

**Files:**
- Create: `src/migrations/<timestamp+1>-BackfillBillingStatus.ts`

- [ ] **Step 1: Write migration**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillBillingStatus1776854401000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    // Priority order: billing_issue > grace_pro/grace_team > cancel_at_period_end > active > free
    await q.query(`
      UPDATE users SET billing_status = 'billing_issue'
      WHERE billing_issue_at IS NOT NULL AND plan != 'free'
    `);
    await q.query(`
      UPDATE users SET billing_status = 'grace_pro'
      WHERE billing_status = 'free' 
        AND grace_period_reason = 'pro_expired' 
        AND grace_period_end IS NOT NULL
        AND grace_period_end > now()
    `);
    await q.query(`
      UPDATE users SET billing_status = 'grace_team'
      WHERE billing_status = 'free' 
        AND grace_period_reason = 'team_expired'
        AND grace_period_end IS NOT NULL
        AND grace_period_end > now()
    `);
    await q.query(`
      UPDATE users SET billing_status = 'cancel_at_period_end'
      WHERE billing_status = 'free' 
        AND cancel_at_period_end = true 
        AND plan != 'free'
    `);
    await q.query(`
      UPDATE users SET billing_status = 'active'
      WHERE billing_status = 'free' AND plan != 'free'
    `);
  }

  async down(): Promise<void> {
    // No revert needed — recomputed from source columns on next migration-up
  }
}
```

- [ ] **Step 2: Run migration**

```bash
npm run migration:run
```

- [ ] **Step 3: Verify counts**

```bash
psql $DATABASE_URL -c "SELECT billing_status, COUNT(*) FROM users GROUP BY billing_status"
```
Expected: distribution matches existing plan + flag combinations.

- [ ] **Step 4: Commit**

```bash
git add src/migrations/*-BackfillBillingStatus.ts
git commit -m "feat(billing): backfill billing_status from existing flags"
```

---

### Task 1.3: Migration — user_trials table

**Files:**
- Create: `src/migrations/<timestamp+2>-CreateUserTrials.ts`

- [ ] **Step 1: Write migration**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserTrials1776854402000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      DO $$ BEGIN
        CREATE TYPE "trial_source_enum" AS ENUM ('revenuecat_intro','backend','lemon_squeezy');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await q.query(`
      DO $$ BEGIN
        CREATE TYPE "trial_plan_enum" AS ENUM ('pro','organization');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await q.query(`
      CREATE TABLE "user_trials" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
        "source" "trial_source_enum" NOT NULL,
        "plan" "trial_plan_enum" NOT NULL,
        "started_at" TIMESTAMPTZ NOT NULL,
        "ends_at" TIMESTAMPTZ NOT NULL,
        "consumed" boolean NOT NULL DEFAULT true,
        "original_transaction_id" text NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX "idx_user_trials_ends_at" ON "user_trials"("ends_at")`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "user_trials"`);
    await q.query(`DROP TYPE IF EXISTS "trial_source_enum"`);
    await q.query(`DROP TYPE IF EXISTS "trial_plan_enum"`);
  }
}
```

- [ ] **Step 2: Backfill in same migration file (extend up())**

Append to `up()`:
```ts
    await q.query(`
      INSERT INTO "user_trials" (user_id, source, plan, started_at, ends_at, consumed)
      SELECT id, 'backend', 'pro', trial_start_date, trial_end_date, true
      FROM users
      WHERE trial_start_date IS NOT NULL 
        AND trial_end_date IS NOT NULL
        AND trial_used = true
      ON CONFLICT (user_id) DO NOTHING
    `);
```

- [ ] **Step 3: Run + revert + run**

```bash
npm run migration:run && npm run migration:revert && npm run migration:run
```

- [ ] **Step 4: Commit**

```bash
git add src/migrations/*-CreateUserTrials.ts
git commit -m "feat(billing): create user_trials table with backfill"
```

---

### Task 1.4: Migration — outbox_events table

**Files:**
- Create: `src/migrations/<timestamp+3>-CreateOutboxEvents.ts`

- [ ] **Step 1: Write migration**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOutboxEvents1776854403000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      DO $$ BEGIN
        CREATE TYPE "outbox_status_enum" AS ENUM ('pending','processing','done','failed');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await q.query(`
      CREATE TABLE "outbox_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "type" varchar(64) NOT NULL,
        "payload" jsonb NOT NULL,
        "status" "outbox_status_enum" NOT NULL DEFAULT 'pending',
        "attempts" int NOT NULL DEFAULT 0,
        "last_error" text NULL,
        "next_attempt_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "processed_at" TIMESTAMPTZ NULL
      )
    `);
    await q.query(`
      CREATE INDEX "idx_outbox_pending" ON "outbox_events" ("status", "next_attempt_at") 
      WHERE status IN ('pending','processing')
    `);
    await q.query(`CREATE INDEX "idx_outbox_type_status" ON "outbox_events" ("type", "status")`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "outbox_events"`);
    await q.query(`DROP TYPE IF EXISTS "outbox_status_enum"`);
  }
}
```

- [ ] **Step 2: Run + revert + run**

```bash
npm run migration:run && npm run migration:revert && npm run migration:run
```

- [ ] **Step 3: Commit**

```bash
git add src/migrations/*-CreateOutboxEvents.ts
git commit -m "feat(billing): create outbox_events table"
```

---

### Task 1.5: Migration — alter webhook_events for reconciliation

**Files:**
- Create: `src/migrations/<timestamp+4>-AlterWebhookEventsForReconciliation.ts`

- [ ] **Step 1: Write migration**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterWebhookEventsForReconciliation1776854404000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "webhook_events" ADD COLUMN IF NOT EXISTS "user_id" uuid NULL REFERENCES "users"("id") ON DELETE SET NULL`);
    await q.query(`ALTER TABLE "webhook_events" ADD COLUMN IF NOT EXISTS "error" text NULL`);
    await q.query(`ALTER TABLE "webhook_events" ADD COLUMN IF NOT EXISTS "event_type" varchar(64) NULL`);
    await q.query(`
      CREATE INDEX IF NOT EXISTS "idx_webhook_events_user_error" 
      ON "webhook_events" ("user_id", "processed_at") 
      WHERE error IS NOT NULL
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_reconciliation_candidates"
      ON "users" ("billing_source", "current_period_end")
      WHERE billing_source = 'revenuecat' 
        AND billing_status NOT IN ('grace_pro','grace_team','free')
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "idx_users_reconciliation_candidates"`);
    await q.query(`DROP INDEX IF EXISTS "idx_webhook_events_user_error"`);
    await q.query(`ALTER TABLE "webhook_events" DROP COLUMN IF EXISTS "event_type"`);
    await q.query(`ALTER TABLE "webhook_events" DROP COLUMN IF EXISTS "error"`);
    await q.query(`ALTER TABLE "webhook_events" DROP COLUMN IF EXISTS "user_id"`);
  }
}
```

- [ ] **Step 2: Run + revert + run**

```bash
npm run migration:run && npm run migration:revert && npm run migration:run
```

- [ ] **Step 3: Commit**

```bash
git add src/migrations/*-AlterWebhookEventsForReconciliation.ts
git commit -m "feat(billing): alter webhook_events with user_id + error for reconciliation"
```

---

### Task 1.6: Update User entity

**Files:**
- Modify: `src/users/entities/user.entity.ts`

- [ ] **Step 1: Add fields to User entity**

Open the entity file. Add these fields (preserving existing columns):

```ts
@Column({
  type: 'enum',
  enum: ['active','cancel_at_period_end','billing_issue','grace_pro','grace_team','free'],
  default: 'free',
  name: 'billing_status',
})
billingStatus: BillingStatus;

@Column({ type: 'timestamptz', nullable: true, name: 'current_period_start' })
currentPeriodStart: Date | null;

@Column({ type: 'uuid', nullable: true, name: 'invited_by_user_id' })
invitedByUserId: string | null;
```

Add type at top:
```ts
export type BillingStatus =
  | 'active'
  | 'cancel_at_period_end'
  | 'billing_issue'
  | 'grace_pro'
  | 'grace_team'
  | 'free';
```

- [ ] **Step 2: Run type check**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/users/entities/user.entity.ts
git commit -m "feat(billing): add billingStatus, currentPeriodStart, invitedByUserId to User entity"
```

---

### Task 1.7: Create UserTrial entity

**Files:**
- Create: `src/billing/trials/entities/user-trial.entity.ts`

- [ ] **Step 1: Write entity**

```ts
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { User } from '../../../users/entities/user.entity';

export type TrialSource = 'revenuecat_intro' | 'backend' | 'lemon_squeezy';
export type TrialPlan = 'pro' | 'organization';

@Entity('user_trials')
export class UserTrial {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true, name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: ['revenuecat_intro','backend','lemon_squeezy'] })
  source: TrialSource;

  @Column({ type: 'enum', enum: ['pro','organization'] })
  plan: TrialPlan;

  @Column({ type: 'timestamptz', name: 'started_at' })
  startedAt: Date;

  @Index('idx_user_trials_ends_at')
  @Column({ type: 'timestamptz', name: 'ends_at' })
  endsAt: Date;

  @Column({ type: 'boolean', default: true })
  consumed: boolean;

  @Column({ type: 'text', nullable: true, name: 'original_transaction_id' })
  originalTransactionId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/billing/trials/entities/user-trial.entity.ts
git commit -m "feat(billing): add UserTrial entity"
```

---

### Task 1.8: Create OutboxEvent entity

**Files:**
- Create: `src/billing/outbox/entities/outbox-event.entity.ts`

- [ ] **Step 1: Write entity**

```ts
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

export type OutboxStatus = 'pending' | 'processing' | 'done' | 'failed';
export type OutboxEventType = 'amplitude.track' | 'telegram.alert' | 'fcm.push';

@Entity('outbox_events')
export class OutboxEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  type: OutboxEventType;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Index('idx_outbox_pending_status')
  @Column({
    type: 'enum',
    enum: ['pending','processing','done','failed'],
    default: 'pending',
  })
  status: OutboxStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'text', nullable: true, name: 'last_error' })
  lastError: string | null;

  @Column({ type: 'timestamptz', name: 'next_attempt_at', default: () => 'now()' })
  nextAttemptAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'processed_at' })
  processedAt: Date | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/billing/outbox/entities/outbox-event.entity.ts
git commit -m "feat(billing): add OutboxEvent entity"
```

---

### Task 1.9: Update WebhookEvent entity

**Files:**
- Modify: `src/billing/entities/webhook-event.entity.ts`

- [ ] **Step 1: Add fields**

```ts
@Column({ type: 'uuid', nullable: true, name: 'user_id' })
userId: string | null;

@Column({ type: 'text', nullable: true })
error: string | null;

@Column({ type: 'varchar', length: 64, nullable: true, name: 'event_type' })
eventType: string | null;
```

- [ ] **Step 2: Commit**

```bash
git add src/billing/entities/webhook-event.entity.ts
git commit -m "feat(billing): extend WebhookEvent with userId, error, eventType"
```

---

## Phase 2: State Machine (pure module)

### Task 2.1: State machine types

**Files:**
- Create: `src/billing/state-machine/types.ts`

- [ ] **Step 1: Write types**

```ts
export type BillingState =
  | 'free'
  | 'active'
  | 'cancel_at_period_end'
  | 'billing_issue'
  | 'grace_pro'
  | 'grace_team';

export type Plan = 'free' | 'pro' | 'organization';
export type BillingPeriod = 'monthly' | 'yearly';
export type BillingSource = 'revenuecat' | 'lemon_squeezy' | null;
export type GraceReason = 'team_expired' | 'pro_expired' | null;

export interface UserBillingSnapshot {
  userId: string;
  plan: Plan;
  state: BillingState;
  billingSource: BillingSource;
  billingPeriod: BillingPeriod | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  graceExpiresAt: Date | null;
  graceReason: GraceReason;
  billingIssueAt: Date | null;
}

export type BillingEvent =
  | { type: 'RC_INITIAL_PURCHASE'; plan: Exclude<Plan,'free'>; period: BillingPeriod; periodStart: Date; periodEnd: Date }
  | { type: 'RC_RENEWAL'; periodStart: Date; periodEnd: Date }
  | { type: 'RC_PRODUCT_CHANGE'; newPlan: Exclude<Plan,'free'>; period: BillingPeriod; periodStart: Date; periodEnd: Date }
  | { type: 'RC_CANCELLATION'; periodEnd: Date }
  | { type: 'RC_UNCANCELLATION' }
  | { type: 'RC_EXPIRATION' }
  | { type: 'RC_BILLING_ISSUE' }
  | { type: 'TEAM_OWNER_EXPIRED'; memberHasOwnSub: boolean }
  | { type: 'TEAM_MEMBER_REMOVED' }
  | { type: 'GRACE_EXPIRED' }
  | { type: 'LS_SUBSCRIPTION_CREATED'; plan: Exclude<Plan,'free'>; period: BillingPeriod; periodEnd: Date }
  | { type: 'LS_SUBSCRIPTION_UPDATED'; plan: Exclude<Plan,'free'>; period: BillingPeriod; periodEnd: Date }
  | { type: 'LS_SUBSCRIPTION_CANCELLED' };

export class InvalidTransitionError extends Error {
  constructor(from: BillingState, eventType: string) {
    super(`Invalid billing transition: ${from} -> ${eventType}`);
    this.name = 'InvalidTransitionError';
  }
}

export interface RCSubscriberSnapshot {
  entitlements: Record<string, { expiresAt: Date | null; productId: string }>;
  latestExpirationMs: number | null;
  cancelAtPeriodEnd: boolean;
  billingIssueDetectedAt: Date | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/billing/state-machine/types.ts
git commit -m "feat(billing): state machine types"
```

---

### Task 2.2: Test — transition happy path

**Files:**
- Create: `src/billing/state-machine/__tests__/transitions.spec.ts`

- [ ] **Step 1: Write test**

```ts
import { transition } from '../transitions';
import { UserBillingSnapshot } from '../types';

function freeSnapshot(): UserBillingSnapshot {
  return {
    userId: 'u1',
    plan: 'free',
    state: 'free',
    billingSource: null,
    billingPeriod: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    graceExpiresAt: null,
    graceReason: null,
    billingIssueAt: null,
  };
}

describe('BillingStateMachine.transition', () => {
  it('RC_INITIAL_PURCHASE free → active', () => {
    const start = new Date('2026-04-19T00:00:00Z');
    const end = new Date('2026-05-19T00:00:00Z');
    const next = transition(freeSnapshot(), {
      type: 'RC_INITIAL_PURCHASE',
      plan: 'pro',
      period: 'monthly',
      periodStart: start,
      periodEnd: end,
    });
    expect(next.state).toBe('active');
    expect(next.plan).toBe('pro');
    expect(next.billingSource).toBe('revenuecat');
    expect(next.currentPeriodStart).toEqual(start);
    expect(next.currentPeriodEnd).toEqual(end);
    expect(next.cancelAtPeriodEnd).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend
npx jest src/billing/state-machine/__tests__/transitions.spec.ts
```
Expected: FAIL (module not found).

- [ ] **Step 3: Do NOT commit yet.**

---

### Task 2.3: Implement minimal transition function

**Files:**
- Create: `src/billing/state-machine/transitions.ts`

- [ ] **Step 1: Write minimal code**

```ts
import { BillingEvent, BillingState, InvalidTransitionError, UserBillingSnapshot } from './types';

export function transition(
  current: UserBillingSnapshot,
  event: BillingEvent,
): UserBillingSnapshot {
  switch (event.type) {
    case 'RC_INITIAL_PURCHASE':
      return {
        ...current,
        plan: event.plan,
        state: 'active',
        billingSource: 'revenuecat',
        billingPeriod: event.period,
        currentPeriodStart: event.periodStart,
        currentPeriodEnd: event.periodEnd,
        cancelAtPeriodEnd: false,
        graceExpiresAt: null,
        graceReason: null,
        billingIssueAt: null,
      };
    default:
      throw new InvalidTransitionError(current.state, event.type);
  }
}
```

- [ ] **Step 2: Run test to verify it passes**

```bash
npx jest src/billing/state-machine/__tests__/transitions.spec.ts
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/billing/state-machine/
git commit -m "feat(billing): state machine initial purchase transition"
```

---

### Task 2.4: Add tests + impl for all RC transitions

**Files:**
- Modify: `src/billing/state-machine/__tests__/transitions.spec.ts`
- Modify: `src/billing/state-machine/transitions.ts`

- [ ] **Step 1: Add comprehensive test cases to spec file**

Append tests for every valid transition from the matrix (spec section 4.2). Example additions:

```ts
  it('active → cancel_at_period_end on RC_CANCELLATION', () => {
    const active: UserBillingSnapshot = { ...freeSnapshot(), plan: 'pro', state: 'active', billingSource: 'revenuecat', billingPeriod: 'monthly', currentPeriodEnd: new Date('2026-05-19') };
    const end = new Date('2026-05-19T00:00:00Z');
    const next = transition(active, { type: 'RC_CANCELLATION', periodEnd: end });
    expect(next.state).toBe('cancel_at_period_end');
    expect(next.cancelAtPeriodEnd).toBe(true);
    expect(next.currentPeriodEnd).toEqual(end);
    expect(next.plan).toBe('pro');
  });

  it('cancel_at_period_end → active on RC_UNCANCELLATION', () => {
    const cap: UserBillingSnapshot = { ...freeSnapshot(), plan: 'pro', state: 'cancel_at_period_end', billingSource: 'revenuecat', cancelAtPeriodEnd: true };
    const next = transition(cap, { type: 'RC_UNCANCELLATION' });
    expect(next.state).toBe('active');
    expect(next.cancelAtPeriodEnd).toBe(false);
  });

  it('active → grace_pro on RC_EXPIRATION', () => {
    const active: UserBillingSnapshot = { ...freeSnapshot(), plan: 'pro', state: 'active', billingSource: 'revenuecat' };
    const next = transition(active, { type: 'RC_EXPIRATION' });
    expect(next.state).toBe('grace_pro');
    expect(next.plan).toBe('free');
    expect(next.graceReason).toBe('pro_expired');
    expect(next.graceExpiresAt).toBeInstanceOf(Date);
    const delta = next.graceExpiresAt!.getTime() - Date.now();
    expect(delta).toBeGreaterThan(6.9 * 86400 * 1000);
    expect(delta).toBeLessThan(7.1 * 86400 * 1000);
  });

  it('active → billing_issue on RC_BILLING_ISSUE', () => {
    const active: UserBillingSnapshot = { ...freeSnapshot(), plan: 'pro', state: 'active', billingSource: 'revenuecat' };
    const next = transition(active, { type: 'RC_BILLING_ISSUE' });
    expect(next.state).toBe('billing_issue');
    expect(next.billingIssueAt).toBeInstanceOf(Date);
    expect(next.plan).toBe('pro');
  });

  it('billing_issue → active on RC_RENEWAL', () => {
    const bi: UserBillingSnapshot = { ...freeSnapshot(), plan: 'pro', state: 'billing_issue', billingSource: 'revenuecat', billingIssueAt: new Date() };
    const start = new Date('2026-04-19');
    const end = new Date('2026-05-19');
    const next = transition(bi, { type: 'RC_RENEWAL', periodStart: start, periodEnd: end });
    expect(next.state).toBe('active');
    expect(next.billingIssueAt).toBeNull();
    expect(next.currentPeriodEnd).toEqual(end);
  });

  it('grace_pro → free on GRACE_EXPIRED', () => {
    const grace: UserBillingSnapshot = { ...freeSnapshot(), state: 'grace_pro', graceReason: 'pro_expired', graceExpiresAt: new Date(Date.now() - 1000) };
    const next = transition(grace, { type: 'GRACE_EXPIRED' });
    expect(next.state).toBe('free');
    expect(next.plan).toBe('free');
    expect(next.graceExpiresAt).toBeNull();
    expect(next.graceReason).toBeNull();
  });

  it('grace_pro → active on new RC_INITIAL_PURCHASE', () => {
    const grace: UserBillingSnapshot = { ...freeSnapshot(), state: 'grace_pro' };
    const next = transition(grace, { 
      type: 'RC_INITIAL_PURCHASE', plan: 'pro', period: 'monthly',
      periodStart: new Date(), periodEnd: new Date(Date.now() + 30 * 86400_000)
    });
    expect(next.state).toBe('active');
    expect(next.graceExpiresAt).toBeNull();
  });

  it('active → grace_team on TEAM_OWNER_EXPIRED when memberHasOwnSub=false', () => {
    const member: UserBillingSnapshot = { ...freeSnapshot(), plan: 'organization', state: 'active', billingSource: null };
    const next = transition(member, { type: 'TEAM_OWNER_EXPIRED', memberHasOwnSub: false });
    expect(next.state).toBe('grace_team');
    expect(next.graceReason).toBe('team_expired');
  });

  it('active stays active on TEAM_OWNER_EXPIRED when memberHasOwnSub=true', () => {
    const member: UserBillingSnapshot = { ...freeSnapshot(), plan: 'pro', state: 'active', billingSource: 'revenuecat' };
    const next = transition(member, { type: 'TEAM_OWNER_EXPIRED', memberHasOwnSub: true });
    expect(next.state).toBe('active');
    expect(next.plan).toBe('pro');
  });

  it('throws InvalidTransitionError on free + RC_RENEWAL', () => {
    expect(() => transition(freeSnapshot(), {
      type: 'RC_RENEWAL', periodStart: new Date(), periodEnd: new Date()
    })).toThrow('Invalid billing transition: free -> RC_RENEWAL');
  });
```

- [ ] **Step 2: Run tests to see failures**

```bash
npx jest src/billing/state-machine/__tests__/transitions.spec.ts
```

- [ ] **Step 3: Extend transitions.ts to handle all events**

Rewrite `transitions.ts` to handle all branches from matrix (section 4.2). Full implementation:

```ts
import { BillingEvent, BillingState, InvalidTransitionError, UserBillingSnapshot } from './types';

const GRACE_PERIOD_DAYS = 7;

function addDays(days: number): Date {
  return new Date(Date.now() + days * 86400_000);
}

export function transition(
  s: UserBillingSnapshot,
  e: BillingEvent,
): UserBillingSnapshot {
  switch (e.type) {
    case 'RC_INITIAL_PURCHASE':
      if (s.state !== 'free' && s.state !== 'grace_pro' && s.state !== 'grace_team') {
        throw new InvalidTransitionError(s.state, e.type);
      }
      return {
        ...s,
        plan: e.plan, state: 'active', billingSource: 'revenuecat',
        billingPeriod: e.period,
        currentPeriodStart: e.periodStart, currentPeriodEnd: e.periodEnd,
        cancelAtPeriodEnd: false, graceExpiresAt: null, graceReason: null, billingIssueAt: null,
      };

    case 'RC_RENEWAL':
      if (s.state !== 'active' && s.state !== 'billing_issue') {
        throw new InvalidTransitionError(s.state, e.type);
      }
      return {
        ...s, state: 'active',
        currentPeriodStart: e.periodStart, currentPeriodEnd: e.periodEnd,
        billingIssueAt: null, cancelAtPeriodEnd: false,
      };

    case 'RC_PRODUCT_CHANGE':
      if (s.state !== 'active') throw new InvalidTransitionError(s.state, e.type);
      return {
        ...s, plan: e.newPlan, billingPeriod: e.period,
        currentPeriodStart: e.periodStart, currentPeriodEnd: e.periodEnd,
      };

    case 'RC_CANCELLATION':
      if (s.state !== 'active' && s.state !== 'billing_issue') {
        throw new InvalidTransitionError(s.state, e.type);
      }
      return { ...s, state: 'cancel_at_period_end', cancelAtPeriodEnd: true, currentPeriodEnd: e.periodEnd };

    case 'RC_UNCANCELLATION':
      if (s.state !== 'cancel_at_period_end') throw new InvalidTransitionError(s.state, e.type);
      return { ...s, state: 'active', cancelAtPeriodEnd: false };

    case 'RC_EXPIRATION':
      if (s.state === 'free' || s.state === 'grace_pro' || s.state === 'grace_team') return s;
      return {
        ...s, plan: 'free', state: 'grace_pro',
        graceExpiresAt: addDays(GRACE_PERIOD_DAYS), graceReason: 'pro_expired',
        cancelAtPeriodEnd: false, billingIssueAt: null,
      };

    case 'RC_BILLING_ISSUE':
      if (s.state !== 'active' && s.state !== 'cancel_at_period_end') {
        if (s.state === 'billing_issue') return s;
        throw new InvalidTransitionError(s.state, e.type);
      }
      return { ...s, state: 'billing_issue', billingIssueAt: new Date() };

    case 'TEAM_OWNER_EXPIRED':
      if (e.memberHasOwnSub) return s;
      return {
        ...s, state: 'grace_team',
        graceExpiresAt: addDays(GRACE_PERIOD_DAYS), graceReason: 'team_expired',
      };

    case 'TEAM_MEMBER_REMOVED':
      if (s.billingSource === 'revenuecat' && !s.cancelAtPeriodEnd && s.state === 'active') {
        return s; // member had own sub — keep
      }
      return { ...s, state: 'grace_team', graceExpiresAt: addDays(GRACE_PERIOD_DAYS), graceReason: 'team_expired' };

    case 'GRACE_EXPIRED':
      if (s.state !== 'grace_pro' && s.state !== 'grace_team') return s;
      return { ...s, plan: 'free', state: 'free', graceExpiresAt: null, graceReason: null, billingSource: null };

    case 'LS_SUBSCRIPTION_CREATED':
    case 'LS_SUBSCRIPTION_UPDATED':
      return {
        ...s, plan: e.plan, state: 'active', billingSource: 'lemon_squeezy',
        billingPeriod: e.period, currentPeriodEnd: e.periodEnd,
        cancelAtPeriodEnd: false, graceExpiresAt: null, graceReason: null,
      };

    case 'LS_SUBSCRIPTION_CANCELLED':
      return { ...s, plan: 'free', state: 'free', billingSource: null, cancelAtPeriodEnd: false };

    default: {
      const _exhaustive: never = e;
      throw new InvalidTransitionError(s.state, (e as any).type);
    }
  }
}
```

- [ ] **Step 4: Run all transition tests**

```bash
npx jest src/billing/state-machine/__tests__/transitions.spec.ts
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/billing/state-machine/
git commit -m "feat(billing): full state machine transitions with tests"
```

---

### Task 2.5: Reconcile function

**Files:**
- Create: `src/billing/state-machine/reconcile.ts`
- Create: `src/billing/state-machine/__tests__/reconcile.spec.ts`

- [ ] **Step 1: Write reconcile test**

```ts
import { reconcile } from '../reconcile';
import { UserBillingSnapshot, RCSubscriberSnapshot } from '../types';

describe('reconcile', () => {
  it('marks grace_pro when RC has no active entitlement but DB thinks active', () => {
    const current: UserBillingSnapshot = {
      userId: 'u1', plan: 'pro', state: 'active',
      billingSource: 'revenuecat', billingPeriod: 'monthly',
      currentPeriodStart: new Date('2026-03-01'),
      currentPeriodEnd: new Date('2026-04-01'),
      cancelAtPeriodEnd: false, graceExpiresAt: null, graceReason: null, billingIssueAt: null,
    };
    const rc: RCSubscriberSnapshot = {
      entitlements: {},
      latestExpirationMs: new Date('2026-04-01').getTime(),
      cancelAtPeriodEnd: false,
      billingIssueDetectedAt: null,
    };
    const next = reconcile(current, rc);
    expect(next.state).toBe('grace_pro');
  });

  it('no-op when DB and RC agree on active pro', () => {
    const end = new Date(Date.now() + 10 * 86400_000);
    const current: UserBillingSnapshot = {
      userId: 'u1', plan: 'pro', state: 'active',
      billingSource: 'revenuecat', billingPeriod: 'monthly',
      currentPeriodStart: new Date(Date.now() - 20 * 86400_000),
      currentPeriodEnd: end,
      cancelAtPeriodEnd: false, graceExpiresAt: null, graceReason: null, billingIssueAt: null,
    };
    const rc: RCSubscriberSnapshot = {
      entitlements: { pro: { expiresAt: end, productId: 'io.subradar.mobile.pro.monthly' } },
      latestExpirationMs: end.getTime(), cancelAtPeriodEnd: false, billingIssueDetectedAt: null,
    };
    const next = reconcile(current, rc);
    expect(next).toEqual(current);
  });
});
```

- [ ] **Step 2: Implement**

```ts
import { RCSubscriberSnapshot, UserBillingSnapshot } from './types';
import { transition } from './transitions';

function hasActiveEntitlement(rc: RCSubscriberSnapshot): boolean {
  const now = Date.now();
  return Object.values(rc.entitlements).some(e => 
    !e.expiresAt || e.expiresAt.getTime() > now
  );
}

export function reconcile(
  current: UserBillingSnapshot,
  rc: RCSubscriberSnapshot,
): UserBillingSnapshot {
  const active = hasActiveEntitlement(rc);
  
  if (!active && (current.state === 'active' || current.state === 'cancel_at_period_end' || current.state === 'billing_issue')) {
    return transition(current, { type: 'RC_EXPIRATION' });
  }
  
  if (rc.billingIssueDetectedAt && current.state !== 'billing_issue') {
    try { return transition(current, { type: 'RC_BILLING_ISSUE' }); } catch { /* ignore */ }
  }
  
  if (active && current.state === 'billing_issue' && !rc.billingIssueDetectedAt) {
    // Looks healed — RENEWAL-like state
    if (rc.latestExpirationMs) {
      return transition(current, {
        type: 'RC_RENEWAL',
        periodStart: current.currentPeriodStart ?? new Date(),
        periodEnd: new Date(rc.latestExpirationMs),
      });
    }
  }
  
  if (rc.cancelAtPeriodEnd !== current.cancelAtPeriodEnd) {
    if (rc.cancelAtPeriodEnd && current.state === 'active') {
      return transition(current, { type: 'RC_CANCELLATION', periodEnd: new Date(rc.latestExpirationMs ?? Date.now()) });
    }
    if (!rc.cancelAtPeriodEnd && current.state === 'cancel_at_period_end') {
      return transition(current, { type: 'RC_UNCANCELLATION' });
    }
  }
  
  return current;
}
```

- [ ] **Step 3: Run tests**

```bash
npx jest src/billing/state-machine/__tests__/reconcile.spec.ts
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/billing/state-machine/
git commit -m "feat(billing): state machine reconcile function"
```

---

### Task 2.6: State machine index + module

**Files:**
- Create: `src/billing/state-machine/index.ts`

- [ ] **Step 1: Write barrel**

```ts
export * from './types';
export { transition } from './transitions';
export { reconcile } from './reconcile';
```

- [ ] **Step 2: Commit**

```bash
git add src/billing/state-machine/index.ts
git commit -m "feat(billing): state machine barrel export"
```

---

## Phase 3: Outbox system

### Task 3.1: OutboxService

**Files:**
- Create: `src/billing/outbox/outbox.service.ts`
- Create: `src/billing/outbox/__tests__/outbox.service.spec.ts`

- [ ] **Step 1: Write test (minimal)**

```ts
import { Test } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxService } from '../outbox.service';
import { OutboxEvent } from '../entities/outbox-event.entity';

describe('OutboxService', () => {
  let service: OutboxService;
  let repo: Repository<OutboxEvent>;
  
  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        OutboxService,
        {
          provide: getRepositoryToken(OutboxEvent),
          useValue: {
            create: jest.fn(x => x),
            save: jest.fn(async x => ({ ...x, id: 'generated' })),
          },
        },
      ],
    }).compile();
    service = mod.get(OutboxService);
    repo = mod.get(getRepositoryToken(OutboxEvent));
  });
  
  it('enqueue creates pending event', async () => {
    await service.enqueue('amplitude.track', { event: 'test', userId: 'u1' });
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({
      type: 'amplitude.track',
      payload: { event: 'test', userId: 'u1' },
      status: 'pending',
      attempts: 0,
    }));
  });
});
```

- [ ] **Step 2: Implement OutboxService**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, LessThanOrEqual } from 'typeorm';
import { OutboxEvent, OutboxEventType } from './entities/outbox-event.entity';

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);
  
  constructor(
    @InjectRepository(OutboxEvent)
    private readonly repo: Repository<OutboxEvent>,
  ) {}
  
  async enqueue(type: OutboxEventType, payload: Record<string, unknown>, manager?: EntityManager): Promise<OutboxEvent> {
    const event = this.repo.create({
      type, payload, status: 'pending', attempts: 0,
      nextAttemptAt: new Date(),
    });
    return manager ? manager.save(OutboxEvent, event) : this.repo.save(event);
  }
  
  async claimBatch(limit: number): Promise<OutboxEvent[]> {
    return this.repo.manager.transaction(async (m) => {
      const events = await m.query(`
        UPDATE outbox_events
        SET status = 'processing'
        WHERE id IN (
          SELECT id FROM outbox_events
          WHERE status = 'pending' AND next_attempt_at <= now()
          ORDER BY next_attempt_at ASC
          LIMIT $1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *
      `, [limit]);
      return events as OutboxEvent[];
    });
  }
  
  async markDone(id: string): Promise<void> {
    await this.repo.update(id, { status: 'done', processedAt: new Date() });
  }
  
  async markFailed(id: string, error: string, attempts: number, nextAttemptAt: Date | null): Promise<void> {
    await this.repo.update(id, {
      status: nextAttemptAt ? 'pending' : 'failed',
      attempts,
      lastError: error.slice(0, 2000),
      nextAttemptAt: nextAttemptAt ?? new Date(),
      processedAt: nextAttemptAt ? null : new Date(),
    });
  }
  
  async stats(): Promise<{ pending: number; failed: number; done24h: number }> {
    const [pending, failed, done24h] = await Promise.all([
      this.repo.count({ where: { status: 'pending' } }),
      this.repo.count({ where: { status: 'failed' } }),
      this.repo.count({ where: { status: 'done', processedAt: LessThanOrEqual(new Date()) as any } }),
    ]);
    return { pending, failed, done24h };
  }
}
```

- [ ] **Step 3: Run test**

```bash
npx jest src/billing/outbox/__tests__/outbox.service.spec.ts
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/billing/outbox/
git commit -m "feat(billing): OutboxService"
```

---

### Task 3.2: Outbox handlers — Amplitude/Telegram/FCM

**Files:**
- Create: `src/billing/outbox/handlers/amplitude.handler.ts`
- Create: `src/billing/outbox/handlers/telegram.handler.ts`
- Create: `src/billing/outbox/handlers/fcm.handler.ts`

Review existing: `src/analytics/amplitude.service.ts`, `src/notifications/telegram.service.ts`, `src/notifications/fcm.service.ts` (or the actual paths; grep if unclear).

- [ ] **Step 1: Locate existing providers**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend
grep -r "amplitude" src/ --include="*.ts" -l
grep -r "telegram" src/ --include="*.ts" -l
grep -r "firebase-admin\|fcm" src/ --include="*.ts" -l
```
Record the actual service class names and paths.

- [ ] **Step 2: Write Amplitude handler**

```ts
import { Injectable } from '@nestjs/common';
import { AmplitudeService } from '<actual-path>';  // replace with path from Step 1

@Injectable()
export class AmplitudeHandler {
  constructor(private readonly amplitude: AmplitudeService) {}
  
  async handle(payload: Record<string, unknown>): Promise<void> {
    const { event, userId, properties } = payload as {
      event: string; userId: string; properties?: Record<string, unknown>;
    };
    await this.amplitude.track(event, userId, properties ?? {});
  }
}
```
If `AmplitudeService` has a different interface — adapt call, keeping same shape.

- [ ] **Step 3: Telegram handler**

```ts
import { Injectable } from '@nestjs/common';
import { TelegramAlertService } from '<actual-path>';

@Injectable()
export class TelegramHandler {
  constructor(private readonly telegram: TelegramAlertService) {}
  
  async handle(payload: Record<string, unknown>): Promise<void> {
    const { text, parseMode } = payload as { text: string; parseMode?: string };
    await this.telegram.send(text, { parseMode });
  }
}
```

- [ ] **Step 4: FCM handler**

```ts
import { Injectable } from '@nestjs/common';
import { FcmService } from '<actual-path>';

@Injectable()
export class FcmHandler {
  constructor(private readonly fcm: FcmService) {}
  
  async handle(payload: Record<string, unknown>): Promise<void> {
    const { token, title, body, data } = payload as {
      token: string; title: string; body: string; data?: Record<string, string>;
    };
    await this.fcm.send(token, { title, body, data: data ?? {} });
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/billing/outbox/handlers/
git commit -m "feat(billing): outbox handlers for amplitude, telegram, fcm"
```

---

### Task 3.3: OutboxWorker cron

**Files:**
- Create: `src/billing/outbox/outbox.worker.ts`

- [ ] **Step 1: Implement**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OutboxService } from './outbox.service';
import { OutboxEvent } from './entities/outbox-event.entity';
import { AmplitudeHandler } from './handlers/amplitude.handler';
import { TelegramHandler } from './handlers/telegram.handler';
import { FcmHandler } from './handlers/fcm.handler';

const MAX_ATTEMPTS = 10;

function exponentialBackoff(attempts: number): Date {
  const seconds = Math.min(60 * 60, Math.pow(2, attempts));
  return new Date(Date.now() + seconds * 1000);
}

@Injectable()
export class OutboxWorker {
  private readonly logger = new Logger(OutboxWorker.name);
  
  constructor(
    private readonly outbox: OutboxService,
    private readonly amplitude: AmplitudeHandler,
    private readonly telegram: TelegramHandler,
    private readonly fcm: FcmHandler,
  ) {}
  
  @Cron(CronExpression.EVERY_10_SECONDS)
  async tick(): Promise<void> {
    const batch = await this.outbox.claimBatch(50);
    if (batch.length === 0) return;
    this.logger.debug(`Outbox processing batch of ${batch.length}`);
    await Promise.allSettled(batch.map(e => this.process(e)));
  }
  
  private async process(event: OutboxEvent): Promise<void> {
    try {
      switch (event.type) {
        case 'amplitude.track': await this.amplitude.handle(event.payload); break;
        case 'telegram.alert':  await this.telegram.handle(event.payload); break;
        case 'fcm.push':        await this.fcm.handle(event.payload); break;
        default: throw new Error(`Unknown outbox type: ${event.type}`);
      }
      await this.outbox.markDone(event.id);
    } catch (err: any) {
      const attempts = event.attempts + 1;
      const next = attempts >= MAX_ATTEMPTS ? null : exponentialBackoff(attempts);
      await this.outbox.markFailed(event.id, err?.message ?? String(err), attempts, next);
      if (!next) {
        this.logger.error(`Outbox event ${event.id} (${event.type}) moved to failed after ${attempts} attempts: ${err.message}`);
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/billing/outbox/outbox.worker.ts
git commit -m "feat(billing): OutboxWorker cron with retry/backoff"
```

---

### Task 3.4: Outbox module wiring

**Files:**
- Create: `src/billing/outbox/outbox.module.ts`

- [ ] **Step 1: Write module**

```ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEvent } from './entities/outbox-event.entity';
import { OutboxService } from './outbox.service';
import { OutboxWorker } from './outbox.worker';
import { AmplitudeHandler } from './handlers/amplitude.handler';
import { TelegramHandler } from './handlers/telegram.handler';
import { FcmHandler } from './handlers/fcm.handler';
// Import modules that export AmplitudeService / TelegramService / FcmService
// e.g. AnalyticsModule, NotificationsModule
import { AnalyticsModule } from '<actual-analytics-module-path>';
import { NotificationsModule } from '<actual-notifications-module-path>';

@Module({
  imports: [
    TypeOrmModule.forFeature([OutboxEvent]),
    forwardRef(() => AnalyticsModule),
    forwardRef(() => NotificationsModule),
  ],
  providers: [OutboxService, OutboxWorker, AmplitudeHandler, TelegramHandler, FcmHandler],
  exports: [OutboxService],
})
export class OutboxModule {}
```

Replace `<actual-analytics-module-path>` and `<actual-notifications-module-path>` with real paths found via:
```bash
grep -r "AmplitudeService" src/ --include="*.module.ts" -l
grep -r "TelegramAlertService\|TelegramService" src/ --include="*.module.ts" -l
```

- [ ] **Step 2: Import OutboxModule in BillingModule**

Edit `src/billing/billing.module.ts` — add `OutboxModule` to `imports`.

- [ ] **Step 3: Run app locally**

```bash
npm run start:dev
```
Verify no circular dep / missing provider errors. Ctrl-C to stop.

- [ ] **Step 4: Commit**

```bash
git add src/billing/outbox/ src/billing/billing.module.ts
git commit -m "feat(billing): wire OutboxModule"
```

---

## Phase 4: Effective Access Resolver

### Task 4.1: Types for /billing/me response

**Files:**
- Create: `src/billing/effective-access/billing-me.types.ts`

- [ ] **Step 1: Write types mirroring spec section 5.1**

```ts
export type BannerPriority =
  | 'billing_issue' | 'grace' | 'expiration'
  | 'double_pay' | 'annual_upgrade' | 'win_back' | 'none';

export interface BillingMeResponse {
  effective: {
    plan: 'free' | 'pro' | 'organization';
    source: 'own' | 'team' | 'trial' | 'grace_pro' | 'grace_team' | 'free';
    state: 'active' | 'cancel_at_period_end' | 'billing_issue' | 'grace_pro' | 'grace_team' | 'free';
    billingPeriod: 'monthly' | 'yearly' | null;
  };
  ownership: {
    hasOwnPaidPlan: boolean;
    isTeamOwner: boolean;
    isTeamMember: boolean;
    teamOwnerId: string | null;
    workspaceId: string | null;
  };
  dates: {
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    nextPaymentDate: string | null;
    graceExpiresAt: string | null;
    graceDaysLeft: number | null;
    trialEndsAt: string | null;
    billingIssueStartedAt: string | null;
  };
  flags: {
    cancelAtPeriodEnd: boolean;
    hasBillingIssue: boolean;
    trialEligible: boolean;
    shouldShowDoublePay: boolean;
    degradedMode: boolean;
    hiddenSubscriptionsCount: number;
    graceReason: 'team_expired' | 'pro_expired' | null;
  };
  banner: {
    priority: BannerPriority;
    payload: Record<string, unknown>;
  };
  limits: {
    subscriptions: { used: number; limit: number | null };
    aiRequests: { used: number; limit: number; resetAt: string };
    canCreateOrg: boolean;
    canInvite: boolean;
  };
  actions: {
    canStartTrial: boolean;
    canCancel: boolean;
    canRestore: boolean;
    canUpgradeToYearly: boolean;
    canInviteProFriend: boolean;
  };
  products: {
    pro: { monthly: string; yearly: string };
    team: { monthly: string; yearly: string };
  };
  serverTime: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/billing/effective-access/billing-me.types.ts
git commit -m "feat(billing): BillingMeResponse types"
```

---

### Task 4.2: Banner priority calculator

**Files:**
- Create: `src/billing/effective-access/banner-priority.ts`
- Create: `src/billing/effective-access/__tests__/banner-priority.spec.ts`

- [ ] **Step 1: Test**

```ts
import { computeBannerPriority } from '../banner-priority';

describe('computeBannerPriority', () => {
  const base = {
    state: 'active' as const,
    plan: 'pro' as const,
    billingPeriod: 'monthly' as const,
    cancelAtPeriodEnd: false,
    billingIssueAt: null as Date | null,
    currentPeriodEnd: null as Date | null,
    graceExpiresAt: null as Date | null,
    graceReason: null as any,
    hasOwnPaidPlan: false,
    isTeamMember: false,
    isTeamOwner: false,
    hiddenSubscriptionsCount: 0,
    hadProBefore: false,
  };

  it('billing_issue wins over everything', () => {
    const r = computeBannerPriority({ ...base, billingIssueAt: new Date(), state: 'billing_issue' });
    expect(r.priority).toBe('billing_issue');
  });
  
  it('grace when state is grace_pro', () => {
    const r = computeBannerPriority({ ...base, state: 'grace_pro', graceReason: 'pro_expired', graceExpiresAt: new Date(Date.now() + 3 * 86400_000) });
    expect(r.priority).toBe('grace');
    expect(r.payload).toMatchObject({ daysLeft: 3, reason: 'pro_expired' });
  });
  
  it('expiration when within 7 days and cancel_at_period_end', () => {
    const end = new Date(Date.now() + 5 * 86400_000);
    const r = computeBannerPriority({ ...base, state: 'cancel_at_period_end', cancelAtPeriodEnd: true, currentPeriodEnd: end });
    expect(r.priority).toBe('expiration');
    expect(r.payload).toMatchObject({ daysLeft: 5 });
  });
  
  it('double_pay when hasOwnPaidPlan and team member', () => {
    const r = computeBannerPriority({ ...base, hasOwnPaidPlan: true, isTeamMember: true });
    expect(r.priority).toBe('double_pay');
  });
  
  it('annual_upgrade for monthly pro', () => {
    const r = computeBannerPriority({ ...base, plan: 'pro', billingPeriod: 'monthly', hasOwnPaidPlan: true });
    expect(r.priority).toBe('annual_upgrade');
  });
  
  it('win_back when free but had pro before', () => {
    const r = computeBannerPriority({ ...base, plan: 'free', state: 'free', hadProBefore: true });
    expect(r.priority).toBe('win_back');
  });
  
  it('none for active non-monthly', () => {
    const r = computeBannerPriority({ ...base, billingPeriod: 'yearly', hasOwnPaidPlan: true });
    expect(r.priority).toBe('none');
  });
});
```

- [ ] **Step 2: Implement**

```ts
import { BannerPriority } from './billing-me.types';
import { BillingState, GraceReason, BillingPeriod, Plan } from '../state-machine/types';

export interface BannerInput {
  state: BillingState;
  plan: Plan;
  billingPeriod: BillingPeriod | null;
  cancelAtPeriodEnd: boolean;
  billingIssueAt: Date | null;
  currentPeriodEnd: Date | null;
  graceExpiresAt: Date | null;
  graceReason: GraceReason;
  hasOwnPaidPlan: boolean;
  isTeamMember: boolean;
  isTeamOwner: boolean;
  hiddenSubscriptionsCount: number;
  hadProBefore: boolean;
}

export interface BannerResult {
  priority: BannerPriority;
  payload: Record<string, unknown>;
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.ceil((a.getTime() - b.getTime()) / 86400_000));
}

export function computeBannerPriority(input: BannerInput): BannerResult {
  const now = new Date();
  
  if (input.state === 'billing_issue' || input.billingIssueAt) {
    return {
      priority: 'billing_issue',
      payload: { startedAt: input.billingIssueAt?.toISOString() ?? null },
    };
  }
  
  if ((input.state === 'grace_pro' || input.state === 'grace_team') && input.graceExpiresAt) {
    return {
      priority: 'grace',
      payload: {
        daysLeft: daysBetween(input.graceExpiresAt, now),
        reason: input.graceReason,
      },
    };
  }
  
  if (input.state === 'cancel_at_period_end' && input.currentPeriodEnd) {
    const daysLeft = daysBetween(input.currentPeriodEnd, now);
    if (daysLeft <= 7) {
      return { priority: 'expiration', payload: { daysLeft, endsAt: input.currentPeriodEnd.toISOString() } };
    }
  }
  
  if (input.hasOwnPaidPlan && input.isTeamMember && !input.isTeamOwner) {
    return { priority: 'double_pay', payload: {} };
  }
  
  if (input.hasOwnPaidPlan && input.billingPeriod === 'monthly' && (input.plan === 'pro' || input.plan === 'organization')) {
    return { priority: 'annual_upgrade', payload: { plan: input.plan } };
  }
  
  if (input.plan === 'free' && input.state === 'free' && input.hadProBefore) {
    return { priority: 'win_back', payload: {} };
  }
  
  return { priority: 'none', payload: {} };
}
```

- [ ] **Step 3: Run tests**

```bash
npx jest src/billing/effective-access/__tests__/banner-priority.spec.ts
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/billing/effective-access/
git commit -m "feat(billing): banner priority calculator with tests"
```

---

### Task 4.3: EffectiveAccessResolver service

**Files:**
- Create: `src/billing/effective-access/effective-access.service.ts`
- Create: `src/billing/effective-access/__tests__/effective-access.service.spec.ts`

- [ ] **Step 1: Write service (integration test later)**

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { UserTrial } from '../trials/entities/user-trial.entity';
import { Workspace } from '../../workspace/entities/workspace.entity';
import { WorkspaceMember } from '../../workspace/entities/workspace-member.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';
import { PLANS } from '../plans.config';
import { BillingMeResponse } from './billing-me.types';
import { computeBannerPriority } from './banner-priority';

// Product ID config — mirrors mobile hardcoded values
const PRODUCTS = {
  pro:  { monthly: 'io.subradar.mobile.pro.monthly',  yearly: 'io.subradar.mobile.pro.yearly' },
  team: { monthly: 'io.subradar.mobile.team.monthly', yearly: 'io.subradar.mobile.team.yearly' },
};

@Injectable()
export class EffectiveAccessResolver {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserTrial) private readonly trials: Repository<UserTrial>,
    @InjectRepository(Workspace) private readonly workspaces: Repository<Workspace>,
    @InjectRepository(WorkspaceMember) private readonly members: Repository<WorkspaceMember>,
    @InjectRepository(Subscription) private readonly subs: Repository<Subscription>,
  ) {}
  
  async resolve(userId: string): Promise<BillingMeResponse> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new Error(`User ${userId} not found`);
    
    const trial = await this.trials.findOne({ where: { userId } });
    const ownedWorkspace = await this.workspaces.findOne({ where: { ownerId: userId } });
    const membership = await this.members.findOne({ 
      where: { userId, status: 'ACTIVE' as any },
      relations: ['workspace'],
    });
    const teamOwnerActive = membership?.workspace?.ownerId
      ? await this.isTeamOwnerActive(membership.workspace.ownerId)
      : false;
    const subsCount = await this.subs.count({ where: { userId } });
    
    const now = new Date();
    const trialActive = trial && trial.endsAt > now;
    const hasOwnPaidPlan = user.billingSource === 'revenuecat' || user.billingSource === 'lemon_squeezy';
    const isTeamOwner = !!ownedWorkspace;
    const isTeamMember = !!membership && !isTeamOwner;
    
    // Effective plan
    let effectivePlan: 'free'|'pro'|'organization';
    let source: BillingMeResponse['effective']['source'];
    if (isTeamOwner && ['organization','pro'].includes(user.plan) && user.billingStatus === 'active') {
      effectivePlan = 'organization'; source = 'own';
    } else if (isTeamMember && teamOwnerActive) {
      effectivePlan = 'organization'; source = 'team';
    } else if (hasOwnPaidPlan && ['active','cancel_at_period_end','billing_issue'].includes(user.billingStatus)) {
      effectivePlan = user.plan as any; source = 'own';
    } else if (trialActive) {
      effectivePlan = trial!.plan; source = 'trial';
    } else if (user.billingStatus === 'grace_pro') {
      effectivePlan = 'pro'; source = 'grace_pro';
    } else if (user.billingStatus === 'grace_team') {
      effectivePlan = 'organization'; source = 'grace_team';
    } else {
      effectivePlan = 'free'; source = 'free';
    }
    
    const currentLimits = PLANS[effectivePlan];
    const subscriptionLimit = currentLimits.subscriptionLimit;
    const hiddenCount = subscriptionLimit !== null ? Math.max(0, subsCount - subscriptionLimit) : 0;
    
    const graceDaysLeft = user.gracePeriodEnd
      ? Math.max(0, Math.ceil((user.gracePeriodEnd.getTime() - now.getTime()) / 86400_000))
      : null;
    
    const nextPaymentDate = user.cancelAtPeriodEnd ? null : user.currentPeriodEnd;
    
    const banner = computeBannerPriority({
      state: user.billingStatus as any,
      plan: effectivePlan,
      billingPeriod: user.billingPeriod as any,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd,
      billingIssueAt: user.billingIssueAt,
      currentPeriodEnd: user.currentPeriodEnd,
      graceExpiresAt: user.gracePeriodEnd,
      graceReason: (user.gracePeriodReason as any) ?? null,
      hasOwnPaidPlan,
      isTeamMember,
      isTeamOwner,
      hiddenSubscriptionsCount: hiddenCount,
      hadProBefore: !!user.downgradedAt,
    });
    
    return {
      effective: {
        plan: effectivePlan,
        source,
        state: user.billingStatus as any,
        billingPeriod: (user.billingPeriod as any) ?? null,
      },
      ownership: {
        hasOwnPaidPlan,
        isTeamOwner,
        isTeamMember,
        teamOwnerId: membership?.workspace?.ownerId ?? null,
        workspaceId: (ownedWorkspace?.id ?? membership?.workspaceId) ?? null,
      },
      dates: {
        currentPeriodStart: user.currentPeriodStart?.toISOString() ?? null,
        currentPeriodEnd: user.currentPeriodEnd?.toISOString() ?? null,
        nextPaymentDate: nextPaymentDate?.toISOString() ?? null,
        graceExpiresAt: user.gracePeriodEnd?.toISOString() ?? null,
        graceDaysLeft,
        trialEndsAt: trialActive ? trial!.endsAt.toISOString() : null,
        billingIssueStartedAt: user.billingIssueAt?.toISOString() ?? null,
      },
      flags: {
        cancelAtPeriodEnd: user.cancelAtPeriodEnd,
        hasBillingIssue: user.billingStatus === 'billing_issue',
        trialEligible: !trial && !hasOwnPaidPlan && effectivePlan === 'free',
        shouldShowDoublePay: hasOwnPaidPlan && isTeamMember && !isTeamOwner,
        degradedMode: effectivePlan === 'free' && hiddenCount > 0,
        hiddenSubscriptionsCount: hiddenCount,
        graceReason: (user.gracePeriodReason as any) ?? null,
      },
      banner,
      limits: {
        subscriptions: { used: subsCount, limit: subscriptionLimit },
        aiRequests: {
          used: user.aiRequestsUsed ?? 0,
          limit: currentLimits.aiRequestsLimit,
          resetAt: startOfNextMonth().toISOString(),
        },
        canCreateOrg: currentLimits.canCreateOrg,
        canInvite: currentLimits.hasInvite,
      },
      actions: {
        canStartTrial: !trial && !hasOwnPaidPlan && effectivePlan === 'free',
        canCancel: hasOwnPaidPlan && !user.cancelAtPeriodEnd,
        canRestore: true,
        canUpgradeToYearly: hasOwnPaidPlan && user.billingPeriod === 'monthly',
        canInviteProFriend: currentLimits.hasInvite && !user.proInviteeEmail,
      },
      products: PRODUCTS,
      serverTime: now.toISOString(),
    };
  }
  
  private async isTeamOwnerActive(ownerId: string): Promise<boolean> {
    const owner = await this.users.findOne({ where: { id: ownerId } });
    return !!owner && ['active','cancel_at_period_end','billing_issue'].includes(owner.billingStatus);
  }
}

function startOfNextMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}
```

If any field references (like `user.downgradedAt`, `user.billingSource`) don't exist on the entity, grep the entity file and adjust.

- [ ] **Step 2: Write integration test (table-driven)**

```ts
import { Test } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EffectiveAccessResolver } from '../effective-access.service';
import { User } from '../../../users/entities/user.entity';
import { UserTrial } from '../../trials/entities/user-trial.entity';

function mockRepo() {
  return { findOne: jest.fn(), count: jest.fn().mockResolvedValue(0) };
}

describe('EffectiveAccessResolver.resolve', () => {
  let svc: EffectiveAccessResolver;
  let users: ReturnType<typeof mockRepo>;
  let trials: ReturnType<typeof mockRepo>;
  let workspaces: ReturnType<typeof mockRepo>;
  let members: ReturnType<typeof mockRepo>;
  let subs: ReturnType<typeof mockRepo>;
  
  beforeEach(async () => {
    users = mockRepo(); trials = mockRepo(); workspaces = mockRepo(); members = mockRepo(); subs = mockRepo();
    const mod = await Test.createTestingModule({
      providers: [
        EffectiveAccessResolver,
        { provide: getRepositoryToken(User), useValue: users },
        { provide: getRepositoryToken(UserTrial), useValue: trials },
        { provide: getRepositoryToken(Workspace), useValue: workspaces },
        { provide: getRepositoryToken(WorkspaceMember), useValue: members },
        { provide: getRepositoryToken(Subscription), useValue: subs },
      ],
    }).compile();
    svc = mod.get(EffectiveAccessResolver);
  });

  it('free user → free effective plan', async () => {
    users.findOne.mockResolvedValue({
      id: 'u1', plan: 'free', billingStatus: 'free',
      billingSource: null, billingPeriod: null, cancelAtPeriodEnd: false,
      currentPeriodStart: null, currentPeriodEnd: null,
      gracePeriodEnd: null, gracePeriodReason: null, billingIssueAt: null,
      downgradedAt: null, aiRequestsUsed: 0, proInviteeEmail: null,
    });
    const r = await svc.resolve('u1');
    expect(r.effective.plan).toBe('free');
    expect(r.effective.source).toBe('free');
    expect(r.flags.trialEligible).toBe(true);
  });
  
  it('active pro own plan', async () => {
    users.findOne.mockResolvedValue({
      id: 'u1', plan: 'pro', billingStatus: 'active',
      billingSource: 'revenuecat', billingPeriod: 'monthly', cancelAtPeriodEnd: false,
      currentPeriodStart: new Date('2026-04-01'),
      currentPeriodEnd: new Date('2026-05-01'),
      gracePeriodEnd: null, gracePeriodReason: null, billingIssueAt: null,
      downgradedAt: null, aiRequestsUsed: 0, proInviteeEmail: null,
    });
    const r = await svc.resolve('u1');
    expect(r.effective.plan).toBe('pro');
    expect(r.effective.source).toBe('own');
    expect(r.banner.priority).toBe('annual_upgrade');
  });
  
  it('grace_pro → pro via grace', async () => {
    users.findOne.mockResolvedValue({
      id: 'u1', plan: 'free', billingStatus: 'grace_pro',
      billingSource: null, billingPeriod: null, cancelAtPeriodEnd: false,
      currentPeriodStart: null, currentPeriodEnd: null,
      gracePeriodEnd: new Date(Date.now() + 3 * 86400_000),
      gracePeriodReason: 'pro_expired', billingIssueAt: null,
      downgradedAt: null, aiRequestsUsed: 0, proInviteeEmail: null,
    });
    const r = await svc.resolve('u1');
    expect(r.effective.plan).toBe('pro');
    expect(r.effective.source).toBe('grace_pro');
    expect(r.dates.graceDaysLeft).toBe(3);
    expect(r.banner.priority).toBe('grace');
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npx jest src/billing/effective-access/__tests__/effective-access.service.spec.ts
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/billing/effective-access/
git commit -m "feat(billing): EffectiveAccessResolver with table-driven tests"
```

---

### Task 4.4: Effective access module + wiring in BillingModule

**Files:**
- Create: `src/billing/effective-access/effective-access.module.ts`

- [ ] **Step 1: Write module**

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../users/entities/user.entity';
import { UserTrial } from '../trials/entities/user-trial.entity';
import { Workspace } from '../../workspace/entities/workspace.entity';
import { WorkspaceMember } from '../../workspace/entities/workspace-member.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';
import { EffectiveAccessResolver } from './effective-access.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserTrial, Workspace, WorkspaceMember, Subscription])],
  providers: [EffectiveAccessResolver],
  exports: [EffectiveAccessResolver],
})
export class EffectiveAccessModule {}
```

- [ ] **Step 2: Add EffectiveAccessModule to BillingModule imports**

Edit `src/billing/billing.module.ts` to import `EffectiveAccessModule`.

- [ ] **Step 3: Commit**

```bash
git add src/billing/effective-access/ src/billing/billing.module.ts
git commit -m "feat(billing): wire EffectiveAccessModule"
```

---

## Phase 5: RC API client + reconciliation

### Task 5.1: RC API client

**Files:**
- Create: `src/billing/revenuecat/rc-client.service.ts`
- Create: `src/billing/revenuecat/rc-client.module.ts`
- Create: `src/billing/revenuecat/__tests__/rc-client.service.spec.ts`

- [ ] **Step 1: Install axios-retry if missing**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend
npm ls axios-retry 2>&1 | head -3
```
If not present:
```bash
npm install axios-retry
```

- [ ] **Step 2: Write test**

```ts
import axios from 'axios';
import { RevenueCatClient } from '../rc-client.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('RevenueCatClient.getSubscriber', () => {
  let client: RevenueCatClient;
  beforeEach(() => {
    mockedAxios.create.mockReturnValue({
      get: jest.fn(async () => ({ data: { subscriber: {
        entitlements: { pro: { expires_date: '2026-05-01T00:00:00Z', product_identifier: 'io.subradar.mobile.pro.monthly' } },
        original_purchase_date: '2026-04-01T00:00:00Z',
      } } })),
    } as any);
    client = new RevenueCatClient({ get: () => 'fake-key' } as any);
  });
  
  it('returns normalized RCSubscriberSnapshot', async () => {
    const sub = await client.getSubscriber('user-1');
    expect(sub.entitlements.pro).toBeDefined();
    expect(sub.entitlements.pro.expiresAt).toBeInstanceOf(Date);
    expect(sub.entitlements.pro.productId).toBe('io.subradar.mobile.pro.monthly');
  });
});
```

- [ ] **Step 3: Implement**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import { RCSubscriberSnapshot } from '../state-machine/types';

@Injectable()
export class RevenueCatClient {
  private readonly logger = new Logger(RevenueCatClient.name);
  private http: AxiosInstance;
  private failureTimestamps: number[] = [];
  
  constructor(cfg: ConfigService) {
    const apiKey = cfg.get<string>('REVENUECAT_API_KEY');
    if (!apiKey) {
      this.logger.warn('REVENUECAT_API_KEY not set — RC client will fail on all calls');
    }
    this.http = axios.create({
      baseURL: 'https://api.revenuecat.com/v1',
      headers: { Authorization: `Bearer ${apiKey ?? ''}` },
      timeout: 10_000,
    });
    axiosRetry(this.http, {
      retries: 3,
      retryDelay: (n) => 500 * Math.pow(2, n),
      retryCondition: (e) => !!e.response && e.response.status >= 500,
    });
  }
  
  private checkCircuit(): void {
    const now = Date.now();
    this.failureTimestamps = this.failureTimestamps.filter(t => now - t < 60_000);
    if (this.failureTimestamps.length >= 10) {
      throw new Error('RC circuit breaker open: too many failures in the last minute');
    }
  }
  
  async getSubscriber(appUserId: string): Promise<RCSubscriberSnapshot> {
    this.checkCircuit();
    try {
      const { data } = await this.http.get(`/subscribers/${encodeURIComponent(appUserId)}`);
      return this.normalize(data.subscriber);
    } catch (err) {
      this.failureTimestamps.push(Date.now());
      throw err;
    }
  }
  
  private normalize(raw: any): RCSubscriberSnapshot {
    const entitlements: RCSubscriberSnapshot['entitlements'] = {};
    let latestExp = 0;
    for (const [key, val] of Object.entries(raw?.entitlements ?? {})) {
      const v = val as any;
      const exp = v.expires_date ? new Date(v.expires_date) : null;
      entitlements[key] = { expiresAt: exp, productId: v.product_identifier ?? '' };
      if (exp) latestExp = Math.max(latestExp, exp.getTime());
    }
    const activeSub = raw?.subscriptions ? Object.values(raw.subscriptions).find((s: any) => s.unsubscribe_detected_at) : null;
    return {
      entitlements,
      latestExpirationMs: latestExp || null,
      cancelAtPeriodEnd: !!activeSub,
      billingIssueDetectedAt: raw?.billing_issues_detected_at ? new Date(raw.billing_issues_detected_at) : null,
    };
  }
}
```

- [ ] **Step 4: Module**

```ts
// rc-client.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RevenueCatClient } from './rc-client.service';

@Module({
  imports: [ConfigModule],
  providers: [RevenueCatClient],
  exports: [RevenueCatClient],
})
export class RevenueCatClientModule {}
```

- [ ] **Step 5: Run tests**

```bash
npx jest src/billing/revenuecat/__tests__/rc-client.service.spec.ts
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/billing/revenuecat/
git commit -m "feat(billing): RevenueCat API client with retry + circuit breaker"
```

---

### Task 5.2: ReconciliationService

**Files:**
- Create: `src/billing/reconciliation/reconciliation.service.ts`
- Create: `src/billing/reconciliation/__tests__/reconciliation.service.spec.ts`

- [ ] **Step 1: Implement**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { RevenueCatClient } from '../revenuecat/rc-client.service';
import { reconcile, UserBillingSnapshot } from '../state-machine';
import { AuditService } from '../../audit/audit.service';
import { OutboxService } from '../outbox/outbox.service';

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);
  
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly rc: RevenueCatClient,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}
  
  async findSuspicious(limit: number): Promise<User[]> {
    return this.users.query(`
      SELECT u.* FROM users u
      WHERE u.billing_source = 'revenuecat'
        AND (
          (u.current_period_end IS NOT NULL 
           AND u.current_period_end < now() - interval '10 minutes'
           AND u.billing_status NOT IN ('grace_pro','grace_team','free'))
          OR u.id IN (
            SELECT DISTINCT user_id FROM webhook_events
            WHERE provider = 'revenuecat' 
              AND processed_at > now() - interval '24 hours'
              AND error IS NOT NULL
              AND user_id IS NOT NULL
          )
        )
      ORDER BY u.current_period_end ASC NULLS LAST
      LIMIT $1
    `, [limit]);
  }
  
  snapshotFromUser(u: User): UserBillingSnapshot {
    return {
      userId: u.id,
      plan: u.plan as any,
      state: u.billingStatus as any,
      billingSource: u.billingSource as any,
      billingPeriod: (u.billingPeriod as any) ?? null,
      currentPeriodStart: u.currentPeriodStart,
      currentPeriodEnd: u.currentPeriodEnd,
      cancelAtPeriodEnd: u.cancelAtPeriodEnd,
      graceExpiresAt: u.gracePeriodEnd,
      graceReason: (u.gracePeriodReason as any) ?? null,
      billingIssueAt: u.billingIssueAt,
    };
  }
  
  async reconcileOne(user: User, dryRun: boolean): Promise<boolean> {
    const rcSub = await this.rc.getSubscriber(user.id);
    const current = this.snapshotFromUser(user);
    const next = reconcile(current, rcSub);
    if (JSON.stringify(current) === JSON.stringify(next)) return false;
    
    if (dryRun) {
      this.logger.log(`[DRY_RUN] Would reconcile user ${user.id}: ${current.state} → ${next.state}`);
    } else {
      await this.users.update(user.id, {
        plan: next.plan,
        billingStatus: next.state,
        billingSource: next.billingSource,
        billingPeriod: next.billingPeriod,
        currentPeriodStart: next.currentPeriodStart,
        currentPeriodEnd: next.currentPeriodEnd,
        cancelAtPeriodEnd: next.cancelAtPeriodEnd,
        gracePeriodEnd: next.graceExpiresAt,
        gracePeriodReason: next.graceReason,
        billingIssueAt: next.billingIssueAt,
      });
      await this.audit.log({
        userId: user.id,
        action: 'billing.reconciliation_fix',
        resourceType: 'user',
        resourceId: user.id,
        metadata: { from: current.state, to: next.state },
      });
      await this.outbox.enqueue('amplitude.track', {
        event: 'billing.reconciliation_mismatch',
        userId: user.id,
        properties: { from: current.state, to: next.state },
      });
      await this.outbox.enqueue('telegram.alert', {
        text: `[reconciliation] user=${user.id.slice(0,8)} ${current.state} → ${next.state}`,
      });
    }
    return true;
  }
}
```

- [ ] **Step 2: Test (unit)**

```ts
import { ReconciliationService } from '../reconciliation.service';

describe('ReconciliationService.reconcileOne', () => {
  it('no-op when states match', async () => {
    const svc = new ReconciliationService(
      { update: jest.fn() } as any,
      { getSubscriber: jest.fn().mockResolvedValue({
        entitlements: { pro: { expiresAt: new Date(Date.now()+86400_000), productId: 'x' } },
        latestExpirationMs: Date.now()+86400_000,
        cancelAtPeriodEnd: false, billingIssueDetectedAt: null,
      })} as any,
      { log: jest.fn() } as any,
      { enqueue: jest.fn() } as any,
    );
    const user: any = {
      id: 'u1', plan: 'pro', billingStatus: 'active', billingSource: 'revenuecat',
      billingPeriod: 'monthly',
      currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now()+86400_000),
      cancelAtPeriodEnd: false, gracePeriodEnd: null, gracePeriodReason: null, billingIssueAt: null,
    };
    const changed = await svc.reconcileOne(user, false);
    expect(changed).toBe(false);
  });
});
```

- [ ] **Step 3: Run**

```bash
npx jest src/billing/reconciliation/__tests__/reconciliation.service.spec.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/billing/reconciliation/
git commit -m "feat(billing): ReconciliationService"
```

---

### Task 5.3: ReconciliationCron

**Files:**
- Create: `src/billing/reconciliation/reconciliation.cron.ts`

- [ ] **Step 1: Implement**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ReconciliationService } from './reconciliation.service';

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

@Injectable()
export class ReconciliationCron {
  private readonly logger = new Logger(ReconciliationCron.name);
  
  constructor(
    private readonly svc: ReconciliationService,
    private readonly cfg: ConfigService,
  ) {}
  
  @Cron('0 * * * *')  // hourly
  async run(): Promise<void> {
    const enabled = this.cfg.get<string>('BILLING_RECONCILIATION_ENABLED') === 'true';
    const dryRun = this.cfg.get<string>('BILLING_RECONCILIATION_DRY_RUN') === 'true';
    if (!enabled && !dryRun) {
      this.logger.debug('Reconciliation disabled');
      return;
    }
    const suspicious = await this.svc.findSuspicious(200);
    this.logger.log(`Reconciliation: found ${suspicious.length} candidates (dryRun=${dryRun})`);
    let changed = 0;
    for (const user of suspicious) {
      try {
        const did = await this.svc.reconcileOne(user, dryRun);
        if (did) changed++;
        await sleep(300);
      } catch (err: any) {
        this.logger.error(`Reconcile failed for ${user.id}: ${err?.message ?? err}`);
      }
    }
    this.logger.log(`Reconciliation: ${changed} users ${dryRun ? 'would be' : 'were'} changed`);
  }
}
```

- [ ] **Step 2: Module**

Create `src/billing/reconciliation/reconciliation.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../users/entities/user.entity';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationCron } from './reconciliation.cron';
import { RevenueCatClientModule } from '../revenuecat/rc-client.module';
import { AuditModule } from '../../audit/audit.module';
import { OutboxModule } from '../outbox/outbox.module';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([User]), RevenueCatClientModule, AuditModule, OutboxModule],
  providers: [ReconciliationService, ReconciliationCron],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
```

- [ ] **Step 3: Add to BillingModule imports**

- [ ] **Step 4: Commit**

```bash
git add src/billing/reconciliation/ src/billing/billing.module.ts
git commit -m "feat(billing): reconciliation cron with dry-run + feature flag"
```

---

## Phase 6: Trial system

### Task 6.1: TrialsService

**Files:**
- Create: `src/billing/trials/trials.service.ts`
- Create: `src/billing/trials/__tests__/trials.service.spec.ts`

- [ ] **Step 1: Write service**

```ts
import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { UserTrial, TrialSource, TrialPlan } from './entities/user-trial.entity';
import { User } from '../../users/entities/user.entity';
import { AuditService } from '../../audit/audit.service';
import { OutboxService } from '../outbox/outbox.service';

const TRIAL_DURATION_DAYS = 7;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400_000);
}

@Injectable()
export class TrialsService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @InjectRepository(UserTrial) private readonly trialRepo: Repository<UserTrial>,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}
  
  async activate(userId: string, source: TrialSource, plan: TrialPlan, originalTxId?: string): Promise<UserTrial> {
    return this.ds.transaction(async (m) => {
      const existing = await m.findOne(UserTrial, { where: { userId }, lock: { mode: 'pessimistic_write' } });
      if (existing) throw new ConflictException('Trial already used');
      
      const user = await m.findOne(User, { where: { id: userId } });
      if (!user) throw new BadRequestException('User not found');
      if (source === 'backend' && user.plan !== 'free') {
        throw new BadRequestException('Already on paid plan');
      }
      
      const trial = m.create(UserTrial, {
        userId, source, plan,
        startedAt: new Date(),
        endsAt: addDays(new Date(), TRIAL_DURATION_DAYS),
        consumed: true,
        originalTransactionId: originalTxId ?? null,
      });
      const saved = await m.save(trial);
      await this.audit.log({
        userId, action: 'billing.trial_activated',
        resourceType: 'user_trial', resourceId: saved.id,
        metadata: { source, plan },
      });
      await this.outbox.enqueue('amplitude.track', {
        event: 'billing.trial_started',
        userId, properties: { source, plan },
      }, m);
      return saved;
    });
  }
  
  async status(userId: string): Promise<UserTrial | null> {
    return this.trialRepo.findOne({ where: { userId } });
  }
}
```

- [ ] **Step 2: Test**

```ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { TrialsService } from '../trials.service';
import { UserTrial } from '../entities/user-trial.entity';

describe('TrialsService.activate', () => {
  let svc: TrialsService;
  let ds: any;
  
  beforeEach(async () => {
    const manager = {
      findOne: jest.fn(),
      create: jest.fn((_e, x) => x),
      save: jest.fn(async (x) => ({ ...x, id: 'trial-1' })),
    };
    ds = { transaction: jest.fn(async (cb) => cb(manager)) };
    ds.manager = manager;
    const mod = await Test.createTestingModule({
      providers: [
        TrialsService,
        { provide: getDataSourceToken(), useValue: ds },
        { provide: getRepositoryToken(UserTrial), useValue: { findOne: jest.fn() } },
        { provide: 'AuditService', useValue: { log: jest.fn() } },
        { provide: 'OutboxService', useValue: { enqueue: jest.fn() } },
      ],
    })
      .overrideProvider(require('../../../audit/audit.service').AuditService).useValue({ log: jest.fn() })
      .overrideProvider(require('../../outbox/outbox.service').OutboxService).useValue({ enqueue: jest.fn() })
      .compile();
    svc = mod.get(TrialsService);
  });
  
  it('throws ConflictException when trial exists', async () => {
    ds.manager.findOne
      .mockResolvedValueOnce({ id: 'existing' });  // UserTrial
    await expect(svc.activate('u1', 'backend', 'pro')).rejects.toThrow('Trial already used');
  });
  
  it('activates when no existing trial', async () => {
    ds.manager.findOne
      .mockResolvedValueOnce(null)  // UserTrial
      .mockResolvedValueOnce({ id: 'u1', plan: 'free' });  // User
    const t = await svc.activate('u1', 'backend', 'pro');
    expect(t.id).toBe('trial-1');
    expect(t.source).toBe('backend');
  });
});
```

- [ ] **Step 3: Run**

```bash
npx jest src/billing/trials/__tests__/trials.service.spec.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/billing/trials/
git commit -m "feat(billing): TrialsService with transaction lock"
```

---

### Task 6.2: Trials module wiring

**Files:**
- Create: `src/billing/trials/trials.module.ts`

- [ ] **Step 1: Write module**

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserTrial } from './entities/user-trial.entity';
import { TrialsService } from './trials.service';
import { AuditModule } from '../../audit/audit.module';
import { OutboxModule } from '../outbox/outbox.module';

@Module({
  imports: [TypeOrmModule.forFeature([UserTrial]), AuditModule, OutboxModule],
  providers: [TrialsService],
  exports: [TrialsService],
})
export class TrialsModule {}
```

Add `TrialsModule` to `BillingModule` imports.

- [ ] **Step 2: Commit**

```bash
git add src/billing/trials/ src/billing/billing.module.ts
git commit -m "feat(billing): wire TrialsModule"
```

---

## Phase 7: Webhook handlers rewrite

### Task 7.1: RC webhook handler on state machine

**Files:**
- Modify: `src/billing/billing.service.ts` (method `processRevenueCatWebhook` or equivalent)

- [ ] **Step 1: Read current RC webhook handler**

```bash
grep -n "RC_\|revenuecat-webhook\|processRevenueCat" src/billing/billing.service.ts
```

- [ ] **Step 2: Extract mapping function** — create `src/billing/revenuecat/event-mapper.ts`:

```ts
import { BillingEvent } from '../state-machine/types';

interface RCRawEvent {
  type: string;
  product_id?: string;
  period_type?: string;
  expiration_at_ms?: number;
  purchased_at_ms?: number;
  app_user_id: string;
  id?: string;
}

const PRODUCT_TO_PLAN: Record<string, 'pro'|'organization'> = {
  'io.subradar.mobile.pro.monthly': 'pro',
  'io.subradar.mobile.pro.yearly': 'pro',
  'io.subradar.mobile.team.monthly': 'organization',
  'io.subradar.mobile.team.yearly': 'organization',
};

const PRODUCT_TO_PERIOD: Record<string, 'monthly'|'yearly'> = {
  'io.subradar.mobile.pro.monthly': 'monthly',
  'io.subradar.mobile.pro.yearly': 'yearly',
  'io.subradar.mobile.team.monthly': 'monthly',
  'io.subradar.mobile.team.yearly': 'yearly',
};

export function mapRCEventToBillingEvent(e: RCRawEvent): BillingEvent | null {
  const plan = e.product_id ? PRODUCT_TO_PLAN[e.product_id] : undefined;
  const period = e.product_id ? PRODUCT_TO_PERIOD[e.product_id] : undefined;
  const periodStart = e.purchased_at_ms ? new Date(e.purchased_at_ms) : new Date();
  const periodEnd = e.expiration_at_ms ? new Date(e.expiration_at_ms) : new Date();
  
  switch (e.type) {
    case 'INITIAL_PURCHASE':
      return plan && period ? { type: 'RC_INITIAL_PURCHASE', plan, period, periodStart, periodEnd } : null;
    case 'RENEWAL':
    case 'NON_RENEWING_PURCHASE':
      return { type: 'RC_RENEWAL', periodStart, periodEnd };
    case 'PRODUCT_CHANGE':
      return plan && period ? { type: 'RC_PRODUCT_CHANGE', newPlan: plan, period, periodStart, periodEnd } : null;
    case 'CANCELLATION':
      return { type: 'RC_CANCELLATION', periodEnd };
    case 'UNCANCELLATION':
      return { type: 'RC_UNCANCELLATION' };
    case 'EXPIRATION':
      return { type: 'RC_EXPIRATION' };
    case 'BILLING_ISSUE':
      return { type: 'RC_BILLING_ISSUE' };
    default:
      return null;
  }
}
```

- [ ] **Step 3: Replace RC handler body in BillingService**

Find `processRevenueCatEvent` (or equivalent) and replace core logic:

```ts
async processRevenueCatEvent(event: RCRawEvent): Promise<void> {
  const user = await this.usersService.findById(event.app_user_id);
  if (!user) {
    this.logger.warn(`RC webhook for unknown user ${event.app_user_id}`);
    return;
  }
  
  const billingEvent = mapRCEventToBillingEvent(event);
  if (!billingEvent) {
    this.logger.log(`RC event ${event.type} skipped (no mapping)`);
    return;
  }
  
  await this.dataSource.transaction(async (m) => {
    const current = this.snapshotFromUser(user);
    const next = transition(current, billingEvent);
    await this.applySnapshot(m, user, next);
    
    // Handle trial activation from RC intro
    if (event.period_type === 'TRIAL' || event.period_type === 'INTRO') {
      const plan = PRODUCT_TO_PLAN[event.product_id ?? ''];
      if (plan && event.type === 'INITIAL_PURCHASE') {
        try {
          await this.trialsService.activate(user.id, 'revenuecat_intro', plan);
        } catch (err) {
          this.logger.log(`RC trial already recorded for ${user.id}: ${(err as Error).message}`);
        }
      }
    }
    
    await this.audit.log({
      userId: user.id,
      action: 'billing.webhook.state_transition',
      resourceType: 'user',
      resourceId: user.id,
      metadata: {
        provider: 'revenuecat', event: event.type,
        from: current.state, to: next.state,
        productId: event.product_id,
      },
    });
    
    if (next.state !== current.state || next.plan !== current.plan) {
      await this.outbox.enqueue('amplitude.track', {
        event: this.amplitudeEventForRC(event.type, next),
        userId: user.id,
        properties: { planBefore: current.plan, planAfter: next.plan, source: 'revenuecat' },
      }, m);
    }
    
    // Handle team owner expiration side-effect
    if (billingEvent.type === 'RC_EXPIRATION' && user.plan === 'organization') {
      await this.handleTeamOwnerExpiration(m, user);
    }
  });
  
  await this.invalidateBillingCache(user.id);
}

private snapshotFromUser(u: User): UserBillingSnapshot {
  return {
    userId: u.id, plan: u.plan as any, state: u.billingStatus as any,
    billingSource: u.billingSource as any, billingPeriod: (u.billingPeriod as any) ?? null,
    currentPeriodStart: u.currentPeriodStart, currentPeriodEnd: u.currentPeriodEnd,
    cancelAtPeriodEnd: u.cancelAtPeriodEnd,
    graceExpiresAt: u.gracePeriodEnd, graceReason: (u.gracePeriodReason as any) ?? null,
    billingIssueAt: u.billingIssueAt,
  };
}

private async applySnapshot(m: EntityManager, user: User, next: UserBillingSnapshot): Promise<void> {
  await m.update(User, user.id, {
    plan: next.plan, billingStatus: next.state,
    billingSource: next.billingSource, billingPeriod: next.billingPeriod,
    currentPeriodStart: next.currentPeriodStart, currentPeriodEnd: next.currentPeriodEnd,
    cancelAtPeriodEnd: next.cancelAtPeriodEnd,
    gracePeriodEnd: next.graceExpiresAt, gracePeriodReason: next.graceReason,
    billingIssueAt: next.billingIssueAt,
  });
}

private amplitudeEventForRC(rcType: string, nextSnap: UserBillingSnapshot): string {
  const map: Record<string, string> = {
    'INITIAL_PURCHASE': 'billing.subscription_purchased',
    'RENEWAL': 'billing.subscription_renewed',
    'PRODUCT_CHANGE': 'billing.product_changed',
    'CANCELLATION': 'billing.subscription_cancelled',
    'EXPIRATION': 'billing.subscription_expired',
    'BILLING_ISSUE': 'billing.billing_issue_started',
  };
  return map[rcType] ?? 'billing.event';
}
```

- [ ] **Step 4: Update handleTeamOwnerExpiration**

Rewrite to use state machine:
```ts
private async handleTeamOwnerExpiration(m: EntityManager, owner: User): Promise<void> {
  const workspace = await m.findOne(Workspace, { where: { ownerId: owner.id } });
  if (!workspace) return;
  const members = await m.find(WorkspaceMember, { where: { workspaceId: workspace.id, status: 'ACTIVE' as any } });
  for (const member of members) {
    if (member.userId === owner.id) continue;
    const u = await m.findOne(User, { where: { id: member.userId } });
    if (!u) continue;
    const snap = this.snapshotFromUser(u);
    const next = transition(snap, { type: 'TEAM_OWNER_EXPIRED', memberHasOwnSub: snap.billingSource === 'revenuecat' && snap.state === 'active' });
    await this.applySnapshot(m, u, next);
  }
  workspace.expiredAt = new Date();
  await m.save(workspace);
}
```

- [ ] **Step 5: Inject deps**

Add `OutboxService`, `TrialsService`, `DataSource` to BillingService constructor if not already injected.

- [ ] **Step 6: Run existing billing.service.spec.ts and fix broken tests**

```bash
npx jest src/billing/billing.service.spec.ts
```
Update any tests that expected direct plan mutation — they should now work through state machine.

- [ ] **Step 7: Commit**

```bash
git add src/billing/
git commit -m "refactor(billing): RC webhook handler through state machine + outbox"
```

---

### Task 7.2: LS webhook handler on state machine

**Files:**
- Modify: `src/billing/billing.service.ts` (LS webhook section)
- Create: `src/billing/lemon-squeezy/event-mapper.ts`

- [ ] **Step 1: Locate LS handler**

```bash
grep -n "LEMON\|lemon_squeezy\|subscription_created\|subscription_updated" src/billing/billing.service.ts
```

- [ ] **Step 2: Create LS mapper**

```ts
import { BillingEvent } from '../state-machine/types';

const VARIANT_TO_PLAN: Record<string, 'pro'|'organization'> = {
  // Populate from actual config / existing code
  // Grep: LEMON_SQUEEZY_VARIANT_PRO_MONTHLY etc.
};

export function mapLSEventToBillingEvent(name: string, data: any): BillingEvent | null {
  const variantId = String(data?.attributes?.variant_id ?? '');
  const plan = VARIANT_TO_PLAN[variantId];
  const period = /yearly/i.test(data?.attributes?.variant_name ?? '') ? 'yearly' : 'monthly';
  const periodEnd = data?.attributes?.renews_at ? new Date(data.attributes.renews_at) : new Date();
  
  switch (name) {
    case 'subscription_created':
      return plan ? { type: 'LS_SUBSCRIPTION_CREATED', plan, period, periodEnd } : null;
    case 'subscription_updated':
      return plan ? { type: 'LS_SUBSCRIPTION_UPDATED', plan, period, periodEnd } : null;
    case 'subscription_cancelled':
      return { type: 'LS_SUBSCRIPTION_CANCELLED' };
    default:
      return null;
  }
}
```

Fill `VARIANT_TO_PLAN` from existing code (grep for variant IDs).

- [ ] **Step 3: Replace LS handler body**

Analogous to Task 7.1 — find current LS event processor, replace with `transition()` + `applySnapshot()` + outbox enqueue.

- [ ] **Step 4: Commit**

```bash
git add src/billing/
git commit -m "refactor(billing): LS webhook handler through state machine"
```

---

### Task 7.3: Webhook controller enrichment

**Files:**
- Modify: `src/billing/billing.controller.ts`

- [ ] **Step 1: After successful verify + claim, write user_id + event_type + error to webhook_events**

Update both webhook handlers:

```ts
@Post('revenuecat-webhook')
async handleRC(@Headers('authorization') auth: string, @Body() body: any) {
  this.verifyRCAuth(auth);
  const eventId = body?.event?.id ?? `${body?.event?.type}:${body?.event?.app_user_id}:${body?.event?.event_timestamp_ms}`;
  const claimed = await this.billingService.claimWebhookEvent('revenuecat', eventId);
  if (!claimed) return { ok: true, duplicate: true };
  
  const userId = body?.event?.app_user_id ?? null;
  const eventType = body?.event?.type ?? null;
  
  try {
    await this.billingService.processRevenueCatEvent(body.event);
    await this.billingService.updateWebhookEventMeta('revenuecat', eventId, userId, eventType, null);
    return { ok: true };
  } catch (err: any) {
    await this.billingService.updateWebhookEventMeta('revenuecat', eventId, userId, eventType, err.message);
    await this.billingService.rollbackWebhookClaim('revenuecat', eventId);
    throw err;
  }
}
```

- [ ] **Step 2: Add `updateWebhookEventMeta` to BillingService**

```ts
async updateWebhookEventMeta(provider: string, eventId: string, userId: string | null, eventType: string | null, error: string | null): Promise<void> {
  await this.webhookEventRepo.update({ provider, eventId }, { userId, eventType, error });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/billing/
git commit -m "feat(billing): enrich webhook_events with user_id, event_type, error"
```

---

## Phase 8: Security

### Task 8.1: PlanGuard + decorator

**Files:**
- Create: `src/common/decorators/require-plan-capability.decorator.ts`
- Create: `src/common/guards/plan.guard.ts`
- Create: `src/common/guards/__tests__/plan.guard.spec.ts`

- [ ] **Step 1: Decorator**

```ts
import { SetMetadata } from '@nestjs/common';
export const PLAN_CAP_KEY = 'plan_capability';
export type PlanCapability = 'canCreateOrg' | 'canInvite' | 'unlimitedSubs';
export const RequirePlanCapability = (cap: PlanCapability) => SetMetadata(PLAN_CAP_KEY, cap);
```

- [ ] **Step 2: Guard**

```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EffectiveAccessResolver } from '../../billing/effective-access/effective-access.service';
import { PLAN_CAP_KEY, PlanCapability } from '../decorators/require-plan-capability.decorator';

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly effective: EffectiveAccessResolver,
  ) {}
  
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const cap = this.reflector.get<PlanCapability>(PLAN_CAP_KEY, ctx.getHandler());
    if (!cap) return true;
    const req = ctx.switchToHttp().getRequest();
    if (!req.user?.id) throw new ForbiddenException('No user context');
    const access = await this.effective.resolve(req.user.id);
    if (cap === 'canCreateOrg' && !access.limits.canCreateOrg) {
      throw new ForbiddenException('This action requires Organization plan');
    }
    if (cap === 'canInvite' && !access.limits.canInvite) {
      throw new ForbiddenException('This action requires Pro or Organization plan');
    }
    return true;
  }
}
```

- [ ] **Step 3: Test**

```ts
import { PlanGuard } from '../plan.guard';
import { Reflector } from '@nestjs/core';

describe('PlanGuard', () => {
  it('allows when no capability required', async () => {
    const refl = { get: jest.fn().mockReturnValue(undefined) } as any as Reflector;
    const eff = {} as any;
    const guard = new PlanGuard(refl, eff);
    const ctx: any = { getHandler: () => {}, switchToHttp: () => ({ getRequest: () => ({ user: { id: 'u1' } }) }) };
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
  
  it('throws when user lacks canCreateOrg', async () => {
    const refl = { get: jest.fn().mockReturnValue('canCreateOrg') } as any as Reflector;
    const eff = { resolve: jest.fn().mockResolvedValue({ limits: { canCreateOrg: false } }) } as any;
    const guard = new PlanGuard(refl, eff);
    const ctx: any = { getHandler: () => {}, switchToHttp: () => ({ getRequest: () => ({ user: { id: 'u1' } }) }) };
    await expect(guard.canActivate(ctx)).rejects.toThrow('Organization plan');
  });
  
  it('allows when user has canCreateOrg', async () => {
    const refl = { get: jest.fn().mockReturnValue('canCreateOrg') } as any as Reflector;
    const eff = { resolve: jest.fn().mockResolvedValue({ limits: { canCreateOrg: true } }) } as any;
    const guard = new PlanGuard(refl, eff);
    const ctx: any = { getHandler: () => {}, switchToHttp: () => ({ getRequest: () => ({ user: { id: 'u1' } }) }) };
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});
```

- [ ] **Step 4: Module registration** — since Guard uses EffectiveAccessResolver, export PlanGuard through a `CommonGuardsModule` that imports `EffectiveAccessModule`:

```ts
// src/common/guards/guards.module.ts
import { Module } from '@nestjs/common';
import { EffectiveAccessModule } from '../../billing/effective-access/effective-access.module';
import { PlanGuard } from './plan.guard';

@Module({
  imports: [EffectiveAccessModule],
  providers: [PlanGuard],
  exports: [PlanGuard],
})
export class GuardsModule {}
```

- [ ] **Step 5: Run test**

```bash
npx jest src/common/guards/__tests__/plan.guard.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/common/
git commit -m "feat(common): PlanGuard with RequirePlanCapability decorator"
```

---

### Task 8.2: Apply PlanGuard to workspace controller

**Files:**
- Modify: `src/workspace/workspace.controller.ts`
- Modify: `src/workspace/workspace.module.ts`

- [ ] **Step 1: Add GuardsModule import in WorkspaceModule**

```ts
import { GuardsModule } from '../common/guards/guards.module';
// in imports: [..., GuardsModule]
```

- [ ] **Step 2: Protect endpoints**

```ts
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlanGuard } from '../common/guards/plan.guard';
import { RequirePlanCapability } from '../common/decorators/require-plan-capability.decorator';

@Post()
@UseGuards(JwtAuthGuard, PlanGuard)
@RequirePlanCapability('canCreateOrg')
async create(@Request() req, @Body() dto: CreateWorkspaceDto) {
  return this.service.create(req.user.id, dto);
}
```

Apply similarly to `POST /workspace/:id/invite` and any other mutating workspace endpoints that require paid plan.

- [ ] **Step 3: E2E smoke test (manual)**

```bash
curl -X POST -H "Authorization: Bearer $FREE_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"test"}' \
  http://localhost:3000/api/v1/workspace
```
Expected: `403 Forbidden — Organization plan required`.

- [ ] **Step 4: Commit**

```bash
git add src/workspace/
git commit -m "feat(workspace): gate create + invite behind canCreateOrg capability"
```

---

### Task 8.3: Rate limiting billing endpoints

**Files:**
- Modify: `src/billing/billing.module.ts`
- Modify: `src/billing/billing.controller.ts`

- [ ] **Step 1: Verify Redis connection exists**

```bash
grep -rn "REDIS_URL\|redis" src/ --include="*.ts" | head -10
```
If Redis client is already used elsewhere, reuse. Otherwise use in-memory Throttler storage (acceptable for single-instance).

- [ ] **Step 2: Register ThrottlerModule**

```ts
// billing.module.ts
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 20 }],
    }),
    // ...
  ],
})
```

- [ ] **Step 3: Apply Throttle to endpoints**

```ts
import { Throttle } from '@nestjs/throttler';

@Throttle({ default: { limit: 5, ttl: 60_000 } })
@UseGuards(JwtAuthGuard)
@Post('checkout') async checkout(...) {...}

@Throttle({ default: { limit: 10, ttl: 60_000 } })
@UseGuards(JwtAuthGuard)
@Post('sync-revenuecat') async sync(...) {...}

@Throttle({ default: { limit: 3, ttl: 60_000 } })
@UseGuards(JwtAuthGuard)
@Post('cancel') async cancel(...) {...}

@Throttle({ default: { limit: 5, ttl: 60_000 } })
@UseGuards(JwtAuthGuard)
@Post('invite') async invite(...) {...}

@Throttle({ default: { limit: 1, ttl: 60_000 } })
@UseGuards(JwtAuthGuard)
@Post('trial') async trial(...) {...}
```

Webhook endpoints — **no throttle** (RC/LS may burst retries).

- [ ] **Step 4: Register ThrottlerGuard globally for billing**

In `billing.module.ts`:
```ts
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

providers: [
  { provide: APP_GUARD, useClass: ThrottlerGuard },
  // ...
]
```
If there's already a global guard set elsewhere, apply at controller level with `@UseGuards(ThrottlerGuard)` instead.

- [ ] **Step 5: Commit**

```bash
git add src/billing/
git commit -m "feat(billing): rate limit checkout/sync/cancel/invite/trial"
```

---

### Task 8.4: Pro Invite transaction rewrite

**Files:**
- Modify: `src/billing/billing.service.ts`

- [ ] **Step 1: Locate `activateProInvite`**

```bash
grep -n "activateProInvite\|proInviteeEmail" src/billing/billing.service.ts
```

- [ ] **Step 2: Rewrite with transaction + lock**

```ts
async activateProInvite(ownerId: string, inviteeEmail: string): Promise<void> {
  await this.dataSource.transaction(async (m) => {
    const owner = await m.findOne(User, {
      where: { id: ownerId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!owner) throw new NotFoundException('Owner not found');
    if (!['pro','organization'].includes(owner.plan)) {
      throw new ForbiddenException('Only Pro/Team users can invite');
    }
    if (owner.cancelAtPeriodEnd) {
      throw new BadRequestException('Cannot invite while subscription is cancelled');
    }
    if (owner.proInviteeEmail) {
      throw new ConflictException('You already have an active invitee');
    }
    const email = inviteeEmail.toLowerCase().trim();
    const invitee = await m.findOne(User, {
      where: { email },
      lock: { mode: 'pessimistic_write' },
    });
    if (!invitee) throw new NotFoundException(`User ${email} not found`);
    if (invitee.id === owner.id) throw new BadRequestException('Cannot invite yourself');
    if (invitee.plan !== 'free') throw new ConflictException('User already on paid plan');
    
    invitee.plan = 'pro';
    invitee.billingSource = null;
    invitee.invitedByUserId = owner.id;
    owner.proInviteeEmail = email;
    await m.save([owner, invitee]);
    await this.audit.log({
      userId: owner.id,
      action: 'billing.pro_invite_activated',
      resourceType: 'user',
      resourceId: invitee.id,
      metadata: { email: this.maskEmail(email) },
    });
    await this.outbox.enqueue('amplitude.track', {
      event: 'billing.pro_invite_sent',
      userId: owner.id,
      properties: { inviteeId: invitee.id },
    }, m);
  });
}
```

Do the same for `downgradeInviteeIfEligible`.

- [ ] **Step 3: Run billing.service.spec.ts**

```bash
npx jest src/billing/billing.service.spec.ts
```
Fix any broken tests.

- [ ] **Step 4: Commit**

```bash
git add src/billing/billing.service.ts
git commit -m "refactor(billing): pro invite with transaction + pessimistic lock"
```

---

## Phase 9: Workspace audit + grace cron

### Task 9.1: Workspace audit logs

**Files:**
- Modify: `src/workspace/workspace.service.ts`

- [ ] **Step 1: Add audit calls to workspace operations**

Inject `AuditService` and `OutboxService` into `WorkspaceService` constructor. Add after each successful state change:

```ts
// After create():
await this.audit.log({
  userId: ownerId, action: 'workspace.created',
  resourceType: 'workspace', resourceId: workspace.id,
  metadata: { name: workspace.name, plan: workspace.plan },
});
await this.outbox.enqueue('amplitude.track', {
  event: 'workspace.created', userId: ownerId, properties: { workspaceId: workspace.id },
});
```

Apply similarly to:
- `delete()` → `workspace.deleted`
- `inviteMember()` → `workspace.member_invited`
- `joinByCode()` → `workspace.member_joined`
- `removeMember()` → `workspace.member_removed`
- `generateInviteCode()` → `workspace.invite_code_generated`

- [ ] **Step 2: Update WorkspaceModule imports**

Add `AuditModule`, `OutboxModule` to imports.

- [ ] **Step 3: Commit**

```bash
git add src/workspace/
git commit -m "feat(workspace): audit logs + amplitude events for membership changes"
```

---

### Task 9.2: Grace period cron — batch + state machine

**Files:**
- Modify: `src/billing/grace-period.cron.ts`

- [ ] **Step 1: Rewrite as batch**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, LessThan } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { OutboxService } from './outbox/outbox.service';
import { transition } from './state-machine';

@Injectable()
export class GracePeriodCron {
  private readonly logger = new Logger(GracePeriodCron.name);
  
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}
  
  @Cron('5 0 * * *')  // 00:05 UTC
  async resetExpiredGrace(): Promise<void> {
    const now = new Date();
    const users = await this.userRepo.find({
      where: { gracePeriodEnd: LessThan(now) as any },
    });
    if (users.length === 0) return;
    this.logger.log(`GracePeriodCron: resetting ${users.length} users`);
    
    await this.ds.transaction(async (m) => {
      await m.update(User, 
        { gracePeriodEnd: LessThan(now) as any },
        { 
          plan: 'free', billingStatus: 'free', 
          gracePeriodEnd: null, gracePeriodReason: null,
          billingSource: null,
        }
      );
      for (const u of users) {
        await this.outbox.enqueue('amplitude.track', {
          event: 'billing.grace_expired',
          userId: u.id, properties: { reason: u.gracePeriodReason },
        }, m);
      }
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/billing/grace-period.cron.ts
git commit -m "refactor(billing): batch grace period reset + outbox events"
```

---

## Phase 10: /billing/me + health endpoint + controller rewrite

### Task 10.1: /billing/me new contract

**Files:**
- Modify: `src/billing/billing.controller.ts`
- Modify: `src/billing/billing.service.ts`

- [ ] **Step 1: Locate current /billing/me handler**

```bash
grep -n "billing/me\|getBillingInfo\|getBillingMe" src/billing/
```

- [ ] **Step 2: Replace with resolver call**

```ts
@Get('me')
@UseGuards(JwtAuthGuard)
async getMe(@Request() req): Promise<BillingMeResponse> {
  return this.effective.resolve(req.user.id);
}
```

Remove old methods that built custom `/billing/me` response (keep only internal helpers still used elsewhere).

- [ ] **Step 3: Inject `EffectiveAccessResolver` into BillingController**

```ts
constructor(
  private readonly billingService: BillingService,
  private readonly effective: EffectiveAccessResolver,
) {}
```

Ensure BillingModule imports EffectiveAccessModule and exports are set correctly.

- [ ] **Step 4: Add Redis-less cache (optional — skip if no Redis)**

For now rely on DB performance — Redis cache can be added post-launch. Add `// TODO: Redis cache` comment.

- [ ] **Step 5: Commit**

```bash
git add src/billing/
git commit -m "refactor(billing): /billing/me delegates to EffectiveAccessResolver"
```

---

### Task 10.2: /billing/trial endpoint migration

**Files:**
- Modify: `src/billing/billing.controller.ts`
- Modify: `src/billing/billing.service.ts`

- [ ] **Step 1: Move trial logic to new TrialsService**

In controller:
```ts
@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 1, ttl: 60_000 } })
@Post('trial')
async startTrial(@Request() req) {
  const trial = await this.trials.activate(req.user.id, 'backend', 'pro');
  return { success: true, endsAt: trial.endsAt };
}

@UseGuards(JwtAuthGuard)
@Get('trial')
async trialStatus(@Request() req) {
  const t = await this.trials.status(req.user.id);
  if (!t) return { trial: null };
  return { trial: { endsAt: t.endsAt, plan: t.plan, source: t.source, consumed: t.consumed } };
}
```

Remove old `startTrial` body in BillingService (it may be used by old RC webhook path — confirm no callers remain).

- [ ] **Step 2: Commit**

```bash
git add src/billing/
git commit -m "refactor(billing): move /billing/trial to TrialsService"
```

---

### Task 10.3: Health endpoint

**Files:**
- Create: `src/billing/health/billing-health.controller.ts`

- [ ] **Step 1: Write controller**

```ts
import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { WebhookEvent } from '../entities/webhook-event.entity';
import { OutboxService } from '../outbox/outbox.service';

@Controller('health/billing')
export class BillingHealthController {
  constructor(
    @InjectRepository(WebhookEvent) private readonly webhookRepo: Repository<WebhookEvent>,
    private readonly outbox: OutboxService,
    private readonly cfg: ConfigService,
  ) {}
  
  @Get()
  async get(@Headers('authorization') auth: string) {
    const token = this.cfg.get<string>('BILLING_HEALTH_TOKEN');
    if (!token || auth !== `Bearer ${token}`) throw new UnauthorizedException();
    
    const dayAgo = new Date(Date.now() - 86400_000);
    const [total, failed] = await Promise.all([
      this.webhookRepo.count({ where: { processedAt: { $gte: dayAgo } as any } }),
      this.webhookRepo.count({ where: { processedAt: { $gte: dayAgo } as any, error: { $ne: null } as any } }),
    ]);
    const outboxStats = await this.outbox.stats();
    return {
      webhookEvents24h: total,
      webhookFailures24h: failed,
      webhookFailureRate: total > 0 ? failed / total : 0,
      outboxPending: outboxStats.pending,
      outboxFailed: outboxStats.failed,
    };
  }
}
```
Note: TypeORM `$gte` / `$ne` syntax is NOT standard — replace with `Between`, `Not(IsNull())`, etc. Use actual TypeORM operators:

```ts
import { MoreThanOrEqual, Not, IsNull } from 'typeorm';

const [total, failed] = await Promise.all([
  this.webhookRepo.count({ where: { processedAt: MoreThanOrEqual(dayAgo) } }),
  this.webhookRepo.count({ where: { processedAt: MoreThanOrEqual(dayAgo), error: Not(IsNull()) } }),
]);
```

- [ ] **Step 2: Register in BillingModule**

Add `BillingHealthController` to `controllers` array.

- [ ] **Step 3: Commit**

```bash
git add src/billing/health/ src/billing/billing.module.ts
git commit -m "feat(billing): health endpoint for webhook + outbox metrics"
```

---

## Phase 11: Integration tests + deploy prep

### Task 11.1: Integration test — webhook idempotency

**Files:**
- Create: `test/integration/billing-webhook.e2e-spec.ts` (follow existing e2e pattern)

- [ ] **Step 1: Check existing e2e setup**

```bash
ls test/
cat test/jest-e2e.json
```

- [ ] **Step 2: Write e2e test**

```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Billing webhook idempotency (e2e)', () => {
  let app: INestApplication;
  let secret: string;
  
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
    secret = process.env.REVENUECAT_WEBHOOK_SECRET ?? '';
  });
  
  afterAll(async () => { await app.close(); });
  
  it('rejects invalid authorization', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/billing/revenuecat-webhook')
      .set('Authorization', 'Bearer wrong')
      .send({ event: { type: 'RENEWAL', id: 'e1', app_user_id: 'u1' } })
      .expect(400);
  });
  
  it('same event_id twice → second is duplicate', async () => {
    const body = { event: { type: 'EXPIRATION', id: 'e-idempotent-1', app_user_id: 'u-existing' } };
    await request(app.getHttpServer())
      .post('/api/v1/billing/revenuecat-webhook')
      .set('Authorization', `Bearer ${secret}`)
      .send(body)
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/billing/revenuecat-webhook')
      .set('Authorization', `Bearer ${secret}`)
      .send(body)
      .expect(201)
      .expect(res => expect(res.body.duplicate).toBe(true));
  });
});
```
Adjust `u-existing` to a test user ID seeded in dev DB, or mock `usersService.findById` if using in-memory test DB.

- [ ] **Step 3: Run**

```bash
npm run test:e2e
```

- [ ] **Step 4: Commit**

```bash
git add test/integration/
git commit -m "test(billing): webhook idempotency e2e"
```

---

### Task 11.2: Config template + env docs

**Files:**
- Modify: `.env.example` (or equivalent)

- [ ] **Step 1: Add new vars**

```
# Reconciliation cron — flip to 'true' 24h after deploy once observation looks good
BILLING_RECONCILIATION_ENABLED=false
BILLING_RECONCILIATION_DRY_RUN=true

# RevenueCat server-side API
REVENUECAT_API_KEY=sk_rc_...
REVENUECAT_WEBHOOK_SECRET=whsec_...

# Health endpoint admin token
BILLING_HEALTH_TOKEN=generate_secure_token
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore(env): add billing refactor config vars"
```

---

### Task 11.3: Full test suite + lint + build

- [ ] **Step 1: Run all tests**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend
npm test
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```

- [ ] **Step 3: Build**

```bash
npm run build
```
Expected: all pass.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore(billing): lint + build fixes"
```

---

### Task 11.4: Deploy checklist document

**Files:**
- Create: `docs/deployment/2026-04-19-billing-refactor-deploy.md`

- [ ] **Step 1: Write checklist**

```md
# Billing Refactor Deploy Checklist — 2026-04-19

## Pre-deploy
- [ ] Run migrations locally + verify revert works (one last time)
- [ ] Confirm env vars are set in prod:
  - REVENUECAT_API_KEY
  - REVENUECAT_WEBHOOK_SECRET
  - BILLING_HEALTH_TOKEN
  - BILLING_RECONCILIATION_ENABLED=false (initial)
  - BILLING_RECONCILIATION_DRY_RUN=true (initial)
- [ ] Back up prod DB
- [ ] Alert team in #engineering

## Deploy
- [ ] Merge PR to main
- [ ] Watch CI pass
- [ ] Migrations run automatically
- [ ] Tail logs for webhook errors for 10 min

## Post-deploy (first hour)
- [ ] GET /api/v1/health/billing returns stats
- [ ] Trigger test RC sandbox purchase → webhook received → user plan updated
- [ ] Check Grafana /api/v1/health/billing dashboard: webhookFailureRate == 0
- [ ] Verify outbox empty or draining (outboxPending < 50)

## 24 hours after deploy
- [ ] Review reconciliation dry-run logs
- [ ] Set BILLING_RECONCILIATION_DRY_RUN=false
- [ ] Set BILLING_RECONCILIATION_ENABLED=true
- [ ] Restart service

## First week monitoring
- [ ] Daily webhook failure rate check
- [ ] Daily outbox failed count
- [ ] Reconciliation mismatch audit

## Rollback
- npm run migration:revert (six times) — reverts all new migrations in order
- Redeploy prev tag via CI
```

- [ ] **Step 2: Commit**

```bash
git add docs/deployment/
git commit -m "docs(deploy): billing refactor deploy checklist"
```

---

## Self-Review

Before ending, verify:
1. Every spec section has at least one task implementing it.
2. No `TBD` / `TODO` / "fill in" left.
3. Type names match across tasks (e.g. `BillingStateMachine` is a module, `transition` is the function).
4. All migrations have reversible `down()`.
5. All tests have concrete code (not "write a test for X").

**If spec requirement missed → add task here.**
**If placeholder found → replace with concrete code.**

---

## Execution Handoff

Plan complete. Next step: mobile plan, then execution.
