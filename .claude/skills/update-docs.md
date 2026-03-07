# Skill: Update Documentation

When making changes to mobile code, update the relevant documentation:

1. **New screen** -> Update `docs/MOBILE_SCREENS.md` and `docs/NAVIGATION_MAP.md`
2. **New/changed API call** -> Verify against `docs/API_CONTRACTS.md`
3. **New/changed type or entity** -> Verify against `docs/DOMAIN_MODEL.md`
4. **Changed subscription status handling** -> Verify against `docs/STATE_RULES.md`
5. **Completed MVP screen** -> Update screen status in `PROGRESS.md`
6. **New analytics event** -> Document in `docs/MOBILE_SCREENS.md` under the screen's Events section

Shared docs (PRODUCT_OVERVIEW, DOMAIN_MODEL, API_CONTRACTS, BILLING_RULES, AI_BEHAVIOR, STATE_RULES) canonical source is subradar-backend. Update there first if backend changes are needed.
