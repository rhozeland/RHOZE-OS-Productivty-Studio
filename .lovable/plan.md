
## Goal

Two intertwined features:

1. **Notes** — Instagram-style thought bubbles (≤60 words, expire in 24h) shown above the DM inbox and as a chip on the creator's profile avatar. The Stream composer's **Update** kind stops posting to Stream and writes a Note instead.
2. **Buddies** — bidirectional friend connections. The DM inbox's "Recent" section becomes "Buddies" (your active connections + their notes). You add buddies from someone's profile.

Notes and Buddies plug together: only buddies see your Note in their DM inbox; anyone visiting your profile sees the Note bubble on your avatar.

---

## Backend (one migration)

**Table `user_notes`**
- `user_id`, `body` (text, ≤300 chars ≈ 60 words, validated by trigger), `expires_at` (default `now() + interval '24 hours'`)
- One active note per user — unique partial index `where expires_at > now()`
- RLS: owner can insert/update/delete; SELECT visible to (a) the owner and (b) any user who is a confirmed buddy of the owner OR has the owner as a buddy. Profile-page reads are intentionally also allowed (notes are public-on-profile, mirroring Instagram).
- View `active_user_notes` filtering `expires_at > now()` for cheap reads.

**Table `user_buddies`**
- `requester_id`, `addressee_id`, `status` enum (`pending`, `accepted`, `blocked`), unique pair
- RLS: either party can read; requester can insert (pending); addressee can update status; either can delete (unfriend)
- Helper RPC `are_buddies(a uuid, b uuid) returns boolean` (security definer) used by the notes RLS policy.

**Cleanup**: nightly cron isn't required — `expires_at` filter is enough. Optionally a `pg_cron` sweep that hard-deletes rows > 7 days old.

---

## Frontend changes

### Stream composer (`src/components/stream/StreamComposer.tsx`)
- The **Update** kind no longer creates a stream post. Selecting Update now opens the Note composer (small modal: textarea capped at 60 words live counter, "Post note · expires in 24h"). Posting writes to `user_notes` and toasts.
- Other kinds (Offering / Event / Space / Work) unchanged.

### New components
- `src/components/notes/NoteComposer.tsx` — modal with word counter, post + delete
- `src/components/notes/NoteBubble.tsx` — small chip used on avatars (rounded, "speech-bubble" tail)
- `src/components/notes/BuddyNotesRow.tsx` — horizontal scroller of buddy avatars + their notes, mounted at the top of the DM inbox (matches the user's screenshot)

### Profile (`src/pages/ProfileDetailPage.tsx`)
- Render `<NoteBubble />` over the top-right of the avatar when an active note exists.
- Add **Add buddy / Pending / Buddies** button next to Follow/Message/Book in the Support tab actions row. Reuses existing follow-button styling.

### Conversations (`src/pages/MessagesPage.tsx`, DMs tab)
- Replace the "Recent contacts" section with `<BuddyNotesRow />` at the top: first tile is "Your note" (composer trigger), then each buddy with their note bubble.
- "Buddies" sub-list under it with online indicator + last message preview (existing DM list, but filtered to confirmed buddies — non-buddy threads stay accessible via search/Requests).

### Hooks
- `useUserNote(userId)` — fetch active note for a user
- `useMyNote()` — current user's note + post/delete mutations
- `useBuddies()` — list of accepted buddies + counts of pending requests
- `useBuddyStatus(otherUserId)` — `none | pending_out | pending_in | accepted | blocked` for the profile button

---

## Memory updates

Add core-line: *"Notes (v8.9): Instagram-style 60-word, 24h thought bubbles. Update composer writes a Note (not a Stream post). Visible on owner's avatar (profile + DM inbox) and to buddies in DM inbox via `<BuddyNotesRow />`. Backed by `user_notes` + `user_buddies` tables."*

Add memory file `mem://features/notes-and-buddies` with the schema + visibility rules.

---

## Out of scope (this pass)

- Push/email notifications when a buddy posts a note
- Reactions / replies on notes (Instagram-style ❤️ reply) — leave as a follow-up
- Block list UI (RLS supports it, no surface yet)
- Migrating any historical "update" stream posts — they stay where they are; only future Update clicks route to Notes
