/** @type {import('expo/fingerprint').Config} */
const config = {
  // By default the fingerprint only picks up `targets/*/expo-target.config.js`,
  // not the Swift sources next to them. Without this, editing widget / Live
  // Activity / Shield code would leave the runtime version unchanged, and EAS
  // Update would happily serve JS to a build whose native code doesn't match.
  extraSources: [
    {
      type: 'dir',
      filePath: 'targets',
      reasons: ['bittersweet-native-targets'],
    },
  ],
};

module.exports = config;
