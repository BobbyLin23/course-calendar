**Comparison target**

- Source visual truth: `docs/design-reference/super-timetable-weekly-classic.jpg`
- Supporting current references: `docs/design-reference/super-timetable-appstore-02.jpg`, `docs/design-reference/super-timetable-appstore-03.jpg`
- Implementation screenshot: `docs/design-reference/implementation-mobile.jpg`
- Viewport: 393 × 852 CSS px, device scale factor 1
- Pixels: source 480 × 800; implementation 393 × 852
- Normalization: both images were top-aligned and rendered into equal-width, 800 px-high comparison frames on `design-qa-comparison.html`; the source is a legacy promotional capture, so the surrounding artwork was treated as reference context rather than app-owned UI.
- State: light theme, current week, weekly timetable with three real sessions loaded

**Findings**

- No actionable P0, P1, or P2 differences remain.
- Typography: the implementation uses the product's Inter/system Chinese fallback with comparable compact weights and hierarchy. The reference's older display lettering is marketing artwork and was not copied into app UI.
- Spacing and layout rhythm: week controls, seven-day header, lesson axis, dashed half-hour guides, and course-cell proportions follow the reference hierarchy. The responsive web version uses a denser fixed seven-column mobile grid rather than horizontal day paging.
- Colors and visual tokens: cobalt primary, white timetable surface, cool-blue page background, black current-day pill, and pastel course blocks match the reference family while retaining semantic tokens.
- Image quality and asset fidelity: the timetable UI contains no decorative raster assets that need recreation. The existing product logo remains sharp; standard controls use the project's Lucide icon library.
- Copy and content: reference university-course copy was replaced with the app's real family-course names, locations, times, balances, and attendance state.

**Full-view comparison evidence**

- Combined browser capture: `docs/design-reference/design-comparison.jpg`, captured after both local images loaded.
- Shared visible structure: prominent week number, semester context, seven weekday columns, numbered lesson axis, colorful rounded course blocks, active-day emphasis, and bottom timetable navigation.

**Focused region comparison evidence**

- Header/date region: current day is shown as a dark rounded tile with blue weekday accent; week number and term context remain the strongest text hierarchy.
- Course/grid region: pastel course blocks align to the correct day and time, with a colored top edge, readable title, location, and time.
- No additional crop was required because both regions were legible in the combined 743 × 1066 browser capture.

**Comparison history**

- Initial pass: the 640–767 px range displayed both desktop header navigation and mobile bottom navigation. Fix: moved desktop navigation activation from `sm` to `md`; post-fix browser evidence shows only the bottom navigation at 743 px.
- Initial pass: the first implementation used Notion-derived class names and an hour-only gutter. Fix: replaced it with `super-*` timetable primitives, numbered lesson rows, a fixed seven-day mobile grid, pastel top-accented course blocks, and semester/week context.
- Detail pass: the automatic vertical position could be capped at a partial row, and the header/first row both owned the same horizontal boundary. Fix: resize-aware whole-row snapping plus single-owner bottom borders; measured time-axis and day-column bounds now match exactly.
- Post-fix result: browser rendering at 393 × 852 and 743 × 1066 has no body overflow, all seven days remain visible, and primary interactions work.

**Interaction and runtime checks**

- Previous week, next week, and “今天” navigation tested.
- Course filtering tested; lesson count and visible blocks update together.
- Course card tested; the details sheet opens with time, location, cost, balance, leave, and completion actions.
- Browser console reviewed. The only logged runtime error was from an earlier hot-reload intermediate state and was fixed before the final capture; the final rendered page has no active error state.

**Follow-up polish**

- P3: a future daily/list mode could mirror the current Super Timetable day-view pattern if that product scope is added.

final result: passed
