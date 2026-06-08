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
- Result tone slots expose more character options where data is available.
- Common-character filter is visible and enabled by default.
- Bottom action bar no longer covers the first visible result row.
- Shuffle, initial switching, selection, and continue-query flow work in Playwright.

Remaining P3 polish:
- Bundle size can be reduced later by compressing or splitting the generated rhyme index.
