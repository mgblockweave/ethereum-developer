import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Avoid bundling logging internals (pino/thread-stream and friends) that break bundlers.
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      pino: false,
      "thread-stream": false,
      "pino-pretty": false,
      "sonic-boom": false,
      "fast-redact": false,
      "safe-stable-stringify": false,
      "quick-format-unescaped": false,
      "atomic-sleep": false,
    };
    return config;
  },
};

export default nextConfig;
