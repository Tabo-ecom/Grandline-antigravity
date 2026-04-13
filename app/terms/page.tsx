'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-[#0A0A0F] text-gray-300">
            {/* Header */}
            <header className="border-b border-white/5 py-6 px-6">
                <div className="max-w-4xl mx-auto flex items-center gap-4">
                    <a href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
                        <ArrowLeft className="w-4 h-4" />
                        Volver
                    </a>
                    <div className="flex items-center gap-2.5 ml-auto">
                        <img src="/logos/grandline-isotipo.png" alt="Grand Line" className="w-6 h-6" />
                        <span className="text-sm font-semibold text-white">GRAND LINE</span>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-4xl mx-auto px-6 py-16">
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Términos de Servicio</h1>
                <p className="text-sm text-gray-500 mb-12">Última actualización: 6 de abril de 2026</p>

                <div className="space-y-10 text-[15px] leading-relaxed">

                    {/* 1 */}
                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">1. Aceptación de los Términos</h2>
                        <p>
                            Al acceder o utilizar Grand Line (&quot;la Plataforma&quot;), operada por TABO ECOM S.A.S. (&quot;nosotros&quot;, &quot;la Empresa&quot;),
                            usted acepta quedar vinculado por estos Términos de Servicio. Si no está de acuerdo con alguna parte de estos
                            términos, no podrá acceder ni utilizar la Plataforma.
                        </p>
                    </section>

                    {/* 2 */}
                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">2. Descripción del Servicio</h2>
                        <p>
                            Grand Line es una plataforma SaaS de analytics y gestión para negocios de e-commerce y dropshipping en Latinoamérica.
                            La Plataforma permite a los usuarios:
                        </p>
                        <ul className="list-disc list-inside mt-3 space-y-1.5 text-gray-400">
                            <li>Importar y analizar datos de operación (ventas, envíos, recaudo)</li>
                            <li>Visualizar métricas de rendimiento y KPIs en dashboards interactivos</li>
                            <li>Conectar cuentas de publicidad (Facebook Ads, TikTok Ads) para análisis de campañas</li>
                            <li>Crear y gestionar campañas publicitarias a través de integraciones con plataformas de terceros</li>
                            <li>Generar reportes con asistencia de inteligencia artificial</li>
                            <li>Gestionar estados financieros (P&amp;L) y proyecciones</li>
                        </ul>
                    </section>

                    {/* 3 */}
                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">3. Registro y Cuentas</h2>
                        <p>
                            Para utilizar la Plataforma debe crear una cuenta proporcionando información veraz y actualizada.
                            Usted es responsable de mantener la confidencialidad de sus credenciales de acceso y de todas
                            las actividades que ocurran bajo su cuenta. Debe notificarnos inmediatamente sobre cualquier
                            uso no autorizado de su cuenta.
                        </p>
                    </section>

                    {/* 4 */}
                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">4. Planes y Pagos</h2>
                        <p>
                            Grand Line ofrece planes de suscripción mensual con diferentes niveles de acceso a módulos y funcionalidades.
                            Los precios y características de cada plan están disponibles en la página de precios de la Plataforma.
                        </p>
                        <ul className="list-disc list-inside mt-3 space-y-1.5 text-gray-400">
                            <li>Las suscripciones se renuevan automáticamente cada mes salvo cancelación previa</li>
                            <li>Puede cancelar su suscripción en cualquier momento; el acceso se mantiene hasta el final del período facturado</li>
                            <li>Los pagos se procesan a través de Stripe, un procesador de pagos certificado PCI-DSS</li>
                            <li>No se realizan reembolsos por períodos parciales de uso</li>
                            <li>Nos reservamos el derecho de modificar los precios con 30 días de aviso previo</li>
                        </ul>
                    </section>

                    {/* 5 */}
                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">5. Integraciones con Terceros</h2>
                        <p>
                            La Plataforma se integra con servicios de terceros incluyendo, pero no limitado a: Facebook Ads (Meta),
                            TikTok for Business, Google (Firebase), y Stripe. Al conectar estas integraciones:
                        </p>
                        <ul className="list-disc list-inside mt-3 space-y-1.5 text-gray-400">
                            <li>Usted autoriza a Grand Line a acceder a los datos necesarios de su cuenta en dichos servicios para el funcionamiento de la Plataforma</li>
                            <li>Los datos obtenidos se utilizan exclusivamente para proveer las funcionalidades de la Plataforma</li>
                            <li>Usted es responsable de cumplir con los términos de servicio de cada plataforma de terceros</li>
                            <li>Grand Line no es responsable por cambios, interrupciones o discontinuación de servicios de terceros</li>
                        </ul>
                    </section>

                    {/* 5.1 TikTok */}
                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">5.1. Integración con TikTok</h2>
                        <p>
                            Al conectar su cuenta de TikTok a Grand Line a través de TikTok Login Kit:
                        </p>
                        <ul className="list-disc list-inside mt-3 space-y-1.5 text-gray-400">
                            <li>Accedemos a información básica de su perfil (nombre de usuario, avatar) para identificar la cuenta conectada</li>
                            <li>Utilizamos la API de Content Posting para subir contenido como borrador a su cuenta de TikTok, el cual usted revisa y publica manualmente</li>
                            <li>No publicamos contenido directamente en su nombre sin su revisión previa</li>
                            <li>No recopilamos ni almacenamos datos personales de otros usuarios de TikTok</li>
                            <li>Puede desconectar su cuenta de TikTok en cualquier momento desde la configuración de Grand Line</li>
                            <li>Al desconectar, eliminamos los tokens de acceso asociados a su cuenta de TikTok</li>
                        </ul>
                    </section>

                    {/* 6 */}
                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">6. Uso Aceptable</h2>
                        <p>Usted se compromete a no:</p>
                        <ul className="list-disc list-inside mt-3 space-y-1.5 text-gray-400">
                            <li>Utilizar la Plataforma para actividades ilegales o no autorizadas</li>
                            <li>Intentar acceder a datos de otros usuarios o comprometer la seguridad del sistema</li>
                            <li>Realizar ingeniería inversa, descompilar o desensamblar cualquier parte de la Plataforma</li>
                            <li>Subir contenido malicioso, ofensivo, engañoso o que infrinja derechos de terceros</li>
                            <li>Utilizar bots, scrapers o métodos automatizados no autorizados para acceder a la Plataforma</li>
                            <li>Revender o redistribuir el acceso a la Plataforma sin autorización</li>
                        </ul>
                    </section>

                    {/* 7 */}
                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">7. Propiedad Intelectual</h2>
                        <p>
                            Grand Line, incluyendo su diseño, código, contenido, logos y marca, es propiedad de TABO ECOM S.A.S.
                            Los datos que usted importe o genere dentro de la Plataforma son de su propiedad. Le otorgamos una
                            licencia limitada, no exclusiva e intransferible para usar la Plataforma conforme a estos términos.
                        </p>
                    </section>

                    {/* 8 */}
                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">8. Limitación de Responsabilidad</h2>
                        <p>
                            La Plataforma se proporciona &quot;tal cual&quot; y &quot;según disponibilidad&quot;. No garantizamos que el servicio
                            será ininterrumpido, libre de errores o completamente seguro. En la máxima medida permitida por la ley:
                        </p>
                        <ul className="list-disc list-inside mt-3 space-y-1.5 text-gray-400">
                            <li>No somos responsables por pérdidas indirectas, incidentales o consecuentes derivadas del uso de la Plataforma</li>
                            <li>Nuestra responsabilidad total no excederá el monto pagado por usted en los últimos 3 meses</li>
                            <li>No somos responsables por decisiones comerciales tomadas con base en los datos o análisis de la Plataforma</li>
                        </ul>
                    </section>

                    {/* 9 */}
                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">9. Terminación</h2>
                        <p>
                            Podemos suspender o cancelar su acceso a la Plataforma si viola estos términos, con o sin aviso previo.
                            Usted puede cancelar su cuenta en cualquier momento contactándonos. Tras la terminación, su derecho
                            de usar la Plataforma cesa inmediatamente.
                        </p>
                    </section>

                    {/* 10 */}
                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">10. Modificaciones</h2>
                        <p>
                            Nos reservamos el derecho de modificar estos términos en cualquier momento. Las modificaciones
                            entrarán en vigor al ser publicadas en esta página. El uso continuado de la Plataforma después
                            de cualquier cambio constituye su aceptación de los nuevos términos. Le notificaremos sobre
                            cambios significativos por correo electrónico o a través de la Plataforma.
                        </p>
                    </section>

                    {/* 11 */}
                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">11. Ley Aplicable</h2>
                        <p>
                            Estos términos se rigen por las leyes de la República de Colombia. Cualquier disputa será
                            resuelta ante los tribunales competentes de la ciudad de Bogotá, Colombia.
                        </p>
                    </section>

                    {/* 12 */}
                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">12. Contacto</h2>
                        <p>
                            Para preguntas sobre estos Términos de Servicio, puede contactarnos en:
                        </p>
                        <ul className="list-none mt-3 space-y-1.5 text-gray-400">
                            <li><strong className="text-white">Email:</strong> ceo@taboecom.com</li>
                            <li><strong className="text-white">Empresa:</strong> TABO ECOM S.A.S.</li>
                            <li><strong className="text-white">Plataforma:</strong> grandline.com.co</li>
                        </ul>
                    </section>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-white/5 py-8 px-6">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                        <img src="/logos/grandline-isotipo.png" alt="Grand Line" className="w-6 h-6" />
                        <span className="text-xs text-gray-500">GRAND LINE — TABO ECOM S.A.S.</span>
                    </div>
                    <div className="flex items-center gap-6 text-xs text-gray-500">
                        <a href="/terms" className="text-white">Términos de Servicio</a>
                        <a href="/privacy" className="hover:text-white transition-colors">Política de Privacidad</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
