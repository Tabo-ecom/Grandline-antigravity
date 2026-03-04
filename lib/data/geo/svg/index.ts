import { DepartmentPath } from './colombia';
export type { DepartmentPath };

import { COLOMBIA_PATHS, COLOMBIA_VIEWBOX } from './colombia';
import { ECUADOR_PATHS, ECUADOR_VIEWBOX } from './ecuador';
import { PANAMA_PATHS, PANAMA_VIEWBOX } from './panama';
import { GUATEMALA_PATHS, GUATEMALA_VIEWBOX } from './guatemala';
import { MEXICO_PATHS, MEXICO_VIEWBOX } from './mexico';
import { PERU_PATHS, PERU_VIEWBOX } from './peru';
import { CHILE_PATHS, CHILE_VIEWBOX } from './chile';
import { PARAGUAY_PATHS, PARAGUAY_VIEWBOX } from './paraguay';
import { ARGENTINA_PATHS, ARGENTINA_VIEWBOX } from './argentina';
import { SPAIN_PATHS, SPAIN_VIEWBOX } from './spain';
import { COSTARICA_PATHS, COSTARICA_VIEWBOX } from './costarica';

export const MAP_DATA: Record<string, { paths: DepartmentPath[]; viewBox: string }> = {
    CO: { paths: COLOMBIA_PATHS, viewBox: COLOMBIA_VIEWBOX },
    EC: { paths: ECUADOR_PATHS, viewBox: ECUADOR_VIEWBOX },
    PA: { paths: PANAMA_PATHS, viewBox: PANAMA_VIEWBOX },
    GT: { paths: GUATEMALA_PATHS, viewBox: GUATEMALA_VIEWBOX },
    MX: { paths: MEXICO_PATHS, viewBox: MEXICO_VIEWBOX },
    PE: { paths: PERU_PATHS, viewBox: PERU_VIEWBOX },
    CL: { paths: CHILE_PATHS, viewBox: CHILE_VIEWBOX },
    PY: { paths: PARAGUAY_PATHS, viewBox: PARAGUAY_VIEWBOX },
    AR: { paths: ARGENTINA_PATHS, viewBox: ARGENTINA_VIEWBOX },
    ES: { paths: SPAIN_PATHS, viewBox: SPAIN_VIEWBOX },
    CR: { paths: COSTARICA_PATHS, viewBox: COSTARICA_VIEWBOX },
};
