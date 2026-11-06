import type { Route } from 'next';

export function href(path: string) {
  return path as Route;
}
