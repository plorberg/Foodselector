export type Restaurant = {
  id: string;
  name: string;
  categories: string[];
  subcategories: string[];
  address: string | null;
  city: string | null;
  district: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  website: string | null;
  googleMapsLink: string | null;
  googlePlaceId: string | null;
  phone: string | null;
  openingHours: unknown;
  priceLevel: number | null;
  distance: number | null;
  tags: string[];
  signatureDishes: string[];
  vegetarianOptions: boolean | null;
  veganOptions: boolean | null;
  reservationRecommended: boolean | null;
  deliveryAvailable: boolean | null;
  takeawayAvailable: boolean | null;
  ambience: string[];
  suitability: string[];
  personalRating: number | null;
  externalRating: number | null;
  notes: string | null;
  favorite: boolean;
  blacklisted: boolean;
  lastVisitedAt: string | null;
  fieldStatuses: Record<string, FieldStatus> | null;
  confidenceByField: Record<string, number> | null;
  createdAt: string;
  updatedAt: string;
};

export type FieldStatus =
  | "RECOGNIZED"
  | "UNCERTAIN"
  | "CONFLICTING"
  | "CONFIRMED"
  | "MODIFIED"
  | "DISCARDED";

export type RestaurantInput = Partial<
  Omit<Restaurant, "id" | "createdAt" | "updatedAt">
> & { name: string };
