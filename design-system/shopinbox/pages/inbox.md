# Inbox / Chat — page overrides

> Overrides `design-system/shopinbox/MASTER.md` for the Inbox messaging surface.

## Goals (modern messenger feel)

- Clear outbound feedback: sending → sent → failed + retry
- Soft sync poll ~8s (no WebSocket yet)
- Day separators; sticky “tin mới”; empty thread state
- Bubble contrast: shop teal-700 on mint canvas; customer white surface
- Claim UX unchanged for staff; admin always composable
- Desktop: resizable + collapsible conversation list (persist width/collapse)
- List avatars: initials + channel color (no Meta profile URL in DB yet)
- Mobile: list ↔ chat ↔ customer tabs; back in chat header; ≥44px list rows

## Anti-patterns for this page

- Do not hide reactions hover-only on touch
- Do not spam mark-read / release on failure
- Do not export non-functions from `"use server"` actions
- Do not make drag the only way to resize (keyboard + collapse button required)
