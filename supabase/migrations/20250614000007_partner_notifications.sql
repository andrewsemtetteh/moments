-- Allow partners to send in-app notifications to each other (watch party nudges, etc.).

CREATE POLICY notifications_partner_insert ON public.notifications FOR INSERT WITH CHECK (
  relationship_id IN (SELECT user_relationship_ids())
  AND user_id IN (
    SELECT CASE
      WHEN user_1_id = auth.uid() THEN user_2_id
      WHEN user_2_id = auth.uid() THEN user_1_id
    END
    FROM relationships
    WHERE id = relationship_id
      AND status = 'active'
  )
);
