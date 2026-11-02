// A111 P1 (D127 P2) round 1 candidate builder. Writes candidates.json next to it.
// Employers across industries whose PUBLIC boards (greenhouse / lever / ashby / workday / smartrecruiters — the crawler's
// adapters) may carry US postings in business, management, marketing, sales, legal, arts_media and science.
// A wrong slug simply reads `dead` in the probe; alternates are listed side by side.
import fs from "node:fs";
const out = [];
const add = (atsType, company, ...slugs) => slugs.forEach(slug => out.push({ atsType, slug, company }));
const gh = (c, ...s) => add("greenhouse", c, ...s), lv = (c, ...s) => add("lever", c, ...s),
      ab = (c, ...s) => add("ashby", c, ...s), sr = (c, ...s) => add("smartrecruiters", c, ...s),
      wd = (c, ...s) => add("workday", c, ...s);

// ── banks, brokers, payments (business / sales / legal / management) ─────────────────────────
wd("Wells Fargo", "1|wellsfargo|WellsFargoJobs"); wd("Capital One", "12|capitalone|Capital_One");
wd("U.S. Bank", "1|usbank|US_Bank_Careers"); wd("PNC", "5|pnc|External"); wd("Truist", "1|truist|Careers");
wd("State Street", "1|statestreet|Global"); wd("BNY", "1|bnymellon|BNY_Careers", "5|bnymellon|BNY_Careers");
wd("Northern Trust", "1|ntrs|northerntrust"); wd("Fidelity Investments", "1|fmr|FidelityCareers");
wd("T. Rowe Price", "5|troweprice|TRowePrice"); wd("BlackRock", "1|blackrock|BlackRock_Professional");
wd("Charles Schwab", "1|schwab|External"); wd("Nasdaq", "1|nasdaq|Global_External_Site");
wd("Mastercard", "1|mastercard|CorporateCareers"); wd("Synchrony", "5|synchronyfinancial|careers");
wd("Ally", "5|ally|Ally_Careers"); wd("Citi", "5|citi|2"); wd("Citizens", "5|citizensbank|CitizensExternal");
wd("KeyBank", "1|keybank|External_Career_Site"); wd("Fifth Third", "5|fifththird|53careers");
wd("Regions", "5|regions|Regions_Careers"); wd("M&T Bank", "5|mtb|MTB"); wd("Huntington", "5|huntington|HNBcareers");
wd("Raymond James", "1|raymondjames|RaymondJamesCareers"); wd("Ameriprise", "5|ameriprise|Ameriprise");
wd("Franklin Templeton", "5|franklintempleton|Primary-External-1"); wd("Invesco", "1|invesco|IVZ");
wd("Principal Financial", "5|principal|Principal"); wd("Voya", "1|voya|VoyaJobs"); wd("Equitable", "5|equitable|External");
wd("S&P Global", "5|spgi|SPGI_Careers"); wd("Moody's", "5|moodys|moodys"); wd("MSCI", "1|msci|External");
wd("Intercontinental Exchange", "1|ice|ICE"); wd("CME Group", "1|cmegroup|cme_careers");
wd("Broadridge", "5|broadridge|Careers"); wd("FIS", "5|fis|SearchJobs"); wd("Fiserv", "5|fiserv|EXT");
wd("Global Payments", "1|tsys|TSYS"); wd("Discover", "5|discover|Discover"); sr("Visa", "Visa");
gh("Point72", "point72"); gh("Schonfeld", "schonfeld", "schonfeldstrategicadvisors"); gh("Jump Trading", "jumptrading");
gh("IMC Trading", "imc"); gh("Akuna Capital", "akunacapital"); gh("Hudson River Trading", "wehrtyou");
gh("Arcesium", "arcesium"); gh("Addepar", "addepar1", "addepar"); gh("Betterment", "betterment");
gh("Robinhood", "robinhood"); gh("Chime", "chime"); gh("SoFi", "sofi"); gh("Affirm", "affirm");
gh("Marqeta", "marqeta"); gh("Carta", "carta"); gh("Toast", "toast"); gh("Coinbase", "coinbase");
gh("Wealthsimple", "wealthsimple"); gh("Brex", "brex"); gh("Gusto", "gusto"); gh("Bilt Rewards", "biltrewards");
gh("Blackstone", "blackstone"); gh("General Atlantic", "generalatlantic"); gh("Apollo", "apollo");
gh("Bridgewater", "bridgewater89", "bridgewater"); gh("Two Sigma", "twosigma"); gh("Tradeweb", "tradeweb");
ab("Ramp", "ramp"); ab("Mercury", "mercury"); lv("Plaid", "plaid"); gh("Plaid", "plaid");

// ── insurers ─────────────────────────────────────────────────────────────────────────────────
gh("Lemonade", "lemonade"); gh("Oscar Health", "oscar"); gh("Root Insurance", "rootinc", "root");
gh("Hippo", "hippo", "hippoinsurance"); gh("Clearcover", "clearcover"); gh("Kin Insurance", "kininsurance");
gh("Ethos", "ethoslife", "ethos"); gh("Policygenius", "policygenius"); gh("Next Insurance", "nextinsurance");
gh("Coalition", "coalition"); gh("Newfront", "newfront"); gh("Vouch", "vouch");
wd("Travelers", "5|travelers|External"); wd("Nationwide", "1|nationwide|Nationwide_Career");
wd("Allstate", "5|allstate|allstate_careers"); wd("Liberty Mutual", "5|libertymutual|LMI");
wd("The Hartford", "5|thehartford|Careers_External"); wd("Chubb", "1|chubb|Chubb_External_Careers");
wd("MetLife", "5|metlife|MetLifeCareers"); wd("Prudential", "5|prudential|prudential");
wd("Aflac", "5|aflac|External"); wd("Marsh McLennan", "1|mmc|MMC"); wd("Aon", "5|aon|AonCareers");
wd("WTW", "1|wtw|WTWCareers"); wd("Unum", "1|unum|External"); wd("Lincoln Financial", "1|lfg|LFG_Careers");

// ── consulting / professional services ───────────────────────────────────────────────────────
wd("PwC", "3|pwc|Global_Experienced_Careers"); wd("KPMG", "5|kpmg|KPMG_US"); wd("Accenture", "103|accenture|AccentureCareers");
wd("Booz Allen", "1|bah|BAH_Jobs"); wd("Guidehouse", "1|guidehouse|External"); wd("FTI Consulting", "5|fticonsulting|FTI_Careers");
wd("Huron", "1|huronconsultinggroup|huroncareers"); wd("Gartner", "5|gartner|EXT"); wd("ICF", "5|icf|ICF_Careers");
wd("CBRE", "5|cbre|CBRE_Careers"); wd("JLL", "1|jll|jllcareers"); wd("Cushman & Wakefield", "1|cushmanwakefield|External");
gh("West Monroe", "westmonroe", "westmonroepartners"); gh("Slalom", "slalom"); gh("Analysis Group", "analysisgroup");
gh("Cornerstone Research", "cornerstoneresearch"); gh("Charles River Associates", "crai"); gh("L.E.K. Consulting", "lek", "lekconsulting");
gh("Simon-Kucher", "simonkucher"); gh("Alvarez & Marsal", "alvarezmarsal"); gh("Kearney", "kearney"); gh("Oliver Wyman", "oliverwyman");
gh("Clearview Healthcare Partners", "clearviewhealthcarepartners"); gh("Putnam Associates", "putnamassociates");
gh("Capco", "capco"); gh("Protiviti", "protiviti");

// ── consumer goods / retail corporate ────────────────────────────────────────────────────────
wd("Nike", "1|nike|nke"); wd("Target", "5|target|targetcareers"); wd("Walmart", "5|walmart|WalmartExternal");
wd("Gap Inc.", "1|gapinc|GAPINC"); wd("Coca-Cola", "1|coke|coca-cola-careers"); wd("Kraft Heinz", "1|heinz|KraftHeinz_Careers");
wd("General Mills", "5|generalmills|General_Mills_Careers"); wd("Estée Lauder", "1|elcompanies|External");
wd("Mattel", "5|mattel|Mattel"); wd("Hasbro", "5|hasbro|Hasbro_Careers"); wd("Kohl's", "1|kohls|kohlscareers");
wd("Best Buy", "5|bestbuy|BestBuy"); wd("Lululemon", "3|lululemon|lululemon"); wd("VF Corp", "5|vfc|vfc_careers");
wd("Ralph Lauren", "1|ralphlauren|ralphlaurencareers"); wd("Tapestry", "1|tapestry|External"); wd("PVH", "1|pvh|PVH_Careers");
wd("Levi Strauss", "5|levistrauss|External"); wd("Hershey", "5|hershey|hershey"); wd("Mondelez", "3|mdlz|External");
wd("Clorox", "5|clorox|Clorox"); wd("Kimberly-Clark", "1|kimberlyclark|GLOBAL"); wd("Colgate-Palmolive", "5|colgate|Colgate");
wd("Keurig Dr Pepper", "1|kdp|KDP"); wd("Constellation Brands", "1|cbrands|CBI_External_Careers");
wd("Williams-Sonoma", "5|williamssonoma|WSI"); wd("Chewy", "5|chewy|Chewy"); wd("Ulta Beauty", "5|ulta|ulta");
sr("McDonald's", "McDonaldsCorporation"); sr("Sephora", "Sephora"); sr("IKEA", "IKEA"); sr("Skechers", "Skechers");
gh("Warby Parker", "warbyparker"); gh("Allbirds", "allbirds"); gh("Glossier", "glossier"); gh("SKIMS", "skims");
gh("Away", "awaytravel", "away"); gh("Harry's", "harrys"); gh("Sweetgreen", "sweetgreen"); gh("Bombas", "bombas");
gh("FIGS", "figs", "wearfigs"); gh("Faire", "faire"); gh("Etsy", "etsy"); gh("Instacart", "instacart");
gh("Rent the Runway", "renttherunway"); gh("ThredUp", "thredup"); gh("The RealReal", "therealreal");
gh("Stitch Fix", "stitchfix"); gh("Olaplex", "olaplex"); gh("Brooklinen", "brooklinen"); gh("Parachute", "parachutehome");
gh("Rhode", "rhode"); gh("Liquid Death", "liquiddeath"); gh("Athletic Brewing", "athleticbrewing");
gh("Olipop", "olipop"); gh("Chobani", "chobani"); gh("Oatly", "oatly"); gh("Huel", "huel");
gh("Hims & Hers", "himshers"); ab("Hims & Hers", "hims-and-hers"); gh("Peloton", "peloton"); gh("Squarespace", "squarespace");
gh("Wayfair", "wayfair"); gh("Gopuff", "gopuff"); gh("Poshmark", "poshmark"); gh("Mejuri", "mejuri"); gh("Quince", "quince");
ab("Quince", "quince"); gh("Vuori", "vuori"); gh("Aritzia", "aritzia"); gh("Kendra Scott", "kendrascott");

// ── media / publishing / entertainment ───────────────────────────────────────────────────────
gh("The New York Times", "thenewyorktimes", "nytimes"); gh("Vox Media", "voxmedia"); gh("BuzzFeed", "buzzfeed");
gh("Axios", "axios"); gh("The Atlantic", "theatlantic"); gh("Bustle Digital Group", "bustledigitalgroup", "bdg");
gh("Politico", "politico"); gh("Business Insider", "insider", "businessinsider"); gh("Dotdash Meredith", "dotdashmeredith");
gh("Vice Media", "vicemedia", "vice"); gh("The Athletic", "theathletic"); gh("Roku", "roku"); gh("Pinterest", "pinterest");
gh("Reddit", "reddit"); gh("Discord", "discord"); gh("Twitch", "twitch"); gh("Spotify", "spotify");
gh("A24", "a24films", "a24"); gh("Condé Nast", "condenast"); gh("Hearst", "hearst"); gh("Bloomberg Media", "bloombergmedia");
gh("The Washington Post", "washingtonpost"); gh("Penske Media", "penskemedia");
gh("Crunchyroll", "crunchyroll"); gh("Audible", "audible"); gh("SiriusXM", "siriusxm"); gh("Genius", "genius");
gh("Substack", "substack"); ab("Substack", "substack"); gh("Medium", "medium"); gh("Patreon", "patreon");
gh("Morning Brew", "morningbrew"); gh("The Information", "theinformation"); gh("Semafor", "semafor");
ab("Puck", "puck"); gh("Cameo", "cameo"); gh("Wondery", "wondery"); gh("Fanatics", "fanatics"); gh("DraftKings", "draftkings");
gh("Live Nation", "livenation"); gh("Eventbrite", "eventbrite"); gh("Electronic Arts", "ea"); gh("Riot Games", "riotgames");
gh("Epic Games", "epicgames"); gh("Niantic", "niantic"); lv("Netflix", "netflix");
wd("Warner Music", "1|wmg|WMGUS"); wd("Paramount", "5|paramount|ParamountCareers"); wd("Sony Music", "1|sonymusic|SonyMusic");
wd("Warner Bros. Discovery", "5|warnerbros|global"); wd("Fox", "1|fox|Domestic"); wd("iHeartMedia", "1|iheartmedia|External");
wd("Universal Music", "1|umusic|UMGUS"); wd("Nielsen", "5|nielsenenterprise|External"); wd("Disney", "5|disney|disneycareer");
wd("Adobe", "5|adobe|external_experienced");

// ── agencies (marketing / creative / PR) ─────────────────────────────────────────────────────
gh("Wieden+Kennedy", "wiedenkennedy"); gh("R/GA", "rga"); gh("Huge", "hugeinc", "huge"); gh("VaynerMedia", "vaynermedia");
gh("Mother", "mother"); gh("Code and Theory", "codeandtheory"); gh("Mischief", "mischief"); gh("Day One Agency", "dayoneagency");
gh("Edelman", "edelman"); gh("Ketchum", "ketchum"); gh("Weber Shandwick", "webershandwick"); gh("Brunswick Group", "brunswickgroup");
gh("Movers+Shakers", "moversshakers"); gh("Jellyfish", "jellyfish"); gh("Tinuiti", "tinuiti");
gh("Power Digital", "powerdigitalmarketing"); gh("Wpromote", "wpromote"); gh("Razorfish", "razorfish"); gh("Ogilvy", "ogilvy");
wd("Omnicom", "5|omnicom|Omnicom"); wd("Interpublic", "1|ipg|IPG"); wd("WPP", "3|wpp|wppcareers"); wd("Publicis", "3|publicis|External");

// ── legal (law-tech, in-house heavy, legal services) ─────────────────────────────────────────
gh("Ironclad", "ironcladhq", "ironclad"); ab("Harvey", "harvey"); ab("EvenUp", "evenup"); gh("Everlaw", "everlaw");
gh("Clio", "clio"); lv("Clio", "clio"); gh("LegalZoom", "legalzoom"); gh("Rocket Lawyer", "rocketlawyer");
gh("Axiom", "axiomlaw", "axiom"); gh("UnitedLex", "unitedlex"); ab("Spellbook", "spellbook");
gh("CS Disco", "csdisco", "disco"); gh("Litify", "litify"); gh("Filevine", "filevine");
gh("Hebbia", "hebbia"); ab("Hebbia", "hebbia");
wd("Thomson Reuters", "5|thomsonreuters|External_Career_Site"); wd("RELX / LexisNexis", "3|relx|relx");
wd("Wolters Kluwer", "3|wk|External"); wd("Epiq", "5|epiq|Epiq"); wd("Consilio", "1|consilio|Consilio");

// ── biotech / pharma research (science) ──────────────────────────────────────────────────────
gh("Recursion", "recursionpharmaceuticals", "recursion"); gh("insitro", "insitro"); gh("Ginkgo Bioworks", "ginkgobioworks", "ginkgo");
gh("Tempus", "tempus"); gh("GRAIL", "grailbio", "grail"); gh("10x Genomics", "10xgenomics"); gh("Benchling", "benchling");
gh("Generate Biomedicines", "generatebiomedicines"); gh("Beam Therapeutics", "beamtherapeutics"); gh("Denali", "denalitherapeutics");
gh("Intellia", "intelliatherapeutics"); gh("Sana Biotechnology", "sanabiotechnology"); gh("Lyell", "lyell", "lyellimmunopharma");
gh("Arcus Biosciences", "arcusbio", "arcusbiosciences"); gh("Alector", "alector"); gh("Twist Bioscience", "twistbioscience");
gh("Natera", "natera"); gh("Guardant Health", "guardanthealth"); gh("Exact Sciences", "exactsciences"); gh("Freenome", "freenome");
gh("Caribou Biosciences", "cariboubiosciences"); gh("Verve Therapeutics", "vervetherapeutics"); gh("Relay Therapeutics", "relaytherapeutics");
gh("Arsenal Bio", "arsenalbio"); gh("Altos Labs", "altoslabs"); gh("Calico", "calicolabs"); gh("Neumora", "neumora");
gh("Xaira", "xaira", "xairatherapeutics"); gh("Isomorphic Labs", "isomorphiclabs"); gh("Inceptive", "inceptive");
gh("Eikon Therapeutics", "eikontherapeutics"); gh("Dyno Therapeutics", "dynotherapeutics"); gh("Kriya", "kriyatherapeutics");
gh("Mammoth Biosciences", "mammothbiosciences"); gh("Scribe Therapeutics", "scribetherapeutics"); gh("Vir Biotechnology", "vir", "virbiotechnology");
gh("Seer", "seer", "seerbio"); gh("Abcellera", "abcellera"); gh("Zymeworks", "zymeworks"); gh("Absci", "absci");
gh("Synthego", "synthego"); gh("Pivot Bio", "pivotbio"); gh("Inscripta", "inscripta"); gh("Resilience", "resilience");
gh("Moderna", "modernatx"); ab("Arc Institute", "arcinstitute"); ab("Chan Zuckerberg Biohub", "czbiohub"); ab("Asimov", "asimov");
ab("NewLimit", "newlimit"); lv("Ginkgo Bioworks", "ginkgobioworks");
wd("Moderna", "1|modernatx|M_tx"); wd("Illumina", "5|illumina|illumina-careers"); wd("Vertex", "5|vrtx|Vertex_Careers");
wd("Regeneron", "1|regeneron|Careers"); wd("Gilead", "1|gilead|gileadcareers"); wd("Biogen", "5|biogen|external_career_site");
wd("Amgen", "1|amgen|Careers"); wd("Pfizer", "1|pfizer|PfizerCareers"); wd("Bristol Myers Squibb", "5|bristolmyerssquibb|BMS");
wd("Johnson & Johnson", "5|jj|JJ"); wd("Merck", "5|msd|SearchJobs"); wd("Thermo Fisher", "5|thermofisher|ThermoFisherCareers");
wd("Agilent", "1|agilent|Agilent_Careers"); wd("Danaher", "1|danaher|DanaherJobs"); wd("Eli Lilly", "5|lilly|LLY");
wd("Novartis", "3|novartis|Novartis_Careers"); wd("AstraZeneca", "3|astrazeneca|Careers"); wd("GSK", "5|gsk|GSKCareers");
wd("Takeda", "3|takeda|External"); wd("Bio-Rad", "5|bio-rad|Bio-Rad_Careers"); wd("Charles River Labs", "5|crl|CRL");
wd("IQVIA", "1|iqvia|IQVIA"); wd("Labcorp", "1|labcorp|External"); wd("Zoetis", "5|zoetis|zoetis");
sr("Sanofi", "Sanofi"); sr("Novo Nordisk", "NovoNordisk");

// ── logistics / energy corporate ─────────────────────────────────────────────────────────────
gh("Flexport", "flexport"); gh("project44", "project44"); gh("ShipBob", "shipbob"); ab("Stord", "stord"); gh("FourKites", "fourkites");
gh("Samsara", "samsara"); gh("Motive", "gomotive", "motive"); gh("Uber Freight", "uberfreight"); gh("Loadsmart", "loadsmart");
gh("Arcadia", "arcadia", "arcadiacareers"); gh("Aurora Solar", "aurorasolar");
gh("Sunrun", "sunrun"); gh("Watershed", "watershedclimate"); ab("Watershed", "watershed");
wd("FedEx", "1|fedex|FXE-External"); wd("C.H. Robinson", "5|chrobinson|CHRobinson"); wd("XPO", "1|xpo|XPO");
wd("Expeditors", "1|expeditors|Expeditors"); wd("NextEra Energy", "5|nexteraenergy|NEE"); wd("Exelon", "1|exelon|Exelon");
wd("Constellation Energy", "5|constellation|ConstellationCareers"); wd("Shell", "3|shell|ShellCareers");
wd("ExxonMobil", "5|exxonmobil|ExxonMobil"); wd("ConocoPhillips", "1|conocophillips|ConocoPhillips");

// ── SaaS / tech business functions (sales, marketing, legal, finance) ────────────────────────
gh("Datadog", "datadog"); gh("Cloudflare", "cloudflare"); gh("MongoDB", "mongodb"); gh("Okta", "okta"); gh("Twilio", "twilio");
gh("Elastic", "elastic"); gh("GitLab", "gitlab"); gh("Asana", "asana"); gh("Airtable", "airtable"); gh("HubSpot", "hubspot", "hubspotjobs");
gh("Braze", "braze"); gh("Klaviyo", "klaviyo"); gh("Gong", "gongio"); gh("Amplitude", "amplitude"); gh("Mixpanel", "mixpanel");
gh("Intercom", "intercom"); gh("Webflow", "webflow"); gh("Calendly", "calendly"); gh("PagerDuty", "pagerduty"); gh("Dropbox", "dropbox");
gh("Lyft", "lyft"); gh("Databricks", "databricks"); gh("Procore", "procoretechnologies", "procore");
gh("Zscaler", "zscaler"); gh("Highspot", "highspot"); gh("Seismic", "seismic"); gh("6sense", "6sense"); gh("ZoomInfo", "zoominfo");
gh("Outreach", "outreach"); lv("Outreach", "outreach"); lv("Attentive", "attentive"); gh("Attentive", "attentive");
gh("Lattice", "lattice"); gh("Vanta", "vanta"); ab("Vanta", "vanta"); gh("Deel", "deel"); ab("Deel", "deel");
gh("Monday.com", "mondaycom"); gh("Canva", "canva"); lv("Canva", "canva"); gh("Grammarly", "grammarly"); gh("Miro", "miro", "realtimeboardglobal");
gh("Zendesk", "zendesk"); gh("DoorDash", "doordashusa");
sr("ServiceNow", "ServiceNow"); sr("Square", "Square"); sr("Wix", "Wix"); sr("Equinox", "Equinox"); sr("Avery Dennison", "AveryDennison");

// de-duplicate exact (atsType, slug)
const seen = new Set();
const uniq = out.filter(r => { const k = `${r.atsType}:${r.slug.toLowerCase()}`; if (seen.has(k)) return false; seen.add(k); return true; });
fs.writeFileSync(new URL("./candidates.json", import.meta.url), JSON.stringify(uniq, null, 1));
console.log(`${uniq.length} candidate boards, ${new Set(uniq.map(r => r.company)).size} companies`,
  uniq.reduce((t, r) => ((t[r.atsType] = (t[r.atsType] || 0) + 1), t), {}));
