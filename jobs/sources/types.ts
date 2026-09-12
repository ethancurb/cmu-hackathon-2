export type SourceChannel = 'page' | 'structured_data' | 'search_index' | 'user_import' | 'dataset';

export type Capture = {
  url: string;
  fetchedAt: string;
  html: string;
  captureHash: string;
  sourceId: string;
};

export type FactState = 'sourced' | 'unknown' | 'conflicting';

export type ObservedFact<T> = {
  value: T | null;
  state: FactState;
  evidenceIds: string[];
};

/** Source-facing intermediate shape. It intentionally retains ambiguous values as null. */
export type ObservedListing = {
  id: string;
  sourceId: string;
  sourceFamily: string;
  url: string;
  scope: 'unit' | 'floor_plan' | 'building' | 'room';
  buildingKey: string;
  offerKey: string;
  floorPlanKey: string | null;
  scopeKey: string;
  title: ObservedFact<string>;
  address: ObservedFact<string>;
  unitLabel: ObservedFact<string>;
  propertyType: ObservedFact<'house' | 'apartment' | 'room' | 'other'>;
  bedrooms: ObservedFact<number>;
  bathrooms: ObservedFact<number>;
  fullBaths: ObservedFact<number>;
  halfBaths: ObservedFact<number>;
  rent: {
    basis: 'whole_unit' | 'per_room' | 'per_person' | 'unknown';
    period: 'month' | 'week' | 'unknown';
    amount: ObservedFact<number>;
    upperAmount: ObservedFact<number>;
    kind: 'exact' | 'from' | 'range' | 'unknown';
    semantics: 'base_rent' | 'effective_rent' | 'advertised_unspecified';
  };
  availability: ObservedFact<string>;
  utilities: Array<{ name: string; inclusion: 'included' | 'separate' | 'partial' | null; evidenceIds: string[]; terms: string | null }>;
  amenities: Array<{ label: string; value: boolean | null; evidenceIds: string[] }>;
  evidence: EvidenceRow[];
};

export type EvidenceRow = {
  id: string;
  sourceId: string;
  url: string;
  observedAt: string;
  channel: SourceChannel;
  captureHash: string;
  scopeKey: string;
  scopeKind: 'building' | 'floor_plan' | 'offer' | 'dataset';
  appliesToAllUnits: boolean;
  excerpt: string;
  locator: string;
};

export type ParseResult = { listings: ObservedListing[]; captures: Capture[]; warnings: string[] };

export function unknownFact<T>(): ObservedFact<T> {
  return { value: null, state: 'unknown', evidenceIds: [] };
}
