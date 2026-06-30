export type RestaurantData = {
  name: string;
  categories: string[];
  subcategories: string[];
  address: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  website: string | null;
  googleMapsLink: string | null;
  googlePlaceId: string | null;
  phone: string | null;
  openingHours: unknown;
  priceLevel: number | null;
  tags: string[];
  signatureDishes: string[];
  vegetarianOptions: boolean | null;
  veganOptions: boolean | null;
};
