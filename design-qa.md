# Runnrr workstation QA

final result: passed

## Findings

No actionable P0/P1/P2 visual findings remain in the implemented scope. This
passes the approved adaptation of the supplied design, not a pixel-identical
reproduction of its simulated business workflows.

The live provider returned HTTP 401 for the existing Anthropic credential. The
UI displayed the failure and offered a fresh chat. Successful streaming and tool
rendering were checked with a temporary local provider fixture and the real
calculator tool; this does not establish successful live model authentication.

## Evidence and normalization

- Source visual truth: `docs/design/screenshots/Screenshot 2026-09-22 at 3.43.40 PM.png`
  and the accompanying `3.44.43 PM.png` screenshot; original export in
  `docs/design/source/Runnrr Workstation.dc.html`.
- Source first screenshot: 1578 × 1980 pixels, including the design editor toolbar.
  Compared app crop: `(12, 84)` through `(1566, 1964)`, 1554 × 1880 pixels,
  normalized to 868 × 1050 (approximately 1.79 source pixels per comparison pixel).
  The source's actual CSS viewport/device scale is not recorded by its export.
- Implementation: `docs/design/qa-chat-desktop.png`, 868 × 1050 pixels at a
  browser CSS viewport of 868 × 1050, effective screenshot density 1.
- Full-view comparison: `docs/design/qa-comparison.png`. Both artifacts were
  opened together after normalization, without editor chrome.
- Focused comparison: `docs/design/qa-comparison-detail.png`, showing the upper
  navigation/header/controls and lower agent dock/composer at readable scale.
- Additional rendered evidence: `docs/design/workstation-desktop.png` and
  `docs/design/qa-tools.png` at 1440 × 1000; `docs/design/qa-chat-mobile.png`
  at 390 × 844. All are browser screenshots, not generated mockups.
- Final live route: `http://127.0.0.1:8001/`.

State difference: the source shows a completed Front Desk integration demo;
the populated implementation capture shows a completed Research Analyst
calculator turn with a deterministic reply, including deliberate unsafe-link
test text. Compare the shared shell and conversation hierarchy, not sentence
wrapping or the number of simulated integration actions. The final desktop
capture shows the actual Customer Service profile's empty state.

## Required fidelity surfaces

| Surface | Assessment |
| --- | --- |
| Fonts and typography | Inter for interface/body text and Space Grotesk for the wordmark/display heading preserve the clean sans-serif direction. System fallbacks are defined. Header, message, tool, and secondary-label hierarchy remain clear; long chat names truncate in the sidebar. The larger wordmark is intentional polish. |
| Spacing and layout | White sidebar, pale conversation surface, top header, dark user bubble, tool pills, and bottom composer retain the reference hierarchy. Sidebar is 280px on desktop and 255px at the normalized comparison width; extra search/new-chat controls intentionally shift the list down. Mobile uses a dismissible navigation overlay and keeps the composer visible. |
| Colors and tokens | White/light-gray surfaces, charcoal text/user bubbles, orange accent, and restrained green status remain consistent with the reference. The send control is gray when empty and orange when enabled. Focus outlines and explicit status words supplement color. |
| Image and asset quality | The reference uses text branding and letter avatars, retained as such for real profiles. Standard icons use original vendored Heroicons SVG assets. No product photography or illustration is required, and no raster artwork was replaced with CSS art. Icons remain sharp at desktop/mobile sizes. |
| Copy and content | Navigation labels preserve the source. Real profile names, descriptions, tools, and skills replace staged data. Temporary-chat copy explains reload behavior. Attachments, channels, and automations clearly expose their unavailable state. Tool/source labels never promise a nonexistent download. |

## Interaction checks

- Real API health, model/profile discovery, profile switching, and business-agent
  suggestions rendered in the browser.
- Successful streamed text, actual calculator completion, usage totals, Markdown,
  and source-panel metadata rendered using the temporary provider fixture.
- Script markup was removed; only the HTTPS test link remained clickable.
- Pinning, search, new chats, and per-chat state worked; reload cleared chats,
  drafts, and pins as intended.
- Skills/tools were read-only; channels/automations/attachments remained unavailable.
- Mobile navigation, search, Escape dismissal/focus return, and source-panel
  open/close worked. At 390px, document scroll width equaled client width.
- Empty, focused, disabled, completed-tool, and provider-error states were inspected.
- Browser warning/error console check returned no entries in the final preview.
- Backend suite: 385 passed, 1 skipped. Native Node checks cover fragmented SSE,
  Unicode, tool lifecycle/errors, session isolation, usage, and safe URLs.

## Comparison history

Before formal comparison, implementation smoke checks corrected an oversized
welcome icon and verified the resulting desktop screenshot. The first combined
comparison used an incorrect source crop; it was discarded and regenerated
from the measured full source dimensions above. The corrected full-view and
focused comparisons found no actionable P0/P1/P2 visual differences within the
approved adaptation, so no subsequent visual fix iteration was required.

Intentional differences: no simulated Front Desk/Billing profiles, integration
results, clarification forms, downloadable attachments, durable history, or
agent-creation UI. Existing profiles and temporary conversations follow the
approved scope. Thinking events show a generic work indicator rather than raw
reasoning. Added search, new-chat controls, source filters, and error handling
support real use.

## Implementation checklist

- [x] Replace prior UI and retain supplied source references.
- [x] Connect real profile/tool/skill data and streamed chat.
- [x] Verify desktop, intermediate-width, and mobile layouts.
- [x] Compare full views and focused regions together.
- [x] Save screenshots and update run instructions.

## Follow-up and test gaps

No visual P3 follow-up is required for this handoff. Live model answers require
a valid provider credential. A full screen-reader audit, every browser engine,
and unavailable future integrations are outside this verification. Missing RAG
indexes for the pre-existing Frampton and Personal Agent profiles remain a
separate runtime setup task.
