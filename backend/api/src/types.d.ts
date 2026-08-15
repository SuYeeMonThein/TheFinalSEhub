/* Module declarations for packages without bundled types.
   These allow `tsc` to compile in production where @types/* devDeps are absent. */

declare module "cors";
declare module "swagger-ui-express";

declare module "swagger-jsdoc" {
  interface Options {
    definition: Record<string, any>;
    apis: string[];
  }
  function swaggerJsdoc(options: Options): any;
  export = swaggerJsdoc;
}

declare module "multer" {
  import { Request, RequestHandler } from "express";
  interface File {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  }
  interface Options {
    storage?: any;
    limits?: { fileSize?: number };
    fileFilter?: (
      req: any,
      file: File,
      cb: (error: Error | null, accept?: boolean) => void,
    ) => void;
  }
  interface Multer {
    array(fieldname: string, maxCount?: number): RequestHandler;
    single(fieldname: string): RequestHandler;
  }
  function multer(options?: Options): Multer;
  namespace multer {
    function memoryStorage(): any;
  }
  export = multer;
}

declare module "bcryptjs";
declare module "nodemailer";

declare namespace Express {
  namespace Multer {
    interface File {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    }
  }
  interface Request {
    files?: Multer.File[];
  }
}
