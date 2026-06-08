# Design QA

final result: passed

Viewport: 390 x 844 mobile.

Reference: selected concept 3 low-density revision.

Checks:
- Compact header and composer fit above the results.
- Top pinyin metadata row is removed.
- Random inspiration shows eight tappable character options on one row.
- Initial selector exposes 23 initials on the first screen with compressed spacing.
- Tone labels are consolidated into one global legend; repeated row labels are removed.
- Matching-tone result columns are highlighted.
- Result rows prioritize the selected initial, then nearby initials.
- Result left labels are weaker and occupy less width.
- Character options remove borders; each tone slot uses one larger lead character with smaller two-column alternatives.
- Result modules are shorter so the first mobile viewport shows at least three initial groups.
- Result list renders all available initial groups and scrolls internally like a contacts list.
- Clicking an initial scrolls the result list to that initial's group.
- Tone slots have no borders and keep equal widths.
- Bottom copy/favorite/continue action bar is hidden.
- Common-character filter is visible and enabled by default.
- Shuffle, initial switching, selection, and continue-query flow work in Playwright.

Remaining P3 polish:
- Bundle size can be reduced later by compressing or splitting the generated rhyme index.
