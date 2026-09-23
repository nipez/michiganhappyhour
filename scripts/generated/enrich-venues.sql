UPDATE venues SET hh_start='3:00 PM', hh_end='6:00 PM', hh_days='["Monday","Tuesday","Wednesday","Thursday","Friday"]', deals='["$2 domestic bottles","$1.50 Bud Light & Miller Lite draft"]', website='https://www.dannysferndale.com/', last_verified_at='2026-09-23', vibe='Happy hour details pulled from their website — confirm when you visit', updated_at=datetime('now') WHERE id=1475 AND source='osm';
UPDATE venues SET website='https://www.theoaklandferndale.com/', updated_at=datetime('now') WHERE id=1435 AND source='osm' AND (website IS NULL OR TRIM(website)='');
UPDATE venues SET website='https://www.urbanrest.com/', updated_at=datetime('now') WHERE id=1439 AND source='osm' AND (website IS NULL OR TRIM(website)='');
UPDATE venues SET website='https://www.refinedfool.com/', updated_at=datetime('now') WHERE id=1758 AND source='osm' AND (website IS NULL OR TRIM(website)='');
UPDATE venues SET website='https://www.refinedfool.com/', updated_at=datetime('now') WHERE id=1763 AND source='osm' AND (website IS NULL OR TRIM(website)='');
UPDATE venues SET website='https://www.thetinfiddler.com/', updated_at=datetime('now') WHERE id=1762 AND source='osm' AND (website IS NULL OR TRIM(website)='');
UPDATE venues SET website='https://kermitspub.com/', updated_at=datetime('now') WHERE id=2115 AND source='osm';
