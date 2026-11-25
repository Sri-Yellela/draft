// ⭐ D198 E3 · the explainer's voice — each beat's `say` rendered once by Piper (owner 11-25: "lets go with piper"), offline.
//
//   node scripts/d198Voice.mjs <id> --piper <path to piper.exe> --model <path to en_US-ljspeech-high.onnx>
//
// Writes content/explainers/<id>/audio/beat-NN.wav (one per beat) and each file's measured length into script.json as the
// beat's `audioMs`. explainerModel.speakMs then times the captions across exactly that length, and scripts/d198Export.mjs
// joins the files into the Short and the 16:9 file. The voice, its licence and the reasoning are in docs/explainers/voice.md.
// script.json keeps its own formatting: `"audioMs": N, ` is inserted before each beat's `"say"` (a re-run replaces it).
// Nothing here calls a model service; Piper runs locally (D190: no model for site data).
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ffmpegPath } from "./d198Export.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Pure: what Piper reads for a line — curly quotes straightened (the LJSpeech voice's phonemiser reads ASCII best). */
export function speechText(say) {
  return String(say || "").replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
}

/** Pure: script.json's text with each beat's audioMs set — the k-th `"say": "<line>"` gets the k-th length. */
export function withAudioMs(text, script, lengths) {
  let out = text;
  script.beats.forEach((b, i) => {
    const sayJson = `"say": ${JSON.stringify(b.say)}`;
    const re = new RegExp(`("audioMs":\\s*\\d+,\\s*)?${sayJson.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
    if (!re.test(out)) throw new Error(`beat ${i + 1}: its say line was not found in script.json`);
    out = out.replace(re, `"audioMs": ${lengths[i]}, ${sayJson}`);
  });
  return out;
}

function arg(name) { const k = process.argv.indexOf(name); return k > 0 ? process.argv[k + 1] : null; }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const id = process.argv[2];
  const piper = arg("--piper"), model = arg("--model");
  if (!id || !piper || !model) { console.error("usage: node scripts/d198Voice.mjs <id> --piper <piper.exe> --model <voice.onnx>"); process.exit(2); }
  const file = path.join(ROOT, "content", "explainers", id, "script.json");
  const text = fs.readFileSync(file, "utf8");
  const script = JSON.parse(text);
  const dir = path.join(ROOT, "content", "explainers", id, "audio");
  fs.mkdirSync(dir, { recursive: true });
  const ffprobe = ffmpegPath().replace(/ffmpeg(\.exe)?$/i, (m, exe) => `ffprobe${exe || ""}`);
  const lengths = script.beats.map((b, i) => {
    const out = path.join(dir, `beat-${String(i + 1).padStart(2, "0")}.wav`);
    const r = spawnSync(piper, ["--model", model, "--output_file", out], { input: speechText(b.say), encoding: "utf8" });
    if (r.status !== 0 || !fs.existsSync(out)) throw new Error(`piper failed on beat ${i + 1}: ${String(r.stderr || "").slice(-400)}`);
    const d = spawnSync(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out], { encoding: "utf8" });
    const ms = Math.round(parseFloat(d.stdout) * 1000);
    if (!(ms > 0)) throw new Error(`beat ${i + 1}: could not measure ${out}`);
    console.log(`beat ${i + 1}: ${ms} ms  ${b.say}`);
    return ms;
  });
  fs.writeFileSync(file, withAudioMs(text, script, lengths));
  console.log(`audioMs written for ${lengths.length} beats; total speech ${(lengths.reduce((a, b) => a + b, 0) / 1000).toFixed(1)} s. Next: node scripts/d198Export.mjs ${id}`);
}
