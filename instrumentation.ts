/**
 * Next.js Instrumentation Hook
 * This runs BEFORE any other code in the Node.js runtime
 * Perfect for setting up global polyfills!
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Setup PDF.js polyfills for Node.js runtime
    if (typeof global.DOMMatrix === 'undefined') {
      (global as any).DOMMatrix = class DOMMatrix {
        a = 1;
        b = 0;
        c = 0;
        d = 1;
        e = 0;
        f = 0;
        m11 = 1;
        m12 = 0;
        m13 = 0;
        m14 = 0;
        m21 = 0;
        m22 = 1;
        m23 = 0;
        m24 = 0;
        m31 = 0;
        m32 = 0;
        m33 = 1;
        m34 = 0;
        m41 = 0;
        m42 = 0;
        m43 = 0;
        m44 = 1;

        constructor(init?: any) {
          if (Array.isArray(init) && init.length === 6) {
            this.a = this.m11 = init[0];
            this.b = this.m12 = init[1];
            this.c = this.m21 = init[2];
            this.d = this.m22 = init[3];
            this.e = this.m41 = init[4];
            this.f = this.m42 = init[5];
          }
        }

        scale() {
          return this;
        }
        translate() {
          return this;
        }
        rotate() {
          return this;
        }
        inverse() {
          return new (global as any).DOMMatrix();
        }
        transformPoint() {
          return { x: 0, y: 0 };
        }
        multiply() {
          return this;
        }
      };
    }

    if (typeof global.Path2D === 'undefined') {
      (global as any).Path2D = class Path2D {
        constructor() {}
        addPath() {}
        closePath() {}
        moveTo() {}
        lineTo() {}
        bezierCurveTo() {}
        quadraticCurveTo() {}
        arc() {}
        ellipse() {}
        rect() {}
      };
    }

    if (typeof global.ImageData === 'undefined') {
      (global as any).ImageData = class ImageData {
        width = 0;
        height = 0;
        data: Uint8ClampedArray;

        constructor(width: number, height: number) {
          this.width = width;
          this.height = height;
          this.data = new Uint8ClampedArray(width * height * 4);
        }
      };
    }

    console.log('✅ PDF.js polyfills registered via instrumentation hook');
  }
}

