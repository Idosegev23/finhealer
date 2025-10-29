/**
 * PDF.js Polyfills for Node.js/Vercel serverless environment
 * These polyfills provide the minimal browser APIs that pdfjs-dist expects
 */

// Only setup polyfills once
let polyfillsInitialized = false;

export function setupPDFPolyfills() {
  if (polyfillsInitialized) {
    return;
  }

  // DOMMatrix - minimal implementation
  if (typeof globalThis.DOMMatrix === 'undefined') {
    (globalThis as any).DOMMatrix = class DOMMatrix {
      a: number = 1;
      b: number = 0;
      c: number = 0;
      d: number = 1;
      e: number = 0;
      f: number = 0;
      m11: number = 1;
      m12: number = 0;
      m13: number = 0;
      m14: number = 0;
      m21: number = 0;
      m22: number = 1;
      m23: number = 0;
      m24: number = 0;
      m31: number = 0;
      m32: number = 0;
      m33: number = 1;
      m34: number = 0;
      m41: number = 0;
      m42: number = 0;
      m43: number = 0;
      m44: number = 1;

      constructor(init?: any) {
        if (Array.isArray(init)) {
          if (init.length === 6) {
            this.a = this.m11 = init[0];
            this.b = this.m12 = init[1];
            this.c = this.m21 = init[2];
            this.d = this.m22 = init[3];
            this.e = this.m41 = init[4];
            this.f = this.m42 = init[5];
          }
        }
      }

      scale(x: number, y?: number) {
        return this;
      }

      translate(x: number, y: number) {
        return this;
      }

      rotate(angle: number) {
        return this;
      }

      inverse() {
        return new (globalThis as any).DOMMatrix();
      }

      transformPoint(point?: any) {
        return { x: 0, y: 0 };
      }

      multiply(other: any) {
        return this;
      }
    };
  }

  // Path2D - minimal implementation
  if (typeof globalThis.Path2D === 'undefined') {
    (globalThis as any).Path2D = class Path2D {
      constructor(path?: any) {}
      addPath(path: any, transform?: any) {}
      closePath() {}
      moveTo(x: number, y: number) {}
      lineTo(x: number, y: number) {}
      bezierCurveTo(
        cp1x: number,
        cp1y: number,
        cp2x: number,
        cp2y: number,
        x: number,
        y: number
      ) {}
      quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {}
      arc(
        x: number,
        y: number,
        radius: number,
        startAngle: number,
        endAngle: number,
        anticlockwise?: boolean
      ) {}
      ellipse(
        x: number,
        y: number,
        radiusX: number,
        radiusY: number,
        rotation: number,
        startAngle: number,
        endAngle: number,
        anticlockwise?: boolean
      ) {}
      rect(x: number, y: number, w: number, h: number) {}
    };
  }

  // ImageData - minimal implementation
  if (typeof globalThis.ImageData === 'undefined') {
    (globalThis as any).ImageData = class ImageData {
      width: number;
      height: number;
      data: Uint8ClampedArray;

      constructor(
        widthOrData: number | Uint8ClampedArray,
        height?: number,
        settingsOrWidth?: any,
        settings?: any
      ) {
        if (widthOrData instanceof Uint8ClampedArray) {
          this.data = widthOrData;
          this.width = height || 0;
          this.height = settingsOrWidth || 0;
        } else {
          this.width = widthOrData;
          this.height = height || 0;
          this.data = new Uint8ClampedArray(this.width * this.height * 4);
        }
      }
    };
  }

  polyfillsInitialized = true;
  console.log('✅ PDF.js polyfills initialized');
}

