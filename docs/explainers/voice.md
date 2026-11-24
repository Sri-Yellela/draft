# The explainer voice (D198 E3)

Rule (owner 11-24): ONE free, open-source text-to-speech voice for every explainer, run locally; the model AND the
voice licence must allow commercial publishing; recorded here BEFORE any audio is rendered. No voice with a
non-commercial or unclear licence.

## Status: CANDIDATE RECORDED — NOT YET USED (47g, 11-24)

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
