# Twitter Screenshot Dashboard MVP

## Goal

Build a private, low-cost dashboard for saving your own X/Twitter posts from screenshots without using the expensive X API.

The first version should:

- accept a screenshot as the main input
- optionally accept a tweet URL
- let you choose a project from a dropdown
- extract `post text`, `posted date`, `likes`, and `views`
- show a review screen before saving
- store the screenshot and the reviewed data

The app UI should be in English.

## Product Shape

### Main flow

1. Open `Add Post`
2. Upload screenshot
3. Optionally paste tweet URL
4. Choose project from dropdown
5. Run OCR in the browser
6. Show extracted fields in a `Review Extraction` form
7. User corrects anything that looks wrong
8. Save post
9. Post appears in `All Posts` and under its project

### Why this flow

- avoids a full `Inbox` workflow
- keeps data entry fast
- avoids paid OCR APIs
- avoids X API costs
- catches OCR mistakes before data enters the database

## MVP Scope

### Included in v1

- private dashboard for one user
- English UI
- screenshot upload
- optional tweet URL
- project dropdown
- OCR extraction for text and metrics
- review screen before save
- post list with filtering
- project list
- post detail page
- duplicate protection
- manual edit after save

### Not included in v1

- auto-refreshing metrics from X
- metric history over time
- Telegram bot
- Chrome extension
- AI auto-classification into projects
- tags
- multi-user roles and permissions

## Suggested Stack

- `Next.js` with App Router
- `Vercel` for deployment
- `Supabase Postgres` for data
- `Supabase Storage` for screenshots
- `Tesseract.js` for browser OCR
- `zod` for form and parsing validation
- `shadcn/ui` or a simple custom component layer for forms and tables

## App Structure

### Routes

- `/`
  - Dashboard landing page
  - summary cards
  - recent posts
  - quick filter by project

- `/posts`
  - all posts table
  - filters: project, date range
  - search by text

- `/posts/new`
  - upload screenshot
  - optional tweet URL
  - project dropdown
  - run extraction

- `/posts/review`
  - review extracted values before save
  - preview screenshot
  - edit fields

- `/posts/[id]`
  - screenshot preview
  - extracted fields
  - metadata
  - edit form

- `/projects`
  - project list
  - create/edit/delete project

## Core Screens

### 1. Dashboard

Use a table-first layout, not cards-first.

Sections:

- `Total Posts`
- `Posts This Month`
- `Top Projects by Post Count`
- `Recent Posts`

### 2. Add Post

Fields:

- `Screenshot` upload
- `Tweet URL` optional
- `Project` dropdown
- `Run Extraction` button

UX details:

- large drag-and-drop upload area
- show file name and thumbnail preview
- disable extract button until screenshot is present

### 3. Review Extraction

Left side:

- screenshot preview

Right side form:

- `Project`
- `Tweet URL`
- `Post Text`
- `Posted At`
- `Likes`
- `Views`

Footer:

- `Back`
- `Save Post`

UX details:

- highlight any field with low confidence
- allow save even if one field is blank
- if OCR fails badly, keep manual entry available

### 4. All Posts

Columns:

- `Posted At`
- `Project`
- `Post Text` truncated
- `Likes`
- `Views`
- `Has URL`
- `Created At`

Filters:

- project
- date range
- text search

### 5. Post Detail

Sections:

- screenshot
- post information
- extraction metadata
- edit actions

## OCR Strategy

## Main rule

Run OCR client-side before save to avoid OCR API cost.

## OCR pipeline

1. User uploads screenshot
2. Client creates a preview URL
3. Client preprocesses the image
4. Client runs `Tesseract.js` with `eng`
5. Client parses OCR output into structured fields
6. Client shows a review form
7. On save, upload screenshot to Supabase Storage and insert reviewed data into Postgres

## Recommended preprocessing

Do lightweight preprocessing before OCR:

- scale image up if the screenshot is small
- convert to grayscale
- increase contrast
- apply slight sharpening if needed

This can be done with a hidden canvas in the browser.

## OCR output you should keep

Store both:

- final reviewed values
- raw OCR text

This helps debug bad parses later without re-running OCR.

## Parser Logic

The parser should not try to be too smart. It only needs to work well on your own English screenshots.

### Fields to extract

- `post_text`
- `posted_at`
- `likes_count`
- `views_count`
- `tweet_url` if user provided it

### Heuristic approach

#### 1. Normalize OCR text

- trim extra spaces
- collapse repeated whitespace
- normalize line breaks
- keep both the full raw text and a normalized version

#### 2. Extract metrics from the bottom area

In X screenshots, metrics usually appear near the bottom.

Look for patterns like:

- `123 views`
- `12.4K views`
- `4 likes`
- `1,245 likes`

Recommended regex ideas:

```ts
const metricPattern = /(\d[\d,]*\.?\d*)\s*([KMB])?\s*(views|view|likes|like)/gi;
```

Normalization rules:

- `1.2K` -> `1200`
- `3M` -> `3000000`
- `1,245` -> `1245`

#### 3. Extract date

Because screenshots are in English, date parsing becomes much easier.

Look for patterns like:

- `8:41 PM · Apr 23, 2026`
- `Apr 23, 2026`
- `10:12 AM · Jan 5, 2026`

Recommended regex ideas:

```ts
const fullDatePattern =
  /(\d{1,2}:\d{2}\s?(AM|PM))?\s*·?\s*([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/;
```

Store the parsed result as a UTC timestamp or a `timestamptz` value after user review.

#### 4. Extract post text

Do not try to reconstruct the tweet with heavy NLP.

For v1, use this simpler rule:

- remove obvious UI labels
- remove metric lines
- remove date line
- remove account header lines if detected
- join remaining content lines into the candidate post text

You can also prefer lines that sit between:

- the account/header region
- and the metrics/date region

If using Tesseract word blocks, a later improvement is to use bounding boxes and keep only the main body area. That can wait until v2.

### Confidence scoring

Use a tiny scoring layer:

- `high` if date + at least one metric + non-empty text are found
- `medium` if text exists and one of date or metrics exists
- `low` if only fragments were found

Example:

```ts
type ExtractionConfidence = "high" | "medium" | "low";
```

Use the score only for UI highlighting, not for blocking saves.

## Duplicate Detection

### First rule

If `tweet_url` exists, treat it as the main dedupe key.

### Fallback rule

If there is no URL, build a normalized fingerprint from:

- cleaned `post_text`
- `posted_at` date part

Example app-side fingerprint idea:

```ts
fingerprint = sha256(`${normalizedText}::${yyyyMmDd}`);
```

This does not need to be perfect. It only needs to catch most accidental duplicate uploads.

## Suggested Data Model

### `projects`

- `id`
- `name`
- `slug`
- `color`
- `display_order`
- `created_at`
- `updated_at`

### `posts`

- `id`
- `project_id`
- `tweet_url`
- `post_text`
- `posted_at`
- `likes_count`
- `views_count`
- `screenshot_path`
- `screenshot_width`
- `screenshot_height`
- `ocr_raw_text`
- `ocr_confidence`
- `content_fingerprint`
- `created_at`
- `updated_at`

## Save Flow

1. User uploads screenshot locally
2. Browser runs OCR
3. Parser creates draft extraction
4. User reviews and edits fields
5. Screenshot uploads to Supabase Storage
6. App inserts row in `posts`
7. App redirects to `/posts/[id]`

## Suggested Storage Structure

Supabase bucket:

- `tweet-screenshots`

Path format:

- `posts/{yyyy}/{mm}/{uuid}.png`

This keeps files organized and avoids filename collisions.

## Recommended Validation Rules

- `project_id` required
- `post_text` optional but strongly preferred
- `tweet_url` optional, but if present must be a valid URL
- `likes_count` and `views_count` must be `>= 0`
- `posted_at` optional only if OCR truly fails
- screenshot required

## UI Notes

Keep the UI very operational and not “social media themed”.

Recommendations:

- white or warm-gray base
- strong table layout
- roomy spacing
- one accent color per project
- no dashboard clutter
- keyboard-friendly forms

## Build Order

### Phase 1

- Next.js app shell
- Supabase setup
- project CRUD
- posts table

### Phase 2

- screenshot upload UI
- OCR integration with Tesseract.js
- parser logic
- review screen

### Phase 3

- duplicate protection
- filters and search
- post detail editing

## Risks and Mitigations

### OCR misses numbers

Mitigation:

- review step before save
- store raw OCR text
- allow manual correction

### Different screenshot layouts

Mitigation:

- optimize for one consistent English X layout first
- add crop tools only if the first screenshots prove messy

### Slow OCR on large screenshots

Mitigation:

- resize oversized images on the client before OCR
- show extraction progress state

## Recommended Next Step

Start by building:

1. `projects` and `posts` tables
2. `/posts/new` upload page
3. OCR draft extraction
4. review form

Once those work, the rest of the dashboard becomes straightforward.
