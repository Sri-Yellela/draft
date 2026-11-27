// ⭐ 47k (errb) · ONE AREA FAILS, THE APP STAYS — the error boundary around each area's content inside the shell (App.jsx).
// Before it there was none: a render throw or a lazy chunk that 404s after a deploy swapped the chunk hashes blanked the
// whole app, the dock and the area nav with it. Now only the area's own slot changes, to the plate's drawer (PlateState):
// what happened, Reload, Go to Home. The dock / area nav sit outside it, so the person can still move to another area.
//   · a chunk-load error reloads the page once by itself (plate/areaFault.js — guarded in sessionStorage, never a loop),
//     then shows the state if it comes back;
//   · `resetKey` (the /app route) clears the state when the person moves — a healthy area is never remounted by it;
//   · the error goes to the console — the client has no error-reporting endpoint to send it to (none was invented).
import { Component } from "react";
import PlateRoot from "./PlateRoot.jsx";
import { Drawer } from "./PlateState.jsx";
import { isChunkLoadError, claimAutoReload, sessionStore } from "./areaFault.js";

export default class AreaErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, chunk: false };
  }

  static getDerivedStateFromError(error) {
    return { error, chunk: isChunkLoadError(error) };
  }

  componentDidCatch(error, info) {
    const area = this.props.area || "this area";
    console.error(`[draft] ${area} failed to render`, error, info?.componentStack || "");
    if (isChunkLoadError(error) && claimAutoReload(sessionStore())) {
      try { window.location.reload(); } catch { /* the state below stays up */ }
    }
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null, chunk: false });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const { onHome, area } = this.props;
    const reload = () => { try { window.location.reload(); } catch { /* nothing more to do */ } };
    const home = () => { if (onHome) onHome(); else window.location.assign("/app"); };
    return (
      <PlateRoot className="pl-sheetpage" data-area-fault={area || ""}>
        <Drawer kicker="SOMETHING WENT WRONG" role="alert"
          title={this.state.chunk ? "Draft was updated while this page was open." : "This part of Draft stopped working."}
          text={this.state.chunk
            ? "A piece of this page couldn't be fetched. Reloading picks up the new version."
            : "It hit an error while drawing. Reload to try again, or go to Home — the rest of Draft still works."}
          actions={<>
            <button type="button" className="pl-btn" onClick={reload}>Reload</button>
            <button type="button" className="pl-btn" onClick={home}>Go to Home</button>
          </>}/>
      </PlateRoot>
    );
  }
}
