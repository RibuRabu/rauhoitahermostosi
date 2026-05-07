# AGENTS.md

## Project

This repository contains Rauhoita hermostosi, a static interactive NFC-opened digital book based on an existing Finnish manuscript.

## Source of truth

The primary content source is:

`content/rauhoita-hermostosi.md`

Use this Markdown file as the source of truth.

Do not rewrite the manuscript.
Do not summarize it.
Do not invent new chapters.
Do not change the order.
Do not rename sections unless explicitly asked.

## Product framing

This is not a normal online course.
This is not a wellness landing page.
This is an interactive NFC digital book.

Use the product framing:

“Interaktiivinen NFC-kirja”

## Tech constraints

Use only:

- HTML
- CSS
- vanilla JavaScript
- localStorage

Do not use:

- React
- Tailwind
- TypeScript
- npm packages
- backend
- database
- external CDN
- build step

## Visual direction

The visual language must feel like entering a quiet, slightly uncanny inner system.

Not wellness.
Not meditation app.
Not generic AI dark UI.
Not calm SaaS.

Feeling:
- strange but not horror
- bodily, not decorative
- quiet but charged
- like standing inside the nervous system
- like a digital book found in a hidden room
- slightly magnetic, slightly uncomfortable
- mahanpohjaa kutittava

Core atmosphere:
- liminal
- organic
- nocturnal
- tactile
- old book + bioelectric interface
- forest floor + nervous system + hidden control room

Avoid:
- generic gradient blobs
- stock wellness imagery
- yoga silhouettes
- smiling people
- medical diagrams
- childish game UI
- badges, stars, points
- obvious cyberpunk
- AI-fantasy clutter

Design test:
If it looks like a startup landing page, it failed.
If it looks like a meditation app, it failed.
If it feels like a quiet, strange digital book that might know something about your body before you do, it is closer.

## Required features

Build a static interactive reader with:

- start page
- table of contents
- reader view
- previous / next navigation
- reading progress
- completed section state
- localStorage persistence
- reset progress button
- optional video slot at the beginning of each main section
- observation prompt at the end of each main section
- final summary page based on saved observations

## Disclaimer

Keep this disclaimer visible somewhere in the app:

“Tämä sivu on tarkoitettu hermoston rauhoittamiseen. Se ei ole hoitoa eikä korvaa terveydenhuollon tukea. Jos olosi on pitkään hyvin kuormittunut, hae apua myös oikeilta ihmisiltä.”