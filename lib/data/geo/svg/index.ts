import { DepartmentPath } from './colombia';
export type { DepartmentPath };

import { COLOMBIA_PATHS, COLOMBIA_VIEWBOX } from './colombia';
import { ECUADOR_PATHS, ECUADOR_VIEWBOX } from './ecuador';
import { PANAMA_PATHS, PANAMA_VIEWBOX } from './panama';
import { GUATEMALA_PATHS, GUATEMALA_VIEWBOX } from './guatemala';

export const MAP_DATA: Record<string, { paths: DepartmentPath[]; viewBox: string }> = {
    CO: { paths: COLOMBIA_PATHS, viewBox: COLOMBIA_VIEWBOX },
    EC: { paths: ECUADOR_PATHS, viewBox: ECUADOR_VIEWBOX },
    PA: { paths: PANAMA_PATHS, viewBox: PANAMA_VIEWBOX },
    GT: { paths: GUATEMALA_PATHS, viewBox: GUATEMALA_VIEWBOX },
};
