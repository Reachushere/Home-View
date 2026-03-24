const APP_URL = "https://home-view--bkh416.replit.app";

async function checkEntity(entityId) {
  const resp = await fetch(`${APP_URL}/api/ha-entity-state?entity=${encodeURIComponent(entityId)}`);
  if (resp.ok) {
    const data = await resp.json();
    console.log(`${entityId}: ${data.state}`);
    return data;
  }
  console.log(`${entityId}: ERROR ${resp.status}`);
  return null;
}

async function main() {
  const tabletEntities = [
    "media_player.tablet_hallway_entrance",
    "media_player.tablet_hallway",
    "media_player.tablet_11",
    "media_player.bd24bb29_04a116d8_king",
    "media_player.tablet_queen",
    "media_player.tablet_kitchen_island",
    "media_player.tablet_cat",
  ];

  console.log("=== Tablet States ===");
  for (const entity of tabletEntities) {
    await checkEntity(entity);
  }

  // Also check Fully Kiosk browser entities
  const fullyEntities = [
    "sensor.tablet_hallway_entrance_browser",
    "sensor.tablet_hallway_browser",
    "sensor.fire_tablet_11_browser",
    "sensor.tablet_king_browser",
    "sensor.tablet_queen_browser",
    "sensor.tablet_kitchen_island_browser",
    "sensor.tablet_cat_browser",
    "switch.tablet_hallway_entrance_screensaver",
    "switch.tablet_hallway_screensaver",
  ];
  
  console.log("\n=== Fully Kiosk Entities ===");
  for (const entity of fullyEntities) {
    await checkEntity(entity);
  }
}

main().catch(e => console.error(e.message));
