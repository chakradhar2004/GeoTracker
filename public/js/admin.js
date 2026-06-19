document.addEventListener('DOMContentLoaded', () => {
  let map;
  let markersLayer = L.layerGroup();
  let visitsData = [];

  // DOM Elements
  const tableBody = document.getElementById('visits-table-body');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnExport = document.getElementById('btn-export-csv');
  const btnClearDb = document.getElementById('btn-clear-db');

  // Stats Elements
  const statTotal = document.getElementById('stat-total-visits');
  const statPrecision = document.getElementById('stat-precision-visits');
  const statIp = document.getElementById('stat-ip-visits');
  const statOptin = document.getElementById('stat-optin-rate');

  // Initialize Map
  initMap();
  fetchVisits();

  function initMap() {
    // Center at [20, 0] (Global view)
    map = L.map('map', {
      zoomControl: true
    }).setView([20, 0], 2);

    // Using CartoDB Dark Matter tile layer for an elegant premium dark theme feel
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    markersLayer.addTo(map);
  }

  async function fetchVisits() {
    try {
      const res = await fetch('/api/visits');
      if (res.ok) {
        visitsData = await res.json();
        updateDashboard();
      } else {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--danger);">Error loading data from server.</td></tr>`;
      }
    } catch (e) {
      console.error(e);
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--danger);">Network error. Could not connect to API.</td></tr>`;
    }
  }

  function parseUserAgent(ua) {
    if (!ua) return 'Unknown Device / Browser';
    
    let browser = 'Unknown Browser';
    let os = 'Unknown OS';

    // Simple OS detection
    if (ua.indexOf('Windows NT 10.0') !== -1) os = 'Windows 10/11';
    else if (ua.indexOf('Windows NT 6.2') !== -1) os = 'Windows 8';
    else if (ua.indexOf('Windows NT 6.1') !== -1) os = 'Windows 7';
    else if (ua.indexOf('Macintosh') !== -1) os = 'macOS';
    else if (ua.indexOf('iPhone') !== -1) os = 'iPhone';
    else if (ua.indexOf('iPad') !== -1) os = 'iPad';
    else if (ua.indexOf('Android') !== -1) os = 'Android';
    else if (ua.indexOf('Linux') !== -1) os = 'Linux';

    // Simple Browser detection
    if (ua.indexOf('Firefox') !== -1) browser = 'Firefox';
    else if (ua.indexOf('Chrome') !== -1 && ua.indexOf('Safari') !== -1) browser = 'Chrome';
    else if (ua.indexOf('Safari') !== -1 && ua.indexOf('Chrome') === -1) browser = 'Safari';
    else if (ua.indexOf('Edge') !== -1) browser = 'Edge';
    else if (ua.indexOf('Trident') !== -1) browser = 'Internet Explorer';

    return `${os} • ${browser}`;
  }

  function updateDashboard() {
    // 1. Clear Map Markers
    markersLayer.clearLayers();

    if (visitsData.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:3rem; color:var(--text-muted);">No visits captured yet. Open the home page to log your first visit!</td></tr>`;
      statTotal.textContent = '0';
      statPrecision.textContent = '0';
      statIp.textContent = '0';
      statOptin.textContent = '0%';
      return;
    }

    // 2. Compute Statistics
    const total = visitsData.length;
    let precisionCount = 0;
    let ipCount = 0;
    let markerCoordsList = [];

    // 3. Build Table Rows & Map Markers
    let tableHtml = '';

    visitsData.forEach(visit => {
      const isPrecision = visit.browserCoords !== null;
      let lat, lng, typeBadge, accuracyText, mapMarkerColor;

      if (isPrecision) {
        precisionCount++;
        lat = visit.browserCoords.latitude;
        lng = visit.browserCoords.longitude;
        typeBadge = `<span class="badge-precision">Precision GPS</span>`;
        accuracyText = `±${Math.round(visit.browserCoords.accuracy)}m`;
        mapMarkerColor = '#10b981'; // Emerald Green
      } else {
        ipCount++;
        lat = visit.ipInfo?.latitude || null;
        lng = visit.ipInfo?.longitude || null;
        typeBadge = `<span class="badge-ip-type">IP Fallback</span>`;
        accuracyText = 'City Level';
        mapMarkerColor = '#f43f5e'; // Rose Pink
      }

      const timestampFormatted = new Date(visit.timestamp).toLocaleString();
      const locationName = visit.ipInfo 
        ? `${visit.ipInfo.city || 'Unknown City'}, ${visit.ipInfo.country_name || visit.ipInfo.country || 'Unknown Country'}`
        : 'Unknown';
      const coordsText = lat !== null && lng !== null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'Unavailable';
      const deviceText = parseUserAgent(visit.userAgent);
      const mapsUrl = lat !== null && lng !== null
        ? `https://www.google.com/maps?q=${lat},${lng}`
        : null;
      const mapsBtn = mapsUrl
        ? `<a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="btn-maps-link" title="Open in Google Maps">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/></svg>
            Maps
           </a>`
        : '<span style="color:var(--text-muted);font-size:0.8rem;">N/A</span>';

      // Add to table
      tableHtml += `
        <tr>
          <td>${timestampFormatted}</td>
          <td><span class="badge-ip">${visit.ip}</span></td>
          <td>${locationName}</td>
          <td><span class="badge-coords">${coordsText}</span></td>
          <td>${mapsBtn}</td>
          <td>${typeBadge}</td>
          <td><span class="badge-accuracy">${accuracyText}</span></td>
          <td title="${visit.userAgent || ''}">${deviceText}</td>
        </tr>
      `;

      // Plot on map if coordinates exist
      if (lat !== null && lng !== null) {
        markerCoordsList.push([lat, lng]);

        // Custom Leaflet CircleMarker to fit dark premium aesthetics
        const marker = L.circleMarker([lat, lng], {
          radius: 8,
          fillColor: mapMarkerColor,
          color: '#ffffff',
          weight: 1.5,
          opacity: 1,
          fillOpacity: 0.8
        });

        const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
        const popupContent = `
          <div style="font-family: sans-serif; font-size: 0.85rem; padding: 4px; min-width: 200px;">
            <b style="color: ${mapMarkerColor}; font-size: 0.95rem;">${isPrecision ? 'Precision Geolocation' : 'IP Geolocation'}</b><br/>
            <b>IP:</b> ${visit.ip}<br/>
            <b>Location:</b> ${locationName}<br/>
            <b>Coords:</b> ${lat.toFixed(5)}, ${lng.toFixed(5)}<br/>
            <b>Accuracy:</b> ${accuracyText}<br/>
            <b>Time:</b> ${timestampFormatted}<br/><br/>
            <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer"
               style="display:inline-flex;align-items:center;gap:5px;background:#4285F4;color:#fff;padding:5px 10px;border-radius:5px;text-decoration:none;font-weight:600;font-size:0.8rem;">
              <svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='white'><path d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/></svg>
              View on Google Maps
            </a>
          </div>
        `;
        marker.bindPopup(popupContent);
        markersLayer.addLayer(marker);
      }
    });

    tableBody.innerHTML = tableHtml;

    // Update stat boxes
    statTotal.textContent = total;
    statPrecision.textContent = precisionCount;
    statIp.textContent = ipCount;
    statOptin.textContent = total > 0 ? `${Math.round((precisionCount / total) * 100)}%` : '0%';

    // Zoom map to show all markers if any exist
    if (markerCoordsList.length > 0) {
      const bounds = L.latLngBounds(markerCoordsList);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }
  }

  // Event Listeners
  btnRefresh.addEventListener('click', fetchVisits);

  // Clear Database
  btnClearDb.addEventListener('click', async () => {
    if (confirm('Are you absolutely sure you want to clear all visit records? This action cannot be undone.')) {
      try {
        const res = await fetch('/api/visits', {
          method: 'DELETE'
        });
        if (res.ok) {
          alert('Log database cleared successfully.');
          fetchVisits();
        } else {
          alert('Failed to clear log database.');
        }
      } catch (e) {
        console.error(e);
        alert('Network error while trying to clear database.');
      }
    }
  });

  // Export to CSV
  btnExport.addEventListener('click', () => {
    if (visitsData.length === 0) {
      alert('No data available to export.');
      return;
    }

    const headers = ['Timestamp', 'IP Address', 'City', 'Country', 'Latitude', 'Longitude', 'Accuracy (m)', 'Precision GPS?', 'ISP', 'Timezone', 'User Agent'];
    
    const rows = visitsData.map(visit => {
      const isPrecision = visit.browserCoords !== null;
      const lat = isPrecision ? visit.browserCoords.latitude : (visit.ipInfo?.latitude || '');
      const lng = isPrecision ? visit.browserCoords.longitude : (visit.ipInfo?.longitude || '');
      const accuracy = isPrecision ? visit.browserCoords.accuracy : 'City Level';
      
      return [
        visit.timestamp,
        visit.ip,
        visit.ipInfo?.city || '',
        visit.ipInfo?.country_name || '',
        lat,
        lng,
        accuracy,
        isPrecision ? 'YES' : 'NO',
        visit.ipInfo?.org || '',
        visit.ipInfo?.timezone || '',
        `"${(visit.userAgent || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `geotracker_visitor_logs_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
});
