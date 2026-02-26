export interface TutorialConfig {
    id: string;
    title: string;
    description: string;
    loomUrl: string;
    steps: string[];
}

export const TUTORIAL_INTRO: TutorialConfig = {
    id: 'intro',
    title: 'Bienvenido a Grand Line',
    description: 'Tu centro de comando para e-commerce COD',
    loomUrl: '', // Pega aqui el Loom embed URL cuando grabes el video
    steps: [
        'Importa tus ordenes desde Dropi para ver tu operacion en tiempo real',
        'Conecta tus cuentas de Facebook y TikTok para trackear publicidad',
        'Usa el Dashboard (Wheel) para monitorear KPIs y salud del negocio',
        'Consulta a Vega AI para analisis inteligentes y reportes automaticos',
    ],
};

export const MODULE_TUTORIALS: Record<string, TutorialConfig> = {
    '/dashboard': {
        id: 'dashboard',
        title: 'Wheel — Dashboard Principal',
        description: 'El centro de comando de tu operacion',
        loomUrl: '',
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
        loomUrl: '',
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
        loomUrl: '',
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
        loomUrl: '',
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
        loomUrl: '',
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
        loomUrl: '',
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
        loomUrl: '',
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
        options: ['Colombia', 'Ecuador', 'Panama', 'Guatemala', 'Otro'],
        multiSelect: true,
    },
    goals: {
        question: 'Que esperas lograr con Grand Line?',
        options: [
            'Mejorar mi ROAS y reducir CPA',
            'Tener control de entregas y devoluciones',
            'Automatizar reportes y analisis',
            'Escalar a mas paises',
        ],
        multiSelect: true,
    },
} as const;

export interface SurveyAnswers {
    monthlyOrders: string;
    countries: string[];
    goals: string[];
}
