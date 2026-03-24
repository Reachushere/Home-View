const APP_URL = "https://home-view--bkh416.replit.app";

async function checkEntity(entityId) {
  const resp = await fetch(`${APP_URL}/api/ha-entity-state?entity=${encodeURIComponent(entityId)}&auth=5747`);
  if (resp.ok) {
    const data = await resp.json();
    console.log(`${entityId}: ${JSON.stringify(data)}`);
    return data;
  }
  const text = await resp.text().catch(() => '');
  console.log(`${entityId}: ERROR ${resp.status} ${text.substring(0, 100)}`);
  return null;
}

async function main() {
  console.log("=== Tablet Media Player States ===");
  const tabletEntities = [
    "media_player.tablet_hallway_entrance",
    "media_player.tablet_hallway",
    "media_player.tablet_11",
    "media_player.bd24bb29_04a116d8_king",
    "media_player.tablet_queen",
    "media_player.tablet_kitchen_island",
    "media_player.tablet_cat",
  ];
  for (const entity of tabletEntities) {
    await checkEntity(entity);
  }
}

main().catch(e => console.error(e.message));
