// ⛔ A188 · imported by server.js right after dotenv/config and BEFORE every other module, so a staging deploy that
// carries a production credential exits before anything reads it, and the forced switches are in place before any
// module reads its own (services/stagingGuard.js).
import { applyStagingGuard } from "./stagingGuard.js";

applyStagingGuard();
