/** Trade names, shared by the maintenance components. Mirrors the service enum. */
export const CATEGORY_LABELS = {
  PLUMBING: 'Plumbing',
  ELECTRICAL: 'Electrical',
  CARPENTRY: 'Carpentry',
  HOUSEKEEPING: 'Housekeeping',
  INTERNET: 'Internet / Wi-Fi',
  APPLIANCE: 'Appliance',
  PEST_CONTROL: 'Pest control',
  OTHER: 'Something else',
};

/** A hint per trade, so the form nudges people toward a useful description. */
export const CATEGORY_HINTS = {
  PLUMBING: 'e.g. leaking tap, blocked drain, no water',
  ELECTRICAL: 'e.g. dead socket, flickering light, tripping switch',
  CARPENTRY: 'e.g. broken door, loose drawer, damaged window',
  HOUSEKEEPING: 'e.g. room not cleaned, waste not collected',
  INTERNET: 'e.g. no Wi-Fi signal, LAN port dead',
  APPLIANCE: 'e.g. geyser, fan or cooler not working',
  PEST_CONTROL: 'e.g. cockroaches, termites, rodents',
  OTHER: 'Describe it and it will be routed for you',
};
