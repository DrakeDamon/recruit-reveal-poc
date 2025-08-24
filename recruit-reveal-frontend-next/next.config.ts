import path from 'path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@recruit': path.resolve(__dirname, 'src'),
      '@utils':   path.resolve(__dirname, 'src/utils'),
      '@social':  path.resolve(__dirname, 'src/social'),
      '@api':     path.resolve(__dirname, 'src/api'),
    }
    return config
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ]
  },
}

export default nextConfig
