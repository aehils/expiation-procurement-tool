/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /\.md$/,
      type: "asset/source",
    });
    config.module.rules.push({
      test: /\.node$/,
      use: "node-loader",
    });
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    config.externals = [...(config.externals || []), "@libsql/darwin-arm64", "@libsql/darwin-x64", "@libsql/linux-arm64-gnu", "@libsql/linux-x64-gnu", "@libsql/win32-x64-msvc"];
    return config;
  },
  serverExternalPackages: ["@libsql/client", "@prisma/adapter-libsql"],
};

export default nextConfig;
