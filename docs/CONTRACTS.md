# Housing contracts v1

Planning contract, to implement as Zod schemas and inferred TypeScript types in `src/domain/schema.ts`. The [design](superpowers/specs/2026-09-12-housing-design.md) controls meaning. Root owns changes to shared names; workers must not independently create competing shapes.

## Units, identities and facts

```ts
type ISODateTime = string; // validate UTC ISO timestamp, not just any string
type Id = string;
type Cents = number; // nonnegative safe integer, USD only in v1
type Coordinates = { lat: number; lon: number };
type Evidence = {
  id: Id; sourceId: Id; url: string; observedAt: ISODateTime;
  channel: 'page' | 'structured_data' | 'search_index' | 'user_import' | 'dataset';
  captureHash: string; scopeKey: string; // unit/plan/table row, not entire building
  scopeKind: 'building' | 'floor_plan' | 'offer' | 'dataset';
  appliesToAllUnits: boolean; // only true for an explicitly property-wide statement
  excerpt: string; locator: string; // local captured span or row locator
};
type Fact<T> = {
  value: T | null;
  state: 'sourced' | 'derived' | 'assumed' | 'unknown' | 'conflicting';
  evidenceIds: Id[];
  method: string | null; // required for derived/assumed, plus input IDs in detail
  observedAt: ISODateTime | null;
  alternatives?: { value: T; evidenceIds: Id[] }[];
};
type Quote = {
  basis: 'whole_unit' | 'per_room' | 'per_person' | 'unknown';
  period: 'month' | 'week' | 'unknown';
  amount: Fact<Cents>; upperAmount: Fact<Cents>;
  kind: 'exact' | 'from' | 'range' | 'unknown';
  semantics: 'base_rent' | 'effective_rent' | 'advertised_unspecified';
};
type Charge = {
  id: Id; label: string; amount: Fact<Cents>;
  cadence: 'monthly' | 'one_time' | 'usage' | 'unknown';
  allocation: 'whole_household' | 'per_person' | 'unknown';
  required: Fact<boolean>; refundable: Fact<boolean>;
};
type UtilityName = 'electricity' | 'gas' | 'water_sewer' | 'trash' | 'internet' | 'other';
type Utility = {
  name: UtilityName;
  inclusion: Fact<'included' | 'separate' | 'partial'>; // null displays as not stated
  chargeIds: Id[]; terms: Fact<string>; // caps, allowances, shared billing
  applicable: Fact<boolean>; // unknown gas service is not assumed irrelevant
};
type Destination = {
  id: Id; version: string; label: string;
  coordinate: Coordinates; evidenceIds: Id[]; caveat: string | null;
};
type WalkRoute = {
  id: Id; origin: Coordinates; destinationId: Id; destinationVersion: string;
  requestedDestination: Coordinates; snappedOrigin: Coordinates | null;
  snappedDestination: Coordinates | null;
  status: 'ok' | 'unavailable' | 'needs_review';
  durationSeconds: number | null; distanceMeters: number | null;
  geometry: { type: 'LineString'; coordinates: [number, number][] } | null;
  provider: string; profile: 'foot'; computedAt: ISODateTime;
  errorCode: string | null;
};
type TransitContext = {
  originStopId: string; originStopName: string; distanceMeters: number;
  distanceBasis: 'straight_line' | 'walking_route'; routeShortName: string;
  headsign: string; destinationStopId: string | null;
  servesDestination: boolean; serviceDate: string; window: string;
  feedVersion: string; evidenceIds: Id[]; // same ordered trip required for true
};
type NearbyPlace = {
  id: Id; name: string; category: string; coordinate: Coordinates;
  distanceMeters: number; distanceBasis: 'straight_line' | 'walking_route';
  walkSeconds: number | null; evidenceIds: Id[];
};
type ContextFact = {
  key: string; label: string; fact: Fact<string | boolean | number>;
  scope: 'unit' | 'building' | 'manager' | 'area';
};
type Home = {
  id: Id; buildingKey: Id; offerKey: Id; floorPlanKey: Id | null;
  scope: 'unit' | 'floor_plan' | 'building' | 'room';
  sourceListingIds: Id[]; primaryUrl: string; lastObservedAt: ISODateTime;
  title: Fact<string>; address: Fact<string>; unitLabel: Fact<string>;
  coordinate: Fact<Coordinates>; propertyType: Fact<'house' | 'apartment' | 'room' | 'other'>;
  bedrooms: Fact<number>; bathrooms: Fact<number>; // decimal advertised count
  fullBaths: Fact<number>; halfBaths: Fact<number>; // optional source decomposition
  rent: Quote; charges: Charge[]; utilities: Utility[];
  concessions: Fact<string>; availability: Fact<string>; leaseTerms: Fact<string>;
  listingStatus: 'observed' | 'stale' | 'reported_off_market' | 'historical';
  amenities: ContextFact[]; reviews: ContextFact[]; nearby: NearbyPlace[];
  transit: TransitContext[]; routeIds: Id[];
  photo: { url: string; evidenceId: Id; alt: string } | null;
};
```

All display facts have evidence or an explicit derivation/assumption. IDs, cache metadata and software status are not falsely presented as sourced listing claims. Derived cost/fit objects below carry input references through home ID, criterion and snapshot. `search_index` evidence is a lead, insufficient by itself to confirm a hard listing fact. Every known quote/count/availability combination must resolve to the same compatible scope; page-level existence of each string does not prove that they belong together.

## Search and outputs

```ts
type Criteria = {
  market: { label: string; region: string; country: 'US' };
  destination: Destination;
  personalRentCap: Cents;
  allocation: { occupants: number; kind: 'equal' | 'custom'; personalShareBps: number | null };
  bedrooms: number; minBathrooms: number;
  propertyTypes: ('house' | 'apartment' | 'room' | 'other')[];
  maxWalkSeconds: number;
  moveIn: null; leaseMonths: null; // flexible; timing is display/readiness-only in v1
  mustHaveAmenities: string[]; niceToHaveAmenities: string[];
  requiredIncludedUtilities: UtilityName[];
  sort: 'smallest_change' | 'personal_rent' | 'walk' | 'unresolved_costs' | 'observed_at';
};
type ConstraintResult = {
  key: string; outcome: 'pass' | 'fail' | 'unknown';
  required: string | number; actual: string | number | null;
  delta: number | null; unit: string | null; evidenceIds: Id[];
};
type CostSummary = {
  wholeHomeBaseRent: Cents | null; personalBaseRent: Cents | null;
  knownPersonalRecurring: Cents | null; // null when rent basis/allocation unknown
  unknownItems: { key: string; reason: string }[];
  completeness: 'known_components_only' | 'complete_for_stated_components' | 'unknown';
  allocationLabel: string; evidenceIds: Id[];
};
type EvaluatedHome = {
  homeId: Id; fit: 'matches' | 'near_match' | 'needs_verification';
  constraints: ConstraintResult[]; cost: CostSummary; routeId: Id | null;
  questions: { key: string; priority: number; text: string; evidenceIds: Id[] }[];
};
type CriteriaPatch = Partial<Pick<Criteria,
  'personalRentCap' | 'allocation' | 'bedrooms' | 'minBathrooms' |
  'propertyTypes' | 'maxWalkSeconds' | 'mustHaveAmenities' |
  'niceToHaveAmenities' | 'requiredIncludedUtilities'>>;
type Alternative = {
  id: Id; patch: CriteriaPatch; label: string;
  newlyMatchedIds: Id[]; noLongerMatchedIds: Id[];
  changed: { key: string; before: number | string; after: number | string; unit: string }[];
};
type SourceEntry = {
  id: Id; family: string; name: string; url: string;
  accessMode: 'public_page' | 'index_leads' | 'link_only' | 'unavailable';
  limitation: string | null;
};
type ResearchScope = {
  marketKey: string; // normalized city|region|country
  areas: { label: string; center: Coordinates | null; radiusMeters: number | null }[];
  queriedBedrooms: number[] | null; queriedMinBathrooms: number | null;
  queriedMaxWholeRent: Cents | null; // null means query did not impose this filter
  queriedPropertyTypes: string[] | null;
  destinationVersion: string; scenarioMaxWalkSeconds: number; checkedAt: ISODateTime;
  queryCount: number; limitReasons: string[];
};
type SourceRun = {
  sourceId: Id; status: 'not_searched' | 'queried' | 'fetched' | 'imported' | 'failed' | 'blocked';
  method: string; startedAt: ISODateTime | null; completedAt: ISODateTime | null;
  urlsAttempted: string[]; pagesFetched: number; observations: number;
  importedHomeIds: Id[]; duplicateObservations: number;
  queryDescription: string; bounds: string; scope: ResearchScope | null;
  error: string | null;
};
type Snapshot = {
  schemaVersion: 1; id: Id; createdAt: ISODateTime;
  discoveryMarket: Criteria['market']; searchDescription: string;
  researchScopes: ResearchScope[];
  homes: Home[]; evidence: Evidence[]; routes: WalkRoute[];
  sources: SourceEntry[]; sourceRuns: SourceRun[];
};
type SearchResult = {
  snapshotId: Id; requestId: Id; criteria: Criteria; results: EvaluatedHome[];
  alternatives: Alternative[];
  counts: { total: number; matches: number; nearMatches: number; needsVerification: number };
  discoveryNeeded: boolean; discoveryReason: string | null;
};
type Job = {
  id: Id; type: 'discovery' | 'routes';
  status: 'queued' | 'running' | 'partial' | 'succeeded' | 'failed' | 'cancelled';
  createdAt: ISODateTime; updatedAt: ISODateTime;
  progress: { completed: number; total: number | null; message: string };
  snapshotId: Id | null; error: { code: string; message: string } | null;
};
```

Roommate count is occupants **including the user**. `equal` requires `personalShareBps=null` and uses exact ratio 1/occupants; `custom` requires an integer 1–10000 basis points. Monetary comparisons use integer arithmetic/cross-multiplication; round only the displayed allocation to cents. Under equal shares, a 240001-cent rent divided by two does not pass a 120000-cent cap. A three-person equal split stays exactly 1/3, not a rounded 3333 basis points. Household ceiling is floor(personal cap / personal allocation ratio).

Included-utility filters activate only when explicitly chosen. By default `requiredIncludedUtilities=[]`, so unknown utilities affect cost completeness/readiness without failing rent/layout/walk matching. A known hard failure with other unknowns is `near_match` with both sets retained. An expired/explicitly off-market record is excluded from current matches and labeled historical; a refresh miss alone does not make it off-market.

Canonical amenity filter keys: `laundry_in_unit`, `laundry_on_site`, `parking`, `pets_allowed`, `step_free_access`, `air_conditioning`, `outdoor_space`. Their facts are boolean: true passes a must-have, explicit false fails, absent/null/conflicting is unknown. Other perks remain sourced context. Nice-to-haves are displayed comparisons and do not quietly affect hard filtering. Timing remains flexible and display/readiness-only in v1; free-text availability and lease terms are never machine-compared as dates. Advanced date/lease filtering requires a later structured contract.

| Hard condition | Passing rule |
| --- | --- |
| Bedrooms | Known source value equals requested bedrooms |
| Bathrooms | Known advertised numeric value >= requested minimum; retain full/half evidence separately |
| Personal rent | Compatible whole-home offer; `whole_unit`, `month`, `base_rent`, `exact`, known amount; exact ratio comparison <= cap |
| Property type | Known type is in chosen set |
| Walking | Route `ok`, configured foot provider, current destination ID/version, seconds <= maximum, both snaps <=75 m |
| Required utility inclusion | Explicitly included without unresolved inclusion scope; partial/separate fail, unknown/conflicting is unknown |
| Must-have amenity | Canonical boolean fact true |

Quote invariants: exact has no upper amount; range has known lower/upper with upper >= lower; from has known lower and unknown upper. Ranges/from/effective/unspecified-period or price-basis offers remain leads with an unknown personal-rent constraint in v1. No bound-based qualification is implemented. Required monthly household charges follow rent allocation, per-person charges apply once, unknown amount/allocation becomes an unresolved item. Absence of a fee disclosure remains an unresolved fee check; it is not proof that mandatory fees are zero.

`validateSnapshot` enforces state/value/evidence consistency: unknown has null value; sourced values require existing compatible evidence; derived/assumed require a method and cannot masquerade as source proof; conflicting retains alternatives. All IDs/references are unique and resolve, including source runs, sources, routes and utilities' charge IDs. Sourced rent/availability must use the same `offerKey`; layout may use that offer or its explicitly associated `floorPlanKey`; address can use the building key. Property-wide utility/amenity claims can apply only with matching building key and `appliesToAllUnits=true` supported by an explicit source statement. Parser-derived scope assignments and evidence validation precede publication. Search-index-only hard facts cannot pass. Do not claim this schema proves the source is truthful: the agent audit checks whether extraction faithfully represents it.

## Required pure functions

```ts
validateSnapshot(input: unknown): Snapshot;
computeCosts(home: Home, criteria: Criteria): CostSummary;
evaluateHome(home: Home, criteria: Criteria, routes: WalkRoute[]): EvaluatedHome;
suggestAlternatives(snapshot: Snapshot, criteria: Criteria): Alternative[];
evaluateSearch(snapshot: Snapshot, criteria: Criteria, requestId: Id): SearchResult;
applyCriteriaPatch(criteria: Criteria, patch: CriteriaPatch): Criteria;
needsDiscovery(criteria: Criteria, scopes: ResearchScope[]): { needed: boolean; reason: string | null };
reconcileHomes(existing: Home[], incoming: Home[]): Home[];
diffSnapshots(before: Snapshot, after: Snapshot): {
  addedIds: Id[]; changedIds: Id[]; notReobservedIds: Id[];
};
```

Alternative generation evaluates actual thresholds among current, supported facts: personal rent just sufficient, route seconds just sufficient, and bathroom minima 1.5/1 where relevant. Re-run the same engine for each patch; keep only patches with newly matched records, deduplicate equivalent patches, sort by changed-field count then relative size within that field, show at most three choices initially. No cross-unit comparison of “one dollar vs one minute”; group by changed requirement. Multi-change suggestions are optional after one-change behavior works.

`needsDiscovery` is true when no recorded scope covers the new market, destination version, bedroom query, relaxed bathroom minimum, enlarged rent ceiling or property-type set, or when the walk limit exceeds `scenarioMaxWalkSeconds`. A null query filter means unrestricted *query intent*, never complete market coverage. A destination change conservatively requests new research as well as new routes. Page limits and failed sources always remain visible independently of this boolean. A matching scope means existing research can be reused, not that discovery is exhaustive.

## API and job boundaries

All endpoints have JSON errors `{error:{code,message},requestId}`. Unknown route is 404, malformed input 400, stale requested snapshot 409, source/model failure as a terminal job state (not an indefinite spinner). No stack traces or credentials in browser responses. Maximum JSON input 100 KB.

| Endpoint | Request | Response |
| --- | --- | --- |
| GET `/api/bootstrap` | none | `{snapshot: Snapshot, seed: Criteria, capabilities: {discovery:boolean, routing:boolean}}` |
| GET `/api/snapshots/:id` | internally generated snapshot ID | `{snapshot: Snapshot}`; immutable result lookup for both discovery and route jobs |
| POST `/api/search` | `{snapshotId, requestId, criteria}` | `SearchResult`; uses same pure engine as client immediate previews |
| POST `/api/discovery` | `{criteria}` | HTTP 202 `{job: Job}`; at most one active job, return its ID if the same request is already active |
| GET `/api/jobs/:id` | none | `{job: Job}` |
| POST `/api/routes` | `{snapshotId, destination, homeIds}` | HTTP 202 `{job: Job}`; bounded batch, cached responses reused |
| POST `/api/destination` | `{query, market}` or `{label, coordinate}` | `{candidates: Destination[]}`; no autocomplete loop; failed geocode allows a manual map pin |
| POST `/api/import` | `{sourceId,url,text}` | HTTP 202 `{job: Job}` through the same evidence/quarantine pipeline; text max 80 KB |

The client may compute immediate edits using its validated snapshot. It then reconciles a server response only if requestId and snapshotId match current state. Publication writes the complete snapshot first, then current pointer, then terminal job state containing its snapshotId. On job success/partial, the client fetches `/api/snapshots/:id`, validates it and atomically replaces compatible state; saved home IDs and original criteria survive. A route response must also match destination.version; changed-destination results can be retained as cache but never overwrite current qualification. Missing snapshot is 404; requested stale search snapshot is 409. A job never reports success before its snapshot is readable. Browser state stores selectedHomeId, comparison IDs (max 3), current criteria, baseline criteria, and snapshotId, not a duplicate database of listing facts.

Job internals:

```ts
discover(criteria: Criteria, onProgress: (message: string) => void, signal: AbortSignal): Promise<Snapshot>;
fetchPublicPage(url: URL, signal: AbortSignal): Promise<{
  url: string; fetchedAt: ISODateTime; html: string; captureHash: string;
}>;
enrichRoutes(snapshot: Snapshot, destination: Destination, signal: AbortSignal): Promise<Snapshot>;
publishSnapshot(snapshot: Snapshot): Promise<void>;
loadCurrentSnapshot(): Promise<Snapshot>;
```

Only registered public source hosts may be fetched; reject private/loopback/link-local destinations and recheck redirects. A model-proposed URL cannot change the host policy. Limit source size/time before parsing. Data files live in `data/snapshots/<safe-id>/snapshot.json`; current is an atomic JSON pointer `data/current.json`, not a mutable partially written snapshot. Snapshot IDs are generated internally, never accepted as paths. Raw capture storage is local and ignored by Git. Committed seed facts/excerpts have original URLs; synthetic fixtures live only under `tests/fixtures/` with explicit labels.

## Decisive semantic examples

| Input | Required result |
| --- | --- |
| $2,400 base rent, 2 equal occupants | $1,200 personal base rent; rent passes |
| $2,400.01 base rent, 2 equal occupants | Rent fails, even if display rounding would appear $1,200.00 |
| $2,400 whole-home rent + unknown electricity | Rent passes; costs incomplete and electricity question visible |
| $1,200 per-room offer | Label per room; no invented $2,400 complete 2BR unit |
| Building range $1,800–$3,000, several layouts | Lead; no assumed qualifying 2BR/2BA quote |
| Included water capped at $50, excess unspecified | Preserve cap and unresolved possible excess |
| Walk duration 1200.1 s | Fails 20-minute requirement despite display rounding |
| Missing route or old destination version | Walk unknown; no confirmed walking match |
| 2BR/1.5BA with all utilities included | Bathrooms fail; utility completeness cannot compensate |
| Multi-unit page: 1BR available Sept13; 2BR available Sept10 | Each date remains with its unit; swapped date is rejected |
| Same building, different or missing unit IDs | Do not collapse into one verified unit |
| Stop on a route but reverse order from campus | Nearby transit only; no claimed commute service |
| New snapshot or late response | Keep selected IDs, reject obsolete request/destination results |
