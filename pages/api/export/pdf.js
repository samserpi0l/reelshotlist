// pages/api/export/pdf.js
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb'
    }
  }
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const {
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  } = process.env;

  if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ ok: false, error: 'Missing Supabase env vars' });
  }

  const { user_id, lang = 'de', title, context, shots } = req.body || {};
  if (!Array.isArray(shots) || shots.length === 0) {
    return res.status(400).json({ ok: false, error: 'No shots to export' });
  }
  if (!user_id) {
    return res.status(400).json({ ok: false, error: 'Missing user_id' });
  }

  // Premium-Gate (wie bei /api/inspire)
  const admin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: prof, error: profErr } = await admin
    .from('profiles')
    .select('premium')
    .eq('id', user_id)
    .single();

  if (profErr) {
    return res.status(500).json({ ok: false, error: 'Profile check failed', details: profErr.message || profErr });
  }
  if (!prof?.premium) {
    return res.status(402).json({ ok: false, error: 'Premium required' });
  }

  try {
    // PDF anlegen
    const pdfDoc = await PDFDocument.create();

    // Logo laden (optional)
    let logoImage = null;
    try {
      const logoPath = path.join(process.cwd(), 'public', 'logo.png');
      if (fs.existsSync(logoPath)) {
        const imgBytes = fs.readFileSync(logoPath);
        logoImage = await pdfDoc.embedPng(imgBytes);
      }
    } catch {
      // kein Logo gefunden – kein Problem
    }

    const pageMargin = 48;
    const pageWidth = 595.28;   // A4 width (pt)
    const pageHeight = 841.89;  // A4 height (pt)

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const addPage = () => pdfDoc.addPage([pageWidth, pageHeight]);

    let page = addPage();
    let y = pageHeight - pageMargin;

    // Header
    if (logoImage) {
      const logoW = 120;
      const aspect = logoImage.height / logoImage.width;
      const logoH = logoW * aspect;
      page.drawImage(logoImage, { x: pageMargin, y: y - logoH, width: logoW, height: logoH });
      y -= logoH + 12;
    }

    const titleText = (title && String(title)) || (lang === 'en' ? 'Inspiration Shotlist' : 'Inspiration-Shotlist');
    page.drawText(titleText, {
      x: pageMargin,
      y: y,
      size: 20,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1)
    });
    y -= 28;

    if (context) {
      const contextText = String(context);
      const wrapped = wrapText(contextText, 80);
      wrapped.forEach(line => {
        page.drawText(line, { x: pageMargin, y, size: 10, font: fontRegular, color: rgb(0.25, 0.25, 0.25) });
        y -= 14;
      });
      y -= 8;
    }

    // Tabelle: Header
    const headers = [
      '#',
      lang === 'en' ? 'Shot' : 'Szene',
      lang === 'en' ? 'Cam' : 'Kamera',
      lang === 'en' ? 'Dur' : 'Dauer',
      'Licht',
      lang === 'en' ? 'Mood' : 'Stimmung',
      'ISO',
      lang === 'en' ? 'Aperture' : 'Blende',
      'WB',
      lang === 'en' ? 'Move' : 'Bewegung',
    ];

    const colX = [pageMargin, 70, 180, 240, 285, 340, 395, 430, 470, 505]; // grobe Spalten
    const rowHeight = 14;

    const drawHeader = () => {
      headers.forEach((h, i) => {
        page.drawText(h, { x: colX[i], y, size: 9, font: fontBold, color: rgb(0.1,0.1,0.1) });
      });
      y -= rowHeight;
      page.drawLine({ start: { x: pageMargin, y }, end: { x: pageWidth - pageMargin, y }, thickness: 0.5, color: rgb(0.8,0.8,0.8) });
      y -= 8;
    };

    drawHeader();

    const writeRow = (s) => {
      const cameraStr = `${s?.camera?.type ?? ''}, ${s?.camera?.focal_mm ?? ''}mm`;
      const durStr = `${s?.duration_sec ?? ''}s`;

      // Zeilenumbruch/Seitenumbruch
      if (y < pageMargin + 60) {
        page = addPage();
        y = pageHeight - pageMargin;
        drawHeader();
      }

      // Erste Spalte: #
      page.drawText(String(s.id ?? ''), { x: colX[0], y, size: 9, font: fontRegular });

      // Szene + Beschreibung (2. Spalte, ggf. zweizeilig)
      const name = String(s.name ?? '');
      const desc = String(s.description ?? '');
      const nameLines = wrapText(name, 20);
      const descLines = wrapText(desc, 40);
      const line1 = nameLines[0] || '';
      const line2 = descLines[0] ? ` (${descLines[0]})` : '';

      page.drawText(line1 + line2, { x: colX[1], y, size: 9, font: fontRegular });

      page.drawText(cameraStr, { x: colX[2], y, size: 9, font: fontRegular });
      page.drawText(durStr, { x: colX[3], y, size: 9, font: fontRegular });
      page.drawText(String(s.light ?? ''), { x: colX[4], y, size: 9, font: fontRegular });
      page.drawText(String(s.mood ?? ''), { x: colX[5], y, size: 9, font: fontRegular });
      page.drawText(String(s?.settings?.iso ?? ''), { x: colX[6], y, size: 9, font: fontRegular });
      page.drawText(String(s?.settings?.aperture ?? ''), { x: colX[7], y, size: 9, font: fontRegular });
      page.drawText(String(s?.settings?.wb ?? ''), { x: colX[8], y, size: 9, font: fontRegular });
      page.drawText(String(s?.camera?.movement ?? ''), { x: colX[9], y, size: 9, font: fontRegular });

      y -= rowHeight;
    };

    shots.forEach(writeRow);

    const pdfBytes = await pdfDoc.save();

    const fileName =
      (lang === 'en' ? 'shotlist' : 'shotlist') +
      '-' + new Date().toISOString().slice(0,10) + '.pdf';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.status(200).send(Buffer.from(pdfBytes));
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'PDF build failed', details: e?.message || 'unknown' });
  }
}

// kleine helper zum Zeilenumbruch
function wrapText(text, maxCharsPerLine = 80) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxCharsPerLine) {
      if (line) lines.push(line.trim());
      line = w;
    } else {
      line += (line ? ' ' : '') + w;
    }
  }
  if (line) lines.push(line.trim());
  return lines.slice(0, 3); // wir beschränken auf 3 Zeilen
}
