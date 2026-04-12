const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://dashboard:W3belong%404201@localhost:5432/dashboard_db';
const pool = new Pool({ connectionString: DATABASE_URL });
const CHUNK_SIZE = 2000;

async function main() {
  const { rows: files } = await pool.query(
    `SELECT id, original_name, object_path, folder FROM files 
     WHERE (extracted_text IS NULL OR LENGTH(extracted_text) = 0) 
     AND (folder LIKE '%module%' OR folder LIKE '%reading%')
     ORDER BY id`
  );
  
  console.log(`Found ${files.length} files missing extracted text`);
  
  const { PDFParse } = await import('pdf-parse');
  
  let success = 0, failed = 0;
  
  for (const file of files) {
    try {
      let filePath = null;
      
      if (file.object_path && file.object_path.startsWith('/local/uploads/')) {
        const fileName = file.object_path.replace('/local/uploads/', '');
        filePath = path.join(process.cwd(), 'persistent-uploads', fileName);
      } else if (file.object_path && file.object_path.startsWith('/local-uploads/')) {
        const fileName = file.object_path.replace('/local-uploads/', '');
        filePath = path.join(process.cwd(), 'local-uploads', fileName);
      }
      
      if (!filePath || !fs.existsSync(filePath)) {
        console.log(`SKIP ${file.id} | ${file.original_name} | file not found: ${filePath || file.object_path}`);
        failed++;
        continue;
      }
      
      const buf = fs.readFileSync(filePath);
      const parser = new PDFParse({ data: new Uint8Array(buf), verbosity: 0 });
      await parser.load();
      const pdfText = await parser.getText();
      
      let textContent = '';
      if (pdfText && typeof pdfText === 'object') {
        if (pdfText.pages && Array.isArray(pdfText.pages)) {
          textContent = pdfText.pages.map(p => p.text || '').join('\n\n');
        } else if (pdfText.text) {
          textContent = pdfText.text;
        }
      } else if (typeof pdfText === 'string') {
        textContent = pdfText;
      }
      
      const cleaned = textContent.trim();
      
      if (!cleaned || cleaned.length < 5) {
        console.log(`EMPTY ${file.id} | ${file.original_name} | extracted ${cleaned.length} chars`);
        failed++;
        continue;
      }
      
      const totalChunks = Math.ceil(cleaned.length / CHUNK_SIZE);
      
      await pool.query(
        `UPDATE files SET extracted_text = $1, total_chunks = $2 WHERE id = $3`,
        [cleaned, totalChunks, file.id]
      );
      
      console.log(`OK ${file.id} | ${file.original_name} | ${cleaned.length} chars | ${totalChunks} chunks`);
      success++;
    } catch (err) {
      console.log(`ERROR ${file.id} | ${file.original_name} | ${err.message}`);
      failed++;
    }
  }
  
  console.log(`\nDone: ${success} extracted, ${failed} failed/skipped out of ${files.length}`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
