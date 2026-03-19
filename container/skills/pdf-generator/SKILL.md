---
name: pdf-generator
description: Generate beautiful PDF documents from HTML+CSS and send them via WhatsApp. Use whenever the user asks for a report, itinerary, summary, tutorial, price comparison, or any structured document worth formatting nicely.
allowed-tools: Bash(generate-pdf:*), Bash(cat:*)
---

# PDF Generator

Converts HTML+CSS to high-quality PDF using headless Chromium. Supports all modern CSS.

## Quick start

```bash
# 1. Write HTML to a file
cat > /workspace/group/doc.html << 'EOF'
<!DOCTYPE html>
<html>...your content...</html>
EOF

# 2. Convert to PDF
generate-pdf /workspace/group/doc.html /workspace/group/doc.pdf
```

## Sending via WhatsApp

```bash
cat > /workspace/ipc/messages/send.json << 'EOF'
{
  "type": "media",
  "chatJid": "<chat_jid>",
  "filePath": "/workspace/group/doc.pdf",
  "caption": "Here you go 📄"
}
EOF
```

## Base template

This template is the starting point for all documents. Adapt colors, sections, and components to match the content type.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,600;0,700;1,400&display=swap');

  @page { size: A4; margin: 2.2cm 2cm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --accent: #6366f1;       /* change this to theme the whole doc */
    --accent-light: #eef2ff;
    --text: #18181b;
    --muted: #71717a;
    --border: #e4e4e7;
    --surface: #fafafa;
  }

  body {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 10pt;
    line-height: 1.7;
    color: var(--text);
  }

  /* ── Cover / Title ── */
  .cover {
    text-align: center;
    padding: 2.5em 0 2em;
    border-bottom: 2px solid var(--accent);
    margin-bottom: 2em;
  }
  .cover .tag {
    display: inline-block;
    background: var(--accent);
    color: white;
    font-size: 7.5pt;
    font-weight: 600;
    letter-spacing: .08em;
    text-transform: uppercase;
    padding: 3px 10px;
    border-radius: 999px;
    margin-bottom: .6em;
  }
  .cover h1 { font-size: 22pt; font-weight: 700; line-height: 1.2; }
  .cover p  { color: var(--muted); margin-top: .4em; font-size: 10pt; }

  /* ── Section ── */
  h2 {
    font-size: 11.5pt;
    font-weight: 600;
    color: var(--accent);
    margin: 1.8em 0 .6em;
    display: flex;
    align-items: center;
    gap: .4em;
  }
  h2::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  h3 { font-size: 10.5pt; font-weight: 600; margin: 1.2em 0 .3em; }
  p  { margin-bottom: .6em; }

  /* ── Cards (grid of 2 or 3) ── */
  .cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: .8em; margin: 1em 0; }
  .cards.three { grid-template-columns: repeat(3, 1fr); }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: .9em 1em;
  }
  .card .card-label { font-size: 8pt; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; margin-bottom: .2em; }
  .card .card-value { font-size: 15pt; font-weight: 700; color: var(--accent); }
  .card .card-sub   { font-size: 8.5pt; color: var(--muted); margin-top: .15em; }

  /* ── Timeline (itineraries, schedules) ── */
  .timeline { margin: 1em 0; }
  .tl-item  { display: flex; gap: 1em; padding-bottom: 1em; position: relative; }
  .tl-item:not(:last-child)::before {
    content: '';
    position: absolute;
    left: 1.1em;
    top: 1.8em;
    bottom: 0;
    width: 2px;
    background: var(--border);
  }
  .tl-dot {
    width: 2.2em; height: 2.2em; min-width: 2.2em;
    background: var(--accent);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: white; font-size: 9pt; font-weight: 600;
  }
  .tl-body .tl-time  { font-size: 8.5pt; color: var(--muted); }
  .tl-body .tl-title { font-weight: 600; margin-bottom: .15em; }
  .tl-body .tl-desc  { font-size: 9pt; color: var(--muted); }

  /* ── Table ── */
  table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 9.5pt; }
  thead tr { background: var(--accent); color: white; }
  th { padding: 7px 10px; text-align: left; font-weight: 600; font-size: 9pt; }
  td { padding: 6px 10px; border-bottom: 1px solid var(--border); }
  tr:nth-child(even) td { background: var(--surface); }

  /* ── Callout / Info box ── */
  .callout {
    background: var(--accent-light);
    border-left: 3px solid var(--accent);
    padding: .7em 1em;
    border-radius: 0 6px 6px 0;
    margin: .8em 0;
    font-size: 9.5pt;
  }

  /* ── Code block (tutorials) ── */
  pre {
    background: #18181b;
    color: #e4e4e7;
    border-radius: 6px;
    padding: .8em 1em;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 8.5pt;
    line-height: 1.5;
    white-space: pre-wrap;
    margin: .8em 0;
    page-break-inside: avoid;
  }
  code { background: var(--surface); border: 1px solid var(--border); border-radius: 3px; padding: 1px 4px; font-size: 8.5pt; }

  /* ── List ── */
  ul, ol { padding-left: 1.3em; margin: .5em 0 .8em; }
  li { margin-bottom: .25em; }

  /* ── Footer ── */
  .footer {
    margin-top: 2.5em;
    padding-top: .8em;
    border-top: 1px solid var(--border);
    font-size: 8pt;
    color: var(--muted);
    display: flex;
    justify-content: space-between;
  }

  /* ── Page breaks ── */
  .page-break { page-break-after: always; }
  h2 { page-break-after: avoid; }
  tr, .tl-item, .card { page-break-inside: avoid; }
</style>
</head>
<body>

<!-- COVER -->
<div class="cover">
  <span class="tag">Trip Itinerary</span>   <!-- e.g. Report · Tutorial · Summary -->
  <h1>Tokyo & Kyoto</h1>
  <p>7-day itinerary · April 2026</p>
</div>

<!-- METRICS (optional) -->
<div class="cards three">
  <div class="card">
    <div class="card-label">Duration</div>
    <div class="card-value">7</div>
    <div class="card-sub">nights</div>
  </div>
  <div class="card">
    <div class="card-label">Est. Budget</div>
    <div class="card-value">$2,400</div>
    <div class="card-sub">per person</div>
  </div>
  <div class="card">
    <div class="card-label">Cities</div>
    <div class="card-value">2</div>
    <div class="card-sub">Tokyo + Kyoto</div>
  </div>
</div>

<!-- TIMELINE SECTION -->
<h2>Day-by-Day</h2>
<div class="timeline">
  <div class="tl-item">
    <div class="tl-dot">1</div>
    <div class="tl-body">
      <div class="tl-time">Apr 5 · Arrival</div>
      <div class="tl-title">Land at Narita, check in Shinjuku</div>
      <div class="tl-desc">Evening stroll through Kabukicho and ramen dinner.</div>
    </div>
  </div>
  <div class="tl-item">
    <div class="tl-dot">2</div>
    <div class="tl-body">
      <div class="tl-time">Apr 6 · Tokyo</div>
      <div class="tl-title">Shibuya, Harajuku, Meiji Shrine</div>
      <div class="tl-desc">Full day exploring central Tokyo neighborhoods.</div>
    </div>
  </div>
</div>

<!-- CALLOUT -->
<div class="callout">
  💡 Book the Shinkansen to Kyoto at least 2 weeks in advance for reserved seats.
</div>

<!-- TABLE -->
<h2>Budget Breakdown</h2>
<table>
  <thead><tr><th>Category</th><th>Est. Cost</th><th>Notes</th></tr></thead>
  <tbody>
    <tr><td>Flights</td><td>$900</td><td>Round-trip from NYC</td></tr>
    <tr><td>Hotels (7n)</td><td>$840</td><td>~$120/night average</td></tr>
    <tr><td>Food</td><td>$350</td><td>Mix of street food and restaurants</td></tr>
    <tr><td>Transport</td><td>$180</td><td>JR Pass + metro</td></tr>
  </tbody>
</table>

<!-- FOOTER -->
<div class="footer">
  <span>Tokyo & Kyoto · April 2026</span>
  <span>Generated by NanoClaw</span>
</div>

</body>
</html>
```

## Color themes

Swap `--accent` in `:root` to change the mood:

| Theme | `--accent` | `--accent-light` |
|-------|-----------|-----------------|
| Indigo (default) | `#6366f1` | `#eef2ff` |
| Teal | `#0d9488` | `#f0fdfa` |
| Amber | `#d97706` | `#fffbeb` |
| Rose | `#e11d48` | `#fff1f2` |
| Slate | `#475569` | `#f8fafc` |

## Document types

| Type | Key components to use |
|------|-----------------------|
| Trip itinerary | cover + cards + timeline + callout |
| Price/ticket comparison | cover + table + callout |
| Conversation summary | cover + sections (h2/h3) + callout |
| Tutorial / how-to | cover + sections + code blocks + callout |
| Report | cover + cards + sections + table + footer |

## Tips

- Always write HTML and PDF to `/workspace/group/` so the host can send them.
- Use descriptive filenames: `tokyo-itinerary-april.pdf`, not `output.pdf`.
- For long documents, add `<div class="page-break"></div>` between major sections.
- If offline (no Google Fonts), the fallback stack (`system-ui, sans-serif`) still looks clean.
