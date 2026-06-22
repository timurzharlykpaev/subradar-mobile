import { classifyTrialTransition } from '../trialTransition';

/**
 * The React/AsyncStorage shell can't be rendered in this repo's ts-jest/node
 * test env, so we unit-test the pure decision function — which is where the
 * grace-path churn bug lived (trial → grace → free must not drop trial_ended).
 */
describe('classifyTrialTransition', () => {
  it('marks while trialing', () => {
    expect(classifyTrialTransition('trial')).toBe('mark');
  });

  it('churns when dropped to free', () => {
    expect(classifyTrialTransition('free')).toBe('churn');
  });

  it('treats paid plans as conversion (no churn)', () => {
    expect(classifyTrialTransition('own')).toBe('convert');
    expect(classifyTrialTransition('team')).toBe('convert');
  });

  it('waits on grace states (NON-terminal) so trial → grace → free is not dropped', () => {
    expect(classifyTrialTransition('grace_pro')).toBe('wait');
    expect(classifyTrialTransition('grace_team')).toBe('wait');
  });

  it('is idle for unknown/undefined source', () => {
    expect(classifyTrialTransition(undefined)).toBe('idle');
    expect(classifyTrialTransition('something_else')).toBe('idle');
  });
});
