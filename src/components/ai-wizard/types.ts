/**
 * Shared types for the AIWizard subtree.
 *
 * The orchestrator (`AIWizard.tsx`) and each extracted stage
 * (BulkEditStage, future ConfirmStage, PlansStage, etc.) pull types from
 * here so we stop reaching back into the 1200-line component file.
 *
 * `ParsedSub` is re-exported from the canonical add-subscription types
 * module so both the AI-driven pipeline and the manual add-flow share a
 * single source of truth.
 */

export type { ParsedSub } from '../add-subscription/types';
import type { ParsedSub } from '../add-subscription/types';

export interface PlanOption {
  name: string;
  amount: number;
  billingPeriod: string;
  currency: string;
}

/**
 * AIWizard's local LoadingStage — note this is distinct from
 * `add-subscription/types#LoadingStage` which uses a different value set
 * ('transcribing' | 'analyzing' | 'thinking' | 'saving'). Keep separate
 * until the two flows are unified.
 */
export type LoadingStage = 'transcribing' | 'analyzing' | 'searching' | 'preparing' | null;

export type UIState =
  | { kind: 'idle' }
  | { kind: 'question'; text: string; field: string }
  | { kind: 'confirm'; subscription: ParsedSub }
  | { kind: 'bulk'; subs: ParsedSub[]; checked: boolean[] }
  | { kind: 'bulk-edit'; subs: ParsedSub[]; checked: boolean[]; editIdx: number }
  | {
      kind: 'plans';
      plans: PlanOption[];
      serviceName: string;
      iconUrl?: string;
      serviceUrl?: string;
      cancelUrl?: string;
      category?: string;
    };
