const branch = process.env.CI_COMMIT_BRANCH;

const config = {
  branches: [
    'master',
    {
      name: 'release',
      channel: false,
    },
    {
      name: 'prerelease',
      prerelease: true,
    },
  ],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    [
      // https://github.com/semantic-release/npm
      '@semantic-release/npm',
      {
        npmPublish: true,
        pkgRoot: '.',
      },
    ],
  ],
};

// create changelog only for releases in order to avoid conflicts merging into release from prerelease
if (config.branches.some((it) => it === branch || (it.name === branch && !it.prerelease))) {
  config.plugins.push('@semantic-release/changelog', [
    // https://github.com/semantic-release/git
    '@semantic-release/git',
    {
      assets: ['CHANGELOG.md', 'package.json'],
      message: 'chore(${branch}): ${nextRelease.version} \n\n${nextRelease.notes}',
    },
  ]);
}

module.exports = config;
