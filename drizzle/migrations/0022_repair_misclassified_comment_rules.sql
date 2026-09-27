-- Repair comment-to-DM rules accidentally saved as ordinary DM rules.
-- Restrict the repair to unmistakable comment intent so genuine DM rules stay untouched.
update public.automation_rules
set
  trigger = 'comment_received'::public.automation_trigger,
  action = 'comment_private_reply'::public.automation_action
where trigger = 'dm_received'::public.automation_trigger
  and action = 'reply_dm'::public.automation_action
  and (
    cardinality(target_post_ids) > 0
    or nullif(btrim(comment_reply_text), '') is not null
    or lower(btrim(name)) = 'new post comment'
  );
