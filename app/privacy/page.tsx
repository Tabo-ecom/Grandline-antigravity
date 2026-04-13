'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
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
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Política de Privacidad</h1>
                <p className="text-sm text-gray-500 mb-12">Última actualización: 6 de abril de 2026</p>

                <div className="space-y-10 text-[15px] leading-relaxed">

                    {/* 1 */}
                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">1. Introducción</h2>
                        <p>
                            TABO ECOM S.A.S. (&quot;nosotros&quot;, &quot;la Empresa&quot;) opera la plataforma Grand Line (&quot;la Plataforma&quot;).
                            Esta Política de Privacidad describe cómo recopilamos, usamos, almacenamos y protegemos su información
                            personal cuando utiliza nuestros servicios. Nos comprometemos a proteger su privacidad de acuerdo con
                            las leyes aplicables de protección de datos, incluyendo la Ley 1581 de 2012 de Colombia (Ley de Protección
                            de Datos Personales) y el Reglamento General de Protección de Datos (GDPR) cuando aplique.
                        </p>
                    </section>

                    {/* 2 */}
                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">2. Información que Recopilamos</h2>

                        <h3 className="text-sm font-semibold text-white mt-4 mb-2 uppercase tracking-wider">2.1. Información proporcionada por usted</h3>
                        <ul className="list-disc list-inside space-y-1.5 text-gray-400">
                            <li>Datos de registro: nombre, correo electrónico, contraseña</li>
                            <li>Datos de perfil: nombre del negocio, país de operación</li>
                            <li>Datos de facturación: procesados directamente por Stripe (no almacenamos números de tarjeta)</li>
                            <li>Datos de operación: reportes de ventas, envíos y recaudo que usted importa voluntariamente</li>
                        </ul>

                        <h3 className="text-sm font-semibold text-white mt-4 mb-2 uppercase tracking-wider">2.2. Información obtenida de integraciones</h3>
                        <p className="mb-2">Cuando conecta servicios de terceros, recopilamos:</p>
                        <ul className="list-disc list-inside space-y-1.5 text-gray-400">
                            <li><strong className="text-white">Facebook Ads (Meta):</strong> Métricas de campañas (gasto, impresiones, clics, conversiones), nombres de campañas e IDs de cuenta publicitaria</li>
                            <li><strong className="text-white">TikTok for Business:</strong> Información básica de perfil (nombre de usuario, avatar, open ID), métricas de campañas publicitarias y estado de contenido publicado</li>
                            <li><strong className="text-white">Google (Firebase):</strong> Datos de autenticación (email, UID, proveedor de login)</li>
                        </ul>

                        <h3 className="text-sm font-semibold text-white mt-4 mb-2 uppercase tracking-wider">2.3. Información recopilada automáticamente</h3>
                        <ul className="list-disc list-inside space-y-1.5 text-gray-400">
                            <li>Dirección IP y datos de ubicación aproximada</li>
                            <li>Tipo de navegador y dispositivo</li>
                            <li>Páginas visitadas y tiempo de uso dentro de la Plataforma</li>
                        </ul>
                    </section>

                    {/* 3 */}
                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">3. Uso de la Información</h2>
                        <p>Utilizamos su información para:</p>
                        <ul className="list-disc list-inside mt-3 space-y-1.5 text-gray-400">
                            <li>Proveer, mantener y mejorar los servicios de la Plataforma</li>
                            <li>Procesar pagos y gestionar suscripciones</li>
                            <li>Generar dashboards, reportes y análisis de su operación</li>
                            <li>Conectar y sincronizar datos con plataformas publicitarias autorizadas por usted</li>
                            <li>Subir contenido como borrador a sus cuentas de redes sociales cuando usted lo solicite</li>
                            <li>Enviar notificaciones relacionadas con el servicio (alertas, reportes, cambios en la cuenta)</li>
                            <li>Ofrecer soporte al cliente</li>
                            <li>Cumplir con obligaciones legales</li>
                        </ul>
                    </section>

                    {/* 4 */}
                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">4. Integración con TikTok — Datos y Privacidad</h2>
                        <p>
                            Grand Line utiliza TikTok Login Kit y Content Posting API. En relación con esta integración:
                        </p>

                        <h3 className="text-sm font-semibold text-white mt-4 mb-2 uppercase tracking-wider">4.1. Datos que accedemos</h3>
                        <ul className="list-disc list-inside space-y-1.5 text-gray-400">
                            <li><strong className="text-white">user.info.basic:</strong> Open ID, avatar y nombre de usuario — utilizados exclusivamente para identificar la cuenta conectada en el dashboard de Grand Line</li>
                            <li><strong className="text-white">video.upload:</strong> Permiso para subir videos como borrador a su cuenta de TikTok — usted revisa y publica manualmente cada borrador</li>
                        </ul>

                        <h3 className="text-sm font-semibold text-white mt-4 mb-2 uppercase tracking-wider">4.2. Cómo usamos los datos de TikTok</h3>
                        <ul className="list-disc list-inside space-y-1.5 text-gray-400">
                            <li>Los datos de perfil de TikTok se usan únicamente para mostrar la cuenta conectada dentro de Grand Line</li>
                            <li>No utilizamos sus datos de TikTok para publicidad, perfilamiento ni venta a terceros</li>
                            <li>No construimos bases de datos ni perfiles de usuarios de TikTok</li>
                            <li>No accedemos a datos de seguidores, mensajes privados ni contenido de otros usuarios</li>
                        </ul>

                        <h3 className="text-sm font-semibold text-white mt-4 mb-2 uppercase tracking-wider">4.3. Almacenamiento de tokens</h3>
                        <ul className="list-disc list-inside space-y-1.5 text-gray-400">
                            <li>Los tokens de acceso de TikTok se almacenan de forma segura en el servidor</li>
                            <li>Los tokens se utilizan exclusivamente para las funcionalidades autorizadas por usted</li>
                            <li>Al desconectar su cuenta de TikTok, los tokens se eliminan inmediatamente</li>
                        </ul>

                        <h3 className="text-sm font-semibold text-white mt-4 mb-2 uppercase tracking-wider">4.4. Retención y eliminación</h3>
                        <ul className="list-disc list-inside space-y-1.5 text-gray-400">
                            <li>Los datos de TikTok se retienen mientras su cuenta de Grand Line esté activa y la integración conectada</li>
                            <li>Al desconectar TikTok o eliminar su cuenta, todos los datos asociados se eliminan dentro de 30 días</li>
                            <li>Puede solicitar la eliminación inmediata de sus datos de TikTok contactándonos</li>
                        </ul>
                    </section>

                    {/* 5 */}
                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">5. Almacenamiento y Seguridad</h2>
                        <ul className="list-disc list-inside space-y-1.5 text-gray-400">
                            <li>Los datos se almacenan en Google Cloud (Firebase/Firestore) con encriptación en tránsito y en reposo</li>
                            <li>Implementamos arquitectura multi-tenant: cada usuario solo accede a sus propios datos</li>
                            <li>La autenticación utiliza Firebase Authentication con protocolos de seguridad estándar de la industria</li>
                            <li>Los pagos se procesan a través de Stripe sin que almacenemos datos de tarjetas de crédito</li>
                            <li>Los tokens de acceso a plataformas de terceros se almacenan de forma segura en el servidor</li>
                            <li>Mantenemos salvaguardas técnicas, físicas y administrativas de acuerdo con los estándares de la industria</li>
                        </ul>
                    </section>

                    {/* 6 */}
                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">6. Compartición de Datos</h2>
                        <p>No vendemos, alquilamos ni compartimos su información personal con terceros, excepto:</p>
                        <ul className="list-disc list-inside mt-3 space-y-1.5 text-gray-400">
                            <li><strong className="text-white">Proveedores de servicio:</strong> Stripe (pagos), Google Cloud/Firebase (infraestructura), plataformas publicitarias conectadas por usted (Meta, TikTok)</li>
                            <li><strong className="text-white">Obligaciones legales:</strong> Cuando sea requerido por ley, orden judicial o proceso legal</li>
                            <li><strong className="text-white">Protección de derechos:</strong> Para proteger los derechos, propiedad o seguridad de la Empresa, nuestros usuarios u otros</li>
                        </ul>
                    </section>

                    {/* 7 */}
                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">7. Retención de Datos</h2>
                        <ul className="list-disc list-inside space-y-1.5 text-gray-400">
                            <li>Los datos de su cuenta se retienen mientras su cuenta esté activa</li>
                            <li>Los datos de operación importados se retienen mientras su suscripción esté vigente</li>
                            <li>Tras la cancelación de la cuenta, los datos se eliminan dentro de 90 días</li>
                            <li>Ciertos datos pueden retenerse por más tiempo si es requerido por obligaciones legales o fiscales</li>
                            <li>Los datos de integraciones con terceros (tokens, métricas) se eliminan al desconectar la integración</li>
                        </ul>
                    </section>

                    {/* 8 */}
                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">8. Sus Derechos</h2>
                        <p>De acuerdo con las leyes aplicables, usted tiene derecho a:</p>
                        <ul className="list-disc list-inside mt-3 space-y-1.5 text-gray-400">
                            <li><strong className="text-white">Acceso:</strong> Solicitar una copia de los datos personales que tenemos sobre usted</li>
                            <li><strong className="text-white">Rectificación:</strong> Solicitar la corrección de datos inexactos o incompletos</li>
                            <li><strong className="text-white">Eliminación:</strong> Solicitar la eliminación de sus datos personales</li>
                            <li><strong className="text-white">Portabilidad:</strong> Solicitar sus datos en un formato estructurado y legible por máquina</li>
                            <li><strong className="text-white">Revocación:</strong> Revocar el consentimiento para el tratamiento de sus datos en cualquier momento</li>
                            <li><strong className="text-white">Desconexión:</strong> Desconectar cualquier integración con terceros y eliminar los datos asociados</li>
                        </ul>
                        <p className="mt-3">
                            Para ejercer cualquiera de estos derechos, contáctenos a ceo@taboecom.com. Responderemos a su
                            solicitud dentro de los 15 días hábiles establecidos por la ley colombiana.
                        </p>
                    </section>

                    {/* 9 */}
                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">9. Cookies y Tecnologías Similares</h2>
                        <p>
                            Utilizamos cookies esenciales para el funcionamiento de la Plataforma (autenticación, preferencias de sesión).
                            No utilizamos cookies de seguimiento publicitario ni compartimos datos de cookies con terceros para fines de marketing.
                        </p>
                    </section>

                    {/* 10 */}
                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">10. Menores de Edad</h2>
                        <p>
                            La Plataforma no está dirigida a menores de 18 años. No recopilamos conscientemente información
                            personal de menores. Si descubrimos que hemos recopilado datos de un menor, los eliminaremos inmediatamente.
                        </p>
                    </section>

                    {/* 11 */}
                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">11. Cambios en esta Política</h2>
                        <p>
                            Podemos actualizar esta Política de Privacidad periódicamente. Los cambios entrarán en vigor al ser
                            publicados en esta página con una fecha de actualización revisada. Le notificaremos sobre cambios
                            significativos por correo electrónico o a través de la Plataforma.
                        </p>
                    </section>

                    {/* 12 */}
                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">12. Contacto</h2>
                        <p>
                            Si tiene preguntas sobre esta Política de Privacidad o sobre el tratamiento de sus datos personales:
                        </p>
                        <ul className="list-none mt-3 space-y-1.5 text-gray-400">
                            <li><strong className="text-white">Responsable:</strong> TABO ECOM S.A.S.</li>
                            <li><strong className="text-white">Email:</strong> ceo@taboecom.com</li>
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
                        <a href="/terms" className="hover:text-white transition-colors">Términos de Servicio</a>
                        <a href="/privacy" className="text-white">Política de Privacidad</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
