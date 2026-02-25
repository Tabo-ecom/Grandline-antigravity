import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/api/', '/dashboard', '/import', '/publicidad', '/log-pose', '/berry', '/vega-ai', '/sunny', '/settings', '/usuarios'],
            },
        ],
        sitemap: 'https://grandline.com.co/sitemap.xml',
    };
}
