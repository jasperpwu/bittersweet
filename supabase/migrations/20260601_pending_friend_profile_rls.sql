-- Allow users to read profiles of people involved in a pending friendship
-- (either incoming or outgoing requests). Without this, the addressee cannot
-- see the requester's profile because the "Users can read friend profiles"
-- policy only covers accepted friendships.
CREATE POLICY "Users can read pending friend profiles" ON grove_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM grove_friendships
      WHERE status = 'pending'
      AND (
        (requester_id = auth.uid() AND addressee_id = grove_profiles.user_id)
        OR (addressee_id = auth.uid() AND requester_id = grove_profiles.user_id)
      )
    )
  );
