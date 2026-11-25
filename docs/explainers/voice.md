# The explainer voice (D198 E3)

Rule (owner 11-24): ONE free, open-source text-to-speech voice for every explainer, run locally; the model AND the
voice licence must allow commercial publishing; recorded here BEFORE any audio is rendered. No voice with a
non-commercial or unclear licence.

## Status: ✅ DECIDED — PIPER, `en_US-ljspeech-high` (owner 11-25, 47h: *"lets go with piper"*)

| | |
| --- | --- |
| Voice | **`en_US-ljspeech-high`** (rhasspy/piper-voices, `en/en_US/ljspeech/high/`), a single US English female reader |
| Training data | **LJ Speech**, its MODEL_CARD: *"License: public domain"* · *"Trained from scratch for 1000 epochs on medium quality settings using the LJ Speech dataset."* The dataset's page (keithito.com/LJ-Speech-Dataset): *"This dataset is in the public domain in the US (and most likely other countries as well). There are no restrictions on its use."* |
| Why not `libritts_r` | its card says *"Fine-tuned from English lessac medium"*, and lessac (Blizzard 2013) is research-only (Rejected, below) |
| The voice files' licence | the piper-voices repository's licence metadata is **MIT**; the voice's card states no other licence for the checkpoint |
| Runtime | **Piper** (rhasspy/piper), **MIT** (`LICENSE.md`, © 2022 Michael Hansen), the Windows release `2023.11.14-2` (`piper_windows_amd64.zip`, sha256 `f3c58906…efcea`). It is archived (10-06-2025, development moved to OHF-Voice/piper1-gpl, not used here). It runs as a local tool; nothing of it ships in draft or in a video. It bundles espeak-ng (GPL-3.0) for phonemes, local only, as with Kokoro |
| Model file | `en_US-ljspeech-high.onnx`, sha256 `5d4f08ba…c029a`, 114 MB, kept out of git (`tmp/piper-dl/`, ignored by `.gitignore`) |
| Read | 11-25, the three MODEL_CARDs + the repo card + Piper's README / LICENSE + the LJ Speech page |
| Render | `node scripts/d198Voice.mjs <id> --piper <piper.exe> --model <en_US-ljspeech-high.onnx>`, then `node scripts/d198Export.mjs <id>` |

**Kokoro (below) is not used** — kept as the record of the candidate the owner passed over.

## (history) Status: CANDIDATE RECORDED — NOT YET USED (47g, 11-24)

No audio has been rendered. Two points below are not settled by the licence text itself (see *Unknown*); the agent
does not render until the owner says the candidate is acceptable, or a cleaner one replaces it.

## The candidate

| | |
| --- | --- |
| Model | **Kokoro-82M** (hexgrad), 82 M parameters, runs locally on CPU |
| Model licence | **Apache-2.0** — the repository's licence metadata; the card: "This is an Apache-licensed model", "Kokoro has been deployed in numerous projects and commercial APIs" |
| Voice | **`af_heart`** (American English) — the highest overall grade in VOICES.md (A) |
| Voice licence | the voice packs (`voices/*.pt`) sit in the same Apache-2.0 repository; ⚠ the card never names them separately |
| Generated audio | the card states no restriction on the output |
| Training data the card names | public-domain audio, Apache / MIT-licensed audio, synthetic audio from closed providers' TTS; two CC BY sets: Koniwa `tnc` (CC BY 3.0) and SIWIS (CC BY 4.0) |
| Phonemiser | `misaki`, with **espeak-ng** (GPL-3.0) as the fallback — run as a local tool only; nothing of it is shipped in draft or in a video |
| Sources | https://huggingface.co/hexgrad/Kokoro-82M · https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md (read 11-24) |

## Unknown (why it is not used yet)

1. **The voice packs' licence is the repository's, not stated per file.** A repository licence normally covers every
   file in it, but the card says "weights" without defining whether the voice packs are included.
2. **Part of the training audio is synthetic output of closed providers' TTS.** That is a provenance question (those
   providers' terms), not a licence on Kokoro — but it is the kind of "unclear" the rule excludes, so the owner decides.

## Rejected

- **Piper's `en_US-lessac`** — trained on the Blizzard 2013 data, research-only licence.
- Any Piper voice under CC BY-NC(-SA) — non-commercial.
- (A Piper voice trained on CC0 / CC BY data — e.g. LibriTTS-based — is the fallback if Kokoro is refused; its
  MODEL_CARD must be read and recorded here first.)

## When approved, the render (E3)

`content/explainers/<id>/audio/beat-NN.wav`, one file per beat's `say`, rendered once; each file's measured length
becomes the beat's `holdMs` (captions advance word by word across it). The app plays those files; live browser speech
only while drafting.
