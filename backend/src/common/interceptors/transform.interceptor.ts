import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

function transformValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  // Dates -> ISO strings
  if (value instanceof Date) return value.toISOString();

  // Arrays
  if (Array.isArray(value)) return value.map((v) => transformValue(v));

  // Plain objects (including mongoose docs after toObject/lean)
  if (typeof value === 'object' && value !== null) {
    const valueObj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};

    for (const key of Object.keys(valueObj)) {
      const v = valueObj[key];
      if (key === '_id') {
        // If _id is present and has a toString, prefer the string form
        if (
          typeof v === 'object' &&
          v !== null &&
          typeof (v as { toString?: unknown }).toString === 'function'
        ) {
          try {
            out.id = (v as { toString: () => string }).toString();
          } catch {
            out.id = v;
          }
        } else {
          out.id = transformValue(v);
        }
        continue;
      }

      if (key === '__v') continue; // ignore mongoose version key

      out[key] = transformValue(v);
    }

    return out;
  }

  return value;
}

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => transformValue(data)));
  }
}
