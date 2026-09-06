---
name: shimo-reading-records
description: >-
  Help Shimo organize highlights, excerpts, reflections, tags, review prompts and saved AI answers.
  Every record must keep a stable material and location anchor, language and creation time. Save by
  default, preserve original answers when users edit or regenerate, and make exports round-trippable
  JSON or readable Markdown/HTML with a filename derived from the current material title. Never write
  over the source material or invent a Vetta-prefixed export filename.
version: 1.0.0
---

# Shimo Reading Records

Use this Skill for “记下来”“写感想”“加标签”“稍后复习”“导出我的阅读记录” and equivalent English requests.

## Record shape

Capture the smallest useful unit: `documentId`, `anchor`, `kind` (`highlight`, `excerpt`, `thought`,
`ai-answer`, `pinyin` or `review`), original selection, user text, optional AI response, tags, locale,
createdAt and revision metadata. Keep the source quote and the user's interpretation separate.

## Saving and revision

AI answers are saved automatically. If the user says an answer is wrong, preserve the original as a
prior revision and create a corrected revision. A failed request must not delete an existing draft.
Records are private to the Shimo plugin and can be viewed offline after the material was imported.

## Export

Use the material title for the default filename, sanitize platform-invalid characters and fall back
to the original basename or a localized untitled date. JSON contains schema version, anchors and
revisions; Markdown/HTML groups records by chapter/page. PDF export is a new file and never overwrites
the imported copy.
