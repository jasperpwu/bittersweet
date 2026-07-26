import React, { FC, useState } from 'react';
import { Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Typography } from './Typography';
import { previewSessionNotes } from '../../utils/textUtils';

interface SessionNotesProps {
  notes: string;
}

/**
 * A session note in a feed, Instagram-style: clamped to a short preview with a
 * "more" affordance, expanding in place on tap.
 *
 * Only the truncated case is pressable — a short note renders as plain text, so
 * there is no dead tap target and no "more" label on a note that is already whole.
 * Once expanded it stays expanded (no "less"), matching the feeds it mirrors.
 */
export const SessionNotes: FC<SessionNotesProps> = ({ notes }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const { preview, isTruncated } = previewSessionNotes(notes);

  if (!isTruncated || expanded) {
    return (
      <Typography variant="body-12" color="secondary">
        {notes}
      </Typography>
    );
  }

  return (
    <Pressable onPress={() => setExpanded(true)} hitSlop={4}>
      <Typography variant="body-12" color="secondary">
        {preview}
        {'… '}
        <Typography variant="body-12" color="primary">
          {t('common.more')}
        </Typography>
      </Typography>
    </Pressable>
  );
};
