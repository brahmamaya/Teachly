# Teachly: working rules (owner's standing rules)

Every change, big or small, must keep all of these:

1. **Quality**: sharp ink, text, graphs, PDFs and videos at every zoom and screen (phone, iPad, laptop, 86" board).
2. **Smoothness and speed**: no lag while writing, ever (the teacher teaches live). Measure on the "lite" path too
   (`liteDevice()` in `src/board.ts`: classroom boards). Heavy work only on demand, never per pointer move.
3. **No jolts**: every button press, open and close feels smooth. Use the shared pieces: buttons scale softly on
   press, `fadeOut()` (`src/ui/panel.ts`) to close things, `soft-in` / `box-in` / `fade-in` animations to open
   them. Only opacity and small moves/scales (cheap); respect `prefers-reduced-motion`.
4. **Privacy**: the teacher's data stays on the device; no tracking; no extra Android permissions
   (INTERNET for updates, RECORD_AUDIO for lesson recording only, CAMERA for Insert > Camera only; both asked
   only when the teacher taps that feature, camera off right after the photo).
5. **No personal names shown**: the owner's name / GitHub must not appear anywhere users can see (links, QR codes,
   share text, pages). Share links point to physica.in.
6. **Never commit the signing key** (it lives outside the repo).
7. Toolbar touches the screen edge: bottom by default, top if the teacher picks it in Edit toolbar.
8. **Privacy policy / Terms of use** (`src/ui/legal.ts`) must stay true: when a change affects what is stored, sent,
   or which permission is used, update those texts and their date in the same commit. Never invent legal facts
   (company names, addresses); a lawyer should review them.

Before pushing: `npx tsc --noEmit -p .`, `npx vitest run`, a browser check of what changed, then build the APK
and deploy (old `assets/` are kept on gh-pages so an open older version still loads its parts).

Replies to the owner are in simple Hinglish.
