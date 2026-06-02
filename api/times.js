const DB = require('../data/db');

// Dekodiert die delta-kodierten Monatsdaten
function decode(rows) {
  const result = [rows[0].slice()];
  for (let i = 1; i < rows.length; i++) {
    const p = result[i - 1], d = rows[i];
    result.push([p[0]+d[0], p[1]+d[1], p[2]+d[2], p[3]+d[3], p[4]+d[4]]);
  }
  return result;
}

// Minuten → "HH:MM"
function fmt(m) {
  const hh = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return String(hh).padStart(2,'0') + ':' + String(mm).padStart(2,'0');
}

// IZR Isha-Regel: Maghrib + 90 Min, im Hochsommer (15.Mai–8.Aug) + 100 Min
function ishaOffset(month, day) {
  if (month === 5 && day >= 15) return 100;
  if (month === 6 || month === 7) return 100;
  if (month === 8 && day <= 8)   return 100;
  return 90;
}

module.exports = (req, res) => {
  // CORS: Zugriff von jeder WordPress-Seite erlauben
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=86400'); // 24h cachen

  const { city, year, month } = req.query;

  // Validierung
  const validCities = ['Zürich','Genf','Basel','Bern','Luzern','Aargau'];
  if (!city || !year || !month) {
    return res.status(400).json({ error: 'Parameter fehlen. Benötigt: city, year, month' });
  }
  if (!validCities.includes(city)) {
    return res.status(400).json({ error: `Ungültige Stadt. Verfügbar: ${validCities.join(', ')}` });
  }
  const y = parseInt(year), m = parseInt(month);
  if (isNaN(y) || y < 2024 || y > 2040) {
    return res.status(400).json({ error: 'Ungültiges Jahr. Gültig: 2024–2040' });
  }
  if (isNaN(m) || m < 1 || m > 12) {
    return res.status(400).json({ error: 'Ungültiger Monat. Gültig: 1–12' });
  }

  // Daten laden
  const raw = DB[city]?.[String(y)]?.[String(m)];
  if (!raw) {
    return res.status(404).json({ error: 'Keine Daten gefunden' });
  }

  // Dekodieren und formatieren
  const decoded = decode(raw);
  const fajrAngle = (m >= 3 && m <= 9) ? 13 : 12.5;

  const data = decoded.map((r, idx) => {
    const day = idx + 1;
    const offset = ishaOffset(m, day);
    return {
      tag:     day,
      fajr:    fmt(r[0]),
      schuruck: fmt(r[1]),
      dhuhr:   fmt(r[2]),
      asr:     fmt(r[3]),
      maghrib: fmt(r[4]),
      isha:    fmt(r[4] + offset)
    };
  });

  return res.json({
    city, year: y, month: m,
    methode: 'IZR – Islamisches Zentrum Reinach',
    fajr_winkel: `${fajrAngle}°`,
    isha_regel: 'Maghrib + 90 Min (15.Mai–8.Aug: +100 Min)',
    tage: data
  });
};
