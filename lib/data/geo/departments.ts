export interface DepartmentInfo {
    code: string;
    name: string;
    cities: string[];
}

// Normalize string for comparison: lowercase, strip accents
function normalize(s: string): string {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// Colombia — 32 departments + Bogotá DC
const CO_DEPARTMENTS: DepartmentInfo[] = [
    { code: 'BOG', name: 'Bogotá D.C.', cities: ['bogota', 'bogotá'] },
    { code: 'CUN', name: 'Cundinamarca', cities: ['soacha', 'chia', 'chía', 'zipaquira', 'zipaquirá', 'fusagasuga', 'fusagasugá', 'facatativa', 'facatativá', 'madrid', 'mosquera', 'funza', 'cajica', 'cajicá', 'cota', 'la calera', 'tabio', 'tenjo', 'tocancipa', 'tocancipá', 'sopó', 'sopo', 'sibate', 'sibaté', 'bojaca', 'bojacá', 'girardot', 'villeta', 'guaduas', 'la mesa', 'arbelaez', 'caqueza'] },
    { code: 'ANT', name: 'Antioquia', cities: ['medellin', 'medellín', 'envigado', 'itagui', 'itagüí', 'bello', 'rionegro', 'sabaneta', 'la estrella', 'copacabana', 'caldas', 'barbosa', 'girardota', 'marinilla', 'apartado', 'apartadó', 'turbo', 'caucasia'] },
    { code: 'VAL', name: 'Valle del Cauca', cities: ['cali', 'palmira', 'buenaventura', 'tulua', 'tuluá', 'cartago', 'buga', 'yumbo', 'jamundi', 'jamundí', 'candelaria', 'pradera', 'florida', 'dagua', 'sevilla'] },
    { code: 'ATL', name: 'Atlántico', cities: ['barranquilla', 'soledad', 'malambo', 'sabanalarga', 'galapa', 'puerto colombia', 'baranoa'] },
    { code: 'SAN', name: 'Santander', cities: ['bucaramanga', 'floridablanca', 'giron', 'girón', 'piedecuesta', 'barrancabermeja', 'san gil'] },
    { code: 'BOL', name: 'Bolívar', cities: ['cartagena', 'magangue', 'magangué', 'turbaco', 'arjona', 'el carmen de bolivar'] },
    { code: 'NAR', name: 'Nariño', cities: ['pasto', 'tumaco', 'ipiales', 'tuquerres', 'túquerres', 'la union'] },
    { code: 'NDS', name: 'Norte de Santander', cities: ['cucuta', 'cúcuta', 'ocaña', 'pamplona', 'los patios', 'villa del rosario'] },
    { code: 'TOL', name: 'Tolima', cities: ['ibague', 'ibagué', 'espinal', 'melgar', 'honda', 'mariquita', 'chaparral'] },
    { code: 'CAU', name: 'Cauca', cities: ['popayan', 'popayán', 'santander de quilichao', 'puerto tejada', 'piendamo'] },
    { code: 'RIS', name: 'Risaralda', cities: ['pereira', 'dosquebradas', 'santa rosa de cabal', 'la virginia'] },
    { code: 'MAG', name: 'Magdalena', cities: ['santa marta', 'cienaga', 'ciénaga', 'fundacion', 'fundación', 'el banco'] },
    { code: 'COR', name: 'Córdoba', cities: ['monteria', 'montería', 'lorica', 'cerete', 'cereté', 'sahagun', 'sahagún', 'planeta rica'] },
    { code: 'MET', name: 'Meta', cities: ['villavicencio', 'acacias', 'acacías', 'granada', 'puerto lopez', 'puerto lópez'] },
    { code: 'CES', name: 'Cesar', cities: ['valledupar', 'aguachica', 'codazzi', 'la jagua de ibirico', 'bosconia'] },
    { code: 'HUI', name: 'Huila', cities: ['neiva', 'pitalito', 'garzon', 'garzón', 'la plata'] },
    { code: 'CAL', name: 'Caldas', cities: ['manizales', 'la dorada', 'chinchina', 'chinchiná', 'villamaria', 'villamaría'] },
    { code: 'QUI', name: 'Quindío', cities: ['armenia', 'calarca', 'calarcá', 'la tebaida', 'montenegro', 'circasia'] },
    { code: 'SUC', name: 'Sucre', cities: ['sincelejo', 'corozal', 'san marcos', 'since', 'sincé', 'tolu', 'tolú'] },
    { code: 'BOY', name: 'Boyacá', cities: ['tunja', 'duitama', 'sogamoso', 'chiquinquira', 'chiquinquirá', 'paipa'] },
    { code: 'CAS', name: 'Casanare', cities: ['yopal', 'aguazul', 'villanueva', 'tauramena', 'monterrey'] },
    { code: 'LAG', name: 'La Guajira', cities: ['riohacha', 'maicao', 'uribia', 'fonseca', 'san juan del cesar'] },
    { code: 'PUT', name: 'Putumayo', cities: ['mocoa', 'puerto asis', 'puerto asís', 'orito', 'la hormiga'] },
    { code: 'ARA', name: 'Arauca', cities: ['arauca', 'saravena', 'tame', 'fortul'] },
    { code: 'CHO', name: 'Chocó', cities: ['quibdo', 'quibdó', 'istmina', 'istmina', 'condoto', 'tado', 'tadó'] },
    { code: 'CAQ', name: 'Caquetá', cities: ['florencia', 'san vicente del caguan', 'san vicente del caguán'] },
    { code: 'GUA', name: 'Guaviare', cities: ['san jose del guaviare', 'san josé del guaviare'] },
    { code: 'AMA', name: 'Amazonas', cities: ['leticia', 'puerto nariño'] },
    { code: 'VIC', name: 'Vichada', cities: ['puerto carreño', 'puerto carreno'] },
    { code: 'VAU', name: 'Vaupés', cities: ['mitu', 'mitú'] },
    { code: 'GUI', name: 'Guainía', cities: ['inirida', 'inírida'] },
    { code: 'SAP', name: 'San Andrés', cities: ['san andres', 'san andrés', 'providencia'] },
];

// Ecuador — 24 provinces
const EC_DEPARTMENTS: DepartmentInfo[] = [
    { code: 'PIC', name: 'Pichincha', cities: ['quito', 'cayambe', 'sangolqui', 'sangolquí', 'machachi', 'conocoto', 'tumbaco', 'cumbaya', 'cumbayá'] },
    { code: 'GUA', name: 'Guayas', cities: ['guayaquil', 'duran', 'durán', 'milagro', 'daule', 'samborondon', 'samborondón', 'naranjal', 'playas'] },
    { code: 'AZU', name: 'Azuay', cities: ['cuenca', 'gualaceo', 'paute', 'sigsig'] },
    { code: 'TUN', name: 'Tungurahua', cities: ['ambato', 'banos', 'baños', 'pelileo', 'pillaro', 'píllaro'] },
    { code: 'MAN', name: 'Manabí', cities: ['portoviejo', 'manta', 'chone', 'jipijapa', 'el carmen', 'montecristi', 'bahia de caraquez'] },
    { code: 'EOR', name: 'El Oro', cities: ['machala', 'pasaje', 'huaquillas', 'santa rosa', 'arenillas'] },
    { code: 'LOJ', name: 'Loja', cities: ['loja', 'catamayo', 'cariamanga'] },
    { code: 'ESM', name: 'Esmeraldas', cities: ['esmeraldas', 'atacames', 'quininde', 'quinindé', 'san lorenzo'] },
    { code: 'IMB', name: 'Imbabura', cities: ['ibarra', 'otavalo', 'cotacachi', 'atuntaqui'] },
    { code: 'SDD', name: 'Santo Domingo', cities: ['santo domingo', 'santo domingo de los tsachilas'] },
    { code: 'LRI', name: 'Los Ríos', cities: ['babahoyo', 'quevedo', 'vinces', 'ventanas', 'buena fe'] },
    { code: 'COT', name: 'Cotopaxi', cities: ['latacunga', 'salcedo', 'la mana', 'la maná', 'pujili', 'pujilí'] },
    { code: 'CHI', name: 'Chimborazo', cities: ['riobamba', 'guano', 'alausi', 'alausí'] },
    { code: 'CAN', name: 'Cañar', cities: ['azogues', 'la troncal', 'cañar'] },
    { code: 'BOL', name: 'Bolívar', cities: ['guaranda', 'san miguel', 'chillanes'] },
    { code: 'CAR', name: 'Carchi', cities: ['tulcan', 'tulcán', 'san gabriel'] },
    { code: 'STA', name: 'Santa Elena', cities: ['santa elena', 'salinas', 'la libertad'] },
    { code: 'SUC', name: 'Sucumbíos', cities: ['lago agrio', 'nueva loja', 'shushufindi'] },
    { code: 'ORE', name: 'Orellana', cities: ['coca', 'francisco de orellana', 'joya de los sachas'] },
    { code: 'NAP', name: 'Napo', cities: ['tena', 'archidona'] },
    { code: 'PAS', name: 'Pastaza', cities: ['puyo', 'shell', 'mera'] },
    { code: 'MOR', name: 'Morona Santiago', cities: ['macas', 'gualaquiza', 'sucua'] },
    { code: 'ZAM', name: 'Zamora Chinchipe', cities: ['zamora', 'yantzaza'] },
    { code: 'GAL', name: 'Galápagos', cities: ['puerto ayora', 'puerto baquerizo moreno'] },
];

// Panamá — 10 provinces + 3 comarcas
const PA_DEPARTMENTS: DepartmentInfo[] = [
    { code: 'PAN', name: 'Panamá', cities: ['panama', 'panamá', 'ciudad de panama', 'ciudad de panamá', 'san miguelito', 'tocumen', 'juan diaz', 'juan díaz', 'pedregal', 'las cumbres'] },
    { code: 'POE', name: 'Panamá Oeste', cities: ['arraijan', 'arraiján', 'chorrera', 'la chorrera', 'capira', 'chame', 'san carlos'] },
    { code: 'COL', name: 'Colón', cities: ['colon', 'colón', 'portobelo', 'sabanitas'] },
    { code: 'CHI', name: 'Chiriquí', cities: ['david', 'bugaba', 'boquete', 'puerto armuelles', 'dolega', 'baru', 'barú', 'volcan', 'volcán'] },
    { code: 'COC', name: 'Coclé', cities: ['penonome', 'penonomé', 'aguadulce', 'nata', 'natá', 'anton', 'antón'] },
    { code: 'VER', name: 'Veraguas', cities: ['santiago', 'sona', 'soná', 'atalaya', 'las palmas'] },
    { code: 'HER', name: 'Herrera', cities: ['chitre', 'chitré', 'ocu', 'ocú', 'los pozos', 'pese', 'pesé'] },
    { code: 'LOS', name: 'Los Santos', cities: ['las tablas', 'guarare', 'guaraé', 'pedasi', 'pedasí', 'tonosi', 'tonosí'] },
    { code: 'BOC', name: 'Bocas del Toro', cities: ['bocas del toro', 'changuinola', 'almirante'] },
    { code: 'DAR', name: 'Darién', cities: ['la palma', 'meteti', 'metetí', 'yaviza'] },
];

// Guatemala — 22 departments
const GT_DEPARTMENTS: DepartmentInfo[] = [
    { code: 'GUA', name: 'Guatemala', cities: ['guatemala', 'mixco', 'villa nueva', 'villanueva', 'petapa', 'chinautla', 'amatitlan', 'amatitlán', 'villa canales', 'santa catarina pinula', 'san jose pinula', 'san josé pinula', 'fraijanes', 'san pedro sacatepequez', 'san pedro sacatepéquez', 'palencia'] },
    { code: 'SAC', name: 'Sacatepéquez', cities: ['antigua', 'antigua guatemala', 'ciudad vieja', 'jocotenango', 'sumpango'] },
    { code: 'ESC', name: 'Escuintla', cities: ['escuintla', 'santa lucia cotzumalguapa', 'santa lucía cotzumalguapa', 'puerto san jose', 'puerto san josé', 'tiquisate', 'la gomera'] },
    { code: 'CHI', name: 'Chimaltenango', cities: ['chimaltenango', 'comalapa', 'patzun', 'patzún', 'tecpan', 'tecpán', 'zaragoza'] },
    { code: 'QUE', name: 'Quetzaltenango', cities: ['quetzaltenango', 'xela', 'coatepeque', 'salcaja', 'salcajá', 'almolonga', 'zunil', 'cantel'] },
    { code: 'HUE', name: 'Huehuetenango', cities: ['huehuetenango', 'la democracia', 'chiantla', 'jacaltenango'] },
    { code: 'SMA', name: 'San Marcos', cities: ['san marcos', 'malacatan', 'malacatán', 'pajapita', 'ayutla', 'tecun uman', 'tecún umán'] },
    { code: 'ALV', name: 'Alta Verapaz', cities: ['alta verapaz', 'coban', 'cobán', 'san pedro carcha', 'san pedro carchá', 'tactic', 'chamelco'] },
    { code: 'BAV', name: 'Baja Verapaz', cities: ['baja verapaz', 'salama', 'salamá', 'rabinal', 'cubulco', 'san miguel chicaj'] },
    { code: 'QUI', name: 'Quiché', cities: ['quiche', 'quiché', 'santa cruz del quiche', 'santa cruz del quiché', 'chichicastenango', 'nebaj', 'joyabaj'] },
    { code: 'SOL', name: 'Sololá', cities: ['solola', 'sololá', 'panajachel', 'santiago atitlan', 'santiago atitlán'] },
    { code: 'TOT', name: 'Totonicapán', cities: ['totonicapan', 'totonicapán', 'san cristobal totonicapan', 'momostenango'] },
    { code: 'RET', name: 'Retalhuleu', cities: ['retalhuleu', 'champerico', 'san sebastian retalhuleu'] },
    { code: 'SUC', name: 'Suchitepéquez', cities: ['suchitepequez', 'suchitepéquez', 'mazatenango', 'chicacao', 'patulul'] },
    { code: 'PET', name: 'Petén', cities: ['peten', 'petén', 'flores', 'santa elena', 'san benito', 'la libertad'] },
    { code: 'IZA', name: 'Izabal', cities: ['izabal', 'puerto barrios', 'morales', 'los amates', 'livingston'] },
    { code: 'ZAC', name: 'Zacapa', cities: ['zacapa', 'estanzuela', 'rio hondo', 'río hondo', 'teculutan', 'teculutón'] },
    { code: 'CHQ', name: 'Chiquimula', cities: ['chiquimula', 'esquipulas', 'jocotan', 'jocotán'] },
    { code: 'JAL', name: 'Jalapa', cities: ['jalapa', 'san pedro pinula', 'monjas'] },
    { code: 'JUT', name: 'Jutiapa', cities: ['jutiapa', 'asuncion mita', 'asunción mita', 'el progreso'] },
    { code: 'SRO', name: 'Santa Rosa', cities: ['santa rosa', 'cuilapa', 'barberena', 'guazacapan', 'taxisco'] },
    { code: 'PRO', name: 'El Progreso', cities: ['el progreso', 'guastatoya', 'morazan', 'morazán', 'sanarate', 'san agustin acasaguastlan'] },
];

export const DEPARTMENTS: Record<string, DepartmentInfo[]> = {
    CO: CO_DEPARTMENTS,
    EC: EC_DEPARTMENTS,
    PA: PA_DEPARTMENTS,
    GT: GT_DEPARTMENTS,
};

// Map from country URL slug to country code
export function getCountryCode(slug: string): string {
    const lower = normalize(slug);
    if (lower.includes('colombia')) return 'CO';
    if (lower.includes('ecuador')) return 'EC';
    if (lower.includes('panama')) return 'PA';
    if (lower.includes('guatemala')) return 'GT';
    return 'CO';
}

// Find department for a given city
export function cityToDepartment(city: string, countryCode: string): string | null {
    const departments = DEPARTMENTS[countryCode];
    if (!departments) return null;

    const normalizedCity = normalize(city);
    if (!normalizedCity) return null;

    for (const dept of departments) {
        for (const deptCity of dept.cities) {
            if (normalizedCity.includes(normalize(deptCity)) || normalize(deptCity).includes(normalizedCity)) {
                return dept.code;
            }
        }
    }

    return null;
}

// Get department name by code
export function getDepartmentName(code: string, countryCode: string): string {
    const departments = DEPARTMENTS[countryCode];
    if (!departments) return code;
    const dept = departments.find(d => d.code === code);
    return dept?.name || code;
}
