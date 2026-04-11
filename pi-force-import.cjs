const REPLIT_URL = 'https://a0c66905-cda9-4d99-8753-e071287d758d-00-2dwx3zdd04dyo.picard.replit.dev';
const PI_URL = 'http://localhost:5000';

async function main() {
  console.log('=== Pi Force Import ===');
  console.log(`Source: ${REPLIT_URL}`);
  console.log(`Target: ${PI_URL}`);
  console.log('');

  // --- TASKS ---
  console.log('[1/4] Fetching tasks from Replit...');
  let replitTasks;
  try {
    const res = await fetch(`${REPLIT_URL}/api/tasks`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    replitTasks = await res.json();
    console.log(`  Got ${replitTasks.length} tasks from Replit`);
  } catch (e) {
    console.error(`  FAILED to fetch tasks from Replit: ${e.message}`);
    console.error('  Make sure the Replit app is running!');
    process.exit(1);
  }

  console.log('[2/4] Checking existing Pi tasks...');
  let piTasks;
  try {
    const res = await fetch(`${PI_URL}/api/tasks`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    piTasks = await res.json();
    console.log(`  Pi currently has ${piTasks.length} tasks`);
  } catch (e) {
    console.error(`  FAILED to reach Pi API: ${e.message}`);
    console.error('  Make sure the Pi app is running on port 5000!');
    process.exit(1);
  }

  const strip = s => (s || '').replace(/\[.*?\]\s*/g, '').trim().toLowerCase();
  const piTaskKeys = new Set();
  for (const t of piTasks) {
    const title = strip(t.title);
    const rawTitle = (t.title || '').toLowerCase();
    const dateKey = t.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : '';
    piTaskKeys.add(`${title}||${dateKey}`);
    piTaskKeys.add(`${rawTitle}||${dateKey}`);
  }

  let taskCreated = 0, taskSkipped = 0, taskFailed = 0;
  for (let i = 0; i < replitTasks.length; i++) {
    const t = replitTasks[i];
    const title = strip(t.title);
    const rawTitle = (t.title || '').toLowerCase();
    const dateKey = t.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : '';

    if (piTaskKeys.has(`${title}||${dateKey}`) || piTaskKeys.has(`${rawTitle}||${dateKey}`)) {
      taskSkipped++;
      continue;
    }

    const { id, isMissed, subtaskCount, completedSubtaskCount, calendarEventId, calendarProvider, prepCalendarEventId, secondaryCalendarEventId, secondAccountCalendarEventId, secondAccountPrepEventId, ...taskData } = t;

    try {
      const res = await fetch(`${PI_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body}`);
      }
      taskCreated++;
      piTaskKeys.add(`${title}||${dateKey}`);
      process.stdout.write(`\r  Creating tasks... ${taskCreated} created, ${taskSkipped} skipped, ${taskFailed} failed (${i + 1}/${replitTasks.length})`);
    } catch (e) {
      taskFailed++;
      console.error(`\n  FAILED: "${t.title}" - ${e.message}`);
    }
  }
  console.log(`\n  Tasks done: ${taskCreated} created, ${taskSkipped} already existed, ${taskFailed} failed`);

  // --- SHIFTS ---
  console.log('\n[3/4] Fetching shifts from Replit...');
  let replitShifts;
  try {
    const res = await fetch(`${REPLIT_URL}/api/shift-schedule`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    replitShifts = await res.json();
    console.log(`  Got ${replitShifts.length} shifts from Replit`);
  } catch (e) {
    console.error(`  FAILED to fetch shifts: ${e.message}`);
    replitShifts = [];
  }

  if (replitShifts.length > 0) {
    let piShifts;
    try {
      const res = await fetch(`${PI_URL}/api/shift-schedule`);
      piShifts = await res.json();
    } catch (e) {
      piShifts = [];
    }
    const piShiftDates = new Set(piShifts.map(s => s.date));
    const newShifts = replitShifts.filter(s => !piShiftDates.has(s.date));

    if (newShifts.length > 0) {
      let shiftCreated = 0, shiftFailed = 0;
      for (let i = 0; i < newShifts.length; i++) {
        const s = newShifts[i];
        try {
          const res = await fetch(`${PI_URL}/api/shift-schedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: s.date, shiftType: s.shiftType }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          shiftCreated++;
          process.stdout.write(`\r  Creating shifts... ${shiftCreated}/${newShifts.length}`);
        } catch (e) {
          shiftFailed++;
          console.error(`\n  FAILED shift ${s.date}: ${e.message}`);
        }
      }
      console.log(`\n  Shifts done: ${shiftCreated} created, ${replitShifts.length - newShifts.length} already existed, ${shiftFailed} failed`);
    } else {
      console.log(`  All ${replitShifts.length} shifts already exist on Pi`);
    }
  }

  // --- VERIFY ---
  console.log('\n[4/4] Verifying...');
  try {
    const tasksRes = await fetch(`${PI_URL}/api/tasks`);
    const finalTasks = await tasksRes.json();
    const shiftsRes = await fetch(`${PI_URL}/api/shift-schedule`);
    const finalShifts = await shiftsRes.json();
    console.log(`  Pi now has: ${finalTasks.length} tasks, ${finalShifts.length} shifts`);
    console.log(`  Replit has:  ${replitTasks.length} tasks, ${replitShifts.length} shifts`);
    if (finalTasks.length >= replitTasks.length && finalShifts.length >= replitShifts.length) {
      console.log('\n  ✅ SUCCESS - All data transferred!');
    } else {
      console.log('\n  ⚠️  Counts don\'t match - check for errors above');
    }
  } catch (e) {
    console.error(`  Verification failed: ${e.message}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
