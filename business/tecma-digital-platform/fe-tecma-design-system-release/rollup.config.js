import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { babel } from '@rollup/plugin-babel';
import typescript from 'rollup-plugin-typescript2';
import postcss from 'rollup-plugin-postcss';
import autoprefixer from 'autoprefixer';
import del from 'rollup-plugin-delete';
import copy from 'rollup-plugin-copy';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'lib/index.cjs.js',
      format: 'cjs',
      exports: 'named',
      sourcemap: true,
    },
    {
      file: 'lib/index.esm.js',
      format: 'esm',
      sourcemap: true,
    },
  ],
  external: ['react', 'react-dom'],
  plugins: [
    del({ targets: 'lib' }),
    resolve(),
    commonjs(),
    typescript({
      exclude: ['**/*.test.ts', '**/*.test.tsx', '**/*.stories.ts', '**/*.stories.tsx', '**/*.css', '**/*.scss', '**/*.spec.tsx'],
    }),
    babel({
      babelHelpers: 'bundled',
      presets: [
        [
          '@babel/preset-env',
          {
            targets: { ie: '11' },
          },
        ],
      ],
    }),
    postcss({
      extensions: ['.scss', '.css'],
      inject: true,
      minimize: true,
      plugins: [autoprefixer()],
      use: [
        [
          'sass',
          {
            includePaths: ['src', 'node_modules'],
          },
        ],
      ],
    }),
    copy({
      targets: [
        { src: 'src/assets/*', dest: 'lib/assets' },
        { src: 'src/styles/colors.scss', dest: 'lib/styles' },
        { src: 'src/styles/fonts.scss', dest: 'lib/styles' },
        { src: 'src/styles/theme/utils/colors.scss', dest: 'lib/styles/theme/utils' },
        { src: 'src/styles/theme/utils/fonts.scss', dest: 'lib/styles/theme/utils' },
        { src: 'src/styles/theme/utils/dimensions.scss', dest: 'lib/styles/theme/utils' },
        { src: 'src/assets/fonts/*', dest: 'lib/assets/fonts' }
      ],
      hook: 'closeBundle',
      verbose: true,
    }),
  ],
};
