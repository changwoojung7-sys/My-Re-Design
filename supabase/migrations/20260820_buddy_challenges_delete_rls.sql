-- ================================================================
-- Allow DELETE on buddy_challenges for authenticated users
-- ================================================================

DROP POLICY IF EXISTS "Users can delete own buddy challenges" ON public.buddy_challenges;

CREATE POLICY "Users can delete own buddy challenges"
  ON public.buddy_challenges FOR DELETE
  USING (auth.uid() = creator_id OR auth.uid() = partner_id);

GRANT DELETE ON public.buddy_challenges TO authenticated;
