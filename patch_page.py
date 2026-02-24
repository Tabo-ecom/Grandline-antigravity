import re

with open('app/publicidad/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update availableProducts
content = content.replace(
"""    const availableProducts = useMemo(() => {
        const productMap = new Map<string, { id: string, label: string, country?: string }>();

        // Add all products from orders
        orders.forEach(o => {
            if (o.PRODUCTO_ID && o.PRODUCTO) {
                productMap.set(o.PRODUCTO_ID.toString(), {
                    id: o.PRODUCTO_ID.toString(),
                    label: o.PRODUCTO,
                    country: o.PAIS
                });
            }
        });

        // Add all products from mappings
        mappings.forEach(m => {
            const effectiveId = getEffectiveProductId(m.productId, productGroups);
            if (!productMap.has(effectiveId)) {
                productMap.set(effectiveId, { id: effectiveId, label: resolveProductName(effectiveId, orders as any, mappings, productGroups) });
            }
        });

        productGroups.forEach(g => {
            g.productIds.forEach(pid => {
                if (!productMap.has(pid)) {
                    productMap.set(pid, { id: pid, label: resolveProductName(pid, orders as any, mappings, productGroups) });
                }
            });
        });

        const list = Array.from(productMap.values());

        return [{ id: 'Todos', label: 'Todos', country: 'Todos' }, ...list.sort((a, b) => a.label.localeCompare(b.label))];
    }, [orders, productGroups]);""",
"""    const availableProducts = useMemo(() => {
        const productMap = new Map<string, { id: string, label: string, country?: string }>();

        // Add all products from rawOrders to ensure names are always resolved
        rawOrders.forEach(o => {
            if (o.PRODUCTO_ID && o.PRODUCTO) {
                productMap.set(o.PRODUCTO_ID.toString(), {
                    id: o.PRODUCTO_ID.toString(),
                    label: o.PRODUCTO,
                    country: o.PAIS
                });
            }
        });

        // Add all products from mappings
        mappings.forEach(m => {
            const effectiveId = getEffectiveProductId(m.productId, productGroups);
            if (!productMap.has(effectiveId)) {
                productMap.set(effectiveId, { id: effectiveId, label: resolveProductName(effectiveId, rawOrders as any, mappings, productGroups) });
            }
        });

        productGroups.forEach(g => {
            g.productIds.forEach(pid => {
                if (!productMap.has(pid)) {
                    productMap.set(pid, { id: pid, label: resolveProductName(pid, rawOrders as any, mappings, productGroups) });
                }
            });
        });

        const list = Array.from(productMap.values());

        return [{ id: 'Todos', label: 'Todos', country: 'Todos' }, ...list.sort((a, b) => a.label.localeCompare(b.label))];
    }, [rawOrders, productGroups, mappings]);"""
)

with open('app/publicidad/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched availableProducts")

