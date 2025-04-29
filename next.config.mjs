const nextConfig = {
  experimental: {},
  output: 'export',
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: [{
        loader: '@svgr/webpack',
        options: {
          svgoConfig: {
            plugins: [
              {
                name: 'preset-default',
                params: {
                  overrides: {
                    // Keep the viewBox attribute
                    removeViewBox: false
                  }
                }
              }
            ]
          }
        }
      }]
    });
    return config;
  },
};

export default nextConfig;