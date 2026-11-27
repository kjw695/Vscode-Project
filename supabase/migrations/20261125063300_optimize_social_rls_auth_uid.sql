-- Optimize auth.uid() evaluation in social feature RLS policies.
-- Wrapping auth.uid() in a scalar SELECT lets PostgreSQL evaluate it once
-- per statement rather than repeatedly for every candidate row.

ALTER POLICY "본인 게시글만 작성"
ON public.posts
WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY "본인 게시글만 수정"
ON public.posts
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY "본인 게시글만 삭제"
ON public.posts
USING ((SELECT auth.uid()) = user_id);

ALTER POLICY "본인만 댓글 작성"
ON public.comments
WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY "본인 댓글만 삭제"
ON public.comments
USING ((SELECT auth.uid()) = user_id);

ALTER POLICY "본인만 좋아요"
ON public.likes
WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY "본인 좋아요 삭제"
ON public.likes
USING ((SELECT auth.uid()) = user_id);
