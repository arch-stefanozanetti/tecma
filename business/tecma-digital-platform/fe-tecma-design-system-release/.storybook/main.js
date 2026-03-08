// .storybook/main.js
const path = require('path');

module.exports = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: [
    // (Disabilita o commenta qui tutti gli addon non indispensabili se vuoi isolare eventuali conflitti)
    '@storybook/addon-links',
    '@storybook/addon-interactions',
    'storybook-addon-designs',
    '@storybook/addon-a11y',
    'storybook-addon-pseudo-states',
    '@storybook/addon-storysource',
    '@storybook/addon-coverage',
    {
      name: '@storybook/addon-docs',
      options: {
        sourceLoaderOptions: {
          injectStoryParameters: false,
        },
      },
    },
  ],
  framework: '@storybook/react',
  core: {
    builder: 'webpack5',
  },
  webpackFinal: async (config) => {
    // 1) Rimuoviamo eventuali regole SCSS esistenti
    config.module.rules = config.module.rules.filter((rule) => {
      if (!rule.test) return true; // alcune regole non hanno test
      const testString = rule.test.toString();
      if (testString.includes('scss') || testString.includes('sass')) {
        console.log('>>> Rimuovo regola pre-esistente SCSS:', rule);
        return false;
      }
      return true;
    });

    // 2) Aggiungiamo la nostra regola per i file .scss
    config.module.rules.push({
      test: /\.scss$/,
      use: [
        'style-loader',
        'css-loader',
        {
          loader: 'sass-loader',
          options: {
            sassOptions: {
              includePaths: [path.join(process.cwd(), 'src')],
            },
          },
        },
      ],
    });

    // 3) Aggiungiamo una regola per i font (ttf, woff, woff2, ecc.)
    // Se desideri supportare altri formati (es. otf, eot), aggiungili al test.
    config.module.rules.push({
      test: /\.(ttf|woff2?|eot|otf)$/,
      type: 'asset/resource',
      generator: {
        // Opzionale: personalizza la cartella/nome di output dei font
        // Esempio: "static/fonts/[name][ext]"
        filename: 'static/fonts/[name][ext]',
      },
    });

    // 4) Se un addon/preset azzera test: /\.scss$/, re-impostiamolo
    config.module.rules = config.module.rules.map((rule) => {
      // Cerchiamo la presenza di sass-loader
      if (rule.use && Array.isArray(rule.use) && rule.use.some((u) => typeof u === 'object' && u.loader?.includes('sass-loader'))) {
        if (!rule.test || Object.keys(rule.test).length === 0) {
          console.log('>>> Ripristino test su regola SCSS', rule);
          rule.test = /\.scss$/;
        }
      }
      return rule;
    });

    return config;
  },
};
