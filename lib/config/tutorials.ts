export interface TutorialVideo {
    title: string;
    url: string;
}

export interface TutorialConfig {
    id: string;
    title: string;
    description: string;
    videos: TutorialVideo[];
    steps: string[];
}

export const TUTORIAL_INTRO: TutorialConfig = {
    id: 'intro',
    title: 'Bienvenido a Grand Line',
    description: 'Tu centro de comando para e-commerce COD',
    videos: [
        { title: 'Introduccion a Grand Line', url: 'https://youtu.be/K_6ROx7IZYw' },
    ],
    steps: [
        'Descarga el reporte de ordenes desde tu cuenta de Dropi',
        'Subelo en el modulo de Importar Datos',
        'Conecta la API de Facebook desde el modulo de Publicidad',
        'Mapea tus campañas a los productos correspondientes',
        'Listo! Genera reportes y analiza tus numeros en tiempo real',
    ],
};

export const MODULE_TUTORIALS: Record<string, TutorialConfig> = {
    '/dashboard': {
        id: 'dashboard',
        title: 'Wheel — Dashboard Principal',
        description: 'El centro de comando de tu operacion',
        videos: [
            { title: 'Wheel', url: 'https://youtu.be/pTNcX8qsY_8' },
        ],
        steps: [
            'Filtra por pais, producto y rango de fechas para ver metricas especificas',
            'Revisa los KPIs clave: ROAS, CPA, tasa de entrega y margen',
            'Monitorea el desglose de inversion por plataforma (Facebook vs TikTok)',
            'Analiza la tabla de paises para comparar rendimiento por territorio',
        ],
    },
    '/log-pose': {
        id: 'logpose',
        title: 'Log Pose — Territorios',
        description: 'Gestion detallada por pais',
        videos: [
            { title: 'Log Pose', url: 'https://youtu.be/K3P9pqZQfn8' },
        ],
        steps: [
            'Selecciona un pais para ver sus ordenes, entregas y devoluciones',
            'Revisa el estado de cada orden individual con filtros avanzados',
            'Analiza el P&L (cascada de costos) de cada territorio',
            'Identifica productos ganadores y perdedores por pais',
        ],
    },
    '/publicidad': {
        id: 'publicidad',
        title: 'Publicidad — Centro de Ads',
        description: 'Control total de tu inversion publicitaria',
        videos: [
            { title: 'Conecta la API de Facebook', url: 'https://youtu.be/avR23mXHixc' },
            { title: 'Subir Reportes TikTok', url: 'https://youtu.be/Kuhe1W12BeQ' },
        ],
        steps: [
            'Conecta tu token de Facebook o sube CSVs de TikTok para importar datos',
            'Mapea cada campana a su producto/pais para tracking preciso',
            'Crea grupos de productos para agrupar campanas relacionadas',
            'Usa las sugerencias de IA para mapear campanas automaticamente',
        ],
    },
    '/sunny': {
        id: 'sunny',
        title: 'Sunny — Modulo de Ads',
        description: 'Lanza y gestiona campanas publicitarias',
        videos: [
            { title: 'Sunny', url: 'https://youtu.be/wNOu894Gm3A' },
        ],
        steps: [
            'Conecta tu cuenta de Facebook Ads desde configuracion',
            'Genera copies con IA para tus campanas',
            'Monitorea el rendimiento de campanas activas',
        ],
    },
    '/berry': {
        id: 'berry',
        title: 'Berry — Billetera',
        description: 'Gestion de pagos y facturacion',
        videos: [
            { title: 'Berry', url: 'https://youtu.be/NxlXtSzTxtE' },
        ],
        steps: [
            'Revisa tu balance y transacciones recientes',
            'Gestiona los pagos de tu suscripcion',
            'Consulta el historial de facturacion',
        ],
    },
    '/vega-ai': {
        id: 'vega',
        title: 'Vega AI — Inteligencia Artificial',
        description: 'Tu analista de datos con IA',
        videos: [
            { title: 'Vega AI', url: 'https://youtu.be/RH4W5ADJh28' },
        ],
        steps: [
            'Chatea con Vega para obtener analisis de tu operacion en lenguaje natural',
            'Configura alertas automaticas para metricas criticas (ROAS, CPA, entregas)',
            'Programa reportes diarios por Slack o Telegram',
            'Genera reportes semanales y mensuales con recomendaciones de IA',
        ],
    },
    '/import': {
        id: 'import',
        title: 'Importar Datos',
        description: 'Carga tus ordenes desde Dropi',
        videos: [
            { title: 'Importar Datos', url: 'https://youtu.be/Hl4UoCbzaQI' },
            { title: 'Genera Reportes Dropi', url: 'https://youtu.be/qCmbdQRiPQQ' },
        ],
        steps: [
            'Descarga el reporte de ordenes desde tu cuenta de Dropi',
            'Arrastra el archivo Excel/CSV a la zona de importacion',
            'Selecciona el pais correspondiente a las ordenes',
            'Verifica que el conteo de ordenes coincida con Dropi',
        ],
    },
};

export const SURVEY_QUESTIONS = {
    monthlyOrders: {
        question: 'Cuantas ordenes manejas al mes?',
        options: ['Menos de 500', '500 - 2,000', '2,000 - 10,000', 'Mas de 10,000'],
    },
    countries: {
        question: 'En que paises operas?',
        options: ['Colombia', 'Ecuador', 'Panama', 'Guatemala', 'Mexico', 'Peru', 'Chile', 'Paraguay', 'Argentina', 'España', 'Costa Rica'],
        multiSelect: true,
    },
    experience: {
        question: 'Cuanto tiempo llevas en dropshipping?',
        options: ['Menos de 3 meses', '3 - 12 meses', '1 - 3 años', 'Mas de 3 años'],
    },
    biggestPain: {
        question: 'Cual es tu mayor dolor de cabeza hoy?',
        options: [
            'No se cuanto gano realmente',
            'Muchas devoluciones/cancelaciones',
            'No se que campañas son rentables',
            'Pierdo tiempo haciendo reportes a mano',
        ],
    },
    adSpend: {
        question: 'Cuanto inviertes en publicidad al mes (USD)?',
        options: ['Menos de $500', '$500 - $2,000', '$2,000 - $5,000', 'Mas de $5,000'],
    },
} as const;

export interface SurveyAnswers {
    monthlyOrders: string;
    countries: string[];
    experience: string;
    biggestPain: string;
    adSpend: string;
}
