import { describe, it, expect } from 'vitest';
import { isEntregado, isCancelado, isDevolucion, isTransit, isNovedad, matchesStatus } from '../status';

describe('isEntregado', () => {
    it('recognizes ENTREGADO status', () => {
        expect(isEntregado('ENTREGADO')).toBe(true);
        expect(isEntregado('entregado')).toBe(true);
        expect(isEntregado('Entregado')).toBe(true);
    });

    it('rejects non-entregado statuses', () => {
        expect(isEntregado('CANCELADO')).toBe(false);
        expect(isEntregado('EN CAMINO')).toBe(false);
        expect(isEntregado('DEVOLUCION')).toBe(false);
    });

    it('handles whitespace', () => {
        expect(isEntregado('  ENTREGADO  ')).toBe(true);
    });
});

describe('isCancelado', () => {
    it('recognizes CANCELADO status', () => {
        expect(isCancelado('CANCELADO')).toBe(true);
        expect(isCancelado('cancelado')).toBe(true);
    });

    it('recognizes RECHAZADO status', () => {
        expect(isCancelado('RECHAZADO')).toBe(true);
        expect(isCancelado('rechazado')).toBe(true);
    });

    it('rejects non-cancelado statuses', () => {
        expect(isCancelado('ENTREGADO')).toBe(false);
        expect(isCancelado('EN CAMINO')).toBe(false);
    });
});

describe('isDevolucion', () => {
    it('recognizes DEVOLUCION variations', () => {
        expect(isDevolucion('DEVOLUCION')).toBe(true);
        expect(isDevolucion('DEVOLUCIÓN')).toBe(true);
        expect(isDevolucion('EN DEVOLUCION')).toBe(true);
        expect(isDevolucion('EN DEVOLUCIÓN')).toBe(true);
    });

    it('is case insensitive', () => {
        expect(isDevolucion('devolucion')).toBe(true);
        expect(isDevolucion('Devolución')).toBe(true);
    });

    it('rejects non-devolucion statuses', () => {
        expect(isDevolucion('ENTREGADO')).toBe(false);
        expect(isDevolucion('CANCELADO')).toBe(false);
    });
});

describe('isTransit', () => {
    it('classifies non-final statuses as transit', () => {
        expect(isTransit('EN CAMINO')).toBe(true);
        expect(isTransit('GUIA GENERADA')).toBe(true);
        expect(isTransit('IMPRESO')).toBe(true);
        expect(isTransit('EN BODEGA')).toBe(true);
        expect(isTransit('RECOGIDO')).toBe(true);
    });

    it('rejects final statuses', () => {
        expect(isTransit('ENTREGADO')).toBe(false);
        expect(isTransit('CANCELADO')).toBe(false);
        expect(isTransit('RECHAZADO')).toBe(false);
        expect(isTransit('DEVOLUCION')).toBe(false);
        expect(isTransit('EN DEVOLUCIÓN')).toBe(false);
    });
});

describe('isNovedad', () => {
    it('recognizes novedad statuses', () => {
        expect(isNovedad('NOVEDAD')).toBe(true);
        expect(isNovedad('CON NOVEDAD')).toBe(true);
        expect(isNovedad('novedad')).toBe(true);
    });

    it('rejects non-novedad statuses', () => {
        expect(isNovedad('ENTREGADO')).toBe(false);
        expect(isNovedad('EN CAMINO')).toBe(false);
    });
});

describe('matchesStatus', () => {
    it('uses includes for matching', () => {
        // "EN DEVOLUCIÓN" includes "DEVOLUCIÓN"
        expect(matchesStatus('EN DEVOLUCIÓN', ['DEVOLUCIÓN'])).toBe(true);
    });

    it('normalizes to uppercase', () => {
        expect(matchesStatus('entregado', ['ENTREGADO'])).toBe(true);
    });

    it('trims whitespace', () => {
        expect(matchesStatus('  ENTREGADO  ', ['ENTREGADO'])).toBe(true);
    });
});
