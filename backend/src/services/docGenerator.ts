import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

const TEMPLATES_DIR = path.join(__dirname, '../templates');

interface GeneratedDoc {
  buffer: Buffer;
  filename: string;
}

export async function generateQuote(opportunity: Record<string, unknown>): Promise<GeneratedDoc> {
  const templatePath = path.join(TEMPLATES_DIR, 'devis_duerp.docx');
  const content = fs.readFileSync(templatePath, 'binary');
  const zip = new PizZip(content);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  doc.render({
    numeroDevis: opportunity.numeroDevis ?? '',
    dateDevis: opportunity.dateDevis ?? new Date().toLocaleDateString('fr-FR'),
    nomClient: (opportunity.company as Record<string, unknown>)?.name ?? '',
    montant: opportunity.amount ?? 0,
  });

  const buffer = doc.getZip().generate({ type: 'nodebuffer' });
  const filename = `devis_${opportunity.numeroDevis ?? Date.now()}.docx`;

  return { buffer, filename };
}
