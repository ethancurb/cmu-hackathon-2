import { z } from 'zod';

const IdSchema = z.string().min(1);
const CentsSchema = z.number().int().safe().nonnegative();
const ISODateTimeSchema = z.string().datetime({ offset: true });
const CoordinatesSchema = z.object({
  lat: z.number().gte(-90).lte(90),
  lon: z.number().gte(-180).lte(180),
}).strict();

export const EvidenceSchema = z.object({
  id: IdSchema, sourceId: IdSchema, url: z.url(), observedAt: ISODateTimeSchema,
  channel: z.enum(['page', 'structured_data', 'search_index', 'user_import', 'dataset']),
  captureHash: z.string().min(1), scopeKey: z.string().min(1),
  scopeKind: z.enum(['building', 'floor_plan', 'offer', 'dataset']),
  appliesToAllUnits: z.boolean(), excerpt: z.string().min(1), locator: z.string().min(1),
}).strict();

export const FactSchema = <T extends z.ZodType>(valueSchema: T) => z.object({
  value: valueSchema.nullable(),
  state: z.enum(['sourced', 'derived', 'assumed', 'unknown', 'conflicting']),
  evidenceIds: z.array(IdSchema), method: z.string().min(1).nullable(),
  observedAt: ISODateTimeSchema.nullable(),
  alternatives: z.array(z.object({ value: valueSchema, evidenceIds: z.array(IdSchema) }).strict()).optional(),
}).strict().superRefine((fact, ctx) => {
  const value = (fact as unknown as { value: unknown }).value;
  if (fact.state === 'unknown' && (value !== null || fact.evidenceIds.length > 0)) {
    ctx.addIssue({ code: 'custom', message: 'unknown facts require null value and no evidence' });
  }
  if ((fact.state === 'derived' || fact.state === 'assumed') && !fact.method) {
    ctx.addIssue({ code: 'custom', message: 'derived and assumed facts require a method' });
  }
  if (fact.state === 'sourced' && (value === null || fact.evidenceIds.length === 0)) {
    ctx.addIssue({ code: 'custom', message: 'sourced facts require a value and evidence' });
  }
  if (fact.state === 'conflicting' && (!fact.alternatives || fact.alternatives.length < 2)) {
    ctx.addIssue({ code: 'custom', message: 'conflicting facts require alternatives' });
  }
});

export const QuoteSchema = z.object({
  basis: z.enum(['whole_unit', 'per_room', 'per_person', 'unknown']),
  period: z.enum(['month', 'week', 'unknown']),
  amount: FactSchema(CentsSchema), upperAmount: FactSchema(CentsSchema),
  kind: z.enum(['exact', 'from', 'range', 'unknown']),
  semantics: z.enum(['base_rent', 'effective_rent', 'advertised_unspecified']),
}).strict().superRefine((quote, ctx) => {
  const knownAmount = quote.amount.value !== null;
  const knownUpper = quote.upperAmount.value !== null;
  if (quote.kind === 'exact' && (!knownAmount || knownUpper)) {
    ctx.addIssue({ code: 'custom', message: 'exact quotes require only a known lower amount' });
  }
  if (quote.kind === 'from' && (!knownAmount || knownUpper)) {
    ctx.addIssue({ code: 'custom', message: 'from quotes require a lower amount and unknown upper amount' });
  }
  if (quote.kind === 'range' && (!knownAmount || !knownUpper || quote.upperAmount.value! < quote.amount.value!)) {
    ctx.addIssue({ code: 'custom', message: 'range quotes require ordered lower and upper amounts' });
  }
});

export const ChargeSchema = z.object({
  id: IdSchema, label: z.string().min(1), amount: FactSchema(CentsSchema),
  cadence: z.enum(['monthly', 'one_time', 'usage', 'unknown']),
  allocation: z.enum(['whole_household', 'per_person', 'unknown']),
  required: FactSchema(z.boolean()), refundable: FactSchema(z.boolean()),
}).strict();

export const UtilityNameSchema = z.enum(['electricity', 'gas', 'water_sewer', 'trash', 'internet', 'other']);
export const UtilitySchema = z.object({
  name: UtilityNameSchema, inclusion: FactSchema(z.enum(['included', 'separate', 'partial'])),
  chargeIds: z.array(IdSchema), terms: FactSchema(z.string()), applicable: FactSchema(z.boolean()),
}).strict();

export const DestinationSchema = z.object({
  id: IdSchema, version: z.string().min(1), label: z.string().min(1), coordinate: CoordinatesSchema,
  evidenceIds: z.array(IdSchema).min(1), caveat: z.string().nullable(),
}).strict();

export const WalkRouteSchema = z.object({
  id: IdSchema, origin: CoordinatesSchema, destinationId: IdSchema, destinationVersion: z.string().min(1),
  requestedDestination: CoordinatesSchema, snappedOrigin: CoordinatesSchema.nullable(), snappedDestination: CoordinatesSchema.nullable(),
  status: z.enum(['ok', 'unavailable', 'needs_review']), durationSeconds: z.number().nonnegative().nullable(), distanceMeters: z.number().nonnegative().nullable(),
  geometry: z.object({ type: z.literal('LineString'), coordinates: z.array(z.tuple([z.number().gte(-180).lte(180), z.number().gte(-90).lte(90)])).min(2) }).strict().nullable(),
  provider: z.string().min(1), profile: z.literal('foot'), computedAt: ISODateTimeSchema, errorCode: z.string().nullable(),
}).strict().superRefine((route, ctx) => {
  if (route.status === 'ok' && (route.durationSeconds === null || route.distanceMeters === null || route.geometry === null)) {
    ctx.addIssue({ code: 'custom', message: 'ok routes require duration, distance and geometry' });
  }
});

export const TransitContextSchema = z.object({
  originStopId: z.string().min(1), originStopName: z.string().min(1), distanceMeters: z.number().nonnegative(),
  distanceBasis: z.enum(['straight_line', 'walking_route']), routeShortName: z.string().min(1), headsign: z.string().min(1),
  destinationStopId: z.string().nullable(), servesDestination: z.boolean(), serviceDate: z.string().date(), window: z.string().min(1),
  feedVersion: z.string().min(1), evidenceIds: z.array(IdSchema),
}).strict();

export const NearbyPlaceSchema = z.object({
  id: IdSchema, name: z.string().min(1), category: z.string().min(1), coordinate: CoordinatesSchema,
  distanceMeters: z.number().nonnegative(), distanceBasis: z.enum(['straight_line', 'walking_route']), walkSeconds: z.number().nonnegative().nullable(), evidenceIds: z.array(IdSchema),
}).strict();
export const ContextFactSchema = z.object({
  key: z.string().min(1), label: z.string().min(1), fact: FactSchema(z.union([z.string(), z.boolean(), z.number()])),
  scope: z.enum(['unit', 'building', 'manager', 'area']),
}).strict();

export const HomeSchema = z.object({
  id: IdSchema, buildingKey: IdSchema, offerKey: IdSchema, floorPlanKey: IdSchema.nullable(), scope: z.enum(['unit', 'floor_plan', 'building', 'room']),
  sourceListingIds: z.array(IdSchema).min(1), primaryUrl: z.url(), lastObservedAt: ISODateTimeSchema,
  title: FactSchema(z.string()), address: FactSchema(z.string()), unitLabel: FactSchema(z.string()), coordinate: FactSchema(CoordinatesSchema),
  propertyType: FactSchema(z.enum(['house', 'apartment', 'room', 'other'])), bedrooms: FactSchema(z.number().nonnegative()), bathrooms: FactSchema(z.number().nonnegative()),
  fullBaths: FactSchema(z.number().nonnegative()), halfBaths: FactSchema(z.number().nonnegative()), rent: QuoteSchema, charges: z.array(ChargeSchema), utilities: z.array(UtilitySchema),
  concessions: FactSchema(z.string()), availability: FactSchema(z.string()), leaseTerms: FactSchema(z.string()),
  listingStatus: z.enum(['observed', 'stale', 'reported_off_market', 'historical']), amenities: z.array(ContextFactSchema), reviews: z.array(ContextFactSchema), nearby: z.array(NearbyPlaceSchema), transit: z.array(TransitContextSchema), routeIds: z.array(IdSchema),
  photo: z.object({ url: z.url(), evidenceId: IdSchema, alt: z.string().min(1) }).strict().nullable(),
}).strict().superRefine((home, ctx) => {
  if (new Set(home.charges.map((charge) => charge.id)).size !== home.charges.length) ctx.addIssue({ code: 'custom', message: 'charge IDs must be unique per home' });
  if (new Set(home.utilities.map((utility) => utility.name)).size !== home.utilities.length) ctx.addIssue({ code: 'custom', message: 'utility names must be unique per home' });
});

export const CriteriaSchema = z.object({
  market: z.object({ label: z.string().min(1), region: z.string().min(1), country: z.literal('US') }).strict(), destination: DestinationSchema,
  personalRentCap: CentsSchema, allocation: z.object({ occupants: z.number().int().positive(), kind: z.enum(['equal', 'custom']), personalShareBps: z.number().int().gte(1).lte(10000).nullable() }).strict(),
  bedrooms: z.number().nonnegative(), minBathrooms: z.number().nonnegative(), propertyTypes: z.array(z.enum(['house', 'apartment', 'room', 'other'])).min(1), maxWalkSeconds: z.number().nonnegative(),
  moveIn: z.null(), leaseMonths: z.null(), mustHaveAmenities: z.array(z.string().min(1)), niceToHaveAmenities: z.array(z.string().min(1)), requiredIncludedUtilities: z.array(UtilityNameSchema),
  sort: z.enum(['smallest_change', 'personal_rent', 'walk', 'unresolved_costs', 'observed_at']),
}).strict().superRefine((criteria, ctx) => {
  const invalidEqual = criteria.allocation.kind === 'equal' && criteria.allocation.personalShareBps !== null;
  const invalidCustom = criteria.allocation.kind === 'custom' && criteria.allocation.personalShareBps === null;
  if (invalidEqual || invalidCustom) ctx.addIssue({ code: 'custom', message: 'equal shares have no BPS; custom shares require BPS' });
});

export const CriteriaPatchSchema = z.object({
  personalRentCap: CentsSchema, allocation: z.object({ occupants: z.number().int().positive(), kind: z.enum(['equal', 'custom']), personalShareBps: z.number().int().gte(1).lte(10000).nullable() }).strict(),
  bedrooms: z.number().nonnegative(), minBathrooms: z.number().nonnegative(), propertyTypes: z.array(z.enum(['house', 'apartment', 'room', 'other'])).min(1), maxWalkSeconds: z.number().nonnegative(),
  mustHaveAmenities: z.array(z.string().min(1)), niceToHaveAmenities: z.array(z.string().min(1)), requiredIncludedUtilities: z.array(UtilityNameSchema),
}).partial().strict();

export const ResearchScopeSchema = z.object({
  marketKey: z.string().min(1), areas: z.array(z.object({ label: z.string().min(1), center: CoordinatesSchema.nullable(), radiusMeters: z.number().positive().nullable() }).strict()),
  queriedBedrooms: z.array(z.number().nonnegative()).nullable(), queriedMinBathrooms: z.number().nonnegative().nullable(), queriedMaxWholeRent: CentsSchema.nullable(), queriedPropertyTypes: z.array(z.string().min(1)).nullable(),
  destinationVersion: z.string().min(1), scenarioMaxWalkSeconds: z.number().nonnegative(), checkedAt: ISODateTimeSchema, queryCount: z.number().int().nonnegative(), limitReasons: z.array(z.string()),
}).strict();
export const SourceEntrySchema = z.object({ id: IdSchema, family: z.string().min(1), name: z.string().min(1), url: z.url(), accessMode: z.enum(['public_page', 'index_leads', 'link_only', 'unavailable']), limitation: z.string().nullable() }).strict();
export const SourceRunSchema = z.object({
  sourceId: IdSchema, status: z.enum(['not_searched', 'queried', 'fetched', 'imported', 'failed', 'blocked']), method: z.string().min(1), startedAt: ISODateTimeSchema.nullable(), completedAt: ISODateTimeSchema.nullable(),
  urlsAttempted: z.array(z.url()), pagesFetched: z.number().int().nonnegative(), observations: z.number().int().nonnegative(), importedHomeIds: z.array(IdSchema), duplicateObservations: z.number().int().nonnegative(),
  queryDescription: z.string(), bounds: z.string(), scope: ResearchScopeSchema.nullable(), error: z.string().nullable(),
}).strict();

export const SnapshotSchema = z.object({
  schemaVersion: z.literal(1), id: IdSchema, createdAt: ISODateTimeSchema, discoveryMarket: CriteriaSchema.shape.market, searchDescription: z.string(), researchScopes: z.array(ResearchScopeSchema),
  homes: z.array(HomeSchema), evidence: z.array(EvidenceSchema), routes: z.array(WalkRouteSchema), sources: z.array(SourceEntrySchema), sourceRuns: z.array(SourceRunSchema),
}).strict();

export type Evidence = z.infer<typeof EvidenceSchema>;
export type Id = string;
export type Cents = number;
export type ISODateTime = string;
export type Coordinates = z.infer<typeof CoordinatesSchema>;
export type Fact<T> = { value: T | null; state: 'sourced' | 'derived' | 'assumed' | 'unknown' | 'conflicting'; evidenceIds: string[]; method: string | null; observedAt: string | null; alternatives?: { value: T; evidenceIds: string[] }[] };
export type Quote = z.infer<typeof QuoteSchema>; export type Charge = z.infer<typeof ChargeSchema>; export type Utility = z.infer<typeof UtilitySchema>; export type UtilityName = z.infer<typeof UtilityNameSchema>;
export type Destination = z.infer<typeof DestinationSchema>; export type WalkRoute = z.infer<typeof WalkRouteSchema>; export type TransitContext = z.infer<typeof TransitContextSchema>; export type NearbyPlace = z.infer<typeof NearbyPlaceSchema>; export type ContextFact = z.infer<typeof ContextFactSchema>; export type Home = z.infer<typeof HomeSchema>;
export type Criteria = z.infer<typeof CriteriaSchema>; export type CriteriaPatch = z.infer<typeof CriteriaPatchSchema>; export type ResearchScope = z.infer<typeof ResearchScopeSchema>; export type SourceEntry = z.infer<typeof SourceEntrySchema>; export type SourceRun = z.infer<typeof SourceRunSchema>; export type Snapshot = z.infer<typeof SnapshotSchema>;
export type ConstraintResult = { key: string; outcome: 'pass' | 'fail' | 'unknown'; required: string | number; actual: string | number | null; delta: number | null; unit: string | null; evidenceIds: string[] };
export type CostSummary = { wholeHomeBaseRent: number | null; personalBaseRent: number | null; knownPersonalRecurring: number | null; unknownItems: { key: string; reason: string }[]; completeness: 'known_components_only' | 'complete_for_stated_components' | 'unknown'; allocationLabel: string; evidenceIds: string[] };
export type EvaluatedHome = { homeId: string; fit: 'matches' | 'near_match' | 'needs_verification'; constraints: ConstraintResult[]; cost: CostSummary; routeId: string | null; questions: { key: string; priority: number; text: string; evidenceIds: string[] }[] };
export type Alternative = { id: string; patch: CriteriaPatch; label: string; newlyMatchedIds: string[]; noLongerMatchedIds: string[]; changed: { key: string; before: number | string; after: number | string; unit: string }[] };
export type SearchResult = { snapshotId: string; requestId: string; criteria: Criteria; results: EvaluatedHome[]; alternatives: Alternative[]; counts: { total: number; matches: number; nearMatches: number; needsVerification: number }; discoveryNeeded: boolean; discoveryReason: string | null };

export const SEED_CRITERIA: Criteria = CriteriaSchema.parse({
  market: { label: 'Pittsburgh / CMU', region: 'PA', country: 'US' },
  destination: { id: 'destination:gates-hillman', version: 'osm-node-1704796692-v1', label: 'Gates Hillman — mapped entrance', coordinate: { lat: 40.4440338, lon: -79.9445593 }, evidenceIds: ['destination:gates-hillman:osm'], caveat: 'Mapped entrance; physical entrance verification is pending.' },
  personalRentCap: 120000, allocation: { occupants: 2, kind: 'equal', personalShareBps: null }, bedrooms: 2, minBathrooms: 2,
  propertyTypes: ['house', 'apartment'], maxWalkSeconds: 1200, moveIn: null, leaseMonths: null,
  mustHaveAmenities: [], niceToHaveAmenities: [], requiredIncludedUtilities: [], sort: 'smallest_change',
});

const isSearchIndexOnly = (ids: string[], evidence: Map<string, Evidence>) => ids.length > 0 && ids.every((id) => evidence.get(id)?.channel === 'search_index');
const allKnownReferencesExist = (ids: string[], available: Set<string>) => ids.every((id) => available.has(id));

export function validateSnapshot(input: unknown): Snapshot {
  const snapshot = SnapshotSchema.parse(input);
  const unique = (name: string, ids: string[]) => {
    if (new Set(ids).size !== ids.length) throw new Error(`${name} IDs must be unique`);
  };
  unique('home', snapshot.homes.map((home) => home.id)); unique('evidence', snapshot.evidence.map((item) => item.id)); unique('route', snapshot.routes.map((route) => route.id)); unique('source', snapshot.sources.map((source) => source.id));
  const evidence = new Map(snapshot.evidence.map((item) => [item.id, item]));
  const evidenceIds = new Set(evidence.keys()); const homeIds = new Set(snapshot.homes.map((home) => home.id)); const routeIds = new Set(snapshot.routes.map((route) => route.id)); const sourceIds = new Set(snapshot.sources.map((source) => source.id));
  if (!snapshot.evidence.every((item) => sourceIds.has(item.sourceId))) throw new Error('evidence references missing source');
  const verifyFact = (fact: Fact<unknown>, scopeKeys: string[], hard = false) => {
    if (!allKnownReferencesExist(fact.evidenceIds, evidenceIds)) throw new Error('fact references missing evidence');
    if (fact.alternatives && !fact.alternatives.every((alternative) => allKnownReferencesExist(alternative.evidenceIds, evidenceIds))) throw new Error('fact alternative references missing evidence');
    if (fact.state === 'sourced') {
      if (hard && isSearchIndexOnly(fact.evidenceIds, evidence)) throw new Error('search-index evidence cannot prove hard facts');
      if (!fact.evidenceIds.every((id) => scopeKeys.includes(evidence.get(id)!.scopeKey))) throw new Error('sourced fact has incompatible evidence scope');
    }
  };
  for (const home of snapshot.homes) {
    const buildingOrOffer = [home.buildingKey, home.offerKey, ...(home.floorPlanKey ? [home.floorPlanKey] : [])];
    const offerOrPlan = [home.offerKey, ...(home.floorPlanKey ? [home.floorPlanKey] : [])];
    verifyFact(home.title, buildingOrOffer); verifyFact(home.address, [home.buildingKey]); verifyFact(home.unitLabel, [home.offerKey]); verifyFact(home.coordinate, [home.buildingKey, home.offerKey]);
    verifyFact(home.propertyType, buildingOrOffer, true); verifyFact(home.bedrooms, offerOrPlan, true); verifyFact(home.bathrooms, offerOrPlan, true); verifyFact(home.fullBaths, offerOrPlan); verifyFact(home.halfBaths, offerOrPlan); verifyFact(home.concessions, [home.offerKey]); verifyFact(home.availability, [home.offerKey], true); verifyFact(home.leaseTerms, [home.offerKey]);
    verifyFact(home.rent.amount, [home.offerKey], true); verifyFact(home.rent.upperAmount, [home.offerKey], true);
    for (const charge of home.charges) { verifyFact(charge.amount, [home.offerKey, home.buildingKey]); verifyFact(charge.required, [home.offerKey, home.buildingKey]); verifyFact(charge.refundable, [home.offerKey, home.buildingKey]); }
    for (const utility of home.utilities) {
      if (!allKnownReferencesExist(utility.chargeIds, new Set(home.charges.map((charge) => charge.id)))) throw new Error('utility references missing charge');
      verifyFact(utility.inclusion, [home.offerKey, home.buildingKey]); verifyFact(utility.terms, [home.offerKey, home.buildingKey]); verifyFact(utility.applicable, [home.offerKey, home.buildingKey]);
      for (const evidenceId of [...utility.inclusion.evidenceIds, ...utility.terms.evidenceIds, ...utility.applicable.evidenceIds]) if (evidence.get(evidenceId)?.scopeKey === home.buildingKey && !evidence.get(evidenceId)?.appliesToAllUnits) throw new Error('building utility evidence must explicitly apply to all units');
    }
    if (!allKnownReferencesExist(home.routeIds, routeIds)) throw new Error('home references missing route');
    for (const context of [...home.amenities, ...home.reviews]) verifyFact(context.fact, context.scope === 'building' ? [home.buildingKey] : context.scope === 'unit' ? [home.offerKey] : buildingOrOffer);
    for (const place of home.nearby) if (!allKnownReferencesExist(place.evidenceIds, evidenceIds)) throw new Error('nearby place references missing evidence');
    for (const transit of home.transit) if (!allKnownReferencesExist(transit.evidenceIds, evidenceIds)) throw new Error('transit references missing evidence');
    if (home.photo && !evidenceIds.has(home.photo.evidenceId)) throw new Error('photo references missing evidence');
  }
  for (const route of snapshot.routes) if (route.destinationId !== SEED_CRITERIA.destination.id && !snapshot.researchScopes.some((scope) => scope.destinationVersion === route.destinationVersion)) throw new Error('route destination does not resolve to snapshot scope');
  for (const sourceRun of snapshot.sourceRuns) {
    if (!sourceIds.has(sourceRun.sourceId)) throw new Error('source run references missing source');
    if (!allKnownReferencesExist(sourceRun.importedHomeIds, homeIds)) throw new Error('source run references missing home');
  }
  return snapshot;
}
