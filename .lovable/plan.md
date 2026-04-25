
# Why people aren't signing up (and what to do about it)

This is the most common growth problem for creator/social platforms — and the good news is your codebase is already 80% set up to fix it. You have:

- Public routes for `/`, `/flow`, `/marketplace`, `/studios`, `/creators`, `/projects`, `/profiles/:id`
- An `AuthGateDialog` system that prompts on action (not on entry)
- A `GuestDashboardPreview`, `FlowGuestCTA`, `GuestMessagesPreview`

The problem: **guests still land on `/` (Dashboard) which is built for logged-in users**, and the home/landing experience doesn't sell the "you can try it without an account" story. The signup ask comes too early, with too little proof.

This plan is a 3-layer fix: rework the **front door**, harden **guest browsing depth**, and time the **signup ask** to a moment of intent.

---

## Layer 1 — Rework the front door (biggest lever)

**Current state:** Visiting `rhozeland.app` sends a guest straight to `DashboardPage`, which then shows `<GuestDashboardPreview />`. It's a "your dashboard but empty" feel — not "look what's happening here."

**Change:**

1. Make `/` route guests to a redesigned **public home** (could be `LandingPage` upgraded, or a new `HomePage` that authed users skip). Authed users continue straight to `/dashboard`.
2. The new home leads with **live social proof from the platform itself**, not stock copy:
   - Live Flow feed strip (5–6 most recent public posts, swipeable)
   - "Creators online now" / recent signups counter (real number from `profiles`)
   - Featured studios + recent project ships (real data)
   - Top earners this week ($RHOZE leaderboard slice)
3. Two CTAs side-by-side, equal weight:
   - **"Explore as guest"** → `/flow` (no account needed)
   - **"Sign up free"** → `/auth`
4. Frame the value prop around **what you get for signing up**, not what the app does:
   - "Earn $RHOZE for posting, swiping, and commenting"
   - "Save creators and posts you love"
   - "Get DMs from collaborators"
   - "Free — no credit card, sign up with Google in 10 seconds"

The current `/landing` route already exists and can be repurposed/upgraded for this — no new route needed.

## Layer 2 — Make guest browsing actually feel like the product

Right now guest mode is technically open but feels like a paywall preview. Tighten it so guests get the real thing:

1. **`/flow` for guests** — already works. Verify the floating CTA isn't dismissable forever (currently `localStorage` persists indefinitely — consider re-showing after 24h or after N swipes).
2. **`/creators` and `/profiles/:id`** — guests should see full profiles, including portfolios and badges. Today there's no `GuestCreatorsPreview` blocker — confirm and lean into it.
3. **`/studios` and `/marketplace`** — guests should see full listings + prices. Auth gate fires only on "Book" / "Buy" / "Message seller."
4. **Add a persistent, low-key guest banner** at the top of public pages: *"You're browsing as a guest. Sign up to save, post, and earn → "* (dismissable, but reappears on a different surface).

## Layer 3 — Move the signup ask to the moment of intent

The `AuthGateDialog` already does this for some actions. Audit and expand:

- Posting to Flow → gate (already there via `SignUpToPostPrompt`)
- Saving a creator/post → gate
- Sending a DM / inquiry → gate
- Booking a studio → gate
- Buying a listing → gate
- Liking/commenting → gate

Each gate dialog should be **contextual** — instead of "Sign in to unlock this feature," say "Sign up to save this post" or "Sign up to message {creatorName}." This is a 5-minute copy change with outsized impact.

## Layer 4 — Reduce signup itself to ~10 seconds

Verify on `/auth`:

- Google sign-in is the **primary, top button** (one click, no email verification)
- Email signup is below it as a fallback
- Don't require email confirmation before letting them in (already configurable — confirm current setting)
- After signup, drop them back where they were (the existing `?redirect=` param in `AuthGateDialog` already does this — confirm it's used everywhere)

---

## Optional — if friction is *still* high after the above

- **Anonymous "watch-only" account**: auto-create a session-scoped guest profile so swipes/saves/views persist for 7 days. If they sign up, merge. (Heavier lift — only if Layer 1–4 don't move the needle.)
- **Invite-only beta framing** with a waitlist + referral code. Sometimes scarcity flips the script from "why should I sign up" to "I want in." Works well in crypto-adjacent communities.

---

## What I'd do this round (recommended scope)

The cheapest, highest-impact slice — ship this first, then measure:

1. Rework the home page (`LandingPage` or new `HomePage`) with live platform data + dual CTA
2. Route guests at `/` to the new home; keep authed users on `/dashboard`
3. Rewrite all `requireAuth()` messages to be contextual ("Sign up to save this post", etc.)
4. Make Google sign-in the dominant button on `/auth`
5. Add one persistent, dismissable guest banner across public pages

That's roughly 4–6 file changes and one new component. Skips the heavy lifts (anonymous accounts, waitlist) until you have data showing they're needed.

---

## Questions before I build

I want to make sure we ship the version that matches your gut, not just my best guess:

- Do you want to **keep `/` going to Dashboard for everyone** and just upgrade `/landing`, or **send guests to the new home and authed users to `/dashboard`**? (I'd recommend the latter.)
- Do you want the **live Flow strip on the home page** (real posts) or **curated/static highlights** for now? (Live = stronger proof, takes a bit more work.)
- Should I include the **"Creators online / recent signups" counter** as a real number, or skip the live stat for v1?
- Any **specific feedback verbatim** from the people who said they wouldn't sign up? Their exact words usually point to the real objection (privacy? "yet another app"? crypto skepticism? unclear value?). If you can paste 1–2 quotes I'll tune the copy to those objections.

If you want to skip the questions and just ship the recommended scope above, say "go" and I'll start.
