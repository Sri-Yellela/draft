// ⭐ D196 · the plate system's three faces, SELF-HOSTED (main.jsx says why: no request to a font CDN).
// Every weight a plate page uses is imported HERE, so a plate page renders the same wherever it is mounted (the app, the
// gallery, the regression run's standalone page — F5 caught the last one drawing 500 as 800 when only 800 was here).
// main.jsx imports some of the same files; the bundler includes each once.
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource/inter-tight/400.css";
import "@fontsource/inter-tight/500.css";
import "@fontsource/inter-tight/600.css";
import "@fontsource/inter-tight/700.css";
import "@fontsource/inter-tight/800.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/600.css";
import "@fontsource/jetbrains-mono/700.css";
