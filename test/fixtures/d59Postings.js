// D59 · SYNTHETIC, MINIMAL reconstructions of the postings the row quotes — the SHAPES seen in this
// project (raw HTML with escaped quotes, a label block, a coded location, clearance and export-control
// wording), not scraped pages. Every title, requisition number and sentence of body copy here is
// invented; only the structural features the row names are reproduced.

/** RTX (Marlborough, MA) — raw HTML, `\"`-escaped quotes in places, a label block, a coded location
 *  whose STREET is "Boston Post Rd", citizen_only, an active Secret clearance. */
export const RTX_HTML =
  '<p style=\\"text-align:left\\"><b>Date Posted:</b></p>2026-08-26<br>' +
  '<p style="text-align:left"><b>Country:</b></p>United States of America<br>' +
  '<p style=\\"text-align:left\\"><b>Location:</b></p>US-MA-MARLBOROUGH-MA2 1001 Boston Post Rd BLDG 2<br>' +
  '<p style="text-align:left"><b>Position Role Type:</b></p>Onsite<br>' +
  '<p style="text-align:left"><b>U.S. Citizen, U.S. Person, or Immigration Status Requirements:</b></p>' +
  'U.S. citizenship is required, as only U.S. citizens are eligible for a security clearance<br>' +
  '<p style="text-align:left"><b>Security Clearance Type:</b></p>DoD Clearance: Secret<br>' +
  '<p style="text-align:left"><b>Security Clearance Status:</b></p>Active and existing security clearance required on day 1<br><br>' +
  '<p style=\\"text-align:left\\"><b>About the role:</b></p>' +
  '<p>The Sensors team is looking for a Systems Engineer to define and verify radar subsystem requirements.</p>' +
  '<p><b>What You Will Do:</b></p><ul><li>Write and trace subsystem requirements</li>' +
  '<li>Plan integration &amp; test events with hardware teams</li></ul>' +
  '<p><b>Qualifications You Must Have:</b></p><ul><li>Bachelor&#39;s degree in engineering and 5+ years of systems engineering experience</li></ul>';

/** Northrop Grumman — an UPPERCASE label block, a polygraph, travel and relocation. Plain text. */
export const NORTHROP_TEXT = [
  "Requisition ID: R10000001",
  "Location: United States-Virginia-Chantilly",
  "CLEARANCE REQUIRED FOR START: Yes",
  "CLEARANCE TYPE: Polygraph",
  "TELECOMMUTE: No",
  "TRAVEL: Yes, 10% of the Time",
  "RELOCATION ASSISTANCE: Relocation assistance may be available",
  "",
  "Description",
  "",
  "The Mission Systems sector is seeking a Software Engineer to build ground software for space programs.",
  "",
  "Basic Qualifications:",
  "• Bachelor's degree in a STEM discipline and 2 years of related experience",
].join("\n");

/** Lockheed Martin — "active TS/SCI clearance" in running prose, NO label block. */
export const LOCKHEED_TEXT = [
  "Description: We are hiring a Cyber Engineer for an intelligence program in Littleton, CO.",
  "",
  "Basic Qualifications:",
  "• Candidates must hold an active TS/SCI clearance with the ability to pass a polygraph.",
  "• 3+ years of experience with network defense tooling.",
].join("\n");

/** Blue Origin — export-control wording → us_person, NOT citizen_only. */
export const BLUE_ORIGIN_TEXT = [
  "We are looking for a Propulsion Engineer to join the engine test team in Huntsville, AL.",
  "",
  "Qualifications:",
  "• 4+ years of experience with liquid rocket engines.",
  "",
  "Export Control Regulations: Applicants for employment at Blue Origin must be a U.S. citizen or national, U.S. permanent resident (i.e. current Green Card holder), or lawfully admitted into the U.S. as a refugee or granted asylum.",
].join("\n");

/** A HOSTILE description — script, an onerror image, a javascript: link, an iframe, styles, and the
 *  same payload entity-encoded and doubly encoded. Nothing in it may survive as markup. */
export const HOSTILE_HTML =
  '<p onclick="steal()">Great role.</p><script>window.stolen = document.cookie</script>' +
  '<img src=x onerror="alert(1)"><a href="javascript:alert(2)" onmouseover="alert(3)">Apply here</a>' +
  '<iframe src="https://evil.example/frame"></iframe><style>body{display:none}</style>' +
  '<p style="position:fixed;inset:0">Benefits</p>' +
  '&lt;script&gt;alert(4)&lt;/script&gt; &amp;lt;img src=y onerror=alert(5)&amp;gt;' +
  '<svg onload="alert(6)"><circle/></svg><object data="x.swf"></object><b>Bold words</b>';
