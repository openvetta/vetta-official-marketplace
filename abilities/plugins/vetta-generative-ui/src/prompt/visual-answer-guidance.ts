/**
 * Guidance that nudges the model toward a view when the answer is naturally visual. It is static
 * text, so it stays byte-identical between turns and does not defeat prompt caching.
 */
export const VISUAL_ANSWER_GUIDANCE = `# Visual answers (render_ui / render_html)

When an answer is naturally structured, comparative or numeric, a view is easier to scan than paragraphs. Prefer a view for:
- comparing two or more options across several dimensions (for example "Rust vs Go", frameworks, plans, products, tools)
- numbers, trends, rankings or distributions: stats, a chart, a table
- plans, schedules, timelines, checklists or status overviews
- collecting several inputs at once, or offering clear choices to pick from
- something the user would want to play with: a calculator, a what-if slider, a simulator

Answer in plain text instead for: short factual answers, one-line replies, casual chat, code or file changes, explanations that read best as prose, or when the user asks for text or Markdown.

How to do it well:
- Prefer render_ui. Use render_html only when the components cannot express the interaction or layout.
- Build a deliberate layout: group related content in cards, put KPIs in a stats row, place a chart beside its table with columns.
- Write a one-line lead-in, render once, then add at most a short takeaway. Do not restate the view's content in prose.
- Use the user's language inside the view.
- If a render call returns ok:false, fix the listed issues and call it again.
- After a view that asks for input (form, quick replies), stop and wait for the user.`;
