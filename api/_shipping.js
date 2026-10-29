// Frais de port par zone. Les listes de pays doivent rester alignées avec
// les <optgroup data-zone="…"> de cart.html et en/cart.html.
const EUROPE = new Set([
  'France', 'Germany', 'Belgium', 'Luxembourg', 'Netherlands', 'Austria', 'Spain', 'Italy',
  'Portugal', 'Switzerland', 'Liechtenstein', 'Andorra', 'Monaco', 'San Marino',
  'United Kingdom', 'Ireland', 'Denmark', 'Sweden', 'Norway', 'Finland', 'Iceland', 'Greece',
  'Malta', 'Cyprus', 'Poland', 'Czech Republic', 'Hungary', 'Slovakia', 'Romania', 'Bulgaria',
  'Croatia', 'Slovenia', 'Estonia', 'Latvia', 'Lithuania',
  'Serbia', 'Kosovo', 'Albania', 'Bosnia and Herzegovina', 'Montenegro', 'North Macedonia',
  'Moldova', 'Ukraine', 'Georgia', 'Armenia', 'Azerbaijan',
]);

const DOM_TOM = new Set([
  'Guadeloupe', 'Martinique', 'French Guiana', 'Reunion', 'Mayotte', 'Saint Martin',
  'Saint Barthelemy', 'Saint Pierre and Miquelon', 'French Polynesia', 'New Caledonia',
  'Wallis and Futuna',
]);

const WORLD = new Set([
  'United States', 'Canada', 'Mexico', 'Belize', 'Costa Rica', 'El Salvador', 'Guatemala',
  'Honduras', 'Nicaragua', 'Panama', 'Argentina', 'Bolivia', 'Brazil', 'Chile', 'Colombia',
  'Ecuador', 'Guyana', 'Paraguay', 'Peru', 'Suriname', 'Uruguay', 'Venezuela',
  'Antigua and Barbuda', 'Bahamas', 'Barbados', 'Dominica', 'Dominican Republic', 'Grenada',
  'Haiti', 'Jamaica', 'Puerto Rico', 'Saint Kitts and Nevis', 'Saint Lucia',
  'Saint Vincent and the Grenadines', 'Trinidad and Tobago',
  'United Arab Emirates', 'China',
]);

const EUROPE_FEE = 5.99;
const EUROPE_FREE_FROM = 100;
const DOM_TOM_FEE = 15;
const WORLD_FEE = 30;

// Renvoie les frais de port en € pour un pays de livraison et un sous-total HT
// (avant remise), ou null si le pays n'est pas livrable en ligne.
export function computeShippingFee(country, subtotal) {
  if (EUROPE.has(country)) return subtotal >= EUROPE_FREE_FROM ? 0 : EUROPE_FEE;
  if (DOM_TOM.has(country)) return DOM_TOM_FEE;
  if (WORLD.has(country)) return WORLD_FEE;
  return null;
}
