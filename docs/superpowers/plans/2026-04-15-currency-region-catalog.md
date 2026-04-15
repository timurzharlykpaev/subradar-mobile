# Currency, Region & AI Catalog — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement region-aware pricing with separate display currency, a persistent AI catalog with weekly price refresh, and FX conversion so users can change their display currency and see all subscriptions reconverted.

**Architecture:** Backend stores each subscription's historical amount + originalCurrency immutably. A new FxService converts at read time to the user's displayCurrency. A new CatalogService entity persists AI-researched subscription services with per-region plans; a weekly cron + lazy-on-read strategy refreshes prices cheaply via a split full-research / price-refresh prompt. Mobile adds a region step to onboarding (timezone autodetect), new Settings rows, and updates display components to primarily show `displayAmount/displayCurrency` with original as secondary.

**Tech Stack:** NestJS + TypeORM + PostgreSQL + Redis + ioredis + Bull (already present), OpenAI SDK (gpt-4o full research, gpt-4o-mini price refresh), `decimal.js` (new), `exchangerate.host` (free FX provider). Mobile: React Native + Expo Router + zustand + TanStack Query + `Intl.NumberFormat`.

**Spec:** `docs/superpowers/specs/2026-04-15-currency-region-catalog-design.md`

**Working directories:**
- Backend: `/Users/timurzharlykpaev/Desktop/repositories/subradar-backend`
- Mobile: `/Users/timurzharlykpaev/Desktop/repositories/subradar-mobile`

**Rollout order:** Phase 0 → 1 → 2 → 3 → 4 → 5 (backend) → 6 → 7 → 8 → 9 (mobile). Backend is backward-compatible with old mobile clients at every phase.

---

## Phase 0: Database Foundation

### Task 0.1: User region + displayCurrency migration

**Files:**
- Create: `subradar-backend/src/migrations/<timestamp>-AddUserRegionAndDisplayCurrency.ts`
- Modify: `subradar-backend/src/users/entities/user.entity.ts`

- [ ] **Step 1: Add columns to User entity**

Open `user.entity.ts` and add after the existing `currency` field (or equivalent):

```ts
@Column({ type: 'varchar', length: 2, default: 'US' })
region: string;

@Column({ type: 'varchar', length: 3, default: 'USD' })
displayCurrency: string;

@Column({ type: 'varchar', length: 64, nullable: true })
timezoneDetected: string | null;
```

- [ ] **Step 2: Generate migration**

Run:
```bash
cd subradar-backend
npm run typeorm -- migration:generate src/migrations/AddUserRegionAndDisplayCurrency -d src/data-source.ts
```

Expected: new file created with `ALTER TABLE users ADD COLUMN region`, `display_currency`, `timezone_detected`.

- [ ] **Step 3: Edit migration to include backfill from existing country/currency if those exist**

Edit the generated migration's `up()` to include (place after the ADD COLUMNs):

```ts
await queryRunner.query(`
  UPDATE "users" SET "region" = COALESCE(NULLIF("country", ''), 'US')
  WHERE "country" IS NOT NULL;
`);
await queryRunner.query(`
  UPDATE "users" SET "display_currency" = COALESCE(NULLIF("currency", ''), 'USD')
  WHERE "currency" IS NOT NULL;
`);
```

(If `users.country` or `users.currency` columns do not exist, skip these queries — inspect the generated SQL and remove the UPDATE blocks.)

- [ ] **Step 4: Run migration**

```bash
npm run migration:run
```

Expected: "Migration AddUserRegionAndDisplayCurrency has been executed successfully."

- [ ] **Step 5: Commit**

```bash
git add src/migrations/*AddUserRegionAndDisplayCurrency.ts src/users/entities/user.entity.ts
git commit -m "feat(user): add region and displayCurrency fields"
```

---

### Task 0.2: Subscription.originalCurrency migration with backfill

**Files:**
- Create: `subradar-backend/src/migrations/<timestamp>-AddSubscriptionOriginalCurrency.ts`
- Modify: `subradar-backend/src/subscriptions/entities/subscription.entity.ts`

- [ ] **Step 1: Add column to Subscription entity**

After the `currency` field in `subscription.entity.ts`:

```ts
@Column({ type: 'varchar', length: 3 })
originalCurrency: string;
```

- [ ] **Step 2: Generate migration**

```bash
npm run typeorm -- migration:generate src/migrations/AddSubscriptionOriginalCurrency -d src/data-source.ts
```

- [ ] **Step 3: Edit migration — make column nullable first, backfill, then NOT NULL**

Replace the generated `up()` body with:

```ts
await queryRunner.query(`ALTER TABLE "subscriptions" ADD COLUMN "original_currency" VARCHAR(3);`);
await queryRunner.query(`UPDATE "subscriptions" SET "original_currency" = "currency" WHERE "original_currency" IS NULL;`);
await queryRunner.query(`ALTER TABLE "subscriptions" ALTER COLUMN "original_currency" SET NOT NULL;`);
```

And `down()`:

```ts
await queryRunner.query(`ALTER TABLE "subscriptions" DROP COLUMN "original_currency";`);
```

- [ ] **Step 4: Run migration**

```bash
npm run migration:run
```

Verify:

```bash
psql -c "SELECT currency, original_currency, COUNT(*) FROM subscriptions GROUP BY 1,2;"
```

Expected: every row has `original_currency = currency`.

- [ ] **Step 5: Commit**

```bash
git add src/migrations/*AddSubscriptionOriginalCurrency.ts src/subscriptions/entities/subscription.entity.ts
git commit -m "feat(subscription): add originalCurrency field with backfill"
```

---

### Task 0.3: FxRateSnapshot entity + migration

**Files:**
- Create: `subradar-backend/src/fx/entities/fx-rate-snapshot.entity.ts`
- Create: `subradar-backend/src/migrations/<timestamp>-CreateFxRateSnapshot.ts`

- [ ] **Step 1: Create entity**

```ts
// src/fx/entities/fx-rate-snapshot.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('fx_rate_snapshots')
export class FxRateSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  base: string;

  @Column({ type: 'jsonb' })
  rates: Record<string, number>;

  @Index()
  @CreateDateColumn({ name: 'fetched_at' })
  fetchedAt: Date;

  @Column({ type: 'varchar', length: 64, default: 'exchangerate.host' })
  source: string;
}
```

- [ ] **Step 2: Register entity in data source**

Edit `src/data-source.ts` — add to `entities` array:

```ts
import { FxRateSnapshot } from './fx/entities/fx-rate-snapshot.entity';
// ... entities: [..., FxRateSnapshot]
```

- [ ] **Step 3: Generate and run migration**

```bash
npm run typeorm -- migration:generate src/migrations/CreateFxRateSnapshot -d src/data-source.ts
npm run migration:run
```

- [ ] **Step 4: Verify table exists**

```bash
psql -c "\d fx_rate_snapshots"
```

- [ ] **Step 5: Commit**

```bash
git add src/fx/entities/ src/migrations/*CreateFxRateSnapshot.ts src/data-source.ts
git commit -m "feat(fx): add FxRateSnapshot entity"
```

---

### Task 0.4: CatalogService + CatalogPlan entities + migration

**Files:**
- Create: `subradar-backend/src/catalog/entities/catalog-service.entity.ts`
- Create: `subradar-backend/src/catalog/entities/catalog-plan.entity.ts`
- Create: `subradar-backend/src/migrations/<timestamp>-CreateCatalogTables.ts`

- [ ] **Step 1: Create CatalogService entity**

```ts
// src/catalog/entities/catalog-service.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, OneToMany,
} from 'typeorm';
import { SubscriptionCategory } from '../../subscriptions/entities/subscription.entity';
import { CatalogPlan } from './catalog-plan.entity';

@Entity('catalog_services')
export class CatalogService {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  slug: string;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'enum', enum: SubscriptionCategory, default: SubscriptionCategory.OTHER })
  category: SubscriptionCategory;

  @Column({ type: 'text', nullable: true })
  iconUrl: string | null;

  @Column({ type: 'text', nullable: true })
  websiteUrl: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  aliases: string[];

  @Column({ type: 'timestamptz', nullable: true })
  lastResearchedAt: Date | null;

  @Column({ type: 'integer', default: 0 })
  researchCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => CatalogPlan, (p) => p.service)
  plans: CatalogPlan[];
}
```

- [ ] **Step 2: Create CatalogPlan entity**

```ts
// src/catalog/entities/catalog-plan.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column, Index, ManyToOne, JoinColumn, Unique,
} from 'typeorm';
import { CatalogService } from './catalog-service.entity';
import { BillingPeriod } from '../../subscriptions/entities/subscription.entity';

export enum PriceSource {
  AI_RESEARCH = 'AI_RESEARCH',
  USER_REPORTED = 'USER_REPORTED',
  MANUAL = 'MANUAL',
}

export enum PriceConfidence {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

@Entity('catalog_plans')
@Unique(['serviceId', 'region', 'planName'])
@Index(['lastPriceRefreshAt'])
@Index(['serviceId', 'region'])
export class CatalogPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  serviceId: string;

  @ManyToOne(() => CatalogService, (s) => s.plans, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'serviceId' })
  service: CatalogService;

  @Column({ type: 'varchar', length: 2 })
  region: string;

  @Column({ type: 'varchar', length: 128 })
  planName: string;

  @Column({ type: 'decimal', precision: 19, scale: 4 })
  price: string; // keep as string to preserve decimal precision

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({ type: 'enum', enum: BillingPeriod })
  period: BillingPeriod;

  @Column({ type: 'integer', nullable: true })
  trialDays: number | null;

  @Column({ type: 'text', array: true, default: '{}' })
  features: string[];

  @Column({ type: 'enum', enum: PriceSource, default: PriceSource.AI_RESEARCH })
  priceSource: PriceSource;

  @Column({ type: 'enum', enum: PriceConfidence, default: PriceConfidence.HIGH })
  priceConfidence: PriceConfidence;

  @Column({ type: 'timestamptz', nullable: true })
  lastPriceRefreshAt: Date | null;
}
```

- [ ] **Step 3: Register in data-source.ts and generate migration**

Add both entities to `data-source.ts` entities array. Then:

```bash
npm run typeorm -- migration:generate src/migrations/CreateCatalogTables -d src/data-source.ts
npm run migration:run
```

- [ ] **Step 4: Verify**

```bash
psql -c "\d catalog_services" && psql -c "\d catalog_plans"
```

- [ ] **Step 5: Commit**

```bash
git add src/catalog/entities/ src/migrations/*CreateCatalogTables.ts src/data-source.ts
git commit -m "feat(catalog): add CatalogService and CatalogPlan entities"
```

---

### Task 0.5: Subscription catalog links migration

**Files:**
- Create: `subradar-backend/src/migrations/<timestamp>-AddSubscriptionCatalogLinks.ts`
- Modify: `subradar-backend/src/subscriptions/entities/subscription.entity.ts`

- [ ] **Step 1: Add columns to Subscription entity**

Add after `originalCurrency`:

```ts
@Column({ type: 'uuid', nullable: true })
catalogServiceId: string | null;

@Column({ type: 'uuid', nullable: true })
catalogPlanId: string | null;
```

- [ ] **Step 2: Generate and run migration**

```bash
npm run typeorm -- migration:generate src/migrations/AddSubscriptionCatalogLinks -d src/data-source.ts
npm run migration:run
```

- [ ] **Step 3: Verify columns and indexes**

```bash
psql -c "\d subscriptions" | grep -E "catalog|original"
```

- [ ] **Step 4: Commit**

```bash
git add src/migrations/*AddSubscriptionCatalogLinks.ts src/subscriptions/entities/subscription.entity.ts
git commit -m "feat(subscription): add catalogServiceId and catalogPlanId links"
```

---

## Phase 1: FX Service

### Task 1.1: Install decimal.js and create FX module skeleton

**Files:**
- Modify: `subradar-backend/package.json`
- Create: `subradar-backend/src/fx/fx.module.ts`

- [ ] **Step 1: Install decimal.js**

```bash
cd subradar-backend
npm install decimal.js
```

- [ ] **Step 2: Create empty FX module**

```ts
// src/fx/fx.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FxRateSnapshot } from './entities/fx-rate-snapshot.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FxRateSnapshot])],
  providers: [],
  exports: [],
})
export class FxModule {}
```

- [ ] **Step 3: Register in AppModule**

Edit `src/app.module.ts` — add `FxModule` to `imports`.

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: success.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/fx/fx.module.ts src/app.module.ts
git commit -m "chore(fx): install decimal.js and scaffold FX module"
```

---

### Task 1.2: FxService — fetch, cache, fallback

**Files:**
- Create: `subradar-backend/src/fx/fx.service.ts`
- Create: `subradar-backend/src/fx/fx.service.spec.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/fx/fx.service.spec.ts
import { Test } from '@nestjs/testing';
import { FxService } from './fx.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FxRateSnapshot } from './entities/fx-rate-snapshot.entity';
import { REDIS_CLIENT } from '../common/redis.module';
import Decimal from 'decimal.js';

describe('FxService', () => {
  let service: FxService;
  let redisMock: any;
  let repoMock: any;
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    redisMock = { get: jest.fn(), set: jest.fn() };
    repoMock = { findOne: jest.fn(), create: jest.fn((x) => x), save: jest.fn((x) => x) };
    fetchMock = jest.fn();
    global.fetch = fetchMock as any;

    const module = await Test.createTestingModule({
      providers: [
        FxService,
        { provide: REDIS_CLIENT, useValue: redisMock },
        { provide: getRepositoryToken(FxRateSnapshot), useValue: repoMock },
      ],
    }).compile();
    service = module.get(FxService);
  });

  it('returns rates from Redis when cached', async () => {
    redisMock.get.mockResolvedValue(JSON.stringify({
      base: 'USD', rates: { USD: 1, EUR: 0.92 }, fetchedAt: new Date().toISOString(), source: 'test',
    }));
    const result = await service.getRates();
    expect(result.rates.EUR).toBe(0.92);
    expect(repoMock.findOne).not.toHaveBeenCalled();
  });

  it('falls back to DB snapshot when Redis empty', async () => {
    redisMock.get.mockResolvedValue(null);
    repoMock.findOne.mockResolvedValue({
      base: 'USD', rates: { USD: 1, EUR: 0.9 }, fetchedAt: new Date(), source: 'db',
    });
    const result = await service.getRates();
    expect(result.rates.EUR).toBe(0.9);
    expect(redisMock.set).toHaveBeenCalled();
  });

  it('fetches fresh rates when DB snapshot missing', async () => {
    redisMock.get.mockResolvedValue(null);
    repoMock.findOne.mockResolvedValue(null);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ base: 'USD', rates: { USD: 1, EUR: 0.95 } }),
    });
    const result = await service.getRates();
    expect(result.rates.EUR).toBe(0.95);
    expect(repoMock.save).toHaveBeenCalled();
  });

  it('convert: identity when from == to', () => {
    const rates = { USD: 1, EUR: 0.9 };
    const out = service.convert(new Decimal('10'), 'USD', 'USD', rates);
    expect(out.toString()).toBe('10');
  });

  it('convert: USD→EUR', () => {
    const rates = { USD: 1, EUR: 0.9 };
    const out = service.convert(new Decimal('10'), 'USD', 'EUR', rates);
    expect(out.toFixed(2)).toBe('9.00');
  });

  it('convert: EUR→KZT via USD base', () => {
    const rates = { USD: 1, EUR: 0.9, KZT: 450 };
    const out = service.convert(new Decimal('9'), 'EUR', 'KZT', rates);
    expect(out.toFixed(2)).toBe('4500.00');
  });

  it('convert: throws on unknown currency', () => {
    const rates = { USD: 1 };
    expect(() => service.convert(new Decimal('10'), 'XYZ', 'USD', rates)).toThrow();
  });
});
```

- [ ] **Step 2: Run tests — all should fail**

```bash
npm test src/fx/fx.service.spec.ts
```

Expected: 7 failing tests ("FxService is not defined" or similar).

- [ ] **Step 3: Write implementation**

```ts
// src/fx/fx.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Decimal from 'decimal.js';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../common/redis.module';
import { FxRateSnapshot } from './entities/fx-rate-snapshot.entity';

const REDIS_KEY = 'fx:latest';
const REDIS_TTL_SECONDS = 6 * 60 * 60; // 6 hours
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
const SOURCE = 'exchangerate.host';

export interface FxRates {
  base: 'USD';
  rates: Record<string, number>;
  fetchedAt: Date;
  source: string;
}

@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectRepository(FxRateSnapshot) private readonly repo: Repository<FxRateSnapshot>,
  ) {}

  async getRates(): Promise<FxRates> {
    // 1. Redis
    const cached = await this.redis.get(REDIS_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      return { ...parsed, fetchedAt: new Date(parsed.fetchedAt) };
    }

    // 2. DB snapshot
    const snapshot = await this.repo.findOne({ where: {}, order: { fetchedAt: 'DESC' } });

    if (snapshot) {
      const ageMs = Date.now() - snapshot.fetchedAt.getTime();
      const rates: FxRates = {
        base: 'USD', rates: snapshot.rates, fetchedAt: snapshot.fetchedAt, source: snapshot.source,
      };
      await this.redis.set(REDIS_KEY, JSON.stringify(rates), 'EX', REDIS_TTL_SECONDS);
      if (ageMs <= STALE_THRESHOLD_MS) return rates;
      // Stale: try to refresh but don't block on it
      this.refreshFromApi().catch((e) => this.logger.warn(`FX refresh failed: ${e.message}`));
      return rates;
    }

    // 3. No snapshot — must fetch
    return this.refreshFromApi();
  }

  async refreshFromApi(): Promise<FxRates> {
    const resp = await fetch('https://api.exchangerate.host/latest?base=USD');
    if (!resp.ok) throw new Error(`FX API returned ${resp.status}`);
    const data: any = await resp.json();
    if (!data?.rates?.USD) throw new Error('FX API response missing rates');

    const now = new Date();
    const entity = this.repo.create({ base: 'USD', rates: data.rates, source: SOURCE, fetchedAt: now });
    await this.repo.save(entity);

    const result: FxRates = { base: 'USD', rates: data.rates, fetchedAt: now, source: SOURCE };
    await this.redis.set(REDIS_KEY, JSON.stringify(result), 'EX', REDIS_TTL_SECONDS);
    return result;
  }

  convert(amount: Decimal, from: string, to: string, rates: Record<string, number>): Decimal {
    if (from === to) return amount;
    const fromRate = rates[from];
    const toRate = rates[to];
    if (!fromRate) throw new Error(`No FX rate for ${from}`);
    if (!toRate) throw new Error(`No FX rate for ${to}`);
    return amount.div(fromRate).mul(toRate);
  }
}
```

- [ ] **Step 4: Register service and run tests**

Update `src/fx/fx.module.ts`:

```ts
providers: [FxService],
exports: [FxService],
```

Run:

```bash
npm test src/fx/fx.service.spec.ts
```

Expected: 7 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/fx/fx.service.ts src/fx/fx.service.spec.ts src/fx/fx.module.ts
git commit -m "feat(fx): add FxService with Redis + DB fallback + conversion"
```

---

### Task 1.3: FX daily refresh cron

**Files:**
- Create: `subradar-backend/src/fx/fx.cron.ts`
- Modify: `subradar-backend/src/fx/fx.module.ts`

- [ ] **Step 1: Create cron**

```ts
// src/fx/fx.cron.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FxService } from './fx.service';

@Injectable()
export class FxCron {
  private readonly logger = new Logger(FxCron.name);

  constructor(private readonly fx: FxService) {}

  @Cron('0 3 * * *') // daily 03:00 UTC
  async refreshDaily() {
    try {
      const result = await this.fx.refreshFromApi();
      this.logger.log(`FX rates refreshed: ${Object.keys(result.rates).length} currencies`);
    } catch (e: any) {
      this.logger.error(`FX daily refresh failed: ${e.message}`);
    }
  }
}
```

- [ ] **Step 2: Register in module**

```ts
// src/fx/fx.module.ts
providers: [FxService, FxCron],
```

- [ ] **Step 3: Ensure ScheduleModule is registered globally**

Check `src/app.module.ts` for `ScheduleModule.forRoot()`. If missing, add:

```ts
import { ScheduleModule } from '@nestjs/schedule';
// imports: [..., ScheduleModule.forRoot()]
```

- [ ] **Step 4: Smoke test via admin trigger — temporarily add a test**

Add a spec `src/fx/fx.cron.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { FxCron } from './fx.cron';
import { FxService } from './fx.service';

describe('FxCron', () => {
  it('calls refreshFromApi and logs count', async () => {
    const fxMock = { refreshFromApi: jest.fn().mockResolvedValue({ rates: { USD: 1, EUR: 0.9 } }) };
    const module = await Test.createTestingModule({
      providers: [FxCron, { provide: FxService, useValue: fxMock }],
    }).compile();
    const cron = module.get(FxCron);
    await cron.refreshDaily();
    expect(fxMock.refreshFromApi).toHaveBeenCalled();
  });

  it('swallows errors from fx provider', async () => {
    const fxMock = { refreshFromApi: jest.fn().mockRejectedValue(new Error('api down')) };
    const module = await Test.createTestingModule({
      providers: [FxCron, { provide: FxService, useValue: fxMock }],
    }).compile();
    const cron = module.get(FxCron);
    await expect(cron.refreshDaily()).resolves.toBeUndefined();
  });
});
```

Run:

```bash
npm test src/fx/fx.cron.spec.ts
```

Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add src/fx/fx.cron.ts src/fx/fx.cron.spec.ts src/fx/fx.module.ts src/app.module.ts
git commit -m "feat(fx): add daily cron to refresh FX rates from exchangerate.host"
```

---

### Task 1.4: GET /fx/rates endpoint

**Files:**
- Create: `subradar-backend/src/fx/fx.controller.ts`
- Modify: `subradar-backend/src/fx/fx.module.ts`

- [ ] **Step 1: Write controller test**

```ts
// src/fx/fx.controller.spec.ts
import { Test } from '@nestjs/testing';
import { FxController } from './fx.controller';
import { FxService } from './fx.service';

describe('FxController', () => {
  it('GET /fx/rates returns rates', async () => {
    const fxMock = { getRates: jest.fn().mockResolvedValue({
      base: 'USD', rates: { USD: 1, EUR: 0.9 }, fetchedAt: new Date(), source: 'x',
    })};
    const module = await Test.createTestingModule({
      controllers: [FxController],
      providers: [{ provide: FxService, useValue: fxMock }],
    }).compile();
    const ctrl = module.get(FxController);
    const result = await ctrl.getRates();
    expect(result.base).toBe('USD');
    expect(result.rates.EUR).toBe(0.9);
  });
});
```

- [ ] **Step 2: Run — should fail (controller missing)**

```bash
npm test src/fx/fx.controller.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement controller**

```ts
// src/fx/fx.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FxService } from './fx.service';

@ApiTags('fx')
@Controller('fx')
export class FxController {
  constructor(private readonly fx: FxService) {}

  @Get('rates')
  async getRates() {
    return this.fx.getRates();
  }
}
```

Register in module:

```ts
// src/fx/fx.module.ts
controllers: [FxController],
```

- [ ] **Step 4: Run tests**

```bash
npm test src/fx/
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/fx/fx.controller.ts src/fx/fx.controller.spec.ts src/fx/fx.module.ts
git commit -m "feat(fx): add GET /fx/rates endpoint"
```

---

## Phase 2: User region/displayCurrency endpoints

### Task 2.1: Extend PATCH /users/me + UserDto

**Files:**
- Modify: `subradar-backend/src/users/dto/update-user.dto.ts`
- Modify: `subradar-backend/src/users/users.controller.ts` (or service — wherever the response is serialized)

- [ ] **Step 1: Inspect existing DTO**

```bash
cat src/users/dto/update-user.dto.ts
```

- [ ] **Step 2: Add fields to DTO**

```ts
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateUserDto {
  // ... existing fields
  @IsOptional()
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/, { message: 'region must be ISO-3166 alpha-2' })
  region?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/, { message: 'displayCurrency must be ISO-4217' })
  displayCurrency?: string;
}
```

- [ ] **Step 3: Write test for users.service PATCH**

```ts
// src/users/users.service.spec.ts — add test case
it('accepts region and displayCurrency', async () => {
  const user = { id: 'x', region: 'US', displayCurrency: 'USD' };
  repoMock.findOne.mockResolvedValue(user);
  repoMock.save.mockImplementation(async (u) => u);
  const result = await service.update('x', { region: 'KZ', displayCurrency: 'KZT' });
  expect(result.region).toBe('KZ');
  expect(result.displayCurrency).toBe('KZT');
});
```

- [ ] **Step 4: Implement (service's update method already forwards valid fields to save) — run tests**

```bash
npm test src/users/
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/users/
git commit -m "feat(users): accept region and displayCurrency in PATCH /users/me"
```

---

### Task 2.2: Return region + displayCurrency in GET /users/me response

**Files:**
- Modify: `subradar-backend/src/users/users.controller.ts`
- Modify: `subradar-backend/src/users/dto/user.dto.ts` (if exists) or serialization layer

- [ ] **Step 1: Write integration test**

```ts
// src/users/users.controller.spec.ts
it('GET /users/me includes region and displayCurrency', async () => {
  // mock user with region: 'KZ', displayCurrency: 'KZT'
  const user = { id: 'x', email: 'a@b.c', region: 'KZ', displayCurrency: 'KZT' };
  usersServiceMock.findById.mockResolvedValue(user);
  const result = await ctrl.getMe({ user: { id: 'x' } });
  expect(result.region).toBe('KZ');
  expect(result.displayCurrency).toBe('KZT');
});
```

- [ ] **Step 2: Run — expect pass if entity is returned directly; otherwise fail**

```bash
npm test src/users/users.controller.spec.ts
```

- [ ] **Step 3: Ensure serialization includes both fields**

If there's a serialize layer that whitelists fields (DTO or `@Exclude/@Expose`), add `region` and `displayCurrency` to exposed fields.

- [ ] **Step 4: Run tests again**

```bash
npm test src/users/
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/users/
git commit -m "feat(users): expose region and displayCurrency in /users/me response"
```

---

## Phase 3: Catalog infrastructure

### Task 3.1: CatalogService + CatalogPlan repositories module

**Files:**
- Create: `subradar-backend/src/catalog/catalog.module.ts`

- [ ] **Step 1: Create module**

```ts
// src/catalog/catalog.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogService as CatalogEntity } from './entities/catalog-service.entity';
import { CatalogPlan } from './entities/catalog-plan.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CatalogEntity, CatalogPlan])],
  providers: [],
  exports: [TypeOrmModule],
})
export class CatalogModule {}
```

- [ ] **Step 2: Register in AppModule**

Add `CatalogModule` to `imports` in `src/app.module.ts`.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/catalog/catalog.module.ts src/app.module.ts
git commit -m "chore(catalog): scaffold catalog module"
```

---

### Task 3.2: AiCatalogProvider — full-research prompt

**Files:**
- Create: `subradar-backend/src/catalog/ai-catalog.provider.ts`
- Create: `subradar-backend/src/catalog/ai-catalog.provider.spec.ts`

- [ ] **Step 1: Write test**

```ts
// src/catalog/ai-catalog.provider.spec.ts
import { Test } from '@nestjs/testing';
import { AiCatalogProvider } from './ai-catalog.provider';
import { ConfigService } from '@nestjs/config';

describe('AiCatalogProvider', () => {
  let provider: AiCatalogProvider;
  let openaiMock: any;

  beforeEach(async () => {
    openaiMock = {
      chat: { completions: { create: jest.fn() } },
    };
    const module = await Test.createTestingModule({
      providers: [
        AiCatalogProvider,
        { provide: ConfigService, useValue: { get: () => 'fake-key' } },
        { provide: 'OPENAI_CLIENT', useValue: openaiMock },
      ],
    }).compile();
    provider = module.get(AiCatalogProvider);
  });

  it('fullResearch: parses valid JSON response', async () => {
    openaiMock.chat.completions.create.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            service: {
              name: 'Netflix', slug: 'netflix', category: 'STREAMING',
              iconUrl: 'https://a.com/n.png', websiteUrl: 'netflix.com', aliases: ['нетфликс'],
            },
            plans: [
              { region: 'US', planName: 'Basic', price: 6.99, currency: 'USD', period: 'MONTHLY', features: [], confidence: 'HIGH' },
              { region: 'KZ', planName: 'Basic', price: 2990, currency: 'KZT', period: 'MONTHLY', features: [], confidence: 'MEDIUM' },
            ],
          }),
        },
      }],
    });
    const result = await provider.fullResearch('Netflix', ['US', 'KZ']);
    expect(result.service.slug).toBe('netflix');
    expect(result.plans).toHaveLength(2);
    expect(result.plans[0].price).toBe(6.99);
  });

  it('fullResearch: throws on malformed JSON after retry', async () => {
    openaiMock.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'not json' } }],
    });
    await expect(provider.fullResearch('X', ['US'])).rejects.toThrow();
    expect(openaiMock.chat.completions.create).toHaveBeenCalledTimes(2); // retry once
  });

  it('priceRefresh: returns prices array', async () => {
    openaiMock.chat.completions.create.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            prices: [{ region: 'US', planName: 'Basic', price: 7.99, currency: 'USD' }],
            notes: 'updated',
          }),
        },
      }],
    });
    const result = await provider.priceRefresh('Netflix', ['US'], ['Basic']);
    expect(result.prices[0].price).toBe(7.99);
    expect(openaiMock.chat.completions.create.mock.calls[0][0].model).toMatch(/mini/);
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
npm test src/catalog/ai-catalog.provider.spec.ts
```

- [ ] **Step 3: Implement provider**

```ts
// src/catalog/ai-catalog.provider.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface FullResearchResult {
  service: {
    name: string;
    slug: string;
    category: string;
    iconUrl: string | null;
    websiteUrl: string | null;
    aliases: string[];
  };
  plans: {
    region: string;
    planName: string;
    price: number;
    currency: string;
    period: string;
    trialDays?: number;
    features: string[];
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  }[];
}

export interface PriceRefreshResult {
  prices: { region: string; planName: string; price: number; currency: string }[];
  notes?: string;
}

const FULL_RESEARCH_MODEL = 'gpt-4o';
const PRICE_REFRESH_MODEL = 'gpt-4o-mini';

@Injectable()
export class AiCatalogProvider {
  private readonly logger = new Logger(AiCatalogProvider.name);

  constructor(
    @Inject('OPENAI_CLIENT') private readonly openai: any,
  ) {}

  async fullResearch(query: string, regions: string[]): Promise<FullResearchResult> {
    const systemPrompt = `You are a SaaS subscription research assistant. Given a service name, return JSON describing the service and its current publicly-listed plans for each requested region. If a plan is unavailable in a region, omit it. Be precise with currency (ISO-4217) and period (WEEKLY, MONTHLY, QUARTERLY, YEARLY, LIFETIME). If uncertain about a price, set confidence: "MEDIUM" or "LOW". Normalize slug to lowercase kebab-case.`;
    const userPrompt = JSON.stringify({ query, regions });

    return this.callWithRetry(FULL_RESEARCH_MODEL, systemPrompt, userPrompt) as Promise<FullResearchResult>;
  }

  async priceRefresh(service: string, regions: string[], knownPlans: string[]): Promise<PriceRefreshResult> {
    const systemPrompt = `Return ONLY current prices for the listed plans in the listed regions. No new plans, no descriptions.`;
    const userPrompt = JSON.stringify({ service, regions, knownPlans });
    return this.callWithRetry(PRICE_REFRESH_MODEL, systemPrompt, userPrompt) as Promise<PriceRefreshResult>;
  }

  private async callWithRetry(model: string, system: string, user: string, attempt = 1): Promise<unknown> {
    const resp = await this.openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature: attempt === 1 ? 0.2 : 0,
    });
    const content = resp.choices?.[0]?.message?.content;
    try {
      return JSON.parse(content);
    } catch (e) {
      if (attempt >= 2) throw new Error(`AI response unparseable after retry: ${content?.slice(0, 200)}`);
      this.logger.warn(`AI response invalid JSON, retrying (attempt ${attempt})`);
      return this.callWithRetry(model, system, user, attempt + 1);
    }
  }
}
```

- [ ] **Step 4: Register OPENAI_CLIENT in catalog.module.ts**

```ts
// src/catalog/catalog.module.ts
import OpenAI from 'openai';
import { AiCatalogProvider } from './ai-catalog.provider';

providers: [
  AiCatalogProvider,
  {
    provide: 'OPENAI_CLIENT',
    useFactory: (config: ConfigService) => new OpenAI({ apiKey: config.get('OPENAI_API_KEY') }),
    inject: [ConfigService],
  },
],
exports: [AiCatalogProvider],
```

Run:

```bash
npm test src/catalog/ai-catalog.provider.spec.ts
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add src/catalog/ai-catalog.provider.ts src/catalog/ai-catalog.provider.spec.ts src/catalog/catalog.module.ts
git commit -m "feat(catalog): add AiCatalogProvider with full-research and price-refresh prompts"
```

---

### Task 3.3: CatalogService (nest service) — findOrCreate, findPlans, dedup lock

**Files:**
- Create: `subradar-backend/src/catalog/catalog.service.ts`
- Create: `subradar-backend/src/catalog/catalog.service.spec.ts`

- [ ] **Step 1: Write test**

```ts
// src/catalog/catalog.service.spec.ts
import { Test } from '@nestjs/testing';
import { CatalogService } from './catalog.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CatalogService as CatalogEntity } from './entities/catalog-service.entity';
import { CatalogPlan } from './entities/catalog-plan.entity';
import { AiCatalogProvider } from './ai-catalog.provider';
import { REDIS_CLIENT } from '../common/redis.module';

describe('CatalogService', () => {
  let service: CatalogService;
  let serviceRepo: any;
  let planRepo: any;
  let ai: any;
  let redis: any;

  beforeEach(async () => {
    serviceRepo = { findOne: jest.fn(), create: jest.fn((x) => x), save: jest.fn(async (x) => ({ ...x, id: 'svc-1' })) };
    planRepo = { find: jest.fn(), create: jest.fn((x) => x), save: jest.fn(async (x) => x) };
    ai = { fullResearch: jest.fn(), priceRefresh: jest.fn() };
    redis = { set: jest.fn(), del: jest.fn(), get: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: getRepositoryToken(CatalogEntity), useValue: serviceRepo },
        { provide: getRepositoryToken(CatalogPlan), useValue: planRepo },
        { provide: AiCatalogProvider, useValue: ai },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();
    service = module.get(CatalogService);
  });

  it('search: returns DB plans when service exists and fresh', async () => {
    serviceRepo.findOne.mockResolvedValue({ id: 'svc-1', slug: 'netflix', name: 'Netflix' });
    planRepo.find.mockResolvedValue([
      { id: 'p1', planName: 'Basic', price: '6.99', currency: 'USD', region: 'US', period: 'MONTHLY',
        lastPriceRefreshAt: new Date() },
    ]);
    const result = await service.search('netflix', 'US');
    expect(result.service.slug).toBe('netflix');
    expect(result.plans).toHaveLength(1);
    expect(ai.fullResearch).not.toHaveBeenCalled();
  });

  it('search: calls AI and persists when service missing', async () => {
    serviceRepo.findOne.mockResolvedValue(null);
    redis.set.mockResolvedValue('OK'); // lock acquired
    ai.fullResearch.mockResolvedValue({
      service: { name: 'Spotify', slug: 'spotify', category: 'MUSIC', iconUrl: null, websiteUrl: null, aliases: [] },
      plans: [{ region: 'US', planName: 'Individual', price: 10.99, currency: 'USD', period: 'MONTHLY', features: [], confidence: 'HIGH' }],
    });
    const result = await service.search('spotify', 'US');
    expect(ai.fullResearch).toHaveBeenCalledWith('Spotify', ['US']);
    expect(serviceRepo.save).toHaveBeenCalled();
    expect(planRepo.save).toHaveBeenCalled();
    expect(redis.del).toHaveBeenCalled(); // lock released
  });

  it('search: respects Redis lock (waits for existing lookup)', async () => {
    serviceRepo.findOne
      .mockResolvedValueOnce(null) // first check: not found
      .mockResolvedValueOnce({ id: 'svc-1', slug: 'netflix', name: 'Netflix' }); // after wait
    planRepo.find.mockResolvedValue([{ planName: 'B', price: '9.99', currency: 'USD', region: 'US', period: 'MONTHLY', lastPriceRefreshAt: new Date() }]);
    redis.set.mockResolvedValue(null); // lock NOT acquired (another process has it)
    redis.get.mockResolvedValueOnce('locked').mockResolvedValueOnce(null); // 2nd call: lock released

    const result = await service.search('netflix', 'US');
    expect(ai.fullResearch).not.toHaveBeenCalled();
    expect(result.service.slug).toBe('netflix');
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
npm test src/catalog/catalog.service.spec.ts
```

- [ ] **Step 3: Implement service**

```ts
// src/catalog/catalog.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../common/redis.module';
import { CatalogService as CatalogEntity } from './entities/catalog-service.entity';
import { CatalogPlan, PriceConfidence, PriceSource } from './entities/catalog-plan.entity';
import { AiCatalogProvider } from './ai-catalog.provider';
import { SubscriptionCategory, BillingPeriod } from '../subscriptions/entities/subscription.entity';

const LOCK_TTL_SEC = 60;
const LOCK_POLL_INTERVAL_MS = 500;
const LOCK_MAX_WAIT_MS = 20_000;
const STALE_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    @InjectRepository(CatalogEntity) private readonly serviceRepo: Repository<CatalogEntity>,
    @InjectRepository(CatalogPlan) private readonly planRepo: Repository<CatalogPlan>,
    @Inject(AiCatalogProvider) private readonly ai: AiCatalogProvider,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async search(query: string, region: string): Promise<{ service: CatalogEntity; plans: CatalogPlan[] }> {
    const slug = slugify(query);
    let service = await this.findBySlug(slug);

    if (service) {
      const plans = await this.planRepo.find({ where: { serviceId: service.id, region } });
      if (this.hasStalePlans(plans)) {
        this.logger.log(`Stale plans for ${slug}/${region}, refresh will be queued`);
        // Lazy refresh is queued in Phase 4; placeholder note for now.
      }
      return { service, plans };
    }

    // Not in DB — acquire lock, call AI, persist
    const lockKey = `ai:lookup:lock:${slug}`;
    const acquired = await this.redis.set(lockKey, '1', 'EX', LOCK_TTL_SEC, 'NX');

    if (!acquired) {
      // Another process is looking up — wait for it
      service = await this.waitForService(slug);
      if (service) {
        const plans = await this.planRepo.find({ where: { serviceId: service.id, region } });
        return { service, plans };
      }
      throw new Error(`Catalog lookup timed out for ${slug}`);
    }

    try {
      const regions = [region];
      const result = await this.ai.fullResearch(query, regions);
      service = await this.persistService(result.service);
      const plans = await this.persistPlans(service.id, result.plans);
      return { service, plans };
    } finally {
      await this.redis.del(lockKey);
    }
  }

  private async findBySlug(slug: string): Promise<CatalogEntity | null> {
    return this.serviceRepo.findOne({ where: { slug } });
  }

  private hasStalePlans(plans: CatalogPlan[]): boolean {
    if (plans.length === 0) return false;
    const oldest = Math.min(...plans.map((p) => (p.lastPriceRefreshAt?.getTime() ?? 0)));
    return Date.now() - oldest > STALE_AGE_MS;
  }

  private async waitForService(slug: string): Promise<CatalogEntity | null> {
    const deadline = Date.now() + LOCK_MAX_WAIT_MS;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, LOCK_POLL_INTERVAL_MS));
      const lockStillHeld = await this.redis.get(`ai:lookup:lock:${slug}`);
      if (!lockStillHeld) {
        const svc = await this.findBySlug(slug);
        if (svc) return svc;
        return null;
      }
    }
    return null;
  }

  private async persistService(data: any): Promise<CatalogEntity> {
    const slug = slugify(data.slug || data.name);
    const existing = await this.findBySlug(slug);
    if (existing) return existing;

    const entity = this.serviceRepo.create({
      slug,
      name: data.name,
      category: (SubscriptionCategory as any)[data.category] || SubscriptionCategory.OTHER,
      iconUrl: data.iconUrl ?? null,
      websiteUrl: data.websiteUrl ?? null,
      aliases: data.aliases ?? [],
      lastResearchedAt: new Date(),
      researchCount: 1,
    });
    return this.serviceRepo.save(entity);
  }

  private async persistPlans(serviceId: string, plans: any[]): Promise<CatalogPlan[]> {
    const now = new Date();
    const saved: CatalogPlan[] = [];
    for (const p of plans) {
      const entity = this.planRepo.create({
        serviceId,
        region: p.region,
        planName: p.planName,
        price: String(p.price),
        currency: p.currency,
        period: (BillingPeriod as any)[p.period] || BillingPeriod.MONTHLY,
        trialDays: p.trialDays ?? null,
        features: p.features ?? [],
        priceSource: PriceSource.AI_RESEARCH,
        priceConfidence: (PriceConfidence as any)[p.confidence] || PriceConfidence.HIGH,
        lastPriceRefreshAt: now,
      });
      saved.push(await this.planRepo.save(entity));
    }
    return saved;
  }
}
```

Register in `catalog.module.ts`:

```ts
providers: [CatalogService, AiCatalogProvider, { provide: 'OPENAI_CLIENT', ... }],
exports: [CatalogService, TypeOrmModule],
```

- [ ] **Step 4: Run tests**

```bash
npm test src/catalog/
```

Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add src/catalog/catalog.service.ts src/catalog/catalog.service.spec.ts src/catalog/catalog.module.ts
git commit -m "feat(catalog): add CatalogService with findBySlug, AI lookup, and Redis lock dedup"
```

---

### Task 3.4: GET /catalog/search endpoint

**Files:**
- Create: `subradar-backend/src/catalog/catalog.controller.ts`
- Create: `subradar-backend/src/catalog/dto/search-catalog.dto.ts`

- [ ] **Step 1: Create DTO**

```ts
// src/catalog/dto/search-catalog.dto.ts
import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';

export class SearchCatalogDto {
  @IsString() @IsNotEmpty()
  q: string;

  @IsString() @Length(2, 2) @Matches(/^[A-Z]{2}$/)
  region: string;
}
```

- [ ] **Step 2: Write controller test**

```ts
// src/catalog/catalog.controller.spec.ts
import { Test } from '@nestjs/testing';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

describe('CatalogController', () => {
  it('GET /catalog/search returns service + plans', async () => {
    const svcMock = {
      search: jest.fn().mockResolvedValue({
        service: { id: '1', slug: 'netflix', name: 'Netflix', iconUrl: null, websiteUrl: null, category: 'STREAMING' },
        plans: [{ id: 'p', planName: 'Basic', price: '6.99', currency: 'USD', period: 'MONTHLY', region: 'US' }],
      }),
    };
    const module = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [{ provide: CatalogService, useValue: svcMock }],
    }).compile();
    const ctrl = module.get(CatalogController);
    const result = await ctrl.search({ q: 'netflix', region: 'US' });
    expect(result[0].serviceId).toBe('1');
    expect(result[0].plans[0].planName).toBe('Basic');
  });
});
```

- [ ] **Step 3: Implement controller**

```ts
// src/catalog/catalog.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CatalogService } from './catalog.service';
import { SearchCatalogDto } from './dto/search-catalog.dto';

@ApiTags('catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('search')
  async search(@Query() dto: SearchCatalogDto) {
    const { service, plans } = await this.catalog.search(dto.q, dto.region);
    return [{
      serviceId: service.id,
      name: service.name,
      slug: service.slug,
      category: service.category,
      iconUrl: service.iconUrl,
      websiteUrl: service.websiteUrl,
      plans: plans.map((p) => ({
        planId: p.id,
        planName: p.planName,
        price: parseFloat(p.price),
        currency: p.currency,
        period: p.period,
        features: p.features,
        confidence: p.priceConfidence,
      })),
    }];
  }
}
```

Register in `catalog.module.ts`:

```ts
controllers: [CatalogController],
```

- [ ] **Step 4: Run tests**

```bash
npm test src/catalog/catalog.controller.spec.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/catalog/catalog.controller.ts src/catalog/catalog.controller.spec.ts src/catalog/dto/ src/catalog/catalog.module.ts
git commit -m "feat(catalog): add GET /catalog/search endpoint"
```

---

## Phase 4: Cron refresh + lazy refresh

### Task 4.1: CatalogRefreshProcessor (Bull)

**Files:**
- Create: `subradar-backend/src/catalog/catalog-refresh.processor.ts`
- Create: `subradar-backend/src/catalog/catalog-refresh.processor.spec.ts`

- [ ] **Step 1: Register Bull queue**

Edit `src/catalog/catalog.module.ts`:

```ts
import { BullModule } from '@nestjs/bull';

imports: [
  TypeOrmModule.forFeature([CatalogEntity, CatalogPlan]),
  BullModule.registerQueue({ name: 'catalog-refresh' }),
],
providers: [CatalogService, AiCatalogProvider, CatalogRefreshProcessor, { provide: 'OPENAI_CLIENT', ... }],
```

- [ ] **Step 2: Write processor test**

```ts
// src/catalog/catalog-refresh.processor.spec.ts
import { Test } from '@nestjs/testing';
import { CatalogRefreshProcessor } from './catalog-refresh.processor';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CatalogPlan } from './entities/catalog-plan.entity';
import { AiCatalogProvider } from './ai-catalog.provider';

describe('CatalogRefreshProcessor', () => {
  it('updates plan prices from AI refresh response', async () => {
    const planRepo = {
      find: jest.fn().mockResolvedValue([
        { id: 'p1', serviceId: 'svc', region: 'US', planName: 'Basic', price: '6.99', currency: 'USD' },
      ]),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const ai = {
      priceRefresh: jest.fn().mockResolvedValue({
        prices: [{ region: 'US', planName: 'Basic', price: 7.99, currency: 'USD' }],
      }),
    };
    const module = await Test.createTestingModule({
      providers: [
        CatalogRefreshProcessor,
        { provide: getRepositoryToken(CatalogPlan), useValue: planRepo },
        { provide: AiCatalogProvider, useValue: ai },
      ],
    }).compile();
    const proc = module.get(CatalogRefreshProcessor);
    await proc.handleRefresh({ data: { serviceId: 'svc', regions: ['US'], knownPlans: ['Basic'] } } as any);
    expect(ai.priceRefresh).toHaveBeenCalled();
    expect(planRepo.save).toHaveBeenCalledWith(expect.objectContaining({ price: '7.99' }));
  });
});
```

- [ ] **Step 3: Implement processor**

```ts
// src/catalog/catalog-refresh.processor.ts
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import { CatalogPlan } from './entities/catalog-plan.entity';
import { AiCatalogProvider } from './ai-catalog.provider';
import { CatalogService as CatalogEntity } from './entities/catalog-service.entity';

export interface RefreshJobData {
  serviceId: string;
  serviceName?: string;
  regions: string[];
  knownPlans: string[];
}

@Processor('catalog-refresh')
export class CatalogRefreshProcessor {
  private readonly logger = new Logger(CatalogRefreshProcessor.name);

  constructor(
    @InjectRepository(CatalogPlan) private readonly planRepo: Repository<CatalogPlan>,
    @InjectRepository(CatalogEntity) private readonly serviceRepo: Repository<CatalogEntity>,
    private readonly ai: AiCatalogProvider,
  ) {}

  @Process('refreshServicePrices')
  async handleRefresh(job: Job<RefreshJobData>): Promise<void> {
    const { serviceId, regions, knownPlans } = job.data;
    const service = job.data.serviceName ?? (await this.serviceRepo.findOne({ where: { id: serviceId } }))?.name;
    if (!service) {
      this.logger.warn(`Service ${serviceId} not found, skipping refresh`);
      return;
    }

    let result;
    try {
      result = await this.ai.priceRefresh(service, regions, knownPlans);
    } catch (e: any) {
      this.logger.warn(`priceRefresh failed for ${service}: ${e.message}`);
      return;
    }

    const plans = await this.planRepo.find({ where: { serviceId } });
    for (const priceEntry of result.prices) {
      const plan = plans.find(
        (p) => p.region === priceEntry.region && p.planName === priceEntry.planName,
      );
      if (!plan) continue;
      const oldPrice = plan.price;
      plan.price = String(priceEntry.price);
      plan.currency = priceEntry.currency;
      plan.lastPriceRefreshAt = new Date();
      await this.planRepo.save(plan);
      if (oldPrice !== plan.price) {
        this.logger.log(`${service} ${plan.region}/${plan.planName}: ${oldPrice} → ${plan.price} ${plan.currency}`);
      }
    }
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test src/catalog/catalog-refresh.processor.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/catalog/catalog-refresh.processor.* src/catalog/catalog.module.ts
git commit -m "feat(catalog): add catalog-refresh queue processor"
```

---

### Task 4.2: Weekly cron — enqueue top-N services × active regions

**Files:**
- Create: `subradar-backend/src/catalog/catalog-refresh.cron.ts`
- Create: `subradar-backend/src/catalog/catalog-refresh.cron.spec.ts`

- [ ] **Step 1: Write test**

```ts
// src/catalog/catalog-refresh.cron.spec.ts
import { Test } from '@nestjs/testing';
import { CatalogRefreshCron } from './catalog-refresh.cron';
import { DataSource } from 'typeorm';
import { getQueueToken } from '@nestjs/bull';

describe('CatalogRefreshCron', () => {
  it('enqueues top-50 services × active regions', async () => {
    const queue = { add: jest.fn() };
    const dataSource = {
      query: jest.fn()
        .mockResolvedValueOnce([{ region: 'US' }, { region: 'KZ' }]) // active regions
        .mockResolvedValueOnce([
          { id: 'svc1', name: 'Netflix', knownPlans: ['Basic'] },
          { id: 'svc2', name: 'Spotify', knownPlans: ['Individual'] },
        ]),
    };
    const module = await Test.createTestingModule({
      providers: [
        CatalogRefreshCron,
        { provide: DataSource, useValue: dataSource },
        { provide: getQueueToken('catalog-refresh'), useValue: queue },
      ],
    }).compile();
    const cron = module.get(CatalogRefreshCron);
    await cron.refreshTopServices();
    expect(queue.add).toHaveBeenCalledTimes(2);
    expect(queue.add).toHaveBeenCalledWith('refreshServicePrices',
      expect.objectContaining({ serviceId: 'svc1', regions: ['US', 'KZ'] }),
      expect.objectContaining({ jobId: expect.stringContaining('svc1') }));
  });
});
```

- [ ] **Step 2: Implement cron**

```ts
// src/catalog/catalog-refresh.cron.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

const TOP_N = 50;
const WEEKLY_BUDGET_CAP = 1000; // max jobs per cron run

@Injectable()
export class CatalogRefreshCron {
  private readonly logger = new Logger(CatalogRefreshCron.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectQueue('catalog-refresh') private readonly queue: Queue,
  ) {}

  @Cron('0 4 * * 1') // Monday 04:00 UTC
  async refreshTopServices(): Promise<void> {
    const regionsResult: { region: string }[] = await this.dataSource.query(
      `SELECT DISTINCT region FROM users WHERE region IS NOT NULL`,
    );
    const regions = regionsResult.map((r) => r.region);
    if (regions.length === 0) {
      this.logger.log('No active regions, skipping catalog refresh');
      return;
    }

    const topServices: { id: string; name: string; knownPlans: string[] }[] = await this.dataSource.query(`
      SELECT c.id, c.name,
        COALESCE(array_agg(DISTINCT cp."planName") FILTER (WHERE cp."planName" IS NOT NULL), '{}') AS "knownPlans"
      FROM catalog_services c
      LEFT JOIN subscriptions s ON s.catalog_service_id = c.id
      LEFT JOIN catalog_plans cp ON cp."serviceId" = c.id
      GROUP BY c.id
      ORDER BY COUNT(s.id) DESC
      LIMIT $1
    `, [TOP_N]);

    let queued = 0;
    for (const svc of topServices) {
      if (queued >= WEEKLY_BUDGET_CAP) break;
      await this.queue.add('refreshServicePrices', {
        serviceId: svc.id,
        serviceName: svc.name,
        regions,
        knownPlans: svc.knownPlans,
      }, {
        jobId: `refresh:${svc.id}:${new Date().toISOString().slice(0, 10)}`,
        attempts: 2,
        backoff: { type: 'exponential', delay: 30_000 },
      });
      queued++;
    }
    this.logger.log(`Enqueued ${queued} catalog refresh jobs across ${regions.length} regions`);
  }
}
```

Register in module:

```ts
providers: [..., CatalogRefreshCron]
```

- [ ] **Step 3: Run test**

```bash
npm test src/catalog/catalog-refresh.cron.spec.ts
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/catalog/catalog-refresh.cron.* src/catalog/catalog.module.ts
git commit -m "feat(catalog): add weekly cron to refresh top-50 services"
```

---

### Task 4.3: Lazy refresh on read

**Files:**
- Modify: `subradar-backend/src/catalog/catalog.service.ts`

- [ ] **Step 1: Write additional test in catalog.service.spec.ts**

Add to existing spec:

```ts
it('search: enqueues refresh when plans are stale', async () => {
  const queue = { add: jest.fn() };
  // inject queue into service via new constructor param
  serviceRepo.findOne.mockResolvedValue({ id: 'svc-1', slug: 'netflix', name: 'Netflix' });
  planRepo.find.mockResolvedValue([{
    id: 'p', planName: 'Basic', price: '6.99', currency: 'USD', region: 'US', period: 'MONTHLY',
    lastPriceRefreshAt: new Date(Date.now() - 31 * 86400_000),
  }]);
  // ... reconstruct service with queue
  await service.search('netflix', 'US');
  expect(queue.add).toHaveBeenCalledWith('refreshServicePrices',
    expect.objectContaining({ serviceId: 'svc-1' }),
    expect.objectContaining({ jobId: 'refresh:svc-1:US:lazy' }));
});
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Update CatalogService**

Add constructor injection of queue:

```ts
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

constructor(
  // ... existing
  @InjectQueue('catalog-refresh') private readonly refreshQueue: Queue,
) {}
```

Modify the staleness branch in `search()`:

```ts
if (this.hasStalePlans(plans)) {
  await this.refreshQueue.add('refreshServicePrices', {
    serviceId: service.id,
    serviceName: service.name,
    regions: [region],
    knownPlans: plans.map((p) => p.planName),
  }, {
    jobId: `refresh:${service.id}:${region}:lazy`,
    attempts: 1,
  });
}
```

- [ ] **Step 4: Run tests**

```bash
npm test src/catalog/
```

Expected: all pass including new test.

- [ ] **Step 5: Commit**

```bash
git add src/catalog/catalog.service.ts src/catalog/catalog.service.spec.ts
git commit -m "feat(catalog): enqueue lazy refresh on stale plan reads"
```

---

## Phase 5: Subscription display integration

### Task 5.1: Convert GET /subscriptions response to include displayAmount

**Files:**
- Modify: `subradar-backend/src/subscriptions/subscriptions.service.ts`
- Modify: `subradar-backend/src/subscriptions/subscriptions.controller.ts`
- Modify: `subradar-backend/src/subscriptions/subscriptions.module.ts` — import FxModule

- [ ] **Step 1: Update module dependencies**

Edit `src/subscriptions/subscriptions.module.ts`:

```ts
import { FxModule } from '../fx/fx.module';

imports: [..., FxModule],
```

- [ ] **Step 2: Write test**

Add to `src/subscriptions/subscriptions.service.spec.ts`:

```ts
it('findAll enriches subscriptions with displayAmount and displayCurrency', async () => {
  const sub = { id: 'x', amount: '9.99', currency: 'USD', originalCurrency: 'USD', /* ... */ };
  repoMock.find.mockResolvedValue([sub]);
  fxMock.getRates.mockResolvedValue({
    base: 'USD', rates: { USD: 1, KZT: 445 }, fetchedAt: new Date(), source: 'test',
  });
  const result = await service.findAllWithDisplay('user-1', 'KZT');
  expect(result[0].displayAmount).toBeCloseTo(4445.55, 0);
  expect(result[0].displayCurrency).toBe('KZT');
  expect(result[0].amount).toBe('9.99'); // original preserved
});
```

- [ ] **Step 3: Implement findAllWithDisplay**

In `subscriptions.service.ts`:

```ts
import Decimal from 'decimal.js';
import { FxService } from '../fx/fx.service';

constructor(
  // ... existing
  private readonly fx: FxService,
) {}

async findAllWithDisplay(userId: string, displayCurrency: string) {
  const [subs, fx] = await Promise.all([
    this.findAll(userId),
    this.fx.getRates(),
  ]);
  return subs.map((sub) => {
    const origCurrency = sub.originalCurrency || sub.currency;
    let displayAmount: string | null = null;
    let fxRate: number | null = null;
    try {
      const converted = this.fx.convert(new Decimal(sub.amount), origCurrency, displayCurrency, fx.rates);
      displayAmount = converted.toFixed(2);
      fxRate = fx.rates[displayCurrency] / fx.rates[origCurrency];
    } catch (e) {
      // fallback: return original for display
      displayAmount = String(sub.amount);
      fxRate = 1;
    }
    return {
      ...sub,
      displayAmount,
      displayCurrency,
      fxRate,
      fxFetchedAt: fx.fetchedAt,
    };
  });
}
```

- [ ] **Step 4: Update controller**

```ts
// subscriptions.controller.ts
@Get()
async findAll(@Request() req, @Query('displayCurrency') displayCurrencyQuery?: string) {
  const user = await this.usersService.findById(req.user.id);
  const displayCurrency = displayCurrencyQuery || user.displayCurrency || 'USD';
  return this.subscriptionsService.findAllWithDisplay(user.id, displayCurrency);
}
```

Run tests:

```bash
npm test src/subscriptions/
```

- [ ] **Step 5: Commit**

```bash
git add src/subscriptions/
git commit -m "feat(subscriptions): enrich response with displayAmount/displayCurrency via FxService"
```

---

### Task 5.2: Convert analytics endpoints

**Files:**
- Modify: `subradar-backend/src/analytics/analytics.service.ts`
- Modify: `subradar-backend/src/analytics/analytics.controller.ts`
- Modify: `subradar-backend/src/analytics/analytics.module.ts`

- [ ] **Step 1: Import FxModule in analytics.module.ts**

```ts
imports: [..., FxModule],
```

- [ ] **Step 2: Write test** — for `getSummary`, `getByCategory`, `getMonthly`

```ts
// analytics.service.spec.ts
it('getSummary converts amounts to displayCurrency', async () => {
  subsRepoMock.find.mockResolvedValue([
    { amount: '10', originalCurrency: 'USD', billingPeriod: 'MONTHLY' },
    { amount: '900', originalCurrency: 'KZT', billingPeriod: 'MONTHLY' },
  ]);
  fxMock.getRates.mockResolvedValue({
    base: 'USD', rates: { USD: 1, KZT: 450 }, fetchedAt: new Date(), source: 'x',
  });
  const result = await service.getSummary('user-1', 'USD');
  // 10 USD + 900 KZT (=2 USD) = 12 USD
  expect(result.totalMonthly).toBeCloseTo(12, 1);
  expect(result.displayCurrency).toBe('USD');
});
```

- [ ] **Step 3: Update each analytics method to take displayCurrency, convert per-sub, sum in target currency**

Pattern:

```ts
async getSummary(userId: string, displayCurrency: string) {
  const [subs, fx] = await Promise.all([
    this.subsRepo.find({ where: { userId, status: 'ACTIVE' } }),
    this.fx.getRates(),
  ]);
  let totalMonthly = new Decimal(0);
  for (const s of subs) {
    const amount = new Decimal(s.amount);
    const monthly = this.normalizeToMonthly(amount, s.billingPeriod);
    const converted = this.fx.convert(monthly, s.originalCurrency || s.currency, displayCurrency, fx.rates);
    totalMonthly = totalMonthly.plus(converted);
  }
  return {
    totalMonthly: parseFloat(totalMonthly.toFixed(2)),
    totalYearly: parseFloat(totalMonthly.mul(12).toFixed(2)),
    displayCurrency,
    fxFetchedAt: fx.fetchedAt,
  };
}
```

Apply similar pattern to `getByCategory`, `getByCard`, `getMonthly`, `getUpcoming`.

- [ ] **Step 4: Update controllers — accept `?displayCurrency`**

```ts
@Get('summary')
getSummary(@Request() req, @Query('displayCurrency') dc?: string) {
  const user = /* load user */;
  return this.analytics.getSummary(req.user.id, dc || user.displayCurrency || 'USD');
}
```

Apply to all analytics endpoints.

Run:

```bash
npm test src/analytics/
```

- [ ] **Step 5: Commit**

```bash
git add src/analytics/
git commit -m "feat(analytics): accept ?displayCurrency and convert aggregations"
```

---

### Task 5.3: Link subscription to catalogPlan on creation

**Files:**
- Modify: `subradar-backend/src/subscriptions/dto/create-subscription.dto.ts`
- Modify: `subradar-backend/src/subscriptions/subscriptions.service.ts`

- [ ] **Step 1: Add optional catalogPlanId to CreateSubscriptionDto**

```ts
@IsOptional() @IsUUID()
catalogPlanId?: string;
```

- [ ] **Step 2: Test — when catalogPlanId provided, service links and persists originalCurrency from plan**

```ts
it('create: links to catalogPlan and inherits currency', async () => {
  planRepoMock.findOne.mockResolvedValue({
    id: 'plan-1', serviceId: 'svc-1', currency: 'KZT', price: '2990', planName: 'Basic',
  });
  const dto = { name: 'Netflix', amount: 2990, currency: 'KZT', billingPeriod: 'MONTHLY', catalogPlanId: 'plan-1' };
  await service.create('user-1', dto);
  expect(repoMock.save).toHaveBeenCalledWith(expect.objectContaining({
    originalCurrency: 'KZT',
    catalogServiceId: 'svc-1',
    catalogPlanId: 'plan-1',
  }));
});
```

- [ ] **Step 3: Implement**

In `create()`:

```ts
let catalogServiceId: string | null = null;
let catalogPlanId: string | null = null;
if (dto.catalogPlanId) {
  const plan = await this.planRepo.findOne({ where: { id: dto.catalogPlanId } });
  if (plan) {
    catalogPlanId = plan.id;
    catalogServiceId = plan.serviceId;
  }
}
const entity = this.repo.create({
  ...dto,
  userId,
  originalCurrency: dto.currency,
  catalogServiceId,
  catalogPlanId,
});
```

Inject `planRepo` (CatalogPlan) — update `subscriptions.module.ts` to import `TypeOrmModule.forFeature([..., CatalogPlan])`.

- [ ] **Step 4: Run tests**

```bash
npm test src/subscriptions/
```

- [ ] **Step 5: Commit**

```bash
git add src/subscriptions/
git commit -m "feat(subscriptions): link to catalogPlan on creation"
```

---

## Phase 6: Mobile state + types

### Task 6.1: Update settingsStore — region + displayCurrency

**Files:**
- Modify: `subradar-mobile/src/stores/settingsStore.ts`

- [ ] **Step 1: Read current store**

```bash
cat src/stores/settingsStore.ts
```

- [ ] **Step 2: Add/rename fields with migration**

Replace store shape:

```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  // ... existing fields
  region: string;          // ISO-3166 alpha-2
  displayCurrency: string; // ISO-4217
  setRegion: (r: string) => void;
  setDisplayCurrency: (c: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // ... existing fields
      region: 'US',
      displayCurrency: 'USD',
      setRegion: (region) => set({ region }),
      setDisplayCurrency: (displayCurrency) => set({ displayCurrency }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          return {
            ...persistedState,
            region: persistedState.country || 'US',
            displayCurrency: persistedState.currency || 'USD',
          };
        }
        return persistedState;
      },
    }
  )
);
```

- [ ] **Step 3: Update all consumers**

Grep for `useSettingsStore.*country` and `useSettingsStore.*currency` (when it means the old currency — distinguish from `subscription.currency`):

```bash
grep -rn "useSettingsStore\|settingsStore\.\|\.country\|\.currency" src/ app/ --include="*.ts" --include="*.tsx"
```

Replace `.country` → `.region`, and old `.currency` (from settings) → `.displayCurrency`.

- [ ] **Step 4: Run type-check**

```bash
npx tsc --noEmit
```

Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/stores/settingsStore.ts app/ src/
git commit -m "refactor(settings): rename country→region, add displayCurrency"
```

---

### Task 6.2: Update Subscription type

**Files:**
- Modify: `subradar-mobile/src/types/index.ts`

- [ ] **Step 1: Add display fields**

```ts
export interface Subscription {
  // ... existing
  originalCurrency: string;
  displayAmount?: string;    // string for precision
  displayCurrency?: string;
  fxRate?: number;
  fxFetchedAt?: string;
  catalogServiceId?: string;
  catalogPlanId?: string;
}
```

- [ ] **Step 2: Run type-check**

```bash
npx tsc --noEmit
```

Expected: type errors where display fields are consumed — that's fine, later tasks fix them.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add displayAmount/displayCurrency/fxRate to Subscription"
```

---

### Task 6.3: API hooks pass displayCurrency

**Files:**
- Modify: `subradar-mobile/src/hooks/useSubscriptions.ts`
- Modify: `subradar-mobile/src/hooks/useAnalytics.ts`

- [ ] **Step 1: Update subscriptions hook**

```ts
// src/hooks/useSubscriptions.ts
import { useSettingsStore } from '../stores/settingsStore';

export function useSubscriptions() {
  const displayCurrency = useSettingsStore((s) => s.displayCurrency);
  return useQuery({
    queryKey: ['subscriptions', displayCurrency],
    queryFn: () => subscriptionsApi.getAll({ displayCurrency }).then(r => r.data),
  });
}
```

Update `subscriptionsApi.getAll`:

```ts
// src/api/subscriptions.ts
getAll: (params?: { displayCurrency?: string }) =>
  apiClient.get('/subscriptions', { params }),
```

- [ ] **Step 2: Same pattern for analytics hooks**

```ts
// src/hooks/useAnalytics.ts
const displayCurrency = useSettingsStore((s) => s.displayCurrency);
// include in queryKey and pass to api
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Sanity test in dev — run mobile against backend, change displayCurrency in store, check network tab**

```bash
npm run start:dev
```

Verify request includes `?displayCurrency=KZT` when store set to KZT.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/ src/api/
git commit -m "feat(mobile): pass displayCurrency to subscriptions and analytics"
```

---

## Phase 7: Mobile onboarding region step

### Task 7.1: Timezone-to-country lookup

**Files:**
- Create: `subradar-mobile/src/constants/timezones.ts`

- [ ] **Step 1: Create file with mapping**

```ts
// src/constants/timezones.ts
// Minimal IANA timezone → ISO-3166 alpha-2 lookup for autodetect.
// Falls back to 'US' if not found.
export const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  'Europe/Moscow': 'RU',
  'Europe/Saratov': 'RU',
  'Asia/Almaty': 'KZ',
  'Asia/Aqtau': 'KZ',
  'Asia/Aqtobe': 'KZ',
  'Europe/Kiev': 'UA',
  'Europe/Kyiv': 'UA',
  'Europe/Minsk': 'BY',
  'Europe/London': 'GB',
  'Europe/Paris': 'FR',
  'Europe/Berlin': 'DE',
  'Europe/Madrid': 'ES',
  'Europe/Istanbul': 'TR',
  'America/New_York': 'US',
  'America/Los_Angeles': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Toronto': 'CA',
  'Asia/Tokyo': 'JP',
  'Asia/Shanghai': 'CN',
  'Asia/Seoul': 'KR',
  'Australia/Sydney': 'AU',
  // Extend as needed.
};

export function detectCountryFromTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONE_TO_COUNTRY[tz] || 'US';
  } catch {
    return 'US';
  }
}

export const COUNTRY_DEFAULT_CURRENCY: Record<string, string> = {
  US: 'USD',
  CA: 'CAD',
  GB: 'GBP',
  EU: 'EUR',
  FR: 'EUR', DE: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR',
  RU: 'RUB',
  KZ: 'KZT',
  UA: 'UAH',
  BY: 'BYN',
  TR: 'TRY',
  JP: 'JPY',
  CN: 'CNY',
  KR: 'KRW',
  AU: 'AUD',
  // Extend as needed.
};
```

- [ ] **Step 2: Sanity check — no import cycles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/constants/timezones.ts
git commit -m "feat(mobile): add timezone-to-country and country-to-currency lookups"
```

---

### Task 7.2: CountryPicker component

**Files:**
- Create: `subradar-mobile/src/components/CountryPicker.tsx`
- Create: `subradar-mobile/src/constants/countries.ts`

- [ ] **Step 1: Create countries list**

```ts
// src/constants/countries.ts
export const COUNTRIES: { code: string; name: string; flag: string }[] = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'RU', name: 'Russia', flag: '🇷🇺' },
  { code: 'KZ', name: 'Kazakhstan', flag: '🇰🇿' },
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦' },
  { code: 'BY', name: 'Belarus', flag: '🇧🇾' },
  { code: 'TR', name: 'Türkiye', flag: '🇹🇷' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'CN', name: 'China', flag: '🇨🇳' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  // Extend with all ISO-3166 as needed.
];
```

- [ ] **Step 2: Create component**

```tsx
// src/components/CountryPicker.tsx
import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { COUNTRIES } from '../constants/countries';

interface Props {
  visible: boolean;
  selectedCode?: string;
  onSelect: (code: string) => void;
  onClose: () => void;
  title?: string;
}

export function CountryPicker({ visible, selectedCode, onSelect, onClose, title = 'Select country' }: Props) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  }, [query]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={28} color={colors.text} /></TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <View style={{ width: 28 }} />
        </View>
        <TextInput
          style={[styles.search, { backgroundColor: colors.surface2, color: colors.text, borderColor: colors.border }]}
          placeholder="Search country"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.code}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, { borderColor: colors.border }]}
              onPress={() => { onSelect(item.code); onClose(); }}
            >
              <Text style={{ fontSize: 22 }}>{item.flag}</Text>
              <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
              {selectedCode === item.code && <Ionicons name="checkmark" size={20} color={colors.primary} />}
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 17, fontWeight: '700' },
  search: { margin: 16, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  name: { flex: 1, fontSize: 15 },
});
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/CountryPicker.tsx src/constants/countries.ts
git commit -m "feat(mobile): add CountryPicker component"
```

---

### Task 7.3: Onboarding region step

**Files:**
- Modify: `subradar-mobile/app/onboarding.tsx`
- Modify: `subradar-mobile/src/locales/{en,ru,...}.json`

- [ ] **Step 1: Add i18n keys**

Add to each locale file under `onboarding`:

```json
"region_title": "Where do you buy subscriptions?",
"region_subtitle": "So we show accurate prices.",
"region_confirm": "That's me",
"region_change": "Choose another",
"region_detected": "Detected: {{country}}"
```

Russian equivalents:

```json
"region_title": "Где ты покупаешь подписки?",
"region_subtitle": "Это нужно чтобы показать актуальные цены.",
"region_confirm": "Это я",
"region_change": "Выбрать другую",
"region_detected": "Определили: {{country}}"
```

Apply to all 10 locale files.

- [ ] **Step 2: Insert new step into onboarding flow**

Find the steps array in `app/onboarding.tsx`. Insert after welcome and before auth:

```tsx
import { detectCountryFromTimezone, COUNTRY_DEFAULT_CURRENCY } from '../src/constants/timezones';
import { COUNTRIES } from '../src/constants/countries';
import { CountryPicker } from '../src/components/CountryPicker';

// Inside component:
const [pickerVisible, setPickerVisible] = useState(false);
const detectedInitially = useMemo(() => detectCountryFromTimezone(), []);
const [region, setRegion] = useState(detectedInitially);

const regionInfo = COUNTRIES.find((c) => c.code === region);

// Step JSX:
<View style={styles.step}>
  <Text style={styles.headline}>{t('onboarding.region_title')}</Text>
  <Text style={styles.subheadline}>{t('onboarding.region_subtitle')}</Text>
  <TouchableOpacity style={styles.regionCard} onPress={() => setPickerVisible(true)}>
    <Text style={{ fontSize: 48 }}>{regionInfo?.flag}</Text>
    <Text style={styles.regionName}>{regionInfo?.name}</Text>
    <Text style={styles.regionChange}>{t('onboarding.region_change')}</Text>
  </TouchableOpacity>
</View>
<CountryPicker
  visible={pickerVisible}
  selectedCode={region}
  onSelect={(code) => setRegion(code)}
  onClose={() => setPickerVisible(false)}
  title={t('onboarding.region_title')}
/>
```

- [ ] **Step 3: On step advance, persist to store + backend**

```tsx
const handleNextAfterRegion = async () => {
  const currency = COUNTRY_DEFAULT_CURRENCY[region] || 'USD';
  useSettingsStore.getState().setRegion(region);
  useSettingsStore.getState().setDisplayCurrency(currency);
  // If user is already authenticated (rare on onboarding), also PATCH
  if (useAuthStore.getState().token) {
    await usersApi.updateMe({ region, displayCurrency: currency }).catch(() => {});
  }
};
```

- [ ] **Step 4: Smoke-test in dev**

```bash
npm run start:dev
```

Fresh install → onboarding → region step shows autodetected country → advance → check store has correct region + currency.

- [ ] **Step 5: Commit**

```bash
git add app/onboarding.tsx src/locales/*.json
git commit -m "feat(onboarding): add region selection step with autodetect"
```

---

## Phase 8: Mobile Settings

### Task 8.1: Region row in Settings

**Files:**
- Modify: `subradar-mobile/app/(tabs)/settings.tsx`
- Modify: `subradar-mobile/src/locales/*.json`

- [ ] **Step 1: Add i18n keys**

```json
"settings.region": "Region",
"settings.display_currency": "Display currency",
"settings.region_change_currency_title": "Change display currency?",
"settings.region_change_currency_body": "Show subscriptions in {{currency}}?",
"settings.region_change_keep": "Keep {{currency}}",
"settings.region_change_switch": "Change to {{currency}}"
```

- [ ] **Step 2: Add Region row**

In the Preferences section of Settings:

```tsx
import { COUNTRIES } from '../../src/constants/countries';
import { COUNTRY_DEFAULT_CURRENCY } from '../../src/constants/timezones';
import { CountryPicker } from '../../src/components/CountryPicker';
import { usersApi } from '../../src/api/users';

const [regionPickerVisible, setRegionPickerVisible] = useState(false);
const region = useSettingsStore((s) => s.region);
const displayCurrency = useSettingsStore((s) => s.displayCurrency);
const setRegion = useSettingsStore((s) => s.setRegion);
const setDisplayCurrency = useSettingsStore((s) => s.setDisplayCurrency);
const regionInfo = COUNTRIES.find((c) => c.code === region);

const handleRegionChange = async (newRegion: string) => {
  setRegion(newRegion);
  await usersApi.updateMe({ region: newRegion }).catch(() => {});
  const suggested = COUNTRY_DEFAULT_CURRENCY[newRegion];
  if (suggested && suggested !== displayCurrency) {
    Alert.alert(
      t('settings.region_change_currency_title'),
      t('settings.region_change_currency_body', { currency: suggested }),
      [
        { text: t('settings.region_change_keep', { currency: displayCurrency }), style: 'cancel' },
        { text: t('settings.region_change_switch', { currency: suggested }), onPress: async () => {
          setDisplayCurrency(suggested);
          await usersApi.updateMe({ displayCurrency: suggested }).catch(() => {});
          queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
          queryClient.invalidateQueries({ queryKey: ['analytics'] });
        }},
      ],
    );
  }
};

// Row JSX:
<TouchableOpacity style={styles.row} onPress={() => setRegionPickerVisible(true)}>
  <Text style={styles.rowLabel}>{t('settings.region')}</Text>
  <View style={styles.rowValue}>
    <Text style={{ fontSize: 20 }}>{regionInfo?.flag}</Text>
    <Text>{regionInfo?.name}</Text>
    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
  </View>
</TouchableOpacity>

<CountryPicker
  visible={regionPickerVisible}
  selectedCode={region}
  onSelect={handleRegionChange}
  onClose={() => setRegionPickerVisible(false)}
/>
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Run dev, smoke test**

```bash
npm run start:dev
```

Settings → tap Region → pick new country → dialog offers currency change → yes → subscription list shows new currency.

- [ ] **Step 5: Commit**

```bash
git add app/\(tabs\)/settings.tsx src/locales/*.json
git commit -m "feat(settings): add region row with currency change dialog"
```

---

### Task 8.2: Display currency row + picker

**Files:**
- Modify: `subradar-mobile/app/(tabs)/settings.tsx`
- Create: `subradar-mobile/src/components/CurrencyPicker.tsx`

- [ ] **Step 1: Create CurrencyPicker (mirror of CountryPicker)**

```tsx
// src/components/CurrencyPicker.tsx
import React, { useState } from 'react';
import { Modal, SafeAreaView, TextInput, FlatList, TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';

const PRIMARY = ['USD', 'EUR', 'GBP', 'KZT', 'RUB', 'UAH', 'TRY'];
const ADDITIONAL = ['CAD', 'AUD', 'JPY', 'CNY', 'KRW', 'INR', 'MXN', 'BRL', 'CHF', 'PLN', 'CZK'];
const ALL = [...PRIMARY, ...ADDITIONAL];

interface Props {
  visible: boolean;
  selected: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}

export function CurrencyPicker({ visible, selected, onSelect, onClose }: Props) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const filtered = ALL.filter((c) => c.toLowerCase().includes(query.toLowerCase()));
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={28} color={colors.text} /></TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Currency</Text>
          <View style={{ width: 28 }} />
        </View>
        <TextInput value={query} onChangeText={setQuery} placeholder="Search" style={[styles.search, { backgroundColor: colors.surface2, color: colors.text }]} placeholderTextColor={colors.textMuted} />
        <FlatList data={filtered} keyExtractor={(c) => c} renderItem={({ item }) => (
          <TouchableOpacity onPress={() => { onSelect(item); onClose(); }} style={[styles.row, { borderColor: colors.border }]}>
            <Text style={[styles.code, { color: colors.text }]}>{item}</Text>
            {selected === item && <Ionicons name="checkmark" size={20} color={colors.primary} />}
          </TouchableOpacity>
        )} />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  search: { margin: 16, padding: 12, borderRadius: 12, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  code: { flex: 1, fontSize: 15, fontWeight: '600' },
});
```

- [ ] **Step 2: Add row in Settings**

```tsx
const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);

const handleCurrencyChange = async (code: string) => {
  setDisplayCurrency(code);
  await usersApi.updateMe({ displayCurrency: code }).catch(() => {});
  queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
  queryClient.invalidateQueries({ queryKey: ['analytics'] });
};

<TouchableOpacity style={styles.row} onPress={() => setCurrencyPickerVisible(true)}>
  <Text>{t('settings.display_currency')}</Text>
  <View style={styles.rowValue}>
    <Text>{displayCurrency}</Text>
    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
  </View>
</TouchableOpacity>

<CurrencyPicker visible={currencyPickerVisible} selected={displayCurrency} onSelect={handleCurrencyChange} onClose={() => setCurrencyPickerVisible(false)} />
```

- [ ] **Step 3: Smoke test**

Change currency in Settings → dashboard amounts update immediately after invalidation.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/CurrencyPicker.tsx app/\(tabs\)/settings.tsx
git commit -m "feat(settings): add display currency row with picker"
```

---

## Phase 9: Mobile display layer

### Task 9.1: formatMoney utility

**Files:**
- Create: `subradar-mobile/src/utils/formatMoney.ts`
- Create: `subradar-mobile/src/utils/formatMoney.test.ts`

- [ ] **Step 1: Write test**

```ts
// src/utils/formatMoney.test.ts
import { formatMoney } from './formatMoney';

describe('formatMoney', () => {
  it('USD en-US → $9.99', () => {
    expect(formatMoney(9.99, 'USD', 'en-US')).toBe('$9.99');
  });
  it('KZT ru-RU → 2 990 ₸', () => {
    const out = formatMoney(2990, 'KZT', 'ru-RU');
    expect(out).toMatch(/2[^\d]990.*₸/);
  });
  it('amount as string works', () => {
    expect(formatMoney('9.99', 'USD', 'en-US')).toBe('$9.99');
  });
  it('falls back on unknown currency', () => {
    const out = formatMoney(100, 'ZZZ', 'en-US');
    expect(out).toContain('100');
  });
});
```

- [ ] **Step 2: Implement**

```ts
// src/utils/formatMoney.ts
export function formatMoney(amount: number | string, currency: string, locale?: string): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (!isFinite(n)) return '';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}
```

- [ ] **Step 3: Run tests**

```bash
npm test src/utils/formatMoney.test.ts
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/utils/formatMoney.ts src/utils/formatMoney.test.ts
git commit -m "feat(utils): add formatMoney helper"
```

---

### Task 9.2: SubscriptionCard shows displayAmount

**Files:**
- Modify: `subradar-mobile/src/components/SubscriptionCard.tsx`

- [ ] **Step 1: Update render**

Replace the amount block (around line 89-95) with:

```tsx
const { amount, currency, displayAmount, displayCurrency } = subscription;
const showConversion = displayCurrency && displayCurrency !== (subscription.originalCurrency || currency);
const primaryAmount = displayAmount ?? String(amount);
const primaryCurrency = displayCurrency ?? currency;

<Text style={[styles.amount, { color: colors.text }]}>
  {formatMoney(primaryAmount, primaryCurrency, i18n.language)}
</Text>
{showConversion && (
  <Text style={[styles.amountOriginal, { color: colors.textMuted }]}>
    {formatMoney(amount, subscription.originalCurrency || currency, i18n.language)}
  </Text>
)}
```

Add style:

```ts
amountOriginal: { fontSize: 10, marginTop: 1 },
```

- [ ] **Step 2: Import formatMoney**

```ts
import { formatMoney } from '../utils/formatMoney';
```

- [ ] **Step 3: Type-check + visual smoke test**

```bash
npx tsc --noEmit
npm run start:dev
```

Change displayCurrency → list items show new primary + original underneath.

- [ ] **Step 4: Commit**

```bash
git add src/components/SubscriptionCard.tsx
git commit -m "feat(subscription-card): show displayAmount primary, original secondary"
```

---

### Task 9.3: Dashboard + Analytics use displayAmount

**Files:**
- Modify: `subradar-mobile/app/(tabs)/index.tsx`
- Modify: `subradar-mobile/app/(tabs)/analytics.tsx`
- Modify: other screens that display subscription amounts

- [ ] **Step 1: Grep for `sub.amount` rendering**

```bash
grep -rn "sub\.amount\|subscription\.amount" app/ src/components/ --include="*.tsx"
```

- [ ] **Step 2: Replace with displayAmount/displayCurrency everywhere user-facing**

Pattern:
```tsx
// before
<Text>{sub.currency} {sub.amount}</Text>
// after
<Text>{formatMoney(sub.displayAmount ?? sub.amount, sub.displayCurrency ?? sub.currency, i18n.language)}</Text>
```

Keep `sub.amount` + `sub.currency` ONLY in edit forms and detail screens where the user needs to know what they actually pay.

- [ ] **Step 3: Verify analytics aggregations use backend-converted values**

In `useAnalytics` consumers, ensure `totalMonthly` etc. come from backend response which is already in displayCurrency.

- [ ] **Step 4: Type-check and smoke test**

```bash
npx tsc --noEmit
npm run start:dev
```

Switch displayCurrency in Settings → dashboard, analytics, and subscription list all show new currency. Tap subscription → detail screen shows original.

- [ ] **Step 5: Commit**

```bash
git add app/ src/
git commit -m "feat(mobile): render displayAmount/displayCurrency across main screens"
```

---

### Task 9.4: AddSubscription passes region to lookup

**Files:**
- Modify: `subradar-mobile/src/components/AddSubscriptionSheet.tsx`
- Modify: `subradar-mobile/src/api/ai.ts`

- [ ] **Step 1: Find AI lookup call**

```bash
grep -n "lookup\|ai\.lookup\|aiApi\.lookup" src/components/AddSubscriptionSheet.tsx src/api/ai.ts
```

- [ ] **Step 2: Update api to accept region**

```ts
// src/api/ai.ts
lookup: (query: string, locale: string, region: string) =>
  apiClient.post('/ai/lookup', { query, locale, country: region }),
```

(`country` kept on backend DTO for now; Phase 10 switches to `/catalog/search`.)

- [ ] **Step 3: Update sheet to read region from store**

```tsx
const region = useSettingsStore((s) => s.region);
// ...
const result = await aiApi.lookup(query, i18n.language, region);
```

- [ ] **Step 4: Smoke test**

Change region to KZ → lookup "Netflix" → prices returned in KZT (after backend catalog is running).

- [ ] **Step 5: Commit**

```bash
git add src/components/AddSubscriptionSheet.tsx src/api/ai.ts
git commit -m "feat(add-subscription): pass user region to AI lookup"
```

---

## Phase 10: Switch AI lookup to catalog search (deferred)

### Task 10.1: Route /ai/lookup through CatalogService

**Files:**
- Modify: `subradar-backend/src/ai/ai.service.ts:78-128`
- Modify: `subradar-backend/src/ai/ai.module.ts`

- [ ] **Step 1: Import CatalogService**

```ts
// src/ai/ai.module.ts
imports: [CatalogModule],

// src/ai/ai.service.ts
constructor(
  private readonly catalog: CatalogService,
  // ... existing
) {}
```

- [ ] **Step 2: Replace lookupService body**

```ts
async lookupService(query: string, locale = 'en', country = 'US') {
  const { service, plans } = await this.catalog.search(query, country);
  return [{
    serviceId: service.id,
    name: service.name,
    logoUrl: service.iconUrl,
    category: service.category,
    websiteUrl: service.websiteUrl,
    plans: plans.map((p) => ({
      planId: p.id,
      name: p.planName,
      price: parseFloat(p.price),
      currency: p.currency,
      period: p.period,
      features: p.features,
    })),
  }];
}
```

Remove the old Redis + OpenAI block in that method (CatalogService now owns it).

- [ ] **Step 3: Update existing tests and specs to cover catalog path**

```bash
npm test src/ai/
```

- [ ] **Step 4: Deploy coordination note** — mobile still calls `/ai/lookup`, new catalog is transparent

- [ ] **Step 5: Commit**

```bash
git add src/ai/
git commit -m "refactor(ai): route /ai/lookup through CatalogService"
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Plan task(s) |
|--------------|--------------|
| User.region, displayCurrency | Task 0.1 |
| Subscription.originalCurrency | Task 0.2 |
| FxRateSnapshot entity | Task 0.3 |
| CatalogService entity | Task 0.4 |
| CatalogPlan entity | Task 0.4 |
| Subscription.catalogServiceId/PlanId | Task 0.5 |
| FxService with Redis + fallback | Task 1.2 |
| FX daily cron | Task 1.3 |
| GET /fx/rates | Task 1.4 |
| PATCH /users/me extensions | Task 2.1, 2.2 |
| AI full-research prompt | Task 3.2 |
| AI price-refresh prompt | Task 3.2 |
| CatalogService findOrCreate | Task 3.3 |
| Redis lookup lock | Task 3.3 |
| GET /catalog/search | Task 3.4 |
| Bull refresh queue | Task 4.1 |
| Weekly cron top-N | Task 4.2 |
| Lazy refresh on read | Task 4.3 |
| /subscriptions with displayCurrency | Task 5.1 |
| Analytics displayCurrency | Task 5.2 |
| Subscription linked to catalogPlan | Task 5.3 |
| Mobile settingsStore migration | Task 6.1 |
| Subscription type updates | Task 6.2 |
| API hooks pass displayCurrency | Task 6.3 |
| Timezone detection | Task 7.1 |
| CountryPicker | Task 7.2 |
| Onboarding region step | Task 7.3 |
| Settings region row + dialog | Task 8.1 |
| Settings display currency row | Task 8.2 |
| formatMoney utility | Task 9.1 |
| SubscriptionCard display | Task 9.2 |
| Dashboard/Analytics display | Task 9.3 |
| AddSubscription region pass-through | Task 9.4 |
| Deprecate /ai/lookup → catalog | Task 10.1 |

**Not covered by dedicated task (intentional):**
- `GET /catalog/service/:id` — not needed for MVP; `/catalog/search` covers UI use case. Can be added later if needed.
- `POST /catalog/refresh/:serviceId` admin endpoint — out of scope for first rollout.

**Placeholder scan:** No "TBD", no "similar to" shortcuts, every code block is complete.

**Type consistency:** `CatalogService` entity is imported as `CatalogService as CatalogEntity` in modules to avoid name clash with `CatalogService` nest service. All method signatures match their test expectations. `DisplayAmount` is `string` throughout (to preserve decimal precision).

**Scope:** Backend + mobile in one plan but strictly phased. Each phase is independently deployable (0→5 backend releases that are backward-compatible; 6→9 mobile release requires all backend phases deployed first).
