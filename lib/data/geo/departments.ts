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

// México — 32 estados
const MX_DEPARTMENTS: DepartmentInfo[] = [
    { code: 'CDMX', name: 'Ciudad de México', cities: ['ciudad de mexico', 'cdmx', 'mexico df', 'df', 'iztapalapa', 'gustavo a madero', 'alvaro obregon', 'coyoacan', 'tlalpan', 'cuauhtemoc', 'xochimilco'] },
    { code: 'JAL', name: 'Jalisco', cities: ['guadalajara', 'zapopan', 'tlaquepaque', 'tonala', 'tonalá', 'puerto vallarta', 'tlajomulco', 'el salto'] },
    { code: 'NL', name: 'Nuevo León', cities: ['monterrey', 'guadalupe', 'apodaca', 'san nicolas de los garza', 'san nicolás', 'santa catarina', 'general escobedo', 'san pedro garza garcia'] },
    { code: 'MEX', name: 'Estado de México', cities: ['toluca', 'ecatepec', 'naucalpan', 'tlalnepantla', 'nezahualcoyotl', 'nezahualcóyotl', 'chimalhuacan', 'chimalhuacán', 'cuautitlan', 'tultitlan', 'atizapan'] },
    { code: 'PUE', name: 'Puebla', cities: ['puebla', 'tehuacan', 'tehuacán', 'san martin texmelucan', 'atlixco', 'huauchinango'] },
    { code: 'GTO', name: 'Guanajuato', cities: ['leon', 'león', 'irapuato', 'celaya', 'salamanca', 'guanajuato', 'silao'] },
    { code: 'VER', name: 'Veracruz', cities: ['veracruz', 'xalapa', 'coatzacoalcos', 'cordoba', 'córdoba', 'orizaba', 'poza rica', 'boca del rio'] },
    { code: 'QRO', name: 'Querétaro', cities: ['queretaro', 'querétaro', 'san juan del rio', 'san juan del río', 'corregidora'] },
    { code: 'CHIH', name: 'Chihuahua', cities: ['chihuahua', 'ciudad juarez', 'ciudad juárez', 'cuauhtemoc', 'delicias', 'parral'] },
    { code: 'BC', name: 'Baja California', cities: ['tijuana', 'mexicali', 'ensenada', 'rosarito', 'tecate'] },
    { code: 'SON', name: 'Sonora', cities: ['hermosillo', 'ciudad obregon', 'ciudad obregón', 'nogales', 'guaymas', 'navojoa', 'los mochis'] },
    { code: 'SIN', name: 'Sinaloa', cities: ['culiacan', 'culiacán', 'mazatlan', 'mazatlán', 'los mochis', 'guasave'] },
    { code: 'COAH', name: 'Coahuila', cities: ['saltillo', 'torreon', 'torreón', 'monclova', 'piedras negras', 'acuna', 'acuña'] },
    { code: 'TAM', name: 'Tamaulipas', cities: ['tampico', 'reynosa', 'matamoros', 'nuevo laredo', 'ciudad victoria', 'ciudad madero'] },
    { code: 'MICH', name: 'Michoacán', cities: ['morelia', 'uruapan', 'zamora', 'lazaro cardenas', 'lázaro cárdenas', 'apatzingan'] },
    { code: 'OAX', name: 'Oaxaca', cities: ['oaxaca', 'juchitan', 'juchitán', 'salina cruz', 'tuxtepec', 'huatulco'] },
    { code: 'AGS', name: 'Aguascalientes', cities: ['aguascalientes'] },
    { code: 'SLP', name: 'San Luis Potosí', cities: ['san luis potosi', 'san luis potosí', 'soledad de graciano sanchez', 'ciudad valles', 'matehuala'] },
    { code: 'HGO', name: 'Hidalgo', cities: ['pachuca', 'tulancingo', 'tula', 'huejutla'] },
    { code: 'YUC', name: 'Yucatán', cities: ['merida', 'mérida', 'valladolid', 'progreso', 'tizimin'] },
    { code: 'QROO', name: 'Quintana Roo', cities: ['cancun', 'cancún', 'playa del carmen', 'chetumal', 'cozumel', 'tulum'] },
    { code: 'MOR', name: 'Morelos', cities: ['cuernavaca', 'cuautla', 'jiutepec', 'temixco'] },
    { code: 'DGO', name: 'Durango', cities: ['durango', 'gomez palacio', 'gómez palacio', 'lerdo'] },
    { code: 'GRO', name: 'Guerrero', cities: ['acapulco', 'chilpancingo', 'zihuatanejo', 'iguala', 'taxco'] },
    { code: 'ZAC', name: 'Zacatecas', cities: ['zacatecas', 'fresnillo', 'guadalupe'] },
    { code: 'TAB', name: 'Tabasco', cities: ['villahermosa', 'cardenas', 'cárdenas', 'comalcalco', 'paraiso', 'paraíso'] },
    { code: 'NAY', name: 'Nayarit', cities: ['tepic', 'bahia de banderas', 'bahía de banderas', 'compostela'] },
    { code: 'CHIS', name: 'Chiapas', cities: ['tuxtla gutierrez', 'tuxtla gutiérrez', 'tapachula', 'san cristobal de las casas', 'san cristóbal', 'comitan', 'comitán'] },
    { code: 'COL', name: 'Colima', cities: ['colima', 'manzanillo', 'tecoman', 'tecomán', 'villa de alvarez'] },
    { code: 'TLAX', name: 'Tlaxcala', cities: ['tlaxcala', 'apizaco', 'huamantla', 'chiautempan'] },
    { code: 'CAM', name: 'Campeche', cities: ['campeche', 'ciudad del carmen', 'champoton', 'champotón', 'calkini'] },
    { code: 'BCS', name: 'Baja California Sur', cities: ['la paz', 'los cabos', 'cabo san lucas', 'san jose del cabo'] },
];

// Perú — 25 departamentos
const PE_DEPARTMENTS: DepartmentInfo[] = [
    { code: 'LIM', name: 'Lima', cities: ['lima', 'san juan de lurigancho', 'san martin de porres', 'ate', 'comas', 'villa el salvador', 'villa maria del triunfo', 'san juan de miraflores', 'los olivos', 'surco', 'miraflores', 'callao'] },
    { code: 'ARE', name: 'Arequipa', cities: ['arequipa', 'camana', 'camaná', 'mollendo', 'islay'] },
    { code: 'LAL', name: 'La Libertad', cities: ['trujillo', 'chepen', 'chepén', 'pacasmayo', 'viru', 'virú', 'casa grande'] },
    { code: 'LAM', name: 'Lambayeque', cities: ['chiclayo', 'lambayeque', 'ferrenafe', 'ferreñafe'] },
    { code: 'PIU', name: 'Piura', cities: ['piura', 'sullana', 'talara', 'paita', 'catacaos', 'sechura'] },
    { code: 'CUS', name: 'Cusco', cities: ['cusco', 'cuzco', 'sicuani', 'quillabamba', 'espinar'] },
    { code: 'JUN', name: 'Junín', cities: ['huancayo', 'tarma', 'la oroya', 'jauja', 'chanchamayo', 'satipo'] },
    { code: 'CAJ', name: 'Cajamarca', cities: ['cajamarca', 'jaen', 'jaén', 'chota', 'cutervo', 'bambamarca'] },
    { code: 'PUN', name: 'Puno', cities: ['puno', 'juliaca', 'ayaviri', 'ilave', 'azangaro'] },
    { code: 'ANC', name: 'Áncash', cities: ['huaraz', 'chimbote', 'nuevo chimbote', 'casma', 'huarmey'] },
    { code: 'ICA', name: 'Ica', cities: ['ica', 'chincha', 'pisco', 'nazca', 'palpa'] },
    { code: 'LOR', name: 'Loreto', cities: ['iquitos', 'yurimaguas', 'nauta', 'requena'] },
    { code: 'TAC', name: 'Tacna', cities: ['tacna', 'alto de la alianza'] },
    { code: 'HUV', name: 'Huánuco', cities: ['huanuco', 'huánuco', 'tingo maria', 'tingo maría'] },
    { code: 'AYA', name: 'Ayacucho', cities: ['ayacucho', 'huamanga', 'huanta'] },
    { code: 'SAM', name: 'San Martín', cities: ['tarapoto', 'moyobamba', 'rioja', 'juanjui'] },
    { code: 'AMA', name: 'Amazonas', cities: ['chachapoyas', 'bagua', 'utcubamba'] },
    { code: 'APU', name: 'Apurímac', cities: ['abancay', 'andahuaylas'] },
    { code: 'HUC', name: 'Huancavelica', cities: ['huancavelica'] },
    { code: 'MDD', name: 'Madre de Dios', cities: ['puerto maldonado'] },
    { code: 'MOQ', name: 'Moquegua', cities: ['moquegua', 'ilo'] },
    { code: 'PAS', name: 'Pasco', cities: ['cerro de pasco', 'pasco', 'oxapampa'] },
    { code: 'TUM', name: 'Tumbes', cities: ['tumbes', 'zarumilla', 'zorritos'] },
    { code: 'UCA', name: 'Ucayali', cities: ['pucallpa', 'aguaytia'] },
    { code: 'CAL', name: 'Callao', cities: ['callao', 'ventanilla', 'bellavista'] },
];

// Chile — 16 regiones
const CL_DEPARTMENTS: DepartmentInfo[] = [
    { code: 'MET', name: 'Metropolitana', cities: ['santiago', 'puente alto', 'maipu', 'maipú', 'la florida', 'las condes', 'san bernardo', 'penalolen', 'peñalolén', 'pudahuel', 'quilicura', 'lo barnechea'] },
    { code: 'VAL', name: 'Valparaíso', cities: ['valparaiso', 'valparaíso', 'vina del mar', 'viña del mar', 'quilpue', 'quilpué', 'villa alemana', 'san antonio', 'quillota'] },
    { code: 'BIO', name: 'Biobío', cities: ['concepcion', 'concepción', 'talcahuano', 'chiguayante', 'los angeles', 'los ángeles', 'coronel', 'hualpen', 'hualpén'] },
    { code: 'MAU', name: 'Maule', cities: ['talca', 'curico', 'curicó', 'linares', 'cauquenes', 'constitucion', 'constitución'] },
    { code: 'ARA', name: 'Araucanía', cities: ['temuco', 'padre las casas', 'villarrica', 'angol', 'pucon', 'pucón'] },
    { code: 'OHI', name: "O'Higgins", cities: ['rancagua', 'san fernando', 'rengo', 'machali', 'machalí', 'graneros'] },
    { code: 'COQ', name: 'Coquimbo', cities: ['la serena', 'coquimbo', 'ovalle', 'illapel'] },
    { code: 'LLA', name: 'Los Lagos', cities: ['puerto montt', 'osorno', 'castro', 'ancud', 'puerto varas'] },
    { code: 'LRI', name: 'Los Ríos', cities: ['valdivia', 'la union', 'la unión', 'rio bueno', 'río bueno'] },
    { code: 'ANT', name: 'Antofagasta', cities: ['antofagasta', 'calama', 'tocopilla', 'mejillones'] },
    { code: 'ATA', name: 'Atacama', cities: ['copiapo', 'copiapó', 'vallenar', 'caldera'] },
    { code: 'NUB', name: 'Ñuble', cities: ['chillan', 'chillán', 'san carlos', 'bulnes'] },
    { code: 'ARI', name: 'Arica y Parinacota', cities: ['arica', 'putre'] },
    { code: 'TAR', name: 'Tarapacá', cities: ['iquique', 'alto hospicio', 'pozo almonte'] },
    { code: 'AYS', name: 'Aysén', cities: ['coyhaique', 'aysen', 'aysén', 'puerto aysen', 'puerto aysén'] },
    { code: 'MAG', name: 'Magallanes', cities: ['punta arenas', 'puerto natales', 'porvenir'] },
];

// Paraguay — 17 departamentos + Asunción
const PY_DEPARTMENTS: DepartmentInfo[] = [
    { code: 'ASU', name: 'Asunción', cities: ['asuncion', 'asunción'] },
    { code: 'CEN', name: 'Central', cities: ['san lorenzo', 'luque', 'capiata', 'capiatá', 'lambare', 'lambaré', 'fernando de la mora', 'limpio', 'mariano roque alonso', 'nemby', 'ñemby', 'villa elisa', 'san antonio', 'ita', 'itá', 'aregua', 'areguá'] },
    { code: 'ALE', name: 'Alto Paraná', cities: ['ciudad del este', 'presidente franco', 'hernandarias', 'minga guazu', 'minga guazú'] },
    { code: 'ITA', name: 'Itapúa', cities: ['encarnacion', 'encarnación', 'hohenau', 'obligado', 'trinidad'] },
    { code: 'CAA', name: 'Caaguazú', cities: ['caaguazu', 'caaguazú', 'coronel oviedo', 'juan eulogio estigarribia'] },
    { code: 'SPA', name: 'San Pedro', cities: ['san pedro', 'san pedro del ycuamandiyu'] },
    { code: 'COR', name: 'Cordillera', cities: ['caacupe', 'caacupé', 'atyra', 'atyrá', 'tobati', 'tobatí', 'piribebuy'] },
    { code: 'GUA', name: 'Guairá', cities: ['villarrica', 'iturbe'] },
    { code: 'PAR', name: 'Paraguarí', cities: ['paraguari', 'paraguarí', 'yaguaron', 'yaguarón', 'ybycui', 'ybycuí'] },
    { code: 'MIS', name: 'Misiones', cities: ['san juan bautista', 'san ignacio', 'ayolas'] },
    { code: 'NEE', name: 'Ñeembucú', cities: ['pilar', 'alberdi'] },
    { code: 'AMB', name: 'Amambay', cities: ['pedro juan caballero', 'capitan bado', 'capitán bado'] },
    { code: 'CAN', name: 'Canindeyú', cities: ['salto del guaira', 'salto del guairá', 'curuguaty'] },
    { code: 'PRH', name: 'Presidente Hayes', cities: ['villa hayes', 'benjamin aceval'] },
    { code: 'CON', name: 'Concepción', cities: ['concepcion', 'concepción', 'horqueta'] },
    { code: 'BOQ', name: 'Boquerón', cities: ['filadelfia', 'loma plata', 'mariscal estigarribia'] },
    { code: 'AAL', name: 'Alto Paraguay', cities: ['fuerte olimpo', 'bahia negra'] },
    { code: 'CAZ', name: 'Cazapá', cities: ['caazapa', 'caazapá', 'yuty'] },
];

// Argentina — 24 provincias
const AR_DEPARTMENTS: DepartmentInfo[] = [
    { code: 'CABA', name: 'Ciudad de Buenos Aires', cities: ['buenos aires', 'caba', 'capital federal'] },
    { code: 'BUE', name: 'Buenos Aires', cities: ['la plata', 'mar del plata', 'bahia blanca', 'bahía blanca', 'lomas de zamora', 'quilmes', 'lanus', 'lanús', 'avellaneda', 'moron', 'morón', 'san isidro', 'tigre', 'pilar', 'escobar', 'campana', 'zarate', 'zárate', 'tandil', 'junin'] },
    { code: 'CBA', name: 'Córdoba', cities: ['cordoba', 'córdoba', 'villa maria', 'villa maría', 'rio cuarto', 'río cuarto', 'villa carlos paz', 'san francisco', 'alta gracia'] },
    { code: 'SFE', name: 'Santa Fe', cities: ['rosario', 'santa fe', 'rafaela', 'venado tuerto', 'reconquista', 'villa gobernador galvez'] },
    { code: 'MZA', name: 'Mendoza', cities: ['mendoza', 'san rafael', 'godoy cruz', 'guaymallen', 'guaymallén', 'las heras', 'maipu', 'maipú'] },
    { code: 'TUC', name: 'Tucumán', cities: ['tucuman', 'tucumán', 'san miguel de tucuman', 'san miguel de tucumán', 'yerba buena', 'tafi viejo', 'tafí viejo', 'banda del rio sali'] },
    { code: 'SAL', name: 'Salta', cities: ['salta', 'san ramon de la nueva oran', 'tartagal', 'general guemes'] },
    { code: 'ERI', name: 'Entre Ríos', cities: ['parana', 'paraná', 'concordia', 'gualeguaychu', 'gualeguaychú', 'concepcion del uruguay'] },
    { code: 'MIS', name: 'Misiones', cities: ['posadas', 'eldorado', 'obera', 'oberá', 'puerto iguazu', 'puerto iguazú'] },
    { code: 'COR', name: 'Corrientes', cities: ['corrientes', 'goya', 'mercedes', 'paso de los libres'] },
    { code: 'CHA', name: 'Chaco', cities: ['resistencia', 'presidencia roque saenz pena', 'villa angela'] },
    { code: 'SJU', name: 'San Juan', cities: ['san juan', 'rawson', 'rivadavia', 'chimbas'] },
    { code: 'JUJ', name: 'Jujuy', cities: ['san salvador de jujuy', 'jujuy', 'palpala', 'palpalá', 'san pedro de jujuy'] },
    { code: 'RNG', name: 'Río Negro', cities: ['viedma', 'bariloche', 'san carlos de bariloche', 'cipolletti', 'general roca', 'allen'] },
    { code: 'NEU', name: 'Neuquén', cities: ['neuquen', 'neuquén', 'san martin de los andes', 'plottier', 'centenario', 'cutral co'] },
    { code: 'FOR', name: 'Formosa', cities: ['formosa', 'clorinda', 'pirané'] },
    { code: 'SGE', name: 'Santiago del Estero', cities: ['santiago del estero', 'la banda', 'termas de rio hondo'] },
    { code: 'CAT', name: 'Catamarca', cities: ['san fernando del valle de catamarca', 'catamarca'] },
    { code: 'LRJ', name: 'La Rioja', cities: ['la rioja', 'chilecito'] },
    { code: 'SLU', name: 'San Luis', cities: ['san luis', 'villa mercedes', 'merlo'] },
    { code: 'CHU', name: 'Chubut', cities: ['rawson', 'comodoro rivadavia', 'trelew', 'puerto madryn', 'esquel'] },
    { code: 'LPA', name: 'La Pampa', cities: ['santa rosa', 'general pico', 'toay'] },
    { code: 'SCR', name: 'Santa Cruz', cities: ['rio gallegos', 'río gallegos', 'caleta olivia', 'el calafate'] },
    { code: 'TDF', name: 'Tierra del Fuego', cities: ['ushuaia', 'rio grande', 'río grande', 'tolhuin'] },
];

// España — 17 comunidades autónomas
const ES_DEPARTMENTS: DepartmentInfo[] = [
    { code: 'MAD', name: 'Madrid', cities: ['madrid', 'mostoles', 'móstoles', 'alcala de henares', 'alcalá de henares', 'fuenlabrada', 'leganes', 'leganés', 'getafe', 'alcorcon', 'alcorcón', 'torrejon de ardoz', 'torrejón'] },
    { code: 'CAT', name: 'Cataluña', cities: ['barcelona', 'hospitalet', 'badalona', 'terrassa', 'sabadell', 'tarragona', 'lleida', 'girona', 'mataro', 'mataró', 'reus'] },
    { code: 'AND', name: 'Andalucía', cities: ['sevilla', 'malaga', 'málaga', 'granada', 'cordoba', 'córdoba', 'cadiz', 'cádiz', 'almeria', 'almería', 'huelva', 'jaen', 'jaén', 'jerez', 'marbella', 'dos hermanas', 'algeciras'] },
    { code: 'VAL', name: 'C. Valenciana', cities: ['valencia', 'alicante', 'elche', 'castellon', 'castellón', 'torrevieja', 'orihuela', 'gandia', 'gandía', 'benidorm', 'alcoy'] },
    { code: 'GAL', name: 'Galicia', cities: ['vigo', 'la coruna', 'a coruña', 'ourense', 'lugo', 'pontevedra', 'santiago de compostela', 'ferrol'] },
    { code: 'CYL', name: 'Castilla y León', cities: ['valladolid', 'burgos', 'salamanca', 'leon', 'león', 'palencia', 'zamora', 'segovia', 'avila', 'ávila', 'soria'] },
    { code: 'PVA', name: 'País Vasco', cities: ['bilbao', 'vitoria', 'san sebastian', 'san sebastián', 'donostia', 'barakaldo', 'getxo', 'irun', 'irún'] },
    { code: 'CLM', name: 'Castilla-La Mancha', cities: ['albacete', 'talavera de la reina', 'toledo', 'ciudad real', 'guadalajara', 'cuenca'] },
    { code: 'ARA', name: 'Aragón', cities: ['zaragoza', 'huesca', 'teruel', 'calatayud'] },
    { code: 'MUR', name: 'Murcia', cities: ['murcia', 'cartagena', 'lorca', 'molina de segura'] },
    { code: 'BAL', name: 'Islas Baleares', cities: ['palma', 'palma de mallorca', 'ibiza', 'manacor', 'inca'] },
    { code: 'CAN', name: 'Canarias', cities: ['las palmas', 'santa cruz de tenerife', 'la laguna', 'telde', 'arona', 'arrecife', 'puerto de la cruz'] },
    { code: 'EXT', name: 'Extremadura', cities: ['badajoz', 'caceres', 'cáceres', 'merida', 'mérida', 'plasencia', 'don benito'] },
    { code: 'AST', name: 'Asturias', cities: ['oviedo', 'gijon', 'gijón', 'aviles', 'avilés', 'langreo', 'mieres'] },
    { code: 'NAV', name: 'Navarra', cities: ['pamplona', 'tudela', 'barañain', 'baranain'] },
    { code: 'CNT', name: 'Cantabria', cities: ['santander', 'torrelavega', 'camargo', 'castro urdiales'] },
    { code: 'RIO', name: 'La Rioja', cities: ['logroño', 'logrono', 'calahorra', 'arnedo'] },
];

// Costa Rica — 7 provincias
const CR_DEPARTMENTS: DepartmentInfo[] = [
    { code: 'SJO', name: 'San José', cities: ['san jose', 'san josé', 'desamparados', 'curridabat', 'escazu', 'escazú', 'tibas', 'tibás', 'goicoechea', 'montes de oca', 'moravia', 'perez zeledon', 'pérez zeledón', 'puriscal'] },
    { code: 'ALA', name: 'Alajuela', cities: ['alajuela', 'san carlos', 'san ramon', 'san ramón', 'grecia', 'atenas', 'naranjo', 'palmares', 'ciudad quesada'] },
    { code: 'CAR', name: 'Cartago', cities: ['cartago', 'paraiso', 'paraíso', 'turrialba', 'la union', 'la unión', 'el guarco'] },
    { code: 'HER', name: 'Heredia', cities: ['heredia', 'san pablo', 'san rafael', 'barva', 'santo domingo', 'flores', 'belen', 'belén'] },
    { code: 'GUA', name: 'Guanacaste', cities: ['liberia', 'nicoya', 'santa cruz', 'canas', 'cañas', 'bagaces', 'carrillo', 'tilaran', 'tilarán'] },
    { code: 'PUN', name: 'Puntarenas', cities: ['puntarenas', 'esparza', 'quepos', 'golfito', 'corredores', 'buenos aires', 'osa', 'coto brus', 'garabito', 'jaco', 'jacó'] },
    { code: 'LIM', name: 'Limón', cities: ['limon', 'limón', 'pococi', 'pococí', 'siquirres', 'guacimo', 'guácimo', 'talamanca', 'matina'] },
];

export const DEPARTMENTS: Record<string, DepartmentInfo[]> = {
    CO: CO_DEPARTMENTS,
    EC: EC_DEPARTMENTS,
    PA: PA_DEPARTMENTS,
    GT: GT_DEPARTMENTS,
    MX: MX_DEPARTMENTS,
    PE: PE_DEPARTMENTS,
    CL: CL_DEPARTMENTS,
    PY: PY_DEPARTMENTS,
    AR: AR_DEPARTMENTS,
    ES: ES_DEPARTMENTS,
    CR: CR_DEPARTMENTS,
};

// Map from country URL slug to country code
export function getCountryCode(slug: string): string {
    const lower = normalize(slug);
    if (lower.includes('colombia')) return 'CO';
    if (lower.includes('ecuador')) return 'EC';
    if (lower.includes('panama')) return 'PA';
    if (lower.includes('guatemala')) return 'GT';
    if (lower.includes('mexico') || lower.includes('méxico')) return 'MX';
    if (lower.includes('peru') || lower.includes('perú')) return 'PE';
    if (lower.includes('chile')) return 'CL';
    if (lower.includes('paraguay')) return 'PY';
    if (lower.includes('argentina')) return 'AR';
    if (lower.includes('espana') || lower.includes('españa') || lower.includes('spain')) return 'ES';
    if (lower.includes('costa rica') || lower.includes('costarica')) return 'CR';
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
