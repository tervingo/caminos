import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'api',
    environment: 'node',
    // Los tests de integración borran y recrean la misma base: uno detrás de otro
    fileParallelism: false,
  },
});
