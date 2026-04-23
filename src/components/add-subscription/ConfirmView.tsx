import React, { memo } from 'react';
import { InlineConfirmCard, ConfirmCardData } from '../InlineConfirmCard';

interface Props {
  data: ConfirmCardData;
  onSave: (data: any) => Promise<void> | void;
  onCancel: () => void;
  saving?: boolean;
}

// Thin wrapper over InlineConfirmCard so the flow render switch stays declarative.
// All form state (name / amount / period / showMore) remains local to
// InlineConfirmCard — ConfirmView just forwards the confirm→save contract.
function ConfirmViewImpl({ data, onSave, onCancel, saving }: Props) {
  return (
    <InlineConfirmCard
      data={data}
      onSave={onSave}
      onCancel={onCancel}
      saving={saving}
    />
  );
}

export const ConfirmView = memo(ConfirmViewImpl);
