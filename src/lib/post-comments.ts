/** One commenter keeps one comment thread across all posts, so pick only this post's comments + their public replies. */
export type ThreadMsg = { id: string; conversation_id: string; direction: string; body: string; post_external_id: string | null; sent_at: string };

export function samePost(a: string | null, postId: string): boolean {
  if (!a) return false;
  const tail = (s: string) => s.slice(s.lastIndexOf("_") + 1);
  return a === postId || tail(a) === tail(postId);
}

export function messagesForPost<T extends ThreadMsg>(msgs: T[], postId: string): T[] {
  const out: T[] = [];
  const onPost = new Map<string, boolean>();
  for (const m of [...msgs].sort((a, b) => a.sent_at.localeCompare(b.sent_at))) {
    if (m.direction === "inbound") {
      const ok = samePost(m.post_external_id, postId);
      onPost.set(m.conversation_id, ok);
      if (ok) out.push(m);
    } else if (m.body.startsWith("[public reply] ") && onPost.get(m.conversation_id)) {
      out.push(m);
    }
  }
  return out;
}
