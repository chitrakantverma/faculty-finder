# Revisiting Faculty Finder

## Original prototype — 29 October 2025

The prototype combined a React search interface, a Gemini-backed server route, streamed faculty cards and PDF export. The original commits remain in this repository.

## Maintenance pass — 25 October 2026

Reviewing the source exposed a duplicate application entry point and client parsing that silently skipped malformed model output. It also showed that the original setup instructions named a different environment variable from the one read by the server.

The update mounts one application, validates incoming profile records, filters unsafe URLs and duplicate profiles, and displays an error without hiding previously received results. A labelled fictional sample demonstrates the interface without making a model request. PDF export is now visible on mobile.

## What this demonstrates

The useful engineering work is in handling network boundaries, making failure states visible, keeping credentials on the server and documenting the difference between generated suggestions and verified information. A polished card layout alone does not establish retrieval quality.

## Validation

Frontend production build and TypeScript check passed. Six regression tests exercise the stream client using mocked HTTP responses. The live Gemini backend and accuracy of generated faculty details were not validated in this pass.

## Next step

Replace prompt-only discovery with a retrieval pipeline over official institute directories. Each suggested person should carry a source and a verification timestamp. Until then, this remains a shortlist assistant requiring manual checks.
