# PaceLab v0.8 — Privacy-first browser activity import

**Browser URL:** https://dokeefe414.github.io/Pacelab/

The public PaceLab site can now import an exported running FIT, GPX or TCX
file **without creating an account or contacting a PaceLab server**. This
capability is designed for trying the real workout analytics before choosing
a cloud service. The static site uses browser APIs only.

> This is **not official automatic COROS synchronization** or a hosted
> private database. Users still select files exported from their watch.
> The browser may retain workout and sensor data on that device. It is not
> automatically backed up or synchronized elsewhere.

## Quick start

1. Export a running FIT, GPX or TCX file from your watch account. Avoid
   uploading private route exports to untrusted websites.
2. Open [PaceLab](https://dokeefe414.github.io/Pacelab/), then
   **Workout log → FIT / GPX / TCX**.
3. Choose one or more files (maximum 10 MB per activity).
4. Read and accept the local-storage notice. The static app decodes files in
   your browser. **No account or API request is made.**
5. The imported workouts appear in the log and analytics views. Open
   **Details** to inspect available heart rate, cadence, power, laps, and
   timer versus elapsed time.
6. Change a workout's type to **Race** if it represents an actual race.
   This enables recorded race progression and reference-time estimates.
7. Use **Backup local data** to keep a private copy of the summaries.
   You can restore that JSON backup from the same section.

## Data flow and privacy boundary

~~~mermaid
flowchart TD
    USER[User selects exported FIT, GPX or TCX] --> FILE[Browser File API]
    FILE --> PARSER[Local format parser and safety limits]
    PARSER --> FILTER[Discard original bytes and GPS coordinates]
    FILTER --> SAMPLE[Cap sensor timeline to 120 records]
    SAMPLE --> CONSENT{User acknowledges device-local storage?}
    CONSENT -->|No| STOP[Do not store activity]
    CONSENT -->|Yes| LOCAL[(Origin-scoped browser localStorage)]
    LOCAL --> UI[Workouts / analysis / race research]
    LOCAL --> JSON[Optional private JSON backup]
    UI -.-> NO_API[No upload or automatic account sync]
~~~

### What gets saved locally?

| Field | Browser-local storage |
|---|---|
| Date, workout type, distance, timer duration | Yes |
| Elapsed duration, HR summary, cadence/power/elevation when available | Yes |
| Up to 120 downsampled sensor timeline records | Yes |
| Device lap duration and distance (up to 300 laps) | Yes |
| Original FIT/GPX/TCX bytes | **No** |
| Latitude and longitude / original route trace | **No** |
| File SHA-256 used for local duplicate detection | Yes |
| Personal login, token or server account | **Not required** |

Sensor data and timestamps remain sensitive even without GPS. They are
stored in the web browser's **origin-scoped localStorage**, not encrypted by
PaceLab. Someone with access to the device/browser profile, or scripts
running on the same origin, could access it. Private browsing or clearing
site data can erase it. Do not use a shared/public computer for confidential
training information.

Browser JSON backups include sensor traces and should be kept in a private,
encrypted location. They are not guaranteed to be compatible with all future
versions; the restore feature validates the version and supported fields.
The regular CSV export contains fewer fields and does not replace a full
local backup.

## Supported activity formats

### FIT — binary protocol

The browser parser supports standard FIT definition and data messages,
local message types and compressed timestamp headers. It reads session
summary, lap and sample records with FIT scales and invalid-field sentinels.

It checks header and file CRCs where present, enforces the 10 MB input limit
and 60,000-record processing cap, and rejects non-running FIT sessions.
Unknown developer-defined fields are skipped rather than being guessed.

Summary fields include **total timer versus total elapsed time**, total
distance, average/max heart rate, cadence, power and ascent/descent when
reported. Sensor timeline points are capped at 120.

FIT device vendors may add fields, custom scale factors or firmware-specific
data. Unsupported or corrupt activities are rejected with a clear message.
This importer should **not** be represented as a universal decoder for
every FIT device or version.

### GPX and TCX — XML tracks

GPX derives distance from reasonable consecutive GPS samples when no
device-specific distance field is present. TCX uses device lap totals when
available. Only the first running activity in a TCX document is imported.

Document type declarations and entity declarations are rejected. Source
coordinates are used in memory for derived distance but are **discarded
before persistence**. Implausible sudden GPS jumps are ignored while
estimating GPX distance.

### ZIP archives

ZIP bulk imports remain a **private backend-only** capability. The public
browser importer intentionally does not extract arbitrary ZIP archives.
Export individual FIT files or connect your own reviewed private API
if you need ZIP processing.

## Deduplication

The browser computes SHA-256 of the selected original bytes, then discards
the bytes. An identical file is not imported twice. A secondary check
compares start date, distance and timer duration to avoid repeated exports
of the same activity in different formats. This can occasionally classify
two extremely similar runs as duplicates; review your activity list.

Imported records can be labeled Easy, Long, Tempo, Intervals, Race or
Recovery, and have editable notes. Device-reported distance and timer
duration are not silently overwritten by a race label.

## Verified locally without publishing private files

The FIT parser was exercised against **four private running FIT files**
available in the project owner's working session. In all four, the
session distance and timer duration decoded as expected; the long
activity with a pause also exposed a longer elapsed duration. The tests
do not publish original bytes, GPS traces, device IDs, timestamps or
individual training records.

Additional **synthetic** binary FIT fixtures in
[tests/local-import.test.js](../tests/local-import.test.js) check CRC,
missing HR values, laps, elapsed time and coordinate stripping. Playwright
tests use synthetic GPX to verify real browser import, consent, dedupe,
persistence across reload and **zero API calls**.

This is a limited compatibility check, **not universal device certification**.

## Browser support and limits

- Modern browsers supporting ES modules, File API, DataView, Web Crypto and
  DOMParser; a secure HTTPS context is required for file hashing.
- Up to 10 MB per file; larger bulk ZIPs use a private backend.
- Up to 60,000 source trackpoints, downsampled to 120 sensor records.
- Browser storage quota is browser-dependent; there is no guaranteed
  cross-device sync or unlimited dataset capacity.
- Original route maps are unavailable locally by design; private account
  imports may store reduced GPS under a separate consent process.
- Pure local imports do not expose data to external AI providers.

## Local race research

Mark genuine racing efforts as Race. Open **Race predictor → Check data
readiness** to see how many real labeled race examples can be formed from
earlier workouts. Use **Export real race-training CSV** to download a local
research dataset. The exporter excludes same-day/future training, and
requires at least five prior non-race sessions in the previous 28 days,
including some Easy/Recovery mileage.

**Sixty eligible races and twelve distinct race dates** are minimum
experiment gates, not proof of forecast quality. See
[ML methodology](ml-methodology.md) and
[research data governance](race-data-governance.md).

## Security limitations

Client-side parsing is only one defense: the source is public, so users
should never assume JavaScript running inside an untrusted browser
environment is equivalent to an audited, encrypted medical records system.
Avoid shared devices, clear local data when appropriate, keep private
backup copies secure, and do not distribute exported routes or watch files
without consent.

The separately hosted account system still has its own security gates,
backups and deployment requirements; see [Security](../SECURITY.md)
and [Render deployment](render-deployment.md).
