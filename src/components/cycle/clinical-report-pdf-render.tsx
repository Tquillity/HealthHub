/**
 * Entry point of the clinical summary PDF, loaded with a dynamic import only when the
 * user exports, so @react-pdf/renderer is not part of the cycle page bundle. The PDF is
 * built in the browser from the report the server action returned and handed straight
 * to the download; it is never uploaded or stored.
 */

import type { ReactElement } from 'react';
import { pdf, type DocumentProps } from '@react-pdf/renderer';
import type { ClinicalReport } from '@/lib/clinical-report';
import { ClinicalReportDocument } from './clinical-report-pdf';

/** The document element, typed the way react-pdf's render functions expect it. */
export function clinicalReportDocument(
  report: ClinicalReport
): ReactElement<DocumentProps> {
  return <ClinicalReportDocument report={report} />;
}

/** Draws the report as a PDF Blob in the browser. */
export async function renderClinicalReportPdf(
  report: ClinicalReport
): Promise<Blob> {
  return pdf(clinicalReportDocument(report)).toBlob();
}
