export function getCityDisplay(city, cityLabels = {}) {
  return cityLabels[city] || city;
}

export function getCityIcon(city, cityIcons = {}) {
  return cityIcons[city] || '📍';
}

export function optionMatchesSearch(option, searchTerm) {
  const search = String(searchTerm || '').trim().toLowerCase();
  if (!search) return true;

  return String(option.searchText || `${option.label} ${option.country} ${option.region}`)
    .toLowerCase()
    .includes(search);
}

export const __weatherLocationManagerInternalsForTest = {
  getCityDisplay,
  getCityIcon,
  optionMatchesSearch,
};
