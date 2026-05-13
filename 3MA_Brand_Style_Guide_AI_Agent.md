# 3MA Association Brand Style Guide for AI Coding and Design Agents

**Organization:** Mississippi Medical Marijuana Association (3MA)  
**Guide version:** April 2026  
**Purpose:** Use this reference when generating, coding, designing, or reviewing 3MA materials across websites, landing pages, email templates, newsletters, social graphics, policy documents, reports, handouts, sponsorship packets, and slide decks.

---

## 1. Brand Foundation

### Core Identity

3MA is the unified voice of Mississippi's medical cannabis industry, operators, advocates, patients, and allied businesses.

### Brand Position

3MA should appear:

- Authoritative, informed, and policy-literate.
- Patient-centered without losing industry credibility.
- Professional enough for the Capitol and clear enough for the public.
- Optimistic about progress while direct about needed reforms.

### Mission

Represent the industry, broaden safe patient access, support meaningful improvements to Mississippi law, and promote responsible medical cannabis use.

### Audience

Design and copy should account for these audiences:

- Licensed medical cannabis operators.
- Ancillary businesses.
- Advocates.
- Patients.
- Lawmakers.
- Regulators.
- Medical professionals.
- Sponsors.
- Civic and community partners.

### Brand Promise

3MA makes medical cannabis advocacy more organized, credible, connected, and effective for Mississippi.

### Message Priorities

Prioritize these themes in copy, layout, and content structure:

- Industry unity.
- Patient access.
- Regulatory clarity.
- Responsible use.
- Legislative progress.
- Member voice.
- Mississippi-focused solutions.

---

## 2. Logo Usage

### Preferred Logo Treatment

Use the full 3MA logo with lettering whenever there is enough horizontal space.

Preferred logo placements:

- Top left on formal documents, websites, email headers, and reports.
- Centered on covers, title slides, and formal graphics.
- Header, footer, cover, closing slide, or other brand-anchor positions.

Preferred logo backgrounds:

- Navy.
- White.
- Light gray.

The logo should always have strong surrounding contrast and should not compete with crowded copy, busy photography, or unrelated graphics.

### Clear Space

Maintain clear space around the logo equal to at least the height of the `3MA` lettering.

### Logo Do Rules

- Use the full-color logo on white, light gray, or navy backgrounds where contrast is strong.
- Keep the logo proportional when resizing.
- Use the logo as a brand anchor in headers, covers, footers, and closing slides.
- Pair the logo with navy and gold rather than unrelated color palettes.

### Logo Do Not Rules

Do not:

- Stretch, skew, crop, recolor, or add visual effects to the logo.
- Place the logo on busy photos without a dark overlay or clean backing field.
- Use low-resolution screenshots for print collateral.
- Pair the logo with novelty fonts, decorative borders, cannabis novelty visuals, or unapproved colors.

---

## 3. Color Palette

Use these exact color values unless the user specifically asks for a temporary mockup or accessibility adjustment.

| Color Name | Hex | Primary Use |
|---|---:|---|
| Navy Blue | `#071f40` | Primary background, headers, footers, hero sections, formal covers, dark panels. |
| Navy Tint | `#0d2d5c` | Hover states, secondary dark panels, subtle depth on navy layouts. |
| Gold | `#ebab22` | Primary CTA, borders, labels, rules, icons, key emphasis. |
| Red | `#c21f32` | Urgent advocacy, alerts, deadlines, priority links, major emphasis. |
| White | `#ffffff` | Clean surfaces, body backgrounds, text on navy, document interiors. |
| Light Gray | `#f4f5f7` | Page fields, cards, table fills, dividers, soft content blocks. |
| Dark Gray | `#1f2937` | Long-form body text on white or light backgrounds. |

### Color Hierarchy

- Navy is the dominant brand field and should lead formal materials.
- Gold is the primary action and emphasis color.
- Red is limited to urgent advocacy, alerts, deadlines, and major emphasis.
- White and light gray should be used to keep dense information readable and polished.

### Color Rules

- Never give red and gold equal visual weight in the same block. Choose one dominant accent.
- Use white text on navy for strong contrast and formal authority.
- Use gold lines, labels, rules, and borders to organize pages without over-decorating.
- Avoid one-off greens, purples, browns, neon colors, or bright cannabis novelty palettes.
- Do not use cannabis-leaf green as a primary visual identity color.

### Suggested CSS Variables

```css
:root {
  --color-3ma-navy: #071f40;
  --color-3ma-navy-tint: #0d2d5c;
  --color-3ma-gold: #ebab22;
  --color-3ma-red: #c21f32;
  --color-3ma-white: #ffffff;
  --color-3ma-light-gray: #f4f5f7;
  --color-3ma-dark-gray: #1f2937;
}
```

---

## 4. Typography

### Primary Type System

| Role | Font | Weight | Treatment |
|---|---|---:|---|
| H1 / Campaign Headline | Montserrat | 700-900 | Uppercase for major titles. Large, bold, high contrast. |
| H2 / Section Heading | Montserrat | 700-900 | Uppercase or title case depending on density. Clear hierarchy. |
| Body Copy | Raleway | 400-500 | 1.55-1.75 line height. Used for readable long-form text. |
| CTA Labels | Montserrat | 800-900 | Uppercase, small size, letter spacing from `0.08em` to `0.12em`. |
| Captions | Raleway 500 or Montserrat 700 | 500-700 | 9-11px equivalent. Use gray or gold depending on context. |
| Numbers / Stats | Montserrat | 800-900 | Use for statistics, policy goals, numbered lists, and proof points. |

### Typography Rules

- Use bold uppercase Montserrat for official titles, section labels, buttons, navigation, and policy headings.
- Use Raleway for approachable, readable body copy in documents, emails, newsletters, and web pages.
- Keep hierarchy obvious: large title, concise section heading, readable body copy, small labels.
- Avoid decorative, handwritten, distressed, novelty cannabis, or novelty political fonts.
- Do not mix in unrelated typefaces unless required by a platform limitation.

### Web Font Loading Example

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&family=Raleway:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Suggested CSS Typography

```css
body {
  font-family: "Raleway", Arial, sans-serif;
  color: var(--color-3ma-dark-gray);
  line-height: 1.65;
}

h1,
h2,
h3,
.nav-label,
.cta,
.stat-number {
  font-family: "Montserrat", Arial, sans-serif;
}

h1,
.campaign-headline {
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.cta,
.button,
.label {
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
```

---

## 5. Voice and Messaging

### Voice Attributes

#### Authoritative

Use clear policy language, specific asks, and confident claims that can be supported by 3MA materials.

#### Constructive

Frame advocacy around solutions, patient access, industry viability, and regulatory improvement.

#### Accessible

Write for lawmakers, members, patients, and the public. Define acronyms and avoid unnecessary legal jargon.

### Approved Language

These phrases are approved for use in public-facing materials:

- The unified voice of Mississippi's medical cannabis industry.
- Advocating for increased access and regulatory clarity.
- Supporting a responsible, compliant, and safe medical cannabis program.
- Working with members to shape legislation and regulatory priorities.
- Representing operators, advocates, patients, and allied businesses.

### Standard Boilerplate

Use this boilerplate in formal documents, footer sections, press-style materials, sponsorship packets, and reports:

> The Mississippi Medical Marijuana Association is a 501(c)(6) non-profit trade organization representing the interests of Mississippi's medical cannabis community. 3MA works with operators, advocates, patients, policymakers, and regulators to support patient access, responsible industry growth, and meaningful improvements to Mississippi's medical cannabis program.

### Avoid

Do not use:

- Overly casual slang.
- Novelty cannabis references.
- Recreational-use framing.
- Claims that imply legal, medical, or financial advice.
- Unsupported statistics or policy claims without a source.
- Overpromising legislative outcomes.
- Language that pits patients and operators against each other.

### Copywriting Guidance for AI Agents

When drafting copy for 3MA:

- Be formal, clear, constructive, and Mississippi-focused.
- Prefer direct advocacy language over vague marketing language.
- Use short paragraphs and scannable structure.
- Define acronyms on first use where public audiences may be included.
- Include one obvious next step or call to action.
- Make sure claims are accurate, current, and sourceable.
- Avoid sounding like a generic cannabis lifestyle brand.
- Avoid hype-heavy language that sounds unserious in legislative or regulatory contexts.

---

## 6. Visual System

### Overall Layout Direction

3MA layouts should feel structured, high-contrast, formal, and advocacy-ready.

Common layout elements:

- Navy header or hero section.
- Gold rule or divider.
- Strong Montserrat headline.
- Raleway body copy in short sections.
- Structured cards for grouped information.
- Clear CTA in gold.
- Navy footer with gold top border.

### Cards

Use structured cards for:

- Policy goals.
- Board members.
- Resources.
- Events.
- Member benefits.
- Sponsor levels.
- Legislative priorities.
- Operator or licensee information.

Recommended card treatment:

- White or light gray surface.
- Navy heading.
- Gold label, border, rule, or icon accent.
- Raleway body text.
- Generous internal spacing.
- Minimal decoration.

### Callout Types

| Callout Type | Color Treatment | Use |
|---|---|---|
| Member Notice | Gold | Key announcements, highlights, important reminders. |
| Information | Navy | Educational notes, background, standard information. |
| Action Required | Red | Deadlines, urgent alerts, high-priority advocacy asks. |

### Imagery Direction

Use real Mississippi-facing imagery when possible:

- People in Mississippi.
- Industry operations.
- Association events.
- Policy settings.
- Member activity.
- Civic or Capitol-related environments.

Prefer documentary clarity over stock-style atmosphere.

When placing white or gold type on photos, use navy overlays or clean backing fields to maintain legibility.

### Imagery to Avoid

Avoid:

- Hazy smoke imagery.
- Exaggerated cannabis leaf patterns.
- Unserious cannabis visual tropes.
- Recreational-use party imagery.
- Busy photos behind the logo or important text without an overlay.

---

## 7. Marketing Applications

### Flyers and Handouts

Recommended structure:

1. Navy header.
2. Logo top left or centered.
3. Gold rule under header.
4. Direct title.
5. Short body sections.
6. One clear CTA.
7. Formal footer with contact information.

Policy documents should be restrained, source-friendly, and easy to scan.

### Social Graphics

Recommended structure:

- Lead with one message.
- Use large Montserrat type.
- Use a navy field.
- Use gold for emphasis.
- Use red only for urgency or deadline graphics.
- Avoid cluttering the graphic with too much explanatory copy.

### Email Campaigns

Recommended structure:

- Clear headline.
- Short paragraphs.
- Gold CTA button.
- Repeated contact or registration link when needed.
- Avoid dense blocks of copy.
- Keep mobile readability in mind.

### Presentations

Recommended structure:

- Navy covers.
- White section dividers.
- Gold labels.
- Raleway body text.
- One key idea per slide.
- Strong contrast for projection and printing.

### Sponsor Materials

Recommended structure:

- Formal and high-contrast design.
- Clear sponsorship tiers.
- Benefit tables.
- Proof points.
- Sponsor logo areas with generous spacing.
- Avoid over-designed or novelty layouts.

### Policy Documents

Recommended structure:

1. Issue.
2. Background.
3. Proposed change.
4. Impact.
5. Call to action.

Use red only where action is needed.

---

## 8. Reusable Structure

Use this structure for most 3MA assets:

| Part | Recommended Treatment |
|---|---|
| Header | Navy background, logo left or centered, gold bottom border. |
| Title | Montserrat 800 or 900, uppercase, navy or white depending on field. |
| Body | Raleway, generous line height, short paragraphs, bullets for scannability. |
| CTA | Gold primary button or gold-highlighted contact line. |
| Footer | Navy field, gold top border, contact information, website, and formal boilerplate. |

### Generic HTML Section Pattern

```html
<section class="section section-navy">
  <div class="container">
    <p class="eyebrow">Mississippi Medical Marijuana Association</p>
    <h1>Unified Voice for Mississippi Cannabis</h1>
    <p class="lead">3MA represents operators, advocates, patients, and allied businesses working to strengthen Mississippi's medical cannabis program.</p>
    <a class="button button-gold" href="#">Join 3MA Today</a>
  </div>
</section>
```

### Generic CSS Pattern

```css
.section-navy {
  background: var(--color-3ma-navy);
  color: var(--color-3ma-white);
}

.container {
  max-width: 1120px;
  margin: 0 auto;
  padding: 48px 24px;
}

.eyebrow {
  font-family: "Montserrat", Arial, sans-serif;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--color-3ma-gold);
  font-size: 0.78rem;
}

.button-gold {
  display: inline-block;
  background: var(--color-3ma-gold);
  color: var(--color-3ma-navy);
  font-family: "Montserrat", Arial, sans-serif;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 14px 22px;
  text-decoration: none;
}
```

---

## 9. Production Checklist

Before publishing, verify:

- Logo is clear, proportional, and not crowded.
- Navy, gold, red, white, and gray values match the official palette.
- Montserrat is used for headings, labels, buttons, and section titles.
- Raleway is used for body copy and longer explanatory text.
- Gold is the primary CTA or emphasis color.
- Red is limited to urgency, alerts, or critical emphasis.
- The message supports advocacy, patient access, regulatory clarity, or member value.
- Claims are accurate, current, and sourceable.
- Medical, legal, and policy language is careful and not overpromised.
- There is one obvious next step for the reader.
- Contact information and website links are current.
- Tone is formal, clear, constructive, and Mississippi-focused.

---

## 10. AI Agent Implementation Rules

When using this file as an AI coding, design, or content-generation instruction set, follow these rules:

1. Use the official 3MA color tokens exactly.
2. Use Montserrat for headings, labels, buttons, navigation, stats, and section titles.
3. Use Raleway for body text, captions, paragraphs, emails, newsletters, and policy copy.
4. Build layouts around navy fields, white or light gray content areas, and gold emphasis.
5. Reserve red for urgent alerts, deadlines, critical advocacy moments, and high-priority links.
6. Keep all materials formal, credible, and advocacy-ready.
7. Avoid novelty cannabis branding, recreational framing, slang, and decorative fonts.
8. Use structured cards, callouts, section dividers, and clear CTA areas.
9. Prioritize Mississippi-specific language and policy relevance.
10. Never invent statistics, legal claims, medical claims, or regulatory claims without a source.
11. Include a single obvious next step for the reader whenever the asset is action-oriented.
12. Maintain strong contrast for accessibility and readability.
13. Do not place the logo over busy photography without a navy overlay or clean backing field.
14. Keep social graphics focused on one primary message.
15. Keep policy documents organized around issue, background, proposed change, impact, and CTA.

---

## 11. Prompt Snippet for AI Coding Agents

Use this snippet when instructing an AI agent to build 3MA-branded materials:

```text
Follow the 3MA brand system. Use Navy #071f40 as the dominant formal background, Gold #ebab22 as the primary CTA/accent color, Red #c21f32 only for urgent alerts or deadlines, Light Gray #f4f5f7 for cards and content blocks, Dark Gray #1f2937 for body text, and White #ffffff for clean surfaces and text on navy. Use Montserrat 700-900 for headings, labels, buttons, navigation, and statistics. Use Raleway 400-500 for body copy with generous line height. The design should feel formal, high-contrast, structured, Mississippi-focused, and advocacy-ready. Avoid novelty cannabis visuals, recreational framing, decorative fonts, unsupported claims, and clutter. Use a navy header, gold divider/rule, clear Montserrat title, readable Raleway body sections, structured cards or callouts where useful, one clear gold CTA, and a navy footer with contact information or boilerplate when appropriate.
```

---

## 12. Compact JSON Design Tokens

```json
{
  "brand": "Mississippi Medical Marijuana Association",
  "abbreviation": "3MA",
  "colors": {
    "navy": "#071f40",
    "navyTint": "#0d2d5c",
    "gold": "#ebab22",
    "red": "#c21f32",
    "white": "#ffffff",
    "lightGray": "#f4f5f7",
    "darkGray": "#1f2937"
  },
  "fonts": {
    "heading": {
      "family": "Montserrat",
      "weights": [700, 800, 900],
      "usage": "headings, labels, buttons, navigation, statistics, official titles"
    },
    "body": {
      "family": "Raleway",
      "weights": [400, 500],
      "lineHeight": "1.55-1.75",
      "usage": "body copy, email copy, newsletters, policy text, captions"
    }
  },
  "voice": [
    "authoritative",
    "constructive",
    "accessible",
    "formal",
    "clear",
    "Mississippi-focused"
  ],
  "avoid": [
    "novelty cannabis references",
    "recreational framing",
    "decorative fonts",
    "unsupported statistics",
    "medical advice",
    "legal advice",
    "financial advice",
    "overpromising legislative outcomes",
    "busy logo backgrounds",
    "unapproved color palettes"
  ],
  "layout": {
    "header": "navy background, logo left or centered, gold bottom border",
    "title": "Montserrat 800-900, uppercase, navy or white",
    "body": "Raleway, generous line height, short paragraphs, bullets when helpful",
    "cta": "gold primary button or gold-highlighted contact line",
    "footer": "navy field, gold top border, contact information, website, boilerplate"
  }
}
```
