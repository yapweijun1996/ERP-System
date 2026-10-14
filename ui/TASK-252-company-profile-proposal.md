# TASK-252 Company Profile MVP proposal

The SVG is an illustrative after mockup, not a live screenshot. It uses sample company data and shows a submit-time validation state.

## Layout and responsive behavior

Company profile sits inside the existing Admin / System Settings area. The Aria sidebar, top bar, Admin tabs, and mobile bottom navigation remain recognizable. Desktop groups the optional logo and identity fields in one card, with the registered address in a second card and a persistent save bar. At 375 px, the form stacks vertically except for the compact City / Postal Code row, the Admin tab strip scrolls horizontally, and Cancel / Save stay above the existing mobile navigation.

The logo control shows a preview, filename, Replace and Remove actions, and the supported PNG, JPEG, and WebP formats. Saving with a missing legal name shows both a page summary and an inline field error; values and the current logo preview remain visible for correction.

## Accessibility and risk

Use persistent labels, identify required fields in text, associate inline errors with their inputs, and move focus to the first invalid field after save. Keep a visible keyboard focus ring and announce save success or failure to assistive technology. Errors use an icon and message as well as color.

Before implementation, confirm field requiredness and jurisdiction-specific formats, edit permissions, and logo file size/dimension limits. Those rules are not defined by this visual proposal.
