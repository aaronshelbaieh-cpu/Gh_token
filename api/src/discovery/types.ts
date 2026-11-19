export type SearchHit = {
  companyName?: string;
  website?: string;
  sourceUrl: string;
  snippet?: string;
  phone?: string;
  email?: string;
  town?: string;
  county?: string;
  rating?: number;
};

export type SearchProviderContext = {
  queryText: string;
  serviceSlug: string;
  serviceName: string;
  locationName: string;
  locationType: string;
  countryCode: string;
  limit: number;
};

export interface SearchProvider {
  readonly name: string;
  search(ctx: SearchProviderContext): Promise<SearchHit[]>;
}

export type ExtractedBusiness = {
  companyName?: string;
  emails: string[];
  phones: string[];
  socials: Array<{
    platform:
      | "facebook"
      | "instagram"
      | "linkedin"
      | "twitter"
      | "tiktok"
      | "youtube"
      | "google_business"
      | "other";
    url: string;
  }>;
  contactPage?: string;
};

export type DiscoveryRunConfig = {
  provider?: string;
  limitPerQuery?: number;
  maxQueries?: number;
  serviceSlugs?: string[];
  locationIds?: string[];
  locationTypes?: string[];
  enrichWebsites?: boolean;
  dryRun?: boolean;
};
