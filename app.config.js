// Extends app.json. Only used to serve the web build from a sub-path
// (GitHub Pages publishes it at https://<owner>.github.io/<repo>/).
// EXPO_BASE_URL is set only by the web deploy workflow; native builds and local dev are unaffected.
module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_BASE_URL;
  if (!baseUrl) return config;
  return { ...config, experiments: { ...(config.experiments ?? {}), baseUrl } };
};
