// Extends app.json. Only used to serve the web build from a sub-path
// (GitHub Pages publishes it at https://<owner>.github.io/<repo>/).
// EXPO_BASE_URL is set only by the web deploy workflow; native builds and local dev are unaffected.
module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_BASE_URL;

  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-icon.png",
          imageWidth: 100,
          resizeMode: "contain",
          backgroundColor: "#F7F5F2",
        },
      ],
    ],
    ...(baseUrl
      ? {
          experiments: {
            ...(config.experiments ?? {}),
            baseUrl,
          },
        }
      : {}),
  };
};
