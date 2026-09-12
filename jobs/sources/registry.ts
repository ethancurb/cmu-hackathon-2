export type RegisteredSource = { id: string; family: string; name: string; url: string; accessMode: 'public_page' | 'index_leads' | 'link_only' | 'unavailable'; limitation: string | null; adapter?: 'cmu' | 'lobos' | 'reinhold' | 'manager' };

export const SOURCE_REGISTRY: RegisteredSource[] = [
  { id: 'cmu-offcampus', family: 'university-marketplace', name: 'CMU Off-Campus Housing', url: 'https://offcampus.housing.cmu.edu/listing', accessMode: 'public_page', limitation: 'Large public HTML; unscoped bath rows remain unknown.', adapter: 'cmu' },
  { id: 'lobos-management', family: 'direct-manager', name: 'Lobos Management', url: 'https://lobosmanagement.com/units', accessMode: 'public_page', limitation: 'Inventory cards expose advertised From prices; exact upper/base unit rent is not inferred.', adapter: 'lobos' },
  { id: 'reinhold-residential', family: 'direct-manager', name: 'Reinhold Residential', url: 'https://reinholdresidential.com/properties/shadyside-commons/', accessMode: 'public_page', limitation: 'Public availability table is unit-scoped; utilities are not stated.', adapter: 'reinhold' },
  { id: 'kerpec-management', family: 'direct-manager', name: 'Kerpec Management', url: 'https://www.kerpecmgt.com/rentals', accessMode: 'public_page', limitation: 'Bounded response returned no parseable current inventory.', adapter: 'manager' },
  { id: 'walnut-capital', family: 'direct-manager', name: 'Walnut Capital', url: 'https://www.walnutcapital.com/properties/walnut-crossings', accessMode: 'link_only', limitation: 'Survey lead; no direct adapter claimed.' },
  { id: 'zillow', family: 'portal', name: 'Zillow', url: 'https://www.zillow.com/pittsburgh-pa/apartments-2-bedrooms/', accessMode: 'link_only', limitation: 'Terms restrict automated collection/display.' },
  { id: 'trulia', family: 'portal', name: 'Trulia', url: 'https://www.trulia.com/for_rent/Pittsburgh,PA/2p_beds/', accessMode: 'link_only', limitation: 'Zillow Group restrictions; no adapter.' },
  { id: 'hotpads', family: 'portal', name: 'HotPads', url: 'https://hotpads.com/pittsburgh-pa/2-bedroom-apartments-for-rent', accessMode: 'link_only', limitation: 'Zillow Group restrictions; no adapter.' },
  { id: 'apartments-com', family: 'portal', name: 'Apartments.com', url: 'https://www.apartments.com/pittsburgh-pa/2-bedrooms/', accessMode: 'link_only', limitation: 'Terms restrict automated copying without authorization.' },
  { id: 'realtor', family: 'portal', name: 'Realtor.com', url: 'https://www.realtor.com/apartments/Pittsburgh_PA/beds-2-2', accessMode: 'link_only', limitation: 'Survey lead; no source-approved feed.' },
  { id: 'zumper', family: 'portal', name: 'Zumper', url: 'https://www.zumper.com/apartments-for-rent/pittsburgh-pa/2-beds', accessMode: 'link_only', limitation: 'Survey lead; no source-approved feed.' },
  { id: 'craigslist-pittsburgh', family: 'portal', name: 'Craigslist Pittsburgh', url: 'https://pittsburgh.craigslist.org/apa/', accessMode: 'unavailable', limitation: 'Stale/index snippets and anti-automation; excluded from seed.' },
  { id: 'facebook-marketplace', family: 'portal', name: 'Facebook Marketplace', url: 'https://www.facebook.com/marketplace/pittsburgh/propertyrentals/', accessMode: 'unavailable', limitation: 'Authentication/block wall; no bypass.' },
];

export function sourceById(id: string): RegisteredSource { const source = SOURCE_REGISTRY.find((item) => item.id === id); if (!source) throw new Error(`Unknown source ${id}`); return source; }
