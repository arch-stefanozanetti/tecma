import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  outDir: 'dist',
  format: ['esm'],
  target: 'es2022',
  dts: {
    compilerOptions: {
      incremental: false,
    },
  },
  splitting: true,
  treeshake: true,
  clean: true,
  sourcemap: true,
  external: ['react', 'react-dom'],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
});
