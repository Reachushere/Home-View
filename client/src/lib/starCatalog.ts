export interface CatalogStar {
  name: string;
  ra: number;
  dec: number;
  mag: number;
  bayer?: string;
  constellation?: string;
}

export const BRIGHT_STARS: CatalogStar[] = [
  { name: 'Sirius', ra: 6.752, dec: -16.716, mag: -1.46, bayer: 'α CMa', constellation: 'Canis Major' },
  { name: 'Canopus', ra: 6.399, dec: -52.696, mag: -0.74, bayer: 'α Car', constellation: 'Carina' },
  { name: 'Arcturus', ra: 14.261, dec: 19.182, mag: -0.05, bayer: 'α Boo', constellation: 'Boötes' },
  { name: 'Vega', ra: 18.616, dec: 38.784, mag: 0.03, bayer: 'α Lyr', constellation: 'Lyra' },
  { name: 'Capella', ra: 5.278, dec: 45.998, mag: 0.08, bayer: 'α Aur', constellation: 'Auriga' },
  { name: 'Rigel', ra: 5.242, dec: -8.202, mag: 0.13, bayer: 'β Ori', constellation: 'Orion' },
  { name: 'Procyon', ra: 7.655, dec: 5.225, mag: 0.34, bayer: 'α CMi', constellation: 'Canis Minor' },
  { name: 'Betelgeuse', ra: 5.919, dec: 7.407, mag: 0.42, bayer: 'α Ori', constellation: 'Orion' },
  { name: 'Aldebaran', ra: 4.599, dec: 16.509, mag: 0.85, bayer: 'α Tau', constellation: 'Taurus' },
  { name: 'Spica', ra: 13.420, dec: -11.161, mag: 0.97, bayer: 'α Vir', constellation: 'Virgo' },
  { name: 'Antares', ra: 16.490, dec: -26.432, mag: 1.04, bayer: 'α Sco', constellation: 'Scorpius' },
  { name: 'Pollux', ra: 7.755, dec: 28.026, mag: 1.14, bayer: 'β Gem', constellation: 'Gemini' },
  { name: 'Fomalhaut', ra: 22.961, dec: -29.622, mag: 1.16, bayer: 'α PsA', constellation: 'Piscis Austrinus' },
  { name: 'Deneb', ra: 20.690, dec: 45.280, mag: 1.25, bayer: 'α Cyg', constellation: 'Cygnus' },
  { name: 'Regulus', ra: 10.140, dec: 11.967, mag: 1.35, bayer: 'α Leo', constellation: 'Leo' },
  { name: 'Castor', ra: 7.577, dec: 31.888, mag: 1.58, bayer: 'α Gem', constellation: 'Gemini' },
  { name: 'Bellatrix', ra: 5.419, dec: 6.350, mag: 1.64, bayer: 'γ Ori', constellation: 'Orion' },
  { name: 'Alnilam', ra: 5.603, dec: -1.202, mag: 1.69, bayer: 'ε Ori', constellation: 'Orion' },
  { name: 'Elnath', ra: 5.438, dec: 28.608, mag: 1.65, bayer: 'β Tau', constellation: 'Taurus' },
  { name: 'Alnitak', ra: 5.679, dec: -1.943, mag: 1.77, bayer: 'ζ Ori', constellation: 'Orion' },
  { name: 'Dubhe', ra: 11.062, dec: 61.751, mag: 1.79, bayer: 'α UMa', constellation: 'Ursa Major' },
  { name: 'Mirfak', ra: 3.405, dec: 49.861, mag: 1.80, bayer: 'α Per', constellation: 'Perseus' },
  { name: 'Wezen', ra: 7.140, dec: -26.393, mag: 1.84, bayer: 'δ CMa', constellation: 'Canis Major' },
  { name: 'Sargas', ra: 17.622, dec: -42.998, mag: 1.87, bayer: 'θ Sco', constellation: 'Scorpius' },
  { name: 'Kaus Australis', ra: 18.403, dec: -34.384, mag: 1.85, bayer: 'ε Sgr', constellation: 'Sagittarius' },
  { name: 'Avior', ra: 8.375, dec: -59.509, mag: 1.86, bayer: 'ε Car', constellation: 'Carina' },
  { name: 'Alkaid', ra: 13.792, dec: 49.313, mag: 1.86, bayer: 'η UMa', constellation: 'Ursa Major' },
  { name: 'Menkalinan', ra: 5.992, dec: 44.948, mag: 1.90, bayer: 'β Aur', constellation: 'Auriga' },
  { name: 'Alhena', ra: 6.629, dec: 16.399, mag: 1.93, bayer: 'γ Gem', constellation: 'Gemini' },
  { name: 'Mintaka', ra: 5.533, dec: -0.299, mag: 2.23, bayer: 'δ Ori', constellation: 'Orion' },
  { name: 'Saiph', ra: 5.796, dec: -9.670, mag: 2.06, bayer: 'κ Ori', constellation: 'Orion' },
  { name: 'Mirzam', ra: 6.378, dec: -17.956, mag: 1.98, bayer: 'β CMa', constellation: 'Canis Major' },
  { name: 'Alphard', ra: 9.460, dec: -8.659, mag: 1.98, bayer: 'α Hya', constellation: 'Hydra' },
  { name: 'Merak', ra: 11.031, dec: 56.382, mag: 2.37, bayer: 'β UMa', constellation: 'Ursa Major' },
  { name: 'Phecda', ra: 11.897, dec: 53.695, mag: 2.44, bayer: 'γ UMa', constellation: 'Ursa Major' },
  { name: 'Megrez', ra: 12.257, dec: 57.033, mag: 3.31, bayer: 'δ UMa', constellation: 'Ursa Major' },
  { name: 'Alioth', ra: 12.900, dec: 55.960, mag: 1.77, bayer: 'ε UMa', constellation: 'Ursa Major' },
  { name: 'Mizar', ra: 13.399, dec: 54.926, mag: 2.27, bayer: 'ζ UMa', constellation: 'Ursa Major' },
  { name: 'Polaris', ra: 2.530, dec: 89.264, mag: 2.02, bayer: 'α UMi', constellation: 'Ursa Minor' },
  { name: 'Denebola', ra: 11.818, dec: 14.572, mag: 2.13, bayer: 'β Leo', constellation: 'Leo' },
  { name: 'Algol', ra: 3.136, dec: 40.956, mag: 2.12, bayer: 'β Per', constellation: 'Perseus' },
  { name: 'Algieba', ra: 10.333, dec: 19.842, mag: 2.28, bayer: 'γ Leo', constellation: 'Leo' },
  { name: 'Zosma', ra: 11.235, dec: 20.524, mag: 2.56, bayer: 'δ Leo', constellation: 'Leo' },
  { name: 'Cor Caroli', ra: 12.934, dec: 38.318, mag: 2.90, bayer: 'α CVn', constellation: 'Canes Venatici' },
  { name: 'Muphrid', ra: 13.912, dec: 18.398, mag: 2.68, bayer: 'η Boo', constellation: 'Boötes' },
  { name: 'Izar', ra: 14.750, dec: 27.074, mag: 2.37, bayer: 'ε Boo', constellation: 'Boötes' },
  { name: 'Alphecca', ra: 15.578, dec: 26.715, mag: 2.23, bayer: 'α CrB', constellation: 'Corona Borealis' },
  { name: 'Rasalhague', ra: 17.582, dec: 12.560, mag: 2.07, bayer: 'α Oph', constellation: 'Ophiuchus' },
  { name: 'Altair', ra: 19.846, dec: 8.868, mag: 0.77, bayer: 'α Aql', constellation: 'Aquila' },
  { name: 'Sadr', ra: 20.370, dec: 40.257, mag: 2.23, bayer: 'γ Cyg', constellation: 'Cygnus' },
  { name: 'Alderamin', ra: 21.310, dec: 62.586, mag: 2.51, bayer: 'α Cep', constellation: 'Cepheus' },
  { name: 'Markab', ra: 23.079, dec: 15.205, mag: 2.49, bayer: 'α Peg', constellation: 'Pegasus' },
  { name: 'Scheat', ra: 23.063, dec: 28.083, mag: 2.42, bayer: 'β Peg', constellation: 'Pegasus' },
  { name: 'Algenib', ra: 0.220, dec: 15.184, mag: 2.83, bayer: 'γ Peg', constellation: 'Pegasus' },
  { name: 'Alpheratz', ra: 0.140, dec: 29.091, mag: 2.06, bayer: 'α And', constellation: 'Andromeda' },
  { name: 'Hamal', ra: 2.120, dec: 23.462, mag: 2.00, bayer: 'α Ari', constellation: 'Aries' },
  { name: 'Menkar', ra: 3.038, dec: 4.090, mag: 2.53, bayer: 'α Cet', constellation: 'Cetus' },
  { name: 'Mira', ra: 2.323, dec: -2.978, mag: 2.00, bayer: 'ο Cet', constellation: 'Cetus' },
  { name: 'Pleiades (Alcyone)', ra: 3.791, dec: 24.105, mag: 2.87, bayer: 'η Tau', constellation: 'Taurus' },
  { name: 'Hyades (θ²Tau)', ra: 4.477, dec: 15.871, mag: 3.40, bayer: 'θ² Tau', constellation: 'Taurus' },
  { name: 'Navi', ra: 0.945, dec: 60.717, mag: 2.47, bayer: 'γ Cas', constellation: 'Cassiopeia' },
  { name: 'Schedar', ra: 0.675, dec: 56.537, mag: 2.23, bayer: 'α Cas', constellation: 'Cassiopeia' },
  { name: 'Caph', ra: 0.153, dec: 59.150, mag: 2.27, bayer: 'β Cas', constellation: 'Cassiopeia' },
  { name: 'Ruchbah', ra: 1.430, dec: 60.235, mag: 2.68, bayer: 'δ Cas', constellation: 'Cassiopeia' },
  { name: 'Adhara', ra: 6.977, dec: -28.972, mag: 1.50, bayer: 'ε CMa', constellation: 'Canis Major' },
  { name: 'Aludra', ra: 7.402, dec: -29.303, mag: 2.45, bayer: 'η CMa', constellation: 'Canis Major' },
  { name: 'Gomeisa', ra: 7.453, dec: 8.289, mag: 2.90, bayer: 'β CMi', constellation: 'Canis Minor' },
  { name: 'Naos', ra: 8.060, dec: -40.004, mag: 2.25, bayer: 'ζ Pup', constellation: 'Puppis' },
  { name: 'Azmidiske', ra: 7.822, dec: -24.860, mag: 3.34, bayer: 'ξ Pup', constellation: 'Puppis' },
  { name: 'Turais', ra: 8.126, dec: -24.305, mag: 2.78, bayer: 'ρ Pup', constellation: 'Puppis' },
  { name: 'Muscida', ra: 8.505, dec: 60.718, mag: 3.36, bayer: 'ο UMa', constellation: 'Ursa Major' },
  { name: 'Acubens', ra: 8.975, dec: 11.858, mag: 4.25, bayer: 'α Cnc', constellation: 'Cancer' },
  { name: 'Asellus Borealis', ra: 8.744, dec: 21.469, mag: 4.66, bayer: 'γ Cnc', constellation: 'Cancer' },
  { name: 'Asellus Australis', ra: 8.778, dec: 18.154, mag: 3.94, bayer: 'δ Cnc', constellation: 'Cancer' },
  { name: 'Alterf', ra: 9.314, dec: 22.968, mag: 4.31, bayer: 'λ Leo', constellation: 'Leo' },
  { name: 'Subra', ra: 9.686, dec: 9.892, mag: 3.52, bayer: 'ο Leo', constellation: 'Leo' },
  { name: 'Chertan', ra: 11.238, dec: 15.430, mag: 3.34, bayer: 'θ Leo', constellation: 'Leo' },
  { name: 'Alula Australis', ra: 11.182, dec: 31.529, mag: 3.79, bayer: 'ξ UMa', constellation: 'Ursa Major' },
  { name: 'Tania Borealis', ra: 10.286, dec: 42.915, mag: 3.45, bayer: 'λ UMa', constellation: 'Ursa Major' },
  { name: 'Tania Australis', ra: 10.383, dec: 41.499, mag: 3.06, bayer: 'μ UMa', constellation: 'Ursa Major' },
  { name: 'Alula Borealis', ra: 11.165, dec: 33.094, mag: 3.49, bayer: 'ν UMa', constellation: 'Ursa Major' },
  { name: 'Porrima', ra: 12.694, dec: -1.449, mag: 2.74, bayer: 'γ Vir', constellation: 'Virgo' },
  { name: 'Vindemiatrix', ra: 13.036, dec: 10.959, mag: 2.83, bayer: 'ε Vir', constellation: 'Virgo' },
  { name: 'Heze', ra: 13.578, dec: -0.596, mag: 3.37, bayer: 'ζ Vir', constellation: 'Virgo' },
  { name: 'Syrma', ra: 14.270, dec: -6.001, mag: 4.07, bayer: 'ι Vir', constellation: 'Virgo' },
  { name: 'Nekkar', ra: 15.032, dec: 40.390, mag: 3.58, bayer: 'β Boo', constellation: 'Boötes' },
  { name: 'Seginus', ra: 14.535, dec: 38.308, mag: 3.03, bayer: 'γ Boo', constellation: 'Boötes' },
  { name: 'Princeps', ra: 15.258, dec: 33.315, mag: 3.47, bayer: 'δ Boo', constellation: 'Boötes' },
  { name: 'Unukalhai', ra: 15.737, dec: 6.426, mag: 2.65, bayer: 'α Ser', constellation: 'Serpens' },
  { name: 'Zubenelgenubi', ra: 14.848, dec: -16.042, mag: 2.75, bayer: 'α Lib', constellation: 'Libra' },
  { name: 'Zubeneschamali', ra: 15.283, dec: -9.383, mag: 2.61, bayer: 'β Lib', constellation: 'Libra' },
  { name: 'Dschubba', ra: 16.006, dec: -22.622, mag: 2.32, bayer: 'δ Sco', constellation: 'Scorpius' },
  { name: 'Graffias', ra: 16.091, dec: -19.806, mag: 2.64, bayer: 'β Sco', constellation: 'Scorpius' },
  { name: 'Shaula', ra: 17.560, dec: -37.104, mag: 1.63, bayer: 'λ Sco', constellation: 'Scorpius' },
  { name: 'Eltanin', ra: 17.944, dec: 51.489, mag: 2.23, bayer: 'γ Dra', constellation: 'Draco' },
  { name: 'Rastaban', ra: 17.507, dec: 52.301, mag: 2.79, bayer: 'β Dra', constellation: 'Draco' },
  { name: 'Kochab', ra: 14.845, dec: 74.156, mag: 2.08, bayer: 'β UMi', constellation: 'Ursa Minor' },
  { name: 'Thuban', ra: 14.073, dec: 64.376, mag: 3.65, bayer: 'α Dra', constellation: 'Draco' },
  { name: 'Sabik', ra: 17.173, dec: -15.725, mag: 2.43, bayer: 'η Oph', constellation: 'Ophiuchus' },
  { name: 'Cebalrai', ra: 17.724, dec: 4.567, mag: 2.77, bayer: 'β Oph', constellation: 'Ophiuchus' },
  { name: 'Nunki', ra: 18.921, dec: -26.297, mag: 2.05, bayer: 'σ Sgr', constellation: 'Sagittarius' },
  { name: 'Ascella', ra: 19.043, dec: -29.880, mag: 2.59, bayer: 'ζ Sgr', constellation: 'Sagittarius' },
  { name: 'Kaus Media', ra: 18.350, dec: -29.828, mag: 2.70, bayer: 'δ Sgr', constellation: 'Sagittarius' },
  { name: 'Kaus Borealis', ra: 18.466, dec: -25.422, mag: 2.81, bayer: 'λ Sgr', constellation: 'Sagittarius' },
  { name: 'Sheliak', ra: 18.835, dec: 33.363, mag: 3.45, bayer: 'β Lyr', constellation: 'Lyra' },
  { name: 'Sulafat', ra: 18.982, dec: 32.690, mag: 3.24, bayer: 'γ Lyr', constellation: 'Lyra' },
  { name: 'Tarazed', ra: 19.771, dec: 10.613, mag: 2.72, bayer: 'γ Aql', constellation: 'Aquila' },
  { name: 'Alshain', ra: 19.922, dec: 6.407, mag: 3.71, bayer: 'β Aql', constellation: 'Aquila' },
  { name: 'Gienah', ra: 20.770, dec: 33.970, mag: 2.46, bayer: 'ε Cyg', constellation: 'Cygnus' },
  { name: 'Albireo', ra: 19.512, dec: 27.960, mag: 3.08, bayer: 'β Cyg', constellation: 'Cygnus' },
  { name: 'Enif', ra: 21.736, dec: 9.875, mag: 2.39, bayer: 'ε Peg', constellation: 'Pegasus' },
  { name: 'Sadalmelik', ra: 22.096, dec: -0.320, mag: 2.96, bayer: 'α Aqr', constellation: 'Aquarius' },
  { name: 'Sadalsuud', ra: 21.526, dec: -5.571, mag: 2.91, bayer: 'β Aqr', constellation: 'Aquarius' },
  { name: 'Deneb Algedi', ra: 21.784, dec: -16.127, mag: 2.87, bayer: 'δ Cap', constellation: 'Capricornus' },
  { name: 'Nashira', ra: 21.668, dec: -16.662, mag: 3.69, bayer: 'γ Cap', constellation: 'Capricornus' },
  { name: 'Dabih', ra: 20.350, dec: -14.781, mag: 3.08, bayer: 'β Cap', constellation: 'Capricornus' },
  { name: 'Algedi', ra: 20.294, dec: -12.508, mag: 3.57, bayer: 'α Cap', constellation: 'Capricornus' },
  { name: 'Rasalgethi', ra: 17.244, dec: 14.390, mag: 2.81, bayer: 'α Her', constellation: 'Hercules' },
  { name: 'Kornephoros', ra: 16.504, dec: 21.490, mag: 2.77, bayer: 'β Her', constellation: 'Hercules' },
  { name: 'Sarin', ra: 17.251, dec: 24.839, mag: 3.14, bayer: 'δ Her', constellation: 'Hercules' },
  { name: 'Maasym', ra: 17.005, dec: 30.926, mag: 4.41, bayer: 'λ Her', constellation: 'Hercules' },
  { name: 'Marfik', ra: 16.714, dec: 31.602, mag: 3.42, bayer: 'κ Her', constellation: 'Hercules' },
  { name: 'Wasat', ra: 7.335, dec: 21.982, mag: 3.53, bayer: 'δ Gem', constellation: 'Gemini' },
  { name: 'Mebsuta', ra: 6.732, dec: 25.131, mag: 3.06, bayer: 'ε Gem', constellation: 'Gemini' },
  { name: 'Tejat', ra: 6.383, dec: 22.514, mag: 2.88, bayer: 'μ Gem', constellation: 'Gemini' },
  { name: 'Propus', ra: 6.248, dec: 22.507, mag: 3.28, bayer: 'η Gem', constellation: 'Gemini' },
  { name: 'Furud', ra: 6.339, dec: -30.063, mag: 3.02, bayer: 'ζ CMa', constellation: 'Canis Major' },
];

const DEG = Math.PI / 180;

function julianDate(date: Date): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  const h = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  let Y = y, M = m;
  if (M <= 2) { Y -= 1; M += 12; }
  const A = Math.floor(Y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + d + h / 24 + B - 1524.5;
}

function localSiderealTime(date: Date, longitudeDeg: number): number {
  const jd = julianDate(date);
  const T = (jd - 2451545.0) / 36525.0;
  let gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - T * T * T / 38710000;
  gmst = ((gmst % 360) + 360) % 360;
  let lst = gmst + longitudeDeg;
  lst = ((lst % 360) + 360) % 360;
  return lst;
}

export interface StarPosition {
  name: string;
  az: number;
  alt: number;
  mag: number;
  bayer?: string;
  constellation?: string;
}

export function computeStarPositions(
  date: Date,
  latDeg: number = 43.67,
  lonDeg: number = -79.39,
  minAlt: number = 0,
  maxMag: number = 5.0
): StarPosition[] {
  const lst = localSiderealTime(date, lonDeg);
  const latRad = latDeg * DEG;
  const results: StarPosition[] = [];

  for (const star of BRIGHT_STARS) {
    if (star.mag > maxMag) continue;

    const raDeg = star.ra * 15;
    let ha = lst - raDeg;
    ha = ((ha % 360) + 360) % 360;
    const haRad = ha * DEG;
    const decRad = star.dec * DEG;

    const sinAlt = Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
    const alt = Math.asin(sinAlt) / DEG;

    if (alt < minAlt) continue;

    const cosAz = (Math.sin(decRad) - sinAlt * Math.sin(latRad)) / (Math.cos(Math.asin(sinAlt)) * Math.cos(latRad));
    let az = Math.acos(Math.max(-1, Math.min(1, cosAz))) / DEG;
    if (Math.sin(haRad) > 0) az = 360 - az;

    results.push({
      name: star.name,
      az,
      alt,
      mag: star.mag,
      bayer: star.bayer,
      constellation: star.constellation,
    });
  }

  return results;
}

export function starToSkyMapXY(
  az: number,
  alt: number,
  azMin: number = 120,
  azMax: number = 240,
  altMin: number = 0,
  altMax: number = 80
): { x: number; y: number } | null {
  if (az < azMin || az > azMax || alt < altMin || alt > altMax) return null;
  const x = ((az - azMin) / (azMax - azMin)) * 100;
  const y = (1 - (alt - altMin) / (altMax - altMin)) * 88 + 5;
  return { x, y };
}
